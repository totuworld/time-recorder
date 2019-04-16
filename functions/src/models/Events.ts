import debug from 'debug';

import { FireabaseAdmin } from '../services/FirebaseAdmin';
import { IEvent, IEventOrder } from './interface/IEvent';
import { IUsersItem } from './interface/IUsers';
import { updateAllUsersOverWorkTimeTodayWorkker } from '../functions';

type UserItemWithDocID = IUsersItem & { docId: string };
type OrderWithDocID = IEventOrder & { docId: string };

const log = debug('tr:Events');
class EventType {
  private orders: Map<string, OrderWithDocID[]>;
  private guests: Map<string, UserItemWithDocID[]>;

  constructor() {
    if (FireabaseAdmin.isInit === false) {
      FireabaseAdmin.bootstrap();
    }
    this.orders = new Map();
    this.guests = new Map();
  }
  get EventsStore() {
    const ref = FireabaseAdmin.Firestore.collection('events');
    return ref;
  }

  EventDoc(eventId: string) {
    return this.EventsStore.doc(eventId);
  }

  GuestsCollection(eventId: string) {
    return this.EventsStore.doc(eventId).collection('guests');
  }

  OrdersCollection(eventId: string) {
    return this.EventsStore.doc(eventId).collection('orders');
  }

  async findAll({ page, limit }: { page: number; limit: number }) {
    const allEventSnap = await this.EventsStore.get();
    const datas = allEventSnap.docs.map(mv => {
      const returnData = {
        ...mv.data(),
        id: mv.id
      } as IEvent & { id: string };
      return returnData;
    });
    const filterData = datas.filter(fv => {
      return fv.private === false && fv.closed === false;
    });
    const start = (page - 1) * limit;
    const end = start + limit;
    log(start, limit, filterData);
    const splitArr = [...filterData].slice(start, end);
    log('splitArr: ', splitArr);
    return splitArr;
  }

  /** 이벤트 조회 */
  async find({
    eventId
  }: {
    eventId: string;
  }): Promise<IEvent & { id: string }> {
    try {
      const eventSnap = await this.EventDoc(eventId).get();
      log(eventSnap.exists);
      if (eventSnap.exists === false) {
        throw new Error('not exist event');
      }
      return {
        ...eventSnap.data(),
        id: eventId
      } as IEvent & { id: string };
    } catch (err) {
      log(err);
      throw err;
    }
  }

  /** 이벤트 생성 */
  async add(args: {
    title: string;
    desc: string;
    private: boolean;
    owner: IUsersItem;
    guests?: IUsersItem[];
    last_order?: Date;
  }) {
    log(args);
    try {
      const addData = {
        title: args.title,
        desc: args.desc,
        private: args.private,
        owner_id: args.owner.id,
        owner_name: args.owner.real_name,
        closed: false
      };
      if (!!args.last_order) {
        addData['last_order'] = args.last_order;
      }
      const result = await this.EventsStore.add(addData);
      if (!!args.guests === true && args.guests.length > 0) {
        await this.addGuests({ eventId: result.id, guests: args.guests });
      }
      return {
        id: result.id,
        title: args.title,
        desc: args.desc,
        private: args.private,
        last_order: args.last_order,
        owner_id: args.owner.id,
        owner_name: args.owner.real_name
      };
    } catch (err) {
      log(err);
      throw err;
    }
  }

  async update(args: {
    eventId: string;
    title?: string;
    desc?: string;
    private?: boolean;
    last_order?: Date;
    closed?: boolean;
  }) {
    const findResult = await this.find({ eventId: args.eventId });
    log(findResult);
    if (!!findResult === false) {
      throw new Error('not exist event');
    }
    try {
      const updateData = {
        ...findResult,
        ...args
      };
      const eventSnap = this.EventDoc(args.eventId);
      await eventSnap.update(updateData);
      const updateFindResult = await this.find({ eventId: args.eventId });
      return updateFindResult;
    } catch (err) {
      log(err);
      throw err;
    }
  }

  /** 참가자 목록 */
  async findGuests({ eventId }: { eventId: string }) {
    if (this.guests.has(eventId)) {
      return this.guests.get(eventId);
    }
    const guestCollection = this.GuestsCollection(eventId);
    const allQueueSnap = await guestCollection.get();
    const datas = allQueueSnap.docs.map(mv => {
      const returnData = {
        ...mv.data(),
        docId: mv.id
      } as UserItemWithDocID;
      return returnData;
    });
    this.guests.set(eventId, datas);
    return datas;
  }

  /** 참가자 추가 */
  async addGuests(args: { eventId: string; guests: IUsersItem[] }) {
    const guests = this.GuestsCollection(args.eventId);
    const batch = FireabaseAdmin.Firestore.batch();
    for (const guest of args.guests) {
      batch.set(guests.doc(guest.id), { ...guest });
    }
    try {
      await batch.commit();
    } catch (err) {
      throw err;
    }
  }

  /** 참가자 제거 */
  async deleteGuest({ eventId, docId }: { eventId: string; docId: string }) {
    const queueRef = this.GuestsCollection(eventId);
    await queueRef.doc(docId).delete();
    // TODO: 음료 주문이 있다면 제거해야한다.
  }

  /** 주문 목록 */
  async findOrders({ eventId }: { eventId: string }) {
    if (this.orders.has(eventId)) {
      log('findOrders - cache get');
      return this.orders.get(eventId);
    }
    const orderCollection = this.OrdersCollection(eventId);
    const allQueueSnap = await orderCollection.get();
    const datas = allQueueSnap.docs.map(mv => {
      const returnData = {
        ...mv.data(),
        docId: mv.id
      } as OrderWithDocID;
      return returnData;
    });
    log('findOrders - cache set');
    this.orders.set(eventId, datas);
    return datas;
  }

  /** 주문 추가 */
  async addOrder(args: { eventId: string; order: IEventOrder }) {
    // 주문 마감 여부는 이미 체크했다는 전제
    const orderCollection = this.OrdersCollection(args.eventId);

    const oldDoc = orderCollection.doc(args.order.guest_id);
    await oldDoc.set({
      ...args.order,
      id: args.order.guest_id
    });
    const returnData = {
      ...args.order,
      id: args.order.guest_id,
      docId: args.order.guest_id
    } as OrderWithDocID;
    if (this.orders.has(args.eventId) === false) {
      await this.findOrders({eventId: args.eventId});
    }
    const updateArr = this.orders.get(args.eventId);
    const findIdx = updateArr.findIndex(fv => fv.guest_id === args.order.guest_id);
    // 이미 주문한 내용이 있는가?
    if (findIdx >= 0) {
      updateArr[findIdx] = returnData;
    } else {
      updateArr.push(returnData);
    }
    this.orders.set(args.eventId, updateArr);
    return returnData;
  }
}

export const Events = new EventType();

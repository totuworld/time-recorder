import debug from 'debug';

import { FireabaseAdmin } from '../services/FirebaseAdmin';
import { IAddRCEvent, IRCEvent } from './interface/IRandomCoffeeEvent';
import { IUsersItem } from './interface/IUsers';

type UserItemWithDocID = IUsersItem & { docId: string };

const log = debug('tr:RandomCoffeeEvents');
class RandomCoffeeEventType {
  /** 참가자 목록을 저장한다(캐시용) */
  private guests: Map<string, UserItemWithDocID[]>;

  constructor() {
    if (FireabaseAdmin.isInit === false) {
      FireabaseAdmin.bootstrap();
    }
    this.guests = new Map();
  }
  get EventsStore() {
    const ref = FireabaseAdmin.Firestore.collection('random_coffee_events');
    return ref;
  }

  EventDoc(eventId: string) {
    return this.EventsStore.doc(eventId);
  }

  GuestsCollection(eventId: string) {
    return this.EventsStore.doc(eventId).collection('guests');
  }

  async findAll({ page, limit }: { page: number; limit: number }) {
    const allEventSnap = await this.EventsStore.get();
    const datas = allEventSnap.docs.map(mv => {
      const returnData = {
        ...mv.data(),
        id: mv.id
      } as IRCEvent & { id: string };
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
  async find({ eventId }: { eventId: string }): Promise<IRCEvent> {
    try {
      const eventSnap = await this.EventDoc(eventId).get();
      log(eventSnap.exists);
      if (eventSnap.exists === false) {
        throw new Error('not exist event');
      }
      return {
        ...eventSnap.data(),
        id: eventId
      } as IRCEvent;
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
    last_register: Date;
    owner: IUsersItem;
    guests?: IUsersItem[];
  }): Promise<IRCEvent> {
    log(args);
    try {
      const addData: IAddRCEvent = {
        title: args.title,
        desc: args.desc,
        private: args.private,
        owner_id: args.owner.id,
        owner_name: args.owner.real_name,
        closed: false,
        last_register: args.last_register
      };
      const result = await this.EventsStore.add(addData);
      if (!!args.guests === true && args.guests.length > 0) {
        await this.addGuests({ eventId: result.id, guests: args.guests });
      }
      return {
        ...addData,
        id: result.id
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
    last_register?: Date;
    closed?: boolean;
    match?: IUsersItem[][];
  }) {
    const findResult = await this.find({ eventId: args.eventId });
    log(findResult);
    if (!!findResult === false) {
      throw new Error('not exist event');
    }
    try {
      const updateData: IRCEvent = {
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

  /** 참가자 목록(캐시 우선 조회) */
  async findGuests({ eventId }: { eventId: string }) {
    if (this.guests.has(eventId)) {
      return this.guests.get(eventId);
    }
    const datas = await this.loadGuests(eventId);
    this.guests.set(eventId, datas);
    return datas;
  }

  private async loadGuests(eventId: string) {
    const guestCollection = this.GuestsCollection(eventId);
    const allQueueSnap = await guestCollection.get();
    const datas = allQueueSnap.docs.map(mv => {
      const returnData = {
        ...mv.data(),
        docId: mv.id
      } as UserItemWithDocID;
      return returnData;
    });
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
      const datas = await this.loadGuests(args.eventId);
      this.guests.set(args.eventId, datas);
    } catch (err) {
      throw err;
    }
  }

  /** 참가자 제거 */
  async deleteGuest({ eventId, docId }: { eventId: string; docId: string }) {
    const queueRef = this.GuestsCollection(eventId);
    await queueRef.doc(docId).delete();
    // 캐시 업데이트 진행 체크
    if (this.guests.has(eventId)) {
      const guests = this.guests.get(eventId);
      const updateGuests = guests.filter(fv => fv.docId !== docId);
      this.guests.set(eventId, updateGuests);
    }
  }

  /** 매치를 생성한다.  */
  async addMatch({ eventId }: { eventId: string }) {
    const guests = await this.loadGuests(eventId);
    if (guests.length <= 1) {
      return [];
    }
    const match = this.makeMatch(guests);
    await this.update({ eventId, match });
    return match;
  }

  private makeMatch(guests: UserItemWithDocID[]) {
    // 사용자가 있으면 이제 매칭을 진행해보자.
    let remainGuests = [...guests];
    const matchList: UserItemWithDocID[][] = [];
    const maxLoopCount = (guests.length - (guests.length % 2)) / 2;
    for (let i = 0; i < maxLoopCount; i += 1) {
      // 3명만 남았나?
      if (remainGuests.length <= 3) {
        matchList.push([...remainGuests]);
        break;
      }
      const { select: first, remain: firstRemain } = this.getRandomUser(
        remainGuests
      );
      const { select: second, remain: secondRemain } = this.getRandomUser(
        firstRemain
      );
      matchList.push([first, second]);
      remainGuests = secondRemain;
    }
    return matchList;
  }

  private getRandomUser(list: UserItemWithDocID[]) {
    const origin = [...list];
    const randomIndex = Math.floor(Math.random() * origin.length);
    const select = origin.splice(randomIndex, 1);
    return {
      select: select[0],
      remain: origin
    };
  }
}

export const RandomCoffeeEvents = new RandomCoffeeEventType();

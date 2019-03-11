import debug from 'debug';

import { FireabaseAdmin } from '../services/FirebaseAdmin';
import { IBeverage } from './interface/IEvent';

type BeveragesWithID = IBeverage & { id: string };

const log = debug('tr:Beverages');
class BeveragesType {
  private BEVERAGE_NAMES = 'names';
  constructor() {
    if (FireabaseAdmin.isInit === false) {
      FireabaseAdmin.bootstrap();
    }
  }
  get BeveragesStore() {
    const ref = FireabaseAdmin.Firestore.collection('beverages');
    return ref;
  }

  BeverageDoc(beverageId: string) {
    return this.BeveragesStore.doc(beverageId);
  }

  /** 음료 전체 조회 */
  async findAll(): Promise<BeveragesWithID[]> {
    const snaps = await this.BeveragesStore.get();
    const datas = snaps.docs
      .filter(fv => fv.id !== this.BEVERAGE_NAMES)
      .map(mv => {
        const returnData = {
          ...mv.data(),
          id: mv.id
        } as BeveragesWithID;
        return returnData;
      });
    return datas;
  }

  /** 음료 조회 */
  async find({ beverageId }: { beverageId: string }): Promise<BeveragesWithID> {
    const eventSnap = await this.BeverageDoc(beverageId).get();
    return {
      ...eventSnap.data(),
      id: eventSnap.id
    } as BeveragesWithID;
  }

  /** 음료 생성 */
  async add(args: { title: string }) {
    log(args);
    const namesDoc = await this.BeverageDoc(this.BEVERAGE_NAMES).get();
    // 기존에 추가되어있는지 확인
    if (namesDoc.exists === true) {
      const nameArr = namesDoc.data() as {
        names: { title: string; id: string }[];
      };
      if (!!nameArr.names) {
        const findBeverage = nameArr.names.find(fv => fv.title === args.title);
        if (!!findBeverage) {
          return findBeverage;
        }
      }
    }
    // 추가
    const result = await this.BeveragesStore.add({
      title: args.title
    });
    if (namesDoc.exists === true) {
      const nameArr = namesDoc.data() as {
        names: { title: string; id: string }[];
      };
      const newNameArr = [
        ...nameArr.names,
        { title: args.title, id: result.id }
      ];
      await this.BeverageDoc(this.BEVERAGE_NAMES).update({ names: newNameArr });
    }
    return {
      id: result.id,
      title: args.title
    };
  }
}

export const Beverages = new BeveragesType();

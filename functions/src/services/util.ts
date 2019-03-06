import * as luxon from 'luxon';

export interface ITimeObj {
  REST: { [key: string]: number };
  WORK: { [key: string]: number };
  EMERGENCY: { [key: string]: number };
  REMOTE: { [key: string]: number };
  VACATION: { [key: string]: number };
  FUSEOVERLOAD: { [key: string]: number };
}

export class Util {
  public static dateTimeShort() {
    const time = luxon.DateTime.local();
    return time
      .setLocale('ko-kr')
      .setZone('Asia/Seoul')
      .toLocaleString(luxon.DateTime.DATETIME_SHORT);
  }
  public static toDateTimeShort(timeStr: string) {
    const time = luxon.DateTime.fromISO(timeStr);
    return time
      .setLocale('ko-kr')
      .setZone('Asia/Seoul')
      .toLocaleString(luxon.DateTime.DATETIME_SHORT);
  }
  public static currentTimeStamp() {
    const time = luxon.DateTime.utc();
    return time.toISO();
  }
  public static currentDate() {
    const time = luxon.DateTime.local();
    return time
      .setLocale('ko-kr')
      .setZone('Asia/Seoul')
      .toFormat('yyyyLLdd');
  }
  public static getBetweenDuration(a: string, b: string) {
    const aTime = luxon.DateTime.fromISO(a);
    const bTime = luxon.DateTime.fromISO(b);
    const duration = bTime.diff(aTime).normalize();
    return duration;
  }
  public static reduceTimeObj(timeObj: ITimeObj[], target: keyof ITimeObj) {
    return timeObj.reduce((acc, cur) => {
      const updateData = { ...acc };
      Object.keys(cur[target]).forEach(fv => {
        if (!!updateData[fv]) {
          updateData[fv] += cur[target][fv];
        } else {
          updateData[fv] = cur[target][fv];
        }
      });
      return updateData;
    }, {});
  }

  public static calTimeObj(a: object, b: object, operator: string = 'plus') {
    const updateObj = { ...a };
    Object.keys(b).forEach(key => {
      if (!!updateObj[key]) {
        if (operator !== 'plus') {
          updateObj[key] -= b[key];
        } else {
          updateObj[key] += b[key];
        }
      } else {
        if (operator !== 'plus') {
          updateObj[key] = -b[key];
        } else {
          updateObj[key] = b[key];
        }
      }
    });
    return updateObj;
  }

  public static reduceDurationObject(
    timeObj: ITimeObj[],
    target: keyof ITimeObj
  ) {
    const totalWorkTimeObj = this.reduceTimeObj(timeObj, target);
    return luxon.Duration.fromObject(totalWorkTimeObj);
  }
}

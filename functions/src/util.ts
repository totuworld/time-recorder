import * as luxon from 'luxon';

export class Util {
  static hiMsg() {
    return `👋 어서오세요. ${this.dateTimeShort()}`;
  }
  static byeMsg() {
    return `👍 수고하셨습니다. ${this.dateTimeShort()}`;
  }
  static dateTimeShort() {
    const time = luxon.DateTime.local();
    return time.setLocale('ko-kr').setZone('Asia/Seoul').toLocaleString(luxon.DateTime.DATETIME_SHORT);
  }
  static currentTimeStamp() {
    const time = luxon.DateTime.utc();
    return time.toISO();
  }
  static currentDate() {
    const time = luxon.DateTime.local();
    return time.setLocale('ko-kr').setZone('Asia/Seoul').toFormat('yyyyLLdd');
  }
  static getBetweenDuration(a: string, b: string) {
    const aTime = luxon.DateTime.fromISO(a);
    const bTime = luxon.DateTime.fromISO(b);
    const duration = bTime.diff(aTime).normalize();
    return duration;
  }
}
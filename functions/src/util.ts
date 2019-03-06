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
    return time
      .setLocale('ko-kr')
      .setZone('Asia/Seoul')
      .toLocaleString(luxon.DateTime.DATETIME_SHORT);
  }
  static toDateTimeShort(timeStr: string) {
    const time = luxon.DateTime.fromISO(timeStr);
    return time
      .setLocale('ko-kr')
      .setZone('Asia/Seoul')
      .toLocaleString(luxon.DateTime.DATETIME_SHORT);
  }
  static currentTimeStamp() {
    const time = luxon.DateTime.utc();
    return time.toISO();
  }
  static formatStrToDateTime(date: string, format: string) {
    const time = luxon.DateTime.fromFormat(date, format).toUTC();
    return time;
  }
  static currentDate() {
    return this.currentDateWithFormat('yyyyLLdd');
  }
  static currentDateWithFormat(format: string) {
    const time = luxon.DateTime.local();
    return time
      .setLocale('ko-kr')
      .setZone('Asia/Seoul')
      .toFormat(format);
  }
  static getBetweenDuration(a: string, b: string) {
    const aTime = luxon.DateTime.fromISO(a);
    const bTime = luxon.DateTime.fromISO(b);
    const duration = bTime.diff(aTime).normalize();
    return duration;
  }
  public static isEmpty<T>(
    value?: T | undefined | null
  ): value is null | undefined {
    if (value === undefined || value === null) {
      return true;
    }
    if (typeof value === 'number' && isNaN(value)) {
      return true;
    }
    if (typeof value === 'string' && value === '') {
      return true;
    }
    if (typeof value === 'object' && Array.isArray(value) && value.length < 1) {
      return true;
    }
    if (
      typeof value === 'object' &&
      !(value instanceof Date) &&
      Object.keys(value).length < 1
    ) {
      return true;
    }
    return false;
  }
  public static isNotEmpty<T>(value?: T | null | undefined): value is T {
    return !Util.isEmpty<T>(value);
  }
}

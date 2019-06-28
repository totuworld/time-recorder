import debug from 'debug';
import * as luxon from 'luxon';
import * as uuid from 'uuid';
import { EN_WORK_TITLE_KR, EN_WORK_TYPE } from '../contants/enum/EN_WORK_TYPE';
import { FireabaseAdmin } from '../services/FirebaseAdmin';
import { Util } from '../util';
import {
  IWorkLogFindRequest,
  IWorkLogRequest,
  IOverWorkFindRequest
} from './interface/IWorkLogRequest';
import {
  LogData,
  IOverWork,
  IFuseOverWork
} from './interface/SlackSlashCommand';
const log = debug('tr:WorkLogType');
export class WorkLogType {
  constructor() {
    if (FireabaseAdmin.isInit === false) {
      FireabaseAdmin.bootstrap();
    }
  }
  /** 사용자 root store */
  get UserRoot() {
    const userRootRef = FireabaseAdmin.Database.ref('user');
    return userRootRef;
  }
  /** 모든 워크로그 기록 */
  get Work() {
    const workRef = FireabaseAdmin.Database.ref('work');
    return workRef;
  }
  get OverTime() {
    const overTimeRef = FireabaseAdmin.Database.ref('over_time');
    return overTimeRef;
  }
  get FuseOverTime() {
    const fuseOverTimeRef = FireabaseAdmin.Database.ref('fuse_over_time');
    return fuseOverTimeRef;
  }
  get Holiday() {
    const holiDayRef = FireabaseAdmin.Database.ref('public_holiday');
    return holiDayRef;
  }
  /** 사용자별 store */
  UserRef(userId: string) {
    return this.UserRoot.child(userId);
  }
  OverTimeRef(id: string) {
    return this.OverTime.child(id);
  }
  FuseOverTimeRef(id: string) {
    return this.FuseOverTime.child(id);
  }
  // #region 저장 기능
  /** 출근 기록 */
  async storeWork({ userId }: IWorkLogRequest) {
    await this.store({ userId, type: EN_WORK_TYPE.WORK });
  }
  /** 퇴근 기록 */
  async storeBye({ userId }: IWorkLogRequest) {
    await this.store({ userId, type: EN_WORK_TYPE.BYEBYE });
  }
  /** 휴식 기록 */
  async storeRest({ userId }: IWorkLogRequest) {
    await this.store({ userId, type: EN_WORK_TYPE.REST });
  }
  /** 긴급대응 기록 */
  async storeEmergency({ userId }: IWorkLogRequest) {
    await this.store({ userId, type: EN_WORK_TYPE.EMERGENCY });
  }
  /** 완료 기록 */
  async storeComplete({
    userId,
    targetDate
  }: IWorkLogRequest & { targetDate?: string }): Promise<{ msg: string }> {
    const time = Util.currentTimeStamp();
    const userRef = this.UserRef(userId);
    const date = !!targetDate ? targetDate : Util.currentDate();
    const logDatas = await userRef
      .child(date)
      .once('value')
      .then(snap => {
        const childData = snap.val() as { [key: string]: LogData };
        const filter = Object.keys(childData).reduce(
          (acc: LogData & { key: string }[], key) => {
            const fv = childData[key] as LogData & { key: string };
            fv['key'] = key; // 키 저장.
            // REST, EMERGENCY 중 done이 없는 것 추출
            if (
              (fv.type === EN_WORK_TYPE.REST ||
                fv.type === EN_WORK_TYPE.EMERGENCY) &&
              !!fv.done === false
            ) {
              acc.push(fv);
            }
            return acc;
          },
          []
        );
        return filter;
      });
    if (logDatas.length === 0) {
      // 딱히 완료할 잡이 없다.
      return { msg: `완료처리할 이벤트가 없어요` };
    }
    const updateData = logDatas[logDatas.length - 1];
    const duration = Util.getBetweenDuration(updateData.time, time).toObject();
    const durationStr = Object.keys(duration)
      .map(key => `${duration[key]} ${key}`)
      .join(' ');
    const msg = `${
      EN_WORK_TITLE_KR[updateData.type]
    } 완료 (소요: ${durationStr})`;
    updateData.done = time;
    await userRef
      .child(date)
      .child(updateData.key)
      .set(updateData);
    return { msg };
  }
  getRefKey() {
    return {
      key: `${luxon.DateTime.local().toFormat(
        'yyyyLLLddHHmmss'
      )}${uuid.v4().toLocaleLowerCase()}`
    };
  }
  async store({
    userId,
    type,
    timeStr,
    targetDate,
    doneStr
  }: IWorkLogRequest & {
    type: EN_WORK_TYPE;
    timeStr?: string;
    targetDate?: string;
    doneStr?: string;
  }) {
    const time = !!timeStr ? timeStr : Util.currentTimeStamp();
    const done = !!doneStr ? doneStr : null;
    log(done, doneStr);
    const childKey = !!targetDate ? targetDate : Util.currentDate();
    const refKey = this.getRefKey();
    const userRef = this.UserRef(userId);
    const pushObj = { refKey: refKey.key, time, type };
    if (done !== null) {
      pushObj['done'] = done;
    }
    await userRef.child(childKey).push(pushObj);
  }
  async delete({
    userId,
    targetDate,
    log_id
  }: IWorkLogRequest & { targetDate: string; log_id: string }) {
    const userRef = this.UserRef(userId);
    const updateTargetDate =
      /-/gi.test(targetDate) === true
        ? targetDate.replace(/-/gi, '')
        : targetDate;
    return userRef
      .child(updateTargetDate)
      .child(log_id)
      .set(null);
  }
  async updateData({
    userId,
    updateDate,
    updateRecordkey,
    updateDataKey,
    updateTime
  }: IWorkLogRequest & {
    updateRecordkey: string;
    updateDataKey: keyof LogData;
    updateDate: string;
    updateTime: string;
  }) {
    const userRef = this.UserRef(userId);
    const targetRef = userRef
      .child(updateDate)
      .child(updateRecordkey)
      .child(updateDataKey);
    await targetRef.set(updateTime);
  }
  // #endregion
  async findAllWithLuxonDateTime({
    startDate,
    endDate,
    userId
  }: {
    startDate: luxon.DateTime;
    endDate: luxon.DateTime;
    userId: string;
  }) {
    return await this.findAll({
      startDate: startDate.toISO(),
      endDate: endDate.toISO(),
      userId
    });
  }
  async findAll({
    userId,
    startDate,
    endDate
  }: IWorkLogRequest & IWorkLogFindRequest) {
    const haveStartEndDate = {
      start: !!startDate && this.validateDateString(startDate) === true,
      end: !!endDate && this.validateDateString(endDate) === true
    };
    /** start end 설정이 있는가? */
    if (haveStartEndDate.start === false || haveStartEndDate.end === false) {
      // 설정이 없다면 당일 데이터만 뽑아서 넘긴다.
      const todayData = await this.find({ userId });
      const data: { [key: string]: { [key: string]: LogData } } = {};
      data[`${todayData.date}`] = todayData.data;
      return [data];
    }
    const userRef = this.UserRef(userId);
    const snap = await userRef.once('value');
    const updateValue = snap.val() as {
      [key: string]: { [key: string]: LogData };
    };
    if (!!updateValue === false) {
      return [];
    }
    // 일정 안에 들어오는 정보를 필터링해서 내보낸다.
    const start = luxon.DateTime.fromISO(startDate);
    const end = luxon.DateTime.fromISO(endDate);
    const filterdSnap = Object.keys(updateValue)
      .filter(fv => {
        const fvDate = luxon.DateTime.fromFormat(fv, 'yyyyLLdd');
        return (
          fvDate.diff(start).milliseconds >= 0 &&
          fvDate.diff(end).milliseconds <= 0
        );
      })
      .map(mv => {
        const returnObject: { [key: string]: { [key: string]: LogData } } = {};
        returnObject[mv] = updateValue[mv];
        return returnObject;
      });
    return filterdSnap;
  }
  async find({ userId, startDate }: IWorkLogRequest & IWorkLogFindRequest) {
    // startDate가 validate에 실패하면 요청한 날짜를 기준으로 한다.
    const updateStartDate =
      !!startDate && this.validateDateStringWithoutDash(startDate) === true
        ? startDate
        : luxon.DateTime.local()
            .setZone('Asia/Seoul')
            .toFormat('yyyyLLdd');
    const userRef = this.UserRef(userId);
    const snap = await userRef.child(updateStartDate).once('value');
    const childData = snap.val() as { [key: string]: LogData };
    if (childData === null) {
      return {
        date: updateStartDate,
        data: {}
      };
    }
    return {
      date: updateStartDate,
      data: childData === null ? {} : childData
    };
  }
  validateDateString(dateStr: string): boolean {
    const ptn = /(202[0-9]|201[0-9]|200[0-9]|[0-1][0-9]{3})-(1[0-2]|0[1-9])-(3[01]|[0-2][1-9]|[12]0)/;
    return ptn.test(dateStr);
  }
  validateDateStringWithoutDash(dateStr: string): boolean {
    const ptn = /(202[0-9]|201[0-9]|200[0-9]|[0-1][0-9]{3})(1[0-2]|0[1-9])(3[01]|[0-2][1-9]|[12]0)/;
    return ptn.test(dateStr);
  }
  checkAddWorkType(logs: LogData[], targetType: EN_WORK_TYPE) {
    if (
      targetType === EN_WORK_TYPE.WORK ||
      targetType === EN_WORK_TYPE.REMOTE
    ) {
      return this.possibleAddWorkOrRemote(logs);
    }
    if (targetType === EN_WORK_TYPE.BYEBYE) {
      return this.possibleAddByeBye(logs);
    }
    if (targetType === EN_WORK_TYPE.REMOTEDONE) {
      return this.possibleAddRemoteDone(logs);
    }
    if (targetType === EN_WORK_TYPE.REST) {
      return this.possibleAddRest(logs);
    }
    if (targetType === EN_WORK_TYPE.EMERGENCY) {
      return this.possibleAddEmergency(logs);
    }
    return false;
  }
  /** 출근을 기록할 수 있는가? */
  possibleAddWorkOrRemote(logs: LogData[]) {
    const remoteLogs = this.reduceWorkLogs(logs);
    const haveTrue = Object.keys(remoteLogs).reduce((acc, cur) => {
      if (acc === true) {
        return acc;
      }
      if (remoteLogs[cur] === true) {
        return true;
      }
      return acc;
    }, false);
    // 한 개라도 WORK나 REMOTE가 열려있는가? false, 아니면 true
    return !haveTrue;
  }
  possibleAddByeBye(logs: LogData[]) {
    const remoteLogs = this.reduceWorkLogs(logs);
    // work가 열려있어야만 가능.
    return (
      remoteLogs.WORK === true &&
      remoteLogs.REMOTE === false &&
      remoteLogs.EMERGENCY === false
    );
  }
  possibleAddRemoteDone(logs: LogData[]) {
    const remoteLogs = this.reduceWorkLogs(logs);
    // remote가 열려있어야 가능
    return (
      remoteLogs.WORK === false &&
      remoteLogs.REMOTE === true &&
      remoteLogs.EMERGENCY === false
    );
  }
  possibleAddRest(logs: LogData[]) {
    const remoteLogs = this.reduceWorkLogs(logs);
    // work나 remote가 열려있어야한다.
    return remoteLogs.WORK === true || remoteLogs.REMOTE === true;
  }
  possibleAddEmergency(logs: LogData[]) {
    const remoteLogs = this.reduceWorkLogs(logs);
    // work, remote, emergency가 모두 close 일 때 가능
    return (
      remoteLogs.WORK === false &&
      remoteLogs.REMOTE === false &&
      remoteLogs.EMERGENCY === false
    );
  }
  private reduceWorkLogs(logs: LogData[]) {
    return logs.reduce(
      (acc: { WORK: boolean; REMOTE: boolean; EMERGENCY: boolean }, cur) => {
        if (acc.WORK === false && cur.type === EN_WORK_TYPE.WORK) {
          acc.WORK = true;
        } else if (acc.WORK === true && cur.type === EN_WORK_TYPE.BYEBYE) {
          acc.WORK = false;
        }
        if (acc.REMOTE === false && cur.type === EN_WORK_TYPE.REMOTE) {
          acc.REMOTE = true;
        } else if (
          acc.REMOTE === true &&
          cur.type === EN_WORK_TYPE.REMOTEDONE
        ) {
          acc.REMOTE = false;
        }
        if (
          acc.EMERGENCY === false &&
          cur.type === EN_WORK_TYPE.EMERGENCY &&
          !!cur.done === false
        ) {
          acc.EMERGENCY = true;
        }
        return acc;
      },
      { WORK: false, REMOTE: false, EMERGENCY: false }
    );
  }
  async storeOverWorkTime({
    login_auth_id,
    week,
    over_time_obj,
    remain_time_obj
  }: IOverWorkFindRequest & {
    over_time_obj: luxon.DurationObject;
    remain_time_obj?: luxon.DurationObject;
  }): Promise<IOverWork> {
    const overTimeRef = this.OverTimeRef(login_auth_id);
    // 이미 기록이 있는지 확인.
    const overWorkRecord = await this.findOverWorkTime({
      login_auth_id,
      week
    });
    // 기존에 데이터가 있는가?
    if (!!overWorkRecord === true) {
      // 기존의 over 데이터를 갈아치우자. 대신.. 사용 기록이 엉킬 수 있다. 대망!
      const updateData: IOverWork = { ...overWorkRecord };
      updateData.over = over_time_obj;
      if (!!remain_time_obj) {
        updateData['remain'] = remain_time_obj;
      }
      await overTimeRef.child(week).set(updateData);
      return updateData;
    }
    const recordData: IOverWork = {
      week,
      over: over_time_obj,
      remain: !!remain_time_obj ? remain_time_obj : over_time_obj
    };
    await overTimeRef.child(week).set(recordData);
    return recordData;
  }
  async findOverWorkTime({
    login_auth_id,
    week
  }: IOverWorkFindRequest): Promise<IOverWork> {
    const overTimeRef = this.OverTimeRef(login_auth_id);
    const snap = await overTimeRef.child(week).once('value');
    const childData = snap.val() as IOverWork;
    if (childData === null) {
      return null;
    }
    return {
      ...childData
    };
  }
  async findAllOverWorkTime({
    login_auth_id
  }: {
    login_auth_id: string;
  }): Promise<IOverWork[]> {
    const overTimeRef = this.OverTimeRef(login_auth_id);
    const snap = await overTimeRef.once('value');
    const childData = snap.val() as { [key: string]: IOverWork };
    if (childData === null) {
      return [];
    }
    const returnData = Object.keys(childData).map(key => childData[key]);
    return returnData;
  }
  /** 특정 주의 초과근무 정산 내역을 조회한다. */
  async findWeekOverWorkTime({
    login_auth_id,
    weekKey
  }: {
    login_auth_id: string;
    weekKey: string;
  }) {
    const overTimeRef = this.OverTimeRef(login_auth_id);
    const snap = await overTimeRef.once('value');
    const childData = snap.val() as { [key: string]: IOverWork };
    if (childData === null) {
      return null;
    }
    const returnData = childData[weekKey];
    return returnData;
  }
  async addFuseOverWorkTime({
    login_auth_id,
    date,
    use,
    note
  }: {
    login_auth_id: string;
    date: string;
    use: string;
    note?: string;
  }) {
    const fuseOverTimeRef = this.FuseOverTimeRef(login_auth_id);
    await fuseOverTimeRef.push({
      date,
      use,
      note
    });
  }
  async findAllFuseOverWorkTime({
    login_auth_id
  }: {
    login_auth_id: string;
  }): Promise<IFuseOverWork[]> {
    const fuseOverTimeRef = this.FuseOverTimeRef(login_auth_id);
    const snap = await fuseOverTimeRef.once('value');
    const childData = snap.val() as { [key: string]: IFuseOverWork };
    if (childData === null) {
      return [];
    }
    const returnData = Object.keys(childData).map(key => childData[key]);
    return returnData;
  }
  async getHolidaysDuration(
    startDate: luxon.DateTime,
    endDate: luxon.DateTime
  ) {
    const values = await this.getHolidays(startDate, endDate);
    return luxon.Duration.fromISO(`PT${values.length * 8}H`);
  }
  async getHolidays(startDate: luxon.DateTime, endDate: luxon.DateTime) {
    const ref = this.Holiday;
    const snap = await ref.once('value');
    const childData = snap.val() as {
      [key: string]: { date: string; name: string };
    };
    const values = Object.keys(childData)
      .map(mv => childData[mv])
      .filter(fv => {
        const date = luxon.DateTime.fromFormat(fv.date, 'yyyy-LL-dd');
        return date >= startDate && date <= endDate;
      });
    return values;
  }
}
export const WorkLog = new WorkLogType();

import * as luxon from 'luxon';
import moment from 'moment';

import { Util } from '../services/util';
import { EN_WORK_TYPE } from '../contants/enum/EN_WORK_TYPE';
import { LogData } from './interface/SlackSlashCommand';

export class TimeRecord {
  public static extractEtcTime(
    childData: {[key: string]: LogData },
    target: EN_WORK_TYPE) {
    const filteredValues = Object.keys(childData)
      .filter((fv) =>
        childData[fv].type === target
      )
      .map((mv) => childData[mv])
      .reduce<{ time: number; lastWorkTimeStamp: string; timeObj: {[key: string]: number} }>(
        (acc, cur: LogData) => {
          if (!!cur.done) {
            const duration = Util.getBetweenDuration(
              cur.time,
              cur.done
            );
            acc.time += duration.as('hours');
            const durationObj = duration.toObject();
            const updateTimeObj = {...acc.timeObj};
            Object.keys(durationObj).forEach((fv) => {
              if (!!updateTimeObj[fv]) {
                updateTimeObj[fv] += durationObj[fv];
              } else {
                updateTimeObj[fv] = durationObj[fv];
              }
            });
            acc.timeObj = updateTimeObj;
          }
          return acc;
        },
        {
          time: 0,
          lastWorkTimeStamp: '',
          timeObj: {},
        }
      );
    return {
      ...filteredValues,
      noBye: false,
    };
  }

  public static extractRestTime(childData: {[key: string]: LogData }) {
    return TimeRecord.extractEtcTime(childData, EN_WORK_TYPE.REST);
  }

  public static extractEmergencyTime(childData: {[key: string]: LogData }) {
    return TimeRecord.extractEtcTime(childData, EN_WORK_TYPE.EMERGENCY);
  }

  public static extractWorkTime(
    childData: {[key: string]: LogData },
    startType: EN_WORK_TYPE = EN_WORK_TYPE.WORK,
    endType: EN_WORK_TYPE = EN_WORK_TYPE.BYEBYE) {

    // 일한 시간 뽑아내자.
    // 출/퇴근 필터
    const workFilter = Object.keys(childData)
      .filter((fv) =>
        childData[fv].type === startType ||
        childData[fv].type === endType
      )
      .map((mv) => childData[mv])
      .reduce<{ time: number; lastWorkTimeStamp: string, timeObj: {[key: string]: number} }>(
        (acc, cur: LogData) => {
          // 출근인가?
          if (cur.type === startType) {
            acc.lastWorkTimeStamp = cur.time;
          }
          // 퇴근인가?
          if (cur.type === endType) {
            if (!!acc.lastWorkTimeStamp) {
              // 앞 시간부터 비교해서 시간 추가하자.
              const duration = Util.getBetweenDuration(
                acc.lastWorkTimeStamp,
                cur.time
              );
              acc.time += duration.as('hours');
              const durationObj = duration.toObject();
              const updateTimeObj = {...acc.timeObj};
              Object.keys(durationObj).forEach((fv) => {
                if (!!updateTimeObj[fv]) {
                  updateTimeObj[fv] += durationObj[fv];
                } else {
                  updateTimeObj[fv] = durationObj[fv];
                }
              });
              acc.timeObj = updateTimeObj;
            }
          }
          return acc;
        },
        {
          time: 0,
          lastWorkTimeStamp: '',
          timeObj: {},
        }
      );
    // 출근은 찍혔지만 퇴근 기록이 없는가?
    const noBye = !!workFilter.lastWorkTimeStamp && workFilter.time === 0;
    if (noBye === true) {
      const current = Util.currentTimeStamp();
      const duration = Util.getBetweenDuration(
        workFilter.lastWorkTimeStamp,
        current
      );
      workFilter.time += duration.as('hours');
    }
    return {
      ...workFilter,
      noBye
    };
  }

  public static convertWorkTime(
    value: Array<{ [key: string]: { [key: string]: LogData } }>,
    startDate: Date,
    endDate: Date,
  ) {
    const updateDatas = value.length > 0 ? value.map((mv) => {
      const dateStr = Object.keys(mv)[0];
      const data = {
        name: dateStr,
        data: { REST: 0, WORK: 0, EMERGENCY: 0, REMOTE: 0, VACATION: 0, FUSEOVERLOAD: 0 },
        timeObj: { REST: {}, WORK: {}, EMERGENCY: {}, REMOTE: {}, VACATION: {}, FUSEOVERLOAD: {} },
      };
      const workTime = TimeRecord.extractWorkTime(mv[dateStr]);
      const remoteTime = TimeRecord.extractWorkTime(mv[dateStr], EN_WORK_TYPE.REMOTE, EN_WORK_TYPE.REMOTEDONE);
      const restTime = TimeRecord.extractRestTime(mv[dateStr]);
      const emergencyTime = TimeRecord.extractEmergencyTime(mv[dateStr]);
      const vacationTime = TimeRecord.extractEtcTime(mv[dateStr], EN_WORK_TYPE.VACATION);
      const overLoadTime = TimeRecord.extractEtcTime(mv[dateStr], EN_WORK_TYPE.FUSEOVERLOAD);
      data.data.WORK = workTime.time;
      data.timeObj.WORK = workTime.timeObj;
      data.data.REMOTE = remoteTime.time;
      data.timeObj.REMOTE = remoteTime.timeObj;
      data.data.REST = restTime.time;
      data.timeObj.REST = restTime.timeObj;
      data.data.EMERGENCY = emergencyTime.time;
      data.timeObj.EMERGENCY = emergencyTime.timeObj;
      data.data.VACATION = vacationTime.time;
      data.timeObj.VACATION = vacationTime.timeObj;
      data.data.FUSEOVERLOAD = overLoadTime.time;
      data.timeObj.FUSEOVERLOAD = overLoadTime.timeObj;
      return data;
    }) : [];
    const timeObjs = updateDatas.map((mv) => mv.timeObj);
    const timeLawRestObjs = updateDatas
      .filter((fv) => fv.data.WORK >= 4)
      .map((mv) => {
        const extraTime  = mv.data.WORK % 4;
        const lawRestTime = (((mv.data.WORK - extraTime) / 4) * 0.5) * 60;
        const updateObj = { ...mv.timeObj, REST: { minutes: lawRestTime } };
        return updateObj;
      });
    const totalWorkTimeStr = Util.reduceDurationObject(timeObjs, EN_WORK_TYPE.WORK).toFormat('hh:mm:ss');
    const totalLawRestTimeStr = Util.reduceDurationObject(timeLawRestObjs, EN_WORK_TYPE.REST).toFormat('hh:mm:ss');
    const totalRestTimeStr = Util.reduceDurationObject(timeObjs, EN_WORK_TYPE.REST).toFormat('hh:mm:ss');
    const totalEmergencyTimeStr = Util.reduceDurationObject(timeObjs, EN_WORK_TYPE.EMERGENCY).toFormat('hh:mm:ss');
    const totalRemoteTimeStr = Util.reduceDurationObject(timeObjs, EN_WORK_TYPE.REMOTE).toFormat('hh:mm:ss');
    // const calWorkTime = totalWorkTime - totalRestTime - totalLawRestTime + totalEmergencyTime + totalRemoteTime;
    let calWorkTimeObj = Util.calTimeObj(
      Util.reduceTimeObj(timeObjs, EN_WORK_TYPE.WORK),
      Util.reduceTimeObj(timeObjs, EN_WORK_TYPE.EMERGENCY));
    calWorkTimeObj = Util.calTimeObj(
        calWorkTimeObj,
        Util.reduceTimeObj(timeObjs, EN_WORK_TYPE.REMOTE));
    calWorkTimeObj = Util.calTimeObj(
      calWorkTimeObj,
      Util.reduceTimeObj(timeObjs, EN_WORK_TYPE.VACATION));
    calWorkTimeObj = Util.calTimeObj(
      calWorkTimeObj,
      Util.reduceTimeObj(timeObjs, EN_WORK_TYPE.FUSEOVERLOAD));
    calWorkTimeObj = Util.calTimeObj(calWorkTimeObj, Util.reduceTimeObj(timeObjs, EN_WORK_TYPE.REST), 'minus');
    calWorkTimeObj = Util.calTimeObj(calWorkTimeObj, Util.reduceTimeObj(timeLawRestObjs, EN_WORK_TYPE.REST), 'minus');
    const calWorkTimeStr = luxon.Duration.fromObject(calWorkTimeObj).toFormat('hh:mm:ss');
    let range = startDate === endDate ? 1 :
      moment(endDate).diff(moment(startDate), 'days') + 1;
    if (range >= 7) {
      const weekCount = (range - (range % 7)) / 7;
      range -= (weekCount * 2);
    }
    const overTimeObj = luxon.Duration
      .fromObject(Util.calTimeObj(calWorkTimeObj, { minutes: 8 * 60 * range }, 'minus'));
    const overTimeStr = overTimeObj.toFormat('hh:mm:ss');
    return {
      updateDatas,
      calWorkTimeObj,
      overTimeObj: overTimeObj.toObject(),
      calWorkTimeStr, overTimeStr, totalWorkTimeStr,
      totalEmergencyTimeStr, totalRestTimeStr, totalLawRestTimeStr, totalRemoteTimeStr };
  }

  public static checkAddWorkType(logs: LogData[], targetType: EN_WORK_TYPE) {
    if (targetType === EN_WORK_TYPE.WORK || targetType === EN_WORK_TYPE.REMOTE) {
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
  public static possibleAddWorkOrRemote(logs: LogData[]) {

    const remoteLogs = this.reduceWorkLogs(logs);

    const haveTrue = Object.keys(remoteLogs).reduce(
      (acc, cur) => {
        if (acc === true) {
          return acc;
        }
        if (remoteLogs[cur] === true) {
          return true; 
        }
        return acc;
      },
      false);
    // 한 개라도 WORK나 REMOTE가 열려있는가? false, 아니면 true
    return !haveTrue;
  }

  public static possibleAddByeBye(logs: LogData[]) {
    const remoteLogs = this.reduceWorkLogs(logs);
    // work가 열려있어야만 가능.
    return remoteLogs.WORK === true && remoteLogs.REMOTE === false && remoteLogs.EMERGENCY === false;
  }

  public static possibleAddRemoteDone(logs: LogData[]) {
    const remoteLogs = this.reduceWorkLogs(logs);
    // remote가 열려있어야 가능
    return remoteLogs.WORK === false && remoteLogs.REMOTE === true && remoteLogs.EMERGENCY === false;
  }

  public static possibleAddRest(logs: LogData[]) {
    const remoteLogs = this.reduceWorkLogs(logs);
    const haveActiveRest = logs.filter((fv) => fv.type === EN_WORK_TYPE.REST && !!fv.done === false).length > 0;
    // work나 remote가 열려있고, 완료되지 않은 rest가 없을 때 가능.
    return (remoteLogs.WORK === true || remoteLogs.REMOTE === true) && haveActiveRest === false;
  }

  public static possibleAddEmergency(logs: LogData[]) {
    const remoteLogs = this.reduceWorkLogs(logs);
    // work, remote, emergency가 모두 close 일 때 가능
    return remoteLogs.WORK === false && remoteLogs.REMOTE === false && remoteLogs.EMERGENCY === false;
  }

  private static reduceWorkLogs(logs: LogData[]) {
    return logs.reduce(
      (acc: { WORK: boolean, REMOTE: boolean, EMERGENCY: boolean }, cur) => {
        if (acc.WORK === false && cur.type === EN_WORK_TYPE.WORK) {
          acc.WORK = true;
        } else if (acc.WORK === true && cur.type === EN_WORK_TYPE.BYEBYE) {
          acc.WORK = false;
        }
        if (acc.REMOTE === false && cur.type === EN_WORK_TYPE.REMOTE) {
          acc.REMOTE = true;
        } else if (acc.REMOTE === true && cur.type === EN_WORK_TYPE.REMOTEDONE) {
          acc.REMOTE = false;
        }
        if (acc.EMERGENCY === false && cur.type === EN_WORK_TYPE.EMERGENCY && !!cur.done === false) {
          acc.EMERGENCY = true;
        }
        return acc;
      },
      { WORK: false, REMOTE: false, EMERGENCY: false });
  }
}

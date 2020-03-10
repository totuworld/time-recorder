import debug from 'debug';
import { Request, Response } from 'express';
import * as luxon from 'luxon';

import { WebClient } from '@slack/client';

import { EN_WORK_TITLE_KR, EN_WORK_TYPE } from './contants/enum/EN_WORK_TYPE';
import { Groups } from './models/Groups';
import {
  IFuseOverWork,
  IOverWork,
  LogData,
  SlackActionInvocation,
  SlackSlashCommand
} from './models/interface/SlackSlashCommand';
import { TimeRecord } from './models/TimeRecord';
import { Users } from './models/Users';
import { WorkLog } from './models/WorkLog';
import { FireabaseAdmin } from './services/FirebaseAdmin';
import { Util } from './util';

const SLACK_TOKEN = process.env.SLACK_TOKEN || 'slack_token';
const slackClient = new WebClient(SLACK_TOKEN);

const commandSet = {
  WORK: new Set(['출근', 'ㅊㄱ', 'ㅊㅊ', 'hi']),
  BYEBYE: new Set(['퇴근', 'ㅌㄱ', 'bye']),
  REST: new Set(['휴식', 'ㅎㅅ', 'rest', 'etc']),
  DONE: new Set(['완료', 'ㅇㄹ', 'done']),
  EMERGENCY: new Set(['긴급대응', 'ㄱㄱㄷㅇ', 'emergency'])
};
const SLACK_ACTION_REQUEST_PING = 'ping-pong';

const viewerUrl: string = process.env.VIEWER_URL
  ? process.env.VIEWER_URL
  : 'http://localhost:3000';

const log = debug('tr:functions');
export async function commandPing(request, response) {
  if (request.method !== 'POST') {
    console.error(`Got unsupported ${request.method} request. Expected POST.`);
    return response.status(405).send('Only POST requests are accepted');
  }
  const command = request.body as SlackSlashCommand;
  // console.log(command);
  if (command.text === 'today') {
    const today = luxon.DateTime.local();
    return response
      .contentType('json')
      .status(200)
      .send({
        text: '🏃‍♀️오늘도 힘내요!',
        attachments: [
          {
            title: '오늘 워크로그 기록 페이지 바로가기',
            title_link: `${viewerUrl}/records/${
              command.user_id
            }?startDate=${today.toFormat(
              'yyyy-LL-dd'
            )}&endDate=${today.toFormat('yyyy-LL-dd')}`
          }
        ]
      });
  }
  // 출근
  if (commandSet.WORK.has(command.text) === true) {
    await WorkLog.storeWork({ userId: command.user_id });
    return response
      .contentType('json')
      .status(200)
      .send({
        text: Util.hiMsg()
      });
  }
  // 퇴근
  if (commandSet.BYEBYE.has(command.text) === true) {
    await WorkLog.storeBye({ userId: command.user_id });
    return response
      .contentType('json')
      .status(200)
      .send({
        text: Util.byeMsg()
      });
  }
  // 휴식
  if (commandSet.REST.has(command.text) === true) {
    await WorkLog.storeRest({ userId: command.user_id });
    return response
      .contentType('json')
      .status(200)
      .send({
        text: `휴식 ${Util.dateTimeShort()}`
      });
  }
  // 긴급대응
  if (commandSet.EMERGENCY.has(command.text) === true) {
    await WorkLog.storeEmergency({ userId: command.user_id });
    return response
      .contentType('json')
      .status(200)
      .send({
        text: `긴급대응 ${Util.dateTimeShort()}`
      });
  }
  // 완료
  if (commandSet.DONE.has(command.text) === true) {
    const { msg } = await WorkLog.storeComplete({ userId: command.user_id });
    return response
      .contentType('json')
      .status(200)
      .send({
        text: msg
      });
  }
  // Handle the commands later, Slack expect this request to return within 3000ms
  // await FirebaseAmdin.Database.ref("commands/ping").push(command);
  return response
    .contentType('json')
    .status(200)
    .send({
      text: '기록을 시작할까요?',
      attachments: [
        {
          text: "Let's play the game.",
          fallback: 'You are unable to choose a game',
          callback_id: SLACK_ACTION_REQUEST_PING,
          color: '#3AA3E3',
          attachment_type: 'default',
          actions: [
            {
              name: 'game',
              text: '출근',
              type: 'button',
              value: EN_WORK_TYPE.WORK
            },
            {
              name: 'game',
              text: '퇴근',
              type: 'button',
              value: EN_WORK_TYPE.BYEBYE
            },
            {
              name: 'game',
              text: '휴식',
              type: 'button',
              value: EN_WORK_TYPE.REST
            },
            {
              name: 'game',
              text: '긴급대응',
              style: 'danger',
              type: 'button',
              value: EN_WORK_TYPE.EMERGENCY,
              confirm: {
                title: '긴급대응 로그',
                text: '긴급대응을 시작할까요? ㅠㅠ',
                ok_text: 'Yes',
                dismiss_text: 'No'
              }
            },
            {
              name: 'game',
              text: '완료',
              type: 'button',
              value: EN_WORK_TYPE.DONE
            }
          ]
        }
      ]
    });
}
/** 관리자용 */
export async function addWorkLog(request, res) {
  const {
    ...reqData
  }: {
    auth_user_id: string;
    user_id: string;
    type: EN_WORK_TYPE;
    target_date?: string;
    time?: string;
  } = request.body;
  // 로그인 사용자 확인
  const authInfo = await Users.findLoginUser({ userUid: reqData.auth_user_id });
  if (authInfo.result === false) {
    return res.status(401).send('unauthorized');
  }
  // 다른 유저의 log를 추가하는가?
  if (authInfo.data.id !== reqData.user_id && !!authInfo.data.auth === false) {
    return res.status(401).send('unauthorized');
  }

  const target_date = !!reqData.target_date
    ? reqData.target_date
    : luxon.DateTime.local().toFormat('yyyy-LL-dd');
  const targetDay = luxon.DateTime.fromISO(target_date);

  // 관리자가 아니라면 해당 주의 기록이 완료된 상태인지 확인한다.
  if (!!authInfo.data.auth === false) {
    // 일요일인가?
    const week =
      targetDay.weekday !== 7
        ? targetDay.toISOWeekDate().substr(0, 8)
        : targetDay
            .plus({ days: 1 })
            .toISOWeekDate()
            .substr(0, 8);
    const data = await WorkLog.findWeekOverWorkTime({
      login_auth_id: reqData.auth_user_id,
      weekKey: week
    });
    log('addWorkLog: ', week, data, data === null || data === undefined);
    // 데이터가 있는가?
    if ((data === null || data === undefined) === false) {
      return res.status(401).send('unauthorized(lock)');
    }
  }
  // 완료 기록인가?
  if (reqData.type === EN_WORK_TYPE.DONE) {
    await WorkLog.storeComplete({
      userId: reqData.user_id,
      targetDate: reqData.target_date
    });
  } else if (
    reqData.type === EN_WORK_TYPE.VACATION ||
    reqData.type === EN_WORK_TYPE.HALFVACATION
  ) {
    // 휴가/반차 기록(기록은 모두 VACATION으로 한다.)
    const now = luxon.DateTime.local();
    const start = `${now.toFormat('yyyy-LL-dd')}T09:00:00+09:00`;
    const end = `${now.toFormat('yyyy-LL-dd')}T${
      reqData.type === EN_WORK_TYPE.VACATION ? 17 : 13
    }:00:00+09:00`;
    await WorkLog.store({
      userId: reqData.user_id,
      type: EN_WORK_TYPE.VACATION,
      targetDate: reqData.target_date,
      timeStr: start,
      doneStr: end
    });
  } else {
    const logs = await WorkLog.find({
      userId: reqData.user_id,
      startDate: reqData.target_date
    });
    const logDataList = Object.keys(logs.data).map(mv => logs.data[mv]);
    // 검증 로직 추가.
    const possibleAddWorkLog = WorkLog.checkAddWorkType(
      logDataList,
      reqData.type
    );
    // 조건을 만족했거나, 관리자 권한이 있을 때!
    if (possibleAddWorkLog === true || !!authInfo.data.auth === true) {
      // 완료 외의 기록
      await WorkLog.store({
        userId: reqData.user_id,
        type: reqData.type,
        timeStr: reqData.time,
        targetDate: reqData.target_date
      });
    }
  }

  // 출근 로그 일 때
  // 지난주 정산 기록이 없고,
  // 지난주 근무 시간이 부족하면, 슬랙 메시지를 보낸다.
  if (
    reqData.type === EN_WORK_TYPE.WORK ||
    reqData.type === EN_WORK_TYPE.REMOTE
  ) {
    const lastWeek =
      targetDay.weekday !== 7
        ? targetDay
            .minus({ week: 1 })
            .toISOWeekDate()
            .substr(0, 8)
        : targetDay
            .minus({ week: 1 })
            .plus({ days: 1 })
            .toISOWeekDate()
            .substr(0, 8);
    const data = await WorkLog.findWeekOverWorkTime({
      login_auth_id: reqData.auth_user_id,
      weekKey: lastWeek
    });
    log({ data });
    // 정산 데이터가 있는가?
    if ((data === null || data === undefined) === false) {
      return res.send();
    }
    const weekStartDay = luxon.DateTime.fromISO(`${lastWeek}-1`).minus({
      days: 1
    });
    const weekEndDay = luxon.DateTime.fromISO(`${lastWeek}-6`);
    // 정산 기록이 없다면. 전체 근무 시간을 확인하자.
    const holidayDuration = await WorkLog.getHolidaysDuration(
      weekStartDay,
      weekEndDay
    );
    const time = await getTimeObj(
      lastWeek,
      reqData.user_id,
      reqData.auth_user_id,
      holidayDuration
    );
    const weekWorkingHours = 40 - holidayDuration.hours;
    const holidayCount = holidayDuration.hours / 8;

    // 근무 기록이 있고 시간이 + or 0이면
    if (time.haveData === true) {
      await slackClient.chat.postMessage({
        channel: reqData.user_id,
        username: '워크로그',
        text: `한 주도 수고하셨습니다
        \n기간: ${weekStartDay.toFormat('yyyy-LL-dd')} - ${weekEndDay.toFormat(
          'yyyy-LL-dd'
        )}
        \n기준근무시간: ${weekWorkingHours} _(휴일: ${holidayCount})
        \n근무시간: ${time.convertData.calWorkTimeStr}\n초과시간: ${
          time.convertData.overTimeStr
        }\n${
          time.timeObj.milliseconds < 0
            ? '근무 시간이 부족하네요. 혹시 누락된 퇴근 기록이 없는지 `근무기록 확인하기`을 통해 살펴보세요.'
            : ''
        }\n누락된 퇴근/재택근무 종료 로그 수: ${time.convertData.noPair}`,
        attachments: [
          {
            title: '근무기록 확인하기',
            title_link: `${viewerUrl}/records/${
              reqData.user_id
            }?startDate=${weekStartDay.toFormat(
              'yyyy-LL-dd'
            )}&endDate=${weekEndDay.toFormat('yyyy-LL-dd')}`
          },
          {
            text: `정산을 진행할까요?${
              time.timeObj.milliseconds < 0
                ? '\n정산 버튼을 누르면 설령 근무 시간이 부족해도 정산 됩니다.'
                : ''
            }`,
            fallback: '정산이 진행되지 않았어요.',
            callback_id: 'wopr_game',
            color: '#3AA3E3',
            actions: [
              {
                name: 'game',
                text: `Yes(${lastWeek})`,
                type: 'button',
                value: `${lastWeek}`
              }
            ]
          }
        ]
      });
    }
  }

  return res.send();
}
export async function deleteWorkLog(req, res) {
  const {
    ...reqData
  }: {
    auth_user_id: string;
    user_id: string;
    target_date: string;
    log_id: string;
  } = req.body;
  // 로그인 사용자 확인
  const authInfo = await Users.findLoginUser({ userUid: reqData.auth_user_id });
  if (authInfo.result === false) {
    return res.status(401).send('unauthorized');
  }
  // 다른 유저의 log를 추가하는가?
  if (authInfo.data.id !== reqData.user_id && !!authInfo.data.auth === false) {
    return res.status(401).send('unauthorized');
  }
  // 관리자가 아니라면 해당 주의 기록이 완료된 상태인지 확인한다.
  if (!!authInfo.data.auth === false) {
    const target_date = !!reqData.target_date
      ? reqData.target_date
      : luxon.DateTime.local().toFormat('yyyy-LL-dd');
    const targetDay = luxon.DateTime.fromISO(target_date);
    // 일요일인가?
    const week =
      targetDay.weekday !== 7
        ? targetDay.toISOWeekDate().substr(0, 8)
        : targetDay
            .plus({ days: 1 })
            .toISOWeekDate()
            .substr(0, 8);
    const data = await WorkLog.findWeekOverWorkTime({
      login_auth_id: reqData.auth_user_id,
      weekKey: week
    });
    log('deleteWorkLog: ', week, data, data === null || data === undefined);
    // 데이터가 있는가?
    if ((data === null || data === undefined) === false) {
      return res.status(401).send('unauthorized(lock)');
    }
  }
  log(reqData);
  await WorkLog.delete({
    userId: reqData.user_id,
    targetDate: reqData.target_date,
    log_id: reqData.log_id
  });

  return res.send();
}
/** 초과근무 시간을 차감하는 요청 */
export async function addFuseWorkLog(request: Request, res: Response) {
  const {
    ...reqData
  }: {
    auth_user_id: string; // 로그인한 auth id
    user_id: string; // slack id(대상자)
    target_date: string; // 등록할 날짜
    duration: string; // 얼마나 fuse할지(ISO8601 형식으로 받음 https://en.wikipedia.org/wiki/ISO_8601#Durations)
    isVacation?: boolean; // 초과근무를 휴가로 바꾸는 요청인지 확인
    note?: string; // 사유 같은걸 적을 때 사용
  } = request.body;
  log(request.body);
  // 로그인 사용자 확인
  const authInfo = await Users.findLoginUser({ userUid: reqData.auth_user_id });
  if (authInfo.result === false) {
    return res.status(401).send('unauthorized');
  }
  // 다른 유저의 log를 추가하는가?
  log(
    authInfo.data.id,
    authInfo.data.id !== reqData.user_id,
    !!authInfo.data.auth === false,
    authInfo.data.auth
  );
  if (authInfo.data.id !== reqData.user_id && !!authInfo.data.auth === false) {
    return res.status(401).send('unauthorized 2');
  }
  // 대상자의 정보를 로딩하자.
  // 로그인한 사용자 전체 정보를 확인한 뒤 user_id와 매칭되는 것을 찾아야한다. 와 이거 더럽게 복잡한데?
  const allLoginUsers = await Users.findAllLoginUser();
  const targetUser = allLoginUsers.find(fv => fv.id === reqData.user_id);
  // 사용자가 없는가?
  if (targetUser === null || targetUser === undefined) {
    return res.status(204).send();
  }
  // 초과근무 내역 & 사용한 초고근무 시간 내역 조회
  const [overTime, fuseTime] = await Promise.all([
    WorkLog.findAllOverWorkTime({ login_auth_id: targetUser.auth_id }),
    WorkLog.findAllFuseOverWorkTime({ login_auth_id: targetUser.auth_id })
  ]);
  if (overTime.length <= 0) {
    // 기록이 없으면 fail
    return res.status(400).send(`차감 가능한 초과근무가 없습니다`);
  }
  const isVacation = Util.isNotEmpty(reqData.isVacation) && reqData.isVacation;
  // 차감을 요청한 시간만큼 전체 시간을 보유했는지 확인한다.
  // 추가로 초과근무시간 10시간으로 휴가처럼 사용하는 것인지 체크
  const fuseDuration = isVacation
    ? luxon.Duration.fromISO('PT10H')
    : luxon.Duration.fromISO(reqData.duration);
  if (isVacation === false && fuseDuration > luxon.Duration.fromISO('PT6H')) {
    return res.status(400).send(`6시간 이상 차감은 불가능합니다`);
  }
  const totalOverWorkDuration = overTime.reduce(
    (acc: luxon.Duration, cur: IOverWork) => {
      if (cur.over === null || cur.over === undefined) {
        return acc;
      }
      const tempDuration = luxon.Duration.fromObject(cur.over);
      const updateAcc = acc.plus(tempDuration);
      return updateAcc;
    },
    luxon.Duration.fromObject({ milliseconds: 0 })
  );
  const totalFuseDuration = fuseTime.reduce(
    (acc: luxon.Duration, cur: IFuseOverWork) => {
      const tempDuration = luxon.Duration.fromISO(cur.use);
      const updateAcc = acc.plus(tempDuration);
      return updateAcc;
    },
    luxon.Duration.fromObject({ milliseconds: 0 })
  );
  const totalRemainDuration = totalOverWorkDuration.minus(totalFuseDuration);
  if (fuseDuration > totalRemainDuration) {
    return res.status(400).send(`차감 가능 시간을 초과한 요청입니다`);
  }
  // 사용 기록을 추가한다.
  // 초과근무를 휴가로 사용하는 경우 10시간으로 차감한다.
  await WorkLog.addFuseOverWorkTime({
    login_auth_id: targetUser.auth_id,
    date: reqData.target_date,
    use: isVacation ? 'PT10H' : reqData.duration,
    note: Util.isNotEmpty(reqData.note) ? reqData.note : ''
  });
  // 해당 날짜의 워크로그에 차감을 추가한다.
  const time = luxon.DateTime.fromFormat(reqData.target_date, 'yyyyLLdd');
  const timeStr = time.plus({ hours: 9 }).toISO();
  const addDuration = isVacation
    ? luxon.Duration.fromISO('PT8H')
    : luxon.Duration.fromISO(reqData.duration);
  const doneStr = time
    .plus({ hours: 9 })
    .plus(addDuration)
    .toISO();
  await WorkLog.store({
    userId: targetUser.id,
    timeStr,
    doneStr,
    targetDate: reqData.target_date,
    type: EN_WORK_TYPE.FUSEOVERLOAD
  });
  return res.send();
}
export async function commandHistory(request, response) {
  if (request.method !== 'POST') {
    console.error(`Got unsupported ${request.method} request. Expected POST.`);
    return response.status(405).send('Only POST requests are accepted');
  }
  const command = request.body as SlackSlashCommand;
  // console.log(command);
  const userRootRef = FireabaseAdmin.Database.ref('user');
  const userRef = userRootRef.child(command.user_id);
  const logDatas = await userRef
    .child(`${Util.currentDate()}`)
    .once('value')
    .then(snap => {
      const childData = snap.val() as { [key: string]: LogData };
      // 일한 시간 뽑아내자.
      // 출/퇴근 필터
      const workFilter = Object.keys(childData)
        .filter(
          fv =>
            childData[fv].type === EN_WORK_TYPE.WORK ||
            childData[fv].type === EN_WORK_TYPE.BYEBYE
        )
        .map(mv => {
          return childData[mv];
        })
        .reduce(
          (acc: { acc: number; lastWorkTimeStamp: string }, cur: LogData) => {
            // 출근인가?
            if (cur.type === EN_WORK_TYPE.WORK) {
              acc.lastWorkTimeStamp = cur.time;
            }
            // 퇴근인가?
            if (cur.type === EN_WORK_TYPE.BYEBYE) {
              if (!!acc.lastWorkTimeStamp) {
                // 앞 시간부터 비교해서 시간 추가하자.
                const duration = Util.getBetweenDuration(
                  acc.lastWorkTimeStamp,
                  cur.time
                );
                acc.acc += duration.as('hours');
              }
            }
            return acc;
          },
          {
            acc: 0,
            lastWorkTimeStamp: null
          }
        );
      // 출근은 찍혔지만 퇴근 기록이 없는가?
      const noBye = !!workFilter.lastWorkTimeStamp && workFilter.acc === 0;
      if (noBye === true) {
        const current = Util.currentTimeStamp();
        const duration = Util.getBetweenDuration(
          workFilter.lastWorkTimeStamp,
          current
        );
        workFilter.acc += duration.as('hours');
      }
      return {
        ...workFilter,
        rawData: childData,
        noBye
      };
    });
  // log time 찍기.
  const message = [
    logDatas.acc > 0
      ? `워킹타임: ${logDatas.acc} 시간 기록중!`
      : '오늘은 휴가인가봐요 :)'
  ];
  const keyLength = Object.keys(logDatas.rawData).length;
  if (keyLength > 0) {
    Object.keys(logDatas.rawData).map(key => {
      const data = logDatas.rawData[key];
      const done = !!data.done ? ` ~ ${Util.toDateTimeShort(data.done)}` : '';
      message.push(
        `${EN_WORK_TITLE_KR[data.type]} 👉 ${Util.toDateTimeShort(
          data.time
        )}${done}`
      );
    });
  }
  return response
    .contentType('json')
    .status(200)
    .send({
      text: message.join('\n\n')
    });
}
export async function modify(request, res) {
  if (request.method !== 'POST') {
    console.error(`Got unsupported ${request.method} request. Expected POST.`);
    return res.status(405).send('Only POST requests are accepted');
  }
  const {
    auth_user_id,
    user_id,
    update_date,
    record_key,
    target_key,
    time
  } = request.body;
  // 권한 확인
  const authInfo = await Users.findLoginUser({ userUid: auth_user_id });
  if (authInfo.result === false) {
    return res.status(401).send('unauthorized');
  }

  // 다른 유저의 정보를 수정하는가?
  if (authInfo.data.id !== user_id && !!authInfo.data.auth === false) {
    return res.status(401).send('unauthorized');
  }
  // 관리자가 아니라면 해당 주의 기록이 완료된 상태인지 확인한다.
  if (!!authInfo.data.auth === false) {
    const target_date = !!update_date
      ? update_date
      : luxon.DateTime.local().toFormat('yyyy-LL-dd');
    const targetDay = luxon.DateTime.fromISO(target_date);
    // 일요일인가?
    const weekStr =
      targetDay.weekday !== 7
        ? targetDay.toISOWeekDate().substr(0, 8)
        : targetDay
            .plus({ days: 1 })
            .toISOWeekDate()
            .substr(0, 8);
    const data = await WorkLog.findWeekOverWorkTime({
      login_auth_id: user_id,
      weekKey: weekStr
    });
    log('addWorkLog: ', weekStr, data, data === null || data === undefined);
    // 데이터가 있는가?
    if ((data === null || data === undefined) === false) {
      return res.status(401).send('unauthorized(lock)');
    }
  }
  const updateData = {
    userId: user_id,
    updateDate: update_date,
    updateRecordkey: record_key,
    updateDataKey: target_key,
    updateTime: time
  };
  // 데이터 수정
  await WorkLog.updateData(updateData);
  return res.send();
}
export async function getAll(request, response) {
  const userId = request.query['userId'];
  const startDate = request.query['startDate'];
  const endDate = request.query['endDate'];
  if (!!userId === false) {
    response
      .status(400)
      .contentType('json')
      .send([]);
  } else {
    const resp = await WorkLog.findAll({ userId, startDate, endDate });
    response.contentType('json').send(resp);
  }
}
export async function getGroups(request, response) {
  const groupId = request.query['groupId'];
  if (!!groupId === false) {
    return response
      .status(400)
      .contentType('json')
      .send([]);
  }
  const resp = await Users.findAllInGroup({ groupId });
  return response.contentType('json').send(resp);
}
export async function getAllGroupInfo(_, response) {
  const resp = await Users.findAllGroupInfo();
  return response.contentType('json').send(resp);
}
export async function addGroupInfo(request, response) {
  const { group_id, name, desc } = request.body;
  if (Util.isEmpty(group_id) || Util.isEmpty(name) || Util.isEmpty(desc)) {
    return response.status(400).end();
  }
  const resp = await Users.addGroup({ group_id, name, desc });
  return response.status(resp === true ? 200 : 400).end();
}
export async function deleteGroupInfo(request, response) {
  const { group_id } = request.params;
  if (Util.isEmpty(group_id)) {
    return response.status(400).end();
  }
  await Users.deleteGroup({ group_id });
  return response.status(200).end();
}
export async function getUser(request, response) {
  const userId = request.query['userId'];
  if (!!userId === false) {
    return response
      .status(400)
      .contentType('json')
      .send({});
  }
  const resp = await Users.find({ userId });
  return response.contentType('json').send(resp);
}
export async function messageAction(request, response) {
  if (request.method !== 'POST') {
    console.error(`Got unsupported ${request.method} request. Expected POST.`);
    return response.status(405).send('Only POST requests are accepted');
  }
  if (!request.body && request.body.payload) {
    return response.status(401).send('Bad formatted action response');
  }
  const action = JSON.parse(request.body.payload) as SlackActionInvocation;
  // console.log(action);
  /*
{ type: 'interactive_message',
actions: [ { name: 'game', type: 'button', value: 'work' } ],
callback_id: 'ping-pong',
team: { id: 'T07SR86Q5', domain: 'yanoljain' },
channel: { id: 'D41CGCTEG', name: 'directmessage' },
user: { id: 'U41A627S6', name: 'totuworld' },
action_ts: '1531237678.104528',
message_ts: '1531237675.000481',
attachment_id: '1',
token: 'Uib4ICnKtx3hVggqOK8rO9MF',
is_app_unfurl: false,
response_url: 'https://hooks.slack.com/actions/T07SR86Q5/395512897729/vBgtX9dmHkC9XZe1BDN3nP6W',
trigger_id: '397118842807.7909278821.7d4790b60fe730f2c4fa229e75848497' }
*/
  // TODO: actions의 value를 보고 기록을 시작하자.
  const workRef = FireabaseAdmin.Database.ref('work');
  const userRootRef = FireabaseAdmin.Database.ref('user');
  const userRef = userRootRef.child(action.user.id);
  // 출근?
  if (action.actions[0].value === EN_WORK_TYPE.WORK) {
    const time = Util.currentTimeStamp();
    const refKey = await workRef.push({
      user: action.user.id,
      log: EN_WORK_TYPE.WORK,
      time: time
    });
    await userRef
      .child(`${Util.currentDate()}`)
      .push({ refKey: refKey.key, time, type: EN_WORK_TYPE.WORK });
    return response
      .contentType('json')
      .status(200)
      .send({
        text: Util.hiMsg()
      });
  }
  // 퇴근?
  if (action.actions[0].value === EN_WORK_TYPE.BYEBYE) {
    const time = Util.currentTimeStamp();
    const refKey = await workRef.push({
      user: action.user.id,
      log: EN_WORK_TYPE.BYEBYE,
      time: time
    });
    await userRef
      .child(`${Util.currentDate()}`)
      .push({ refKey: refKey.key, time, type: EN_WORK_TYPE.BYEBYE });
    return response
      .contentType('json')
      .status(200)
      .send({
        text: Util.byeMsg()
      });
  }
  // 휴식
  if (action.actions[0].value === EN_WORK_TYPE.REST) {
    const time = Util.currentTimeStamp();
    const refKey = await workRef.push({
      user: action.user.id,
      log: EN_WORK_TYPE.REST,
      time: time
    });
    await userRef
      .child(`${Util.currentDate()}`)
      .push({ refKey: refKey.key, time, type: EN_WORK_TYPE.REST });
    return response
      .contentType('json')
      .status(200)
      .send({
        text: `휴식 ${Util.dateTimeShort()}`
      });
  }
  // 긴급대응
  if (action.actions[0].value === EN_WORK_TYPE.EMERGENCY) {
    const time = Util.currentTimeStamp();
    const refKey = await workRef.push({
      user: action.user.id,
      log: EN_WORK_TYPE.EMERGENCY,
      time: time
    });
    await userRef
      .child(`${Util.currentDate()}`)
      .push({ refKey: refKey.key, time, type: EN_WORK_TYPE.EMERGENCY });
    return response
      .contentType('json')
      .status(200)
      .send({
        text: `긴급대응 ${Util.dateTimeShort()}`
      });
  }
  // 완료
  if (action.actions[0].value === EN_WORK_TYPE.DONE) {
    const time = Util.currentTimeStamp();
    const logDatas = await userRef
      .child(`${Util.currentDate()}`)
      .once('value')
      .then(snap => {
        const childData = snap.val() as { [key: string]: LogData };
        const keys = Object.keys(childData);
        const filter = keys.reduce(
          (acc: (LogData & { key: string })[], cur) => {
            const fv = childData[cur];
            const updateFv: LogData & { key: string } = { ...fv, key: cur };
            // REST, EMERGENCY 중 done이 없는 것 추출
            if (
              (fv.type === EN_WORK_TYPE.REST ||
                fv.type === EN_WORK_TYPE.EMERGENCY) &&
              !!fv.done === false
            ) {
              acc.push(updateFv);
            }
            return acc;
          },
          [] as (LogData & { key: string })[]
        );
        return filter;
      });
    if (logDatas.length === 0) {
      // 딱히 완료할 잡이 없다.
      return response
        .contentType('json')
        .status(200)
        .send({
          text: `완료처리할 이벤트가 없어요`
        });
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
      .child(`${Util.currentDate()}`)
      .child(updateData.key)
      .set(updateData);
    return response
      .contentType('json')
      .status(200)
      .send({
        text: msg
      });
  }
  return response
    .contentType('json')
    .status(200)
    .send('완료');
}
/** 추가 근무 시간을 기록한다. */
export async function storeOverWorkTime(request: Request, response: Response) {
  const weekPtn = /[0-9]{4}-W[0-9]{2}/;
  // week가 필요하다. 2018-W21
  //   start는 week의 1 - 1 days, end는 week의 6
  // 그리고 누구의 기록을 정리할지 필요하다.
  // auth_user_id
  const { week, auth_user_id, user_id } = request.body;
  if (week === null || week === undefined || weekPtn.test(week) === false) {
    return response
      .status(400)
      .send({ errorMessage: 'body.week는  ISO 8601 규격의 week(2018-W36)' });
  }
  if (auth_user_id === null || auth_user_id === undefined) {
    return response
      .status(400)
      .send({ errorMessage: 'body.auth_user_id 누락' });
  }
  const timeObj = await getTimeObj(week, user_id, auth_user_id);
  if (timeObj.haveData === false) {
    return response.send({ week });
  }
  const storeData = await WorkLog.storeOverWorkTime({
    login_auth_id: auth_user_id,
    over_time_obj: timeObj.timeObj,
    week
  });
  return response.send(storeData);
}
async function getTimeObj(
  week: string,
  user_id: string,
  auth_user_id: string,
  holidayDuration?: luxon.Duration
) {
  const startDate = luxon.DateTime.fromISO(`${week}-1`).minus({ days: 1 });
  const endDate = luxon.DateTime.fromISO(`${week}-6`);
  // RDB라면 range로 긇겠지만 firebase니까 후루룩 다 읽어야겠군. 후후후
  const datas = await WorkLog.findAllWithLuxonDateTime({
    startDate,
    endDate,
    userId: user_id
  });
  const haveData = Object.keys(datas).length > 0;
  const convertData = TimeRecord.convertWorkTime(
    datas,
    startDate.toJSDate(),
    endDate.toJSDate(),
    holidayDuration
  );
  const duration = luxon.Duration.fromObject(convertData.overTimeObj).as(
    'milliseconds'
  );
  if (convertData.overTimeIsMinus === true) {
    return { haveData, timeObj: { milliseconds: -duration }, convertData };
  }
  return { haveData, timeObj: { milliseconds: duration }, convertData };
}
/** 추가 근무시간 전체 기록 조회 */
export async function findAllOverTime(request: Request, response: Response) {
  const { auth_user_id } = request.query;
  if (auth_user_id === null || auth_user_id === undefined) {
    return response
      .status(400)
      .send({ errorMessage: 'query.auth_user_id 누락' });
  }
  const datas = await WorkLog.findAllOverWorkTime({
    login_auth_id: auth_user_id
  });
  return response.send(datas);
}
export async function findAllFuseOverTime(
  request: Request,
  response: Response
) {
  const { auth_user_id } = request.query;
  if (auth_user_id === null || auth_user_id === undefined) {
    return response
      .status(400)
      .send({ errorMessage: 'query.auth_user_id 누락' });
  }
  const datas = await WorkLog.findAllFuseOverWorkTime({
    login_auth_id: auth_user_id
  });
  return response.send(datas);
}
export async function findAllOverTimeByUserId(
  request: Request,
  response: Response
) {
  const { user_id } = request.query;
  if (user_id === null || user_id === undefined) {
    return response.status(400).send({ errorMessage: 'query.user_id 누락' });
  }
  const allLoginUsers = await Users.findAllLoginUser();
  const targetUser = allLoginUsers.find(fv => fv.id === user_id);
  if (targetUser === null || targetUser === undefined) {
    return response.status(204).send();
  }
  const datas = await WorkLog.findAllOverWorkTime({
    login_auth_id: targetUser.auth_id
  });
  return response.send(datas);
}
export async function findWeekOverTimeByUserId(
  request: Request,
  response: Response
) {
  const { target_date } = request.params;
  const { user_id, auth_user_id } = request.query;
  if (
    (user_id === null || user_id === undefined) &&
    (auth_user_id === null || auth_user_id === undefined)
  ) {
    return response
      .status(400)
      .send({ errorMessage: 'query.user_id or query.auth_user_id 누락' });
  }
  // if (!!auth_user_id === true) {
  //   const authUserInfo = await Users.findLoginUserWithAuthUserId(auth_user_id);
  // }
  const allLoginUsers = await Users.findAllLoginUser();
  const targetUser = allLoginUsers.find(fv => fv.id === user_id);
  if (targetUser === null || targetUser === undefined) {
    return response.status(204).send();
  }
  const targetDay = luxon.DateTime.fromISO(target_date);
  // 일요일인가?
  const week =
    targetDay.weekday !== 7
      ? targetDay.toISOWeekDate().substr(0, 8)
      : targetDay
          .plus({ days: 1 })
          .toISOWeekDate()
          .substr(0, 8);
  const data = await WorkLog.findWeekOverWorkTime({
    login_auth_id: targetUser.auth_id,
    weekKey: week
  });
  if (data === null || data === undefined) {
    return response.status(204).send();
  }
  return response.send(data);
}
export async function findAllFuseOverTimeByUserId(
  request: Request,
  response: Response
) {
  const { user_id } = request.query;
  if (user_id === null || user_id === undefined) {
    return response.status(400).send({ errorMessage: 'query.user_id 누락' });
  }
  const allLoginUsers = await Users.findAllLoginUser();
  const targetUser = allLoginUsers.find(fv => fv.id === user_id);
  if (targetUser === null || targetUser === undefined) {
    return response.status(204).send();
  }
  const datas = await WorkLog.findAllFuseOverWorkTime({
    login_auth_id: targetUser.auth_id
  });
  return response.send(datas);
}
/** 모든 로그인 사용자의 추가 근무 시간을 기록한다. */
export async function updateAllUsersOverWorkTime(
  request: Request,
  response: Response
) {
  const weekPtn = /[0-9]{4}-W[0-9]{2}/;
  const { week } = request.body;
  if (week === null || week === undefined || weekPtn.test(week) === false) {
    return response
      .status(400)
      .send({ errorMessage: 'body.week는  ISO 8601 규격의 week(2018-W36)' });
  }
  const startDate = luxon.DateTime.fromISO(`${week}-1`).minus({ days: 1 });
  const endDate = luxon.DateTime.fromISO(`${week}-6`);
  const [users, holidayDuration] = await Promise.all([
    Users.findAllLoginUser(),
    WorkLog.getHolidaysDuration(startDate, endDate)
  ]);
  const promises = users.map(async mv => {
    const timeObj = await getTimeObj(week, mv.id, mv.auth_id, holidayDuration);
    if (timeObj.haveData === true) {
      await WorkLog.storeOverWorkTime({
        login_auth_id: mv.auth_id,
        over_time_obj: timeObj.timeObj,
        week
      });
    }
  });
  while (promises.length > 0) {
    await promises.pop();
  }
  return response.send();
}
/** user_id나 auth_user_id로 추가 근무 시간을 기록한다.  */
export async function updateUserOverWorkTime(
  request: Request,
  response: Response
) {
  const weekPtn = /[0-9]{4}-W[0-9]{2}/;
  const { week, user_id, auth_user_id } = request.body;
  if (Util.isEmpty(week) || weekPtn.test(week) === false) {
    return response
      .status(400)
      .send({ errorMessage: 'body.week는  ISO 8601 규격의 week(2018-W36)' });
  }
  // user_id나 auth_user_id가 없는가?
  if (Util.isEmpty(user_id) && Util.isEmpty(auth_user_id)) {
    return response.status(400).send({
      errorMessage: '대상 유저가 누구인지 알 수 없음(user_id, auth_user_id)'
    });
  }
  const startDate = luxon.DateTime.fromISO(`${week}-1`).minus({ days: 1 });
  const endDate = luxon.DateTime.fromISO(`${week}-6`);
  const [users, holidayDuration] = await Promise.all([
    Users.findAllLoginUser(),
    WorkLog.getHolidaysDuration(startDate, endDate)
  ]);
  const targetUser = Util.isNotEmpty(user_id)
    ? users.find(fv => fv.id === user_id)
    : users.find(fv => fv.auth_id === auth_user_id);
  if (targetUser === null || targetUser === undefined) {
    return response.status(204).send();
  }
  const timeObj = await getTimeObj(
    week,
    targetUser.id,
    targetUser.auth_id,
    holidayDuration
  );
  if (timeObj.haveData === true) {
    await WorkLog.storeOverWorkTime({
      login_auth_id: targetUser.auth_id,
      over_time_obj: timeObj.timeObj,
      week
    });
  }
  return response.send();
}

export async function forceAddOverWorkTime(
  request: Request,
  response: Response
) {
  const weekPtn = /[0-9]{4}-W[0-9]{2}/;
  const { week, user_id, auth_user_id, milliseconds } = request.body;
  if (Util.isEmpty(week) || weekPtn.test(week) === false) {
    return response
      .status(400)
      .send({ errorMessage: 'body.week는  ISO 8601 규격의 week(2018-W36)' });
  }
  // user_id나 auth_user_id가 없는가?
  if (Util.isEmpty(user_id) && Util.isEmpty(auth_user_id)) {
    return response.status(400).send({
      errorMessage: '대상 유저가 누구인지 알 수 없음(user_id, auth_user_id)'
    });
  }
  const [users] = await Promise.all([Users.findAllLoginUser()]);
  const targetUser = Util.isNotEmpty(user_id)
    ? users.find(fv => fv.id === user_id)
    : users.find(fv => fv.auth_id === auth_user_id);
  if (targetUser === null || targetUser === undefined) {
    return response.status(204).send();
  }
  const overTime = luxon.Duration.fromMillis(milliseconds);
  await WorkLog.storeOverWorkTime({
    login_auth_id: targetUser.auth_id,
    over_time_obj: overTime.toObject(),
    week
  });
  return response.send();
}
export async function updateAllUsersOverWorkTimeTodayWorkker(
  request: Request,
  response: Response
) {
  const weekPtn = /[0-9]{4}-W[0-9]{2}/;
  const { week, group_id } = request.body;
  if (week === null || week === undefined || weekPtn.test(week) === false) {
    return response
      .status(400)
      .send({ errorMessage: 'body.week는  ISO 8601 규격의 week(2018-W36)' });
  }
  const startDate = luxon.DateTime.fromISO(`${week}-1`).minus({ days: 1 });
  const endDate = luxon.DateTime.fromISO(`${week}-6`);
  const haveGroupId =
    !(group_id === null || group_id === undefined) &&
    typeof group_id === 'string';
  const getUserFunc = haveGroupId
    ? Users.findAllInGroupLoginUsers({ groupId: group_id })
    : Users.findAllLoginUser();
  const [users, holidayDuration] = await Promise.all([
    getUserFunc,
    WorkLog.getHolidaysDuration(startDate, endDate)
  ]);
  const promises = users.map(async mv => {
    // 당일 워크 기록을 확인 한 뒤 출근 로그가 있으면 작동한다.
    const today = luxon.DateTime.local()
      .setZone('Asia/Seoul')
      .toFormat('yyyy-MM-dd');
    const resp = await WorkLog.findAll({
      userId: mv.id,
      startDate: today,
      endDate: today
    });
    if (!!resp === true && resp.length > 0) {
      const first = resp[0];
      let haveWork = false;
      Object.keys(first).forEach(fv => {
        if (
          haveWork === false &&
          Object.keys(first[fv]).map(
            sfv => first[fv][sfv].type === EN_WORK_TYPE.WORK
          ).length > 0
        ) {
          haveWork = true;
        }
      });
      const timeObj = await getTimeObj(
        week,
        mv.id,
        mv.auth_id,
        holidayDuration
      );
      if (haveWork && timeObj.haveData === true) {
        await WorkLog.storeOverWorkTime({
          login_auth_id: mv.auth_id,
          over_time_obj: timeObj.timeObj,
          week
        });
      }
    }
  });
  while (promises.length > 0) {
    await promises.pop();
  }
  return response.send();
}

export async function deleteOverWorkTime(request: Request, response: Response) {
  const weekPtn = /[0-9]{4}-W[0-9]{2}/;
  const { week, user_id, auth_user_id } = request.body;
  log({ week, auth_user_id });
  if (Util.isEmpty(week) || weekPtn.test(week) === false) {
    return response
      .status(400)
      .send({ errorMessage: 'body.week는  ISO 8601 규격의 week(2018-W36)' });
  }
  // user_id나 auth_user_id가 없는가?
  if (Util.isEmpty(user_id) && Util.isEmpty(auth_user_id)) {
    return response.status(400).send({
      errorMessage: '대상 유저가 누구인지 알 수 없음(user_id, auth_user_id)'
    });
  }
  const users = await Users.findAllLoginUser();
  const targetUser = Util.isNotEmpty(user_id)
    ? users.find(fv => fv.id === user_id)
    : users.find(fv => fv.auth_id === auth_user_id);
  if (targetUser === null || targetUser === undefined) {
    return response.status(204).send();
  }
  log({ targetUser });
  const result = await WorkLog.deleteOverWorkTime({
    week,
    login_auth_id: targetUser.auth_id
  });
  return response.json({ result });
}
export async function getHolidays(request: Request, response: Response) {
  const { start_date, end_date } = request.query;
  if (Util.isEmpty(start_date) || Util.isEmpty(end_date)) {
    return response
      .status(400)
      .send({ errorMessage: 'query에 start_date, end_date 누락(yyyy-mm-dd)' });
  }
  const convertStartDate = luxon.DateTime.fromISO(start_date);
  const convertEndDate = luxon.DateTime.fromISO(end_date);
  const holidays = await WorkLog.getHolidays(convertStartDate, convertEndDate);
  return response.json(holidays);
}
export async function getUserQueue(req: Request, res: Response) {
  const { authId } = req.params;
  if (Util.isEmpty(authId)) {
    return res.status(400).send({ errorMessage: 'authId가 필요합니다.' });
  }
  const datas = await Users.findUserQueue({ userUid: authId });
  return res.json(datas);
}
export async function addUserQueue(req: Request, res: Response) {
  const { userId } = req.params;
  const { reqUserId } = req.body;
  const originUserInfo = await Users.getSlackUserInfo({ userId });
  if (Util.isEmpty(originUserInfo.auth_id)) {
    return res.status(400);
  }
  const [user, targetUserInfo] = await Promise.all([
    Users.findLoginUser({ userUid: originUserInfo.auth_id }),
    Users.find({ userId: reqUserId })
  ]);
  if (Util.isEmpty(user) || Util.isEmpty(targetUserInfo)) {
    return res
      .status(400)
      .send({ errorMessage: '요청한 정보가 잘못되었습니다' });
  }
  await Users.addUserQueue({
    userUid: originUserInfo.auth_id,
    userInfo: targetUserInfo
  });
  const datas = await Users.findUserQueue({ userUid: originUserInfo.auth_id });
  return res.json(datas);
}
export async function deleteUserQueue(req: Request, res: Response) {
  const { authId, key } = req.params;
  const findUser = await Users.findLoginUser({ userUid: authId });
  if (Util.isEmpty(findUser)) {
    return res
      .status(400)
      .send({ errorMessage: '요청한 정보가 잘못되었습니다' });
  }
  await Users.deleteUserQueue({ userUid: authId, key });
  const datas = await Users.findUserQueue({ userUid: authId });
  return res.json(datas);
}
export async function getAllSlackUserInfo(_: Request, res: Response) {
  const datas = await Users.findAllSlackUserInfo();
  return res.json(datas);
}

export async function newMsgAction(request: Request, response: Response) {
  if (request.method !== 'POST') {
    console.error(`Got unsupported ${request.method} request. Expected POST.`);
    return response.status(405).send('Only POST requests are accepted');
  }
  if (!!request.body === false || !!request.body.payload === false) {
    return response.status(401).send('Bad formatted action response');
  }

  const action = JSON.parse(request.body.payload) as SlackActionInvocation;
  const firstAction = action.actions[0];

  const now = new Date();
  now.setHours(now.getHours() + now.getTimezoneOffset() / -60);
  const today = now.toJSON().substr(0, 10);

  // po인가?
  if (firstAction.value === 'cxpo') {
    response
      .contentType('json')
      .status(200)
      .send({
        text: `CXPO 등록 완료\n워크로그 주소\n${viewerUrl}/records/${action.user.id}?startDate=${today}&endDate=${today}\n사용법은 팀에서 가이드 할꺼에요~`
      });
    return await Groups.addMemberToGroup({
      group_id: 'cxpo',
      user_id: action.user.id
    });
  }

  // dev인가?
  if (firstAction.value === 'cxdev') {
    response
      .contentType('json')
      .status(200)
      .send({
        text: `CXDEV 등록 완료\n워크로그 주소\n${viewerUrl}/records/${action.user.id}?startDate=${today}&endDate=${today}\n사용법은 팀에서 가이드 할꺼에요~`
      });
    return await Groups.addMemberToGroup({
      group_id: 'cxdev',
      user_id: action.user.id
    });
  }

  if (/^([0-9]{4})-?W(5[0-3]|[1-4][0-9]|0[1-9])$/.test(firstAction.value)) {
    response
      .contentType('json')
      .status(200)
      .send({
        text: `${firstAction.value} 정산 시작 👀`
      });
    // 해당 주차 정산 요청
    // 정산 api 콜을 보낸다.
    const weekStartDay = luxon.DateTime.fromISO(
      `${firstAction.value}-1`
    ).minus({ days: 1 });
    const weekEndDay = luxon.DateTime.fromISO(`${firstAction.value}-6`);
    // 정산 기록이 없다면. 전체 근무 시간을 확인하자.
    const [users, holidayDuration] = await Promise.all([
      Users.findAllLoginUser(),
      WorkLog.getHolidaysDuration(weekStartDay, weekEndDay)
    ]);
    const targetUser = users.find(fv => fv.id === action.user.id);
    if (targetUser === null || targetUser === undefined) {
      return response.status(204).send();
    }
    const timeObj = await getTimeObj(
      firstAction.value,
      action.user.id,
      targetUser.auth_id,
      holidayDuration
    );
    if (timeObj.haveData === true) {
      await WorkLog.storeOverWorkTime({
        login_auth_id: targetUser.auth_id,
        over_time_obj: timeObj.timeObj,
        week: firstAction.value
      });
      await slackClient.chat.postMessage({
        channel: action.user.id,
        username: '워크로그',
        text: `${firstAction.value} 정산 완료 🏁`,
        attachments: [
          {
            title: '정산기록 확인하기',
            title_link: `${viewerUrl}/overload/${action.user.id}`
          }
        ]
      });
    }
  }
  return response.status(201).send({
    text: '수신 완료'
  });
}

const baseDuration = 'PT10H';
const baseDurationMS = 60 * 60 * 10 * 1000; // 10시간을 ms로 나타냄.

/** 특정 팀의 fuse를 vacation으로 전환한다. */
export async function addFuseToVacationForTeam(
  request: Request,
  res: Response
) {
  const {
    ...reqData
  }: {
    auth_user_id: string; // 로그인한 auth id
    expireDate: string; // 만료 날짜
    note: string; // 사유 같은걸 적을 때 사용
  } = request.body;
  const authInfo = await Users.findLoginUser({ userUid: reqData.auth_user_id });
  if (authInfo.result === false) {
    return res.status(401).send('unauthorized');
  }
  const groupId = request.params['groupId'];
  if (!!groupId === false) {
    return res
      .status(400)
      .contentType('json')
      .send([]);
  }
  const allLoginUsers = await Users.findAllLoginUser();
  const now = luxon.DateTime.local().toFormat('yyyyLLdd');
  const resp = await Users.findAllInGroup({ groupId });
  const successUsers = [];
  for (const user of resp) {
    // 사용자 정보 찾기
    const targetUser = allLoginUsers.find(
      loginUser => loginUser.id === user.id
    );
    if (targetUser === null || targetUser === undefined) {
      continue;
    }
    // 초과근무와 사용한 초과근무 내역 조회
    // 초과근무 내역 & 사용한 초고근무 시간 내역 조회
    const [overTime, fuseTime] = await Promise.all([
      WorkLog.findAllOverWorkTime({ login_auth_id: targetUser.auth_id }),
      WorkLog.findAllFuseOverWorkTime({ login_auth_id: targetUser.auth_id })
    ]);
    if (overTime.length <= 0) {
      // 기록이 없으면 fail
      continue;
    }
    // 차감을 요청한 시간만큼 전체 시간을 보유했는지 확인한다(현재는 강제룰로 10시간)
    const fuseDuration = luxon.Duration.fromISO(baseDuration);

    const totalOverWorkDuration = overTime.reduce(
      (acc: luxon.Duration, cur: IOverWork) => {
        if (cur.over === null || cur.over === undefined) {
          return acc;
        }
        const tempDuration = luxon.Duration.fromObject(cur.over);
        const updateAcc = acc.plus(tempDuration);
        return updateAcc;
      },
      luxon.Duration.fromObject({ milliseconds: 0 })
    );
    const totalFuseDuration = fuseTime.reduce(
      (acc: luxon.Duration, cur: IFuseOverWork) => {
        const tempDuration = luxon.Duration.fromISO(cur.use);
        const updateAcc = acc.plus(tempDuration);
        return updateAcc;
      },
      luxon.Duration.fromObject({ milliseconds: 0 })
    );
    const totalRemainDuration = totalOverWorkDuration.minus(totalFuseDuration);
    if (fuseDuration > totalRemainDuration) {
      // 차감 가능 시간을 초과한 요청
      continue;
    }
    // 소진 기록 추가(10시간으로 차감 기록을 남긴다)
    await WorkLog.addFuseOverWorkTime({
      login_auth_id: targetUser.auth_id,
      date: now,
      use: baseDuration,
      note: reqData.note
    });

    // 초과근무를 휴가로 바꾼 기록을 남긴다.
    await WorkLog.addFuseToVacation({
      login_auth_id: targetUser.auth_id,
      expireDate: reqData.expireDate,
      note: reqData.note
    });
    successUsers.push(user);
  }
  return res.json(successUsers);
}

/** 특정 유저의 초과근무 시간을 휴가금고로 바꿔서 넣음 */
export async function addFuseToVacation(request: Request, res: Response) {
  const {
    ...reqData
  }: {
    auth_user_id: string; // 로그인한 auth id
    user_id: string; // slack id(대상자)
    expireDate: string; // 만료 날짜
    note: string; // 사유 같은걸 적을 때 사용
  } = request.body;
  log(request.body);
  // 로그인 사용자 확인
  const authInfo = await Users.findLoginUser({ userUid: reqData.auth_user_id });
  if (authInfo.result === false) {
    return res.status(401).send('unauthorized');
  }
  // 다른 유저의 log를 추가하는가?
  log(
    authInfo.data.id,
    authInfo.data.id !== reqData.user_id,
    !!authInfo.data.auth === false,
    authInfo.data.auth
  );
  if (authInfo.data.id !== reqData.user_id && !!authInfo.data.auth === false) {
    return res.status(401).send('unauthorized 2');
  }
  // 대상자의 정보를 로딩하자.
  // 로그인한 사용자 전체 정보를 확인한 뒤 user_id와 매칭되는 것을 찾아야한다. 와 이거 더럽게 복잡한데?
  const allLoginUsers = await Users.findAllLoginUser();
  const targetUser = allLoginUsers.find(fv => fv.id === reqData.user_id);
  // 사용자가 없는가?
  if (targetUser === null || targetUser === undefined) {
    return res.status(204).send();
  }
  // 초과근무 내역 & 사용한 초고근무 시간 내역 조회
  const [overTime, fuseTime] = await Promise.all([
    WorkLog.findAllOverWorkTime({ login_auth_id: targetUser.auth_id }),
    WorkLog.findAllFuseOverWorkTime({ login_auth_id: targetUser.auth_id })
  ]);
  if (overTime.length <= 0) {
    // 기록이 없으면 fail
    return res.status(400).send(`차감 가능한 초과근무가 없습니다`);
  }
  // 차감을 요청한 시간만큼 전체 시간을 보유했는지 확인한다(현재는 강제룰로 10시간)
  const fuseDuration = luxon.Duration.fromISO(baseDuration);

  const totalOverWorkDuration = overTime.reduce(
    (acc: luxon.Duration, cur: IOverWork) => {
      if (cur.over === null || cur.over === undefined) {
        return acc;
      }
      const tempDuration = luxon.Duration.fromObject(cur.over);
      const updateAcc = acc.plus(tempDuration);
      return updateAcc;
    },
    luxon.Duration.fromObject({ milliseconds: 0 })
  );
  const totalFuseDuration = fuseTime.reduce(
    (acc: luxon.Duration, cur: IFuseOverWork) => {
      const tempDuration = luxon.Duration.fromISO(cur.use);
      const updateAcc = acc.plus(tempDuration);
      return updateAcc;
    },
    luxon.Duration.fromObject({ milliseconds: 0 })
  );
  const totalRemainDuration = totalOverWorkDuration.minus(totalFuseDuration);
  if (fuseDuration > totalRemainDuration) {
    return res.status(400).send(`차감 가능 시간을 초과한 요청입니다`);
  }
  // 소진 기록 추가(10시간으로 차감 기록을 남긴다)
  const now = luxon.DateTime.local().toFormat('yyyyLLdd');
  await WorkLog.addFuseOverWorkTime({
    login_auth_id: targetUser.auth_id,
    date: now,
    use: baseDuration,
    note: reqData.note
  });

  // 초과근무를 휴가로 바꾼 기록을 남긴다.
  await WorkLog.addFuseToVacation({
    login_auth_id: targetUser.auth_id,
    expireDate: reqData.expireDate,
    note: reqData.note
  });

  return res.send();
}

export async function addFuseToVacationByGroupID(
  request: Request,
  res: Response
) {
  const {
    ...reqData
  }: {
    expireDate: string; // 만료 날짜
    note: string; // 사유 같은걸 적을 때 사용
    auth_id: string;
  } = request.body;
  log(request.body);

  const authInfo = await Users.findLoginUser({ userUid: reqData.auth_id });
  // 관리자 권한 확인
  if (
    authInfo.result === false ||
    authInfo.data.auth === undefined ||
    authInfo.data.auth !== 10
  ) {
    return res.status(401).send('unauthorized');
  }

  // 그룹 id를 전해받아서 그 안에 있는 사람들을 처리해버리자.
  const groupId = request.params['group_id'];
  if (!!groupId === false) {
    return res.status(400).send();
  }

  // 대상자의 정보를 로딩하자.
  const groupUsers = await Users.findAllInGroup({ groupId });
  // 로그인한 사용자 전체 정보를 확인한 뒤 user_id와 매칭되는 것을 찾아야한다. 와 이거 더럽게 복잡한데?
  const allLoginUsers = await Users.findAllLoginUser();

  for (const user of groupUsers) {
    const targetUser = allLoginUsers.find(fv => fv.id === user.id);
    // 사용자가 없는가?
    if (targetUser === null || targetUser === undefined) {
      continue;
    }
    // 초과근무 내역 & 사용한 초고근무 시간 내역 조회
    const [overTime, fuseTime] = await Promise.all([
      WorkLog.findAllOverWorkTime({ login_auth_id: targetUser.auth_id }),
      WorkLog.findAllFuseOverWorkTime({ login_auth_id: targetUser.auth_id })
    ]);
    if (overTime.length <= 0) {
      // 기록이 없으면 fail
      // 차감 가능한 초과근무가 없습니다
      continue;
    }
    // 차감을 요청한 시간만큼 전체 시간을 보유했는지 확인한다(현재는 강제룰로 10시간)
    const fuseDuration = luxon.Duration.fromISO(baseDuration);

    const totalOverWorkDuration = overTime.reduce(
      (acc: luxon.Duration, cur: IOverWork) => {
        if (cur.over === null || cur.over === undefined) {
          return acc;
        }
        const tempDuration = luxon.Duration.fromObject(cur.over);
        const updateAcc = acc.plus(tempDuration);
        return updateAcc;
      },
      luxon.Duration.fromObject({ milliseconds: 0 })
    );
    const totalFuseDuration = fuseTime.reduce(
      (acc: luxon.Duration, cur: IFuseOverWork) => {
        const tempDuration = luxon.Duration.fromISO(cur.use);
        const updateAcc = acc.plus(tempDuration);
        return updateAcc;
      },
      luxon.Duration.fromObject({ milliseconds: 0 })
    );
    const totalRemainDuration = totalOverWorkDuration.minus(totalFuseDuration);
    if (fuseDuration > totalRemainDuration) {
      // 차감 가능 시간을 초과한 요청입니다
      continue;
    }
    // 추가할 휴가 갯수 카운트
    const totalAddVacationCount = (() => {
      let nowRemainDuration = luxon.Duration.fromObject(
        totalRemainDuration.toObject()
      );
      let count = 0;
      while (nowRemainDuration > fuseDuration) {
        count += 1;
        nowRemainDuration = nowRemainDuration.minus({
          milliseconds: baseDurationMS
        });
      }
      return count;
    })();
    // 소진 기록 추가(10시간으로 차감 기록을 남긴다)
    const now = luxon.DateTime.local().toFormat('yyyyLLdd');
    for (let i = 0; i < totalAddVacationCount; i++) {
      await WorkLog.addFuseOverWorkTime({
        login_auth_id: targetUser.auth_id,
        date: now,
        use: baseDuration,
        note: reqData.note
      });

      // 초과근무를 휴가로 바꾼 기록을 남긴다.
      await WorkLog.addFuseToVacation({
        login_auth_id: targetUser.auth_id,
        expireDate: reqData.expireDate,
        note: reqData.note
      });
    }
    await slackClient.chat.postMessage({
      channel: 'zin_worklog',
      username: '워크로그',
      text: `초과근무 --> 휴가금고 변환 완료 🏁`,
      attachments: [
        {
          title: '사용자 id',
          text: targetUser.id
        },
        {
          title: '변환된 휴가 갯수',
          text: totalAddVacationCount.toString()
        },
        {
          title: '변환 사유',
          text: reqData.note
        },
        {
          title: '만료일',
          text: reqData.expireDate
        },
        {
          title: '휴가금고 확인하기',
          title_link: `${viewerUrl}/convert_vacation/${targetUser.id}`
        }
      ]
    });
  }

  return res.send();
}

export async function findAllFuseToVacationByUserId(
  request: Request,
  response: Response
) {
  const { user_id } = request.params;
  const { filter_possible } = request.query;
  if (user_id === null || user_id === undefined) {
    return response.status(400).send({ errorMessage: 'query.user_id 누락' });
  }
  const filterPossible =
    filter_possible === null || filter_possible === undefined
      ? false
      : filter_possible === 'true';
  const allLoginUsers = await Users.findAllLoginUser();
  const targetUser = allLoginUsers.find(fv => fv.id === user_id);
  if (targetUser === null || targetUser === undefined) {
    return response.status(204).send();
  }
  const datas = await WorkLog.findAllFuseToVacation({
    login_auth_id: targetUser.auth_id,
    filterPossible
  });
  return response.send(datas);
}

/** 초과근무시간 전환한 휴가 사용하기 */
export async function useFuseToVacation(request: Request, res: Response) {
  const {
    ...reqData
  }: {
    auth_user_id: string; // 로그인한 auth id
    user_id: string; // slack id(대상자)
    target_date: string; // 등록할 날짜
  } = request.body;
  log(request.body);
  // 로그인 사용자 확인
  const authInfo = await Users.findLoginUser({ userUid: reqData.auth_user_id });
  if (authInfo.result === false) {
    return res.status(401).send('unauthorized');
  }
  // 다른 유저의 log를 추가하는가?
  log(
    authInfo.data.id,
    authInfo.data.id !== reqData.user_id,
    !!authInfo.data.auth === false,
    authInfo.data.auth
  );
  if (authInfo.data.id !== reqData.user_id && !!authInfo.data.auth === false) {
    return res.status(401).send('unauthorized 2');
  }

  const allLoginUsers = await Users.findAllLoginUser();
  const targetUser = allLoginUsers.find(fv => fv.id === reqData.user_id);

  // 초과근무 휴가 사용 기록 남긴다.
  const time = luxon.DateTime.fromFormat(reqData.target_date, 'yyyyLLdd');
  const result = await WorkLog.useFuseToVacation({
    login_auth_id: targetUser.auth_id,
    addLogDate: reqData.target_date
  });
  if (result === true) {
    const timeStr = time.plus({ hours: 9 }).toISO();
    const addDuration = luxon.Duration.fromISO('PT8H');
    const doneStr = time
      .plus({ hours: 9 })
      .plus(addDuration)
      .toISO();
    await WorkLog.store({
      userId: targetUser.id,
      timeStr,
      doneStr,
      targetDate: reqData.target_date,
      type: EN_WORK_TYPE.FUSEOVERLOAD
    });
  }

  return res.send({ result });
}

export async function disableExpiredFuseToVacation(
  request: Request,
  res: Response
) {
  // 그룹 id를 전해받아서 그 안에 있는 사람들을 처리해버리자.
  const groupId = request.params['group_id'];
  if (!!groupId === false) {
    return res.status(400).send();
  }
  const { expireDate, expireNote, auth_id } = request.body;
  const authInfo = await Users.findLoginUser({ userUid: auth_id });
  // 관리자 권한 확인
  if (
    authInfo.result === false ||
    authInfo.data.auth === undefined ||
    authInfo.data.auth !== 10
  ) {
    return res.status(401).send('unauthorized');
  }
  const groupUsers = await Users.findAllInGroup({ groupId });
  const allLoginUsers = await Users.findAllLoginUser();

  for (const user of groupUsers) {
    const targetUser = allLoginUsers.find(fv => fv.id === user.id);
    // 로그인 유저 정보를 찾을 수 없으면 처리하지 않는다.
    // auth_id를 찾을 수 없어도 처리하지 않는다.
    if (
      targetUser === undefined ||
      targetUser === null ||
      targetUser.auth_id === undefined ||
      targetUser.auth_id === null
    ) {
      continue;
    }
    await WorkLog.disableExpireFuseToVacation({
      login_auth_id: targetUser.auth_id,
      expDate: expireDate,
      expireNote
    });
    await slackClient.chat.postMessage({
      channel: 'zin_worklog',
      username: '워크로그',
      text: `사리진 휴가금고 안내 😭`,
      attachments: [
        {
          title: '사용자 id',
          text: targetUser.id
        },
        {
          title: '만료 사유',
          text: expireNote
        },
        {
          title: '만료 기준일',
          text: expireDate
        },
        {
          title: '휴가금고 확인하기',
          title_link: `${viewerUrl}/convert_vacation/${targetUser.id}`
        }
      ]
    });
  }
  return res.send('done');
}

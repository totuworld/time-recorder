import * as luxon from 'luxon';

import { EN_WORK_TITLE_KR, EN_WORK_TYPE } from './contants/enum/EN_WORK_TYPE';
import {
    LogData, SlackActionInvocation, SlackSlashCommand
} from './models/interface/SlackSlashCommand';
import { Users } from './models/Users';
import { WorkLog } from './models/WorkLog';
import { FireabaseAdmin } from './services/FirebaseAdmin';
import { Util } from './util';

const commandSet = {
  WORK: new Set(["출근", "ㅊㄱ", "ㅊㅊ", "hi"]),
  BYEBYE: new Set(["퇴근", "ㅌㄱ", "bye"]),
  REST: new Set(["휴식", "ㅎㅅ", "rest", "etc"]),
  DONE: new Set(["완료", "ㅇㄹ", "done"]),
  EMERGENCY: new Set(["긴급대응", 'ㄱㄱㄷㅇ', 'emergency']),
};

const SLACK_ACTION_REQUEST_PING = "ping-pong";

export async function commandPing (request, response) {
  if (request.method !== "POST") {
    console.error(
      `Got unsupported ${request.method} request. Expected POST.`
    );
    return response.status(405).send("Only POST requests are accepted");
  }

  const command = request.body as SlackSlashCommand;
  // console.log(command);
  // 출근
  if (commandSet.WORK.has(command.text) === true) {
    await WorkLog.storeWork({ userId: command.user_id });
    return response
      .contentType("json")
      .status(200)
      .send({
        text: Util.hiMsg()
      });
  }

  // 퇴근
  if (commandSet.BYEBYE.has(command.text) === true) {
    await WorkLog.storeBye({ userId: command.user_id });
    return response
      .contentType("json")
      .status(200)
      .send({
        text: Util.byeMsg()
      });
  }

  // 휴식
  if (commandSet.REST.has(command.text) === true) {
    await WorkLog.storeRest({ userId: command.user_id });
    return response
      .contentType("json")
      .status(200)
      .send({
        text: `휴식 ${Util.dateTimeShort()}`
      });
  }

  // 긴급대응
  if (commandSet.EMERGENCY.has(command.text) === true) {
    await WorkLog.storeEmergency({ userId: command.user_id });
    return response
      .contentType("json")
      .status(200)
      .send({
        text: `긴급대응 ${Util.dateTimeShort()}`
      });
  }

  // 완료
  if (commandSet.DONE.has(command.text) === true) {
    const { msg } = await WorkLog.storeComplete({ userId: command.user_id });
    return response
      .contentType("json")
      .status(200)
      .send({
        text: msg
      });
  }

  // Handle the commands later, Slack expect this request to return within 3000ms
  // await FirebaseAmdin.Database.ref("commands/ping").push(command);

  return response
    .contentType("json")
    .status(200)
    .send({
      text: "기록을 시작할까요?",
      attachments: [
        {
          text: "Let's play the game.",
          fallback: "You are unable to choose a game",
          callback_id: SLACK_ACTION_REQUEST_PING,
          color: "#3AA3E3",
          attachment_type: "default",
          actions: [
            {
              name: "game",
              text: "출근",
              type: "button",
              value: EN_WORK_TYPE.WORK
            },
            {
              name: "game",
              text: "퇴근",
              type: "button",
              value: EN_WORK_TYPE.BYEBYE
            },
            {
              name: "game",
              text: "휴식",
              type: "button",
              value: EN_WORK_TYPE.REST
            },
            {
              name: "game",
              text: "긴급대응",
              style: "danger",
              type: "button",
              value: EN_WORK_TYPE.EMERGENCY,
              confirm: {
                title: "긴급대응 로그",
                text: "긴급대응을 시작할까요? ㅠㅠ",
                ok_text: "Yes",
                dismiss_text: "No"
              }
            },
            {
              name: "game",
              text: "완료",
              type: "button",
              value: EN_WORK_TYPE.DONE
            }
          ]
        }
      ]
    });
}

/** 관리자용 */
export async function addWorkLog (request, res) {
  const {
    ...reqData
  }: {
    auth_user_id: string,
    user_id: string,
    type: EN_WORK_TYPE,
    target_date?: string,
    time?: string,
  }
  = request.body;

  // 로그인 사용자 확인
  const authInfo = await Users.findLoginUser({ userUid: reqData.auth_user_id });
  if (authInfo.result === false) {
    return res.status(401).send('unauthorized');
  }

  // 다른 유저의 log를 추가하는가?
  if (authInfo.data.id !== reqData.user_id && !!authInfo.data.auth === false) {
    return res.status(401).send('unauthorized');
  }

  // 완료 기록인가?
  if (reqData.type === EN_WORK_TYPE.DONE) {
    await WorkLog.storeComplete({
      userId: reqData.user_id,
      targetDate: reqData.target_date,
    });
  } else if (reqData.type === EN_WORK_TYPE.VACATION || reqData.type === EN_WORK_TYPE.HALFVACATION) {
    // 휴가/반차 기록(기록은 모두 VACATION으로 한다.)
    const now = luxon.DateTime.local();
    const start = `${now.toFormat('yyyy-LL-dd')}T09:00:00+09:00`;
    const end = `${now.toFormat('yyyy-LL-dd')}T${reqData.type === EN_WORK_TYPE.VACATION ? 17 : 13}:00:00+09:00`;
    await WorkLog.store({ userId: reqData.user_id, type: EN_WORK_TYPE.VACATION, timeStr: start, doneStr: end });
  } else {
    const logs = await WorkLog.find({
      userId: reqData.user_id,
      startDate: reqData.target_date,
    });;
    const logDataList = Object.keys(logs.data).map((mv) => logs.data[mv]);
    // 검증 로직 추가.
    const possibleAddWorkLog = WorkLog.checkAddWorkType(logDataList, reqData.type);

    // 조건을 만족했거나, 관리자 권한이 있을 때!
    if (possibleAddWorkLog === true || !!authInfo.data.auth === true) {
      // 완료 외의 기록
      await WorkLog.store({
        userId: reqData.user_id,
        type: reqData.type,
        timeStr: reqData.time,
        targetDate: reqData.target_date,
      });
    }
  }
  
  return res.send();
}

export async function commandHistory(request, response) {
  if (request.method !== "POST") {
    console.error(
      `Got unsupported ${request.method} request. Expected POST.`
    );
    return response.status(405).send("Only POST requests are accepted");
  }

  const command = request.body as SlackSlashCommand;
  // console.log(command);

  const userRootRef = FireabaseAdmin.Database.ref("user");
  const userRef = userRootRef.child(command.user_id);
  const logDatas = await userRef
    .child(`${Util.currentDate()}`)
    .once("value")
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
                acc.acc += duration.as("hours");
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
        workFilter.acc += duration.as("hours");
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
      : "오늘은 휴가인가봐요 :)"
  ];
  const keyLength = Object.keys(logDatas.rawData).length;
  if (keyLength > 0) {
    Object.keys(logDatas.rawData).map(key => {
      const data = logDatas.rawData[key];
      const done = !!data.done ? ` ~ ${Util.toDateTimeShort(data.done)}` : "";
      message.push(
        `${EN_WORK_TITLE_KR[data.type]} 👉 ${Util.toDateTimeShort(
          data.time
        )}${done}`
      );
    });
  }
  return response
    .contentType("json")
    .status(200)
    .send({
      text: message.join("\n\n")
    });
}

export async function modify(request, res) {
  if (request.method !== "POST") {
    console.error(
      `Got unsupported ${request.method} request. Expected POST.`
    );
    return res.status(405).send("Only POST requests are accepted");
  }
  const { auth_user_id, user_id, update_date, record_key , target_key, time } = request.body;

  // 권한 확인
  const authInfo = await Users.findLoginUser({ userUid: auth_user_id });
  if (authInfo.result === false) {
    return res.status(401).send('unauthorized');
  }
  
  // 다른 유저의 정보를 수정하는가?
  if (authInfo.data.id !== user_id && !!authInfo.data.auth === false) {
    return res.status(401).send('unauthorized');
  }
  const updateData = {
    userId: user_id,
    updateDate: update_date,
    updateRecordkey: record_key,
    updateDataKey: target_key,
    updateTime: time,
  };
  // 데이터 수정
  await WorkLog.updateData(updateData);
  return res.send();
}

export async function getAll(request, response) {
  const userId = request.query["userId"];
  const startDate = request.query["startDate"];
  const endDate = request.query["endDate"];
  if (!!userId === false) {
    response
      .status(400)
      .contentType("json")
      .send([]);
  } else {
    const resp = await WorkLog.findAll({ userId, startDate, endDate });
    response.contentType("json").send(resp);
  }
}

export async function getGroups(request, response) {
  const groupId = request.query["groupId"];
  if (!!groupId === false) {
    return response
      .status(400)
      .contentType("json")
      .send([]);
  }
  const resp = await Users.findAllInGroup({groupId});
  return response.contentType("json").send(resp);
}

export async function getUser(request, response) {
  const userId = request.query["userId"];
  if (!!userId === false) {
    return response
      .status(400)
      .contentType("json")
      .send({});
  }
  const resp = await Users.find({userId});
  return response.contentType("json").send(resp);
}

export async function messageAction(request, response) {
  if (request.method !== "POST") {
    console.error(
      `Got unsupported ${request.method} request. Expected POST.`
    );
    return response.status(405).send("Only POST requests are accepted");
  }

  if (!request.body && request.body.payload) {
    return response.status(401).send("Bad formatted action response");
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
  const workRef = FireabaseAdmin.Database.ref("work");
  const userRootRef = FireabaseAdmin.Database.ref("user");
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
      .contentType("json")
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
      .contentType("json")
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
      .contentType("json")
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
      .contentType("json")
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
      .once("value")
      .then(snap => {
        const childData = snap.val() as { [key: string]: LogData };
        const filter = Object.keys(childData).reduce(
          (acc: LogData & { key: string }[], key) => {
            const fv = childData[key] as LogData & { key: string };
            fv["key"] = key; // 키 저장.
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
      return response
        .contentType("json")
        .status(200)
        .send({
          text: `완료처리할 이벤트가 없어요`
        });
    }
    const updateData = logDatas[logDatas.length - 1];

    const duration = Util.getBetweenDuration(
      updateData.time,
      time
    ).toObject();
    const durationStr = Object.keys(duration)
      .map(key => `${duration[key]} ${key}`)
      .join(" ");
    const msg = `${
      EN_WORK_TITLE_KR[updateData.type]
    } 완료 (소요: ${durationStr})`;

    updateData.done = time;
    userRef
      .child(`${Util.currentDate()}`)
      .child(updateData.key)
      .set(updateData);

    return response
      .contentType("json")
      .status(200)
      .send({
        text: msg
      });
  }

  return response
    .contentType("json")
    .status(200)
    .send("완료");
}
;
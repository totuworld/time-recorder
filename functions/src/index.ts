import * as functions from 'firebase-functions';
import * as admin from "firebase-admin";

import { Util } from './util';

const SLACK_ACTION_REQUEST_PING = "ping-pong";

enum EN_WORK_TYPE {
  WORK = 'WORK',
  BYEBYE = 'BYEBYE',
  REST = 'REST',
  EMERGENCY = 'EMERGENCY',
  DONE = 'DONE',
}

enum EN_WORK_TITLE_KR {
  WORK = '출근',
  BYEBYE = '퇴근',
  REST = '휴식',
  EMERGENCY = '긴급대응',
  DONE = '완료',
}

const config = functions.config().fbconf;

admin.initializeApp({
  databaseURL: config.databaseurl,
  credential: admin.credential.cert(config.credential)});

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
export const helloWorld = functions.https.onRequest((request, response) => {
  response.send("Hello from Firebase!");
});

export const command_ping = functions.https.onRequest(async (request, response) => {
  if (request.method !== "POST") {
      console.error(`Got unsupported ${request.method} request. Expected POST.`);
      return response.status(405).send("Only POST requests are accepted");
  }

  const command = request.body as SlackSlashCommand;
  // console.log(command);

  const workRef = admin.database().ref('work');
  const userRootRef = admin.database().ref('user');
  const userRef = userRootRef.child(command.user_id);
  // 출근
  if (command.text === '출근' || command.text === 'ㅊㅊ' || command.text === 'ㅊㄱ') {
    const time = Util.currentTimeStamp();
    const refKey = await workRef.push({
      user: command.user_id,
      log: EN_WORK_TYPE.WORK,
      time: time,
    });
    await userRef.child(`${Util.currentDate()}`).push({ refKey: refKey.key, time, type: EN_WORK_TYPE.WORK });
    return response.contentType("json").status(200).send({
      text: Util.hiMsg(),
    });
  }

  // 퇴근
  if (command.text === '퇴근' || command.text === 'ㅌㄱ' || command.text === 'bye') {
    const time = Util.currentTimeStamp();
    const refKey = await workRef.push({
      user: command.user_id,
      log: EN_WORK_TYPE.BYEBYE,
      time: time,
    });
    await userRef.child(`${Util.currentDate()}`).push({ refKey: refKey.key, time, type: EN_WORK_TYPE.BYEBYE });
    return response.contentType("json").status(200).send({
      text: Util.byeMsg(),
    });
  }
  
  // 휴식
  if (command.text === '휴식' || command.text === 'ㅎㅅ' || command.text === 'rest' || command.text === 'etc') {
    const time = Util.currentTimeStamp();
    const refKey = await workRef.push({
      user: command.user_id,
      log: EN_WORK_TYPE.REST,
      time: time,
    });
    await userRef.child(`${Util.currentDate()}`).push({ refKey: refKey.key, time, type: EN_WORK_TYPE.REST });
    return response.contentType("json").status(200).send({
      text: `휴식 ${Util.dateTimeShort()}`,
    });
  }

  // 완료
  if (command.text === '완료' || command.text === 'ㅇㄹ' || command.text === 'done') {
    const time = Util.currentTimeStamp();
    const logDatas = await userRef.child(`${Util.currentDate()}`).once("value").then(snap => {
      const childData = snap.val() as { [key: string]: LogData };
      const filter = Object.keys(childData)
        .reduce((acc: LogData & { key: string }[], key) => {
          const fv = childData[key] as LogData & { key: string };
          fv['key'] = key; // 키 저장.
          // REST, EMERGENCY 중 done이 없는 것 추출
          if ((fv.type === EN_WORK_TYPE.REST || fv.type === EN_WORK_TYPE.EMERGENCY) && !!fv.done === false) {
            acc.push(fv);
          }
          return acc;
        }, []);
      return filter;
    });
    if (logDatas.length === 0) {
      // 딱히 완료할 잡이 없다.
      return response.contentType("json").status(200).send({
        text: `완료처리할 이벤트가 없어요`,
      });
    }
    const updateData = logDatas[logDatas.length - 1];

    const duration = Util.getBetweenDuration(updateData.time, time).toObject();
    const durationStr = Object.keys(duration).map((key) => `${duration[key]} ${key}`).join(' ');
    const msg = `${EN_WORK_TITLE_KR[updateData.type]} 완료 (소요: ${durationStr})`;

    updateData.done = time;
    userRef.child(`${Util.currentDate()}`).child(updateData.key).set(updateData);

    return response.contentType("json").status(200).send({
      text: msg,
    });
  }

  // Handle the commands later, Slack expect this request to return within 3000ms
  // await admin.database().ref("commands/ping").push(command);

  return response.contentType("json").status(200).send({
    "text": "기록을 시작할까요?",
    "attachments": [
      {
        "text": "Let's play the game.",
        "fallback": "You are unable to choose a game",
        "callback_id": SLACK_ACTION_REQUEST_PING,
        "color": "#3AA3E3",
        "attachment_type": "default",
        "actions": [
          {
            "name": "game",
            "text": "출근",
            "type": "button",
            "value": EN_WORK_TYPE.WORK,
          },
          {
            "name": "game",
            "text": "퇴근",
            "type": "button",
            "value": EN_WORK_TYPE.BYEBYE,
          },
          {
            "name": "game",
            "text": "휴식",
            "type": "button",
            "value": EN_WORK_TYPE.REST,
          },
          {
            "name": "game",
            "text": "긴급대응",
            "style": "danger",
            "type": "button",
            "value": EN_WORK_TYPE.EMERGENCY,
            "confirm": {
              "title": "긴급대응 로그",
              "text": "긴급대응을 시작할까요? ㅠㅠ",
              "ok_text": "Yes",
              "dismiss_text": "No"
            }
          },
          {
            "name": "game",
            "text": "완료",
            "type": "button",
            "value": EN_WORK_TYPE.DONE,
          }
        ]
      }
    ]
  });
});

export const message_action = functions.https.onRequest(async (request, response) => {
  if (request.method !== "POST") {
      console.error(`Got unsupported ${request.method} request. Expected POST.`);
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
  const workRef = admin.database().ref('work');
  const userRootRef = admin.database().ref('user');
  const userRef = userRootRef.child(action.user.id);
  // 출근?
  if (action.actions[0].value === EN_WORK_TYPE.WORK) {
    const time = Util.currentTimeStamp();
    const refKey = await workRef.push({
      user: action.user.id,
      log: EN_WORK_TYPE.WORK,
      time: time,
    });
    await userRef.child(`${Util.currentDate()}`).push({ refKey: refKey.key, time, type: EN_WORK_TYPE.WORK });
    return response.contentType("json").status(200).send({
      text: Util.hiMsg(),
    });
  }
  // 퇴근?
  if (action.actions[0].value === EN_WORK_TYPE.BYEBYE) {
    const time = Util.currentTimeStamp();
    const refKey = await workRef.push({
      user: action.user.id,
      log: EN_WORK_TYPE.BYEBYE,
      time: time,
    });
    await userRef.child(`${Util.currentDate()}`).push({ refKey: refKey.key, time, type: EN_WORK_TYPE.BYEBYE });
    return response.contentType("json").status(200).send({
      text: Util.byeMsg(),
    });
  }

  // 휴식
  if (action.actions[0].value === EN_WORK_TYPE.REST) {
    const time = Util.currentTimeStamp();
    const refKey = await workRef.push({
      user: action.user.id,
      log: EN_WORK_TYPE.REST,
      time: time,
    });
    await userRef.child(`${Util.currentDate()}`).push({ refKey: refKey.key, time, type: EN_WORK_TYPE.REST });
    return response.contentType("json").status(200).send({
      text: `휴식 ${Util.dateTimeShort()}`,
    });
  }

  // 완료
  if (action.actions[0].value === EN_WORK_TYPE.DONE) {
    const time = Util.currentTimeStamp();
    const logDatas = await userRef.child(`${Util.currentDate()}`).once("value").then(snap => {
      const childData = snap.val() as { [key: string]: LogData };
      const filter = Object.keys(childData)
        .reduce((acc: LogData & { key: string }[], key) => {
          const fv = childData[key] as LogData & { key: string };
          fv['key'] = key; // 키 저장.
          // REST, EMERGENCY 중 done이 없는 것 추출
          if ((fv.type === EN_WORK_TYPE.REST || fv.type === EN_WORK_TYPE.EMERGENCY) && !!fv.done === false) {
            acc.push(fv);
          }
          return acc;
        }, []);
      return filter;
    });
    if (logDatas.length === 0) {
      // 딱히 완료할 잡이 없다.
      return response.contentType("json").status(200).send({
        text: `완료처리할 이벤트가 없어요`,
      });
    }
    const updateData = logDatas[logDatas.length - 1];

    const duration = Util.getBetweenDuration(updateData.time, time).toObject();
    const durationStr = Object.keys(duration).map((key) => `${duration[key]} ${key}`).join(' ');
    const msg = `${EN_WORK_TITLE_KR[updateData.type]} 완료 (소요: ${durationStr})`;

    updateData.done = time;
    userRef.child(`${Util.currentDate()}`).child(updateData.key).set(updateData);

    return response.contentType("json").status(200).send({
      text: msg,
    });
  }

  return response.contentType("json").status(200).send('완료');
});

interface SlackSlashCommand {
  token: string,
  team_id: string,
  team_domain: string,
  channel_id: string,
  channel_name: string,
  user_id: string,
  user_name: string,
  command: string,
  text: string,
  response_url: string
}

interface SlackAction {
  name: string,
  type: string,
  value: string
}

interface SlackActionInvocation {
  actions: SlackAction[],
  callback_id: string,
  team: { id: string, domain: string },
  channel: { id: string, name: string },
  user: { id: string, name: string },
  action_ts: string,
  message_ts: string,
  attachment_id: string,
  token: string,
  is_app_unfurl: boolean,
  response_url: string,
  original_message: {
      text: string,
      bot_id: string,
      attachments?: any,
      type: string,
      subtype: string,
      ts: string
  }
}

interface LogData {
  refKey: string,
  time: string,
  type: EN_WORK_TYPE,
  done?: string,
}
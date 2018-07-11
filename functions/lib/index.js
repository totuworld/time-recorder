"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const util_1 = require("./util");
const SLACK_ACTION_REQUEST_PING = "ping-pong";
var EN_WORK_TYPE;
(function (EN_WORK_TYPE) {
    EN_WORK_TYPE["WORK"] = "WORK";
    EN_WORK_TYPE["BYEBYE"] = "BYEBYE";
    EN_WORK_TYPE["REST"] = "REST";
    EN_WORK_TYPE["EMERGENCY"] = "EMERGENCY";
    EN_WORK_TYPE["DONE"] = "DONE";
})(EN_WORK_TYPE || (EN_WORK_TYPE = {}));
var EN_WORK_TITLE_KR;
(function (EN_WORK_TITLE_KR) {
    EN_WORK_TITLE_KR["WORK"] = "\uCD9C\uADFC";
    EN_WORK_TITLE_KR["BYEBYE"] = "\uD1F4\uADFC";
    EN_WORK_TITLE_KR["REST"] = "\uD734\uC2DD";
    EN_WORK_TITLE_KR["EMERGENCY"] = "\uAE34\uAE09\uB300\uC751";
    EN_WORK_TITLE_KR["DONE"] = "\uC644\uB8CC";
})(EN_WORK_TITLE_KR || (EN_WORK_TITLE_KR = {}));
const config = functions.config().fbconf;
admin.initializeApp({
    databaseURL: config.databaseurl,
    credential: admin.credential.cert(config.credential)
});
// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
exports.helloWorld = functions.https.onRequest((request, response) => {
    response.send("Hello from Firebase!");
});
exports.command_ping = functions.https.onRequest((request, response) => __awaiter(this, void 0, void 0, function* () {
    if (request.method !== "POST") {
        console.error(`Got unsupported ${request.method} request. Expected POST.`);
        return response.status(405).send("Only POST requests are accepted");
    }
    const command = request.body;
    // console.log(command);
    const workRef = admin.database().ref('work');
    const userRootRef = admin.database().ref('user');
    const userRef = userRootRef.child(command.user_id);
    // 출근
    if (command.text === '출근' || command.text === 'ㅊㅊ' || command.text === 'ㅊㄱ') {
        const time = util_1.Util.currentTimeStamp();
        const refKey = yield workRef.push({
            user: command.user_id,
            log: EN_WORK_TYPE.WORK,
            time: time,
        });
        yield userRef.child(`${util_1.Util.currentDate()}`).push({ refKey: refKey.key, time, type: EN_WORK_TYPE.WORK });
        return response.contentType("json").status(200).send({
            text: util_1.Util.hiMsg(),
        });
    }
    // 퇴근
    if (command.text === '퇴근' || command.text === 'ㅌㄱ' || command.text === 'bye') {
        const time = util_1.Util.currentTimeStamp();
        const refKey = yield workRef.push({
            user: command.user_id,
            log: EN_WORK_TYPE.BYEBYE,
            time: time,
        });
        yield userRef.child(`${util_1.Util.currentDate()}`).push({ refKey: refKey.key, time, type: EN_WORK_TYPE.BYEBYE });
        return response.contentType("json").status(200).send({
            text: util_1.Util.byeMsg(),
        });
    }
    // 휴식
    if (command.text === '휴식' || command.text === 'ㅎㅅ' || command.text === 'rest' || command.text === 'etc') {
        const time = util_1.Util.currentTimeStamp();
        const refKey = yield workRef.push({
            user: command.user_id,
            log: EN_WORK_TYPE.REST,
            time: time,
        });
        yield userRef.child(`${util_1.Util.currentDate()}`).push({ refKey: refKey.key, time, type: EN_WORK_TYPE.REST });
        return response.contentType("json").status(200).send({
            text: `휴식 ${util_1.Util.dateTimeShort()}`,
        });
    }
    // 완료
    if (command.text === '완료' || command.text === 'ㅇㄹ' || command.text === 'done') {
        const time = util_1.Util.currentTimeStamp();
        const logDatas = yield userRef.child(`${util_1.Util.currentDate()}`).once("value").then(snap => {
            const childData = snap.val();
            const filter = Object.keys(childData)
                .reduce((acc, key) => {
                const fv = childData[key];
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
        const duration = util_1.Util.getBetweenDuration(updateData.time, time).toObject();
        const durationStr = Object.keys(duration).map((key) => `${duration[key]} ${key}`).join(' ');
        const msg = `${EN_WORK_TITLE_KR[updateData.type]} 완료 (소요: ${durationStr})`;
        updateData.done = time;
        userRef.child(`${util_1.Util.currentDate()}`).child(updateData.key).set(updateData);
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
}));
exports.message_action = functions.https.onRequest((request, response) => __awaiter(this, void 0, void 0, function* () {
    if (request.method !== "POST") {
        console.error(`Got unsupported ${request.method} request. Expected POST.`);
        return response.status(405).send("Only POST requests are accepted");
    }
    if (!request.body && request.body.payload) {
        return response.status(401).send("Bad formatted action response");
    }
    const action = JSON.parse(request.body.payload);
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
        const time = util_1.Util.currentTimeStamp();
        const refKey = yield workRef.push({
            user: action.user.id,
            log: EN_WORK_TYPE.WORK,
            time: time,
        });
        yield userRef.child(`${util_1.Util.currentDate()}`).push({ refKey: refKey.key, time, type: EN_WORK_TYPE.WORK });
        return response.contentType("json").status(200).send({
            text: util_1.Util.hiMsg(),
        });
    }
    // 퇴근?
    if (action.actions[0].value === EN_WORK_TYPE.BYEBYE) {
        const time = util_1.Util.currentTimeStamp();
        const refKey = yield workRef.push({
            user: action.user.id,
            log: EN_WORK_TYPE.BYEBYE,
            time: time,
        });
        yield userRef.child(`${util_1.Util.currentDate()}`).push({ refKey: refKey.key, time, type: EN_WORK_TYPE.BYEBYE });
        return response.contentType("json").status(200).send({
            text: util_1.Util.byeMsg(),
        });
    }
    // 휴식
    if (action.actions[0].value === EN_WORK_TYPE.REST) {
        const time = util_1.Util.currentTimeStamp();
        const refKey = yield workRef.push({
            user: action.user.id,
            log: EN_WORK_TYPE.REST,
            time: time,
        });
        yield userRef.child(`${util_1.Util.currentDate()}`).push({ refKey: refKey.key, time, type: EN_WORK_TYPE.REST });
        return response.contentType("json").status(200).send({
            text: `휴식 ${util_1.Util.dateTimeShort()}`,
        });
    }
    // 완료
    if (action.actions[0].value === EN_WORK_TYPE.DONE) {
        const time = util_1.Util.currentTimeStamp();
        const logDatas = yield userRef.child(`${util_1.Util.currentDate()}`).once("value").then(snap => {
            const childData = snap.val();
            const filter = Object.keys(childData)
                .reduce((acc, key) => {
                const fv = childData[key];
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
        const duration = util_1.Util.getBetweenDuration(updateData.time, time).toObject();
        const durationStr = Object.keys(duration).map((key) => `${duration[key]} ${key}`).join(' ');
        const msg = `${EN_WORK_TITLE_KR[updateData.type]} 완료 (소요: ${durationStr})`;
        updateData.done = time;
        userRef.child(`${util_1.Util.currentDate()}`).child(updateData.key).set(updateData);
        return response.contentType("json").status(200).send({
            text: msg,
        });
    }
    return response.contentType("json").status(200).send('완료');
}));
//# sourceMappingURL=index.js.map
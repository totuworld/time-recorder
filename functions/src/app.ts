import * as bodyParser from 'body-parser';
// express로 사용되는 app
import express from 'express';

import { addDatas, addUser } from './addUsers';
import { addBeverage, findAllBeverage } from './controller/beverage/beverage';
import {
  addEvent,
  addGuests,
  addOrder,
  deleteOrder,
  findAllEvent,
  findEvent,
  findGuests,
  findOrders,
  sendMsgToGuests,
  updateEvent
} from './controller/event/event';
import {
  addMemberToGroup,
  deleteMemberToGroup
} from './controller/groups/groups';
import {
  addRCEvent,
  addRCGuests,
  checkUserRegister,
  findAllRCEvent,
  findRCEvent,
  findRCGuests,
  removeRCGuest,
  updateRCEvent
} from './controller/random_coffee/random_coffee';
import {
  addFuseToVacation,
  addFuseWorkLog,
  addUserQueue,
  addWorkLog,
  commandHistory,
  commandPing,
  deleteOverWorkTime,
  deleteUserQueue,
  deleteWorkLog,
  findAllFuseOverTime,
  findAllFuseOverTimeByUserId,
  findAllFuseToVacationByUserId,
  findAllOverTime,
  findAllOverTimeByUserId,
  findWeekOverTimeByUserId,
  getAll,
  getAllGroupInfo,
  getAllSlackUserInfo,
  getGroups,
  getHolidays,
  getUser,
  getUserQueue,
  modify,
  newMsgAction,
  storeOverWorkTime,
  updateAllUsersOverWorkTime,
  updateAllUsersOverWorkTimeTodayWorkker,
  updateUserOverWorkTime,
  useFuseToVacation
} from './functions';
import { SlackSlashCommand } from './models/interface/SlackSlashCommand';
import { Users } from './models/Users';
import { Util } from './util';

const app = express();
app.disable('x-powered-by');
function routeList() {
  const router = express.Router();
  router.post('/command_ping', commandPing);
  router.post('/work_log', addWorkLog);
  router.delete('/work_log', deleteWorkLog);
  router.post('/command_history', commandHistory);
  router.all('/return_log', (req, res) => {
    const command = req.body as SlackSlashCommand;
    const today = Util.currentDateWithFormat('yyyy-LL-dd');
    res
      .contentType('json')
      .status(200)
      .send({
        text: `아래 링크에서 확인하세요 :) \n http://http://cx-joy-work-log-web.gzksfuh6tj.ap-northeast-2.elasticbeanstalk.com/records/${command.user_id}?startDate=${today}&endDate=${today}`
      });
  });
  router.get('/get_all', getAll);
  router.get('/get_groups', getGroups); // 그룹 안에 멤버를 반환
  router.get('/get_group_infos', getAllGroupInfo); // 그룹의 정보를 조회
  router.get('/get_user', getUser);
  router.post('/message_action', newMsgAction);
  router.post('/update_record', modify);
  router.post('/add_login_user', async (req, res) => {
    const userUid = req.body['userUid'];
    const email = req.body['email'];
    if (!!userUid === false || !!email === false) {
      return res.status(400);
    }
    const addResult = await Users.addLoginUser({ userUid, email });
    return res.send({ ...addResult });
  });
  router.get('/login_user/:user_uid', async (req, res) => {
    const userUid = req.params['user_uid'];
    if (!!userUid === false) {
      return res.status(404);
    }
    const findLoginUser = await Users.findLoginUser({ userUid });
    return res.send({ ...findLoginUser });
  });
  router.post('/over_work', storeOverWorkTime);
  router.post('/over_works/sync', updateAllUsersOverWorkTime); // 전체 사용자의 추가근무를 기록
  router.post(
    '/over_works/sync_for_workers',
    updateAllUsersOverWorkTimeTodayWorkker
  ); // 출근 기록을 보유한 전체 사용자 추가 근무 기록 생성

  router.delete('/over_work', deleteOverWorkTime); // 추가 근무 기록 삭제

  router.post('/over_work/sync', updateUserOverWorkTime); // 특정 사용자의 추가근무 기록
  router.get('/over_works', findAllOverTime); // 누적된 추가근무시간 목록
  router.get('/over_work/:target_date', findWeekOverTimeByUserId); // 특정 주의 추가 근무 조회
  router.get('/fuse_over_works', findAllFuseOverTime); // 차감한 추가근무 시간 목록
  router.get('/over_works_by_user_id', findAllOverTimeByUserId); // 누적된 추가근무시간 목록
  router.get('/fuse_over_works_by_user_id', findAllFuseOverTimeByUserId); // 차감한 추가근무 시간 목록
  router.post('/fuse_over_work', addFuseWorkLog);
  router.get('/holidays', getHolidays);
  router.get('/get_user/:authId/queue', getUserQueue);
  router.post('/get_user/:userId/queue', addUserQueue);
  router.delete('/get_user/:authId/queue/:key', deleteUserQueue);
  router.get('/slack_users', getAllSlackUserInfo);
  router.get('/yotest', addDatas);
  router.post('/here_comes_new/:user_slack_id', addUser);

  router.post('/fuse_over_work_to_vacation', addFuseToVacation); // 차감 시간을 휴가로 바꿔서 저장
  router.get(
    '/fuse_over_work_to_vacations/:user_id',
    findAllFuseToVacationByUserId
  );
  router.post('/use_fuse_over_work_to_vacation', useFuseToVacation);

  router.post('/groups/:groupId/:userId', addMemberToGroup);
  router.delete('/groups/:groupId/:userId', deleteMemberToGroup);

  router.get('/events', findAllEvent);
  router.post('/events', addEvent);
  router.put('/events/:eventId', updateEvent);
  router.get('/events/:eventId', findEvent);
  router.post('/events/:eventId/guests', addGuests);
  router.get('/events/:eventId/guests', findGuests);
  router.post('/events/:eventId/guests/msg', sendMsgToGuests);
  router.post('/events/:eventId/orders', addOrder);
  router.delete('/events/:eventId/orders/:guestId', deleteOrder);
  router.get('/events/:eventId/orders', findOrders);

  router.post('/beverages', addBeverage);
  router.get('/beverages', findAllBeverage);

  router.get('/random_coffee', findAllRCEvent);
  router.get('/random_coffee/:eventId', findRCEvent);
  router.post('/random_coffee', addRCEvent);
  router.put('/random_coffee/:eventId', updateRCEvent);
  router.post('/random_coffee/:eventId/guests', addRCGuests);
  router.get('/random_coffee/:eventId/guests', findRCGuests);
  router.get(
    '/random_coffee/:eventId/guests/:docId/check_register',
    checkUserRegister
  );
  router.delete('/random_coffee/:eventId/guests/:docId', removeRCGuest);
  return router;
}
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());
const getRouteList = routeList();
app.use(getRouteList);
export default app;

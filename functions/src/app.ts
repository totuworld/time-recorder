import * as bodyParser from 'body-parser';
// express로 사용되는 app
import express from 'express';

import { addDatas } from './addUsers';
import {
  addFuseWorkLog,
  addUserQueue,
  addWorkLog,
  commandHistory,
  commandPing,
  deleteUserQueue,
  deleteWorkLog,
  findAllFuseOverTime,
  findAllFuseOverTimeByUserId,
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
  messageAction,
  modify,
  storeOverWorkTime,
  updateAllUsersOverWorkTime,
  updateAllUsersOverWorkTimeTodayWorkker,
  updateUserOverWorkTime
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
        text: `아래 링크에서 확인하세요 :) \n http://http://cx-joy-work-log-web.gzksfuh6tj.ap-northeast-2.elasticbeanstalk.com/records/${
          command.user_id
        }?startDate=${today}&endDate=${today}`
      });
  });
  router.get('/get_all', getAll);
  router.get('/get_groups', getGroups);
  router.get('/get_group_infos', getAllGroupInfo);
  router.get('/get_user', getUser);
  router.post('/message_action', messageAction);
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
  return router;
}
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());
const getRouteList = routeList();
app.use(getRouteList);
export default app;

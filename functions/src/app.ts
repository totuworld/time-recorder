import * as bodyParser from 'body-parser';
// express로 사용되는 app
import express from 'express';

import {
    commandHistory, commandPing, getAll, getGroups, getUser, messageAction, modify, addWorkLog
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
  router.post('/command_history', commandHistory);
  router.all('/return_log', (req, res) => {
    const command = req.body as SlackSlashCommand;
    const today = Util.currentDateWithFormat('yyyy-LL-dd');
    res
      .contentType("json")
      .status(200)
      .send({
        text: `아래 링크에서 확인하세요 :) \n http://http://cx-joy-work-log-web.gzksfuh6tj.ap-northeast-2.elasticbeanstalk.com/records/${command.user_id}?startDate=${today}&endDate=${today}`,
      });
  });
  router.get('/get_all', getAll);
  router.get('/get_groups', getGroups);
  router.get('/get_user', getUser);
  router.post('/message_action', messageAction);
  router.post('/update_record', modify);
  router.post('/add_login_user', async (req, res) => {
    const userUid = req.body['userUid'];
    const email = req.body['email'];
    if (!!userUid === false || !!email === false) {
      return res.status(400);
    }
    const addResult = await Users.addLoginUser({userUid, email});
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
  return router;
}

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

const getRouteList = routeList();
app.use(getRouteList);

export default app;
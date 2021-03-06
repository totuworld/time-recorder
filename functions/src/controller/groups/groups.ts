import debug from 'debug';
import { Request, Response } from 'express';

import { addUserByUserEmailID, addUserByUserID } from '../../addUsers';
import { Groups } from '../../models/Groups';
import { Users } from '../../models/Users';
import { Util } from '../../services/util';
import { IAddMemberToGroupReq } from './interface/IAddMemberToGroupReq';
import { JSCAddMemberToGroupReq } from './jsc/JSCAddMemberToGroupReq';

const log = debug('tr:groupsController');

export async function addMemberToGroup(req: Request, res: Response) {
  const validateReq = Util.validateParamWithData<IAddMemberToGroupReq>(
    {
      params: req.params
    },
    JSCAddMemberToGroupReq
  );
  if (validateReq.result === false) {
    return res
      .contentType('json')
      .status(400)
      .send({
        text: validateReq.errorMessage
      });
  }
  try {
    const userInfo = await Users.find({
      userId: validateReq.data.params.userId
    });
    let user_slack_id = validateReq.data.params.userId;
    if (!!userInfo === false) {
      const slackIdPtn = /^U[A-Z0-9]+/gi;
      // slack id를 직접 입력한 경우
      if (slackIdPtn.test(validateReq.data.params.userId)) {
        const addUser = await addUserByUserID(validateReq.data.params.userId);
        if (addUser === false) {
          return res.status(404).send(false);
        }
      } else {
        const email = /@yanolja.com/.test(validateReq.data.params.userId)
          ? validateReq.data.params.userId
          : `${validateReq.data.params.userId}@yanolja.com`;
        const addUserByEmail = await addUserByUserEmailID(email);
        if (addUserByEmail.result === false) {
          return res.status(404).send(false);
        }
        if (addUserByEmail.id) {
          user_slack_id = addUserByEmail.id;
        }
      }
    }
    const result = await Groups.addMemberToGroup({
      group_id: validateReq.data.params.groupId,
      user_id: user_slack_id
    });
    log('addMemberToGroup result: ', result);
    return res.status(200).send(result);
  } catch (err) {
    return res.status(500).send(err.toString());
  }
}

export async function deleteMemberToGroup(req: Request, res: Response) {
  const validateReq = Util.validateParamWithData<IAddMemberToGroupReq>(
    {
      params: req.params
    },
    JSCAddMemberToGroupReq
  );
  if (validateReq.result === false) {
    return res
      .contentType('json')
      .status(400)
      .send({
        text: validateReq.errorMessage
      });
  }
  try {
    const result = await Groups.deleteMemberToGroup({
      group_id: validateReq.data.params.groupId,
      user_id: validateReq.data.params.userId
    });
    log('deleteMemberToGroup result: ', result);
    return res.status(200).send(result);
  } catch (err) {
    return res.status(500).send(err.toString());
  }
}

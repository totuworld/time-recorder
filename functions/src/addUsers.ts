import axios from 'axios';
import { Request, Response } from 'express';

import { Users } from './models/Users';
import { FireabaseAdmin } from './services/FirebaseAdmin';
import { WebClient } from '@slack/client';
import { ISlackUser } from './models/interface/SlackSlashCommand';

const SLACK_TOKEN = process.env.SLACK_TOKEN || 'slack_token';
const client = new WebClient(SLACK_TOKEN);

export async function addDatas(req: Request, res: Response) {
  const resp = await axios.get(
    `https://slack.com/api/users.list?token=${SLACK_TOKEN}&pretty=1`
  );
  console.log(resp.status, resp.data.members.length);
  const filterdUsers = resp.data.members.filter(
    fv =>
      fv.is_bot === false &&
      fv.deleted === false &&
      !!fv.profile.email &&
      /yanolja\.com/g.test(fv.profile.email)
  );
  const allLoginUsers = await Users.findAllLoginUser();
  const ref = FireabaseAdmin.Firestore.collection('slack_users');
  const promises = filterdUsers.map(async mv => {
    const findLoginUserInfo = allLoginUsers.find(fv => fv.id === mv.id);
    const setValue = {
      id: mv.id,
      email: mv.profile.email,
      name: mv.name,
      real_name: mv.real_name,
      profile_url: mv.profile.image_72
    };
    if (!!findLoginUserInfo) {
      setValue['auth_id'] = findLoginUserInfo.auth_id;
    }
    return await ref.doc(mv.id).set(setValue);
  });
  const refRdb = FireabaseAdmin.Database.ref('users');
  const rdb_promises = filterdUsers.map(async mv => {
    return refRdb.child(mv.id).set({
      id: mv.id,
      email: mv.profile.email,
      name: mv.name,
      real_name: mv.real_name,
      profile_url: mv.profile.image_72
    });
  });
  const total = [...promises, ...rdb_promises];
  while (total.length > 0) {
    const promiseFunc = total.pop();
    await promiseFunc;
  }
  // 사용자 리스트 cache 업데이트
  await Users.refreshUserList();
  res.send();
}
export async function addUserToRealTime(req: Request, res: Response) {
  const resp = await axios.get(
    `https://slack.com/api/users.list?token=${SLACK_TOKEN}&pretty=1`
  );
  console.log(resp.status, resp.data.members.length);
  const filterdUsers = resp.data.members.filter(
    fv =>
      fv.is_bot === false &&
      fv.deleted === false &&
      !!fv.profile.email &&
      /yanolja\.com/g.test(fv.profile.email)
  );
  const ref = FireabaseAdmin.Database.ref('users');
  const promises = filterdUsers.map(async mv => {
    console.log(mv.id);
    return ref.child(mv.id).set({
      id: mv.id,
      email: mv.profile.email,
      name: mv.name,
      real_name: mv.real_name,
      profile_url: mv.profile.image_72
    });
  });
  while (promises.length > 0) {
    const promiseFunc = promises.pop();
    await promiseFunc;
  }
  res.send();
}

export async function addUser(req: Request, res: Response) {
  // 사용자 조회
  const id: string = req.params.user_slack_id;
  const info = await addUserByUserID(id);
  if (info) {
    return res.send();
  }
  return res.status(404).send();
}

export async function addUserByUserID(user_id: string) {
  const info = await client.users.info({ user: user_id });
  if (info.ok) {
    const user: ISlackUser = info.user as ISlackUser;
    const refRdb = FireabaseAdmin.Database.ref('users');
    await refRdb.child(user.id).set({
      id: user.id,
      email: user.profile.email,
      name: user.name,
      real_name: user.real_name,
      profile_url: user.profile.image_72
    });
    return true;
  }
  return false;
}

import { Request, Response } from 'express';
import axios from 'axios';
import { FireabaseAdmin } from './services/FirebaseAdmin';

const SLACK_TOKEN = process.env.SLACK_TOKEN || 'slack_token';

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
  const ref = FireabaseAdmin.Firestore.collection('slack_users');
  const promises = filterdUsers.map(async mv => {
    console.log(mv.id);
    return await ref.doc(mv.id).set({
      id: mv.id,
      email: mv.profile.email,
      name: mv.name,
      real_name: mv.real_name,
      profile_url: mv.profile.image_72
    });
  });
  const refRdb = FireabaseAdmin.Database.ref('users');
  const rdb_promises = filterdUsers.map(async mv => {
    console.log(mv.id);
    return await refRdb.child(mv.id).set({
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
    return await ref.child(mv.id).set({
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

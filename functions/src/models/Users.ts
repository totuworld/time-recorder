// import debug from "debug";
import * as luxon from 'luxon';

import { WebClient } from '@slack/client';

import { FireabaseAdmin } from '../services/FirebaseAdmin';
import { IGroupInfo } from './interface/IGroupInfo';
import {
  ILoginUserInfo,
  ISlackUserInfo,
  IUserInfo,
  IUsers
} from './interface/IUsers';
import { ISlackUser } from './interface/SlackSlashCommand';

// const log = debug("tr:Users");

const SLACK_TOKEN = process.env.SLACK_TOKEN || 'slack_token';
const client = new WebClient(SLACK_TOKEN);

export class UsersType {
  private userList: ISlackUserInfo[];
  constructor() {
    if (FireabaseAdmin.isInit === false) {
      FireabaseAdmin.bootstrap();
    }
    this.userList = [];
  }
  /** groups root store */
  get GroupRoot() {
    const rootRef = FireabaseAdmin.Database.ref('groups');
    return rootRef;
  }
  get GroupInfoRoot() {
    const rootRef = FireabaseAdmin.Database.ref('group_infos');
    return rootRef;
  }
  /** 모든 워크로그 기록 */
  get UsersRoot() {
    const rootRef = FireabaseAdmin.Database.ref('users');
    return rootRef;
  }
  get LoginUsersRoot() {
    const rootRef = FireabaseAdmin.Database.ref('login_users');
    return rootRef;
  }
  get UsersStore() {
    const ref = FireabaseAdmin.Firestore.collection('users');
    return ref;
  }
  get SlackUsersStore() {
    const ref = FireabaseAdmin.Firestore.collection('slack_users');
    return ref;
  }
  async groupMemberList({ groupId }: { groupId: string }) {
    const groups = this.GroupRoot.child(groupId);
    const snap = await groups.once('value');
    const childDatas = snap.val() as IUsers;
    if (!!childDatas === false) {
      return null;
    }
    return childDatas;
  }
  /** 사용자 정보 */
  UserInfoRef(userId: string) {
    return this.UsersRoot.child(userId);
  }
  UserStoreQueueRef(authId: string) {
    return this.UsersStore.doc(authId).collection('queue');
  }
  async find({ userId }: { userId: string }) {
    const user = this.UserInfoRef(userId);
    const snap = await user.once('value');
    const childData = snap.val() as IUserInfo;
    return childData;
  }

  async findAllInGroup({ groupId }: { groupId: string }) {
    const memberList = await this.groupMemberList({ groupId });
    if (!!memberList === false) {
      return [];
    }
    const memberIds = Object.keys(memberList);
    const promises = memberIds.map(mv => {
      return this.find({ userId: mv });
    });
    const userInfos = await Promise.all(promises);
    const memberUserInfos = Object.values(memberList);
    return userInfos.map(info => {
      const memberInfo = memberUserInfos.find(fv => fv.id === info.id);
      return { ...info, ...memberInfo };
    });
  }

  async findAllInGroupLoginUsers({ groupId }: { groupId: string }) {
    const memberList = await this.groupMemberList({ groupId });
    if (!!memberList === false) {
      return [];
    }
    const memberIds = Object.keys(memberList);
    const loginMemberList = await this.findAllLoginUser();
    const slackUserInfos = memberIds
      .map(mv => {
        const idx = loginMemberList.findIndex(fv => fv.id === mv);
        if (idx > -1) {
          return loginMemberList[idx];
        }
        return null;
      })
      .filter(fv => fv !== null);
    return slackUserInfos;
  }

  async findAllGroupInfo() {
    const groupInfoRef = this.GroupInfoRoot;
    const snap = await groupInfoRef.once('value');
    const groupInfo = snap.val() as { [key: string]: IGroupInfo };
    if (!!groupInfo) {
      return Object.keys(groupInfo).map(mv => groupInfo[mv]);
    }
    return [];
  }
  async addLoginUser({ userUid, email }: { userUid: string; email: string }) {
    const list = await client.users.list();
    // 사용자가 찾아졌나?
    if (list.ok) {
      const members: ISlackUser[] = list.members as ISlackUser[];
      const findUser = members.find(u => u.profile.email === email);
      if (findUser) {
        const user: ISlackUser = findUser;
        const loginUserRef = this.LoginUsersRoot.child(userUid);
        const snap = await loginUserRef.once('value');
        const updateValue = snap.val() as ILoginUserInfo;
        if (!!updateValue === false) {
          await loginUserRef.set({
            email,
            id: user.id
          });
        } else {
          await loginUserRef.update({
            email,
            id: user.id
          });
        }

        // 정보 저장
        await this.UsersRoot.child(user.id).set({
          userUid,
          id: user.id,
          email: user.profile.email,
          name: user.name,
          real_name: user.real_name,
          profile_url: user.profile.image_72
        });

        return {
          result: true,
          userKey: user.id
        };
      }
    }
    return {
      result: false,
      userKey: null
    };
  }
  async findLoginUser({ userUid }: { userUid: string }) {
    const loginUserRef = this.LoginUsersRoot.child(userUid);
    const snap = await loginUserRef.once('value');
    const findUser = snap.val() as ILoginUserInfo;
    if (!!findUser) {
      return {
        result: true,
        data: { ...findUser }
      };
    }
    return {
      result: false,
      data: null
    };
  }
  async findAllLoginUser() {
    const loginUserRef = this.LoginUsersRoot;
    const snap = await loginUserRef.once('value');
    const findUsers = snap.val() as { [key: string]: ISlackUserInfo };
    if (!!findUsers === false) {
      return [];
    }
    const returnValue: ISlackUserInfo[] = Object.keys(findUsers).map(key => {
      return {
        auth_id: key,
        ...findUsers[key]
      };
    });
    return returnValue;
  }
  async findLoginUserWithAuthUserId(auth_user_id: string) {
    const loginUserRef = this.LoginUsersRoot;
    const snap = await loginUserRef.child(auth_user_id).once('value');
    const findUser = snap.val() as ILoginUserInfo;
    if (!!findUser === false) {
      return null;
    }
    return {
      auth_id: auth_user_id,
      ...findUser
    };
  }
  async getSlackUserInfo({ userId }: { userId: string }) {
    const userInfoSnap = await this.SlackUsersStore.doc(userId).get();
    return userInfoSnap.data() as ISlackUserInfo;
  }
  async findAllSlackUserInfo() {
    // 캐시되는 정보가 있으면 이를 사용한다.
    if (this.userList.length > 0) {
      return this.userList;
    }
    return await this.refreshUserList();
  }

  async refreshUserList() {
    const searchSnap = await this.SlackUsersStore.get();
    const userInfos = searchSnap.docs.map(doc => {
      return doc.data() as ISlackUserInfo;
    });
    this.userList = userInfos;
    return this.userList;
  }

  async findUserQueue({ userUid }: { userUid: string }) {
    const queueRef = this.UserStoreQueueRef(userUid);
    const allQueueSnap = await queueRef.get();
    const datas: FirebaseFirestore.DocumentData = allQueueSnap.docs.map(mv => {
      const returnData = {
        ...mv.data(),
        id: mv.id
      };
      return returnData;
    });
    return datas;
  }
  async addUserQueue({
    userUid,
    userInfo
  }: {
    userUid: string;
    userInfo: IUserInfo;
  }) {
    const queueRef = this.UserStoreQueueRef(userUid);
    await queueRef.add({
      slack_id: userInfo.id,
      real_name: userInfo.real_name,
      created: luxon.DateTime.local().toJSDate()
    });
  }
  async deleteUserQueue({ userUid, key }: { userUid: string; key: string }) {
    const queueRef = this.UserStoreQueueRef(userUid);
    await queueRef.doc(key).delete();
  }
}
export const Users = new UsersType();

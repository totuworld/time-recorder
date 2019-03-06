// import debug from "debug";
import * as luxon from 'luxon';
import { FireabaseAdmin } from '../services/FirebaseAdmin';
import { IGroupInfo } from './interface/IGroupInfo';
import {
  ILoginUserInfo,
  ISlackUserInfo,
  IUserInfo,
  IUsers
} from './interface/IUsers';
// const log = debug("tr:Users");
export class UsersType {
  constructor() {
    if (FireabaseAdmin.isInit === false) {
      FireabaseAdmin.bootstrap();
    }
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
    const userInfos = Promise.all(promises);
    return userInfos;
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
    // 전체 사용자 목록 조회.
    const users = await this.UsersRoot.once('value');
    const childData = users.val() as { [key: string]: IUserInfo };
    // 사용자 정보가 있는지 확인.
    let findUser: IUserInfo | null = null;
    Object.keys(childData).forEach((key: string) => {
      const fv = childData[key];
      if (fv.email === email) {
        findUser = fv;
      }
    });
    // 사용자가 찾아졌나?
    if (!!findUser) {
      const loginUserRef = this.LoginUsersRoot.child(userUid);
      const snap = await loginUserRef.once('value');
      const updateValue = snap.val() as ILoginUserInfo;
      if (!!updateValue === false) {
        await loginUserRef.set({
          email,
          id: findUser.id
        });
      } else {
        await loginUserRef.update({
          email,
          id: findUser.id
        });
      }
      return {
        result: true,
        userKey: findUser.id
      };
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
    const findUsers = snap.val() as { [key: string]: ILoginUserInfo };
    if (!!findUsers === false) {
      return [];
    }
    const returnValue = Object.keys(findUsers).map(key => {
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
    const searchSnap = await this.SlackUsersStore.get();
    const userInfos = searchSnap.docs
      .map(doc => {
        return doc.data() as ISlackUserInfo;
      })
      .filter(fv => !!fv.auth_id === true);
    return userInfos;
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

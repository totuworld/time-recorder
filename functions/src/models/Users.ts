import debug from 'debug';

import { FireabaseAdmin } from "../services/FirebaseAdmin";
import { IUsers, IUserInfo, ILoginUserInfo } from "./interface/IUsers";

const log = debug('tr:Users');

export class UsersType {
  constructor() {
    if (FireabaseAdmin.isInit === false) {
      FireabaseAdmin.bootstrap();
    }
  }

    /** groups root store */
    get GroupRoot() {
      const rootRef = FireabaseAdmin.Database.ref("groups");
      return rootRef;
    }
    /** 모든 워크로그 기록 */
    get UsersRoot() {
      const rootRef = FireabaseAdmin.Database.ref("users");
      return rootRef;
    }
    get LoginUsersRoot() {
      const rootRef = FireabaseAdmin.Database.ref("login_users");
      return rootRef;
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

    async find({ userId }: { userId: string }) {
      const user = this.UserInfoRef(userId);
      const snap = await user.once('value');
      const childData = snap.val() as IUserInfo;;
      return childData;
    }
  
    async findAllInGroup({ groupId }: { groupId: string }) {
      const memberList = await this.groupMemberList({groupId});
      if (!!memberList === false)  {
        return [];
      }
      const memberIds = Object.keys(memberList);
      const promises = memberIds.map((mv) => {
        return this.find({userId: mv});
      });
      const userInfos = Promise.all(promises);
      return userInfos;
    }

    async addLoginUser({ userUid, email }: { userUid: string, email: string }) {
      // 전체 사용자 목록 조회.
      const users = await this.UsersRoot.once('value');
      const childData = users.val() as { [key:string]: IUserInfo };

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
        const snap = await loginUserRef.once("value");
        const updateValue = snap.val() as ILoginUserInfo;
        if (!!updateValue === false) {
          await loginUserRef.set({
            email,
            id: findUser.id,
          });
        } else {
          await loginUserRef.update({
            email,
            id: findUser.id,
          });
        }
        return {
          result: true,
          userKey: findUser.id,
        };
      }
      return {
        result: false,
        userKey: null,
      }
    }

    async findLoginUser({ userUid }: { userUid: string }) {
      const loginUserRef = this.LoginUsersRoot.child(userUid);
      const snap = await loginUserRef.once('value');
      const findUser = snap.val() as ILoginUserInfo;
      if (!!findUser) {
        return {
          result: true,
          data: {...findUser},
        };
      }
      return {
        result: false,
        data: null,
      }
    }

    async findAllLoginUser() {
      const loginUserRef = this.LoginUsersRoot;
      const snap = await loginUserRef.once('value');
      const findUsers = snap.val() as { [key:string]:ILoginUserInfo };
      if (!!findUsers === false) {
        return [];
      }
      const returnValue = Object.keys(findUsers).map((key) => {
        return {
          auth_id: key,
          ...findUsers[key],
        }
      });
      return returnValue;
    }
}

export const Users = new UsersType();
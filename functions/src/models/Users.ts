import { FireabaseAdmin } from "../services/FirebaseAdmin";
import { IUsers, IUserInfo } from "./interface/IUsers";

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
}

export const Users = new UsersType();
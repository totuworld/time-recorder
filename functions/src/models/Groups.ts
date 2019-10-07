import debug from 'debug';

import { FireabaseAdmin } from '../services/FirebaseAdmin';
import { Util } from '../util';
import { IGroupInfo } from './interface/IGroupInfo';
import { IUsers } from './interface/IUsers';
import { Users } from './Users';

const log = debug('tr:Groups');
class GroupType {
  constructor() {
    if (FireabaseAdmin.isInit === false) {
      FireabaseAdmin.bootstrap();
    }
  }
  get GroupRoot() {
    const rootRef = FireabaseAdmin.Database.ref('groups');
    return rootRef;
  }
  get GroupInfoRoot() {
    const rootRef = FireabaseAdmin.Database.ref('group_infos');
    return rootRef;
  }
  async findInfo(args: { group_id: string }) {
    const groupInfoRef = this.GroupInfoRoot.child(args.group_id);
    try {
      const snap = await groupInfoRef.once('value');
      const groupInfo = snap.val() as IGroupInfo;
      if (!!groupInfo) {
        return groupInfo;
      }
      return null;
    } catch (err) {
      return null;
    }
  }
  async findAllInfos() {
    const groupInfoRef = this.GroupInfoRoot;
    const snap = await groupInfoRef.once('value');
    const groupInfo = snap.val() as { [key: string]: IGroupInfo };
    if (!!groupInfo) {
      return Object.keys(groupInfo).map(mv => groupInfo[mv]);
    }
    return [];
  }

  async findGroupMembersWithProfile({ groupId }: { groupId: string }) {
    const memberList = await this.findGroupMemberList({ groupId });
    if (!!memberList === false) {
      return [];
    }
    const memberIds = Object.keys(memberList);
    const promises = memberIds.map(mv => {
      return Users.find({ userId: mv });
    });
    const userInfos = Promise.all(promises);
    return userInfos;
  }

  async findGroupMemberList({ groupId }: { groupId: string }) {
    const groups = this.GroupRoot.child(groupId);
    const snap = await groups.once('value');
    const childDatas = snap.val() as IUsers;
    if (!!childDatas === false) {
      return null;
    }
    return childDatas;
  }

  async findGroupMemberListArr({ groupId }: { groupId: string }) {
    const result = await this.findGroupMemberList({ groupId });
    return Object.values(result);
  }

  /** 그룹에 멤버 추가 */
  async addMemberToGroup(args: { user_id: string; group_id: string }) {
    try {
      const { user_id, group_id } = args;
      // 사용자와 그룹 찾기
      const [groupInfo, userInfo] = await Promise.all([
        this.findInfo({ group_id }),
        Users.find({ userId: user_id })
      ]);
      log(group_id, groupInfo, userInfo);
      if (Util.isEmpty(groupInfo) || Util.isEmpty(userInfo)) {
        return false;
      }
      // 사용자 추가함
      const groupMemberListRef = this.GroupRoot.child(group_id).child(user_id);
      await groupMemberListRef.set({
        id: user_id,
        name: userInfo.name,
        real_name: userInfo.real_name
      });
      return true;
    } catch (err) {
      return false;
    }
  }

  /** 그룹에 멤버 추가 */
  async deleteMemberToGroup(args: { user_id: string; group_id: string }) {
    try {
      const { user_id, group_id } = args;
      // 사용자와 그룹 찾기
      const [groupInfo] = await Promise.all([this.findInfo({ group_id })]);
      if (Util.isEmpty(groupInfo)) {
        return false;
      }
      // 사용자 삭제
      const memberOnGroupRef = this.GroupRoot.child(group_id).child(user_id);
      await memberOnGroupRef.remove();
      return true;
    } catch (err) {
      return false;
    }
  }
}

export const Groups = new GroupType();

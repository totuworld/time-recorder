import { IUsersItem } from './IUsers';

export interface IRCEvent extends IAddRCEvent {
  /** event id */
  id: string;
  /** 완성된 매치 목록 */
  match?: IUsersItem[][];
}

export interface IAddRCEvent {
  /** 이름 */
  title: string;
  /** 간단한 설명 */
  desc: string;
  /** 공개 여부 */
  private: boolean;
  /** 마지막 등록가능 시간 */
  last_register: Date;
  /** owner id */
  owner_id: string;
  /** owner의 display name */
  owner_name: string;
  /** 마감 여부 */
  closed: boolean;
}

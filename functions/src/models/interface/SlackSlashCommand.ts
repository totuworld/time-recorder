import * as luxon from 'luxon';
import { EN_WORK_TYPE } from '../../contants/enum/EN_WORK_TYPE';

export interface SlackSlashCommand {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  response_url: string;
}

export interface SlackAction {
  name: string;
  type: string;
  value: string;
}

export interface SlackActionInvocation {
  actions: SlackAction[];
  callback_id: string;
  team: { id: string; domain: string };
  channel: { id: string; name: string };
  user: { id: string; name: string };
  action_ts: string;
  message_ts: string;
  attachment_id: string;
  token: string;
  is_app_unfurl: boolean;
  response_url: string;
  original_message: {
    text: string;
    bot_id: string;
    attachments?: any;
    type: string;
    subtype: string;
    ts: string;
  };
}

export interface LogData {
  refKey: string;
  time: string;
  type: EN_WORK_TYPE;
  done?: string;
}

export interface IOverWork {
  week: string;
  /** 해당 기간에 오버해서 일한 시간 */
  over?: luxon.DurationObject;
  /** 사용하고 남은 시간 */
  remain?: luxon.DurationObject;
}

export interface IFuseOverWork {
  /** luxon (yyyyLLdd) */
  date: string;
  /** ISO 8601 duration(PTH4M2) */
  use: string;
}

export interface IFuseToVacation {
  /** 생성 날짜 luxon (yyyyLLdd) */
  created: string;
  /** 만료일자 (ISO 8601) */
  expireDate: string;
  /** 생성 날짜 */
  note: string;
  /** 사용 여부 */
  used: boolean;
  /** read시 반환 */
  key?: string;
  /** 사용한 시간 */
  useTimeStamp?: string;
  /** 해당 휴가를 추가한 날짜 */
  addLogDate?: string;
}

export interface IProfile {
  title: string;
  phone: string;
  skype: string;
  real_name: string;
  real_name_normalized: string;
  display_name: string;
  display_name_normalized: string;
  fields: any[];
  status_text: string;
  status_emoji: string;
  status_expiration: number;
  avatar_hash: string;
  image_original: string;
  email: string;
  first_name: string;
  last_name: string;
  image_24: string;
  image_32: string;
  image_48: string;
  image_72: string;
  image_192: string;
  image_512: string;
  image_1024: string;
  status_text_canonical: string;
  team: string;
  is_custom_image: boolean;
}

export interface ISlackUser {
  id: string;
  team_id: string;
  name: string;
  deleted: boolean;
  color: string;
  real_name: string;
  tz: string;
  tz_label: string;
  tz_offset: number;
  profile: IProfile;
  is_admin: boolean;
  is_owner: boolean;
  is_primary_owner: boolean;
  is_restricted: boolean;
  is_ultra_restricted: boolean;
  is_bot: boolean;
  is_app_user: boolean;
  updated: number;
}

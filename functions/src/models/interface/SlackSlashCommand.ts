import { EN_WORK_TYPE } from "../../contants/enum/EN_WORK_TYPE";

export interface SlackSlashCommand {
  token: string,
  team_id: string,
  team_domain: string,
  channel_id: string,
  channel_name: string,
  user_id: string,
  user_name: string,
  command: string,
  text: string,
  response_url: string
}

export interface SlackAction {
  name: string,
  type: string,
  value: string
}

export interface SlackActionInvocation {
  actions: SlackAction[],
  callback_id: string,
  team: { id: string, domain: string },
  channel: { id: string, name: string },
  user: { id: string, name: string },
  action_ts: string,
  message_ts: string,
  attachment_id: string,
  token: string,
  is_app_unfurl: boolean,
  response_url: string,
  original_message: {
      text: string,
      bot_id: string,
      attachments?: any,
      type: string,
      subtype: string,
      ts: string
  }
}

export interface LogData {
  refKey: string,
  time: string,
  type: EN_WORK_TYPE,
  done?: string,
}
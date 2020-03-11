export interface IUsers {
  [key: string]: IUsersItem;
}

export interface IUsersItem {
  id: string;
  name: string;
  real_name: string;
  /** 매너지 권한이 있는지 확인하는 필드 */
  manager?: boolean;
}

export interface IUserInfo extends IUsersItem {
  profile_url: string;
  email: string;
}

export interface ILoginUserInfo {
  email: string;
  id: string;
  auth: number | null;
}

export interface ISlackUserInfo extends IUserInfo {
  auth_id?: string;
  userUid?: string;
}

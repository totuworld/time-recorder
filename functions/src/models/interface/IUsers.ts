export interface IUsers {
  [key: string]: IUsersItem
}

export interface IUsersItem {
  id: string;
  name: string;
  real_name: string;
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
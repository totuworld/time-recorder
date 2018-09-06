import * as luxon from 'luxon';

/** WorkLog 모델에 요청할 때 전달하는 인터페이스 */
export interface IWorkLogRequest {
  userId: string;
}

export interface IWorkLogFindRequest {
  startDate?: string;
  endDate?: string;
}

export interface IOverWorkFindRequest {
  login_auth_id: string;
  week: string;
}
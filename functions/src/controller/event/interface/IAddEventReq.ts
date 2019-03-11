import { IUsersItem } from '../../../models/interface/IUsers';

export interface IAddEventReq {
  body: {
    title: string;
    owner: IUsersItem;
    desc?: string;
    private?: boolean;
    last_order?: Date;
    closed?: boolean;
  };
}

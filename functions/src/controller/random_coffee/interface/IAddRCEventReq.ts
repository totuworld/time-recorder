import { IUsersItem } from '../../../models/interface/IUsers';

export interface IAddRCEventReq {
  body: {
    title: string;
    owner: IUsersItem;
    last_register: Date;
    desc?: string;
    private?: boolean;
    closed?: boolean;
  };
}

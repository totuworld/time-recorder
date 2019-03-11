import { IUsersItem } from '../../../models/interface/IUsers';

export interface IAddGuestsReq {
  params: {
    eventId: string;
  };
  body: {
    guests: IUsersItem[];
  };
}

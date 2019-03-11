import { IEventOrder } from '../../../models/interface/IEvent';

export interface IAddOrderReq {
  params: {
    eventId: string;
  };
  body: {
    order: IEventOrder;
  };
}

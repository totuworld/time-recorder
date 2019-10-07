export interface IUpdateRCEventReq {
  params: {
    eventId: string;
  };
  body: {
    title?: string;
    desc?: string;
    private?: boolean;
    last_register?: Date;
    closed?: boolean;
  };
}

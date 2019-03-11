export interface IUpdateEventReq {
  params: {
    eventId: string;
  };
  body: {
    title?: string;
    desc?: string;
    private?: boolean;
    last_order?: Date;
    closed?: boolean;
  };
}

import { IJSONSchemaType } from '../../../models/interface/IJSONSchemaType';

export const JSCRemoveOrder: IJSONSchemaType = {
  
  properties: {
    params: {
      properties: {
        eventId: {
          type: 'string'
        },
        guestId: {
          description: '주문자',
          type: 'string'
        },
      },
      required: ['eventId', 'guestId'],
      type: 'object'
    }
  },
  required: ['params'],
  type: 'object'
};

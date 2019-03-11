import { IJSONSchemaType } from '../../../models/interface/IJSONSchemaType';

export const JSCSendMsgToGuests: IJSONSchemaType = {
  properties: {
    params: {
      properties: {
        eventId: {
          type: 'string'
        }
      },
      required: ['eventId']
    },
    query: {
      properties: {
        text: {
          type: 'string'
        }
      },
      required: ['text']
    }
  },
  required: ['params', 'query'],
  type: 'object'
};

import { IJSONSchemaType } from '../../../models/interface/IJSONSchemaType';

export const JSCUpdateEvent: IJSONSchemaType = {
  properties: {
    params: {
      properties: {
        eventId: {
          type: 'string'
        }
      },
      required: ['eventId']
    },
    body: {
      properties: {
        desc: {
          type: 'string'
        },
        last_order: {
          format: 'date-time',
          type: 'string'
        },
        private: {
          type: 'boolean'
        },
        title: {
          type: 'string'
        },
        closed: {
          type: 'boolean'
        }
      },
      type: 'object'
    }
  },
  required: ['params', 'body'],
  type: 'object'
};

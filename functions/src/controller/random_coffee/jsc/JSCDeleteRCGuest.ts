import { IJSONSchemaType } from '../../../models/interface/IJSONSchemaType';

export const JSCDeleteRCGuest: IJSONSchemaType = {
  properties: {
    params: {
      properties: {
        eventId: {
          type: 'string'
        },
        docId: {
          type: 'string'
        }
      },
      required: ['docId']
    }
  },
  required: ['params'],
  type: 'object'
};

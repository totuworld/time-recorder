import { IJSONSchemaType } from '../../../models/interface/IJSONSchemaType';

export const JSCFindEvent: IJSONSchemaType = {
  properties: {
    params: {
      properties: {
        eventId: {
          type: 'string'
        }
      },
      required: ['eventId']
    }
  },
  required: ['params'],
  type: 'object'
};

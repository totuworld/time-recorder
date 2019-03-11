import { IJSONSchemaType } from '../../../models/interface/IJSONSchemaType';

export const JSCAddBeverage: IJSONSchemaType = {
  properties: {
    body: {
      properties: {
        title: {
          type: 'string'
        }
      },
      required: ['title'],
      type: 'object'
    }
  },
  required: ['body'],
  type: 'object'
};

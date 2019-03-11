import { IJSONSchemaType } from '../../../models/interface/IJSONSchemaType';

export const JSCFindAllEvent: IJSONSchemaType = {
  properties: {
    query: {
      properties: {
        page: {
          type: 'number',
          default: 1,
          minimum: 1
        },
        limit: {
          type: 'number',
          default: 10,
          maximum: 30
        }
      }
    }
  }
};

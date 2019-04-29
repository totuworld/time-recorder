import { IJSONSchemaType } from '../../../models/interface/IJSONSchemaType';

export const JSCAddMemberToGroupReq: IJSONSchemaType = {
  properties: {
    params: {
      properties: {
        groupId: {
          type: 'string'
        },
        userId: {
          type: 'string'
        }
      },
      required: ['groupId', 'userId'],
      type: 'object'
    }
  },
  required: ['params'],
  type: 'object'
};

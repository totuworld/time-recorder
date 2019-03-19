import { IJSONSchemaType } from '../../../models/interface/IJSONSchemaType';

export const JSCAddGuests: IJSONSchemaType = {
  definitions: {
    IUsersItem: {
      properties: {
        id: {
          type: 'string'
        },
        name: {
          type: 'string'
        },
        real_name: {
          type: 'string'
        },
        profile_url: {
          type: 'string'
        }
      },
      required: ['id', 'name', 'real_name', 'profile_url'],
      type: 'object'
    }
  },
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
        guests: {
          items: {
            $ref: '#/definitions/IUsersItem'
          },
          type: 'array'
        }
      },
      required: ['guests'],
      type: 'object'
    }
  },
  required: ['params', 'body'],
  type: 'object'
};

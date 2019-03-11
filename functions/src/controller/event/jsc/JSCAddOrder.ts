import { IJSONSchemaType } from '../../../models/interface/IJSONSchemaType';

export const JSCAddOrder: IJSONSchemaType = {
  definitions: {
    IEventOrder: {
      properties: {
        beverage_id: {
          description: '주문 상품',
          type: 'string'
        },
        guest_id: {
          description: '주문자',
          type: 'string'
        },
        option: {
          description: '주문에 관한 추가 요청',
          type: 'string'
        }
      },
      required: ['beverage_id', 'guest_id'],
      type: 'object'
    }
  },
  properties: {
    body: {
      properties: {
        order: { $ref: '#/definitions/IEventOrder' }
      },
      required: ['order'],
      type: 'object'
    },
    params: {
      properties: {
        eventId: {
          type: 'string'
        }
      },
      required: ['eventId'],
      type: 'object'
    }
  },
  required: ['body', 'params'],
  type: 'object'
};

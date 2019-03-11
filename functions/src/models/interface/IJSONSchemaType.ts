export type JSONSchemaSupportType =
  | 'string'
  | 'number'
  | 'integer'
  | 'array'
  | 'object'
  | 'boolean';
export type JSONSchemaSupportDateTypeFormat = 'date-time' | 'date';
export type JSONSchemaSupportFormat =
  | JSONSchemaSupportDateTypeFormat
  | 'email'
  | 'hostname'
  | 'ipv4'
  | 'ipv6'
  | 'uri';

export interface IJSONSchemaType {
  properties?: {
    [key: string]: IJSONSchemaType;
  };
  definitions?: {
    [key: string]: IJSONSchemaType;
  };
  $ref?: string;
  title?: string;
  description?: string;
  default?: any;
  type?: JSONSchemaSupportType;
  required?: Array<string | IJSONSchemaType>;
  format?: JSONSchemaSupportFormat;
  pattern?: string;
  /** 문자열의 최소 길이 */
  minLength?: number;
  /** 문자열의 최대 길이 */
  maxLength?: number;
  /** number 의 최소 */
  minimum?: number;
  exclusiveMinimum?: number;
  /** number 의 최대 */
  maximum?: number;
  exclusiveMaximum?: number;
  /** type이 array 일 경우 최소 아이템 갯수 */
  minItems?: number;
  /** type이 array 일 경우 최대 아이템 갯수 */
  maxItems?: number;
  items?: IJSONSchemaType | IJSONSchemaType[];
  enum?: IJSONSchemaType | Array<IJSONSchemaType | string | number>;
  oneOf?: IJSONSchemaType[];
  anyOf?: IJSONSchemaType[];
  allOf?: IJSONSchemaType[];
}

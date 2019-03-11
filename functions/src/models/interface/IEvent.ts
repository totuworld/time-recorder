export interface IEvent {
  /** event id */
  id: string;
  /** 이름 */
  title: string;
  /** 간단한 설명 */
  desc: string;
  /** 공개 여부 */
  private: boolean;
  /** 마지막 주문이 가능한 시간 */
  last_order?: Date;
  /** owner id */
  owner_id: string;
  /** owner의 display name */
  owner_name: string;
  /** 주문 마감 여부 */
  closed: boolean;
}

export interface IEventOrder {
  /** 주문자 */
  guest_id: string;
  /** 주문 상품 */
  beverage_id: string;
  /** 주문에 관한 추가 요청 */
  option?: string;
}

export interface IBeverage {
  /** 이름 */
  title: string;
}

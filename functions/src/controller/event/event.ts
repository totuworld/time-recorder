import debug from 'debug';
import { Request, Response } from 'express';

import { WebClient } from '@slack/client';

import { Events } from '../../models/Events';
import { Util } from '../../services/util';
import { IAddEventReq } from './interface/IAddEventReq';
import { IAddGuestsReq } from './interface/IAddGuestsReq';
import { IAddOrderReq } from './interface/IAddOrderReq';
import { IFindAllEventReq } from './interface/IFindAllEventReq';
import { IFindEventReq } from './interface/IFindEventReq';
import { ISendMsgToGuestsReq } from './interface/ISendMsgToGuestsReq';
import { IUpdateEventReq } from './interface/IUpdateEventReq';
import { JSCAddEvent } from './jsc/JSCAddEvent';
import { JSCAddGuests } from './jsc/JSCAddGuests';
import { JSCAddOrder } from './jsc/JSCAddOrder';
import { JSCFindAllEvent } from './jsc/JSCFindAllEvent';
import { JSCFindEvent } from './jsc/JSCFindEvent';
import { JSCSendMsgToGuests } from './jsc/JSCSendMsgToGuests';
import { JSCUpdateEvent } from './jsc/JSCUpdateEvent';
import { WorkLog } from '../../models/WorkLog';
import { LogData } from '../../models/interface/SlackSlashCommand';
import { EN_WORK_TYPE } from '../../contants/enum/EN_WORK_TYPE';

const log = debug('tr:event');

export async function findAllEvent(req: Request, res: Response) {
  const validateReq = Util.validateParamWithData<IFindAllEventReq>(
    {
      query: req.query
    },
    JSCFindAllEvent
  );
  if (validateReq.result === false) {
    return res
      .contentType('json')
      .status(400)
      .send({
        text: validateReq.errorMessage
      });
  }
  try {
    const result = await Events.findAll({
      ...validateReq.data.query
    });
    return res.status(200).send(result);
  } catch (err) {
    return res.status(500).send(err.toString());
  }
}

export async function addEvent(req: Request, res: Response) {
  log(req.body);
  const validateReq = Util.validateParamWithData<IAddEventReq>(
    {
      body: req.body
    },
    JSCAddEvent
  );
  if (validateReq.result === false) {
    return res
      .contentType('json')
      .status(400)
      .send({
        text: validateReq.errorMessage
      });
  }

  // 이벤트 생성
  try {
    const reqParams = {
      ...validateReq.data.body,
      desc:
        validateReq.data.body.desc === undefined
          ? validateReq.data.body.desc
          : '',
      private:
        validateReq.data.body.private === undefined
          ? validateReq.data.body.private
          : false
    };
    const result = await Events.add(reqParams);
    return res.status(200).send(result);
  } catch (err) {
    return res.status(500);
  }
}

export async function updateEvent(req: Request, res: Response) {
  const validateReq = Util.validateParamWithData<IUpdateEventReq>(
    {
      params: req.params,
      body: req.body
    },
    JSCUpdateEvent
  );
  if (validateReq.result === false) {
    return res
      .contentType('json')
      .status(400)
      .send({
        text: validateReq.errorMessage
      });
  }

  // 이벤트 수정
  try {
    await Events.find({
      eventId: validateReq.data.params.eventId
    });
    const reqParams = {
      ...validateReq.data.body,
      eventId: validateReq.data.params.eventId
    };
    const result = await Events.update(reqParams);
    return res.status(200).send(result);
  } catch (err) {
    return res.status(500);
  }
}

export async function findEvent(req: Request, res: Response) {
  const validateReq = Util.validateParamWithData<IFindEventReq>(
    {
      params: req.params
    },
    JSCFindEvent
  );
  if (validateReq.result === false) {
    return res
      .contentType('json')
      .status(400)
      .send({
        text: validateReq.errorMessage
      });
  }
  try {
    const result = await Events.find({
      eventId: validateReq.data.params.eventId
    });
    return res.send(result);
  } catch (err) {
    return res.status(404).send();
  }
}

export async function addGuests(req: Request, res: Response) {
  const validateReq = Util.validateParamWithData<IAddGuestsReq>(
    {
      params: req.params,
      body: req.body
    },
    JSCAddGuests
  );
  if (validateReq.result === false) {
    return res
      .contentType('json')
      .status(400)
      .send({
        text: validateReq.errorMessage
      });
  }
  try {
    await Events.find({
      eventId: validateReq.data.params.eventId
    });
    await Events.addGuests({
      eventId: validateReq.data.params.eventId,
      guests: validateReq.data.body.guests
    });
    const result = await Events.findGuests({
      eventId: validateReq.data.params.eventId
    });
    return res.send(result);
  } catch (err) {
    return res.status(500).send(err.toString());
  }
}

export async function findGuests(req: Request, res: Response) {
  const validateReq = Util.validateParamWithData<IFindEventReq>(
    {
      params: req.params
    },
    JSCFindEvent
  );
  if (validateReq.result === false) {
    return res
      .contentType('json')
      .status(400)
      .send({
        text: validateReq.errorMessage
      });
  }
  try {
    await Events.find({
      eventId: validateReq.data.params.eventId
    });
    const result = await Events.findGuests({
      eventId: validateReq.data.params.eventId
    });
    return res.send(result);
  } catch (err) {
    return res.status(500).send(err.toString());
  }
}

export async function addOrder(req: Request, res: Response) {
  const validateReq = Util.validateParamWithData<IAddOrderReq>(
    {
      params: req.params,
      body: req.body
    },
    JSCAddOrder
  );
  if (validateReq.result === false) {
    return res
      .contentType('json')
      .status(400)
      .send({
        text: validateReq.errorMessage
      });
  }
  try {
    await Events.find({
      eventId: validateReq.data.params.eventId
    });
    const result = await Events.addOrder({
      eventId: validateReq.data.params.eventId,
      order: validateReq.data.body.order
    });
    return res.send(result);
  } catch (err) {
    return res.status(500).send(err.toString());
  }
}

export async function findOrders(req: Request, res: Response) {
  const validateReq = Util.validateParamWithData<IFindEventReq>(
    {
      params: req.params
    },
    JSCFindEvent
  );
  if (validateReq.result === false) {
    return res
      .contentType('json')
      .status(400)
      .send({
        text: validateReq.errorMessage
      });
  }
  try {
    await Events.find({
      eventId: validateReq.data.params.eventId
    });
    const result = await Events.findOrders({
      eventId: validateReq.data.params.eventId
    });
    return res.send(result);
  } catch (err) {
    return res.status(500).send(err.toString());
  }
}

export async function sendMsgToGuests(req: Request, res: Response) {
  const validateReq = Util.validateParamWithData<ISendMsgToGuestsReq>(
    {
      params: req.params,
      query: req.query
    },
    JSCSendMsgToGuests
  );
  if (validateReq.result === false) {
    return res
      .contentType('json')
      .status(400)
      .send({
        text: validateReq.errorMessage
      });
  }
  const token: string = process.env.SLACK_TOKEN
    ? process.env.SLACK_TOKEN.toLowerCase()
    : '';
  const viewerUrl: string = process.env.VIEWER_URL
    ? process.env.VIEWER_URL
    : 'http://localhost:3000';
  log(token);
  if (!!token === false) {
    return res.status(500).send({ error_message: 'slack 설정 오류' });
  }
  try {
    // 이벤트를 조회한다.
    const result = await Events.find({
      eventId: validateReq.data.params.eventId
    });
    if (!!result === false) {
      return res.status(404).send({ error_message: '?' });
    }
    // 게스트를 조회한다.
    const guests = await Events.findGuests({
      eventId: validateReq.data.params.eventId
    });
    log(guests);
    // 아무런 게스트가 없으면 메시지 보내지 않음
    if (!!guests === false || guests.length === 0) {
      return res.status(200).send();
    }
    // 슬랙 메시지 보내자.
    const bot = new WebClient(token);
    // 각 게스트의 당일 로그를 조회한다.
    for (const guest of guests) {
      const work = await WorkLog.find({ userId: guest.id });
      if (Object.keys(work.data).length > 0) {
        // 로그가 있을 때.
        // `출근` 로그가 있는지 조사해보자.
        const haveWork = Object.keys(work.data).reduce((acc: boolean, cur) => {
          if (acc === true) {
            return true;
          }
          const currentData: LogData = work.data[cur];
          return currentData.type === EN_WORK_TYPE.WORK;
        }, false);
        log('haveWork: ', haveWork, guest);
        if (haveWork === true) {
          // 메시지 발송
          await bot.chat.postMessage({
            token,
            channel: guest.id,
            text: validateReq.data.query.text,
            attachments: [
              {
                title: '커피 브레이크 알림',
                title_link: `${viewerUrl}/coffeebreak/${result.id}`,
                text: `\`${
                  result.title
                }\`, 참여하세요. \n 위 링크를 클릭하면 페이지 이동`,
                fields: [
                  {
                    title: '주최자',
                    value: result.owner_name
                  }
                ]
              }
            ],
            icon_url:
              'https://www.bnrconvention.com/wp-content/uploads/2017/04/coffee-icon-1.png',
            username: 'CoffeeTogether'
          });
        }
      }
    }
    return res.status(200).send();
  } catch (err) {
    return res.status(404).send();
  }
}

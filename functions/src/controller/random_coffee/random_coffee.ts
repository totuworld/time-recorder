import debug from 'debug';
import { Request, Response } from 'express';
import { DateTime } from 'luxon';

import { RandomCoffeeEvents } from '../../models/RandomCoffeeEvents';
import { Util } from '../../services/util';
import { IAddGuestsReq } from '../event/interface/IAddGuestsReq';
import { IFindAllEventReq } from '../event/interface/IFindAllEventReq';
import { IFindEventReq } from '../event/interface/IFindEventReq';
import { JSCAddGuests } from '../event/jsc/JSCAddGuests';
import { JSCFindAllEvent } from '../event/jsc/JSCFindAllEvent';
import { JSCFindEvent } from '../event/jsc/JSCFindEvent';
import { IAddRCEventReq } from './interface/IAddRCEventReq';
import { IDeleteRCGuestReq } from './interface/IDeleteRCGuestReq';
import { IUpdateRCEventReq } from './interface/IUpdateRCEventReq';
import { JSCAddRCEvent } from './jsc/JSCAddRCEvent';
import { JSCDeleteRCGuest } from './jsc/JSCDeleteRCGuest';
import { JSCUpdateRCEvent } from './jsc/JSCUpdateRCEvent';

const log = debug('tr:controller:random_coffee');

/** 이벤트 목록 조회 */
export async function findAllRCEvent(req: Request, res: Response) {
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
    const result = await RandomCoffeeEvents.findAll({
      ...validateReq.data.query
    });
    return res.status(200).send(result);
  } catch (err) {
    return res.status(500).send(err.toString());
  }
}

/** 이벤트 단건 조회 */
export async function findRCEvent(req: Request, res: Response) {
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
    const result = await RandomCoffeeEvents.find({
      eventId: validateReq.data.params.eventId
    });
    return res.send(result);
  } catch (err) {
    return res.status(404).send();
  }
}

/** 이벤트 등록 */
export async function addRCEvent(req: Request, res: Response) {
  log(req.body);
  const validateReq = Util.validateParamWithData<IAddRCEventReq>(
    {
      body: req.body
    },
    JSCAddRCEvent
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
        validateReq.data.body.desc !== undefined
          ? validateReq.data.body.desc
          : '',
      private:
        validateReq.data.body.private !== undefined
          ? validateReq.data.body.private
          : false
    };
    const result = await RandomCoffeeEvents.add(reqParams);
    return res.status(200).send(result);
  } catch (err) {
    return res.status(500);
  }
}

/** 이벤트 수정 */
export async function updateRCEvent(req: Request, res: Response) {
  const validateReq = Util.validateParamWithData<IUpdateRCEventReq>(
    {
      params: req.params,
      body: req.body
    },
    JSCUpdateRCEvent
  );
  log(req.body);
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
    await RandomCoffeeEvents.find({
      eventId: validateReq.data.params.eventId
    });
    const reqParams = {
      ...validateReq.data.body,
      eventId: validateReq.data.params.eventId
    };
    log(validateReq.data.body);
    const result = await RandomCoffeeEvents.update(reqParams);
    return res.status(200).send(result);
  } catch (err) {
    return res.status(500);
  }
}

export async function addRCGuests(req: Request, res: Response) {
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
    const eventInfo = await RandomCoffeeEvents.find({
      eventId: validateReq.data.params.eventId
    });
    if (eventInfo.closed) {
      return res
        .contentType('json')
        .status(400)
        .send({ text: 'closed 된 이벤트입니다' });
    }
    const now = DateTime.local();
    const last =
      typeof eventInfo.last_register === 'string'
        ? DateTime.fromISO(eventInfo.last_register)
        : DateTime.fromJSDate(eventInfo.last_register);
    if (now > last) {
      return res
        .contentType('json')
        .status(400)
        .send({ text: '등록 가능한 기간이 아닙니다' });
    }
    await RandomCoffeeEvents.addGuests({
      eventId: validateReq.data.params.eventId,
      guests: validateReq.data.body.guests
    });
    const result = await RandomCoffeeEvents.findGuests({
      eventId: validateReq.data.params.eventId
    });
    return res.send(result);
  } catch (err) {
    return res.status(500).send(err.toString());
  }
}

export async function findRCGuests(req: Request, res: Response) {
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
    await RandomCoffeeEvents.find({
      eventId: validateReq.data.params.eventId
    });
    const result = await RandomCoffeeEvents.findGuests({
      eventId: validateReq.data.params.eventId
    });
    return res.send(result);
  } catch (err) {
    return res.status(500).send(err.toString());
  }
}

export async function removeRCGuest(req: Request, res: Response) {
  const validateReq = Util.validateParamWithData<IDeleteRCGuestReq>(
    {
      params: req.params
    },
    JSCDeleteRCGuest
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
    const eventInfo = await RandomCoffeeEvents.find({
      eventId: validateReq.data.params.eventId
    });
    if (eventInfo.closed) {
      return res
        .contentType('json')
        .status(400)
        .send({ text: 'closed 된 이벤트입니다' });
    }
    const now = DateTime.local();
    const last =
      typeof eventInfo.last_register === 'string'
        ? DateTime.fromISO(eventInfo.last_register)
        : DateTime.fromJSDate(eventInfo.last_register);
    if (now > last) {
      return res
        .contentType('json')
        .status(400)
        .send({ text: '수정 불가능한 기간 입니다' });
    }
    await RandomCoffeeEvents.deleteGuest({
      eventId: validateReq.data.params.eventId,
      docId: validateReq.data.params.docId
    });
    const result = await RandomCoffeeEvents.findGuests({
      eventId: validateReq.data.params.eventId
    });
    return res.send(result);
  } catch (err) {
    return res.status(500).send(err.toString());
  }
}

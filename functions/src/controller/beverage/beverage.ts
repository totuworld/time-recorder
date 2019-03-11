import { Request, Response } from 'express';
import { Beverages } from '../../models/Beverages';
import { Util } from '../../services/util';
import { IAddBeverageReq } from './interface/IAddBeverage';
import { JSCAddBeverage } from './jsc/JSCAddBeverage';

export async function addBeverage(req: Request, res: Response) {
  const validateReq = Util.validateParamWithData<IAddBeverageReq>(
    {
      body: req.body
    },
    JSCAddBeverage
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
    const result = await Beverages.add({ ...validateReq.data.body });
    return res.send(result);
  } catch (err) {
    return res.status(500).send(err.toString());
  }
}

export async function findAllBeverage(_: Request, res: Response) {
  try {
    const result = await Beverages.findAll();
    return res.send(result);
  } catch (err) {
    return res.status(500).send(err.toString());
  }
}

import { Router } from 'express';
import {
  getAllRacehorses,
  getRacehorseById,
  createRacehorse,
  updateRacehorse,
  deleteRacehorse,
} from './racehorse.controller.js';

export const racehorseRouter = Router();

racehorseRouter.get('/', getAllRacehorses);
racehorseRouter.get('/:id', getRacehorseById);
racehorseRouter.post('/', createRacehorse);
racehorseRouter.put('/:id', updateRacehorse);
racehorseRouter.delete('/:id', deleteRacehorse);

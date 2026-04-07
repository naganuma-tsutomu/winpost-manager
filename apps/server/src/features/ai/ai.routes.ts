import { Router } from 'express';
import { generateAdvice } from './ai.controller.js';

export const aiRouter = Router();

aiRouter.post('/advice', generateAdvice);

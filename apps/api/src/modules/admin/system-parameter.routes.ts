import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/auth.middleware';

export const systemParameterRouter = Router();

systemParameterRouter.use(authenticate);
systemParameterRouter.use(requireRole('OWNER'));

systemParameterRouter.get('/', async (_req, res, next) => {
  try {
    const params = await prisma.systemParameter.findMany({
      orderBy: { key: 'asc' },
    });
    res.json({ success: true, data: params, error: null });
  } catch (err) {
    next(err);
  }
});

systemParameterRouter.get('/:key', async (req, res, next) => {
  try {
    const param = await prisma.systemParameter.findUnique({
      where: { key: req.params.key },
    });
    if (!param) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Parâmetro não encontrado.' } });
      return;
    }
    res.json({ success: true, data: param, error: null });
  } catch (err) {
    next(err);
  }
});

const upsertSchema = z.object({
  key: z.string().min(1),
  value: z.record(z.unknown()),
  description: z.string().optional(),
});

systemParameterRouter.post('/', async (req, res, next) => {
  try {
    const data = upsertSchema.parse(req.body);
    const param = await prisma.systemParameter.upsert({
      where: { key: data.key },
      create: { key: data.key, value: data.value as Prisma.InputJsonValue, description: data.description },
      update: { value: data.value as Prisma.InputJsonValue, description: data.description },
    });
    res.status(201).json({ success: true, data: param, error: null });
  } catch (err) {
    next(err);
  }
});

systemParameterRouter.put('/:key', async (req, res, next) => {
  try {
    const { value, description } = z.object({ value: z.record(z.unknown()), description: z.string().optional() }).parse(req.body);
    const param = await prisma.systemParameter.update({
      where: { key: req.params.key },
      data: { value: value as Prisma.InputJsonValue, description },
    });
    res.json({ success: true, data: param, error: null });
  } catch (err) {
    next(err);
  }
});

systemParameterRouter.delete('/:key', async (req, res, next) => {
  try {
    await prisma.systemParameter.delete({ where: { key: req.params.key } });
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
});

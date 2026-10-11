import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/auth.middleware';

export const platformAdminSystemParameterRouter = Router();

platformAdminSystemParameterRouter.use(authenticate);
platformAdminSystemParameterRouter.use(requireRole('SUPER_ADMIN'));

platformAdminSystemParameterRouter.get('/', async (_req, res, next) => {
  try {
    const params = await prisma.systemParameter.findMany({ orderBy: { key: 'asc' } });
    res.json({ success: true, data: params, error: null });
  } catch (err) {
    next(err);
  }
});

platformAdminSystemParameterRouter.get('/:key', async (req, res, next) => {
  try {
    const param = await prisma.systemParameter.findUnique({ where: { key: req.params.key } });
    if (!param) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Parâmetro não encontrado.' } });
      return;
    }
    res.json({ success: true, data: param, error: null });
  } catch (err) {
    next(err);
  }
});

const upsertParamSchema = z.object({
  key: z.string().min(1),
  value: z.record(z.unknown()),
  description: z.string().optional(),
});

platformAdminSystemParameterRouter.post('/', async (req, res, next) => {
  try {
    const data = upsertParamSchema.parse(req.body);
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

platformAdminSystemParameterRouter.put('/:key', async (req, res, next) => {
  try {
    const data = upsertParamSchema.partial().parse(req.body);
    const param = await prisma.systemParameter.update({
      where: { key: req.params.key },
      data: {
        ...(data.key !== undefined ? { key: data.key } : {}),
        ...(data.value !== undefined ? { value: data.value as Prisma.InputJsonValue } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
    });
    res.json({ success: true, data: param, error: null });
  } catch (err) {
    next(err);
  }
});

platformAdminSystemParameterRouter.delete('/:key', async (req, res, next) => {
  try {
    await prisma.systemParameter.delete({ where: { key: req.params.key } });
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
});
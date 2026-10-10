import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/auth.middleware';

export const featureFlagRouter = Router();

featureFlagRouter.use(authenticate);
featureFlagRouter.use(requireRole('OWNER'));

featureFlagRouter.get('/', async (_req, res, next) => {
  try {
    const flags = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
    res.json({ success: true, data: flags, error: null });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  enabled: z.boolean().default(false),
  rolloutPercent: z.number().int().min(0).max(100).default(0),
  targetTenants: z.array(z.string()).default([]),
});

featureFlagRouter.post('/', async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const flag = await prisma.featureFlag.create({ data });
    res.status(201).json({ success: true, data: flag, error: null });
  } catch (err) {
    next(err);
  }
});

featureFlagRouter.put('/:key', async (req, res, next) => {
  try {
    const data = createSchema.partial().parse(req.body);
    const flag = await prisma.featureFlag.update({
      where: { key: req.params.key },
      data,
    });
    res.json({ success: true, data: flag, error: null });
  } catch (err) {
    next(err);
  }
});

featureFlagRouter.delete('/:key', async (req, res, next) => {
  try {
    await prisma.featureFlag.delete({ where: { key: req.params.key } });
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
});

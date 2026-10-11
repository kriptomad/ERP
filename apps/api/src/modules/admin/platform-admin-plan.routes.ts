import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/auth.middleware';

export const platformAdminPlanRouter = Router();

platformAdminPlanRouter.use(authenticate);
platformAdminPlanRouter.use(requireRole('SUPER_ADMIN', 'FINANCE_ANALYST'));

platformAdminPlanRouter.get('/', async (_req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({ orderBy: { basePrice: 'asc' } });
    res.json({ success: true, data: plans, error: null });
  } catch (err) {
    next(err);
  }
});

const createPlanSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  basePrice: z.number().positive(),
  includedModules: z.array(z.string()).default([]),
  audience: z.enum(['BUSINESS', 'PERSONAL', 'BOTH']).default('BUSINESS'),
  maxConnectedAccounts: z.number().int().positive().optional(),
});

platformAdminPlanRouter.post('/', async (req, res, next) => {
  try {
    const data = createPlanSchema.parse(req.body);
    const plan = await prisma.plan.create({ data });
    res.status(201).json({ success: true, data: plan, error: null });
  } catch (err) {
    next(err);
  }
});

platformAdminPlanRouter.put('/:id', async (req, res, next) => {
  try {
    const data = createPlanSchema.partial().parse(req.body);
    const plan = await prisma.plan.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: plan, error: null });
  } catch (err) {
    next(err);
  }
});

platformAdminPlanRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.plan.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
});

platformAdminPlanRouter.get('/modules', async (_req, res, next) => {
  try {
    const modules = await prisma.module.findMany({ orderBy: { code: 'asc' } });
    res.json({ success: true, data: modules, error: null });
  } catch (err) {
    next(err);
  }
});

const createModuleSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  monthlyPrice: z.number().positive(),
  description: z.string(),
});

platformAdminPlanRouter.post('/modules', async (req, res, next) => {
  try {
    const data = createModuleSchema.parse(req.body);
    const module = await prisma.module.create({ data });
    res.status(201).json({ success: true, data: module, error: null });
  } catch (err) {
    next(err);
  }
});

platformAdminPlanRouter.put('/modules/:code', async (req, res, next) => {
  try {
    const data = createModuleSchema.partial().parse(req.body);
    const module = await prisma.module.update({ where: { code: req.params.code }, data });
    res.json({ success: true, data: module, error: null });
  } catch (err) {
    next(err);
  }
});
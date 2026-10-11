import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePersonalTenant } from '../../middlewares/tenant-type-gatekeeper.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';

export const personalCategoryRouter = Router();

personalCategoryRouter.use(authenticate);
personalCategoryRouter.use(requirePersonalTenant);

personalCategoryRouter.get('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const categories = await prisma.personalCategory.findMany({
      where: { tenantId: tenantId!, active: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: categories, error: null });
  } catch (err) {
    next(err);
  }
});

personalCategoryRouter.post('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = z.object({
      name: z.string().min(1),
      type: z.enum(['INCOME', 'EXPENSE']),
      parentId: z.string().uuid().optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
    }).parse(req.body);

    const category = await prisma.personalCategory.create({
      data: { ...data, tenantId: tenantId! },
    });

    res.status(201).json({ success: true, data: category, error: null });
  } catch (err) {
    next(err);
  }
});

personalCategoryRouter.put('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = z.object({ name: z.string().optional(), icon: z.string().optional(), color: z.string().optional(), active: z.boolean().optional() }).parse(req.body);

    const category = await prisma.personalCategory.update({
      where: { id: req.params.id, tenantId: tenantId! },
      data,
    });

    res.json({ success: true, data: category, error: null });
  } catch (err) {
    next(err);
  }
});

personalCategoryRouter.delete('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    await prisma.personalCategory.update({
      where: { id: req.params.id, tenantId: tenantId! },
      data: { active: false },
    });
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
});
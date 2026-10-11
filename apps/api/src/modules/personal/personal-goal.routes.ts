import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePersonalTenant } from '../../middlewares/tenant-type-gatekeeper.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';

export const personalGoalRouter = Router();

personalGoalRouter.use(authenticate);
personalGoalRouter.use(requirePersonalTenant);

personalGoalRouter.get('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { status, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = { tenantId: tenantId! };
    if (status) where.status = status;

    const [goals, total] = await Promise.all([
      prisma.personalGoal.findMany({
        where,
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.personalGoal.count({ where }),
    ]);

    res.json({ success: true, data: { items: goals, total }, error: null });
  } catch (err) {
    next(err);
  }
});

personalGoalRouter.post('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = z.object({
      name: z.string().min(1),
      targetAmount: z.number().positive(),
      targetDate: z.string().datetime().optional(),
    }).parse(req.body);

    const goal = await prisma.personalGoal.create({
      data: { ...data, tenantId: tenantId!, targetDate: data.targetDate ? new Date(data.targetDate) : undefined },
    });

    res.status(201).json({ success: true, data: goal, error: null });
  } catch (err) {
    next(err);
  }
});

personalGoalRouter.put('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = z.object({ currentAmount: z.number().min(0).optional(), status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).optional() }).parse(req.body);

    const goal = await prisma.personalGoal.update({
      where: { id: req.params.id, tenantId: tenantId! },
      data,
    });

    res.json({ success: true, data: goal, error: null });
  } catch (err) {
    next(err);
  }
});

personalGoalRouter.delete('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    await prisma.personalGoal.delete({ where: { id: req.params.id, tenantId: tenantId! } });
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
});
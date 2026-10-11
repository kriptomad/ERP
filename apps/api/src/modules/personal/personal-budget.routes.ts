import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePersonalTenant } from '../../middlewares/tenant-type-gatekeeper.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';

export const personalBudgetRouter = Router();

personalBudgetRouter.use(authenticate);
personalBudgetRouter.use(requirePersonalTenant);

personalBudgetRouter.get('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { month, year, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = { tenantId: tenantId! };
    if (month && year) { where.month = parseInt(month as string); where.year = parseInt(year as string); }

    const [budgets, total] = await Promise.all([
      prisma.personalBudget.findMany({
        where,
        include: { category: true },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { category: { name: 'asc' } },
      }),
      prisma.personalBudget.count({ where }),
    ]);

    const budgetsWithStatus = budgets.map(b => ({
      ...b,
      spent: 0,
      percentage: 0,
      alert80: b.alertSent80,
      alert100: b.alertSent100,
    }));

    res.json({ success: true, data: { items: budgetsWithStatus, total }, error: null });
  } catch (err) {
    next(err);
  }
});

personalBudgetRouter.post('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = z.object({
      categoryId: z.string().uuid().optional(),
      name: z.string().min(1),
      limitAmount: z.number().positive(),
      month: z.number().int().min(1).max(12),
      year: z.number().int().min(2020).max(2030),
    }).parse(req.body);

    const budget = await prisma.personalBudget.create({
      data: { ...data, tenantId: tenantId! },
    });

    res.status(201).json({ success: true, data: budget, error: null });
  } catch (err) {
    next(err);
  }
});

personalBudgetRouter.put('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = z.object({ limitAmount: z.number().positive().optional(), status: z.enum(['ACTIVE', 'FROZEN', 'CLOSED']).optional() }).parse(req.body);

    const budget = await prisma.personalBudget.update({
      where: { id: req.params.id, tenantId: tenantId! },
      data,
    });

    res.json({ success: true, data: budget, error: null });
  } catch (err) {
    next(err);
  }
});

personalBudgetRouter.delete('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    await prisma.personalBudget.delete({ where: { id: req.params.id, tenantId: tenantId! } });
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
});
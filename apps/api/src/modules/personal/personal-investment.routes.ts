import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePersonalTenant } from '../../middlewares/tenant-type-gatekeeper.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';

export const personalInvestmentRouter = Router();

personalInvestmentRouter.use(authenticate);
personalInvestmentRouter.use(requirePersonalTenant);

personalInvestmentRouter.get('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { active, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = { tenantId: tenantId! };
    if (active !== undefined) where.active = active === 'true';

    const [investments, total] = await Promise.all([
      prisma.personalInvestment.findMany({
        where,
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.personalInvestment.count({ where }),
    ]);

    res.json({ success: true, data: { items: investments, total }, error: null });
  } catch (err) {
    next(err);
  }
});

personalInvestmentRouter.post('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = z.object({
      name: z.string().min(1),
      type: z.enum(['FIXED_INCOME', 'VARIABLE_INCOME', 'CRYPTO', 'REAL_ESTATE', 'OVERSEAS']),
      ticker: z.string().optional(),
      institution: z.string().optional(),
      quantity: z.number().positive().optional(),
      averagePrice: z.number().positive().optional(),
      currentPrice: z.number().positive().optional(),
    }).parse(req.body);

    const investment = await prisma.personalInvestment.create({
      data: {
        ...data,
        tenantId: tenantId!,
        totalValue: data.quantity && data.currentPrice ? data.quantity * data.currentPrice : null,
      },
    });

    res.status(201).json({ success: true, data: investment, error: null });
  } catch (err) {
    next(err);
  }
});

personalInvestmentRouter.put('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = z.object({
      currentPrice: z.number().positive().optional(),
      quantity: z.number().positive().optional(),
      active: z.boolean().optional(),
    }).parse(req.body);

    const investment = await prisma.personalInvestment.update({
      where: { id: req.params.id, tenantId: tenantId! },
      data: {
        ...data,
        ...(data.quantity && data.currentPrice && { totalValue: data.quantity * data.currentPrice }),
      },
    });

    res.json({ success: true, data: investment, error: null });
  } catch (err) {
    next(err);
  }
});

personalInvestmentRouter.delete('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    await prisma.personalInvestment.update({ where: { id: req.params.id, tenantId: tenantId! }, data: { active: false } });
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
});

personalInvestmentRouter.get('/networth', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { date } = req.query;

    const snapshots = await prisma.netWorthSnapshot.findMany({
      where: { tenantId: tenantId!, ...(date && { snapshotDate: { lte: new Date(date as string) } }) },
      orderBy: { snapshotDate: 'desc' },
      take: 12,
    });

    const latest = snapshots[0] || { totalAssets: 0, totalDebts: 0, netWorth: 0 };

    res.json({ success: true, data: { latest, history: snapshots }, error: null });
  } catch (err) {
    next(err);
  }
});

personalInvestmentRouter.post('/networth/snapshot', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();

    const [accounts, investments, debts] = await Promise.all([
      prisma.personalAccount.findMany({ where: { tenantId: tenantId!, active: true } }),
      prisma.personalInvestment.findMany({ where: { tenantId: tenantId!, active: true } }),
      prisma.personalDebt.findMany({ where: { tenantId: tenantId!, active: true } }),
    ]);

    const totalAssets = accounts.reduce((sum, a) => sum + a.balance.toNumber(), 0) +
      investments.reduce((sum, i) => sum + (i.totalValue?.toNumber() ?? 0), 0);

    const totalDebts = debts.reduce((sum, d) => sum + d.remainingAmount.toNumber(), 0);

    const snapshot = await prisma.netWorthSnapshot.create({
      data: {
        tenantId,
        totalAssets,
        totalDebts,
        netWorth: totalAssets - totalDebts,
      },
    });

    res.status(201).json({ success: true, data: snapshot, error: null });
  } catch (err) {
    next(err);
  }
});
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePersonalTenant } from '../../middlewares/tenant-type-gatekeeper.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';

export const personalDebtRouter = Router();

personalDebtRouter.use(authenticate);
personalDebtRouter.use(requirePersonalTenant);

personalDebtRouter.get('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { active, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = { tenantId: tenantId! };
    if (active !== undefined) where.active = active === 'true';

    const [debts, total] = await Promise.all([
      prisma.personalDebt.findMany({
        where,
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.personalDebt.count({ where }),
    ]);

    res.json({ success: true, data: { items: debts, total }, error: null });
  } catch (err) {
    next(err);
  }
});

personalDebtRouter.post('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = z.object({
      name: z.string().min(1),
      type: z.enum(['LOAN', 'FINANCING', 'CREDIT_CARD', 'OTHER']),
      totalAmount: z.number().positive(),
      remainingAmount: z.number().positive(),
      interestRate: z.number().min(0).max(100).optional(),
      monthlyPayment: z.number().positive().optional(),
      dueDate: z.string().datetime().optional(),
    }).parse(req.body);

    const debt = await prisma.personalDebt.create({
      data: { ...data, tenantId: tenantId!, dueDate: data.dueDate ? new Date(data.dueDate) : undefined },
    });

    res.status(201).json({ success: true, data: debt, error: null });
  } catch (err) {
    next(err);
  }
});

personalDebtRouter.put('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = z.object({
      remainingAmount: z.number().min(0).optional(),
      monthlyPayment: z.number().positive().optional(),
      active: z.boolean().optional(),
    }).parse(req.body);

    const debt = await prisma.personalDebt.update({
      where: { id: req.params.id, tenantId: tenantId! },
      data,
    });

    res.json({ success: true, data: debt, error: null });
  } catch (err) {
    next(err);
  }
});

personalDebtRouter.delete('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    await prisma.personalDebt.update({ where: { id: req.params.id, tenantId: tenantId! }, data: { active: false } });
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
});

personalDebtRouter.get('/payoff-calculator', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { strategy } = req.query;

    const debts = await prisma.personalDebt.findMany({
      where: { tenantId: tenantId!, active: true, remainingAmount: { gt: 0 } },
    });

    if (debts.length === 0) {
      res.json({ success: true, data: { avalanche: [], snowball: [] }, error: null });
      return;
    }

    const avalanche = [...debts].sort((a, b) => (b.interestRate?.toNumber() ?? 0) - (a.interestRate?.toNumber() ?? 0));
    const snowball = [...debts].sort((a, b) => a.remainingAmount.toNumber() - b.remainingAmount.toNumber());

    function calculatePayoff(debts: typeof avalanche) {
      const results = [];
      let month = 0;
      const debtsCopy = debts.map(d => ({
        name: d.name,
        remaining: d.remainingAmount.toNumber(),
        interestRate: d.interestRate?.toNumber() ?? 0,
        monthlyPayment: d.monthlyPayment?.toNumber() ?? 0,
      }));

      while (debtsCopy.some(d => d.remaining > 0) && month < 600) {
        month++;
        for (const d of debtsCopy) {
          if (d.remaining <= 0) continue;
          const interest = d.remaining * (d.interestRate / 100 / 12);
          const principal = Math.max(0, d.monthlyPayment - interest);
          d.remaining = Math.max(0, d.remaining - principal);
          if (d.remaining <= 0) {
            results.push({ name: d.name, month, totalPaid: d.monthlyPayment * month });
          }
        }
      }
      return results;
    }

    res.json({
      success: true,
      data: {
        avalanche: calculatePayoff(avalanche),
        snowball: calculatePayoff(snowball),
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});
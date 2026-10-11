import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePersonalTenant } from '../../middlewares/tenant-type-gatekeeper.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';

export const personalAccountRouter = Router();

personalAccountRouter.use(authenticate);
personalAccountRouter.use(requirePersonalTenant);

personalAccountRouter.get('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const accounts = await prisma.personalAccount.findMany({
      where: { tenantId: tenantId!, active: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: accounts, error: null });
  } catch (err) {
    next(err);
  }
});

personalAccountRouter.post('/', async (req, res, next) => {
  try {
    const { tenantId, userId } = getRequestContext();
    const data = z.object({
      name: z.string().min(1),
      type: z.enum(['CHECKING', 'SAVINGS', 'INVESTMENT', 'CREDIT_CARD', 'CASH']),
      institution: z.string().optional(),
      agency: z.string().optional(),
      accountNumber: z.string().optional(),
      balance: z.number().default(0),
      creditLimit: z.number().optional(),
      closingDay: z.number().int().min(1).max(31).optional(),
    }).parse(req.body);

    const account = await prisma.personalAccount.create({
      data: { ...data, tenantId: tenantId!, ownerId: userId! },
    });

    res.status(201).json({ success: true, data: account, error: null });
  } catch (err) {
    next(err);
  }
});

personalAccountRouter.put('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = z.object({
      name: z.string().optional(),
      balance: z.number().optional(),
      creditLimit: z.number().optional(),
      closingDay: z.number().int().min(1).max(31).optional(),
      active: z.boolean().optional(),
    }).parse(req.body);

    const account = await prisma.personalAccount.update({
      where: { id: req.params.id, tenantId: tenantId! },
      data,
    });

    res.json({ success: true, data: account, error: null });
  } catch (err) {
    next(err);
  }
});

personalAccountRouter.delete('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    await prisma.personalAccount.update({
      where: { id: req.params.id, tenantId: tenantId! },
      data: { active: false },
    });
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
});

personalAccountRouter.get('/:id/transactions', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { startDate, endDate, page = '1', limit = '50' } = req.query;

    const where: Record<string, unknown> = { accountId: req.params.id };
    if (startDate && endDate) where.transactionDate = { gte: new Date(startDate as string), lte: new Date(endDate as string) };

    const [transactions, total] = await Promise.all([
      prisma.personalTransaction.findMany({
        where,
        include: { category: true, splits: true },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { transactionDate: 'desc' },
      }),
      prisma.personalTransaction.count({ where }),
    ]);

    res.json({ success: true, data: { items: transactions, total }, error: null });
  } catch (err) {
    next(err);
  }
});
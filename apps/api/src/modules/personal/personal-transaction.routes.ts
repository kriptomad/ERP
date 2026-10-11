import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePersonalTenant } from '../../middlewares/tenant-type-gatekeeper.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';

export const personalTransactionRouter = Router();

personalTransactionRouter.use(authenticate);
personalTransactionRouter.use(requirePersonalTenant);

const createTransactionSchema = z.object({
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.number().positive(),
  description: z.string().min(1),
  transactionDate: z.string().datetime(),
  notes: z.string().optional(),
  isPrivate: z.boolean().default(false),
  splits: z.array(z.object({
    memberName: z.string().min(1),
    amount: z.number().positive(),
  })).optional(),
});

personalTransactionRouter.get('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { accountId, categoryId, type, startDate, endDate, isPrivate, page = '1', limit = '50' } = req.query;

    const where: Record<string, unknown> = { tenantId: tenantId! };
    if (accountId) where.accountId = accountId;
    if (categoryId) where.categoryId = categoryId;
    if (type) where.type = type;
    if (isPrivate !== undefined) where.isPrivate = isPrivate === 'true';
    if (startDate && endDate) where.transactionDate = { gte: new Date(startDate as string), lte: new Date(endDate as string) };

    const [transactions, total] = await Promise.all([
      prisma.personalTransaction.findMany({
        where,
        include: { account: { select: { id: true, name: true } }, category: { select: { id: true, name: true, type: true, color: true } }, splits: true },
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

personalTransactionRouter.post('/', async (req, res, next) => {
  try {
    const { tenantId, userId } = getRequestContext();
    const data = createTransactionSchema.parse(req.body);

    const transaction = await prisma.$transaction(async (tx) => {
      const txn = await tx.personalTransaction.create({
        data: {
          tenantId: tenantId!,
          createdBy: userId!,
          transactionDate: new Date(data.transactionDate),
          type: data.type,
          description: data.description,
          amount: data.amount,
          accountId: data.accountId,
          isPrivate: data.isPrivate,
          notes: data.notes,
          categoryId: data.categoryId,
        },
      });

      if (data.splits) {
        await tx.personalTransactionSplit.createMany({
          data: data.splits.map(s => ({ transactionId: txn.id, ...s })),
        });
      }

      await tx.personalAccount.update({
        where: { id: data.accountId },
        data: { balance: { increment: data.type === 'INCOME' ? data.amount : -data.amount } },
      });

      return txn;
    });

    res.status(201).json({ success: true, data: transaction, error: null });
  } catch (err) {
    next(err);
  }
});

personalTransactionRouter.put('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = z.object({
      accountId: z.string().uuid().optional(),
      categoryId: z.string().uuid().optional(),
      amount: z.number().positive().optional(),
      description: z.string().optional(),
      transactionDate: z.string().datetime().optional(),
      notes: z.string().optional(),
      isPrivate: z.boolean().optional(),
    }).parse(req.body);

    const transaction = await prisma.personalTransaction.update({
      where: { id: req.params.id, tenantId: tenantId! },
      data: { ...data, ...(data.transactionDate && { transactionDate: new Date(data.transactionDate) }) },
    });

    res.json({ success: true, data: transaction, error: null });
  } catch (err) {
    next(err);
  }
});

personalTransactionRouter.delete('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const transaction = await prisma.personalTransaction.findFirst({ where: { id: req.params.id, tenantId: tenantId! } });
    if (!transaction) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Lançamento não encontrado.' } });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.personalAccount.update({
        where: { id: transaction.accountId },
        data: { balance: { increment: transaction.type === 'INCOME' ? -transaction.amount.toNumber() : transaction.amount.toNumber() } },
      });

      await tx.personalTransaction.delete({ where: { id: req.params.id } });
    });

    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
});

personalTransactionRouter.get('/summary', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { startDate, endDate } = req.query;

    const where: Record<string, unknown> = { tenantId: tenantId! };
    if (startDate && endDate) where.transactionDate = { gte: new Date(startDate as string), lte: new Date(endDate as string) };

    const [income, expenses] = await Promise.all([
      prisma.personalTransaction.aggregate({ where: { ...where, type: 'INCOME' }, _sum: { amount: true } }),
      prisma.personalTransaction.aggregate({ where: { ...where, type: 'EXPENSE' }, _sum: { amount: true } }),
    ]);

    res.json({
      success: true,
      data: {
        income: income._sum.amount?.toNumber() ?? 0,
        expenses: expenses._sum.amount?.toNumber() ?? 0,
        balance: (income._sum.amount?.toNumber() ?? 0) - (expenses._sum.amount?.toNumber() ?? 0),
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});
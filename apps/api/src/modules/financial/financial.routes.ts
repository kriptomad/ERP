import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';

const createPayableSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  dueDate: z.string().datetime(),
  category: z.string().optional(),
  supplierId: z.string().uuid().optional(),
});

const createReceivableSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  dueDate: z.string().datetime(),
  category: z.string().optional(),
  clientId: z.string().uuid().optional(),
});

export const financialRouter = Router();

financialRouter.use(authenticate);

// Accounts Payable
financialRouter.get('/payables', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { status, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = {
      tenantId: tenantId!,
      ...(status && { status: status as string }),
    };

    const [items, total] = await Promise.all([
      prisma.accountPayable.findMany({
        where,
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { dueDate: 'asc' },
      }),
      prisma.accountPayable.count({ where }),
    ]);

    res.json({ success: true, data: { items, total }, error: null });
  } catch (err) {
    next(err);
  }
});

financialRouter.post('/payables', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = createPayableSchema.parse(req.body);

    const item = await prisma.accountPayable.create({
      data: {
        tenantId: tenantId!,
        description: data.description,
        amount: data.amount,
        dueDate: new Date(data.dueDate),
        category: data.category,
        supplierId: data.supplierId,
      },
    });

    res.status(201).json({ success: true, data: item, error: null });
  } catch (err) {
    next(err);
  }
});

financialRouter.post('/payables/:id/pay', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { paidAmount } = z.object({ paidAmount: z.number().positive() }).parse(req.body);

    const item = await prisma.accountPayable.update({
      where: { id: req.params.id, tenantId: tenantId! },
      data: { status: 'PAID', paidAt: new Date(), paidAmount },
    });

    res.json({ success: true, data: item, error: null });
  } catch (err) {
    next(err);
  }
});

// Accounts Receivable
financialRouter.get('/receivables', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { status, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = {
      tenantId: tenantId!,
      ...(status && { status: status as string }),
    };

    const [items, total] = await Promise.all([
      prisma.accountReceivable.findMany({
        where,
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { dueDate: 'asc' },
      }),
      prisma.accountReceivable.count({ where }),
    ]);

    res.json({ success: true, data: { items, total }, error: null });
  } catch (err) {
    next(err);
  }
});

financialRouter.post('/receivables', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = createReceivableSchema.parse(req.body);

    const item = await prisma.accountReceivable.create({
      data: {
        tenantId: tenantId!,
        description: data.description,
        amount: data.amount,
        dueDate: new Date(data.dueDate),
        category: data.category,
        clientId: data.clientId,
      },
    });

    res.status(201).json({ success: true, data: item, error: null });
  } catch (err) {
    next(err);
  }
});

financialRouter.post('/receivables/:id/receive', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { receivedAmount } = z.object({ receivedAmount: z.number().positive() }).parse(req.body);

    const item = await prisma.accountReceivable.update({
      where: { id: req.params.id, tenantId: tenantId! },
      data: { status: 'RECEIVED', receivedAt: new Date(), receivedAmount },
    });

    res.json({ success: true, data: item, error: null });
  } catch (err) {
    next(err);
  }
});

// Cash Flow Summary
financialRouter.get('/cash-flow/summary', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { startDate, endDate } = req.query;

    const dateFilter = {
      ...(startDate && { gte: new Date(startDate as string) }),
      ...(endDate && { lte: new Date(endDate as string) }),
    };

    const [payables, receivables, sales] = await Promise.all([
      prisma.accountPayable.aggregate({
        where: { tenantId: tenantId!, ...(Object.keys(dateFilter).length > 0 && { dueDate: dateFilter }) },
        _sum: { amount: true },
      }),
      prisma.accountReceivable.aggregate({
        where: { tenantId: tenantId!, ...(Object.keys(dateFilter).length > 0 && { dueDate: dateFilter }) },
        _sum: { amount: true },
      }),
      prisma.sale.aggregate({
        where: { tenantId: tenantId!, status: 'COMPLETED', ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }) },
        _sum: { totalAmount: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalPayables: payables._sum.amount || 0,
        totalReceivables: receivables._sum.amount || 0,
        totalSales: sales._sum.totalAmount || 0,
        netCashFlow: (receivables._sum.amount || 0) - (payables._sum.amount || 0),
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

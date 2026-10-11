import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePersonalTenant } from '../../middlewares/tenant-type-gatekeeper.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';

export const personalBillRouter = Router();

personalBillRouter.use(authenticate);
personalBillRouter.use(requirePersonalTenant);

personalBillRouter.get('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { status, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = { tenantId: tenantId! };
    if (status) where.status = status;

    const [bills, total] = await Promise.all([
      prisma.personalBill.findMany({
        where,
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { dueDate: 'asc' },
      }),
      prisma.personalBill.count({ where }),
    ]);

    res.json({ success: true, data: { items: bills, total }, error: null });
  } catch (err) {
    next(err);
  }
});

personalBillRouter.post('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      amount: z.number().positive(),
      dueDate: z.string().datetime(),
      recurrence: z.enum(['MONTHLY', 'YEARLY']).optional(),
    }).parse(req.body);

    const bill = await prisma.personalBill.create({
      data: { ...data, tenantId: tenantId!, dueDate: new Date(data.dueDate) },
    });

    res.status(201).json({ success: true, data: bill, error: null });
  } catch (err) {
    next(err);
  }
});

personalBillRouter.put('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = z.object({
      status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
      alertSent: z.boolean().optional(),
    }).parse(req.body);

    const bill = await prisma.personalBill.update({
      where: { id: req.params.id, tenantId: tenantId! },
      data,
    });

    res.json({ success: true, data: bill, error: null });
  } catch (err) {
    next(err);
  }
});

personalBillRouter.delete('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    await prisma.personalBill.delete({ where: { id: req.params.id, tenantId: tenantId! } });
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
});
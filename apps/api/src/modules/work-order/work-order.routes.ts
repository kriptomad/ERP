import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';

const createWorkOrderSchema = z.object({
  clientId: z.string().uuid().optional(),
  deviceType: z.string().optional(),
  deviceBrand: z.string().optional(),
  deviceModel: z.string().optional(),
  deviceSerial: z.string().optional(),
  problemDescription: z.string().min(1),
});

const updateStatusSchema = z.object({
  status: z.enum(['RECEIVED', 'DIAGNOSING', 'AWAITING_APPROVAL', 'IN_REPAIR', 'READY', 'DELIVERED', 'CANCELLED']),
  diagnosis: z.string().optional(),
  laborCost: z.number().min(0).optional(),
  partsCost: z.number().min(0).optional(),
});

export const workOrderRouter = Router();

workOrderRouter.use(authenticate);

workOrderRouter.get('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { status, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = {
      tenantId: tenantId!,
      ...(status && { status: status as string }),
    };

    const [items, total] = await Promise.all([
      prisma.workOrder.findMany({
        where,
        include: { client: true, items: true },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.workOrder.count({ where }),
    ]);

    res.json({ success: true, data: { items, total }, error: null });
  } catch (err) {
    next(err);
  }
});

workOrderRouter.get('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: req.params.id, tenantId: tenantId! },
      include: { client: true, items: true },
    });
    if (!workOrder) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'O.S. não encontrada.' } });
      return;
    }
    res.json({ success: true, data: workOrder, error: null });
  } catch (err) {
    next(err);
  }
});

workOrderRouter.post('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = createWorkOrderSchema.parse(req.body);

    const workOrder = await prisma.workOrder.create({
      data: { ...data, tenantId: tenantId! },
      include: { client: true },
    });

    res.status(201).json({ success: true, data: workOrder, error: null });
  } catch (err) {
    next(err);
  }
});

workOrderRouter.patch('/:id/status', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = updateStatusSchema.parse(req.body);

    const workOrder = await prisma.workOrder.update({
      where: { id: req.params.id, tenantId: tenantId! },
      data,
      include: { client: true, items: true },
    });

    res.json({ success: true, data: workOrder, error: null });
  } catch (err) {
    next(err);
  }
});

const addItemSchema = z.object({
  productId: z.string().uuid().optional(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
});

workOrderRouter.post('/:id/items', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = addItemSchema.parse(req.body);

    const item = await prisma.workOrderItem.create({
      data: {
        workOrderId: req.params.id,
        productId: data.productId,
        description: data.description,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        totalPrice: data.quantity * data.unitPrice,
      },
    });

    const workOrder = await prisma.workOrder.update({
      where: { id: req.params.id, tenantId: tenantId! },
      data: {
        partsCost: { increment: data.quantity * data.unitPrice },
      },
    });

    res.status(201).json({ success: true, data: { item, workOrder }, error: null });
  } catch (err) {
    next(err);
  }
});

workOrderRouter.delete('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    await prisma.workOrder.update({
      where: { id: req.params.id, tenantId: tenantId! },
      data: { status: 'CANCELLED' },
    });
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
});

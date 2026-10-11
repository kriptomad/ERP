import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireModule } from '../../middlewares/module-gating.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';

const createWorkOrderSchema = z.object({
  clientId: z.string().uuid().optional(),
  deviceType: z.string().optional(),
  deviceBrand: z.string().optional(),
  deviceModel: z.string().optional(),
  deviceSerial: z.string().optional(),
  deviceImei: z.string().optional(),
  problemDescription: z.string().min(1),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  warrantyDays: z.number().int().positive().optional(),
  assignedTechnicianId: z.string().uuid().optional(),
});

const updateWorkOrderSchema = z.object({
  status: z.enum(['RECEIVED', 'DIAGNOSING', 'AWAITING_APPROVAL', 'IN_REPAIR', 'READY', 'DELIVERED', 'CANCELLED']).optional(),
  diagnosis: z.string().optional(),
  laborCost: z.number().min(0).optional(),
  partsCost: z.number().min(0).optional(),
  assignedTechnicianId: z.string().uuid().optional(),
  approvalExpiresAt: z.string().datetime().optional(),
  checklistJson: z.any().optional(),
  entrySignatureUrl: z.string().url().optional(),
  exitSignatureUrl: z.string().url().optional(),
  estimatedReadyAt: z.string().datetime().optional(),
});

const addItemSchema = z.object({
  productId: z.string().uuid().optional(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
});

const addPhotoSchema = z.object({
  photoUrl: z.string().url(),
  category: z.enum(['ENTRY', 'DIAGNOSIS', 'REPAIR', 'EXIT']),
  description: z.string().optional(),
});

export const workOrderRouter = Router();

workOrderRouter.use(authenticate);

workOrderRouter.get('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { status, clientId, technicianId, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = { tenantId: tenantId! };
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (technicianId) where.assignedTechnicianId = technicianId;

    const [workOrders, total] = await Promise.all([
      prisma.workOrder.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, phone: true } },
          assignedTechnician: { select: { id: true, name: true } },
          items: true,
          photos: true,
        },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.workOrder.count({ where }),
    ]);

    res.json({ success: true, data: { items: workOrders, total }, error: null });
  } catch (err) {
    next(err);
  }
});

workOrderRouter.get('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: req.params.id, tenantId: tenantId! },
      include: {
        client: true,
        assignedTechnician: { select: { id: true, name: true, email: true } },
        items: { include: { product: true } },
        photos: { include: { user: { select: { id: true, name: true } } } },
      },
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
    const { tenantId, userId } = getRequestContext();
    const data = createWorkOrderSchema.parse(req.body);

    const workOrder = await prisma.workOrder.create({
      data: {
        ...data,
        tenantId: tenantId!,
        assignedTechnicianId: data.assignedTechnicianId || userId!,
      },
      include: { client: true, assignedTechnician: true },
    });

    res.status(201).json({ success: true, data: workOrder, error: null });
  } catch (err) {
    next(err);
  }
});

workOrderRouter.patch('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = updateWorkOrderSchema.parse(req.body);

    const workOrder = await prisma.workOrder.update({
      where: { id: req.params.id, tenantId: tenantId! },
      data,
      include: { client: true, assignedTechnician: true, items: true },
    });

    res.json({ success: true, data: workOrder, error: null });
  } catch (err) {
    next(err);
  }
});

workOrderRouter.post('/:id/approve', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { token } = z.object({ token: z.string() }).parse(req.body);

    const workOrder = await prisma.workOrder.findFirst({
      where: { id: req.params.id, tenantId: tenantId!, approvalLinkToken: token },
    });

    if (!workOrder) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Link de aprovação inválido.' } });
      return;
    }

    if (workOrder.approvalExpiresAt && workOrder.approvalExpiresAt < new Date()) {
      res.status(400).json({ success: false, data: null, error: { code: 'EXPIRED', message: 'Link de aprovação expirado.' } });
      return;
    }

    const updated = await prisma.workOrder.update({
      where: { id: req.params.id },
      data: { status: 'IN_REPAIR', approvedAt: new Date() },
      include: { client: true, items: true },
    });

    res.json({ success: true, data: updated, error: null });
  } catch (err) {
    next(err);
  }
});

workOrderRouter.post('/:id/items', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = addItemSchema.parse(req.body);

    const item = await prisma.$transaction(async (tx) => {
      const item = await tx.workOrderItem.create({
        data: {
          workOrderId: req.params.id,
          ...data,
          totalPrice: data.quantity * data.unitPrice,
        },
      });

      await tx.workOrder.update({
        where: { id: req.params.id },
        data: { partsCost: { increment: data.quantity * data.unitPrice } },
      });

      if (data.productId) {
        await tx.product.update({
          where: { id: data.productId },
          data: { stockQuantity: { decrement: data.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            tenantId: tenantId!,
            productId: data.productId,
            type: 'SALE',
            quantity: data.quantity,
            reason: `Peça para O.S. ${req.params.id}`,
          },
        });
      }

      return item;
    });

    res.status(201).json({ success: true, data: item, error: null });
  } catch (err) {
    next(err);
  }
});

workOrderRouter.post('/:id/photos', async (req, res, next) => {
  try {
    const { tenantId, userId } = getRequestContext();
    const data = addPhotoSchema.parse(req.body);

    const photo = await prisma.osPhoto.create({
      data: {
        tenantId: tenantId!,
        workOrderId: req.params.id,
        userId: userId!,
        ...data,
      },
    });

    res.status(201).json({ success: true, data: photo, error: null });
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
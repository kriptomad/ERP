import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';
import { allocateFefoBatches, consumeFefoBatches } from '../stock/fefo.service';

const adjustStockSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
  type: z.enum(['ADJUSTMENT', 'RETURN', 'TRANSFER', 'LOSS']),
  subtype: z.string().optional(),
  reason: z.string().min(1),
  unitCost: z.number().positive().optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
});

const transferStockSchema = z.object({
  productId: z.string().uuid(),
  fromBatchId: z.string().uuid().optional(),
  toBatchId: z.string().uuid().optional(),
  quantity: z.number().positive(),
});

export const stockRouter = Router();

stockRouter.use(authenticate);

stockRouter.get('/movements', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { productId, type, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = { tenantId: tenantId! };
    if (productId) where.productId = productId;
    if (type) where.type = type;

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: { product: { select: { id: true, name: true, sku: true } }, batch: { select: { id: true, batchNumber: true, expirationDate: true } } },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    res.json({ success: true, data: { items: movements, total }, error: null });
  } catch (err) {
    next(err);
  }
});

stockRouter.post('/adjust', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = adjustStockSchema.parse(req.body);

    const movement = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id: data.productId, tenantId: tenantId! } });
      if (!product) throw new Error('Produto não encontrado.');

      const newQty = data.type === 'RETURN'
        ? product.stockQuantity.toNumber() + data.quantity
        : product.stockQuantity.toNumber() - data.quantity;

      if (newQty < 0) throw new Error('Estoque resultante seria negativo.');

      await tx.product.update({ where: { id: data.productId }, data: { stockQuantity: newQty } });

      return tx.stockMovement.create({
        data: { tenantId: tenantId!, ...data },
      });
    });

    res.status(201).json({ success: true, data: movement, error: null });
  } catch (err) {
    next(err);
  }
});

stockRouter.post('/fefo/consume', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { productId, quantity } = z.object({ productId: z.string().uuid(), quantity: z.number().positive() }).parse(req.body);

    const allocations = await allocateFefoBatches(tenantId!, productId, quantity);
    await consumeFefoBatches(tenantId!, productId, allocations);

    res.json({ success: true, data: { allocations }, error: null });
  } catch (err) {
    next(err);
  }
});

stockRouter.post('/transfer', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = transferStockSchema.parse(req.body);

    await prisma.$transaction(async (tx) => {
      if (data.fromBatchId) {
        await tx.productBatch.update({
          where: { id: data.fromBatchId },
          data: { quantity: { decrement: data.quantity } },
        });
        await tx.stockMovement.create({
          data: { tenantId: tenantId!, productId: data.productId, batchId: data.fromBatchId, type: 'TRANSFER', quantity: data.quantity, reason: `Transferência para lote ${data.toBatchId}` },
        });
      }
      if (data.toBatchId) {
        await tx.productBatch.update({
          where: { id: data.toBatchId },
          data: { quantity: { increment: data.quantity } },
        });
        await tx.stockMovement.create({
          data: { tenantId: tenantId!, productId: data.productId, batchId: data.toBatchId, type: 'TRANSFER', quantity: data.quantity, reason: `Transferência do lote ${data.fromBatchId}` },
        });
      }
    });

    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
});

stockRouter.get('/low-stock', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const products = await prisma.product.findMany({
      where: { tenantId: tenantId!, active: true, minStockThreshold: { not: null } },
    });

    const lowStock = products.filter(p => p.stockQuantity.toNumber() <= (p.minStockThreshold?.toNumber() ?? 0));

    res.json({ success: true, data: lowStock, error: null });
  } catch (err) {
    next(err);
  }
});

stockRouter.get('/batches/:productId', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const batches = await prisma.productBatch.findMany({
      where: { productId: req.params.productId, tenantId: tenantId!, quantity: { gt: 0 } },
      orderBy: { expirationDate: 'asc' },
    });
    res.json({ success: true, data: batches, error: null });
  } catch (err) {
    next(err);
  }
});

stockRouter.get('/expiring', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { days = '30' } = req.query;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + parseInt(days as string));

    const batches = await prisma.productBatch.findMany({
      where: { tenantId: tenantId!, expirationDate: { lte: targetDate, gte: new Date() }, quantity: { gt: 0 } },
      include: { product: { select: { id: true, name: true, sku: true } } },
      orderBy: { expirationDate: 'asc' },
    });

    res.json({ success: true, data: batches, error: null });
  } catch (err) {
    next(err);
  }
});

stockRouter.get('/serials/:productId', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const serials = await prisma.productSerial.findMany({
      where: { productId: req.params.productId, tenantId: tenantId!, status: 'IN_STOCK' },
    });
    res.json({ success: true, data: serials, error: null });
  } catch (err) {
    next(err);
  }
});
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';

const adjustStockSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
  type: z.enum(['ADJUSTMENT', 'RETURN', 'TRANSFER']),
  reason: z.string().min(1),
  unitCost: z.number().positive().optional(),
});

export const stockRouter = Router();

stockRouter.use(authenticate);

stockRouter.get('/movements', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { productId, type, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = {
      tenantId: tenantId!,
      ...(productId && { productId: productId as string }),
      ...(type && { type: type as string }),
    };

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: { product: { select: { id: true, name: true, sku: true } } },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    res.json({
      success: true,
      data: { items: movements, total, page: parseInt(page as string), limit: parseInt(limit as string) },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

stockRouter.post('/adjust', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = adjustStockSchema.parse(req.body);

    const movement = await prisma.$transaction(async (tx: import('@prisma/client').Prisma.TransactionClient) => {
      const product = await tx.product.findFirst({
        where: { id: data.productId, tenantId: tenantId! },
      });

      if (!product) {
        throw new Error('Produto não encontrado.');
      }

      if (data.type === 'ADJUSTMENT' && product.stockQuantity < data.quantity) {
        throw new Error('Quantidade de ajuste maior que o estoque atual.');
      }

      const updatedProduct = await tx.product.update({
        where: { id: data.productId },
        data: {
          stockQuantity: data.type === 'RETURN'
            ? { increment: data.quantity }
            : { decrement: data.quantity },
        },
      });

      const movementRecord = await tx.stockMovement.create({
        data: {
          tenantId: tenantId!,
          productId: data.productId,
          type: data.type,
          quantity: data.quantity,
          unitCost: data.unitCost,
          reason: data.reason,
        },
      });

      return { product: updatedProduct, movement: movementRecord };
    });

    res.status(201).json({ success: true, data: movement, error: null });
  } catch (err) {
    next(err);
  }
});

stockRouter.get('/low-stock', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const products = await prisma.product.findMany({
      where: {
        tenantId: tenantId!,
        active: true,
        stockQuantity: { gt: 0 },
        minStockThreshold: { not: null },
      },
    });

    const lowStock = products.filter((p: { stockQuantity: { toNumber(): number }; minStockThreshold: { toNumber(): number } | null }) => {
      if (!p.minStockThreshold) return false;
      return p.stockQuantity <= p.minStockThreshold;
    });

    res.json({ success: true, data: lowStock, error: null });
  } catch (err) {
    next(err);
  }
});

stockRouter.get('/batches/:productId', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const batches = await prisma.productBatch.findMany({
      where: { productId: req.params.productId, tenantId: tenantId! },
      orderBy: { expirationDate: 'asc' },
    });
    res.json({ success: true, data: batches, error: null });
  } catch (err) {
    next(err);
  }
});

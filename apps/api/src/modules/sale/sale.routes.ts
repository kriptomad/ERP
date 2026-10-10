import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate, requireRole } from '../../middlewares/auth.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';
import { DomainError } from '../../middlewares/error-handler.middleware';

const createSaleSchema = z.object({
  clientId: z.string().uuid().optional(),
  paymentMethod: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'STORE_CREDIT', 'BOLETO']),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    discount: z.number().min(0).default(0),
  })).min(1),
  discountAmount: z.number().min(0).default(0),
  taxAmount: z.number().min(0).default(0),
  notes: z.string().optional(),
});

export const saleRouter = Router();

saleRouter.use(authenticate);

saleRouter.get('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { status, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = {
      tenantId: tenantId!,
      ...(status && { status: status as string }),
    };

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: { items: true, client: true },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.sale.count({ where }),
    ]);

    res.json({
      success: true,
      data: { items: sales, total, page: parseInt(page as string), limit: parseInt(limit as string) },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

saleRouter.get('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const sale = await prisma.sale.findFirst({
      where: { id: req.params.id, tenantId: tenantId! },
      include: { items: true, client: true },
    });
    if (!sale) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Venda não encontrada.' } });
      return;
    }
    res.json({ success: true, data: sale, error: null });
  } catch (err) {
    next(err);
  }
});

saleRouter.post('/', async (req, res, next) => {
  try {
    const { tenantId, userId } = getRequestContext();
    const data = createSaleSchema.parse(req.body);

    const sale = await prisma.$transaction(async (tx: import('@prisma/client').Prisma.TransactionClient) => {
      let totalAmount = 0;
      const saleItems = [];

      for (const item of data.items) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, tenantId: tenantId! },
        });

        if (!product) {
          throw new DomainError('NOT_FOUND', `Produto ${item.productId} não encontrado.`);
        }

        if (product.stockQuantity < item.quantity) {
          throw new DomainError('INSUFFICIENT_STOCK', `Estoque insuficiente para ${product.name}.`);
        }

        const itemTotal = item.unitPrice * item.quantity - item.discount;
        totalAmount += itemTotal;

        saleItems.push({
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          totalPrice: itemTotal,
          costPrice: product.costPrice,
        });

        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            tenantId: tenantId!,
            productId: item.productId,
            type: 'SALE',
            quantity: item.quantity,
            referenceType: 'SALE',
            reason: 'Venda PDV',
          },
        });
      }

      totalAmount -= data.discountAmount;

      return tx.sale.create({
        data: {
          tenantId: tenantId!,
          userId: userId!,
          clientId: data.clientId,
          status: 'COMPLETED',
          paymentMethod: data.paymentMethod,
          totalAmount,
          discountAmount: data.discountAmount,
          taxAmount: data.taxAmount,
          notes: data.notes,
          items: { create: saleItems },
        },
        include: { items: true },
      });
    });

    res.status(201).json({ success: true, data: sale, error: null });
  } catch (err) {
    next(err);
  }
});

const refundSaleSchema = z.object({
  reason: z.string().min(1),
});

saleRouter.post('/:id/refund', requireRole('OWNER', 'MANAGER'), async (req, res, next) => {
  try {
    const { tenantId, userId } = getRequestContext();
    const { reason } = refundSaleSchema.parse(req.body);

    const sale = await prisma.$transaction(async (tx: import('@prisma/client').Prisma.TransactionClient) => {
      const existing = await tx.sale.findFirst({
        where: { id: req.params.id, tenantId: tenantId! },
      });

      if (!existing) {
        throw new DomainError('NOT_FOUND', 'Venda não encontrada.');
      }

      if (existing.status === 'REFUNDED') {
        throw new DomainError('CONFLICT', 'Venda já foi estornada.');
      }

      const updated = await tx.sale.update({
        where: { id: req.params.id },
        data: {
          status: 'REFUNDED',
          refundReason: reason,
          refundRequestedBy: userId!,
          refundedAt: new Date(),
        },
      });

      for (const item of await tx.saleItem.findMany({ where: { saleId: req.params.id } })) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            tenantId: tenantId!,
            productId: item.productId,
            type: 'RETURN',
            quantity: item.quantity,
            referenceType: 'SALE_REFUND',
            reason: `Estorno venda ${req.params.id}`,
          },
        });
      }

      return updated;
    });

    res.json({ success: true, data: sale, error: null });
  } catch (err) {
    next(err);
  }
});

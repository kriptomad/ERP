import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireModule } from '../../middlewares/module-gating.middleware';
import { logger } from '../../logging/structured-logger';

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
  loyaltyPointsRedeemed: z.number().min(0).default(0),
});

export const saleRouter = Router();

saleRouter.use(authenticate);

saleRouter.post('/', async (req, res, next) => {
  try {
    const context = getRequestContext();
    const tenantId = context.tenantId!;
    const userId = context.userId!;
    const data = createSaleSchema.parse(req.body);

    const sale = await prisma.$transaction(async (tx) => {
      let totalAmount = 0;
      const saleItems = [];

      for (const item of data.items) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, tenantId },
        });

        if (!product) {
          throw new Error(`Produto ${item.productId} não encontrado.`);
        }

        if (product.trackingType === 'BATCH') {
          const allocations = await allocateFefoBatches(tenantId, item.productId, item.quantity);
          if (allocations.reduce((sum, a) => sum + a.quantity, 0) < item.quantity) {
            throw new Error(`Estoque insuficiente para ${product.name} (FEFO).`);
          }
        } else if (product.stockQuantity.toNumber() < item.quantity) {
          throw new Error(`Estoque insuficiente para ${product.name}.`);
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
      }

      totalAmount -= data.discountAmount;

      let loyaltyDiscount = 0;
      if (data.loyaltyPointsRedeemed > 0 && data.clientId) {
        loyaltyDiscount = await redeemLoyaltyPointsInTx(tx, tenantId, data.clientId, data.loyaltyPointsRedeemed, '');
      }
      totalAmount -= loyaltyDiscount;

      const saleRecord = await tx.sale.create({
        data: {
          tenantId,
          userId,
          clientId: data.clientId,
          status: 'COMPLETED',
          paymentMethod: data.paymentMethod,
          totalAmount,
          discountAmount: data.discountAmount,
          taxAmount: data.taxAmount,
          notes: data.notes,
          channel: 'POS',
          items: { create: saleItems },
        },
        include: { items: true },
      });

      if (data.clientId) {
        await accrueLoyaltyPointsInTx(tx, tenantId, data.clientId, totalAmount, saleRecord.id);
      }

      if (data.paymentMethod === 'STORE_CREDIT' && data.clientId) {
        await debitCredit(tenantId, data.clientId, totalAmount, saleRecord.id);
      }

      return saleRecord;
    });

    logger.info('Sale completed', { saleId: sale.id, tenantId, userId, totalAmount: sale.totalAmount });

    res.status(201).json({ success: true, data: sale, error: null });
  } catch (err) {
    next(err);
  }
});

saleRouter.post('/:id/refund', async (req, res, next) => {
  try {
    const context = getRequestContext();
    const tenantId = context.tenantId!;
    const userId = context.userId!;

    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);

    const sale = await prisma.$transaction(async (tx) => {
      const existing = await tx.sale.findFirst({
        where: { id: req.params.id, tenantId },
        include: { items: true },
      });

      if (!existing) throw new Error('Venda não encontrada.');
      if (existing.status === 'REFUNDED') throw new Error('Venda já estornada.');

      const updated = await tx.sale.update({
        where: { id: req.params.id },
        data: {
          status: 'REFUNDED',
          refundReason: reason,
          refundRequestedBy: userId,
          refundedAt: new Date(),
        },
      });

      for (const item of existing.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            tenantId,
            productId: item.productId,
            type: 'RETURN',
            quantity: item.quantity,
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

import { getRequestContext } from '../../middlewares/request-context.middleware';
import { allocateFefoBatches } from '../stock/fefo.service';
import { accrueLoyaltyPointsInTx, redeemLoyaltyPointsInTx } from '../loyalty/loyalty.service';
import { debitCredit } from '../credit/credit.service';
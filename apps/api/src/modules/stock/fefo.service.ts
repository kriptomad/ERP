import { PrismaClient } from '@prisma/client';
import { DomainError } from '../../middlewares/error-handler.middleware';

const prisma = new PrismaClient();

export interface FefoAllocation {
  batchId: string;
  quantity: number;
  expirationDate: Date;
  costPrice: number | null;
}

/**
 * FEFO — First-Expire-First-Out.
 * Retorna os lotes que devem ser baixados para atender a quantidade solicitada,
 * priorizando sempre o lote com menor data de validade.
 * Bloqueia totalmente a venda se algum lote estiver vencido e o produto
 * exige controle de validade (requiresPrescriptionRetention ou trackingType = BATCH).
 */
export async function allocateFefoBatches(
  tenantId: string,
  productId: string,
  quantity: number,
  options: { allowExpired?: boolean } = {},
): Promise<FefoAllocation[]> {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
  });

  if (!product) {
    throw new DomainError('NOT_FOUND', 'Produto não encontrado.');
  }

  if (product.stockQuantity.toNumber() < quantity) {
    throw new DomainError(
      'INSUFFICIENT_STOCK',
      `Estoque insuficiente para ${product.name}. Disponível: ${product.stockQuantity}, Solicitado: ${quantity}.`,
    );
  }

  const batches = await prisma.productBatch.findMany({
    where: { productId, tenantId, quantity: { gt: 0 } },
    orderBy: { expirationDate: 'asc' },
  });

  const totalAvailable = batches.reduce((sum, b) => sum + b.quantity.toNumber(), 0);
  if (totalAvailable < quantity) {
    throw new DomainError(
      'INSUFFICIENT_STOCK',
      `Soma dos lotes (${totalAvailable}) insuficiente para ${quantity}.`,
    );
  }

  const expiredBatch = batches.find((b) => b.expirationDate < new Date());
  if (expiredBatch && !options.allowExpired) {
    throw new DomainError(
      'EXPIRED_BATCH',
      `Lote ${expiredBatch.batchNumber} vencido em ${expiredBatch.expirationDate.toISOString().slice(0, 10)}. Venda bloqueada.`,
    );
  }

  const allocations: FefoAllocation[] = [];
  let remaining = quantity;

  for (const batch of batches) {
    if (remaining <= 0) break;
    const available = batch.quantity.toNumber();
    const take = Math.min(available, remaining);
    allocations.push({
      batchId: batch.id,
      quantity: take,
      expirationDate: batch.expirationDate,
      costPrice: batch.costPrice?.toNumber() ?? null,
    });
    remaining -= take;
  }

  return allocations;
}

export async function consumeFefoBatches(
  tenantId: string,
  productId: string,
  allocations: FefoAllocation[],
): Promise<void> {
  for (const alloc of allocations) {
    await prisma.$transaction(async (tx: import('@prisma/client').Prisma.TransactionClient) => {
      await tx.productBatch.update({
        where: { id: alloc.batchId },
        data: { quantity: { decrement: alloc.quantity } },
      });

      await tx.stockMovement.create({
        data: {
          tenantId,
          productId,
          batchId: alloc.batchId,
          type: 'SALE',
          quantity: alloc.quantity,
          unitCost: alloc.costPrice ?? undefined,
          reason: 'Venda PDV (FEFO)',
        },
      });
    });
  }
}

export async function validateExpiredBatches(tenantId: string): Promise<Array<{
  productId: string;
  productName: string;
  batchNumber: string;
  expirationDate: Date;
  quantity: number;
}>> {
  const expired = await prisma.productBatch.findMany({
    where: { tenantId, expirationDate: { lt: new Date() }, quantity: { gt: 0 } },
    include: { product: { select: { id: true, name: true } } },
    orderBy: { expirationDate: 'asc' },
  });

  return expired.map((b) => ({
    productId: b.productId,
    productName: b.product.name,
    batchNumber: b.batchNumber,
    expirationDate: b.expirationDate,
    quantity: b.quantity.toNumber(),
  }));
}

export async function getExpiringBatches(
  tenantId: string,
  days: number,
): Promise<Array<{
  productId: string;
  productName: string;
  batchNumber: string;
  expirationDate: Date;
  quantity: number;
}>> {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + days);

  const batches = await prisma.productBatch.findMany({
    where: { tenantId, expirationDate: { gte: new Date(), lte: targetDate }, quantity: { gt: 0 } },
    include: { product: { select: { id: true, name: true } } },
    orderBy: { expirationDate: 'asc' },
  });

  return batches.map((b) => ({
    productId: b.productId,
    productName: b.product.name,
    batchNumber: b.batchNumber,
    expirationDate: b.expirationDate,
    quantity: b.quantity.toNumber(),
  }));
}

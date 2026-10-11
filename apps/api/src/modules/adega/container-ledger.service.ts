import { PrismaClient } from '@prisma/client';
import { DomainError } from '../../middlewares/error-handler.middleware';

const prisma = new PrismaClient();

/**
 * Conta-corrente de cascos (vasilhames retornáveis).
 * REGRA: separada da conta-corrente financeira — rastreia POSSE FÍSICA do vasilhame.
 *
 * BORROWED — cliente levou o casco (venda de produto retornável)
 * RETURNED — cliente devolveu o casco
 *
 * Se o cliente não devolve em N dias (configurável), o sistema sugere
 * cobrar o valor de reposição do casco como item avulso na próxima venda.
 */

const DEFAULT_RETURN_PERIOD_DAYS = 30;

export async function borrowContainer(
  tenantId: string,
  clientId: string,
  productId: string,
  quantity: number,
): Promise<void> {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
  });

  if (!product) {
    throw new DomainError('NOT_FOUND', 'Produto não encontrado.');
  }

  if (!product.isReturnableContainer) {
    throw new DomainError('NOT_RETURNABLE_CONTAINER', 'Este produto não possui vasilhame retornável.');
  }

  await prisma.returnableContainerLedger.create({
    data: {
      tenantId,
      clientId,
      productId,
      movementType: 'BORROWED',
      quantity,
    },
  });
}

export async function returnContainer(
  tenantId: string,
  clientId: string,
  productId: string,
  quantity: number,
): Promise<void> {
  await prisma.returnableContainerLedger.create({
    data: {
      tenantId,
      clientId,
      productId,
      movementType: 'RETURNED',
      quantity,
    },
  });
}

export async function getContainerBalance(
  tenantId: string,
  clientId: string,
): Promise<Array<{
  productId: string;
  productName: string;
  borrowed: number;
  returned: number;
  balance: number;
  unitValue: number | null;
  suggestedCharge: boolean;
}>> {
  const entries = await prisma.returnableContainerLedger.findMany({
    where: { tenantId, clientId },
    include: { product: { select: { id: true, name: true, unitPrice: true, isReturnableContainer: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const byProduct = new Map<string, {
    productId: string;
    productName: string;
    borrowed: number;
    returned: number;
    unitValue: number | null;
    lastBorrowedAt: Date | null;
  }>();

  for (const entry of entries) {
    const existing = byProduct.get(entry.productId) ?? {
      productId: entry.productId,
      productName: entry.product.name,
      borrowed: 0,
      returned: 0,
      unitValue: entry.product.unitPrice.toNumber(),
      lastBorrowedAt: null,
    };

    if (entry.movementType === 'BORROWED') {
      existing.borrowed += entry.quantity;
      existing.lastBorrowedAt = entry.createdAt;
    } else {
      existing.returned += entry.quantity;
    }

    byProduct.set(entry.productId, existing);
  }

  const result: Array<{
    productId: string;
    productName: string;
    borrowed: number;
    returned: number;
    balance: number;
    unitValue: number | null;
    suggestedCharge: boolean;
  }> = [];

  for (const [productId, data] of byProduct) {
    const balance = data.borrowed - data.returned;
    let suggestedCharge = false;

    if (balance > 0 && data.lastBorrowedAt) {
      const daysSinceBorrow = Math.floor(
        (Date.now() - data.lastBorrowedAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysSinceBorrow > DEFAULT_RETURN_PERIOD_DAYS) {
        suggestedCharge = true;
      }
    }

    result.push({
      productId,
      productName: data.productName,
      borrowed: data.borrowed,
      returned: data.returned,
      balance,
      unitValue: data.unitValue,
      suggestedCharge,
    });
  }

  return result;
}

export async function suggestContainerCharges(
  tenantId: string,
  clientId: string,
): Promise<Array<{
  productId: string;
  productName: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  daysOverdue: number;
}>> {
  const balances = await getContainerBalance(tenantId, clientId);
  const entries = await getEntries(tenantId, clientId);

  return balances
    .filter((b) => b.suggestedCharge && b.unitValue !== null)
    .map((b) => {
      const lastEntry = entries.find(
        (e) => e.productId === b.productId && e.movementType === 'BORROWED',
      );
      const daysOverdue = lastEntry
        ? Math.floor((Date.now() - lastEntry.createdAt.getTime()) / (1000 * 60 * 60 * 24)) - DEFAULT_RETURN_PERIOD_DAYS
        : DEFAULT_RETURN_PERIOD_DAYS;

      return {
        productId: b.productId,
        productName: b.productName,
        quantity: b.balance,
        unitValue: b.unitValue ?? 0,
        totalValue: b.balance * (b.unitValue ?? 0),
        daysOverdue,
      };
    });
}

async function getEntries(tenantId: string, clientId: string) {
  return prisma.returnableContainerLedger.findMany({
    where: { tenantId, clientId },
    include: { product: { select: { id: true, name: true, unitPrice: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listEntries(tenantId: string, clientId: string) {
  return getEntries(tenantId, clientId);
}

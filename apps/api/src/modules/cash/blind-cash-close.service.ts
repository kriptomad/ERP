import { PrismaClient } from '@prisma/client';
import { DomainError } from '../../middlewares/error-handler.middleware';

const prisma = new PrismaClient();

export interface CashCountInput {
  cash?: number;
  creditCard?: number;
  debitCard?: number;
  pix?: number;
  storeCredit?: number;
  boleto?: number;
}

export interface BlindCloseResult {
  registerId: string;
  expectedAmount: number | null;
  countedAmount: number;
  divergence: number;
  status: 'MATCHED' | 'SURPLUS' | 'SHORTFALL';
}

/**
 * Gaveta Cega — Blind Cash Close.
 *
 * REGRA DE NEGÓCIO: o operador NÃO vê o valor esperado pelo sistema até
 * confirmar a contagem física. Isso evita que o fechamento seja "ajustado"
 * para bater com o valor exibido, prática que mascara furtos e erros.
 *
 * Fluxo:
 * 1. Operador informa a contagem física por meio de pagamento.
 * 2. Sistema calcula o total contado.
 * 3. SENTÃO o sistema exibe o valor esperado e a divergência.
 */
export async function blindCloseCashRegister(
  tenantId: string,
  registerId: string,
  count: CashCountInput,
  closedByUserId: string,
): Promise<BlindCloseResult> {
  const register = await prisma.cashRegister.findFirst({
    where: { id: registerId, tenantId },
    include: {
      sales: {
        where: { status: 'COMPLETED' },
        select: { paymentMethod: true, totalAmount: true },
      },
      movements: {
        select: { type: true, amount: true },
      },
    },
  });

  if (!register) {
    throw new DomainError('NOT_FOUND', 'Caixa não encontrado.');
  }

  if (register.status === 'CLOSED') {
    throw new DomainError('CONFLICT', 'Caixa já está fechado.');
  }

  // Calcula o valor esperado pelo sistema
  let expectedAmount = register.openingAmount.toNumber();

  for (const sale of register.sales) {
    expectedAmount += sale.totalAmount.toNumber();
  }

  for (const movement of register.movements) {
    if (movement.type === 'SUPPLY') {
      expectedAmount += movement.amount.toNumber();
    } else if (movement.type === 'SANGRIA') {
      expectedAmount -= movement.amount.toNumber();
    }
  }

  // Calcula o total contado pelo operador
  const countedAmount =
    (count.cash ?? 0) +
    (count.creditCard ?? 0) +
    (count.debitCard ?? 0) +
    (count.pix ?? 0) +
    (count.storeCredit ?? 0) +
    (count.boleto ?? 0);

  const divergence = countedAmount - expectedAmount;
  const status = divergence === 0 ? 'MATCHED' : divergence > 0 ? 'SURPLUS' : 'SHORTFALL';

  await prisma.cashRegister.update({
    where: { id: registerId },
    data: {
      status: 'CLOSED',
      closedAt: new Date(),
      closedBy: closedByUserId,
      closingAmount: countedAmount,
      expectedAmount,
    },
  });

  return {
    registerId,
    expectedAmount,
    countedAmount,
    divergence,
    status,
  };
}

/**
 * Retorna o resumo do caixa SEM revelar o valor esperado.
 * Usado na tela de fechamento antes da contagem.
 */
export function getBlindCloseSummary(register: {
  openingAmount: { toNumber(): number };
  sales: Array<{ paymentMethod: string; totalAmount: { toNumber(): number } }>;
  movements: Array<{ type: string; amount: { toNumber(): number } }>;
}): {
  openingAmount: number;
  salesTotal: number;
  suppliesTotal: number;
  sangriasTotal: number;
  paymentBreakdown: Record<string, number>;
} {
  const openingAmount = register.openingAmount.toNumber();
  let salesTotal = 0;
  const paymentBreakdown: Record<string, number> = {};
  let suppliesTotal = 0;
  let sangriasTotal = 0;

  for (const sale of register.sales) {
    const amount = sale.totalAmount.toNumber();
    salesTotal += amount;
    paymentBreakdown[sale.paymentMethod] = (paymentBreakdown[sale.paymentMethod] ?? 0) + amount;
  }

  for (const movement of register.movements) {
    if (movement.type === 'SUPPLY') {
      suppliesTotal += movement.amount.toNumber();
    } else if (movement.type === 'SANGRIA') {
      sangriasTotal += movement.amount.toNumber();
    }
  }

  return {
    openingAmount,
    salesTotal,
    suppliesTotal,
    sangriasTotal,
    paymentBreakdown,
  };
}

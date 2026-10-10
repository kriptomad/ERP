import { PrismaClient } from '@prisma/client';
import { DomainError } from '../../middlewares/error-handler.middleware';

const prisma = new PrismaClient();

/**
 * Crediário / Fiado — Varejo Geral.
 *
 * REGRA: cada Client tem creditLimit configurado pelo lojista.
 * Vendas a prazo (STORE_CREDIT) debitam o saldo disponível.
 * O sistema BLOQUEIA automaticamente novas vendas a prazo quando
 * o saldo utilizado atinge o limite.
 */

export interface CreditCheckResult {
  approved: boolean;
  availableLimit: number;
  usedLimit: number;
  totalLimit: number;
  message?: string;
}

export async function checkCreditAvailability(
  tenantId: string,
  clientId: string,
  requestedAmount: number,
): Promise<CreditCheckResult> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId },
  });

  if (!client) {
    throw new DomainError('NOT_FOUND', 'Cliente não encontrado.');
  }

  const totalLimit = client.creditLimit.toNumber();
  const usedLimit = client.creditBalanceUsed.toNumber();
  const availableLimit = totalLimit - usedLimit;

  const approved = availableLimit >= requestedAmount;

  return {
    approved,
    availableLimit,
    usedLimit,
    totalLimit,
    message: approved
      ? undefined
      : `Limite de crédito excedido. Disponível: R$ ${availableLimit.toFixed(2)}, Solicitado: R$ ${requestedAmount.toFixed(2)}.`,
  };
}

export async function debitCredit(
  tenantId: string,
  clientId: string,
  amount: number,
  saleId: string,
): Promise<void> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId },
  });

  if (!client) {
    throw new DomainError('NOT_FOUND', 'Cliente não encontrado.');
  }

  const newBalance = client.creditBalanceUsed.toNumber() + amount;

  if (newBalance > client.creditLimit.toNumber()) {
    throw new DomainError(
      'CREDIT_LIMIT_EXCEEDED',
      `Limite de crédito excedido. Disponível: R$ ${(client.creditLimit.toNumber() - client.creditBalanceUsed.toNumber()).toFixed(2)}, Solicitado: R$ ${amount.toFixed(2)}.`,
    );
  }

  await prisma.$transaction(async (tx: import('@prisma/client').Prisma.TransactionClient) => {
    await tx.client.update({
      where: { id: clientId },
      data: { creditBalanceUsed: newBalance },
    });

    await tx.accountReceivable.create({
      data: {
        tenantId,
        clientId,
        saleId,
        description: `Venda fiada #${saleId}`,
        amount,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        category: 'CREDIT_SALE',
      },
    });
  });
}

export async function settleCredit(
  tenantId: string,
  clientId: string,
  amount: number,
): Promise<void> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId },
  });

  if (!client) {
    throw new DomainError('NOT_FOUND', 'Cliente não encontrado.');
  }

  const newBalance = Math.max(0, client.creditBalanceUsed.toNumber() - amount);

  await prisma.client.update({
    where: { id: clientId },
    data: { creditBalanceUsed: newBalance },
  });
}

export async function getCreditStatement(tenantId: string, clientId: string) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId },
    include: {
      accountsReceivable: {
        where: { status: 'PENDING' },
        orderBy: { dueDate: 'asc' },
      },
    },
  });

  if (!client) {
    throw new DomainError('NOT_FOUND', 'Cliente não encontrado.');
  }

  const pendingTotal = client.accountsReceivable.reduce(
    (sum, ar) => sum + ar.amount.toNumber(),
    0,
  );

  return {
    clientId: client.id,
    name: client.name,
    creditLimit: client.creditLimit.toNumber(),
    usedLimit: client.creditBalanceUsed.toNumber(),
    availableLimit: client.creditLimit.toNumber() - client.creditBalanceUsed.toNumber(),
    pendingInstallments: client.accountsReceivable.length,
    pendingTotal,
    isBlocked: client.creditBalanceUsed.toNumber() >= client.creditLimit.toNumber(),
  };
}

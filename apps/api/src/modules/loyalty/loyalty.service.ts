import { PrismaClient } from '@prisma/client';
import { DomainError } from '../../middlewares/error-handler.middleware';

const prisma = new PrismaClient();

/**
 * Acrual de pontos de fidelidade na MESMA transação da venda.
 * Nunca em job assíncrono separado — o saldo precisa refletir a venda imediatamente.
 */
export async function accrueLoyaltyPointsInTx(
  tx: import('@prisma/client').Prisma.TransactionClient,
  tenantId: string,
  clientId: string,
  saleTotal: number,
  saleId: string,
): Promise<number> {
  const program = await tx.loyaltyProgram.findUnique({
    where: { tenantId },
  });

  if (!program?.active) return 0;

  const earnedPoints = Math.floor(saleTotal * program.pointsPerCurrencyUnit.toNumber());
  if (earnedPoints <= 0) return 0;

  const account = await tx.loyaltyAccount.upsert({
    where: { clientId },
    create: { tenantId, clientId, pointsBalance: earnedPoints },
    update: { pointsBalance: { increment: earnedPoints } },
  });

  await tx.loyaltyTransaction.create({
    data: {
      loyaltyAccountId: account.id,
      type: 'EARN',
      points: earnedPoints,
      saleId,
      expiresAt: program.pointsExpireAfterDays
        ? new Date(Date.now() + program.pointsExpireAfterDays * 24 * 60 * 60 * 1000)
        : null,
    },
  });

  return earnedPoints;
}

/**
 * Resgate de pontos com lock otimista.
 * Usa updateMany com condição de saldo suficiente para evitar race condition
 * de resgate duplo em duas abas do PDV simultâneas.
 * Retorna o valor em R$ a abater no total da venda.
 */
export async function redeemLoyaltyPointsInTx(
  tx: import('@prisma/client').Prisma.TransactionClient,
  tenantId: string,
  clientId: string,
  pointsToRedeem: number,
  saleId: string,
): Promise<number> {
  const program = await tx.loyaltyProgram.findFirst({
    where: { tenantId, active: true },
  });

  if (!program) {
    throw new DomainError('LOYALTY_PROGRAM_NOT_ACTIVE', 'Programa de fidelidade não está ativo.');
  }

  if (pointsToRedeem < program.minPointsToRedeem) {
    throw new DomainError(
      'LOYALTY_REDEMPTION_BELOW_MINIMUM',
      `Mínimo de ${program.minPointsToRedeem} pontos para resgate.`,
      { minPointsToRedeem: program.minPointsToRedeem },
    );
  }

  const result = await tx.loyaltyAccount.updateMany({
    where: { clientId, pointsBalance: { gte: pointsToRedeem } },
    data: { pointsBalance: { decrement: pointsToRedeem } },
  });

  if (result.count === 0) {
    throw new DomainError('INSUFFICIENT_LOYALTY_POINTS', 'Saldo de pontos insuficiente.');
  }

  const account = await tx.loyaltyAccount.findUniqueOrThrow({
    where: { clientId },
  });

  await tx.loyaltyTransaction.create({
    data: {
      loyaltyAccountId: account.id,
      type: 'REDEEM',
      points: -pointsToRedeem,
      saleId,
    },
  });

  return pointsToRedeem * program.redemptionValuePerPoint.toNumber();
}

/**
 * Job diário de expiração FIFO de pontos.
 * Varre transações EARN com expiresAt <= now() ainda não compensadas.
 * Notifica o cliente antes da expiração efetiva.
 */
export async function expireLoyaltyPoints(
  tenantId: string,
  notifyFn?: (clientId: string, points: number) => Promise<void>,
): Promise<{ expiredAccounts: number; totalPointsExpired: number }> {
  const now = new Date();

  const expiringTransactions = await prisma.loyaltyTransaction.findMany({
    where: {
      type: 'EARN',
      expiresAt: { lte: now },
      loyaltyAccount: { tenantId },
      points: { gt: 0 },
    },
    include: { loyaltyAccount: true },
  });

  let expiredAccounts = 0;
  let totalPointsExpired = 0;

  for (const txn of expiringTransactions) {
    const result = await prisma.loyaltyTransaction.create({
      data: {
        loyaltyAccountId: txn.loyaltyAccountId,
        type: 'EXPIRE',
        points: -txn.points,
        reason: `Expiração automática (expiresAt: ${txn.expiresAt?.toISOString()})`,
      },
    });

    await prisma.loyaltyAccount.update({
      where: { id: txn.loyaltyAccountId },
      data: { pointsBalance: { decrement: txn.points } },
    });

    totalPointsExpired += txn.points;
    expiredAccounts++;

    if (notifyFn) {
      await notifyFn(txn.loyaltyAccount.clientId, txn.points);
    }
  }

  return { expiredAccounts, totalPointsExpired };
}

export async function getLoyaltyStatus(tenantId: string, clientId: string) {
  const account = await prisma.loyaltyAccount.findUnique({
    where: { clientId },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });

  const program = await prisma.loyaltyProgram.findUnique({
    where: { tenantId },
  });

  return {
    account,
    program,
    canRedeem: account && program ? account.pointsBalance >= program.minPointsToRedeem : false,
  };
}

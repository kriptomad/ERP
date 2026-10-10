import { prisma } from '../../infra/prisma';

export async function accrueLoyaltyPoints(
  tenantId: string,
  clientId: string,
  saleTotal: number,
  saleId: string,
): Promise<void> {
  const program = await prisma.loyaltyProgram.findUnique({
    where: { tenantId },
  });

  if (!program?.active) return;

  const earnedPoints = Math.floor(saleTotal * program.pointsPerCurrencyUnit.toNumber());
  if (earnedPoints <= 0) return;

  const account = await prisma.loyaltyAccount.upsert({
    where: { clientId },
    create: { tenantId, clientId, pointsBalance: earnedPoints },
    update: { pointsBalance: { increment: earnedPoints } },
  });

  await prisma.loyaltyTransaction.create({
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
}

export async function redeemLoyaltyPoints(
  tenantId: string,
  clientId: string,
  pointsToRedeem: number,
  saleId: string,
): Promise<number> {
  const program = await prisma.loyaltyProgram.findFirstOrThrow({
    where: { tenantId, active: true },
  });

  if (pointsToRedeem < program.minPointsToRedeem) {
    throw new Error(`Mínimo de ${program.minPointsToRedeem} pontos para resgate`);
  }

  const result = await prisma.loyaltyAccount.updateMany({
    where: { clientId, pointsBalance: { gte: pointsToRedeem } },
    data: { pointsBalance: { decrement: pointsToRedeem } },
  });

  if (result.count === 0) {
    throw new Error('Saldo de pontos insuficiente');
  }

  const account = await prisma.loyaltyAccount.findUniqueOrThrow({
    where: { clientId },
  });

  await prisma.loyaltyTransaction.create({
    data: { loyaltyAccountId: account.id, type: 'REDEEM', points: -pointsToRedeem, saleId },
  });

  return pointsToRedeem * program.redemptionValuePerPoint.toNumber();
}

import { PrismaClient } from '@prisma/client';
import { addDays, isAfter } from 'date-fns';
import { billingQueue } from './queue';

const prisma = new PrismaClient();

const RETRY_SCHEDULE_DAYS = [1, 3, 5, 7];

export async function handlePaymentFailure(tenantId: string, subscriptionId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) return;

  const attempt = subscription.failedPaymentAttempts + 1;
  const retryInDays = RETRY_SCHEDULE_DAYS[Math.min(attempt - 1, RETRY_SCHEDULE_DAYS.length - 1)];
  const nextRetryAt = addDays(new Date(), retryInDays);

  await prisma.$transaction(async (tx: import('@prisma/client').Prisma.TransactionClient) => {
    await tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        failedPaymentAttempts: attempt,
        nextRetryAt,
        status: attempt >= RETRY_SCHEDULE_DAYS.length ? 'SUSPENDED' : 'PAST_DUE',
      },
    });

    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        status: attempt >= RETRY_SCHEDULE_DAYS.length ? 'SUSPENDED' : 'PAST_DUE',
        gracePeriodEndsAt: attempt === 1 ? addDays(new Date(), 7) : undefined,
      },
    });
  });

  await billingQueue.add('notify-payment-failed', {
    type: 'notify-payment-failed',
    tenantId,
    subscriptionId,
    attempt,
  });

  if (attempt >= RETRY_SCHEDULE_DAYS.length) {
    await billingQueue.add('suspend-overdue-tenant', {
      type: 'suspend-overdue-tenant',
      tenantId,
      subscriptionId,
    });
  }

  return { attempt, nextRetryAt };
}

export async function handlePaymentRecovered(tenantId: string, subscriptionId: string) {
  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        failedPaymentAttempts: 0,
        nextRetryAt: null,
        status: 'ACTIVE',
      },
    }),
    prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: 'ACTIVE',
        gracePeriodEndsAt: null,
      },
    }),
  ]);
}

export async function processCancelAtPeriodEnd(tenantId: string, subscriptionId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription || !subscription.cancelAtPeriodEnd) return;

  const now = new Date();
  if (subscription.currentPeriodEnd && isAfter(now, subscription.currentPeriodEnd)) {
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'CANCELLED' },
    });

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'CANCELLED' },
    });
  }
}

export async function applyReferralReward(referredTenantId: string) {
  const referral = await prisma.referral.findUnique({
    where: { referredTenantId },
    include: { referralCode: true },
  });

  if (!referral || referral.status !== 'PENDING') return;

  if (isAfter(new Date(), referral.expiresAt)) {
    await prisma.referral.update({
      where: { id: referral.id },
      data: { status: 'EXPIRED' },
    });
    return;
  }

  await prisma.$transaction(async (tx: import('@prisma/client').Prisma.TransactionClient) => {
    const referrerSub = await tx.subscription.findFirst({
      where: { tenantId: referral.referralCode.tenantId },
      orderBy: { createdAt: 'desc' },
    });
    if (referrerSub) {
      await tx.subscription.update({
        where: { id: referrerSub.id },
        data: { creditBalanceMonths: { increment: 1 } },
      });
    }

    const referredSub = await tx.subscription.findFirst({
      where: { tenantId: referredTenantId },
      orderBy: { createdAt: 'desc' },
    });
    if (referredSub) {
      await tx.subscription.update({
        where: { id: referredSub.id },
        data: { firstCycleDiscountPercent: 20 },
      });
    }

    await tx.referral.update({
      where: { id: referral.id },
      data: { status: 'CONVERTED', rewardAppliedAt: new Date() },
    });
  });
}

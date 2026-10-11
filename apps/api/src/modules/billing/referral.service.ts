import { PrismaClient } from '@prisma/client';
import { logger } from '../../logging/structured-logger';

const prisma = new PrismaClient();

const REFERRAL_EXPIRY_DAYS = 90;
const REFERRER_REWARD_MONTHS = 1;
const REFEREE_FIRST_CYCLE_DISCOUNT = 20;

export function generateReferralCode(tradeName: string): string {
  const base = tradeName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${base}${suffix}`;
}

export async function createReferralCode(tenantId: string, tradeName: string): Promise<{ code: string }> {
  const existing = await prisma.referralCode.findUnique({ where: { tenantId } });
  if (existing) {
    return { code: existing.code };
  }

  let code = generateReferralCode(tradeName);
  let attempts = 0;

  while (attempts < 10) {
    try {
      const created = await prisma.referralCode.create({
        data: { tenantId, code },
      });
      return { code: created.code };
    } catch {
      code = generateReferralCode(tradeName);
      attempts++;
    }
  }

  throw new Error('Failed to generate unique referral code');
}

export async function processReferralOnSignup(
  referredTenantId: string,
  referralCode: string,
): Promise<{ success: boolean; referralId?: string }> {
  const referrerCode = await prisma.referralCode.findUnique({
    where: { code: referralCode },
    include: { tenant: true },
  });

  if (!referrerCode) {
    return { success: false };
  }

  if (referrerCode.tenantId === referredTenantId) {
    return { success: false };
  }

  const existing = await prisma.referral.findUnique({
    where: { referredTenantId },
  });

  if (existing) {
    return { success: false };
  }

  const expiresAt = new Date(Date.now() + REFERRAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const referral = await prisma.referral.create({
    data: {
      referralCodeId: referrerCode.id,
      referredTenantId,
      status: 'PENDING',
      expiresAt,
    },
  });

  return { success: true, referralId: referral.id };
}

export async function applyReferralRewardOnFirstPayment(
  referredTenantId: string,
): Promise<void> {
  const referral = await prisma.referral.findUnique({
    where: { referredTenantId },
    include: { referralCode: true },
  });

  if (!referral || referral.status !== 'PENDING') return;
  if (referral.expiresAt < new Date()) {
    await prisma.referral.update({
      where: { id: referral.id },
      data: { status: 'EXPIRED' },
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    const referrerSub = await tx.subscription.findFirst({
      where: { tenantId: referral.referralCode.tenantId },
      orderBy: { createdAt: 'desc' },
    });
    if (referrerSub) {
      await tx.subscription.update({
        where: { id: referrerSub.id },
        data: { creditBalanceMonths: { increment: REFERRER_REWARD_MONTHS } },
      });
    }

    const referredSub = await tx.subscription.findFirst({
      where: { tenantId: referredTenantId },
      orderBy: { createdAt: 'desc' },
    });
    if (referredSub) {
      await tx.subscription.update({
        where: { id: referredSub.id },
        data: { firstCycleDiscountPercent: REFEREE_FIRST_CYCLE_DISCOUNT },
      });
    }

    await tx.referral.update({
      where: { id: referral.id },
      data: { status: 'CONVERTED', rewardAppliedAt: new Date() },
    });
  });

  logger.info('Referral reward applied', {
    referrerTenantId: referral.referralCode.tenantId,
    referredTenantId,
  });
}

export async function getReferralStats(tenantId: string) {
  const code = await prisma.referralCode.findUnique({
    where: { tenantId },
    include: {
      referrals: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!code) return { code: null, totalReferrals: 0, converted: 0, creditMonths: 0 };

  const subscription = await prisma.subscription.findFirst({
    where: { tenantId },
    select: { creditBalanceMonths: true },
  });

  return {
    code: code.code,
    totalReferrals: code.referrals.length,
    converted: code.referrals.filter((r) => r.status === 'CONVERTED').length,
    creditMonths: subscription?.creditBalanceMonths ?? 0,
    referrals: code.referrals.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt,
      rewardAppliedAt: r.rewardAppliedAt,
    })),
  };
}

export async function getReferralLink(tenantId: string): Promise<string> {
  const baseUrl = process.env.WEB_URL || 'http://localhost:3001';
  const code = await prisma.referralCode.findUnique({
    where: { tenantId },
    select: { code: true },
  });
  return `${baseUrl}/cadastro?ref=${code?.code}`;
}
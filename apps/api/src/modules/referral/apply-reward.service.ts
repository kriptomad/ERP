import { prismaUnscoped } from "@filitech/database";

/** Cap. 2.8 — crédito de assinatura, nunca cashback */
export async function applyReferralRewardOnFirstPayment(referredTenantId: string) {
  const referral = await prismaUnscoped.referral.findUnique({
    where: { referredTenantId },
    include: { referralCode: true },
  });
  if (!referral || referral.status !== "PENDING") return;
  if (referral.expiresAt < new Date()) {
    await prismaUnscoped.referral.update({
      where: { id: referral.id },
      data: { status: "EXPIRED" },
    });
    return;
  }

  await prismaUnscoped.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { tenantId: referral.referralCode.tenantId },
      data: { creditBalanceMonths: { increment: 1 } },
    });
    await tx.subscription.update({
      where: { tenantId: referredTenantId },
      data: { firstCycleDiscountPercent: 20 },
    });
    await tx.referral.update({
      where: { id: referral.id },
      data: { status: "CONVERTED", rewardAppliedAt: new Date() },
    });
  });
}

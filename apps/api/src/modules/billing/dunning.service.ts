import { prismaUnscoped } from "@filitech/database";
import { DUNNING_RETRY_SCHEDULE_DAYS } from "@filitech/shared";

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function handlePaymentFailure(tenantId: string, subscriptionId: string) {
  return prismaUnscoped.$transaction(async (tx) => {
    const subscription = await tx.subscription.update({
      where: { id: subscriptionId },
      data: { failedPaymentAttempts: { increment: 1 } },
    });
    const attempt = subscription.failedPaymentAttempts;
    const retryInDays =
      DUNNING_RETRY_SCHEDULE_DAYS[
        Math.min(attempt - 1, DUNNING_RETRY_SCHEDULE_DAYS.length - 1)
      ];
    const nextRetryAt = addDays(new Date(), retryInDays);
    await tx.subscription.update({
      where: { id: subscriptionId },
      data: { nextRetryAt, status: "PAST_DUE" },
    });
    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        status: "PAST_DUE",
        gracePeriodEndsAt: attempt === 1 ? addDays(new Date(), 7) : undefined,
      },
    });
    if (attempt >= DUNNING_RETRY_SCHEDULE_DAYS.length) {
      await tx.subscription.update({ where: { id: subscriptionId }, data: { status: "SUSPENDED" } });
      await tx.tenant.update({ where: { id: tenantId }, data: { status: "SUSPENDED" } });
    }
    return { attempt, nextRetryAt };
  });
}

export async function handlePaymentRecovered(tenantId: string, subscriptionId: string) {
  await prismaUnscoped.$transaction([
    prismaUnscoped.subscription.update({
      where: { id: subscriptionId },
      data: { failedPaymentAttempts: 0, nextRetryAt: null, status: "ACTIVE" },
    }),
    prismaUnscoped.tenant.update({
      where: { id: tenantId },
      data: { status: "ACTIVE", gracePeriodEndsAt: null },
    }),
  ]);
}

import { prismaUnscoped } from "@filitech/database";

const MS_DAY = 86400000;

export async function requestCancelSubscription(tenantId: string) {
  const sub = await prismaUnscoped.subscription.findFirst({
    where: { tenantId, status: { in: ["ACTIVE", "TRIAL", "PAST_DUE"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!sub) throw new Error("NO_ACTIVE_SUBSCRIPTION");
  const now = new Date();
  const withinCoolingOff =
    sub.firstChargedAt && now.getTime() - sub.firstChargedAt.getTime() <= 7 * MS_DAY;

  if (withinCoolingOff) {
    await prismaUnscoped.$transaction([
      prismaUnscoped.subscription.update({
        where: { id: sub.id },
        data: { cancelRequestedAt: now, cancelAtPeriodEnd: false, status: "CANCELLED" },
      }),
      prismaUnscoped.tenant.update({ where: { id: tenantId }, data: { status: "CANCELLED" } }),
      prismaUnscoped.billingEvent.create({
        data: {
          subscriptionId: sub.id,
          provider: sub.provider,
          externalEventKey: `art49_refund_${sub.id}_${now.getTime()}`,
          type: "ART49_FULL_REFUND",
          payload: { reason: "CDC Art. 49" },
        },
      }),
    ]);
    return { mode: "IMMEDIATE_REFUND" as const, subscriptionId: sub.id };
  }

  await prismaUnscoped.subscription.update({
    where: { id: sub.id },
    data: { cancelRequestedAt: now, cancelAtPeriodEnd: true },
  });
  return { mode: "END_OF_PERIOD" as const, subscriptionId: sub.id, accessUntil: sub.currentPeriodEnd };
}

export async function keepSubscription(tenantId: string) {
  const sub = await prismaUnscoped.subscription.findFirst({
    where: { tenantId, cancelAtPeriodEnd: true },
  });
  if (!sub) throw new Error("NO_PENDING_CANCEL");
  await prismaUnscoped.subscription.update({
    where: { id: sub.id },
    data: { cancelRequestedAt: null, cancelAtPeriodEnd: false },
  });
  return { kept: true, subscriptionId: sub.id };
}

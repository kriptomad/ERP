import { prismaUnscoped } from "@filitech/database";

/** Cap. 2.7.4 — após esgotar dunning, garante SUSPENDED */
export async function runSuspendOverdueJob() {
  const now = new Date();
  const pastDue = await prismaUnscoped.subscription.findMany({
    where: {
      status: "PAST_DUE",
      failedPaymentAttempts: { gte: 4 },
      nextRetryAt: { lte: now },
    },
    take: 100,
  });

  for (const sub of pastDue) {
    await prismaUnscoped.$transaction([
      prismaUnscoped.subscription.update({
        where: { id: sub.id },
        data: { status: "SUSPENDED" },
      }),
      prismaUnscoped.tenant.update({
        where: { id: sub.tenantId },
        data: { status: "SUSPENDED" },
      }),
    ]);
  }
  return { suspended: pastDue.length };
}

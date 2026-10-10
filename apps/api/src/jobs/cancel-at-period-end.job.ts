import { prismaUnscoped } from "@filitech/database";

/** Cap. 2.7.6 — efetiva cancelAtPeriodEnd no fim do ciclo */
export async function runCancelAtPeriodEndJob() {
  const now = new Date();
  const due = await prismaUnscoped.subscription.findMany({
    where: {
      cancelAtPeriodEnd: true,
      status: { in: ["ACTIVE", "PAST_DUE"] },
      currentPeriodEnd: { lte: now },
    },
    take: 100,
  });

  for (const sub of due) {
    await prismaUnscoped.$transaction([
      prismaUnscoped.subscription.update({
        where: { id: sub.id },
        data: { status: "CANCELLED" },
      }),
      prismaUnscoped.tenant.update({
        where: { id: sub.tenantId },
        data: { status: "CANCELLED" },
      }),
    ]);
  }
  return { cancelled: due.length };
}

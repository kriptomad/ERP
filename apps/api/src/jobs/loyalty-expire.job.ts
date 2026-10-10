import { prismaUnscoped } from "@filitech/database";

/** Cap. 4.1.1 — expira pontos com expiresAt < now */
export async function runLoyaltyExpirationJob() {
  const due = await prismaUnscoped.loyaltyTransaction.findMany({
    where: {
      type: "EARN",
      expiresAt: { lte: new Date() },
      // ainda não "consumidos" por EXPIRE
    },
    take: 500,
  });

  let expired = 0;
  for (const tx of due) {
    await prismaUnscoped.$transaction(async (db) => {
      const already = await db.loyaltyTransaction.findFirst({
        where: {
          loyaltyAccountId: tx.loyaltyAccountId,
          type: "EXPIRE",
          reason: `expire_of_${tx.id}`,
        },
      });
      if (already) return;

      await db.loyaltyAccount.update({
        where: { id: tx.loyaltyAccountId },
        data: { pointsBalance: { decrement: Math.max(0, tx.points) } },
      });
      await db.loyaltyTransaction.create({
        data: {
          loyaltyAccountId: tx.loyaltyAccountId,
          type: "EXPIRE",
          points: -Math.abs(tx.points),
          reason: `expire_of_${tx.id}`,
        },
      });
      expired++;
    });
  }
  return { expired };
}

import { prismaUnscoped } from "@filitech/database";

/** Cap. 4.1.1 — redeem com lock otimista no pointsBalance */
export async function redeemLoyaltyPoints(params: {
  tenantId: string;
  clientId: string;
  points: number;
}) {
  if (params.points <= 0) throw new Error("POINTS_MUST_BE_POSITIVE");

  return prismaUnscoped.$transaction(async (tx) => {
    const program = await tx.loyaltyProgram.findUniqueOrThrow({
      where: { tenantId: params.tenantId },
    });
    if (!program.active) throw new Error("LOYALTY_INACTIVE");
    if (params.points < program.minPointsToRedeem) {
      throw new Error("BELOW_MIN_REDEEM");
    }

    const account = await tx.loyaltyAccount.findUniqueOrThrow({
      where: { clientId: params.clientId },
    });
    if (account.pointsBalance < params.points) throw new Error("INSUFFICIENT_POINTS");

    const updated = await tx.loyaltyAccount.updateMany({
      where: { id: account.id, pointsBalance: account.pointsBalance },
      data: { pointsBalance: { decrement: params.points } },
    });
    if (updated.count === 0) throw new Error("CONCURRENT_REDEEM_RETRY");

    const value =
      params.points * Number(program.redemptionValuePerPoint);

    await tx.loyaltyTransaction.create({
      data: {
        loyaltyAccountId: account.id,
        type: "REDEEM",
        points: -params.points,
        reason: "REDEEM",
      },
    });

    return { pointsRedeemed: params.points, creditValue: value };
  });
}

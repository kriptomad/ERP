import { createHash, randomBytes } from "crypto";
import { prismaUnscoped } from "@filitech/database";

const TTL_MS = 72 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueWorkOrderApprovalToken(workOrderId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_MS);
  await prismaUnscoped.workOrder.update({
    where: { id: workOrderId },
    data: {
      approvalTokenHash: hashToken(token),
      approvalTokenExpiresAt: expiresAt,
      status: "AWAITING_APPROVAL",
    },
  });
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return {
    token,
    expiresAt,
    publicUrl: `${base}/os/aprovar/${token}`,
  };
}

export async function approveWorkOrderByToken(token: string) {
  const hash = hashToken(token);
  const wo = await prismaUnscoped.workOrder.findFirst({
    where: { approvalTokenHash: hash, status: "AWAITING_APPROVAL" },
  });
  if (!wo) throw new Error("INVALID_OR_USED_TOKEN");
  if (wo.approvalTokenExpiresAt && wo.approvalTokenExpiresAt < new Date()) {
    throw new Error("TOKEN_EXPIRED");
  }
  return prismaUnscoped.workOrder.update({
    where: { id: wo.id },
    data: {
      status: "IN_REPAIR",
      approvalTokenHash: null,
      approvalTokenExpiresAt: null,
    },
  });
}

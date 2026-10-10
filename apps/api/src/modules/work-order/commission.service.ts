import { prismaUnscoped } from "@filitech/database";

/** Cap. 4 Assistência — comissão só no DELIVERED, do técnico que executou */
export async function markWorkOrderDelivered(params: {
  workOrderId: string;
  tenantId: string;
  commissionPercent?: number;
}) {
  const wo = await prismaUnscoped.workOrder.findFirstOrThrow({
    where: { id: params.workOrderId, tenantId: params.tenantId },
  });
  if (wo.status !== "READY") throw new Error("WO_MUST_BE_READY");
  if (!wo.assignedTechnicianId) throw new Error("NO_TECHNICIAN_ASSIGNED");

  const labor = Number(wo.laborAmount ?? 0);
  const pct = params.commissionPercent ?? 30;
  const commission = (labor * pct) / 100;

  const updated = await prismaUnscoped.workOrder.update({
    where: { id: wo.id },
    data: { status: "DELIVERED" },
  });

  return {
    workOrder: updated,
    commission: {
      technicianId: wo.assignedTechnicianId,
      amount: commission,
      percent: pct,
      basis: labor,
    },
  };
}

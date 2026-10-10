import { createPosSale } from "./create-sale.service";
import { prismaUnscoped } from "@filitech/database";

/** Cap. 6 — PDV offline-first: replay com offlineId único por tenant */
export async function syncOfflineSales(params: {
  tenantId: string;
  userId: string;
  sales: {
    offlineId: string;
    clientId?: string;
    cashRegisterId?: string;
    paymentMethod: string;
    items: { productId: string; quantity: number; unitPrice?: number }[];
    createdAt?: string;
  }[];
}) {
  const results: { offlineId: string; saleId?: string; status: "CREATED" | "DUPLICATE" | "ERROR"; error?: string }[] = [];

  for (const s of params.sales) {
    const existing = await prismaUnscoped.sale.findFirst({
      where: { tenantId: params.tenantId, offlineId: s.offlineId },
    });
    if (existing) {
      results.push({ offlineId: s.offlineId, saleId: existing.id, status: "DUPLICATE" });
      continue;
    }
    try {
      const sale = await createPosSale({
        tenantId: params.tenantId,
        userId: params.userId,
        clientId: s.clientId,
        cashRegisterId: s.cashRegisterId,
        paymentMethod: s.paymentMethod,
        items: s.items,
      });
      await prismaUnscoped.sale.update({
        where: { id: sale.id },
        data: { offlineId: s.offlineId },
      });
      results.push({ offlineId: s.offlineId, saleId: sale.id, status: "CREATED" });
    } catch (e) {
      results.push({
        offlineId: s.offlineId,
        status: "ERROR",
        error: e instanceof Error ? e.message : "SYNC_FAILED",
      });
    }
  }
  return results;
}

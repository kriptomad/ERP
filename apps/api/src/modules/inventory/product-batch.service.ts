import type { Prisma } from "@prisma/client";
import { selectFefoBatches, type BatchRow } from "./fefo.service";

/**
 * Cap. 4 Farmácia/Mercado — FEFO na venda.
 * Quando ProductBatch existir no Prisma, usar este fluxo no createPosSale.
 */
export async function consumeBatchesFefo(
  tx: {
    $queryRaw: <T>(q: TemplateStringsArray, ...v: unknown[]) => Promise<T>;
    productBatch?: {
      findMany: (args: unknown) => Promise<BatchRow[]>;
      update: (args: unknown) => Promise<unknown>;
    };
  },
  productId: string,
  tenantId: string,
  qtyNeeded: number,
) {
  if (!tx.productBatch) {
    // Schema ainda sem ProductBatch — caller usa stockQuantity cacheado
    return [] as { batchId: string; take: number }[];
  }

  const batches = await tx.productBatch.findMany({
    where: { productId, tenantId },
    orderBy: { expiresAt: "asc" },
  });

  const picks = selectFefoBatches(
    batches.map((b) => ({
      id: b.id,
      productId: b.productId,
      quantity: Number((b as BatchRow & { quantity: number }).quantity),
      expiresAt: b.expiresAt,
      blocked: b.blocked,
    })),
    qtyNeeded,
  );

  for (const pick of picks) {
    await tx.productBatch.update({
      where: { id: pick.batchId },
      data: { quantity: { decrement: pick.take } },
    });
  }
  return picks;
}

export function daysUntilExpiry(expiresAt: Date, from = new Date()): number {
  return Math.ceil((expiresAt.getTime() - from.getTime()) / 86400000);
}

/** Alerta 30/60 dias (Cap. 4 Mercado) */
export function expiryAlertLevel(expiresAt: Date): "NONE" | "60D" | "30D" | "EXPIRED" {
  const d = daysUntilExpiry(expiresAt);
  if (d < 0) return "EXPIRED";
  if (d <= 30) return "30D";
  if (d <= 60) return "60D";
  return "NONE";
}

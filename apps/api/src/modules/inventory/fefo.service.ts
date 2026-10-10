/** Cap. 4 — FEFO: First Expire, First Out */

export type BatchRow = {
  id: string;
  productId: string;
  quantity: number;
  expiresAt: Date;
  blocked: boolean;
};

export function selectFefoBatches(
  batches: BatchRow[],
  qtyNeeded: number,
): { batchId: string; take: number }[] {
  const available = batches
    .filter((b) => !b.blocked && b.quantity > 0 && b.expiresAt > new Date())
    .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());

  let remaining = qtyNeeded;
  const picks: { batchId: string; take: number }[] = [];

  for (const batch of available) {
    if (remaining <= 0) break;
    const take = Math.min(batch.quantity, remaining);
    picks.push({ batchId: batch.id, take });
    remaining -= take;
  }

  if (remaining > 0) throw new Error("FEFO_INSUFFICIENT_VALID_BATCHES");
  return picks;
}

export function assertNoExpiredSale(batches: BatchRow[]) {
  if (batches.some((b) => b.expiresAt <= new Date() && !b.blocked)) {
    throw new Error("BLOCKED_EXPIRED_BATCH");
  }
}

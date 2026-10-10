/**
 * Cap. 4 Farmácia — retenção de receita + flags SNGPC.
 * Portaria 344/1998 controlados; SNCR gradual até 2026.
 */

export type PrescriptionInput = {
  clientId: string;
  productId: string;
  prescriptionNumber: string;
  prescribedAt: Date;
  isControlled: boolean;
  listCode?: string; // Lista B, etc.
};

export function assertCanSellControlled(
  product: { isControlledSubstance: boolean; requiresPrescriptionRetention: boolean },
  prescription: PrescriptionInput | null,
) {
  if (!product.isControlledSubstance) return;
  if (!prescription) throw new Error("PRESCRIPTION_REQUIRED");
  if (product.requiresPrescriptionRetention && !prescription.prescriptionNumber) {
    throw new Error("PRESCRIPTION_RETENTION_REQUIRED");
  }
}

export function buildPrescriptionRecord(input: PrescriptionInput) {
  return {
    ...input,
    retainedAt: new Date(),
    sngpcStatus: input.isControlled ? "PENDING_TRANSMISSION" : "N_A",
  };
}

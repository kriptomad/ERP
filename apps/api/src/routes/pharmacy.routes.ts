import { Router } from "express";
import { z } from "zod";
import { requireSession, type AuthedRequest } from "../middlewares/session.middleware";
import { requireModule } from "../middlewares/module-gating.middleware";
import { requireTenantType } from "../middlewares/tenant-type.middleware";
import { prismaUnscoped } from "@filitech/database";
import {
  assertCanSellControlled,
  buildPrescriptionRecord,
} from "../modules/pharmacy/prescription.service";

export const pharmacyRouter = Router();
pharmacyRouter.use(requireSession);
pharmacyRouter.use(requireTenantType("BUSINESS"));
pharmacyRouter.use(requireModule("PHARMACY_SNGPC"));

pharmacyRouter.post("/prescriptions", async (req: AuthedRequest, res) => {
  const p = z
    .object({
      clientId: z.string().uuid(),
      productId: z.string().uuid(),
      prescriptionNumber: z.string().min(1),
      prescribedAt: z.string().datetime().or(z.string().min(8)),
      listCode: z.string().optional(),
      saleId: z.string().uuid().optional(),
    })
    .safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ success: false, error: p.error.flatten() });
    return;
  }
  const product = await prismaUnscoped.product.findFirstOrThrow({
    where: { id: p.data.productId, tenantId: req.tenantId! },
  });
  try {
    assertCanSellControlled(
      {
        isControlledSubstance: product.isControlledSubstance,
        requiresPrescriptionRetention: product.requiresPrescriptionRetention,
      },
      {
        clientId: p.data.clientId,
        productId: p.data.productId,
        prescriptionNumber: p.data.prescriptionNumber,
        prescribedAt: new Date(p.data.prescribedAt),
        isControlled: product.isControlledSubstance,
        listCode: p.data.listCode,
      },
    );
  } catch (e) {
    res.status(400).json({
      success: false,
      error: { code: e instanceof Error ? e.message : "PRESCRIPTION_BLOCK" },
    });
    return;
  }
  const rec = buildPrescriptionRecord({
    clientId: p.data.clientId,
    productId: p.data.productId,
    prescriptionNumber: p.data.prescriptionNumber,
    prescribedAt: new Date(p.data.prescribedAt),
    isControlled: product.isControlledSubstance,
    listCode: p.data.listCode,
  });
  const row = await prismaUnscoped.prescriptionRecord.create({
    data: {
      tenantId: req.tenantId!,
      clientId: rec.clientId,
      productId: rec.productId,
      prescriptionNumber: rec.prescriptionNumber,
      prescribedAt: rec.prescribedAt,
      retainedAt: rec.retainedAt,
      listCode: rec.listCode,
      sngpcStatus: rec.sngpcStatus,
      saleId: p.data.saleId,
    },
  });
  res.status(201).json({ success: true, data: row });
});

pharmacyRouter.post("/batches", async (req: AuthedRequest, res) => {
  const p = z
    .object({
      productId: z.string().uuid(),
      batchCode: z.string().min(1),
      quantity: z.number().positive(),
      expiresAt: z.string(),
    })
    .safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ success: false, error: p.error.flatten() });
    return;
  }
  const batch = await prismaUnscoped.productBatch.create({
    data: {
      tenantId: req.tenantId!,
      productId: p.data.productId,
      batchCode: p.data.batchCode,
      quantity: p.data.quantity,
      expiresAt: new Date(p.data.expiresAt),
    },
  });
  await prismaUnscoped.product.update({
    where: { id: p.data.productId },
    data: { stockQuantity: { increment: p.data.quantity }, trackingType: "BATCH" },
  });
  res.status(201).json({ success: true, data: batch });
});

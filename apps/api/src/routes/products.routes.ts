import { Router } from "express";
import { z } from "zod";
import { requireSession } from "../middlewares/session.middleware";
import { requireTenantType } from "../middlewares/tenant-type.middleware";
import { prisma } from "@filitech/database";

export const productsRouter = Router();
productsRouter.use(requireSession);
productsRouter.use(requireTenantType("BUSINESS"));

productsRouter.get("/", async (_req, res) => {
  const data = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    take: 500,
  });
  res.json({ success: true, data });
});

productsRouter.post("/", async (req, res) => {
  const p = z
    .object({
      sku: z.string().min(1),
      name: z.string().min(1),
      barcode: z.string().optional(),
      unitPrice: z.number().positive(),
      costPrice: z.number().min(0).optional(),
      stockQuantity: z.number().min(0).optional(),
      trackingType: z.enum(["NONE", "BATCH", "SERIAL", "VARIANT"]).optional(),
      isControlledSubstance: z.boolean().optional(),
      requiresPrescriptionRetention: z.boolean().optional(),
      isReturnableContainer: z.boolean().optional(),
      isWeighted: z.boolean().optional(),
      ncm: z.string().optional(),
      category: z.string().optional(),
    })
    .safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ success: false, error: p.error.flatten() });
    return;
  }
  const product = await prisma.product.create({
    data: {
      sku: p.data.sku,
      name: p.data.name,
      barcode: p.data.barcode,
      unitPrice: p.data.unitPrice,
      costPrice: p.data.costPrice,
      stockQuantity: p.data.stockQuantity ?? 0,
      trackingType: p.data.trackingType ?? "NONE",
      isControlledSubstance: p.data.isControlledSubstance ?? false,
      requiresPrescriptionRetention: p.data.requiresPrescriptionRetention ?? false,
      isReturnableContainer: p.data.isReturnableContainer ?? false,
      isWeighted: p.data.isWeighted ?? false,
      ncm: p.data.ncm,
      category: p.data.category,
    },
  });
  res.status(201).json({ success: true, data: product });
});

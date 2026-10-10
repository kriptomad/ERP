import { Router } from "express";
import { z } from "zod";
import { requireSession, type AuthedRequest } from "../middlewares/session.middleware";
import { requireModule } from "../middlewares/module-gating.middleware";
import { requireTenantType } from "../middlewares/tenant-type.middleware";
import { prismaUnscoped } from "@filitech/database";
import {
  applyContainerMovement,
  computeReplacementCharge,
} from "../modules/liquor/container-ledger.service";

export const liquorRouter = Router();
liquorRouter.use(requireSession);
liquorRouter.use(requireTenantType("BUSINESS"));
liquorRouter.use(requireModule("LIQUOR_LEDGER"));

liquorRouter.post("/containers/move", async (req: AuthedRequest, res) => {
  const p = z
    .object({
      clientId: z.string().uuid(),
      productId: z.string().uuid(),
      delta: z.number(),
      depositUnitValue: z.number().min(0).optional(),
    })
    .safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ success: false, error: p.error.flatten() });
    return;
  }
  try {
    const ledger = await prismaUnscoped.returnableContainerLedger.upsert({
      where: {
        tenantId_clientId_productId: {
          tenantId: req.tenantId!,
          clientId: p.data.clientId,
          productId: p.data.productId,
        },
      },
      create: {
        tenantId: req.tenantId!,
        clientId: p.data.clientId,
        productId: p.data.productId,
        quantityHeld: Math.max(0, p.data.delta),
        depositUnitValue: p.data.depositUnitValue ?? 0,
      },
      update: {},
    });
    const next = applyContainerMovement(
      {
        clientId: ledger.clientId,
        productId: ledger.productId,
        quantityHeld: Number(ledger.quantityHeld),
        depositUnitValue: Number(ledger.depositUnitValue),
      },
      p.data.delta,
    );
    const updated = await prismaUnscoped.returnableContainerLedger.update({
      where: { id: ledger.id },
      data: { quantityHeld: next.quantityHeld },
    });
    res.json({ success: true, data: updated });
  } catch (e) {
    res.status(400).json({
      success: false,
      error: { code: e instanceof Error ? e.message : "MOVE_FAILED" },
    });
  }
});

liquorRouter.post("/containers/charge-replacement", async (req: AuthedRequest, res) => {
  const p = z
    .object({
      clientId: z.string().uuid(),
      productId: z.string().uuid(),
      unreturnedQty: z.number().positive(),
    })
    .safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ success: false, error: p.error.flatten() });
    return;
  }
  const ledger = await prismaUnscoped.returnableContainerLedger.findUniqueOrThrow({
    where: {
      tenantId_clientId_productId: {
        tenantId: req.tenantId!,
        clientId: p.data.clientId,
        productId: p.data.productId,
      },
    },
  });
  try {
    const charge = computeReplacementCharge(
      {
        clientId: ledger.clientId,
        productId: ledger.productId,
        quantityHeld: Number(ledger.quantityHeld),
        depositUnitValue: Number(ledger.depositUnitValue),
      },
      p.data.unreturnedQty,
    );
    await prismaUnscoped.returnableContainerLedger.update({
      where: { id: ledger.id },
      data: { quantityHeld: { decrement: p.data.unreturnedQty } },
    });
    res.json({ success: true, data: charge });
  } catch (e) {
    res.status(400).json({
      success: false,
      error: { code: e instanceof Error ? e.message : "CHARGE_FAILED" },
    });
  }
});

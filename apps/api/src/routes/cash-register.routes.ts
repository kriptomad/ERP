import { Router } from "express";
import { z } from "zod";
import { requireSession, type AuthedRequest } from "../middlewares/session.middleware";
import { prisma } from "@filitech/database";
import {
  closeCashRegisterBlind,
  getOpenRegisterPublic,
} from "../modules/cash-register/blind-close.service";

export const cashRegisterRouter = Router();
cashRegisterRouter.use(requireSession);

cashRegisterRouter.post("/open", async (req: AuthedRequest, res) => {
  const p = z.object({ openingFloat: z.number().min(0) }).safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ success: false, error: p.error.flatten() });
    return;
  }
  const existing = await prisma.cashRegister.findFirst({
    where: { status: "OPEN", userId: req.userId! },
  });
  if (existing) {
    res.status(409).json({ success: false, error: { code: "ALREADY_OPEN", id: existing.id } });
    return;
  }
  const reg = await prisma.cashRegister.create({
    data: { userId: req.userId!, openingFloat: p.data.openingFloat },
  });
  res.status(201).json({ success: true, data: { id: reg.id, openedAt: reg.openedAt } });
});

cashRegisterRouter.get("/:id", async (req, res) => {
  const data = await getOpenRegisterPublic(req.params.id);
  if (!data) {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND" } });
    return;
  }
  res.json({ success: true, data });
});

cashRegisterRouter.post("/:id/close-blind", async (req, res) => {
  const p = z
    .object({
      countedCash: z.number().min(0),
      countedDebit: z.number().min(0),
      countedCredit: z.number().min(0),
      countedPix: z.number().min(0),
    })
    .safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ success: false, error: p.error.flatten() });
    return;
  }
  try {
    const closed = await closeCashRegisterBlind({
      cashRegisterId: req.params.id,
      ...p.data,
    });
    res.json({
      success: true,
      data: {
        id: closed.id,
        expectedTotal: closed.expectedTotal,
        difference: closed.difference,
        closedAt: closed.closedAt,
      },
    });
  } catch (e) {
    res.status(400).json({ success: false, error: { code: e instanceof Error ? e.message : "FAIL" } });
  }
});

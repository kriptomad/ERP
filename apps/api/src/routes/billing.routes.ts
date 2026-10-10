import { Router } from "express";
import { z } from "zod";
import { requireSession, type AuthedRequest } from "../middlewares/session.middleware";
import {
  requestCancelSubscription,
  keepSubscription,
} from "../modules/billing/cancel-subscription.service";
import { activateModuleForTenant } from "../modules/billing/activate-module.service";
import { prismaUnscoped } from "@filitech/database";

export const billingRouter = Router();
billingRouter.use(requireSession);

billingRouter.get("/subscription", async (req: AuthedRequest, res) => {
  const sub = await prismaUnscoped.subscription.findFirst({
    where: { tenantId: req.tenantId! },
    include: { plan: true, billingEvents: { orderBy: { createdAt: "desc" }, take: 20 } },
    orderBy: { createdAt: "desc" },
  });
  res.json({
    success: true,
    data: sub ? { ...sub, paymentMethodToken: undefined } : null,
  });
});

billingRouter.post("/cancel", async (req: AuthedRequest, res) => {
  try {
    res.json({ success: true, data: await requestCancelSubscription(req.tenantId!) });
  } catch (e) {
    res.status(400).json({ success: false, error: { code: e instanceof Error ? e.message : "FAIL" } });
  }
});

billingRouter.post("/keep", async (req: AuthedRequest, res) => {
  try {
    res.json({ success: true, data: await keepSubscription(req.tenantId!) });
  } catch (e) {
    res.status(400).json({ success: false, error: { code: e instanceof Error ? e.message : "FAIL" } });
  }
});

billingRouter.post("/modules/:code/activate", async (req: AuthedRequest, res) => {
  try {
    const tm = await activateModuleForTenant({
      tenantId: req.tenantId!,
      moduleCode: req.params.code,
    });
    res.json({ success: true, data: tm });
  } catch (e) {
    res.status(400).json({
      success: false,
      error: { code: e instanceof Error ? e.message : "ACTIVATE_FAILED" },
    });
  }
});

billingRouter.get("/modules", async (req: AuthedRequest, res) => {
  const list = await prismaUnscoped.tenantModule.findMany({
    where: { tenantId: req.tenantId! },
  });
  res.json({ success: true, data: list });
});

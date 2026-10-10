import { Router } from "express";
import { z } from "zod";
import { requireSession, type AuthedRequest } from "../middlewares/session.middleware";
import { calculateDebtPayoffPlan } from "../modules/personal/debt-payoff.service";
import { calculateCarneLeaoSuggestion } from "../modules/personal/carne-leao.service";
import { createConnectToken } from "../modules/integrations/pluggy.service";
import { prismaUnscoped } from "@filitech/database";

export const personalAdvancedRouter = Router();
personalAdvancedRouter.use(requireSession);

personalAdvancedRouter.post("/debt-payoff", async (req: AuthedRequest, res) => {
  const p = z
    .object({
      debts: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          remainingAmount: z.number().positive(),
          interestRateMonthly: z.number().min(0),
          minimumInstallment: z.number().min(0),
        }),
      ),
      extraMonthlyBudget: z.number().min(0),
      strategy: z.enum(["AVALANCHE", "SNOWBALL"]),
    })
    .safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ success: false, error: p.error.flatten() });
    return;
  }
  const plan = calculateDebtPayoffPlan(
    p.data.debts,
    p.data.extraMonthlyBudget,
    p.data.strategy,
  );
  res.json({ success: true, data: { months: plan.length, plan } });
});

personalAdvancedRouter.post("/carne-leao", async (req: AuthedRequest, res) => {
  const p = z.object({ rendimentoTributavel: z.number().min(0) }).safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ success: false, error: p.error.flatten() });
    return;
  }
  res.json({
    success: true,
    data: calculateCarneLeaoSuggestion(p.data.rendimentoTributavel),
  });
});

personalAdvancedRouter.post("/open-finance/connect-token", async (req: AuthedRequest, res) => {
  const tenant = await prismaUnscoped.tenant.findUniqueOrThrow({
    where: { id: req.tenantId! },
  });
  if (tenant.tenantType !== "PERSONAL" && tenant.tenantType !== "BUSINESS") {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND" } });
    return;
  }
  try {
    const accessToken = await createConnectToken(req.tenantId!);
    res.json({ success: true, data: { accessToken } });
  } catch (e) {
    res.status(503).json({
      success: false,
      error: { code: e instanceof Error ? e.message : "PLUGGY_UNAVAILABLE" },
    });
  }
});

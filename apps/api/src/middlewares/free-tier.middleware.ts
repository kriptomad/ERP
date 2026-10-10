import type { Response, NextFunction } from "express";
import type { AuthedRequest } from "./session.middleware";
import { prismaUnscoped } from "@filitech/database";
import { FREE_TIER_LIMITS } from "@filitech/shared";

/** Cap. 2.4 — travas por volume no Tier Free (não por tempo) */
export async function enforceFreeTierSales(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  const sub = await prismaUnscoped.subscription.findFirst({
    where: { tenantId: req.tenantId! },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
  if (!sub || Number(sub.plan.basePrice) > 0) {
    next();
    return;
  }

  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const count = await prismaUnscoped.sale.count({
    where: { tenantId: req.tenantId!, createdAt: { gte: start } },
  });

  if (count >= FREE_TIER_LIMITS.salesPerMonth) {
    res.status(402).json({
      success: false,
      error: {
        code: "FREE_TIER_SALES_LIMIT",
        message: `Limite Free de ${FREE_TIER_LIMITS.salesPerMonth} vendas/mês atingido.`,
        details: { upsell: { checkoutUrl: "/api/v1/billing/upgrade" } },
      },
    });
    return;
  }
  next();
}

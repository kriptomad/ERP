import { Router } from "express";
import { z } from "zod";
import { requireSession, type AuthedRequest } from "../middlewares/session.middleware";
import { requireModule } from "../middlewares/module-gating.middleware";
import { getConsolidatedSales } from "../modules/multi-filial/consolidate.service";

export const multiFilialRouter = Router();
multiFilialRouter.use(requireSession);
multiFilialRouter.use(requireModule("MULTI_FILIAL"));

multiFilialRouter.get("/dashboard", async (req: AuthedRequest, res) => {
  const p = z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .safeParse(req.query);
  const from = p.success && p.data.from ? new Date(p.data.from) : new Date(new Date().setDate(1));
  const to = p.success && p.data.to ? new Date(p.data.to) : new Date();
  const data = await getConsolidatedSales({
    parentTenantId: req.tenantId!,
    from,
    to,
  });
  res.json({ success: true, data });
});

import { Router } from "express";
import { z } from "zod";
import { requireSession, type AuthedRequest } from "../middlewares/session.middleware";
import { requireModule } from "../middlewares/module-gating.middleware";
import { requireTenantType } from "../middlewares/tenant-type.middleware";
import { calculateSimplesAnexoI } from "../modules/fiscal/tax-engine.service";
import { emitNfce, cancelNfce } from "../modules/integrations/focus-nfe.service";

export const fiscalRouter = Router();
fiscalRouter.use(requireSession);
fiscalRouter.use(requireTenantType("BUSINESS"));

fiscalRouter.post(
  "/preview-tax",
  async (req: AuthedRequest, res) => {
    const p = z
      .object({ rbt12: z.number().min(0), saleAmount: z.number().positive() })
      .safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ success: false, error: p.error.flatten() });
      return;
    }
    res.json({
      success: true,
      data: calculateSimplesAnexoI(p.data.rbt12, p.data.saleAmount),
    });
  },
);

fiscalRouter.post(
  "/nfce",
  requireModule("FISCAL_NFCE"),
  async (req, res) => {
    const p = z
      .object({
        ref: z.string().min(1),
        payload: z.record(z.unknown()),
      })
      .safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ success: false, error: p.error.flatten() });
      return;
    }
    try {
      const result = await emitNfce(p.data);
      res.status(201).json({ success: true, data: result });
    } catch (e) {
      res.status(502).json({
        success: false,
        error: { code: e instanceof Error ? e.message : "FOCUS_FAILED" },
      });
    }
  },
);

fiscalRouter.delete(
  "/nfce/:ref",
  requireModule("FISCAL_NFCE"),
  async (req, res) => {
    const p = z.object({ justificativa: z.string().min(15) }).safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ success: false, error: p.error.flatten() });
      return;
    }
    try {
      const result = await cancelNfce({
        ref: req.params.ref,
        justificativa: p.data.justificativa,
      });
      res.json({ success: true, data: result });
    } catch (e) {
      res.status(502).json({
        success: false,
        error: { code: e instanceof Error ? e.message : "FOCUS_FAILED" },
      });
    }
  },
);

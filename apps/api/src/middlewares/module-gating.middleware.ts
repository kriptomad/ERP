import type { Request, Response, NextFunction } from "express";
import { prisma } from "@filitech/database";
import { MODULE_CATALOG } from "@filitech/shared";

export function requireModule(moduleCode: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = (req as Request & { tenantId?: string }).tenantId;
    if (!tenantId) {
      res.status(401).json({ success: false, error: { code: "UNAUTHORIZED" } });
      return;
    }
    const tm = await prisma.tenantModule.findUnique({
      where: { tenantId_moduleCode: { tenantId, moduleCode } },
    });
    if (!tm?.active) {
      const info = MODULE_CATALOG[moduleCode as keyof typeof MODULE_CATALOG];
      res.status(402).json({
        success: false,
        error: {
          code: "MODULE_NOT_ACTIVE",
          message: `Módulo '${info?.label ?? moduleCode}' não ativo.`,
          details: {
            upsell: {
              moduleCode,
              label: info?.label,
              monthlyPrice: info?.monthlyPrice,
              checkoutUrl: `/api/v1/billing/modules/${moduleCode}/activate`,
            },
          },
        },
      });
      return;
    }
    next();
  };
}

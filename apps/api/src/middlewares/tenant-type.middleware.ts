import type { Response, NextFunction } from "express";
import type { AuthedRequest } from "./session.middleware";
import { prismaUnscoped, TenantType } from "@filitech/database";

/** Cap. 6 — rota de domínio errado para o tenantType = 404 (não 403) */
export function requireTenantType(...allowed: TenantType[]) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const tenant = await prismaUnscoped.tenant.findUnique({
      where: { id: req.tenantId! },
    });
    if (!tenant || !allowed.includes(tenant.tenantType)) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND" } });
      return;
    }
    next();
  };
}

import type { Request, Response, NextFunction } from "express";
import { verifySessionToken } from "../auth/jwt.service";
import { runWithTenantContext, prismaUnscoped } from "@filitech/database";

export type AuthedRequest = Request & {
  tenantId?: string;
  userId?: string;
  role?: string;
};

export async function requireSession(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: { code: "UNAUTHORIZED" } });
    return;
  }
  try {
    const claims = verifySessionToken(header.slice(7));
    const tenant = await prismaUnscoped.tenant.findUnique({
      where: { id: claims.tenantId },
    });
    if (!tenant || tenant.status === "CANCELLED") {
      res.status(401).json({ success: false, error: { code: "TENANT_INACTIVE" } });
      return;
    }
    if (tenant.status === "SUSPENDED") {
      res.status(402).json({
        success: false,
        error: { code: "SUBSCRIPTION_SUSPENDED" },
      });
      return;
    }
    if (tenant.status === "PAST_DUE") {
      const inGrace =
        tenant.gracePeriodEndsAt && tenant.gracePeriodEndsAt > new Date();
      if (!inGrace) {
        res.status(402).json({
          success: false,
          error: { code: "PAYMENT_REQUIRED" },
        });
        return;
      }
    }
    req.tenantId = claims.tenantId;
    req.userId = claims.userId;
    req.role = claims.role;
    runWithTenantContext(
      { tenantId: claims.tenantId, userId: claims.userId, role: claims.role },
      () => next(),
    );
  } catch {
    res.status(401).json({ success: false, error: { code: "INVALID_TOKEN" } });
  }
}

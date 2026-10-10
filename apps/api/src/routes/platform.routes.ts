import { Router } from "express";
import { z } from "zod";
import { prismaUnscoped } from "@filitech/database";
import { verifyPassword } from "../auth/password.service";

export const platformRouter = Router();

async function requirePlatformAdmin(
  req: { headers: Record<string, string | string[] | undefined> },
  res: { status: (n: number) => { json: (b: unknown) => void } },
  next: () => void,
) {
  const email = String(req.headers["x-platform-admin-email"] ?? "");
  const password = String(req.headers["x-platform-admin-password"] ?? "");
  const expectedEmail = process.env.PLATFORM_ADMIN_EMAIL;
  const expectedHash = process.env.PLATFORM_ADMIN_PASSWORD_HASH;
  if (!expectedEmail || !expectedHash || email.toLowerCase() !== expectedEmail.toLowerCase()) {
    res.status(401).json({ success: false, error: { code: "PLATFORM_UNAUTHORIZED" } });
    return;
  }
  if (!(await verifyPassword(expectedHash, password))) {
    res.status(401).json({ success: false, error: { code: "PLATFORM_UNAUTHORIZED" } });
    return;
  }
  next();
}

platformRouter.use(requirePlatformAdmin as never);

platformRouter.get("/tenants", async (req, res) => {
  const data = await prismaUnscoped.tenant.findMany({
    where: {
      status: req.query.status as never,
      tenantType: req.query.tenantType as never,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      subscriptions: { orderBy: { createdAt: "desc" }, take: 1, include: { plan: true } },
      _count: { select: { users: true } },
    },
  });
  res.json({ success: true, data });
});

platformRouter.post("/tenants/:id/status", async (req, res) => {
  const p = z
    .object({ status: z.enum(["ACTIVE", "SUSPENDED", "CANCELLED"]), reason: z.string().min(3) })
    .safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ success: false, error: p.error.flatten() });
    return;
  }
  const data = await prismaUnscoped.tenant.update({
    where: { id: req.params.id },
    data: { status: p.data.status },
  });
  await prismaUnscoped.auditLog.create({
    data: {
      tenantId: data.id,
      action: "SET_TENANT_STATUS",
      entityType: "Tenant",
      entityId: data.id,
      metadata: { status: p.data.status, reason: p.data.reason },
    },
  });
  res.json({ success: true, data });
});

platformRouter.get("/plans", async (_req, res) => {
  res.json({ success: true, data: await prismaUnscoped.plan.findMany({ orderBy: { basePrice: "asc" } }) });
});

platformRouter.patch("/plans/:id", async (req, res) => {
  const p = z.object({ basePrice: z.number().min(0) }).safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ success: false, error: p.error.flatten() });
    return;
  }
  res.json({
    success: true,
    data: await prismaUnscoped.plan.update({
      where: { id: req.params.id },
      data: { basePrice: p.data.basePrice },
    }),
  });
});

platformRouter.get("/modules", async (_req, res) => {
  res.json({ success: true, data: await prismaUnscoped.module.findMany({ orderBy: { label: "asc" } }) });
});

platformRouter.patch("/modules/:id", async (req, res) => {
  const p = z.object({ monthlyPrice: z.number().min(0) }).safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ success: false, error: p.error.flatten() });
    return;
  }
  res.json({
    success: true,
    data: await prismaUnscoped.module.update({
      where: { id: req.params.id },
      data: { monthlyPrice: p.data.monthlyPrice },
    }),
  });
});

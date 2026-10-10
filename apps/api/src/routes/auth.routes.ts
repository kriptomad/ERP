import { Router } from "express";
import { z } from "zod";
import { prismaUnscoped } from "@filitech/database";
import { verifyPassword } from "../auth/password.service";
import { signSessionToken } from "../auth/jwt.service";
import {
  onboardBusiness,
  onboardPersonal,
  onboardAccountingOffice,
} from "../modules/onboarding/onboard.service";

export const authRouter = Router();

authRouter.post("/onboard/business", async (req, res) => {
  const schema = z.object({
    tradeName: z.string().min(2),
    legalName: z.string().min(2),
    cnpj: z.string().min(11),
    slug: z.string().optional(),
    ownerName: z.string().min(2),
    ownerEmail: z.string().email(),
    ownerPassword: z.string().min(8),
    termsVersion: z.string(),
    privacyVersion: z.string(),
    termsAccepted: z.literal(true),
    privacyAccepted: z.literal(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }
  try {
    const { tenant, owner } = await onboardBusiness(parsed.data);
    const token = signSessionToken({
      userId: owner.id,
      tenantId: tenant.id,
      role: "OWNER",
    });
    res.status(201).json({
      success: true,
      data: {
        token,
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          tenantType: tenant.tenantType,
          tradeName: tenant.tradeName,
        },
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: { code: "ONBOARD_FAILED" } });
  }
});

authRouter.post("/onboard/personal", async (req, res) => {
  const schema = z.object({
    householdName: z.string().min(2),
    ownerName: z.string().min(2),
    ownerEmail: z.string().email(),
    ownerPassword: z.string().min(8),
    termsVersion: z.string(),
    privacyVersion: z.string(),
    termsAccepted: z.literal(true),
    privacyAccepted: z.literal(true),
    invitePartnerEmail: z.string().email().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }
  try {
    const { tenant, owner } = await onboardPersonal(parsed.data);
    const token = signSessionToken({
      userId: owner.id,
      tenantId: tenant.id,
      role: "OWNER",
    });
    res.status(201).json({
      success: true,
      data: {
        token,
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          tenantType: tenant.tenantType,
          tradeName: tenant.tradeName,
        },
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: { code: "ONBOARD_FAILED" } });
  }
});

authRouter.post("/onboard/accounting-office", async (req, res) => {
  const schema = z.object({
    tradeName: z.string().min(2),
    legalName: z.string().min(2),
    cnpj: z.string().min(11),
    ownerName: z.string().min(2),
    ownerEmail: z.string().email(),
    ownerPassword: z.string().min(8),
    termsVersion: z.string(),
    privacyVersion: z.string(),
    termsAccepted: z.literal(true),
    privacyAccepted: z.literal(true),
    displayName: z.string().min(2),
    servicesOffered: z.array(z.string()).min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }
  try {
    const { tenant, owner } = await onboardAccountingOffice(parsed.data);
    const token = signSessionToken({
      userId: owner.id,
      tenantId: tenant.id,
      role: "OWNER",
    });
    res.status(201).json({
      success: true,
      data: {
        token,
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          tenantType: tenant.tenantType,
          tradeName: tenant.tradeName,
        },
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: { code: "ONBOARD_FAILED" } });
  }
});

authRouter.post("/login", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
    tenantSlug: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }
  const email = parsed.data.email.toLowerCase();
  const users = await prismaUnscoped.user.findMany({
    where: { email, active: true },
    include: { tenant: true },
  });
  let user = users[0];
  if (parsed.data.tenantSlug) {
    user = users.find((u) => u.tenant.slug === parsed.data.tenantSlug) ?? user;
  }
  if (!user || !(await verifyPassword(user.passwordHash, parsed.data.password))) {
    res.status(401).json({ success: false, error: { code: "INVALID_CREDENTIALS" } });
    return;
  }
  if (user.tenant.status === "SUSPENDED" || user.tenant.status === "CANCELLED") {
    res.status(402).json({
      success: false,
      error: { code: "TENANT_LOCKED", status: user.tenant.status },
    });
    return;
  }
  const token = signSessionToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
  });
  res.json({
    success: true,
    data: {
      token,
      requires2fa: Boolean(user.totpConfirmedAt),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      tenant: {
        id: user.tenant.id,
        slug: user.tenant.slug,
        tenantType: user.tenant.tenantType,
        tradeName: user.tenant.tradeName,
      },
    },
  });
});

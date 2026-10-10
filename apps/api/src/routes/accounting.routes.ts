import { Router } from "express";
import { z } from "zod";
import { requireSession, type AuthedRequest } from "../middlewares/session.middleware";
import { prismaUnscoped } from "@filitech/database";
import { generateMonthlyAccountingTasks } from "../modules/accounting/task-generator.service";
import {
  generateEcdI050Skeleton,
  generateEcfSkeleton,
} from "../modules/accounting/ecd-generator.service";

export const accountingRouter = Router();

accountingRouter.post("/engagements", requireSession, async (req: AuthedRequest, res) => {
  const p = z
    .object({
      accountingFirmTenantId: z.string().uuid(),
      scopes: z.array(z.string()).min(1),
    })
    .safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ success: false, error: p.error.flatten() });
    return;
  }
  const firm = await prismaUnscoped.tenant.findUnique({
    where: { id: p.data.accountingFirmTenantId },
  });
  if (!firm || firm.tenantType !== "ACCOUNTING_OFFICE") {
    res.status(400).json({ success: false, error: { code: "FIRM_NOT_ACCOUNTING_OFFICE" } });
    return;
  }
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 30);
  const engagement = await prismaUnscoped.accountingEngagement.create({
    data: {
      accountingFirmTenantId: p.data.accountingFirmTenantId,
      clientTenantId: req.tenantId!,
      scopes: p.data.scopes,
      status: "PENDING_ACCOUNTANT_ACCEPTANCE",
      acceptanceDeadlineAt: deadline,
    },
  });
  res.status(201).json({ success: true, data: engagement });
});

accountingRouter.post("/engagements/:id/accept", requireSession, async (req: AuthedRequest, res) => {
  try {
    const eng = await prismaUnscoped.accountingEngagement.findUniqueOrThrow({
      where: { id: req.params.id },
    });
    if (eng.accountingFirmTenantId !== req.tenantId) {
      res.status(403).json({ success: false, error: { code: "FORBIDDEN" } });
      return;
    }
    if (eng.status !== "PENDING_ACCOUNTANT_ACCEPTANCE") {
      res.status(400).json({ success: false, error: { code: "INVALID_STATUS" } });
      return;
    }
    if (new Date() > eng.acceptanceDeadlineAt) {
      res.status(400).json({ success: false, error: { code: "DEADLINE_EXPIRED" } });
      return;
    }
    const updated = await prismaUnscoped.accountingEngagement.update({
      where: { id: eng.id },
      data: {
        status: "ACTIVE",
        acceptedAt: new Date(),
        acceptedByUserId: req.userId,
      },
    });
    res.json({ success: true, data: updated });
  } catch (e) {
    res.status(400).json({ success: false, error: { code: e instanceof Error ? e.message : "FAIL" } });
  }
});

accountingRouter.get("/marketplace", requireSession, async (_req, res) => {
  const firms = await prismaUnscoped.accountingFirmProfile.findMany({
    where: { isListedInMarketplace: true },
    orderBy: { marketplaceRatingAverage: "desc" },
  });
  res.json({ success: true, data: firms });
});

accountingRouter.post("/engagements/:id/generate-tasks", requireSession, async (req: AuthedRequest, res) => {
  const p = z.object({ competence: z.string().regex(/^\d{4}-\d{2}$/) }).safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ success: false, error: p.error.flatten() });
    return;
  }
  try {
    const tasks = await generateMonthlyAccountingTasks({
      engagementId: req.params.id,
      competence: p.data.competence,
    });
    res.status(201).json({ success: true, data: tasks });
  } catch (e) {
    res.status(400).json({
      success: false,
      error: { code: e instanceof Error ? e.message : "FAIL" },
    });
  }
});

accountingRouter.post("/generate/ecd", requireSession, async (req: AuthedRequest, res) => {
  const p = z
    .object({
      cnpj: z.string().min(11),
      periodStart: z.string(),
      periodEnd: z.string(),
      lines: z.array(
        z.object({
          date: z.string(),
          accountCode: z.string(),
          description: z.string(),
          debit: z.number(),
          credit: z.number(),
        }),
      ),
    })
    .safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ success: false, error: p.error.flatten() });
    return;
  }
  const content = generateEcdI050Skeleton(p.data);
  res.json({ success: true, data: { content, format: "SPED_ECD_SKELETON" } });
});

accountingRouter.post("/generate/ecf", requireSession, async (req: AuthedRequest, res) => {
  const p = z
    .object({
      cnpj: z.string().min(11),
      year: z.number().int(),
      lucroLiquido: z.number(),
    })
    .safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ success: false, error: p.error.flatten() });
    return;
  }
  res.json({
    success: true,
    data: { content: generateEcfSkeleton(p.data), format: "SPED_ECF_SKELETON" },
  });
});

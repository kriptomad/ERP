import { Router } from "express";
import { z } from "zod";
import { requireSession, type AuthedRequest } from "../middlewares/session.middleware";
import { prismaUnscoped } from "@filitech/database";

export const personalRouter = Router();
personalRouter.use(requireSession);

personalRouter.post("/accounts", async (req: AuthedRequest, res) => {
  const tenant = await prismaUnscoped.tenant.findUniqueOrThrow({ where: { id: req.tenantId! } });
  if (tenant.tenantType !== "PERSONAL") {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND" } });
    return;
  }
  const p = z
    .object({
      name: z.string().min(1),
      type: z.enum(["CHECKING", "SAVINGS", "CREDIT_CARD", "WALLET"]),
      creditLimit: z.number().optional(),
      invoiceClosingDay: z.number().int().min(1).max(28).optional(),
      invoiceDueDay: z.number().int().min(1).max(28).optional(),
    })
    .safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ success: false, error: p.error.flatten() });
    return;
  }
  const account = await prismaUnscoped.personalAccount.create({
    data: {
      tenantId: req.tenantId!,
      name: p.data.name,
      type: p.data.type,
      creditLimit: p.data.creditLimit,
      invoiceClosingDay: p.data.invoiceClosingDay,
      invoiceDueDay: p.data.invoiceDueDay,
    },
  });
  res.status(201).json({ success: true, data: account });
});

personalRouter.get("/accounts", async (req: AuthedRequest, res) => {
  const accounts = await prismaUnscoped.personalAccount.findMany({
    where: { tenantId: req.tenantId!, archivedAt: null },
  });
  res.json({ success: true, data: accounts });
});

personalRouter.post("/transactions", async (req: AuthedRequest, res) => {
  const p = z
    .object({
      accountId: z.string().uuid(),
      type: z.enum(["INCOME", "EXPENSE"]),
      amount: z.number().positive(),
      description: z.string().min(1),
      categoryId: z.string().uuid().optional(),
      isPrivate: z.boolean().optional(),
    })
    .safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ success: false, error: p.error.flatten() });
    return;
  }
  const result = await prismaUnscoped.$transaction(async (tx) => {
    const account = await tx.personalAccount.findFirstOrThrow({
      where: { id: p.data.accountId, tenantId: req.tenantId! },
    });
    const delta = p.data.type === "INCOME" ? p.data.amount : -p.data.amount;
    const row = await tx.personalTransaction.create({
      data: {
        tenantId: req.tenantId!,
        accountId: account.id,
        createdByUserId: req.userId!,
        type: p.data.type,
        amount: p.data.amount,
        description: p.data.description,
        transactionDate: new Date(),
        categoryId: p.data.categoryId,
        isPrivate: p.data.isPrivate ?? false,
      },
    });
    await tx.personalAccount.update({
      where: { id: account.id },
      data: { currentBalance: { increment: delta } },
    });
    return row;
  });
  res.status(201).json({ success: true, data: result });
});

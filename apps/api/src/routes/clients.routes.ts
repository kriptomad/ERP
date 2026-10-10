import { Router } from "express";
import { z } from "zod";
import { requireSession, type AuthedRequest } from "../middlewares/session.middleware";
import { requireTenantType } from "../middlewares/tenant-type.middleware";
import { prisma } from "@filitech/database";

export const clientsRouter = Router();
clientsRouter.use(requireSession);
clientsRouter.use(requireTenantType("BUSINESS"));

clientsRouter.get("/", async (_req, res) => {
  const data = await prisma.client.findMany({ orderBy: { name: "asc" }, take: 200 });
  res.json({ success: true, data });
});

clientsRouter.post("/", async (req: AuthedRequest, res) => {
  const p = z
    .object({
      name: z.string().min(1),
      document: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      creditLimit: z.number().min(0).optional(),
    })
    .safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ success: false, error: p.error.flatten() });
    return;
  }
  const client = await prisma.client.create({
    data: {
      name: p.data.name,
      document: p.data.document,
      phone: p.data.phone,
      email: p.data.email,
      creditLimit: p.data.creditLimit ?? 0,
    },
  });
  res.status(201).json({ success: true, data: client });
});

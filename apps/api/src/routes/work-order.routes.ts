import { Router } from "express";
import { z } from "zod";
import { requireSession, type AuthedRequest } from "../middlewares/session.middleware";
import { requireModule } from "../middlewares/module-gating.middleware";
import { prisma } from "@filitech/database";
import {
  issueWorkOrderApprovalToken,
  approveWorkOrderByToken,
} from "../modules/work-order/approval-token.service";

export const workOrderRouter = Router();

workOrderRouter.post(
  "/",
  requireSession,
  requireModule("WORK_ORDER"),
  async (req: AuthedRequest, res) => {
    const p = z
      .object({
        clientId: z.string().uuid(),
        deviceDescription: z.string().min(3),
        imeiOrSerial: z.string().optional(),
      })
      .safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ success: false, error: p.error.flatten() });
      return;
    }
    const wo = await prisma.workOrder.create({
      data: {
        clientId: p.data.clientId,
        deviceDescription: p.data.deviceDescription,
        imeiOrSerial: p.data.imeiOrSerial,
        status: "RECEIVED",
      },
    });
    res.status(201).json({ success: true, data: wo });
  },
);

workOrderRouter.post(
  "/:id/request-approval",
  requireSession,
  requireModule("WORK_ORDER"),
  async (req, res) => {
    const body = z
      .object({
        quoteAmount: z.number().positive(),
        laborAmount: z.number().min(0),
        validDays: z.number().int().min(1).max(30).default(7),
      })
      .safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ success: false, error: body.error.flatten() });
      return;
    }
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + body.data.validDays);
    await prisma.workOrder.update({
      where: { id: req.params.id },
      data: {
        quoteAmount: body.data.quoteAmount,
        laborAmount: body.data.laborAmount,
        quoteValidUntil: validUntil,
      },
    });
    const issued = await issueWorkOrderApprovalToken(req.params.id);
    res.json({
      success: true,
      data: {
        publicUrl: issued.publicUrl,
        expiresAt: issued.expiresAt,
        token: issued.token,
      },
    });
  },
);

workOrderRouter.post("/public/approve/:token", async (req, res) => {
  try {
    const wo = await approveWorkOrderByToken(req.params.token);
    res.json({ success: true, data: { id: wo.id, status: wo.status } });
  } catch (e) {
    res.status(400).json({
      success: false,
      error: { code: e instanceof Error ? e.message : "APPROVE_FAILED" },
    });
  }
});

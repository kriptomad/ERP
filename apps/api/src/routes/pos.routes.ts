import { Router } from "express";
import { z } from "zod";
import { requireSession, type AuthedRequest } from "../middlewares/session.middleware";
import { createPosSale } from "../modules/pos/create-sale.service";

export const posRouter = Router();
posRouter.use(requireSession);

posRouter.post("/sales", async (req: AuthedRequest, res) => {
  const schema = z.object({
    clientId: z.string().uuid().optional(),
    cashRegisterId: z.string().uuid().optional(),
    paymentMethod: z.enum(["CASH", "DEBIT", "CREDIT", "PIX", "CREDIT_STORE"]),
    items: z
      .array(
        z.object({
          productId: z.string().uuid(),
          quantity: z.number().positive(),
          unitPrice: z.number().positive().optional(),
        }),
      )
      .min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }
  try {
    const sale = await createPosSale({
      tenantId: req.tenantId!,
      userId: req.userId!,
      ...parsed.data,
    });
    res.status(201).json({ success: true, data: sale });
  } catch (e) {
    const code = e instanceof Error ? e.message : "SALE_FAILED";
    res.status(code.startsWith("CREDIT_LIMIT") ? 402 : 400).json({
      success: false,
      error: { code },
    });
  }
});

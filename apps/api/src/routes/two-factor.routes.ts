import { Router } from "express";
import { z } from "zod";
import { requireSession, type AuthedRequest } from "../middlewares/session.middleware";
import {
  beginTotpEnrollment,
  confirmTotpEnrollment,
  disableTotp,
  verifyUserTotp,
} from "../modules/auth/two-factor.service";

export const twoFactorRouter = Router();
twoFactorRouter.use(requireSession);

twoFactorRouter.post("/enroll/start", async (req: AuthedRequest, res) => {
  try {
    res.json({ success: true, data: await beginTotpEnrollment(req.userId!) });
  } catch (e) {
    res.status(400).json({ success: false, error: { code: e instanceof Error ? e.message : "FAIL" } });
  }
});

twoFactorRouter.post("/enroll/confirm", async (req: AuthedRequest, res) => {
  const p = z.object({ code: z.string().min(6).max(8) }).safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ success: false, error: p.error.flatten() });
    return;
  }
  try {
    res.json({ success: true, data: await confirmTotpEnrollment(req.userId!, p.data.code) });
  } catch (e) {
    res.status(400).json({ success: false, error: { code: e instanceof Error ? e.message : "FAIL" } });
  }
});

twoFactorRouter.post("/verify", async (req: AuthedRequest, res) => {
  const p = z.object({ code: z.string().min(6).max(8) }).safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ success: false, error: p.error.flatten() });
    return;
  }
  const ok = await verifyUserTotp(req.userId!, p.data.code);
  if (!ok) {
    res.status(401).json({ success: false, error: { code: "INVALID_TOTP" } });
    return;
  }
  res.json({ success: true, data: { verified: true } });
});

twoFactorRouter.post("/disable", async (req: AuthedRequest, res) => {
  const p = z.object({ password: z.string().min(1) }).safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ success: false, error: p.error.flatten() });
    return;
  }
  try {
    await disableTotp(req.userId!, p.data.password);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, error: { code: e instanceof Error ? e.message : "FAIL" } });
  }
});

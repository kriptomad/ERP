import { Router } from "express";
import { runLoyaltyExpirationJob } from "../jobs/loyalty-expire.job";
import { runSuspendOverdueJob } from "../jobs/suspend-overdue.job";
import { runCancelAtPeriodEndJob } from "../jobs/cancel-at-period-end.job";

/**
 * Endpoints de disparo manual/cron (proteger em prod com secret).
 * Cap. 3 BullMQ — workers reais ligam nas mesmas funções.
 */
export const jobsRouter = Router();

function assertCronSecret(req: { headers: Record<string, unknown> }, res: {
  status: (n: number) => { json: (b: unknown) => void };
}): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev
  if (req.headers["x-cron-secret"] !== secret) {
    res.status(401).json({ success: false, error: { code: "UNAUTHORIZED" } });
    return false;
  }
  return true;
}

jobsRouter.post("/loyalty-expire", async (req, res) => {
  if (!assertCronSecret(req, res)) return;
  res.json({ success: true, data: await runLoyaltyExpirationJob() });
});

jobsRouter.post("/suspend-overdue", async (req, res) => {
  if (!assertCronSecret(req, res)) return;
  res.json({ success: true, data: await runSuspendOverdueJob() });
});

jobsRouter.post("/cancel-at-period-end", async (req, res) => {
  if (!assertCronSecret(req, res)) return;
  res.json({ success: true, data: await runCancelAtPeriodEndJob() });
});

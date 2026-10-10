import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.routes";
import { twoFactorRouter } from "./routes/two-factor.routes";
import { billingRouter } from "./routes/billing.routes";
import { posRouter } from "./routes/pos.routes";
import { cashRegisterRouter } from "./routes/cash-register.routes";
import { platformRouter } from "./routes/platform.routes";
import { accountingRouter } from "./routes/accounting.routes";
import { personalRouter } from "./routes/personal.routes";
import { workOrderRouter } from "./routes/work-order.routes";
import { billingWebhooksRouter } from "./routes/webhooks.billing.routes";
import { personalAdvancedRouter } from "./routes/personal-advanced.routes";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(cors({ origin: process.env.APP_URL ?? "http://localhost:3000" }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "filitech-api",
    products: ["BUSINESS", "PERSONAL", "ACCOUNTING_OFFICE"],
    megaPrompt: true,
    repo: "kriptomad/ERP",
    phase: "2.0",
  });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/auth/2fa", twoFactorRouter);
app.use("/api/v1/billing", billingRouter);
app.use("/api/v1/pos", posRouter);
app.use("/api/v1/cash-registers", cashRegisterRouter);
app.use("/api/v1/platform", platformRouter);
app.use("/api/v1/accounting", accountingRouter);
app.use("/api/v1/personal", personalRouter);
app.use("/api/v1/personal", personalAdvancedRouter);
app.use("/api/v1/work-orders", workOrderRouter);
app.use("/api/v1/webhooks/billing", billingWebhooksRouter);

app.listen(PORT, () => {
  console.log(`[filitech-api] kriptomad/ERP phase-2.0 on :${PORT}`);
});

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
import { clientsRouter } from "./routes/clients.routes";
import { productsRouter } from "./routes/products.routes";
import { fiscalRouter } from "./routes/fiscal.routes";
import { jobsRouter } from "./routes/jobs.routes";
import { bakeryRouter } from "./routes/bakery.routes";
import { liquorRouter } from "./routes/liquor.routes";
import { pharmacyRouter } from "./routes/pharmacy.routes";
import { multiFilialRouter } from "./routes/multi-filial.routes";
import { pluggyWebhooksRouter } from "./routes/webhooks.pluggy.routes";

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
    phase: "3.4",
  });
});

app.get("/status", (_req, res) => {
  res.json({
    api: "operational",
    phase: "3.4",
    components: {
      auth: "up",
      billing: "up",
      pos: "up",
      fiscal: "up",
      personal: "up",
      accounting: "up",
    },
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
app.use("/api/v1/webhooks/pluggy", pluggyWebhooksRouter);
app.use("/api/v1/clients", clientsRouter);
app.use("/api/v1/products", productsRouter);
app.use("/api/v1/fiscal", fiscalRouter);
app.use("/api/v1/jobs", jobsRouter);
app.use("/api/v1/bakery", bakeryRouter);
app.use("/api/v1/liquor", liquorRouter);
app.use("/api/v1/pharmacy", pharmacyRouter);
app.use("/api/v1/multi-filial", multiFilialRouter);

app.listen(PORT, () => {
  console.log(`[filitech-api] phase-3.4 on :${PORT}`);
});

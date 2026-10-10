import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.routes";
import { twoFactorRouter } from "./routes/two-factor.routes";
import { billingRouter } from "./routes/billing.routes";
import { posRouter } from "./routes/pos.routes";
import { cashRegisterRouter } from "./routes/cash-register.routes";

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
    phase: "1.2",
  });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/auth/2fa", twoFactorRouter);
app.use("/api/v1/billing", billingRouter);
app.use("/api/v1/pos", posRouter);
app.use("/api/v1/cash-registers", cashRegisterRouter);

app.listen(PORT, () => {
  console.log(`[filitech-api] kriptomad/ERP phase-1.2 on :${PORT}`);
});

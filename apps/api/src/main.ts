import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.routes";

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
  });
});

app.use("/api/v1/auth", authRouter);

app.listen(PORT, () => {
  console.log(`[filitech-api] kriptomad/ERP on :${PORT}`);
});

import { PrismaClient, PlanAudience } from "@prisma/client";

const prisma = new PrismaClient();

const MODULES = [
  { code: "FISCAL_NFCE", label: "Emissão Fiscal (NFC-e/NFe)", monthlyPrice: 49.9, description: "Emissão ilimitada com contingência." },
  { code: "WHATSAPP_INTEGRATION", label: "Integração WhatsApp", monthlyPrice: 39.9, description: "Orçamentos e O.S. via WhatsApp." },
  { code: "MULTI_FILIAL", label: "Multi-Filial", monthlyPrice: 59.9, description: "Dashboard multi-loja." },
  { code: "WORK_ORDER", label: "Assistência Técnica (O.S.)", monthlyPrice: 69.9, description: "O.S., checklist, IMEI." },
  { code: "LIQUOR_LEDGER", label: "Adega — Cascos", monthlyPrice: 29.9, description: "Conta-corrente de vasilhames." },
  { code: "RECIPE_BOM", label: "Ficha Técnica", monthlyPrice: 44.9, description: "Receitas e CMV." },
  { code: "PHARMACY_SNGPC", label: "Farmácia — SNGPC", monthlyPrice: 79.9, description: "Controlados e receituário." },
];

const PLANS = [
  { code: "BASIC", label: "Essencial", basePrice: 89.9, includedModules: ["pdv", "estoque", "financeiro"], audience: PlanAudience.BUSINESS, maxConnectedAccounts: null as number | null },
  { code: "PRO", label: "Profissional", basePrice: 169.9, includedModules: ["pdv", "estoque", "financeiro", "crm"], audience: PlanAudience.BUSINESS, maxConnectedAccounts: null },
  { code: "PERSONAL_FREE", label: "Pessoal Grátis", basePrice: 0, includedModules: [] as string[], audience: PlanAudience.PERSONAL, maxConnectedAccounts: 1 },
  { code: "PERSONAL_FULL", label: "Pessoal Pleno", basePrice: 29.9, includedModules: [] as string[], audience: PlanAudience.PERSONAL, maxConnectedAccounts: null },
];

async function main() {
  for (const m of MODULES) {
    await prisma.module.upsert({
      where: { code: m.code },
      update: { label: m.label, monthlyPrice: m.monthlyPrice, description: m.description, active: true },
      create: m,
    });
  }
  for (const p of PLANS) {
    await prisma.plan.upsert({
      where: { code: p.code },
      update: {
        label: p.label,
        basePrice: p.basePrice,
        includedModules: p.includedModules,
        audience: p.audience,
        maxConnectedAccounts: p.maxConnectedAccounts,
        active: true,
      },
      create: p,
    });
  }
  console.log(`Seed OK: ${MODULES.length} modules, ${PLANS.length} plans`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/** Catálogos alinhados à BIBLE_ENGINEERING_V2 — Cap. 2 */

export const MODULE_CATALOG = {
  FISCAL_NFCE: {
    code: "FISCAL_NFCE",
    label: "Emissão Fiscal (NFC-e/NFe)",
    monthlyPrice: 49.9,
    description: "Emissão ilimitada de documentos fiscais com contingência automática.",
  },
  WHATSAPP_INTEGRATION: {
    code: "WHATSAPP_INTEGRATION",
    label: "Integração WhatsApp",
    monthlyPrice: 39.9,
    description: "Orçamentos, cobranças e O.S. via WhatsApp.",
  },
  MULTI_FILIAL: {
    code: "MULTI_FILIAL",
    label: "Multi-Filial",
    monthlyPrice: 59.9,
    description: "Dashboard consolidado multi-loja.",
  },
  WORK_ORDER: {
    code: "WORK_ORDER",
    label: "Assistência Técnica (O.S.)",
    monthlyPrice: 69.9,
    description: "O.S., checklist, laudo, IMEI/Serial.",
  },
  LIQUOR_LEDGER: {
    code: "LIQUOR_LEDGER",
    label: "Adega — Conta-Corrente de Cascos",
    monthlyPrice: 29.9,
    description: "Vasilhames retornáveis por cliente.",
  },
  RECIPE_BOM: {
    code: "RECIPE_BOM",
    label: "Ficha Técnica (Padaria/Confeitaria)",
    monthlyPrice: 44.9,
    description: "Receitas, CMV e baixa de insumos.",
  },
  PHARMACY_SNGPC: {
    code: "PHARMACY_SNGPC",
    label: "Farmácia — SNGPC/Controlados",
    monthlyPrice: 79.9,
    description: "Escrituração controlados e retenção de receita.",
  },
} as const;

export const BASE_PLANS = [
  {
    code: "BASIC",
    label: "Essencial",
    basePrice: 89.9,
    includedModules: ["pdv", "estoque", "financeiro"],
    audience: "BUSINESS" as const,
  },
  {
    code: "PRO",
    label: "Profissional",
    basePrice: 169.9,
    includedModules: ["pdv", "estoque", "financeiro", "crm"],
    audience: "BUSINESS" as const,
  },
  {
    code: "PERSONAL_FREE",
    label: "Pessoal Grátis",
    basePrice: 0,
    includedModules: [] as string[],
    audience: "PERSONAL" as const,
    maxConnectedAccounts: 1 as number | null,
  },
  {
    code: "PERSONAL_FULL",
    label: "Pessoal Pleno",
    basePrice: 29.9,
    includedModules: [] as string[],
    audience: "PERSONAL" as const,
    maxConnectedAccounts: null as number | null,
  },
] as const;

export const NICHES = [
  {
    code: "MARKET",
    name: "Mercado",
    color: "#6366F1",
    features: [
      "Gaveta cega no fechamento de caixa",
      "Curva ABC de giro",
      "Alerta de validade 30/60 dias",
      "Balança Toledo/Filizola",
      "Programa de fidelidade",
    ],
  },
  {
    code: "TECH_ASSIST",
    name: "Assistência Técnica",
    color: "#06B6D4",
    features: [
      "Checklist de entrada assinado",
      "Orçamento com validade",
      "Aprovação remota via WhatsApp",
      "Comissão do técnico que executou",
      "IMEI/Serial e garantia",
    ],
  },
  {
    code: "LIQUOR",
    name: "Adega",
    color: "#A855F7",
    features: [
      "Conta-corrente de cascos",
      "Cobrança de reposição",
      "Preço cascata unidade/caixa/revenda",
    ],
  },
  {
    code: "BAKERY",
    name: "Padaria",
    color: "#F59E0B",
    features: [
      "Ficha técnica + rendimento",
      "CMV automático",
      "Produção diária",
      "Perdas desvinculadas da venda",
    ],
  },
  {
    code: "PHARMACY",
    name: "Farmácia",
    color: "#10B981",
    features: [
      "SNGPC / SNCR",
      "Retenção de receita",
      "FEFO + bloqueio lote vencido",
    ],
  },
  {
    code: "RETAIL",
    name: "Varejo Geral",
    color: "#F43F5E",
    features: [
      "Crediário/fiado com limite",
      "Devoluções com reentrada",
      "Grade cor/tamanho",
    ],
  },
] as const;

export const NICHE_COMBOS = [
  { code: "COMBO_MARKET", label: "Combo Mercado Pro", discountPercent: 12, modules: ["FISCAL_NFCE", "WHATSAPP_INTEGRATION"] },
  { code: "COMBO_TECH", label: "Combo Assistência Técnica Pro", discountPercent: 15, modules: ["WORK_ORDER", "WHATSAPP_INTEGRATION", "FISCAL_NFCE"] },
  { code: "COMBO_LIQUOR", label: "Combo Adega Pro", discountPercent: 10, modules: ["LIQUOR_LEDGER", "FISCAL_NFCE"] },
  { code: "COMBO_BAKERY", label: "Combo Padaria Pro", discountPercent: 15, modules: ["RECIPE_BOM", "FISCAL_NFCE"] },
  { code: "COMBO_PHARMACY", label: "Combo Farmácia Pro", discountPercent: 18, modules: ["PHARMACY_SNGPC", "FISCAL_NFCE", "WHATSAPP_INTEGRATION"] },
] as const;

export const DUNNING_RETRY_SCHEDULE_DAYS = [1, 3, 5, 7] as const;

export const FREE_TIER_LIMITS = {
  salesPerMonth: 100,
  users: 1,
  products: 200,
  storageMb: 500,
} as const;

export const ACCOUNTING_SCOPES = [
  "FULL_BOOKKEEPING",
  "TAX_FILING",
  "PAYROLL_ESOCIAL",
  "PERSONAL_INCOME_TAX",
] as const;

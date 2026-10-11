import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password.service';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create Plans
  const basicPlan = await prisma.plan.upsert({
    where: { code: 'ESSENCIAL' },
    update: {},
    create: {
      code: 'ESSENCIAL',
      label: 'Essencial',
      basePrice: 89.9,
      includedModules: ['pdv', 'estoque', 'financeiro'],
      audience: 'BUSINESS',
      active: true,
    },
  });

  const proPlan = await prisma.plan.upsert({
    where: { code: 'PROFISSIONAL' },
    update: {},
    create: {
      code: 'PROFISSIONAL',
      label: 'Profissional',
      basePrice: 169.9,
      includedModules: ['pdv', 'estoque', 'financeiro', 'crm'],
      audience: 'BUSINESS',
      active: true,
    },
  });

  const freeB2CPlan = await prisma.plan.upsert({
    where: { code: 'GRATUITO' },
    update: {},
    create: {
      code: 'GRATUITO',
      label: 'Gratuito',
      basePrice: 0,
      includedModules: ['contas', 'orcamento', 'dividas', 'calculadora'],
      audience: 'PERSONAL',
      maxConnectedAccounts: 1,
      active: true,
    },
  });

  const plenoB2CPlan = await prisma.plan.upsert({
    where: { code: 'PLENO' },
    update: {},
    create: {
      code: 'PLENO',
      label: 'Pleno',
      basePrice: 29.9,
      includedModules: ['contas', 'orcamento', 'dividas', 'calculadora', 'openfinance_ilimitado', 'splits', 'patrimonio_historico', 'exportacao'],
      audience: 'PERSONAL',
      maxConnectedAccounts: null,
      active: true,
    },
  });

  const accountingPlan = await prisma.plan.upsert({
    where: { code: 'ESCRITORIO_BASE' },
    update: {},
    create: {
      code: 'ESCRITORIO_BASE',
      label: 'Escritório Base',
      basePrice: 199.9,
      includedModules: ['marketplace', 'procuration', 'tasks', 'generators'],
      audience: 'ACCOUNTING_OFFICE',
      active: true,
    },
  });

  // Create Modules
  const modules = [
    { code: 'FISCAL_NFCE', label: 'Emissão Fiscal (NFC-e/NFe)', monthlyPrice: 49.9, description: 'Emissão ilimitada de documentos fiscais com contingência automática.', audience: 'BUSINESS' },
    { code: 'WHATSAPP_INTEGRATION', label: 'Integração WhatsApp', monthlyPrice: 39.9, description: 'Envio de orçamentos, cobranças e notificações de O.S. direto pelo WhatsApp.', audience: 'BUSINESS' },
    { code: 'MULTI_FILIAL', label: 'Multi-Filial', monthlyPrice: 59.9, description: 'Dashboard consolidado para múltiplas lojas sob o mesmo CNPJ matriz.', audience: 'BUSINESS' },
    { code: 'WORK_ORDER', label: 'Assistência Técnica (O.S.)', monthlyPrice: 69.9, description: 'Ordens de serviço, checklist, laudo fotográfico e controle de IMEI/Serial.', audience: 'BUSINESS' },
    { code: 'LIQUOR_LEDGER', label: 'Adega — Conta-Corrente de Cascos', monthlyPrice: 29.9, description: 'Controle de vasilhames retornáveis por cliente.', audience: 'BUSINESS' },
    { code: 'RECIPE_BOM', label: 'Ficha Técnica (Padaria/Confeitaria)', monthlyPrice: 44.9, description: 'Receitas, custo de produção e baixa automática de insumos.', audience: 'BUSINESS' },
    { code: 'PHARMACY_SNGPC', label: 'Farmácia — SNGPC/Controlados', monthlyPrice: 79.9, description: 'Escrituração eletrônica de controlados e retenção digital de receituário.', audience: 'BUSINESS' },
    { code: 'ACCOUNTING_TAX', label: 'Contabilidade — Apuração Tributos', monthlyPrice: 89.9, description: 'Apuração ICMS/IPI/PIS/COFINS/ISS por regime.', audience: 'BOTH' },
    { code: 'ACCOUNTING_PAYROLL', label: 'Contabilidade — Folha/eSocial', monthlyPrice: 99.9, description: 'Folha de pagamento, eSocial, DCTFWeb, GFIP.', audience: 'BOTH' },
  ];

  for (const mod of modules) {
    await prisma.module.upsert({
      where: { code: mod.code },
      update: {},
      create: { ...mod, active: true },
    });
  }

  // System Parameters
  const systemParams = [
    { key: 'ENFORCE_2FA_FOR_ROLES', value: ['OWNER', 'MANAGER', 'SUPER_ADMIN', 'FINANCE_ANALYST'], description: 'Papéis que requerem 2FA obrigatório' },
    { key: 'FREE_TIER_SALES_LIMIT', value: 100, description: 'Limite de vendas/mês no tier free B2B' },
    { key: 'FREE_TIER_PRODUCTS_LIMIT', value: 200, description: 'Limite de produtos no tier free B2B' },
    { key: 'FREE_TIER_STORAGE_MB', value: 500, description: 'Limite de storage R2 em MB no tier free' },
    { key: 'DUNNING_RETRY_DAYS', value: [1, 3, 5, 7], description: 'Dias para retentativa de pagamento' },
    { key: 'GRACE_PERIOD_DAYS', value: 7, description: 'Dias de graça após primeira falha de pagamento' },
    { key: 'REFERRAL_EXPIRY_DAYS', value: 90, description: 'Dias para expiração de indicação' },
    { key: 'REFERRER_REWARD_MONTHS', value: 1, description: 'Meses de crédito para quem indicou' },
    { key: 'REFEREE_FIRST_CYCLE_DISCOUNT', value: 20, description: 'Desconto no primeiro ciclo para indicado (%)' },
    { key: 'PLUGGY_WEBHOOK_URL', value: process.env.WEB_URL + '/webhooks/pluggy', description: 'URL do webhook Pluggy' },
    { key: 'DEFAULT_RETURN_PERIOD_DAYS', value: 30, description: 'Dias padrão para devolução de cascos' },
    { key: 'TAX_BRACKETS_2025', value: [
      { min: 0, max: 2259.20, rate: 0, deduction: 0 },
      { min: 2259.21, max: 2826.65, rate: 0.075, deduction: 169.44 },
      { min: 2826.66, max: 3751.05, rate: 0.15, deduction: 381.44 },
      { min: 3751.06, max: 4664.68, rate: 0.225, deduction: 662.77 },
      { min: 4664.69, max: Infinity, rate: 0.275, deduction: 896.00 },
    ], description: 'Tabela progressiva IRPF 2025 para Carnê-Leão' },
  ];

  for (const param of systemParams) {
    await prisma.systemParameter.upsert({
      where: { key: param.key },
      create: param,
      update: { value: param.value, description: param.description },
    });
  }

  // Default Role Permissions
  const rolePermissions = [
    { role: 'OWNER', permissionCode: '*' },
    { role: 'MANAGER', permissionCode: 'sales:*' },
    { role: 'MANAGER', permissionCode: 'products:*' },
    { role: 'MANAGER', permissionCode: 'stock:*' },
    { role: 'MANAGER', permissionCode: 'financial:*' },
    { role: 'MANAGER', permissionCode: 'clients:*' },
    { role: 'MANAGER', permissionCode: 'work-orders:*' },
    { role: 'MANAGER', permissionCode: 'reports:*' },
    { role: 'TECHNICIAN', permissionCode: 'work-orders:read' },
    { role: 'TECHNICIAN', permissionCode: 'work-orders:update' },
    { role: 'TECHNICIAN', permissionCode: 'products:read' },
    { role: 'CASHIER', permissionCode: 'sales:create' },
    { role: 'CASHIER', permissionCode: 'products:read' },
    { role: 'CASHIER', permissionCode: 'clients:read' },
    { role: 'ACCOUNTANT', permissionCode: 'financial:read' },
    { role: 'ACCOUNTANT', permissionCode: 'fiscal:read' },
    { role: 'ACCOUNTANT', permissionCode: 'reports:read' },
    { role: 'HOUSEHOLD_MEMBER', permissionCode: 'personal:*' },
  ];

  for (const rp of rolePermissions) {
    await prisma.roleDefaultPermission.upsert({
      where: { role_permissionCode: { role: rp.role, permissionCode: rp.permissionCode } },
      create: rp,
      update: {},
    });
  }

  // Demo Tenant
  const existingTenant = await prisma.tenant.findFirst({ where: { slug: 'demo-store' } });

  if (!existingTenant) {
    const passwordHash = await hashPassword('demo1234');

    const tenant = await prisma.tenant.create({
      data: {
        slug: 'demo-store',
        legalName: 'Demo Store LTDA',
        tradeName: 'Demo Store',
        cnpj: '12345678000190',
        tenantType: 'BUSINESS',
        status: 'ACTIVE',
        taxRegime: 'SIMPLES_NACIONAL',
        simplesNacionalAnexo: 'I',
        inscricaoEstadual: '123456789',
        uf: 'SP',
        termsAcceptedAt: new Date(),
        termsVersionAccepted: '2025-01-v1',
        privacyPolicyAcceptedAt: new Date(),
        privacyPolicyVersionAccepted: '2025-01-v1',
        users: {
          create: {
            name: 'Admin Demo',
            email: 'admin@demo.com',
            passwordHash,
            role: 'OWNER',
          },
        },
      },
    });

    // Demo Products
    const products = [
      { sku: 'P001', name: 'Arroz 5kg', category: 'Mercearia', unitPrice: 22.9, stockQuantity: 50, minStockThreshold: 10, costPrice: 16.03 },
      { sku: 'P002', name: 'Feijão 1kg', category: 'Mercearia', unitPrice: 8.9, stockQuantity: 80, minStockThreshold: 15, costPrice: 6.23 },
      { sku: 'P003', name: 'Óleo de Soja 900ml', category: 'Mercearia', unitPrice: 6.5, stockQuantity: 30, minStockThreshold: 8, costPrice: 4.55 },
      { sku: 'P004', name: 'Café Torrado 500g', category: 'Mercearia', unitPrice: 18.9, stockQuantity: 25, minStockThreshold: 5, costPrice: 13.23 },
      { sku: 'P005', name: 'Açúcar 1kg', category: 'Mercearia', unitPrice: 4.9, stockQuantity: 100, minStockThreshold: 20, costPrice: 3.43 },
      { sku: 'P006', name: 'Leite Integral 1L', category: 'Laticínios', unitPrice: 5.5, stockQuantity: 60, minStockThreshold: 12, costPrice: 3.85 },
      { sku: 'P007', name: 'Queijo Mussarela 500g', category: 'Laticínios', unitPrice: 32.9, stockQuantity: 15, minStockThreshold: 3, costPrice: 23.03 },
      { sku: 'P008', name: 'Presunto 500g', category: 'Laticínios', unitPrice: 19.9, stockQuantity: 20, minStockThreshold: 4, costPrice: 13.93 },
    ];

    for (const prod of products) {
      await prisma.product.create({
        data: {
          tenantId: tenant.id,
          ...prod,
          trackingType: 'NONE',
          ncm: '10063010',
        },
      });
    }

    // Demo Clients
    const clients = [
      { name: 'João Silva', document: '12345678900', phone: '11999998888', creditLimit: 500 },
      { name: 'Maria Santos', document: '98765432100', phone: '11988887777', creditLimit: 1000 },
      { name: 'Pedro Oliveira', document: '45678912300', phone: '11977776666', creditLimit: 300 },
    ];

    for (const client of clients) {
      await prisma.client.create({
        data: { tenantId: tenant.id, ...client },
      });
    }

    // Activate default modules for demo
    const defaultModules = ['FISCAL_NFCE', 'WHATSAPP_INTEGRATION', 'WORK_ORDER'];
    for (const modCode of defaultModules) {
      await prisma.tenantModule.create({
        data: { tenantId: tenant.id, moduleCode: modCode, active: true },
      });
    }

    console.log('✅ Demo tenant created with products and clients');
    console.log('📧 Login: admin@demo.com / demo1234');
  }

  // Platform Admin
  const adminPasswordHash = await hashPassword('admin1234');
  await prisma.platformAdminUser.upsert({
    where: { email: 'admin@filitech.com' },
    create: {
      name: 'Filitech Admin',
      email: 'admin@filitech.com',
      passwordHash: adminPasswordHash,
      role: 'SUPER_ADMIN',
      active: true,
    },
    update: {},
  });

  console.log('✅ Platform admin created: admin@filitech.com / admin1234');
  console.log('✅ Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
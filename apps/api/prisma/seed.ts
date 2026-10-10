import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password.service';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create Plans
  const basicPlan = await prisma.plan.upsert({
    where: { code: 'BASIC' },
    update: {},
    create: {
      code: 'BASIC',
      label: 'Essencial',
      basePrice: 89.9,
      includedModules: ['pdv', 'estoque', 'financeiro'],
      active: true,
    },
  });

  const proPlan = await prisma.plan.upsert({
    where: { code: 'PRO' },
    update: {},
    create: {
      code: 'PRO',
      label: 'Profissional',
      basePrice: 169.9,
      includedModules: ['pdv', 'estoque', 'financeiro', 'crm'],
      active: true,
    },
  });

  // Create Modules
  const modules = [
    { code: 'FISCAL_NFCE', label: 'Emissão Fiscal (NFC-e/NFe)', monthlyPrice: 49.9, description: 'Emissão ilimitada de documentos fiscais com contingência automática.' },
    { code: 'WHATSAPP_INTEGRATION', label: 'Integração WhatsApp', monthlyPrice: 39.9, description: 'Envio de orçamentos, cobranças e notificações de O.S. direto pelo WhatsApp.' },
    { code: 'MULTI_FILIAL', label: 'Multi-Filial', monthlyPrice: 59.9, description: 'Dashboard consolidado para múltiplas lojas sob o mesmo CNPJ matriz.' },
    { code: 'WORK_ORDER', label: 'Assistência Técnica (O.S.)', monthlyPrice: 69.9, description: 'Ordens de serviço, checklist, laudo fotográfico e controle de IMEI/Serial.' },
    { code: 'LIQUOR_LEDGER', label: 'Adega — Conta-Corrente de Cascos', monthlyPrice: 29.9, description: 'Controle de vasilhames retornáveis por cliente.' },
    { code: 'RECIPE_BOM', label: 'Ficha Técnica (Padaria/Confeitaria)', monthlyPrice: 44.9, description: 'Receitas, custo de produção e baixa automática de insumos.' },
    { code: 'PHARMACY_SNGPC', label: 'Farmácia — SNGPC/Controlados', monthlyPrice: 79.9, description: 'Escrituração eletrônica de controlados e retenção digital de receituário.' },
  ];

  for (const mod of modules) {
    await prisma.module.upsert({
      where: { code: mod.code },
      update: {},
      create: { ...mod, active: true },
    });
  }

  // Create demo tenant with owner
  const existingTenant = await prisma.tenant.findFirst({
    where: { slug: 'demo-store' },
  });

  if (!existingTenant) {
    const passwordHash = await hashPassword('demo1234');

    const tenant = await prisma.tenant.create({
      data: {
        slug: 'demo-store',
        legalName: 'Demo Store LTDA',
        tradeName: 'Demo Store',
        cnpj: '12345678000190',
        status: 'ACTIVE',
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

    // Create demo products
    const products = [
      { sku: 'P001', name: 'Arroz 5kg', category: 'Mercearia', unitPrice: 22.9, stockQuantity: 50, minStockThreshold: 10 },
      { sku: 'P002', name: 'Feijão 1kg', category: 'Mercearia', unitPrice: 8.9, stockQuantity: 80, minStockThreshold: 15 },
      { sku: 'P003', name: 'Óleo de Soja 900ml', category: 'Mercearia', unitPrice: 6.5, stockQuantity: 30, minStockThreshold: 8 },
      { sku: 'P004', name: 'Café Torrado 500g', category: 'Mercearia', unitPrice: 18.9, stockQuantity: 25, minStockThreshold: 5 },
      { sku: 'P005', name: 'Açúcar 1kg', category: 'Mercearia', unitPrice: 4.9, stockQuantity: 100, minStockThreshold: 20 },
      { sku: 'P006', name: 'Leite Integral 1L', category: 'Laticínios', unitPrice: 5.5, stockQuantity: 60, minStockThreshold: 12 },
      { sku: 'P007', name: 'Queijo Mussarela 500g', category: 'Laticínios', unitPrice: 32.9, stockQuantity: 15, minStockThreshold: 3 },
      { sku: 'P008', name: 'Presunto 500g', category: 'Laticínios', unitPrice: 19.9, stockQuantity: 20, minStockThreshold: 4 },
    ];

    for (const prod of products) {
      await prisma.product.create({
        data: {
          tenantId: tenant.id,
          ...prod,
          trackingType: 'NONE',
          costPrice: prod.unitPrice * 0.7,
        },
      });
    }

    // Create demo clients
    const clients = [
      { name: 'João Silva', document: '12345678900', phone: '11999998888' },
      { name: 'Maria Santos', document: '98765432100', phone: '11988887777' },
      { name: 'Pedro Oliveira', document: '45678912300', phone: '11977776666' },
    ];

    for (const client of clients) {
      await prisma.client.create({
        data: { tenantId: tenant.id, ...client, creditLimit: 500 },
      });
    }

    console.log('✅ Demo tenant created with products and clients');
    console.log('📧 Login: admin@demo.com / demo1234');
  }

  console.log('✅ Seed completed successfully');
  console.log(`   Plans: BASIC (R$89,90), PRO (R$169,90)`);
  console.log(`   Modules: ${modules.length} created`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

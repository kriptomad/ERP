import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';
import { assertAccountingAccess, requireAccountingScope } from '../../middlewares/accounting-access.middleware';

export const accountingGeneratorRouter = Router();

accountingGeneratorRouter.use(authenticate);
accountingGeneratorRouter.use(assertAccountingAccess);
accountingGeneratorRouter.use(requireAccountingScope('FULL_BOOKKEEPING', 'TAX_FILING'));

const generateECFSchema = z.object({
  clientTenantId: z.string().uuid(),
  year: z.number().int(),
});

accountingGeneratorRouter.post('/generate/ecf', async (req, res, next) => {
  try {
    const engagement = req.accountingEngagement!;
    const { clientTenantId, year } = generateECFSchema.parse(req.body);

    if (engagement.clientTenantId !== clientTenantId) {
      res.status(403).json({ success: false, data: null, error: { code: 'FORBIDDEN', message: 'Acesso negado.' } });
      return;
    }

    const layout = await prisma.officialDocumentLayoutVersion.findFirst({
      where: { documentType: 'ECF', version: 'latest', effectiveFrom: { lte: new Date() } },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!layout) {
      res.status(400).json({ success: false, data: null, error: { code: 'LAYOUT_NOT_FOUND', message: 'Leiaute ECF não cadastrado.' } });
      return;
    }

    const sales = await prisma.sale.findMany({
      where: { tenantId: clientTenantId, status: 'COMPLETED', createdAt: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31) } },
      include: { items: true },
    });

    const fiscalDocs = await prisma.fiscalDocument.findMany({
      where: { tenantId: clientTenantId, type: { in: ['NFC_E', 'NFE'] }, status: 'AUTHORIZED', issuedAt: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31) } },
    });

    const ecfData = generateECFContent(sales, fiscalDocs, layout.layoutJson);

    const document = await prisma.officialTaxDocument.create({
      data: {
        tenantId: clientTenantId,
        firmTenantId: engagement.firmTenantId,
        documentType: 'ECF',
        referencePeriod: `${year}`,
        status: 'GENERATED',
        filedAt: new Date(),
      },
    });

    res.status(201).json({ success: true, data: { documentId: document.id, ecfData }, error: null });
  } catch (err) {
    next(err);
  }
});

function generateECFContent(sales: any[], fiscalDocs: any[], layout: any): any {
  const totalRevenue = sales.reduce((sum, s) => sum + s.totalAmount.toNumber(), 0);
  const totalTax = fiscalDocs.reduce((sum, d) => sum + (d.totalAmount?.toNumber() || 0), 0);

  return {
    layoutVersion: layout.version,
    year: sales[0]?.createdAt?.getFullYear() || new Date().getFullYear(),
    revenue: totalRevenue,
    taxCollected: totalTax,
    operationsCount: sales.length,
    fiscalDocumentsCount: fiscalDocs.length,
    generatedAt: new Date().toISOString(),
    blocks: [
      { block: 'B', name: 'Identificação', data: {} },
      { block: 'C', name: 'Documentos Fiscais', data: { count: fiscalDocs.length } },
      { block: 'H', name: 'Inventário', data: {} },
      { block: 'I', name: 'Apuração', data: { totalRevenue, totalTax } },
      { block: 'J', name: 'Outras Informações', data: {} },
    ],
  };
}

accountingGeneratorRouter.post('/generate/ecd', async (req, res, next) => {
  try {
    const engagement = req.accountingEngagement!;
    const { clientTenantId, year } = generateECFSchema.parse(req.body);

    if (engagement.clientTenantId !== clientTenantId) {
      res.status(403).json({ success: false, data: null, error: { code: 'FORBIDDEN', message: 'Acesso negado.' } });
      return;
    }

    const accounts = await prisma.chartOfAccount.findMany({ where: { tenantId: clientTenantId }, orderBy: { code: 'asc' } });

    const ecdData = {
      layoutVersion: '1.0',
      year,
      accounts: accounts.map(a => ({ code: a.code, name: a.name, type: a.type, nature: a.nature, parent: a.parentCode })),
      journalEntries: [],
      generatedAt: new Date().toISOString(),
    };

    const document = await prisma.officialTaxDocument.create({
      data: { tenantId: clientTenantId, firmTenantId: engagement.firmTenantId, documentType: 'ECD', referencePeriod: `${year}`, status: 'GENERATED', filedAt: new Date() },
    });

    res.status(201).json({ success: true, data: { documentId: document.id, ecdData }, error: null });
  } catch (err) {
    next(err);
  }
});

accountingGeneratorRouter.post('/generate/efd-reinf', async (req, res, next) => {
  try {
    const engagement = req.accountingEngagement!;
    const { clientTenantId, year, month } = z.object({ clientTenantId: z.string().uuid(), year: z.number().int(), month: z.number().int().min(1).max(12) }).parse(req.body);

    if (engagement.clientTenantId !== clientTenantId) {
      res.status(403).json({ success: false, data: null, error: { code: 'FORBIDDEN', message: 'Acesso negado.' } });
      return;
    }

    const payables = await prisma.accountPayable.findMany({
      where: { tenantId: clientTenantId, paidAt: { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0) }, status: 'PAID' },
      include: { supplier: true },
    });

    const reinfData = {
      layoutVersion: '2.1.1',
      period: `${year}-${month.toString().padStart(2, '0')}`,
      retentions: payables.map(p => ({
        supplierCnpj: p.supplier?.document,
        supplierName: p.supplier?.name,
        amount: p.paidAmount?.toNumber(),
        irrf: p.amount.toNumber() * 0.015,
        csll: p.amount.toNumber() * 0.01,
        pis: p.amount.toNumber() * 0.0065,
        cofins: p.amount.toNumber() * 0.03,
      })),
      generatedAt: new Date().toISOString(),
    };

    const document = await prisma.officialTaxDocument.create({
      data: { tenantId: clientTenantId, firmTenantId: engagement.firmTenantId, documentType: 'EFD_REINF', referencePeriod: `${year}-${month.toString().padStart(2, '0')}`, status: 'GENERATED', filedAt: new Date() },
    });

    res.status(201).json({ success: true, data: { documentId: document.id, reinfData }, error: null });
  } catch (err) {
    next(err);
  }
});

accountingGeneratorRouter.post('/generate/dctfweb', async (req, res, next) => {
  try {
    const engagement = req.accountingEngagement!;
    const { clientTenantId, year, month } = z.object({ clientTenantId: z.string().uuid(), year: z.number().int(), month: z.number().int().min(1).max(12) }).parse(req.body);

    if (engagement.clientTenantId !== clientTenantId) {
      res.status(403).json({ success: false, data: null, error: { code: 'FORBIDDEN', message: 'Acesso negado.' } });
      return;
    }

    const sales = await prisma.sale.findMany({
      where: { tenantId: clientTenantId, status: 'COMPLETED', createdAt: { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0) } },
    });

    const dctfwebData = {
      layoutVersion: '3.0',
      period: `${year}-${month.toString().padStart(2, '0')}`,
      revenue: sales.reduce((sum, s) => sum + s.totalAmount.toNumber(), 0),
      pisCofins: 0,
      csll: 0,
      irrf: 0,
      generatedAt: new Date().toISOString(),
    };

    const document = await prisma.officialTaxDocument.create({
      data: { tenantId: clientTenantId, firmTenantId: engagement.firmTenantId, documentType: 'DCTFWEB', referencePeriod: `${year}-${month.toString().padStart(2, '0')}`, status: 'GENERATED', filedAt: new Date() },
    });

    res.status(201).json({ success: true, data: { documentId: document.id, dctfwebData }, error: null });
  } catch (err) {
    next(err);
  }
});

accountingGeneratorRouter.post('/generate/defis', async (req, res, next) => {
  try {
    const engagement = req.accountingEngagement!;
    const { clientTenantId, year } = generateECFSchema.parse(req.body);

    if (engagement.clientTenantId !== clientTenantId) {
      res.status(403).json({ success: false, data: null, error: { code: 'FORBIDDEN', message: 'Acesso negado.' } });
      return;
    }

    const sales = await prisma.sale.findMany({
      where: { tenantId: clientTenantId, status: 'COMPLETED', createdAt: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31) } },
    });

    const defisData = {
      layoutVersion: '4.0',
      year,
      regime: 'SIMPLES_NACIONAL',
      anexo: 'III',
      revenue: sales.reduce((sum, s) => sum + s.totalAmount.toNumber(), 0),
      generatedAt: new Date().toISOString(),
    };

    const document = await prisma.officialTaxDocument.create({
      data: { tenantId: clientTenantId, firmTenantId: engagement.firmTenantId, documentType: 'DEFIS', referencePeriod: `${year}`, status: 'GENERATED', filedAt: new Date() },
    });

    res.status(201).json({ success: true, data: { documentId: document.id, defisData }, error: null });
  } catch (err) {
    next(err);
  }
});
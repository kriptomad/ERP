import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireModule } from '../../middlewares/module-gating.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';
import { assertAccountingAccess, requireAccountingScope } from '../../middlewares/accounting-access.middleware';

const createFirmProfileSchema = z.object({
  cnpj: z.string().length(14).optional(),
  razaoSocial: z.string().optional(),
  inscricaoMunicipal: z.string().optional(),
  contadorName: z.string().optional(),
  contadorCrc: z.string().optional(),
  specializations: z.array(z.string()).default([]),
  isListedInMarketplace: z.boolean().default(false),
});

export const accountingFirmRouter = Router();

accountingFirmRouter.use(authenticate);
accountingFirmRouter.use(requireModule('ACCOUNTING_TAX'));

accountingFirmRouter.post('/profile', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = createFirmProfileSchema.parse(req.body);

    const profile = await prisma.accountingFirmProfile.upsert({
      where: { tenantId: tenantId! },
      create: { tenantId: tenantId!, ...data },
      update: data,
    });

    res.status(201).json({ success: true, data: profile, error: null });
  } catch (err) {
    next(err);
  }
});

accountingFirmRouter.get('/profile', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const profile = await prisma.accountingFirmProfile.findUnique({
      where: { tenantId: tenantId! },
      include: {
        _count: { select: { engagementsAsFirm: true } },
      },
    });
    res.json({ success: true, data: profile, error: null });
  } catch (err) {
    next(err);
  }
});

accountingFirmRouter.get('/marketplace', async (req, res, next) => {
  try {
    const { niche, service, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = { isListedInMarketplace: true };
    if (niche) where.specializations = { has: niche };
    if (service) where.services = { has: service };

    const [firms, total] = await Promise.all([
      prisma.accountingFirmProfile.findMany({
        where,
        include: {
          tenant: { select: { id: true, tradeName: true, slug: true } },
          _count: { select: { engagementsAsFirm: true } },
        },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.accountingFirmProfile.count({ where }),
    ]);

    res.json({ success: true, data: { items: firms, total }, error: null });
  } catch (err) {
    next(err);
  }
});

accountingFirmRouter.get('/marketplace/:firmTenantId', async (req, res, next) => {
  try {
    const firm = await prisma.accountingFirmProfile.findUnique({
      where: { tenantId: req.params.firmTenantId },
      include: {
        tenant: { select: { id: true, tradeName: true, slug: true, cnpj: true } },
        reviews: { orderBy: { createdAt: 'desc' }, take: 10 },
        _count: { select: { engagementsAsFirm: true } },
      },
    });
    if (!firm) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Escritório não encontrado.' } });
      return;
    }
    res.json({ success: true, data: firm, error: null });
  } catch (err) {
    next(err);
  }
});

accountingFirmRouter.post('/engagements', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = z.object({
      clientTenantId: z.string().uuid(),
      scopes: z.array(z.enum(['FULL_BOOKKEEPING', 'TAX_FILING', 'PAYROLL_ESOCIAL', 'PERSONAL_INCOME_TAX', 'ACCOUNTING_ADVISORY'])).min(1),
      monthlyFee: z.number().positive().optional(),
    }).parse(req.body);

    const existing = await prisma.accountingEngagement.findFirst({
      where: { firmTenantId: tenantId!, clientTenantId: data.clientTenantId, status: { in: ['PENDING_ACCOUNTANT_ACCEPTANCE', 'ACTIVE'] } },
    });

    if (existing) {
      res.status(409).json({ success: false, data: null, error: { code: 'ENGAGEMENT_EXISTS', message: 'Já existe vínculo ativo ou pendente.' } });
      return;
    }

    const engagement = await prisma.accountingEngagement.create({
      data: {
        tenantId: tenantId!,
        firmTenantId: tenantId!,
        clientTenantId: data.clientTenantId,
        scopes: data.scopes,
        status: 'PENDING_ACCOUNTANT_ACCEPTANCE',
        monthlyFee: data.monthlyFee,
      },
      include: { client: true, firm: true },
    });

    res.status(201).json({ success: true, data: engagement, error: null });
  } catch (err) {
    next(err);
  }
});

accountingFirmRouter.get('/engagements', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { status, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = { firmTenantId: tenantId! };
    if (status) where.status = status;

    const [engagements, total] = await Promise.all([
      prisma.accountingEngagement.findMany({
        where,
        include: { client: { select: { id: true, tradeName: true, cnpj: true } } },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.accountingEngagement.count({ where }),
    ]);

    res.json({ success: true, data: { items: engagements, total }, error: null });
  } catch (err) {
    next(err);
  }
});

accountingFirmRouter.patch('/engagements/:id/accept', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const engagement = await prisma.accountingEngagement.findFirst({
      where: { id: req.params.id, firmTenantId: tenantId! },
    });

    if (!engagement || engagement.status !== 'PENDING_ACCOUNTANT_ACCEPTANCE') {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Vínculo não encontrado ou não pendente.' } });
      return;
    }

    const updated = await prisma.accountingEngagement.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE' },
    });

    await prisma.accountingEngagementAuditEvent.create({
      data: { engagementId: req.params.id, event: 'ACCEPTED', actorTenantId: tenantId! },
    });

    res.json({ success: true, data: updated, error: null });
  } catch (err) {
    next(err);
  }
});

accountingFirmRouter.patch('/engagements/:id/revoke', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);

    const engagement = await prisma.accountingEngagement.findFirst({
      where: { id: req.params.id, firmTenantId: tenantId! },
    });

    if (!engagement || !['ACTIVE', 'PENDING_ACCOUNTANT_ACCEPTANCE'].includes(engagement.status)) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Vínculo não encontrado ou não revogável.' } });
      return;
    }

    const updated = await prisma.accountingEngagement.update({
      where: { id: req.params.id },
      data: { status: 'REVOKED_BY_ACCOUNTANT' },
    });

    await prisma.accountingEngagementAuditEvent.create({
      data: { engagementId: req.params.id, event: 'REVOKED_BY_ACCOUNTANT', actorTenantId: tenantId!, metadata: { reason } },
    });

    res.json({ success: true, data: updated, error: null });
  } catch (err) {
    next(err);
  }
});
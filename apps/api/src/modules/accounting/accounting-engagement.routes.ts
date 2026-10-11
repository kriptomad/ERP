import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';
import { assertAccountingAccess, requireAccountingScope } from '../../middlewares/accounting-access.middleware';

const createEngagementSchema = z.object({
  clientTenantId: z.string().uuid(),
  scopes: z.array(z.enum(['FULL_BOOKKEEPING', 'TAX_FILING', 'PAYROLL_ESOCIAL', 'PERSONAL_INCOME_TAX'])).min(1),
  monthlyFee: z.number().positive(),
});

const ENGAGEMENT_TIMEOUT_DAYS = 30;

export const accountingEngagementRouter = Router();

accountingEngagementRouter.use(authenticate);

// 1. Criar engajamento — status inicial PENDING_ACCOUNTANT_ACCEPTANCE
accountingEngagementRouter.post('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = createEngagementSchema.parse(req.body);

    // Verificar se já existe engajamento ativo ou pendente
    const existing = await prisma.accountingEngagement.findFirst({
      where: {
        firmTenantId: tenantId!,
        clientTenantId: data.clientTenantId,
        status: { in: ['PENDING_ACCOUNTANT_ACCEPTANCE', 'ACTIVE'] },
      },
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
        createdAt: new Date(),
      },
      include: { client: true, firm: true },
    });

    // Agendar expiração automática em 30 dias se não aceita
    // (isso seria feito via BullMQ job, aqui apenas registramos)

    res.status(201).json({ success: true, data: engagement, error: null });
  } catch (err) {
    next(err);
  }
});

// 2. Listar engajamentos do escritório
accountingEngagementRouter.get('/', async (req, res, next) => {
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

// 3. Aceitar engajamento (conta-contador em até 30 dias)
accountingEngagementRouter.patch('/:id/accept', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const engagement = await prisma.accountingEngagement.findFirst({
      where: { id: req.params.id, firmTenantId: tenantId! },
    });

    if (!engagement) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Vínculo não encontrado.' } });
      return;
    }

    if (engagement.status !== 'PENDING_ACCOUNTANT_ACCEPTANCE') {
      res.status(400).json({ success: false, data: null, error: { code: 'INVALID_STATUS', message: 'Vínculo não está em estado de pendência.' } });
      return;
    }

    const now = new Date();
    const acceptanceDate = new Date();
    const expirationDate = new Date(now.getTime() + ENGAGEMENT_TIMEOUT_DAYS * 24 * 60 * 60 * 1000);

    const updated = await prisma.accountingEngagement.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE', acceptedAt: acceptanceDate, expiresAt: expirationDate },
    },
    );

    // Registrar evento de auditoria
    await prisma.accountingEngagementAuditEvent.create({
      data: {
        engagementId: req.params.id,
        event: 'ACCEPTED',
        actorTenantId: tenantId!,
        metadata: { acceptanceDate: acceptanceDate.toISOString() },
      },
    });

    res.json({ success: true, data: updated, error: null });
  } catch (err) {
    next(err);
  }
});

// 4. Revogar pelo contador
accountingEngagementRouter.patch('/:id/revoke-by-accountant', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);

    const engagement = await prisma.accountingEngagement.findFirst({
      where: { id: req.params.id, firmTenantId: tenantId! },
    });

    if (!engagement) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Vínculo não encontrado.' } });
      return;
    }

    const updated = await prisma.accountingEngagement.update({
      where: { id: req.params.id },
      data: { status: 'REVOKED_BY_ACCOUNTANT' },
    },
    );

    await prisma.accountingEngagementAuditEvent.create({
      data: {
        engagementId: req.params.id,
        event: 'REVOKED_BY_ACCOUNTANT',
        actorTenantId: tenantId!,
        metadata: { reason },
      },
    });

    res.json({ success: true, data: updated, error: null });
  } catch (err) {
    next(err);
  }
});

// 5. Revogar pelo cliente
accountingEngagementRouter.patch('/:id/revoke-by-client', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);

    const engagement = await prisma.accountingEngagement.findFirst({
      where: { id: req.params.id, firmTenantId: tenantId! },
    });

    if (!engagement) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Vínculo não encontrado.' } });
      return;
    }

    const updated = await prisma.accountingEngagement.update({
      where: { id: req.params.id },
      data: { status: 'REVOKED_BY_CLIENT' },
    },
    );

    await prisma.accountingEngagementAuditEvent.create({
      data: {
        engagementId: req.params.id,
        event: 'REVOKED_BY_CLIENT',
        actorTenantId: tenantId!,
        metadata: { reason },
      },
    });

    res.json({ success: true, data: updated, error: null });
  } catch (err) {
    next(err);
  }
});

// 6. Verificar acesso cross-tenant (porta única)
accountingEngagementRouter.get('/:id/access-check', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const engagement = await prisma.accountingEngagement.findFirst({
      where: { id: req.params.id },
      include: { client: true, firm: true },
    });

    if (!engagement) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Vínculo não encontrado.' } });
      return;
    }

    // Cliente só pode acessar se engajamento for ACTIVE
    const canAccess = engagement.status === 'ACTIVE';

    res.json({
      success: true,
      data: {
        engagementId: engagement.id,
        status: engagement.status,
        clientCanAccess: canAccess,
        daysUntilExpiry: engagement.expiresAt
          ? Math.ceil((engagement.expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
          : null,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

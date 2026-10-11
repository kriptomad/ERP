import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/auth.middleware';

export const platformAdminTenantRouter = Router();

platformAdminTenantRouter.use(authenticate);
platformAdminTenantRouter.use(requireRole('SUPER_ADMIN', 'FINANCE_ANALYST', 'SUPPORT_AGENT'));

platformAdminTenantRouter.get('/', async (req, res, next) => {
  try {
    const { type, status, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = {};
    if (type) where.tenantType = type;
    if (status) where.status = status;

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        include: {
          subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
          users: { select: { id: true, name: true, email: true, role: true, active: true } },
          _count: { select: { sales: true, products: true, clients: true } },
        },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.tenant.count({ where }),
    ]);

    res.json({ success: true, data: { items: tenants, total }, error: null });
  } catch (err) {
    next(err);
  }
});

platformAdminTenantRouter.get('/:id', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        subscriptions: { include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        tenantModules: { include: { module: true } },
        users: { select: { id: true, name: true, email: true, role: true, active: true, totpConfirmedAt: true } },
        referralCode: true,
        loyaltyProgram: true,
        accountingFirmProfile: true,
        personalAccounts: { select: { id: true, name: true, type: true, balance: true, active: true } },
      },
    });

    if (!tenant) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Tenant não encontrado.' } });
      return;
    }

    res.json({ success: true, data: tenant, error: null });
  } catch (err) {
    next(err);
  }
});

platformAdminTenantRouter.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = z.object({ status: z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED']) }).parse(req.body);

    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { status },
    });

    await prisma.auditLog.create({
      data: {
        action: 'TENANT_STATUS_CHANGED',
        resource: 'Tenant',
        resourceId: req.params.id,
        changes: { newStatus: status, adminId: req.userId },
        userId: req.userId,
      },
    });

    res.json({ success: true, data: tenant, error: null });
  } catch (err) {
    next(err);
  }
});

platformAdminTenantRouter.post('/:id/impersonate', async (req, res, next) => {
  try {
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);

    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!tenant) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Tenant não encontrado.' } });
      return;
    }

    await prisma.impersonationLog.create({
      data: {
        platformAdminId: req.userId!,
        tenantId: req.params.id,
        tenantName: tenant.tradeName ?? tenant.legalName,
        reason,
        ip: req.ip ?? '',
      },
    });

    res.json({ success: true, data: { tenantId: req.params.id, tenantName: tenant.tradeName ?? tenant.legalName }, error: null });
  } catch (err) {
    next(err);
  }
});

platformAdminTenantRouter.post('/:id/modules/activate', async (req, res, next) => {
  try {
    const { moduleCode } = z.object({ moduleCode: z.string() }).parse(req.body);

    await prisma.tenantModule.upsert({
      where: { tenantId_moduleCode: { tenantId: req.params.id, moduleCode } },
      create: { tenantId: req.params.id, moduleCode, active: true },
      update: { active: true, activatedAt: new Date(), deactivatedAt: null },
    });

    res.json({ success: true, data: { message: 'Módulo ativado.' }, error: null });
  } catch (err) {
    next(err);
  }
});

platformAdminTenantRouter.post('/:id/modules/deactivate', async (req, res, next) => {
  try {
    const { moduleCode } = z.object({ moduleCode: z.string() }).parse(req.body);

    await prisma.tenantModule.update({
      where: { tenantId_moduleCode: { tenantId: req.params.id, moduleCode } },
      data: { active: false, deactivatedAt: new Date() },
    });

    res.json({ success: true, data: { message: 'Módulo desativado.' }, error: null });
  } catch (err) {
    next(err);
  }
});
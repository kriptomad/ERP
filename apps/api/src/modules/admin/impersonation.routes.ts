import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/auth.middleware';
import { logger } from '../../logging/structured-logger';

export const impersonationRouter = Router();

impersonationRouter.use(authenticate);
impersonationRouter.use(requireRole('OWNER'));

const impersonateSchema = z.object({
  tenantId: z.string().uuid(),
  reason: z.string().min(1),
});

impersonationRouter.post('/', async (req, res, next) => {
  try {
    const { tenantId, reason } = impersonateSchema.parse(req.body);

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Tenant não encontrado.' } });
      return;
    }

    await prisma.impersonationLog.create({
      data: {
        platformAdminId: req.userId!,
        tenantId,
        tenantName: tenant.tradeName,
        reason,
        ip: req.ip || 'unknown',
      },
    });

    logger.info('Impersonation started', { platformAdminId: req.userId, tenantId, reason });

    res.json({
      success: true,
      data: {
        message: `Impersonação iniciada para ${tenant.tradeName}`,
        tenantId,
        tenantName: tenant.tradeName,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

impersonationRouter.get('/logs', async (req, res, next) => {
  try {
    const logs = await prisma.impersonationLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, data: logs, error: null });
  } catch (err) {
    next(err);
  }
});

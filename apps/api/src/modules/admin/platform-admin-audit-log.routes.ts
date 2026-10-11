import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/auth.middleware';

export const platformAdminAuditLogRouter = Router();

platformAdminAuditLogRouter.use(authenticate);
platformAdminAuditLogRouter.use(requireRole('SUPER_ADMIN'));

platformAdminAuditLogRouter.get('/', async (req, res, next) => {
  try {
    const { tenantId, userId, action, resource, startDate, endDate, page = '1', limit = '50' } = req.query;

    const where: Record<string, unknown> = {};
    if (tenantId) where.tenantId = tenantId;
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (startDate && endDate) where.createdAt = { gte: new Date(startDate as string), lte: new Date(endDate as string) };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ success: true, data: { items: logs, total }, error: null });
  } catch (err) {
    next(err);
  }
});

platformAdminAuditLogRouter.get('/stats', async (_req, res, next) => {
  try {
    const [total, byAction, byResource, last24h] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.groupBy({ by: ['action'], _count: { action: true } }),
      prisma.auditLog.groupBy({ by: ['resource'], _count: { resource: true } }),
      prisma.auditLog.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    ]);

    res.json({
      success: true,
      data: { total, byAction, byResource, last24h },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});
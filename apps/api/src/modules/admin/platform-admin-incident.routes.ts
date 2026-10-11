import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/auth.middleware';

export const platformAdminIncidentRouter = Router();

platformAdminIncidentRouter.use(authenticate);
platformAdminIncidentRouter.use(requireRole('SUPER_ADMIN'));

platformAdminIncidentRouter.get('/', async (req, res, next) => {
  try {
    const { severity, service, resolved, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = {};
    if (severity) where.severity = severity;
    if (service) where.service = service;
    if (resolved !== undefined) where.resolvedAt = resolved === 'true' ? { not: null } : null;

    const [incidents, total] = await Promise.all([
      prisma.incidentEvent.findMany({
        where,
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.incidentEvent.count({ where }),
    ]);

    res.json({ success: true, data: { items: incidents, total }, error: null });
  } catch (err) {
    next(err);
  }
});

platformAdminIncidentRouter.post('/', async (req, res, next) => {
  try {
    const data = z.object({
      severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
      title: z.string().min(1),
      description: z.string().optional(),
      service: z.string().optional(),
    }).parse(req.body);

    const incident = await prisma.incidentEvent.create({ data });
    res.status(201).json({ success: true, data: incident, error: null });
  } catch (err) {
    next(err);
  }
});

platformAdminIncidentRouter.patch('/:id/resolve', async (req, res, next) => {
  try {
    const incident = await prisma.incidentEvent.update({
      where: { id: req.params.id },
      data: { resolvedAt: new Date(), severity: 'RESOLVED' },
    });
    res.json({ success: true, data: incident, error: null });
  } catch (err) {
    next(err);
  }
});
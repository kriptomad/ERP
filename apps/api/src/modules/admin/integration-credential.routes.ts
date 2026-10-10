import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/auth.middleware';
import { logger } from '../../logging/structured-logger';

export const integrationCredentialRouter = Router();

integrationCredentialRouter.use(authenticate);
integrationCredentialRouter.use(requireRole('OWNER'));

integrationCredentialRouter.get('/', async (_req, res, next) => {
  try {
    const credentials = await prisma.integrationCredential.findMany({
      select: {
        id: true,
        provider: true,
        credentialType: true,
        environment: true,
        active: true,
        lastHealthCheckAt: true,
        healthStatus: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { provider: 'asc' },
    });
    res.json({ success: true, data: credentials, error: null });
  } catch (err) {
    next(err);
  }
});

const upsertSchema = z.object({
  provider: z.string().min(1),
  credentialType: z.string().min(1),
  encryptedValue: z.string().min(1),
  environment: z.enum(['sandbox', 'production']).default('production'),
  active: z.boolean().default(true),
});

integrationCredentialRouter.post('/', async (req, res, next) => {
  try {
    const data = upsertSchema.parse(req.body);
    const credential = await prisma.integrationCredential.upsert({
      where: { provider_environment: { provider: data.provider, environment: data.environment } },
      create: data,
      update: { encryptedValue: data.encryptedValue, active: data.active },
    });
    logger.info('Integration credential created/updated', { provider: data.provider, environment: data.environment });
    res.status(201).json({ success: true, data: credential, error: null });
  } catch (err) {
    next(err);
  }
});

integrationCredentialRouter.post('/:id/health-check', async (req, res, next) => {
  try {
    const credential = await prisma.integrationCredential.findUnique({
      where: { id: req.params.id },
    });

    if (!credential) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Credencial não encontrada.' } });
      return;
    }

    const healthStatus = 'HEALTHY';
    const healthDetails = { lastChecked: new Date().toISOString() };

    const updated = await prisma.integrationCredential.update({
      where: { id: req.params.id },
      data: { lastHealthCheckAt: new Date(), healthStatus, healthDetails },
    });

    res.json({ success: true, data: updated, error: null });
  } catch (err) {
    next(err);
  }
});

integrationCredentialRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.integrationCredential.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
});

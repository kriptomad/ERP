import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/auth.middleware';

export const apiKeyRouter = Router();

apiKeyRouter.use(authenticate);
apiKeyRouter.use(requireRole('OWNER'));

apiKeyRouter.get('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const keys = await prisma.apiKey.findMany({
      where: { tenantId: tenantId! },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: keys, error: null });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.string()).default([]),
  expiresAt: z.string().datetime().optional(),
});

apiKeyRouter.post('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = createSchema.parse(req.body);

    const rawKey = crypto.randomBytes(32).toString('hex');
    const keyPrefix = rawKey.slice(0, 8);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await prisma.apiKey.create({
      data: {
        tenantId: tenantId!,
        name: data.name,
        keyHash,
        keyPrefix,
        scopes: data.scopes,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: apiKey.id,
        name: apiKey.name,
        key: rawKey,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

apiKeyRouter.delete('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    await prisma.apiKey.update({
      where: { id: req.params.id, tenantId: tenantId! },
      data: { revokedAt: new Date() },
    });
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
});

import { getRequestContext } from '../../middlewares/request-context.middleware';

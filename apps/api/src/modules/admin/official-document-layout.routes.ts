import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/auth.middleware';

export const officialDocumentLayoutRouter = Router();

officialDocumentLayoutRouter.use(authenticate);
officialDocumentLayoutRouter.use(requireRole('OWNER'));

officialDocumentLayoutRouter.get('/', async (_req, res, next) => {
  try {
    const layouts = await prisma.officialDocumentLayoutVersion.findMany({
      orderBy: { documentType: 'asc', version: 'desc' },
    });
    res.json({ success: true, data: layouts, error: null });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  documentType: z.string().min(1),
  version: z.string().min(1),
  layoutJson: z.record(z.unknown()),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional(),
});

officialDocumentLayoutRouter.post('/', async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const layout = await prisma.officialDocumentLayoutVersion.create({
      data: {
        version: data.version,
        documentType: data.documentType,
        layoutJson: data.layoutJson as Prisma.InputJsonValue,
        effectiveFrom: new Date(data.effectiveFrom),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
      },
    });
    res.status(201).json({ success: true, data: layout, error: null });
  } catch (err) {
    next(err);
  }
});

officialDocumentLayoutRouter.get('/:documentType/:version', async (req, res, next) => {
  try {
    const layout = await prisma.officialDocumentLayoutVersion.findUnique({
      where: { documentType_version: { documentType: req.params.documentType, version: req.params.version } },
    });
    if (!layout) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Layout não encontrado.' } });
      return;
    }
    res.json({ success: true, data: layout, error: null });
  } catch (err) {
    next(err);
  }
});

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/auth.middleware';

export const platformAdminReleaseRouter = Router();

platformAdminReleaseRouter.use(authenticate);
platformAdminReleaseRouter.use(requireRole('SUPER_ADMIN'));

platformAdminReleaseRouter.get('/', async (_req, res, next) => {
  try {
    const releases = await prisma.releaseNote.findMany({ orderBy: { publishedAt: 'desc' }, take: 20 });
    res.json({ success: true, data: releases, error: null });
  } catch (err) {
    next(err);
  }
});

platformAdminReleaseRouter.post('/', async (req, res, next) => {
  try {
    const data = z.object({ version: z.string().min(1), title: z.string().min(1), description: z.string() }).parse(req.body);
    const release = await prisma.releaseNote.create({ data });
    res.status(201).json({ success: true, data: release, error: null });
  } catch (err) {
    next(err);
  }
});
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/auth.middleware';

export const fiscalCodeCatalogRouter = Router();

fiscalCodeCatalogRouter.use(authenticate);
fiscalCodeCatalogRouter.use(requireRole('OWNER'));

fiscalCodeCatalogRouter.get('/', async (req, res, next) => {
  try {
    const { codeType, search, page = '1', limit = '50' } = req.query;

    const where: Record<string, unknown> = {
      ...(codeType && { codeType: codeType as string }),
      ...(search && {
        OR: [
          { code: { contains: search as string, mode: 'insensitive' } },
          { description: { contains: search as string, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.fiscalCodeCatalog.findMany({
        where,
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { code: 'asc' },
      }),
      prisma.fiscalCodeCatalog.count({ where }),
    ]);

    res.json({ success: true, data: { items, total }, error: null });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  codeType: z.enum(['NCM', 'NBS', 'CEST', 'CFOP']),
  code: z.string().min(1),
  description: z.string().min(1),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional(),
});

fiscalCodeCatalogRouter.post('/', async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const item = await prisma.fiscalCodeCatalog.create({
      data: {
        ...data,
        effectiveFrom: new Date(data.effectiveFrom),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
      },
    });
    res.status(201).json({ success: true, data: item, error: null });
  } catch (err) {
    next(err);
  }
});

fiscalCodeCatalogRouter.post('/bulk', async (req, res, next) => {
  try {
    const items = z.array(createSchema).parse(req.body);
    const created = await prisma.fiscalCodeCatalog.createMany({
      data: items.map((item) => ({
        ...item,
        effectiveFrom: new Date(item.effectiveFrom),
        effectiveTo: item.effectiveTo ? new Date(item.effectiveTo) : null,
      })),
      skipDuplicates: true,
    });
    res.status(201).json({ success: true, data: { count: created.count }, error: null });
  } catch (err) {
    next(err);
  }
});

fiscalCodeCatalogRouter.put('/:id', async (req, res, next) => {
  try {
    const data = createSchema.partial().parse(req.body);
    const item = await prisma.fiscalCodeCatalog.update({
      where: { id: req.params.id },
      data: {
        ...data,
        ...(data.effectiveFrom && { effectiveFrom: new Date(data.effectiveFrom) }),
        ...(data.effectiveTo && { effectiveTo: new Date(data.effectiveTo) }),
      },
    });
    res.json({ success: true, data: item, error: null });
  } catch (err) {
    next(err);
  }
});

fiscalCodeCatalogRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.fiscalCodeCatalog.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
});

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';

const createProductSchema = z.object({
  sku: z.string().min(1),
  barcode: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  unitPrice: z.number().positive(),
  wholesalePrice: z.number().positive().optional(),
  resalePrice: z.number().positive().optional(),
  wholesaleMinQty: z.number().int().positive().optional(),
  minStockThreshold: z.number().positive().optional(),
  costPrice: z.number().positive().optional(),
  supplierId: z.string().uuid().optional(),
  trackingType: z.enum(['NONE', 'BATCH', 'SERIAL', 'VARIANT']).default('NONE'),
  isWeighted: z.boolean().default(false),
  isReturnableContainer: z.boolean().default(false),
  isReturnable: z.boolean().default(true),
  requiresPrescriptionRetention: z.boolean().default(false),
  isControlledSubstance: z.boolean().default(false),
});

export const productRouter = Router();

productRouter.use(authenticate);

productRouter.get('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { search, category, active, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = {
      tenantId: tenantId!,
      ...(category && { category: category as string }),
      ...(active !== undefined && { active: active === 'true' }),
      ...(search && {
        OR: [
          { name: { contains: search as string, mode: 'insensitive' } },
          { sku: { contains: search as string, mode: 'insensitive' } },
          { barcode: { contains: search as string, mode: 'insensitive' } },
        ],
      }),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      success: true,
      data: { items: products, total, page: parseInt(page as string), limit: parseInt(limit as string) },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

productRouter.get('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, tenantId: tenantId! },
    });
    if (!product) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Produto não encontrado.' } });
      return;
    }
    res.json({ success: true, data: product, error: null });
  } catch (err) {
    next(err);
  }
});

productRouter.post('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = createProductSchema.parse(req.body);

    const product = await prisma.product.create({
      data: { ...data, tenantId: tenantId! },
    });

    res.status(201).json({ success: true, data: product, error: null });
  } catch (err) {
    next(err);
  }
});

productRouter.put('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = createProductSchema.partial().parse(req.body);

    const product = await prisma.product.update({
      where: { id: req.params.id, tenantId: tenantId! },
      data,
    });

    res.json({ success: true, data: product, error: null });
  } catch (err) {
    next(err);
  }
});

productRouter.delete('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    await prisma.product.update({
      where: { id: req.params.id, tenantId: tenantId! },
      data: { active: false },
    });
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
});

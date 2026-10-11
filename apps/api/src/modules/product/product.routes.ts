import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireModule } from '../../middlewares/module-gating.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';

const createProductSchema = z.object({
  sku: z.string().min(1),
  barcode: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  trackingType: z.enum(['NONE', 'BATCH', 'SERIAL', 'VARIANT']).default('NONE'),
  ncm: z.string().length(8).default('00000000'),
  cest: z.string().optional(),
  originUf: z.string().length(2).optional(),
  nicheCode: z.string().optional(),
  unitPrice: z.number().positive(),
  wholesalePrice: z.number().positive().optional(),
  resalePrice: z.number().positive().optional(),
  wholesaleMinQty: z.number().int().positive().optional(),
  minStockThreshold: z.number().positive().optional(),
  costPrice: z.number().positive().optional(),
  reorderTargetQuantity: z.number().positive().optional(),
  preferredSupplierId: z.string().uuid().optional(),
  isWeighted: z.boolean().default(false),
  isReturnableContainer: z.boolean().default(false),
  isReturnable: z.boolean().default(true),
  requiresPrescriptionRetention: z.boolean().default(false),
  isControlledSubstance: z.boolean().default(false),
});

const updateProductSchema = createProductSchema.partial();

export const productRouter = Router();

productRouter.use(authenticate);

productRouter.get('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { search, category, trackingType, active, lowStock, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = { tenantId: tenantId! };

    if (category) where.category = category;
    if (trackingType) where.trackingType = trackingType;
    if (active !== undefined) where.active = active === 'true';
    if (lowStock === 'true') where.stockQuantity = { lte: { minStockThreshold: true } };
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { sku: { contains: search as string, mode: 'insensitive' } },
        { barcode: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          batches: { where: { quantity: { gt: 0 } }, orderBy: { expirationDate: 'asc' }, take: 5 },
        },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({ success: true, data: { items: products, total }, error: null });
  } catch (err) {
    next(err);
  }
});

productRouter.get('/low-stock', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const products = await prisma.product.findMany({
      where: {
        tenantId: tenantId!,
        active: true,
        minStockThreshold: { not: null },
      },
    });

    const lowStock = products.filter(p => p.stockQuantity.toNumber() <= (p.minStockThreshold?.toNumber() ?? 0));

    res.json({ success: true, data: lowStock, error: null });
  } catch (err) {
    next(err);
  }
});

productRouter.get('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, tenantId: tenantId! },
      include: {
        supplier: true,
        preferredSupplier: true,
        batches: { where: { quantity: { gt: 0 } }, orderBy: { expirationDate: 'asc' } },
        serials: { where: { status: 'IN_STOCK' } },
        variants: true,
        recipe: true,
      },
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
      include: { supplier: true },
    });

    res.status(201).json({ success: true, data: product, error: null });
  } catch (err) {
    next(err);
  }
});

productRouter.put('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = updateProductSchema.parse(req.body);

    const product = await prisma.product.update({
      where: { id: req.params.id, tenantId: tenantId! },
      data,
      include: { supplier: true },
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

productRouter.post('/:id/variants', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = z.object({
      sku: z.string().min(1),
      barcode: z.string().optional(),
      name: z.string().min(1),
      attributes: z.record(z.string()),
      unitPrice: z.number().positive(),
      stockQuantity: z.number().default(0),
    }).parse(req.body);

    const variant = await prisma.productVariant.create({
      data: {
        tenantId: tenantId!,
        productId: req.params.id,
        ...data,
      },
    });

    res.status(201).json({ success: true, data: variant, error: null });
  } catch (err) {
    next(err);
  }
});

productRouter.post('/:id/batches', requireModule('FISCAL_NFCE'), async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = z.object({
      batchNumber: z.string().min(1),
      manufacturingDate: z.string().datetime().optional(),
      expirationDate: z.string().datetime(),
      quantity: z.number().positive(),
      costPrice: z.number().positive().optional(),
    }).parse(req.body);

    const batch = await prisma.$transaction(async (tx) => {
      const batch = await tx.productBatch.create({
        data: {
          tenantId: tenantId!,
          productId: req.params.id,
          ...data,
        },
      });

      await tx.product.update({
        where: { id: req.params.id },
        data: { stockQuantity: { increment: data.quantity } },
      });

      await tx.stockMovement.create({
        data: {
          tenantId: tenantId!,
          productId: req.params.id,
          batchId: batch.id,
          type: 'PURCHASE',
          quantity: data.quantity,
          unitCost: data.costPrice,
          reason: 'Entrada de lote',
        },
      });

      return batch;
    });

    res.status(201).json({ success: true, data: batch, error: null });
  } catch (err) {
    next(err);
  }
});

productRouter.post('/:id/serials', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = z.object({
      serialNumber: z.string().min(1),
      imei: z.string().optional(),
    }).parse(req.body);

    const serial = await prisma.productSerial.create({
      data: {
        tenantId: tenantId!,
        productId: req.params.id,
        ...data,
      },
    });

    res.status(201).json({ success: true, data: serial, error: null });
  } catch (err) {
    next(err);
  }
});
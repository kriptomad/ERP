import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireBusinessTenant } from '../../middlewares/tenant-type-gatekeeper.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';

export const importationRouter = Router();

importationRouter.use(authenticate);
importationRouter.use(requireBusinessTenant);

importationRouter.get('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { status, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = { tenantId: tenantId! };
    if (status) where.status = status;

    const [imports, total] = await Promise.all([
      prisma.import.findMany({
        where,
        include: { supplier: true, statusHistory: true },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.import.count({ where }),
    ]);

    res.json({ success: true, data: { items: imports, total }, error: null });
  } catch (err) {
    next(err);
  }
});

importationRouter.post('/step1', async (req, res, next) => {
  try {
    const { tenantId, userId } = getRequestContext();
    const data = z.object({
      supplierId: z.string().uuid(),
      supplierName: z.string().min(1),
      items: z.array(z.object({
        productId: z.string().uuid(),
        sku: z.string().min(1),
        name: z.string().min(1),
        quantity: z.number().positive(),
        unitCost: z.number().positive(),
        countryOfOrigin: z.string().optional(),
        ncm: z.string().length(8),
        cest: z.string().optional(),
      })).min(1),
    }).parse(req.body);

    const imp = await prisma.import.create({
      data: {
        tenantId: tenantId!,
        supplierId: data.supplierId,
        supplierName: data.supplierName,
        status: 'STEP_1_RECEBIDO',
        items: { create: data.items },
        createdById: userId!,
      },
    });

    res.status(201).json({ success: true, data: imp, error: null });
  } catch (err) {
    next(err);
  }
});

importationRouter.post('/step2', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { importId } = z.object({ importId: z.string() }).parse(req.body);

    const imp = await prisma.import.update({
      where: { id: importId, tenantId: tenantId! },
      data: { status: 'STEP_2_NADO_CHECKING' },
    });

    res.json({ success: true, data: imp, error: null });
  } catch (err) {
    next(err);
  }
});

importationRouter.post('/step3', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { importId } = z.object({ importId: z.string() }).parse(req.body);

    const imp = await prisma.import.update({
      where: { id: importId, tenantId: tenantId! },
      data: { status: 'STEP_3_APROVADO' },
    });

    res.json({ success: true, data: imp, error: null });
  } catch (err) {
    next(err);
  }
});

importationRouter.post('/step4', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { importId } = z.object({ importId: z.string() }).parse(req.body);

    const imp = await prisma.import.update({
      where: { id: importId, tenantId: tenantId! },
      data: { status: 'STEP_4_CONCLUIDO' },
    });

    // Sincronizar produtos ao estoque
    await prisma.$transaction(async (tx) => {
      const imp = await tx.import.findUnique({ where: { id: importId }, include: { items: true } });
      if (imp && imp.items) {
        for (const item of imp.items) {
          const product = await tx.product.findFirst({ where: { id: item.productId, tenantId: tenantId! } });
          if (product) {
            await tx.product.update({ where: { id: item.productId }, data: { stockQuantity: { increment: item.quantity } } });
          } else {
            await tx.product.create({
              data: {
                tenantId: tenantId!,
                sku: item.sku,
                name: item.name,
                category: 'Importados',
                trackingType: 'NONE',
                unitPrice: item.unitCost,
                costPrice: item.unitCost,
                stockQuantity: item.quantity,
                active: true,
              },
            });
          }
        }
      }
    });

    res.json({ success: true, data: imp, error: null });
  } catch (err) {
    next(err);
  }
});

importationRouter.get('/:id/status-history', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const history = await prisma.importStatusHistory.findMany({
      where: { importId: req.params.id, tenantId: tenantId! },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: history, error: null });
  } catch (err) {
    next(err);
  }
});

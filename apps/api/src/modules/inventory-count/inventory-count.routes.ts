import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireBusinessTenant } from '../../middlewares/tenant-type-gatekeeper.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';

export const inventoryCountRouter = Router();

inventoryCountRouter.use(authenticate);
inventoryCountRouter.use(requireBusinessTenant);

// Lista de contagens físicas (contagem cega) do tenant
inventoryCountRouter.get('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { status, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = { tenantId: tenantId! };
    if (status) where.status = status;

    const [counts, total] = await Promise.all([
      prisma.inventoryCount.findMany({
        where,
        include: {
          items: {
            include: { product: { select: { id: true, name: true, sku: true } } },
          },
          startedByUser: { select: { id: true, name: true } },
          approvedByUser: { select: { id: true, name: true } },
        },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { startedAt: 'desc' },
      }),
      prisma.inventoryCount.count({ where }),
    ]);

    res.json({ success: true, data: { items: counts, total }, error: null });
  } catch (err) {
    next(err);
  }
});

// Cria uma contagem física cega: o sistema NÃO revela a quantidade esperada ao operador
inventoryCountRouter.post('/', async (req, res, next) => {
  try {
    const { tenantId, userId } = getRequestContext();
    const data = z.object({
      category: z.string().optional(),
      notes: z.string().optional(),
      items: z.array(z.object({
        productId: z.string().uuid(),
        systemQuantity: z.number().nonnegative(),
        countedQuantity: z.number().nonnegative(),
        notes: z.string().optional(),
      })).optional(),
    }).parse(req.body);

    const count = await prisma.inventoryCount.create({
      data: {
        tenantId: tenantId!,
        category: data.category,
        notes: data.notes,
        status: 'IN_PROGRESS',
        startedBy: userId!,
        items: {
          create: (data.items || []).map((item) => ({
            tenantId: tenantId!,
            productId: item.productId,
            systemQuantity: item.systemQuantity,
            countedQuantity: item.countedQuantity,
            divergence: item.countedQuantity - item.systemQuantity,
            countedBy: userId!,
            notes: item.notes,
            countedAt: new Date(),
          })),
        },
      },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
      },
    });

    res.status(201).json({ success: true, data: count, error: null });
  } catch (err) {
    next(err);
  }
});

// Fecha a contagem e baixa as divergências no estoque (REGRATION_ERROR / INVENTORY_DIVERGENCE)
inventoryCountRouter.patch('/:id/close', async (req, res, next) => {
  try {
    const { tenantId, userId } = getRequestContext();
    z.object({}).parse(req.body ?? {});

    const items = await prisma.inventoryCountItem.findMany({
      where: { inventoryCountId: req.params.id, tenantId: tenantId! },
    });

    const count = await prisma.inventoryCount.update({
      where: { id: req.params.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        approvedBy: userId!,
      },
    });

    // Aplicar divergências no estoque via StockMovement auditável
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const divergence = item.divergence.toNumber();
        if (divergence === 0) continue;

        const product = await tx.product.findFirst({
          where: { id: item.productId, tenantId: tenantId! },
        });
        if (!product) continue;

        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: divergence } },
        });

        await tx.stockMovement.create({
          data: {
            tenantId: tenantId!,
            productId: item.productId,
            type: 'ADJUSTMENT',
            subtype: 'INVENTORY_DIVERGENCE',
            quantity: divergence,
            reason: `Contagem física ${count.id} — divergência de ${divergence}`,
            referenceType: 'INVENTORY_COUNT',
            referenceId: count.id,
          },
        });
      }
    });

    res.json({ success: true, data: count, error: null });
  } catch (err) {
    next(err);
  }
});

// Divergências da contagem (somente itens com divergence != 0)
inventoryCountRouter.get('/:id/discrepancies', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const count = await prisma.inventoryCount.findFirst({
      where: { id: req.params.id, tenantId: tenantId! },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
      },
    });

    if (!count) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Contagem física não encontrada.' } });
      return;
    }

    const discrepancies = count.items.filter((i) => i.divergence.toNumber() !== 0);
    res.json({ success: true, data: { count, discrepancies }, error: null });
  } catch (err) {
    next(err);
  }
});

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';

const createClientSchema = z.object({
  name: z.string().min(1),
  document: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  creditLimit: z.number().min(0).default(0),
});

export const clientRouter = Router();

clientRouter.use(authenticate);

clientRouter.get('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { search, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = {
      tenantId: tenantId!,
      ...(search && {
        OR: [
          { name: { contains: search as string, mode: 'insensitive' } },
          { document: { contains: search as string } },
        ],
      }),
    };

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { name: 'asc' },
      }),
      prisma.client.count({ where }),
    ]);

    res.json({ success: true, data: { items: clients, total }, error: null });
  } catch (err) {
    next(err);
  }
});

clientRouter.get('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const client = await prisma.client.findFirst({
      where: { id: req.params.id, tenantId: tenantId! },
      include: {
        sales: { orderBy: { createdAt: 'desc' }, take: 10 },
        loyaltyAccount: true,
      },
    });
    if (!client) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Cliente não encontrado.' } });
      return;
    }
    res.json({ success: true, data: client, error: null });
  } catch (err) {
    next(err);
  }
});

clientRouter.post('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = createClientSchema.parse(req.body);

    const client = await prisma.client.create({
      data: { ...data, tenantId: tenantId! },
    });

    res.status(201).json({ success: true, data: client, error: null });
  } catch (err) {
    next(err);
  }
});

clientRouter.put('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = createClientSchema.partial().parse(req.body);

    const client = await prisma.client.update({
      where: { id: req.params.id, tenantId: tenantId! },
      data,
    });

    res.json({ success: true, data: client, error: null });
  } catch (err) {
    next(err);
  }
});

clientRouter.delete('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    await prisma.client.delete({
      where: { id: req.params.id, tenantId: tenantId! },
    });
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
});

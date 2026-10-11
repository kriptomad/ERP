import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/auth.middleware';

export const platformAdminSubscriptionRouter = Router();

platformAdminSubscriptionRouter.use(authenticate);
platformAdminSubscriptionRouter.use(requireRole('SUPER_ADMIN', 'FINANCE_ANALYST', 'SUPPORT_AGENT'));

platformAdminSubscriptionRouter.get('/', async (req, res, next) => {
  try {
    const { status, provider, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (provider) where.provider = provider;

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: { tenant: { select: { id: true, tradeName: true } }, plan: true },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.subscription.count({ where }),
    ]);

    res.json({ success: true, data: { items: subscriptions, total }, error: null });
  } catch (err) {
    next(err);
  }
});

platformAdminSubscriptionRouter.get('/:id', async (req, res, next) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { id: req.params.id },
      include: { tenant: true, plan: true, billingEvents: { orderBy: { createdAt: 'desc' } } },
    });

    if (!subscription) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Assinatura não encontrada.' } });
      return;
    }

    res.json({ success: true, data: subscription, error: null });
  } catch (err) {
    next(err);
  }
});

platformAdminSubscriptionRouter.post('/:id/refund', async (req, res, next) => {
  try {
    const { amount, reason } = z.object({ amount: z.number().positive().optional(), reason: z.string().min(1) }).parse(req.body);

    const subscription = await prisma.subscription.findUnique({ where: { id: req.params.id } });
    if (!subscription) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Assinatura não encontrada.' } });
      return;
    }

    const event = await prisma.billingEvent.create({
      data: {
        subscriptionId: subscription.id,
        provider: subscription.provider,
        externalEventKey: `manual_refund_${Date.now()}`,
        type: 'MANUAL_REFUND',
        payload: { amount, reason, adminId: req.userId },
      },
    });

    res.status(201).json({ success: true, data: event, error: null });
  } catch (err) {
    next(err);
  }
});

platformAdminSubscriptionRouter.post('/:id/retry-payment', async (req, res, next) => {
  try {
    const subscription = await prisma.subscription.findUnique({ where: { id: req.params.id } });
    if (!subscription) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Assinatura não encontrada.' } });
      return;
    }

    await prisma.subscription.update({
      where: { id: req.params.id },
      data: { failedPaymentAttempts: 0, nextRetryAt: new Date(), status: 'ACTIVE' },
    });

    await prisma.tenant.update({
      where: { id: subscription.tenantId },
      data: { status: 'ACTIVE', gracePeriodEndsAt: null },
    });

    res.json({ success: true, data: { message: 'Retry agendado.' }, error: null });
  } catch (err) {
    next(err);
  }
});
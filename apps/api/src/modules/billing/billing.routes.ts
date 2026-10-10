import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';

const checkoutSchema = z.object({
  planId: z.string().uuid(),
  moduleCodes: z.array(z.string()).default([]),
  paymentMethod: z.enum(['CREDIT_CARD', 'PIX', 'BOLETO']),
});

export const billingRouter = Router();

billingRouter.use(authenticate);

billingRouter.get('/plans', async (_req, res, next) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { active: true },
    });
    res.json({ success: true, data: plans, error: null });
  } catch (err) {
    next(err);
  }
});

billingRouter.get('/modules', async (_req, res, next) => {
  try {
    const modules = await prisma.module.findMany({
      where: { active: true },
    });
    res.json({ success: true, data: modules, error: null });
  } catch (err) {
    next(err);
  }
});

billingRouter.get('/subscription', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId: tenantId! },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: subscription, error: null });
  } catch (err) {
    next(err);
  }
});

billingRouter.post('/checkout', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = checkoutSchema.parse(req.body);

    const plan = await prisma.plan.findUnique({
      where: { id: data.planId },
    });

    if (!plan) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Plano não encontrado.' } });
      return;
    }

    const modules = await prisma.module.findMany({
      where: { code: { in: data.moduleCodes } },
    });

    const totalAmount = plan.basePrice.toNumber() + modules.reduce((sum: number, m: { monthlyPrice: { toNumber(): number } }) => sum + m.monthlyPrice.toNumber(), 0);

    const subscription = await prisma.subscription.create({
      data: {
        tenantId: tenantId!,
        planId: data.planId,
        provider: 'asaas',
        externalSubscriptionId: `sub_${Date.now()}`,
        status: 'TRIAL',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      include: { plan: true },
    });

    for (const mod of modules) {
      await prisma.tenantModule.upsert({
        where: { tenantId_moduleCode: { tenantId: tenantId!, moduleCode: mod.code } },
        create: { tenantId: tenantId!, moduleCode: mod.code, active: true },
        update: { active: true, activatedAt: new Date(), deactivatedAt: null },
      });
    }

    res.status(201).json({
      success: true,
      data: {
        subscription,
        totalAmount,
        modules: modules.map((m: { code: string; label: string }) => ({ code: m.code, label: m.label })),
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

billingRouter.post('/subscription/cancel', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId: tenantId! },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Assinatura não encontrada.' } });
      return;
    }

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelRequestedAt: new Date(),
        cancelAtPeriodEnd: true,
      },
    });

    res.json({ success: true, data: updated, error: null });
  } catch (err) {
    next(err);
  }
});

billingRouter.get('/billing-events', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId: tenantId! },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      res.json({ success: true, data: [], error: null });
      return;
    }

    const events = await prisma.billingEvent.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: events, error: null });
  } catch (err) {
    next(err);
  }
});

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { billingQueue } from './queue';
import { handlePaymentFailure, handlePaymentRecovered, processCancelAtPeriodEnd } from './billing.service';
import { authenticate } from '../../middlewares/auth.middleware';

export const billingJobRouter = Router();

billingJobRouter.use(authenticate);

billingJobRouter.post('/jobs/dunning/process', async (req, res, next) => {
  try {
    const overdueSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'PAST_DUE',
        nextRetryAt: { lte: new Date() },
      },
    });

    const results = [];
    for (const sub of overdueSubscriptions) {
      const result = await handlePaymentFailure(sub.tenantId, sub.id);
      results.push({ subscriptionId: sub.id, ...result });
    }

    res.json({ success: true, data: { processed: results.length, results }, error: null });
  } catch (err) {
    next(err);
  }
});

billingJobRouter.post('/jobs/cancellation/process', async (req, res, next) => {
  try {
    const cancelPending = await prisma.subscription.findMany({
      where: {
        cancelAtPeriodEnd: true,
        status: 'ACTIVE',
        currentPeriodEnd: { lte: new Date() },
      },
    });

    const results = [];
    for (const sub of cancelPending) {
      await processCancelAtPeriodEnd(sub.tenantId, sub.id);
      results.push({ subscriptionId: sub.id, status: 'CANCELLED' });
    }

    res.json({ success: true, data: { processed: results.length, results }, error: null });
  } catch (err) {
    next(err);
  }
});

billingJobRouter.post('/jobs/charge/process', async (req, res, next) => {
  try {
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: { gte: new Date() },
      },
      include: { plan: true },
    });

    const results = [];
    for (const sub of activeSubscriptions) {
      if (sub.creditBalanceMonths > 0) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { creditBalanceMonths: { decrement: 1 } },
        });
        results.push({ subscriptionId: sub.id, action: 'CREDIT_APPLIED' });
      } else {
        await billingQueue.add('charge-recurring', {
          type: 'charge-recurring',
          tenantId: sub.tenantId,
          subscriptionId: sub.id,
          externalSubscriptionId: sub.externalSubscriptionId,
        });
        results.push({ subscriptionId: sub.id, action: 'CHARGE_QUEUED' });
      }
    }

    res.json({ success: true, data: { processed: results.length, results }, error: null });
  } catch (err) {
    next(err);
  }
});

billingJobRouter.get('/jobs/status', async (_req, res, next) => {
  try {
    const [activeJobs, completedJobs, failedJobs] = await Promise.all([
      billingQueue.getActive(),
      billingQueue.getCompleted(),
      billingQueue.getFailed(),
    ]);

    res.json({
      success: true,
      data: {
        active: activeJobs.length,
        completed: completedJobs.length,
        failed: failedJobs.length,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

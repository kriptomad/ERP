import { Router } from 'express';
import { prisma } from '../infra/prisma';
import { redisConnection } from '../infra/redis/connection';

export const metricsRouter = Router();

metricsRouter.get('/metrics', async (_req, res) => {
  const [tenantCount, userCount, productCount, saleCount, activeSubscriptions, pendingPayments] = await Promise.all([
    prisma.tenant.count(),
    prisma.user.count(),
    prisma.product.count(),
    prisma.sale.count({ where: { status: 'COMPLETED' } }),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.subscription.count({ where: { status: 'PAST_DUE' } }),
  ]);

  const redisInfo = await redisConnection.info('memory');
  const redisMemory = redisInfo.match(/used_memory_human:(.+)/)?.[1]?.trim() || 'unknown';

  res.json({
    success: true,
    data: {
      tenants: { total: tenantCount },
      users: { total: userCount },
      products: { total: productCount },
      sales: { total: saleCount },
      subscriptions: { active: activeSubscriptions, pastDue: pendingPayments },
      redis: { memory: redisMemory },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
    },
    error: null,
  });
});

metricsRouter.get('/status', async (_req, res) => {
  const startTime = Date.now();

  const dbLatency = await measureLatency(() => prisma.$queryRaw`SELECT 1`);
  const redisLatency = await measureLatency(() => redisConnection.ping());

  const status = {
    timestamp: new Date().toISOString(),
    services: {
      database: dbLatency < 1000 ? 'healthy' : 'degraded',
      redis: redisLatency < 500 ? 'healthy' : 'degraded',
    },
    latency: {
      database: `${dbLatency}ms`,
      redis: `${redisLatency}ms`,
      total: `${Date.now() - startTime}ms`,
    },
  };

  res.json({ success: true, data: status, error: null });
});

async function measureLatency(fn: () => Promise<unknown>): Promise<number> {
  const start = Date.now();
  try {
    await fn();
    return Date.now() - start;
  } catch {
    return -1;
  }
}

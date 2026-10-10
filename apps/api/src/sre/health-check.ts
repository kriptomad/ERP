import { Router } from 'express';
import { prisma } from '../infra/prisma';
import { redisConnection } from '../infra/redis/connection';
import { logger } from '../logging/structured-logger';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'healthy', latencyMs: Date.now() - dbStart };
  } catch (error) {
    checks.database = { status: 'unhealthy', error: String(error) };
    logger.error('Health check: database unhealthy', { error });
  }

  const redisStart = Date.now();
  try {
    await redisConnection.ping();
    checks.redis = { status: 'healthy', latencyMs: Date.now() - redisStart };
  } catch (error) {
    checks.redis = { status: 'unhealthy', error: String(error) };
    logger.error('Health check: redis unhealthy', { error });
  }

  const allHealthy = Object.values(checks).every((c) => c.status === 'healthy');

  res.status(allHealthy ? 200 : 503).json({
    success: allHealthy,
    data: {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      checks,
    },
    error: null,
  });
});

healthRouter.get('/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ready: true });
  } catch {
    res.status(503).json({ ready: false });
  }
});

healthRouter.get('/live', (_req, res) => {
  res.json({ alive: true });
});

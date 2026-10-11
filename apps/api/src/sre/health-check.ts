import { Request, Response } from 'express';
import { prisma } from '../infra/prisma';
import { logger } from '../logging/structured-logger';

export const healthRouter = (): any => {
  const router = require('express').Router();

  router.get('/health', async (req: Request, res: Response) => {
    try {
      // Verificar conexão com PostgreSQL
      await prisma.$queryRawUnsafe('SELECT 1');

      // Verificar conexão com Redis
      const { Pool } = require('pg');
      const pool = new Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: 5432,
        database: process.env.POSTGRES_DB || 'filitech_erp',
        user: process.env.POSTGRES_USER || 'postgres',
      });
      await pool.query('SELECT 1');
      await pool.end();

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: 'up',
          redis: 'up',
        },
      });
    } catch (err) {
      logger.error('Health check failed', { error: err });
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Service unavailable',
      });
    }
  });

  router.get('/metrics', async (req: Request, res: Response) => {
    try {
      const [tenants, users, activeSubscriptions] = await Promise.all([
        prisma.tenant.count(),
        prisma.user.count(),
        prisma.subscription.findMany({ where: { status: 'ACTIVE' } }).then(r => r.length),
      ]);

      res.json({
        tenants,
        users,
        activeSubscriptions,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.error('Metrics failed', { error: err });
      res.status(500).json({ error: 'Failed to fetch metrics' });
    }
  });

  return router;
};

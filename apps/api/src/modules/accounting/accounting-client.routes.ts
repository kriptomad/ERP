import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';
import { assertAccountingAccess, requireAccountingScope } from '../../middlewares/accounting-access.middleware';

export const accountingClientRouter = Router();

accountingClientRouter.use(authenticate);
accountingClientRouter.use(assertAccountingAccess);
accountingClientRouter.use(requireAccountingScope('FULL_BOOKKEEPING', 'TAX_FILING', 'PAYROLL_ESOCIAL', 'PERSONAL_INCOME_TAX'));

accountingClientRouter.get('/clients', async (req, res, next) => {
  try {
    const engagement = req.accountingEngagement!;
    const { page = '1', limit = '20' } = req.query;

    const engagements = await prisma.accountingEngagement.findMany({
      where: { firmTenantId: engagement.firmTenantId, status: 'ACTIVE' },
      include: { client: { select: { id: true, tradeName: true, cnpj: true, taxRegime: true, status: true } } },
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string),
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.accountingEngagement.count({
      where: { firmTenantId: engagement.firmTenantId, status: 'ACTIVE' },
    });

    res.json({ success: true, data: { items: engagements.map(e => e.client), total }, error: null });
  } catch (err) {
    next(err);
  }
});

accountingClientRouter.get('/clients/:clientTenantId/chart-of-accounts', async (req, res, next) => {
  try {
    const engagement = req.accountingEngagement!;
    if (engagement.clientTenantId !== req.params.clientTenantId) {
      res.status(403).json({ success: false, data: null, error: { code: 'FORBIDDEN', message: 'Acesso negado a este cliente.' } });
      return;
    }

    const accounts = await prisma.chartOfAccount.findMany({
      where: { tenantId: req.params.clientTenantId },
      orderBy: { code: 'asc' },
    });

    res.json({ success: true, data: accounts, error: null });
  } catch (err) {
    next(err);
  }
});

accountingClientRouter.get('/clients/:clientTenantId/sales', async (req, res, next) => {
  try {
    const engagement = req.accountingEngagement!;
    if (engagement.clientTenantId !== req.params.clientTenantId) {
      res.status(403).json({ success: false, data: null, error: { code: 'FORBIDDEN', message: 'Acesso negado a este cliente.' } });
      return;
    }

    const { startDate, endDate, page = '1', limit = '50' } = req.query;

    const where: Record<string, unknown> = {
      tenantId: req.params.clientTenantId,
      status: 'COMPLETED',
      ...(startDate && endDate && { createdAt: { gte: new Date(startDate as string), lte: new Date(endDate as string) } }),
    };

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: { items: true, client: { select: { id: true, name: true, document: true } } },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.sale.count({ where }),
    ]);

    res.json({ success: true, data: { items: sales, total }, error: null });
  } catch (err) {
    next(err);
  }
});

accountingClientRouter.get('/clients/:clientTenantId/payables', async (req, res, next) => {
  try {
    const engagement = req.accountingEngagement!;
    if (engagement.clientTenantId !== req.params.clientTenantId) {
      res.status(403).json({ success: false, data: null, error: { code: 'FORBIDDEN', message: 'Acesso negado a este cliente.' } });
      return;
    }

    const payables = await prisma.accountPayable.findMany({
      where: { tenantId: req.params.clientTenantId, status: 'PENDING' },
      orderBy: { dueDate: 'asc' },
    });

    res.json({ success: true, data: payables, error: null });
  } catch (err) {
    next(err);
  }
});

accountingClientRouter.get('/clients/:clientTenantId/receivables', async (req, res, next) => {
  try {
    const engagement = req.accountingEngagement!;
    if (engagement.clientTenantId !== req.params.clientTenantId) {
      res.status(403).json({ success: false, data: null, error: { code: 'FORBIDDEN', message: 'Acesso negado a este cliente.' } });
      return;
    }

    const receivables = await prisma.accountReceivable.findMany({
      where: { tenantId: req.params.clientTenantId, status: 'PENDING' },
      orderBy: { dueDate: 'asc' },
    });

    res.json({ success: true, data: receivables, error: null });
  } catch (err) {
    next(err);
  }
});

accountingClientRouter.get('/clients/:clientTenantId/fiscal-documents', async (req, res, next) => {
  try {
    const engagement = req.accountingEngagement!;
    if (engagement.clientTenantId !== req.params.clientTenantId) {
      res.status(403).json({ success: false, data: null, error: { code: 'FORBIDDEN', message: 'Acesso negado a este cliente.' } });
      return;
    }

    const { type, startDate, endDate } = req.query;

    const where: Record<string, unknown> = { tenantId: req.params.clientTenantId };
    if (type) where.type = type;
    if (startDate && endDate) where.createdAt = { gte: new Date(startDate as string), lte: new Date(endDate as string) };

    const documents = await prisma.fiscalDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: documents, error: null });
  } catch (err) {
    next(err);
  }
});

accountingClientRouter.get('/clients/:clientTenantId/partners', async (req, res, next) => {
  try {
    const engagement = req.accountingEngagement!;
    if (engagement.clientTenantId !== req.params.clientTenantId) {
      res.status(403).json({ success: false, data: null, error: { code: 'FORBIDDEN', message: 'Acesso negado a este cliente.' } });
      return;
    }

    const partners = await prisma.companyPartner.findMany({
      where: { tenantId: req.params.clientTenantId, isActive: true },
      include: { payouts: { orderBy: { period: 'desc' }, take: 12 } },
    });

    res.json({ success: true, data: partners, error: null });
  } catch (err) {
    next(err);
  }
});
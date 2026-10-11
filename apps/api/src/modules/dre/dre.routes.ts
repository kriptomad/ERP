import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireBusinessTenant } from '../../middlewares/tenant-type-gatekeeper.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';

export const dreRouter = Router();

 dreRouter.use(authenticate);
 dreRouter.use(requireBusinessTenant);

 dreRouter.get('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { startDate, endDate } = req.query;

    const where: Record<string, unknown> = { tenantId: tenantId! };
    if (startDate && endDate) where.createdAt = { gte: new Date(startDate as string), lte: new Date(endDate as string) };

    const [sales, accountPayables, accountReceivables] = await Promise.all([
      prisma.sale.findMany({ where, include: { items: true } }),
      prisma.accountPayable.findMany({ where, include: { supplier: true } }),
      prisma.accountReceivable.findMany({ where, include: { client: true } }),
    ]);

    const totalRevenue = sales.reduce((sum, s) => sum + s.totalAmount.toNumber(), 0);
    const totalCOGS = sales.reduce((sum, s) => {
      return sum + s.items.reduce((itemSum, item) => itemSum + (item.costPrice?.toNumber() || 0) * item.quantity.toNumber(), 0);
    }, 0);
    const totalOperatingExpenses = accountPayables.reduce((sum, ap) => sum + ap.amount.toNumber(), 0);
    const totalTaxes = accountReceivables.reduce((sum, ar) => sum + ar.amount.toNumber(), 0);

    const grossProfit = totalRevenue - totalCOGS;
    const operatingIncome = grossProfit - totalOperatingExpenses;
    const netIncome = operatingIncome - totalTaxes;
    const margin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

    res.json({
      success: true,
      data: {
        period: {
          start: startDate || new Date().toISOString().split('T')[0],
          end: endDate || new Date().toISOString().split('T')[0],
        },
        totalRevenue,
        totalCOGS,
        grossProfit,
        totalOperatingExpenses,
        totalTaxes,
        operatingIncome,
        netIncome,
        margin: margin.toFixed(2),
        transactions: sales.length,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

 dreRouter.get('/detailed', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { startDate, endDate } = req.query;

    const where: Record<string, unknown> = { tenantId: tenantId! };
    if (startDate && endDate) where.createdAt = { gte: new Date(startDate as string), lte: new Date(endDate as string) };

    const [sales, payables, receivables, stockCounts] = await Promise.all([
      prisma.sale.findMany({ where, include: { items: { include: { product: true } } } }),
      prisma.accountPayable.findMany({ where }),
      prisma.accountReceivable.findMany({ where }),
      prisma.product.findMany({ where: { tenantId: tenantId! } }),
    ]);

    const costOfGoodsSold = sales.reduce((sum, s) => {
      return sum + s.items.reduce((isum, item) => {
        return isum + (item.costPrice?.toNumber() || 0) * item.quantity.toNumber();
      }, 0);
    }, 0);

    const totalExpenses = payables.reduce((sp, ap) => sp + ap.amount.toNumber(), 0) +
      receivables.reduce((sr, ar) => sr + ar.amount.toNumber(), 0);

    const revenueByCategory = sales.reduce((acc, s) => {
      s.items.forEach(item => {
        const category = item.product?.category || 'Outros';
        acc[category] = (acc[category] || 0) + item.unitPrice.toNumber() * item.quantity.toNumber();
      });
      return acc;
    }, {} as Record<string, number>);

    res.json({
      success: true,
      data: {
        costOfGoodsSold,
        grossProfit: sales.reduce((sum, s) => sum + s.totalAmount.toNumber(), 0) - costOfGoodsSold,
        totalExpenses,
        netIncome: (sales.reduce((sum, s) => sum + s.totalAmount.toNumber(), 0) - costOfGoodsSold) - totalExpenses,
        revenueByCategory,
        topProducts: sales.flatMap(s => s.items)
          .reduce((acc, item) => {
            const name = item.product?.name || 'Produto sem nome';
            acc[name] = (acc[name] || 0) + item.unitPrice.toNumber() * item.quantity.toNumber();
            return acc;
          }, {} as Record<string, number>),
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

 dreRouter.get('/concilianca', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { startDate, endDate } = req.query;

    const where: Record<string, unknown> = { tenantId: tenantId! };
    if (startDate && endDate) where.createdAt = { gte: new Date(startDate as string), lte: new Date(endDate as string) };

    const [sales, payables, receivables] = await Promise.all([
      prisma.sale.findMany({ where, include: { client: true } }),
      prisma.accountPayable.findMany({ where, include: { supplier: true } }),
      prisma.accountReceivable.findMany({ where, include: { client: true } }),
    ]);

    const conciliation = {
      dateRange: {
        start: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: endDate || new Date().toISOString(),
      },
      cashIn: {
        sales: sales.reduce((sum, s) => sum + s.totalAmount.toNumber(), 0),
        accountReceivablesReceived: receivables.filter(r => r.status === 'RECEIVED').reduce((sum, r) => sum + r.amount.toNumber(), 0),
      },
      cashOut: {
        accountPayables: payables.reduce((sum, ap) => sum + ap.amount.toNumber(), 0),
        accountPayablesPaid: payables.filter(ap => ap.status === 'PAID').reduce((sum, ap) => sum + ap.amount.toNumber(), 0),
      },
      balance: {
        initialBalance: 0,
        finalBalance: 0, // calculated based on opening + in - out
        difference: 0,
      },
    };

    res.json({ success: true, data: conciliation, error: null });
  } catch (err) {
    next(err);
  }
});

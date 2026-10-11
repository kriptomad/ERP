import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';
import { assertAccountingAccess, requireAccountingScope } from '../../middlewares/accounting-access.middleware';

export const accountingHonorariosRouter = Router();

accountingHonorariosRouter.use(authenticate);
accountingHonorariosRouter.use(assertAccountingAccess);
accountingHonorariosRouter.use(requireAccountingScope('FULL_BOOKKEEPING', 'TAX_FILING'));

accountingHonorariosRouter.post('/generate', async (req, res, next) => {
  try {
    const engagement = req.accountingEngagement!;
    const { clientTenantId, period, amount, description } = z.object({
      clientTenantId: z.string().uuid(),
      period: z.string().regex(/^\d{4}-\d{2}$/),
      amount: z.number().positive(),
      description: z.string().optional(),
    }).parse(req.body);

    if (engagement.clientTenantId !== clientTenantId) {
      res.status(403).json({ success: false, data: null, error: { code: 'FORBIDDEN', message: 'Acesso negado.' } });
      return;
    }

    const honorario = await prisma.$transaction(async (tx) => {
      const ar = await tx.accountReceivable.create({
        data: {
          tenantId: engagement.firmTenantId,
          clientId: engagement.clientTenantId,
          description: description || `Honorários contábeis ${period}`,
          amount,
          dueDate: new Date(period + '-10'),
          category: 'HONORARIOS_CONTABEIS',
        },
      });

      const ap = await tx.accountPayable.create({
        data: {
          tenantId: clientTenantId,
          supplierId: null,
          description: description || `Honorários contábeis ${period}`,
          amount,
          dueDate: new Date(period + '-10'),
          category: 'HONORARIOS_CONTABEIS',
        },
      });

      return { ar, ap };
    });

    res.status(201).json({ success: true, data: honorario, error: null });
  } catch (err) {
    next(err);
  }
});

accountingHonorariosRouter.get('/pending', async (req, res, next) => {
  try {
    const engagement = req.accountingEngagement!;
    const honorarios = await prisma.accountReceivable.findMany({
      where: { tenantId: engagement.firmTenantId, clientId: engagement.clientTenantId, category: 'HONORARIOS_CONTABEIS', status: 'PENDING' },
      orderBy: { dueDate: 'asc' },
    });

    res.json({ success: true, data: honorarios, error: null });
  } catch (err) {
    next(err);
  }
});

accountingHonorariosRouter.post('/:id/receive', async (req, res, next) => {
  try {
    const engagement = req.accountingEngagement!;
    const { receivedAmount } = z.object({ receivedAmount: z.number().positive() }).parse(req.body);

    const honorario = await prisma.accountReceivable.update({
      where: { id: req.params.id, tenantId: engagement.firmTenantId },
      data: { status: 'RECEIVED', receivedAt: new Date(), receivedAmount },
    });

    res.json({ success: true, data: honorario, error: null });
  } catch (err) {
    next(err);
  }
});

accountingHonorariosRouter.get('/partner-payouts', async (req, res, next) => {
  try {
    const engagement = req.accountingEngagement!;
    const { period } = req.query;

    const where: Record<string, unknown> = { tenantId: engagement.clientTenantId };
    if (period) where.period = period;

    const payouts = await prisma.partnerPayout.findMany({
      where,
      include: { partner: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: payouts, error: null });
  } catch (err) {
    next(err);
  }
});

accountingHonorariosRouter.post('/partner-payouts', async (req, res, next) => {
  try {
    const engagement = req.accountingEngagement!;
    const data = z.object({
      partnerId: z.string().uuid(),
      amount: z.number().positive(),
      period: z.string().regex(/^\d{4}-\d{2}$/),
      type: z.enum(['PRO_LABORE', 'DISTRIBUTION']),
    }).parse(req.body);

    const payout = await prisma.$transaction(async (tx) => {
      const payout = await tx.partnerPayout.create({
        data: {
          tenantId: engagement.clientTenantId,
          partnerId: data.partnerId,
          amount: data.amount,
          period: data.period,
          type: data.type,
          status: 'PENDING',
        },
      });

      await tx.accountPayable.create({
        data: {
          tenantId: engagement.clientTenantId,
          description: `${data.type === 'PRO_LABORE' ? 'Pró-labore' : 'Distribuição de lucros'} - ${data.period}`,
          amount: data.amount,
          dueDate: new Date(),
          category: data.type,
        },
      });

      return payout;
    });

    res.status(201).json({ success: true, data: payout, error: null });
  } catch (err) {
    next(err);
  }
});

accountingHonorariosRouter.patch('/partner-payouts/:id/pay', async (req, res, next) => {
  try {
    const engagement = req.accountingEngagement!;
    const { paidAmount } = z.object({ paidAmount: z.number().positive() }).parse(req.body);

    const payout = await prisma.$transaction(async (tx) => {
      const updated = await tx.partnerPayout.update({
        where: { id: req.params.id, tenantId: engagement.clientTenantId },
        data: { status: 'PAID', paidAt: new Date() },
      });

      const payable = await tx.accountPayable.findFirst({
        where: { tenantId: engagement.clientTenantId, description: { contains: req.params.id } },
      });
      if (payable) {
        await tx.accountPayable.update({
          where: { id: payable.id },
          data: { status: 'PAID', paidAt: new Date(), paidAmount },
        });
      }

      return updated;
    });

    res.json({ success: true, data: payout, error: null });
  } catch (err) {
    next(err);
  }
});

accountingHonorariosRouter.get('/informe-rendimentos/:partnerId', async (req, res, next) => {
  try {
    const engagement = req.accountingEngagement!;
    const { year } = req.query;

    const payouts = await prisma.partnerPayout.findMany({
      where: {
        tenantId: engagement.clientTenantId,
        partnerId: req.params.partnerId,
        paidAt: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) },
        status: 'PAID',
      },
      orderBy: { paidAt: 'asc' },
    });

    const tributavel = payouts.filter(p => p.type === 'PRO_LABORE').reduce((sum, p) => sum + p.amount.toNumber(), 0);
    const isento = payouts.filter(p => p.type === 'DISTRIBUTION').reduce((sum, p) => sum + p.amount.toNumber(), 0);

    const partner = await prisma.companyPartner.findUnique({ where: { id: req.params.partnerId } });

    res.json({
      success: true,
      data: {
        partner: { name: partner?.name, cpf: partner?.cpf },
        year: parseInt(year as string),
        tributavel,
        isento,
        total: tributavel + isento,
        details: payouts.map(p => ({ period: p.period, type: p.type, amount: p.amount.toNumber(), paidAt: p.paidAt })),
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});
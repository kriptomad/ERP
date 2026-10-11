import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';
import { recordLegalConsent, verifyLegalConsent, getLegalDocumentVersions } from './lgpd.service';

export const lgpdRouter = Router();

lgpdRouter.use(authenticate);

lgpdRouter.get('/document-versions', async (req, res, next) => {
  try {
    const versions = await getLegalDocumentVersions();
    res.json({ success: true, data: versions, error: null });
  } catch (err) {
    next(err);
  }
});

lgpdRouter.post('/consent', async (req, res, next) => {
  try {
    const data = z.object({
      ipAddress: z.string().min(1),
      userAgent: z.string().optional(),
    }).parse(req.body);

    const { tenantId } = getRequestContext();
    const userId = req.userId!;

    const consent = await recordLegalConsent(userId, data.ipAddress, data.userAgent ?? '');
    res.json({ success: true, data: consent, error: null });
  } catch (err) {
    next(err);
  }
});

lgpdRouter.get('/consent-status', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const userId = req.userId!;
    const status = await verifyLegalConsent(userId);
    res.json({ success: true, data: status, error: null });
  } catch (err) {
    next(err);
  }
});

lgpdRouter.get('/privacy-rights', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const userId = req.userId!;

    // Coletar dados pessoais do usuário para portabilidade
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const accounts = await prisma.personalAccount.findMany({ where: { tenantId: tenantId! } });
    const transactions = await prisma.personalTransaction.findMany({ where: { tenantId: tenantId! } });
    const debts = await prisma.personalDebt.findMany({ where: { tenantId: tenantId! } });
    const investments = await prisma.personalInvestment.findMany({ where: { tenantId: tenantId! } });

    res.json({
      success: true,
      data: {
        user: { name: user?.name, email: user?.email },
        accounts: accounts.map(a => ({ id: a.id, type: a.type, balance: a.balance })),
        transactions: transactions.length,
        debts: debts.length,
        investments: investments.length,
        dataRetention: 'Seus dados serão mantidos por 5 anos conforme exigência legal, podendo ser solicitado apagamento ou portabilidade.',
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePersonalTenant } from '../../middlewares/tenant-type-gatekeeper.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';
import { getPluggyConnectToken, handlePluggyWebhook } from './pluggy-integration.service';

export const pluggyIntegrationRouter = Router();

pluggyIntegrationRouter.use(authenticate);
pluggyIntegrationRouter.use(requirePersonalTenant);

pluggyIntegrationRouter.get('/connect-token', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { itemId } = z.object({ itemId: z.string() }).parse(req.query);

    const connectData = await getPluggyConnectToken(itemId as string);
    res.json({ success: true, data: connectData, error: null });
  } catch (err) {
    next(err);
  }
});

pluggyIntegrationRouter.post('/webhook', async (req, res) => {
  try {
    await handlePluggyWebhook(req.body);
    res.json({ success: true, data: { received: true }, error: null });
  } catch (err) {
    console.error('Pluggy webhook error:', err);
    res.status(500).json({ success: false, data: null, error: { code: 'WEBHOOK_ERROR', message: 'Erro ao processar webhook' } });
  }
});

pluggyIntegrationRouter.get('/accounts', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const accounts = await prisma.personalAccount.findMany({
      where: { tenantId: tenantId!, active: true },
      include: {
        category: true,
        _count: { select: { transactions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: accounts, error: null });
  } catch (err) {
    next(err);
  }
});

pluggyIntegrationRouter.get('/accounts/:id/pluggy-status', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const account = await prisma.personalAccount.findFirst({
      where: { id: req.params.id, tenantId: tenantId! },
    });

    if (!account) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Conta não encontrada.' } });
      return;
    }

    res.json({
      success: true,
      data: {
        accountId: account.id,
        name: account.name,
        type: account.type,
        balance: account.balance,
        hasPluggyConnection: !!account.pluggyItemId,
        pluggyItemId: account.pluggyItemId,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

pluggyIntegrationRouter.post('/sync-transactions', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();

    // Buscar transações dos últimos 90 dias para sincronização completa
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 90);

    const accounts = await prisma.personalAccount.findMany({
      where: { tenantId: tenantId!, active: true, hasPluggyConnection: true },
    });

    let totalSynced = 0;
    for (const account of accounts) {
      const transactions = await fetchPluggyTransactions(account.pluggyItemId!, fromDate, new Date());

      for (const tx of transactions) {
        const exists = await prisma.personalTransaction.findFirst({
          where: {
            tenantId: tenantId!,
            accountId: account.id,
            description: tx.description,
            transactionDate: tx.transactionDate,
          },
        });

        if (!exists) {
          const type = tx.amount > 0 ? 'INCOME' : 'EXPENSE';
          await prisma.personalTransaction.create({
            data: {
              tenantId: tenantId!,
              accountId: account.id,
              categoryId: account.defaultCategoryId,
              type,
              amount: Math.abs(tx.amount),
              description: tx.description || 'Transação importada',
              transactionDate: new Date(tx.transactionDate),
              notes: tx.notes,
              isPrivate: tx.isPrivate,
            },
          });

          await prisma.personalAccount.update({
            where: { id: account.id },
            data: { balance: { increment: type === 'INCOME' ? Math.abs(tx.amount) : -Math.abs(tx.amount) } },
          });

          totalSynced++;
        }
      }
    }

    res.json({
      success: true,
      data: { totalSynced, accountsSynced: accounts.length },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

async function fetchPluggyTransactions(accountId: string, from: Date, to: Date): Promise<any[]> {
  const PLUGGY_API_URL = process.env.PLUGGY_API_URL || 'https://api.pluggy.ai';
  const token = await new Promise<string>((resolve, reject) => {
    fetch(`${PLUGGY_API_URL}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: process.env.PLUGGY_CLIENT_ID, clientSecret: process.env.PLUGGY_CLIENT_SECRET }),
    }).then(res => res.json()).then(data => resolve(data.apiKey)).catch(reject);
  });

  const response = await fetch(`${PLUGGY_API_URL}/transactions?accountId=${accountId}&from=${from.toISOString().split('T')[0]}&to=${to.toISOString().split('T')[0]}`, {
    headers: { 'X-API-KEY': token },
  });

  if (!response.ok) {
    logger.error('Pluggy transactions fetch failed', { status: response.status });
    return [];
  }

  return response.json();
}

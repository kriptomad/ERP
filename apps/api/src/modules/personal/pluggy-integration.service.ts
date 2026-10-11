import { prisma } from '../../infra/prisma';
import { logger } from '../../logging/structured-logger';

// Endpoint para gerar token de conexão Pluggy
export async function getPluggyConnectToken(itemId?: string) {
  const PLUGGY_API_URL = process.env.PLUGGY_API_URL || 'https://api.pluggy.ai';
  const PLUGGY_CLIENT_ID = process.env.PLUGGY_CLIENT_ID || '';
  const PLUGGY_CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET || '';

  let accessTokenCache: { token: string; expiresAt: number } | null = null;

  async function getPluggyAccessToken(): Promise<string> {
    if (accessTokenCache && accessTokenCache.expiresAt > Date.now() + 60000) {
      return accessTokenCache.token;
    }

    const response = await fetch(`${PLUGGY_API_URL}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: PLUGGY_CLIENT_ID, clientSecret: PLUGGY_CLIENT_SECRET }),
    });

    if (!response.ok) {
      throw new Error(`Pluggy auth failed: ${response.status}`);
    }

    const data = await response.json();
    accessTokenCache = { token: data.apiKey, expiresAt: Date.now() + data.expiresIn * 1000 };
    return data.apiKey;
  }

  const token = await getPluggyAccessToken();

  const body = JSON.stringify({ itemId, webhookUrl: `${process.env.WEB_URL}/webhooks/pluggy` });
  const response = await fetch(`${PLUGGY_API_URL}/connect_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': token },
    body,
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(`Pluggy connect_token failed: ${response.status} - ${JSON.stringify(errData)}`);
  }

  return response.json();
}

// Endpoint para receber webhooks do Pluggy
export async function handlePluggyWebhook(payload: any): Promise<void> {
  const { event, itemId, accountId } = payload;

  logger.info('Pluggy webhook received', { event, itemId, accountId });

  switch (event) {
    case 'item_created':
    case 'item_updated':
      logger.info('Pluggy item updated', { itemId });
      break;

    case 'item_deleted':
      // Remover items/accounts do banco quando usuário remove conexão
      await prisma.personalAccount.deleteMany({ where: { pluggyItemId: itemId } });
      await prisma.personalInvestment.deleteMany({ where: { pluggyItemId: itemId } });
      await prisma.personalDebt.deleteMany({ where: { pluggyItemId: itemId } });
      logger.info('Pluggy items deleted', { itemId });
      break;

    case 'item_login_succeeded':
      logger.info('Pluggy login succeeded', { itemId });
      break;

    case 'item_login_failed':
      logger.warn('Pluggy login failed', { itemId });
      break;

    case 'item_waiting_user_input':
      logger.info('Pluggy waiting user input', { itemId });
      break;

    case 'transactions_created':
    case 'transactions_updated':
    case 'transactions_deleted': {
      // Sincronizar transações da conta
      const accounts = await prisma.personalAccount.findMany({
        where: { pluggyItemId: itemId, active: true },
      });

      for (const account of accounts) {
        // Buscar transações recentes do Pluggy
        const fromDate = new Date();
        fromDate.setMonth(fromDate.getMonth() - 1); // Últimos 30 dias

        try {
          const transactions = await fetchTransactions(account.pluggyAccountId ?? account.pluggyItemId ?? '', fromDate, new Date());

          for (const tx of transactions) {
            // Verificar se já existe
            const exists = await prisma.personalTransaction.findFirst({
              where: {
                tenantId: account.tenantId,
                description: tx.description,
                transactionDate: tx.transactionDate,
              },
            });

            if (!exists) {
              // Determinar tipo (receita/expense) baseado na direção do fluxo
              const type = tx.amount > 0 ? 'INCOME' : 'EXPENSE';

              await prisma.personalTransaction.create({
                data: {
                  tenantId: account.tenantId,
                  accountId: account.id,
                  categoryId: account.defaultCategoryId,
                  createdBy: account.ownerId,
                  type,
                  amount: Math.abs(tx.amount),
                  description: tx.description || 'Transação importada',
                  transactionDate: new Date(tx.transactionDate),
                  notes: tx.notes,
                  isPrivate: tx.isPrivate,
                },
              });

              // Atualizar saldo da conta
              await prisma.personalAccount.update({
                where: { id: account.id },
                data: { balance: { increment: type === 'INCOME' ? Math.abs(tx.amount) : -Math.abs(tx.amount) } },
              });
            }
          }
        } catch (err) {
          logger.error('Error syncing Pluggy transactions', { accountId, error: err });
        }
      }
      break;
    }

    case 'investments_created':
    case 'investments_updated':
    case 'investments_deleted': {
      // Sincronizar investimentos
      const investments = await prisma.personalInvestment.findMany({
        where: { pluggyItemId: itemId, active: true },
      });
      // Lógica de sync de preços de mercado seria aqui
      logger.info('Pluggy investments sync', { itemId, count: investments.length });
      break;
    }

    default:
      logger.info('Pluggy unknown event', { event });
  }
}

async function fetchTransactions(accountId: string, from: Date, to: Date): Promise<any[]> {
  const PLUGGY_API_URL = process.env.PLUGGY_API_URL || 'https://api.pluggy.ai';
  const token = await new Promise<string>((resolve, reject) => {
    // Em produção, usar o token cacheado ou refresh
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

export default { getPluggyConnectToken, handlePluggyWebhook, fetchTransactions };

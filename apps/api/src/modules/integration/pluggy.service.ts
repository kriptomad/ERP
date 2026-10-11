import { logger } from '../../logging/structured-logger';

const PLUGGY_API_URL = 'https://api.pluggy.ai';
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

async function pluggyFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getPluggyAccessToken();
  const response = await fetch(`${PLUGGY_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': token,
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Pluggy API error: ${response.status} - ${JSON.stringify(data)}`);
  }

  return data;
}

export async function getPluggyConnectors(): Promise<any[]> {
  return pluggyFetch<any[]>('/connectors');
}

export async function createConnectToken(itemId?: string): Promise<{ connectToken: string; connectUrl: string }> {
  return pluggyFetch('/connect_token', {
    method: 'POST',
    body: JSON.stringify({ itemId, webhookUrl: `${process.env.WEB_URL}/webhooks/pluggy` }),
  });
}

export async function getPluggyItem(itemId: string): Promise<any> {
  return pluggyFetch(`/items/${itemId}`);
}

export async function getPluggyAccounts(itemId: string): Promise<any[]> {
  return pluggyFetch(`/accounts?itemId=${itemId}`);
}

export async function getPluggyTransactions(accountId: string, from: Date, to: Date): Promise<any[]> {
  return pluggyFetch(`/transactions?accountId=${accountId}&from=${from.toISOString().split('T')[0]}&to=${to.toISOString().split('T')[0]}`);
}

export async function getPluggyInvestments(itemId: string): Promise<any[]> {
  return pluggyFetch(`/investments?itemId=${itemId}`);
}

export async function deletePluggyItem(itemId: string): Promise<void> {
  await pluggyFetch(`/items/${itemId}`, { method: 'DELETE' });
}

export async function handlePluggyWebhook(payload: any): Promise<void> {
  const { event, itemId, accountId } = payload;

  switch (event) {
    case 'item_created':
    case 'item_updated':
    case 'item_deleted':
    case 'item_login_succeeded':
    case 'item_login_failed':
    case 'item_waiting_user_input':
      logger.info('Pluggy item event', { event, itemId });
      break;
    case 'transactions_created':
    case 'transactions_updated':
    case 'transactions_deleted':
      logger.info('Pluggy transactions event', { event, accountId });
      break;
    case 'investments_created':
    case 'investments_updated':
    case 'investments_deleted':
      logger.info('Pluggy investments event', { event, accountId });
      break;
    default:
      logger.info('Pluggy unknown event', { event });
  }
}
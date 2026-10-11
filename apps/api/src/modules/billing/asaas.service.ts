import { PrismaClient } from '@prisma/client';
import { logger } from '../../logging/structured-logger';

const prisma = new PrismaClient();

const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '';

interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  mobilePhone?: string;
  cpfCnpj?: string;
  postalCode?: string;
  addressNumber?: string;
  addressComplement?: string;
}

interface AsaasCreditCardToken {
  creditCardToken: string;
  creditCardNumber: string;
  creditCardBrand: string;
}

interface AsaasSubscription {
  id: string;
  customer: string;
  billingType: 'CREDIT_CARD' | 'BOLETO' | 'PIX';
  cycle: 'MONTHLY' | 'WEEKLY' | 'BIWEEKLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY';
  value: number;
  nextDueDate: string;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'OVERDUE';
  creditCardToken?: string;
  description?: string;
}

async function asaasFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${ASAAS_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Asaas API error: ${response.status} - ${JSON.stringify(error)}`);
  }

  return response.json();
}

export async function createAsaasCustomer(data: Omit<AsaasCustomer, 'id'>): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>('/customers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getAsaasCustomer(customerId: string): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>(`/customers/${customerId}`);
}

export async function tokenizeAsaasCreditCard(params: {
  customer: string;
  creditCard: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone: string;
  };
  remoteIp: string;
}): Promise<AsaasCreditCardToken> {
  return asaasFetch<AsaasCreditCardToken>('/creditCard/tokenize', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function createAsaasSubscription(params: {
  customer: string;
  billingType: 'CREDIT_CARD' | 'BOLETO' | 'PIX';
  cycle: 'MONTHLY' | 'WEEKLY' | 'BIWEEKLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY';
  value: number;
  nextDueDate: string;
  creditCardToken?: string;
  description?: string;
}): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>('/subscriptions', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getAsaasSubscription(subscriptionId: string): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>(`/subscriptions/${subscriptionId}`);
}

export async function cancelAsaasSubscription(subscriptionId: string): Promise<void> {
  await asaasFetch(`/subscriptions/${subscriptionId}`, { method: 'DELETE' });
}

export async function handleAsaasWebhook(event: string, data: Record<string, unknown>): Promise<void> {
  const subscriptionId = (data.subscription as string) || (data.id as string);
  
  const subscription = await prisma.subscription.findFirst({
    where: { externalSubscriptionId: subscriptionId },
  });

  if (!subscription) {
    logger.warn('Asaas webhook: subscription not found', { subscriptionId, event });
    return;
  }

  const externalEventKey = `${event}_${subscriptionId}_${Date.now()}`;

  switch (event) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            failedPaymentAttempts: 0,
            nextRetryAt: null,
            status: 'ACTIVE',
          },
        }),
        prisma.tenant.update({
          where: { id: subscription.tenantId },
          data: { status: 'ACTIVE', gracePeriodEndsAt: null },
        }),
        prisma.billingEvent.create({
          data: {
            subscriptionId: subscription.id,
            provider: 'asaas',
            externalEventKey,
            type: 'PAYMENT_SUCCESS',
            payload: { event, ...data },
          },
        }),
      ]);
      break;

    case 'PAYMENT_FAILED':
    case 'PAYMENT_OVERDUE':
      await handlePaymentFailure(subscription.tenantId, subscription.id, externalEventKey, event, data);
      break;

    case 'SUBSCRIPTION_CANCELLED':
      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'CANCELLED' },
        }),
        prisma.tenant.update({
          where: { id: subscription.tenantId },
          data: { status: 'CANCELLED' },
        }),
        prisma.billingEvent.create({
          data: {
            subscriptionId: subscription.id,
            provider: 'asaas',
            externalEventKey,
            type: 'SUBSCRIPTION_CANCELLED',
            payload: { event, ...data },
          },
        }),
      ]);
      break;

    default:
      logger.info('Asaas webhook: unhandled event', { event });
  }
}

async function handlePaymentFailure(
  tenantId: string,
  subscriptionId: string,
  externalEventKey: string,
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  const RETRY_SCHEDULE_DAYS = [1, 3, 5, 7];

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) return;

  const attempt = subscription.failedPaymentAttempts + 1;
  const retryInDays = RETRY_SCHEDULE_DAYS[Math.min(attempt - 1, RETRY_SCHEDULE_DAYS.length - 1)];
  const nextRetryAt = new Date(Date.now() + retryInDays * 24 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        failedPaymentAttempts: attempt,
        nextRetryAt,
        status: attempt >= RETRY_SCHEDULE_DAYS.length ? 'SUSPENDED' : 'PAST_DUE',
      },
    });

    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        status: attempt >= RETRY_SCHEDULE_DAYS.length ? 'SUSPENDED' : 'PAST_DUE',
        gracePeriodEndsAt: attempt === 1 ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : undefined,
      },
    });

    await tx.billingEvent.create({
      data: {
        subscriptionId,
        provider: 'asaas',
        externalEventKey,
        type: 'PAYMENT_FAILED',
        payload: { event, ...data },
      },
    });
  });

  if (attempt >= RETRY_SCHEDULE_DAYS.length) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'SUSPENDED' },
    });
  }
}
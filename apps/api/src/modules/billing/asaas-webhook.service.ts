import { prisma } from '../../infra/prisma';
import { logger } from '../../logging/structured-logger';

interface AsaasWebhookPayload {
  customer?: {
    id: string;
    email: string;
    name: string;
    cpfCnpj: string;
    gender: string;
    birthDate: string;
  };
  receivable?: {
    id: string;
    title: string;
    value: number;
    dueDate: string;
    status: string;
    type: string;
  };
  subscription?: {
    id: string;
    customer: string;
    status: string;
    plan: string;
    cancelDate: string;
  };
  payment?: {
    id: string;
    customer: string;
    status: string;
    value: number;
    txId: string;
    date: string;
    handReceipt: string;
  };
  billing?: {
    id: string;
    name: string;
    value: number;
    dueDate: string;
    status: string;
    type: string;
    cycle: string;
    paymentMethod: string;
  };
  type: string;
  status?: string;
  code?: string;
  tag?: string;
};

interface CustomerInfo {
  tenantId: string;
  customerId: string;
  email: string;
  name: string;
  cpfCnpj: string;
  type: 'BUSINESS' | 'PERSONAL';
}

export async function handleAsaasWebhook(event: string, payload: any): Promise<void> {
  logger.info('Asaas webhook received', { event, payload });

  switch (event) {
    case 'CUSTOMENT_CREATED':
    case 'CUSTOMENT_UPDATED': {
      const { id: customerId, email, name, cpfCnpj } = payload.customer;
      const type = cpfCnpj.length === 11 ? 'PERSONAL' : 'BUSINESS';

      await prisma.tenant.upsert({
        where: { externalCustomerId: customerId },
        create: {
          slug: `asaas-${customerId}`,
          externalCustomerId: customerId,
          legalName: name || 'Sem nome',
          tradeName: name || 'Sem nome',
          cnpj: cpfCnpj,
          tenantType: type,
          status: 'ACTIVE',
        },
        update: {
          legalName: name || undefined,
          tradeName: name || undefined,
          cnpj: cpfCnpj,
        },
      });
      break;
    }
    case 'RECEIVABLE_CREATED':
    case 'RECEIVABLE_UPDATED': {
      const { id: receivableId, title, value, dueDate, status } = payload.receivable;
      await prisma.accountReceivable.upsert({
        where: { externalId: receivableId },
        create: {
          externalId: receivableId,
          tenantId: payload.tenantId || 'demo-store',
          clientId: payload.customerId || null,
          description: title || 'Sem descrição',
          amount: value,
          dueDate: new Date(dueDate),
          status: status === 'OPEN' ? 'PENDING' : status,
          category: 'ASSINATURA',
        },
        update: {
          description: title || undefined,
          amount: value,
          dueDate: new Date(dueDate),
          status: status === 'OPEN' ? 'PENDING' : status,
        },
      });
      break;
    }
    case 'RECEIVABLE_PAID': {
      const { id: receivableId, value } = payload.receivable;
      await prisma.accountReceivable.update({
        where: { externalId: receivableId },
        data: { status: 'RECEIVED', receivedAt: new Date() },
      });
      break;
    }
    case 'SUBSCRIPTION_ACTIVE':
    case 'SUBSCRIPTION_TRIALING':
    case 'SUBSCRIPTION_PAST_DUE':
    case 'SUBSCRIPTION_CANCELED':
    case 'SUBSCRIPTION_UPDATED': {
      const { id: subscriptionId, status } = payload.subscription;
      await prisma.subscription.upsert({
        where: { externalSubscriptionId: subscriptionId },
        create: {
          externalSubscriptionId: subscriptionId,
          tenantId: payload.tenantId || 'demo-store',
          status,
          provider: 'ASAAS',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        update: { status },
      });

      const tenantId = payload.tenantId || 'demo-store';
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { status },
      });
      break;
    }
    case 'PAYMENT_RECEIVED': {
      const { id: paymentId, value, date } = payload.payment;
      await prisma.billingEvent.create({
        data: {
          subscriptionId: payload.subscriptionId || null,
          tenantId: payload.tenantId || 'demo-store',
          provider: 'ASAAS',
          externalEventKey: paymentId,
          type: 'PAYMENT_RECEIVED',
          payload: { value, date, status: payload.status },
        },
      });
      break;
    }
    case 'PAYMENT_FAILED': {
      const { id: paymentId, value, date } = payload.payment;
      await prisma.billingEvent.create({
        data: {
          subscriptionId: payload.subscriptionId || null,
          tenantId: payload.tenantId || 'demo-store',
          provider: 'ASAAS',
          externalEventKey: paymentId,
          type: 'PAYMENT_FAILED',
          payload: { value, date, status: payload.status },
        },
      });

      // Marcar tenant como PAST_DUE
      const tenantId = payload.tenantId || 'demo-store';
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { status: 'PAST_DUE', gracePeriodEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      });
      break;
    }
    case 'BILLING_UPDATED': {
      const { id: billingId, value, dueDate, status, type, cycle } = payload.billing;
      await prisma.billingEvent.create({
        data: {
          subscriptionId: payload.subscriptionId || null,
          tenantId: payload.tenantId || 'demo-store',
          provider: 'ASAAS',
          externalEventKey: billingId,
          type: 'BILLING_UPDATED',
          payload: { value, dueDate, status, type, cycle },
        },
      });
      break;
    }
    default:
      logger.warn('Asaas webhook evento não tratado', { event });
  }
}

export async function processDunningCycle(): Promise<void> {
  const pastDueTenants = await prisma.tenant.findMany({
    where: { status: 'PAST_DUE' },
  });

  const now = new Date();

  for (const tenant of pastDueTenants) {
    const graceEndsAt = tenant.gracePeriodEndsAt;
    if (!graceEndsAt) continue;

    if (now > graceEndsAt) {
      // Expire após período de graça
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { status: 'SUSPENDED' },
      });
      logger.warn('Tenant suspenso por fim de graça', { tenantId: tenant.id });
    }
  }
}

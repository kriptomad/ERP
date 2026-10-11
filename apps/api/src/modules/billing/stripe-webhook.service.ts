import { prisma } from '../../infra/prisma';
import { logger } from '../../logging/structured-logger';

interface StripeWebhookPayload {
  type: string;
  data: {
    object: {
      id: string;
      object: string;
      address?: any;
      amount?: number;
      amount_details?: any;
      billing_receipt?: any;
      charge?: string;
      canceling?: boolean;
      capture_method?: string;
      created: number;
      currency?: string;
      customer?: string;
      deducts_from?: string;
      description?: string;
      disposable_account?: boolean;
      email?: string;
      exchange_rate?: number;
      fee?: number;
      fee_details?: any;
      livemode?: boolean;
      looking_for?: string;
      mandate?: string;
      metadata?: any;
      monetary_account?: string;
      movables_purchase?: any;
      multiplicity?: number;
      named?: boolean;
      network?: string;
      original_transaction_id?: string;
      outcome?: any;
      payment_intent?: string;
      payment_method?: string;
      payment_method_details?: any;
      processing?: any;
      receipt_email?: string;
      review?: any;
      shipping?: any;
      source?: any;
      statement_descriptor?: string;
      statement_descriptor_suffix?: string;
      status?: string;
      transaction_id?: string;
      transfer_data?: any;
      type?: string;
    };
  };
  event: string;
  previous_attributes?: any;
  request?: { id: string; idempotency_key?: string };
}

export async function handleStripeWebhook(eventType: string, payload: any): Promise<void> {
  const { id: transactionId, status, amount, currency, customer, subscription } = payload.data?.object || {};

  logger.info('Stripe webhook received', { eventType, transactionId, status, amount, currency });

  switch (eventType) {
    case 'invoice.payment_succeeded': {
      await prisma.subscription.upsert({
        where: { externalSubscriptionId: subscription || '' },
        create: {
          externalSubscriptionId: subscription || '';
          tenantId: customer ? `tenant-${customer}` : 'demo-store';
          status: 'ACTIVE';
          provider: 'STRIPE';
        },
        update: { status },
      });
      break;
    }
    case 'invoice.payment_failed': {
      await prisma.subscription.upsert({
        where: { externalSubscriptionId: subscription || '' },
        create: {
          externalSubscriptionId: subscription || '';
          tenantId: customer ? `tenant-${customer}` : 'demo-store';
          status: 'PAST_DUE';
          provider: 'STRIPE';
        },
        update: { status },
      });
      break;
    }
    case 'customer.created':
    case 'customer.updated': {
      const custId = customer || '';
      await prisma.tenant.upsert({
        where: { externalCustomerId: custId },
        create: { externalCustomerId: custId, tenantType: 'BUSINESS', status: 'ACTIVE' },
        update: { legalName: payload.data.object.name || legalName },
      });
      break;
    }
    case 'payment_intent.succeeded': {
      await prisma.billingEvent.create({
        data: {
          subscriptionId: subscription || null,
          tenantId: customer ? `tenant-${customer}` : 'demo-store',
          provider: 'STRIPE',
          externalEventKey: transactionId,
          type: 'PAYMENT_RECEIVED',
        },
      });
      break;
    }
    case 'payment_intent.payment_failed': {
      await prisma.billingEvent.create({
        data: {
          subscriptionId: subscription || null,
          tenantId: customer ? `tenant-${customer}` : 'demo-store',
          provider: 'STRIPE',
          externalEventKey: transactionId,
          type: 'PAYMENT_FAILED',
        },
      });
      break;
    }
    default:
      logger.info('Stripe webhook evento não mapeado', { eventType });
  }
}

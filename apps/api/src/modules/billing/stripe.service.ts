import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../logging/structured-logger';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-02-24.acacia',
});

export async function createStripeCustomer(email: string, name: string, metadata: Record<string, string> = {}): Promise<Stripe.Customer> {
  return stripe.customers.create({
    email,
    name,
    metadata,
  });
}

export async function createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
  return stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
    usage: 'off_session',
  });
}

export async function createStripeSubscription(params: {
  customerId: string;
  priceId: string;
  paymentMethodId: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Subscription> {
  await stripe.paymentMethods.attach(params.paymentMethodId, { customer: params.customerId });
  await stripe.customers.update(params.customerId, {
    invoice_settings: { default_payment_method: params.paymentMethodId },
  });

  return stripe.subscriptions.create({
    customer: params.customerId,
    items: [{ price: params.priceId }],
    collection_method: 'charge_automatically',
    payment_settings: {
      payment_method_types: ['card'],
      save_default_payment_method: 'on_subscription',
    },
    metadata: params.metadata,
    expand: ['latest_invoice.payment_intent'],
  });
}

export async function cancelStripeSubscription(subscriptionId: string, prorate = false): Promise<Stripe.Subscription> {
  return stripe.subscriptions.cancel(subscriptionId, { prorate, invoice_now: false });
}

export async function createStripeRefund(chargeId: string, amount?: number): Promise<Stripe.Refund> {
  return stripe.refunds.create({
    charge: chargeId,
    ...(amount && { amount: Math.round(amount * 100) }),
  });
}

export async function getStripeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['latest_invoice.payment_intent'],
  });
}

export async function handleStripeWebhook(event: Stripe.Event): Promise<void> {
  const subscriptionId = (event.data.object as Stripe.Subscription)?.id;
  
  if (!subscriptionId) {
    logger.warn('Stripe webhook: no subscription ID', { type: event.type });
    return;
  }

  const subscription = await prisma.subscription.findFirst({
    where: { externalSubscriptionId: subscriptionId },
  });

  if (!subscription) {
    logger.warn('Stripe webhook: subscription not found', { subscriptionId, type: event.type });
    return;
  }

  const externalEventKey = `${event.type}_${subscriptionId}_${event.created}`;

  switch (event.type) {
    case 'invoice.paid':
      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            failedPaymentAttempts: 0,
            nextRetryAt: null,
            status: 'ACTIVE',
            currentPeriodEnd: new Date((event.data.object as Stripe.Invoice).period_end * 1000),
          },
        }),
        prisma.tenant.update({
          where: { id: subscription.tenantId },
          data: { status: 'ACTIVE', gracePeriodEndsAt: null },
        }),
        prisma.billingEvent.create({
          data: {
            subscriptionId: subscription.id,
            provider: 'stripe',
            externalEventKey,
            type: 'PAYMENT_SUCCESS',
            payload: event.data.object,
          },
        }),
      ]);
      break;

    case 'invoice.payment_failed':
      await handleStripePaymentFailure(subscription, externalEventKey, event);
      break;

    case 'customer.subscription.deleted':
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
            provider: 'stripe',
            externalEventKey,
            type: 'SUBSCRIPTION_CANCELLED',
            payload: event.data.object,
          },
        }),
      ]);
      break;

    default:
      logger.info('Stripe webhook: unhandled event', { type: event.type });
  }
}

async function handleStripePaymentFailure(
  subscription: { id: string; tenantId: string; failedPaymentAttempts: number },
  externalEventKey: string,
  event: Stripe.Event,
): Promise<void> {
  const RETRY_SCHEDULE_DAYS = [1, 3, 5, 7];
  const attempt = subscription.failedPaymentAttempts + 1;
  const retryInDays = RETRY_SCHEDULE_DAYS[Math.min(attempt - 1, RETRY_SCHEDULE_DAYS.length - 1)];
  const nextRetryAt = new Date(Date.now() + retryInDays * 24 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        failedPaymentAttempts: attempt,
        nextRetryAt,
        status: attempt >= RETRY_SCHEDULE_DAYS.length ? 'SUSPENDED' : 'PAST_DUE',
      },
    });

    await tx.tenant.update({
      where: { id: subscription.tenantId },
      data: {
        status: attempt >= RETRY_SCHEDULE_DAYS.length ? 'SUSPENDED' : 'PAST_DUE',
        gracePeriodEndsAt: attempt === 1 ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : undefined,
      },
    });

    await tx.billingEvent.create({
      data: {
        subscriptionId: subscription.id,
        provider: 'stripe',
        externalEventKey,
        type: 'PAYMENT_FAILED',
        payload: event.data.object,
      },
    });
  });

  if (attempt >= RETRY_SCHEDULE_DAYS.length) {
    await prisma.tenant.update({
      where: { id: subscription.tenantId },
      data: { status: 'SUSPENDED' },
    });
  }
}
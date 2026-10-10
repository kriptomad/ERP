import { handlePaymentFailure, handlePaymentRecovered } from './billing.service';
import { prisma } from '../../infra/prisma';

export async function handleStripeWebhook(eventType: string, data: Record<string, unknown>) {
  const subscriptionId = data.id as string;
  const externalEventKey = `${eventType}_${subscriptionId}_${Date.now()}`;

  const subscription = await prisma.subscription.findFirst({
    where: { externalSubscriptionId: subscriptionId },
  });

  if (!subscription) {
    console.warn(`[Stripe Webhook] Assinatura não encontrada: ${subscriptionId}`);
    return;
  }

  switch (eventType) {
    case 'invoice.paid':
      await handlePaymentRecovered(subscription.tenantId, subscription.id);
      await logStripeBillingEvent(subscription.id, 'PAYMENT_SUCCESS', externalEventKey, eventType, data);
      break;

    case 'invoice.payment_failed':
      await handlePaymentFailure(subscription.tenantId, subscription.id);
      await logStripeBillingEvent(subscription.id, 'PAYMENT_FAILED', externalEventKey, eventType, data);
      break;

    case 'customer.subscription.deleted':
      await handleStripeCancellation(subscription.tenantId, subscription.id);
      await logStripeBillingEvent(subscription.id, 'SUBSCRIPTION_CANCELLED', externalEventKey, eventType, data);
      break;

    default:
      console.log(`[Stripe Webhook] Evento não tratado: ${eventType}`);
  }
}

async function logStripeBillingEvent(
  subscriptionId: string,
  type: string,
  externalEventKey: string,
  eventType: string,
  data: Record<string, unknown>,
) {
  await prisma.billingEvent.create({
    data: {
      subscriptionId,
      provider: 'stripe',
      externalEventKey,
      type,
      payload: { event: eventType, ...data },
    },
  });
}

async function handleStripeCancellation(tenantId: string, subscriptionId: string) {
  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'CANCELLED' },
    }),
    prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'CANCELLED' },
    }),
  ]);
}

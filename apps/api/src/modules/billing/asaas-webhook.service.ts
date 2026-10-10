import { handlePaymentFailure, handlePaymentRecovered } from './billing.service';
import { prisma } from '../../infra/prisma';

export async function handleAsaasWebhook(event: string, data: Record<string, unknown>) {
  const subscriptionId = data.id as string;
  const externalEventKey = `${event}_${subscriptionId}_${Date.now()}`;

  const subscription = await prisma.subscription.findFirst({
    where: { externalSubscriptionId: subscriptionId },
  });

  if (!subscription) {
    console.warn(`[Webhook] Assinatura não encontrada: ${subscriptionId}`);
    return;
  }

  switch (event) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
      await handlePaymentRecovered(subscription.tenantId, subscription.id);
      await logBillingEvent(subscription.id, 'PAYMENT_SUCCESS', externalEventKey, event, data);
      break;

    case 'PAYMENT_FAILED':
    case 'PAYMENT_OVERDUE':
      await handlePaymentFailure(subscription.tenantId, subscription.id);
      await logBillingEvent(subscription.id, 'PAYMENT_FAILED', externalEventKey, event, data);
      break;

    case 'SUBSCRIPTION_CANCELLED':
      await handleCancellation(subscription.tenantId, subscription.id);
      await logBillingEvent(subscription.id, 'SUBSCRIPTION_CANCELLED', externalEventKey, event, data);
      break;

    default:
      console.log(`[Webhook] Evento não tratado: ${event}`);
  }
}

async function logBillingEvent(
  subscriptionId: string,
  type: string,
  externalEventKey: string,
  event: string,
  data: Record<string, unknown>,
) {
  await prisma.billingEvent.create({
    data: {
      subscriptionId,
      provider: 'asaas',
      externalEventKey,
      type,
      payload: { event, ...data },
    },
  });
}

async function handleCancellation(tenantId: string, subscriptionId: string) {
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

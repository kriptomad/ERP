import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-02-24.acacia',
});

export async function createSetupIntent(stripeCustomerId: string) {
  return stripe.setupIntents.create({
    customer: stripeCustomerId,
    payment_method_types: ['card'],
    usage: 'off_session',
  });
}

export async function createRecurringSubscription(
  stripeCustomerId: string,
  priceId: string,
  paymentMethodId: string,
) {
  await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId });
  await stripe.customers.update(stripeCustomerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  return stripe.subscriptions.create({
    customer: stripeCustomerId,
    items: [{ price: priceId }],
    collection_method: 'charge_automatically',
    payment_settings: {
      payment_method_types: ['card'],
      save_default_payment_method: 'on_subscription',
    },
    expand: ['latest_invoice.payment_intent'],
  });
}

export async function cancelStripeSubscription(subscriptionId: string) {
  return stripe.subscriptions.cancel(subscriptionId, {
    prorate: false,
    invoice_now: false,
  });
}

export async function createStripeRefund(chargeId: string, amount?: number) {
  return stripe.refunds.create({
    charge: chargeId,
    ...(amount && { amount: Math.round(amount * 100) }),
  });
}

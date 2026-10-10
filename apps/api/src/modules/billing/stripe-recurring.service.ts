export type StripeLike = {
  setupIntents: {
    create: (p: {
      customer: string;
      payment_method_types: string[];
      usage: string;
    }) => Promise<{ id: string; client_secret: string | null }>;
  };
  paymentMethods: {
    attach: (pm: string, p: { customer: string }) => Promise<unknown>;
  };
  customers: {
    update: (
      id: string,
      p: { invoice_settings: { default_payment_method: string } },
    ) => Promise<unknown>;
  };
  subscriptions: {
    create: (p: Record<string, unknown>) => Promise<{ id: string }>;
  };
};

export async function createSetupIntent(stripe: StripeLike, customerId: string) {
  return stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
    usage: "off_session",
  });
}

export async function createRecurringSubscription(
  stripe: StripeLike,
  params: { stripeCustomerId: string; priceId: string; paymentMethodId: string },
) {
  await stripe.paymentMethods.attach(params.paymentMethodId, {
    customer: params.stripeCustomerId,
  });
  await stripe.customers.update(params.stripeCustomerId, {
    invoice_settings: { default_payment_method: params.paymentMethodId },
  });
  return stripe.subscriptions.create({
    customer: params.stripeCustomerId,
    items: [{ price: params.priceId }],
    collection_method: "charge_automatically",
    payment_settings: {
      payment_method_types: ["card"],
      save_default_payment_method: "on_subscription",
    },
    expand: ["latest_invoice.payment_intent"],
  });
}

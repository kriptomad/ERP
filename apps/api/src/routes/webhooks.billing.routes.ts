import { Router } from "express";
import { prismaUnscoped } from "@filitech/database";
import {
  handlePaymentFailure,
  handlePaymentRecovered,
} from "../modules/billing/dunning.service";

export const billingWebhooksRouter = Router();

/** Cap. 2.7 — idempotente via BillingEvent.externalEventKey */

billingWebhooksRouter.post("/asaas", async (req, res) => {
  const event = req.body as {
    event?: string;
    payment?: { id?: string; subscription?: string };
  };
  const externalKey = `asaas_${event.event}_${event.payment?.id ?? Date.now()}`;

  const sub = event.payment?.subscription
    ? await prismaUnscoped.subscription.findFirst({
        where: {
          externalSubscriptionId: event.payment.subscription,
          provider: "asaas",
        },
      })
    : null;

  if (!sub) {
    res.json({ received: true, matched: false });
    return;
  }

  try {
    await prismaUnscoped.billingEvent.create({
      data: {
        subscriptionId: sub.id,
        provider: "asaas",
        externalEventKey: externalKey,
        type: event.event ?? "UNKNOWN",
        payload: event as object,
      },
    });
  } catch {
    res.json({ received: true, duplicate: true });
    return;
  }

  if (event.event === "PAYMENT_FAILED" || event.event === "PAYMENT_OVERDUE") {
    await handlePaymentFailure(sub.tenantId, sub.id);
  }
  if (event.event === "PAYMENT_RECEIVED" || event.event === "PAYMENT_CONFIRMED") {
    await handlePaymentRecovered(sub.tenantId, sub.id);
  }

  res.json({ received: true });
});

billingWebhooksRouter.post("/stripe", async (req, res) => {
  const event = req.body as {
    id?: string;
    type?: string;
    data?: { object?: { subscription?: string } };
  };
  const externalKey = `stripe_${event.id ?? event.type}_${Date.now()}`;
  const stripeSubId = event.data?.object?.subscription;

  const sub = stripeSubId
    ? await prismaUnscoped.subscription.findFirst({
        where: { externalSubscriptionId: stripeSubId, provider: "stripe" },
      })
    : null;

  if (!sub) {
    res.json({ received: true, matched: false });
    return;
  }

  try {
    await prismaUnscoped.billingEvent.create({
      data: {
        subscriptionId: sub.id,
        provider: "stripe",
        externalEventKey: externalKey,
        type: event.type ?? "UNKNOWN",
        payload: event as object,
      },
    });
  } catch {
    res.json({ received: true, duplicate: true });
    return;
  }

  if (event.type === "invoice.payment_failed") {
    await handlePaymentFailure(sub.tenantId, sub.id);
  }
  if (event.type === "invoice.paid") {
    await handlePaymentRecovered(sub.tenantId, sub.id);
  }

  res.json({ received: true });
});

import { Router } from 'express';
import { handleAsaasWebhook } from '../modules/billing/asaas-webhook.service';
import { handleStripeWebhook } from '../modules/billing/stripe-webhook.service';
import { handleWhatsAppWebhook } from '../modules/integration/whatsapp.service';
import { handlePluggyWebhook } from '../modules/integration/pluggy.service';
import { handleFocusNFeWebhook } from '../modules/fiscal/focus-nfe-webhook.service';

export const webhookRouter = Router();

webhookRouter.post('/billing/asaas', async (req, res) => {
  try {
    await handleAsaasWebhook(req.body.event, req.body);
    res.json({ received: true });
  } catch (err) {
    console.error('Asaas webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

webhookRouter.post('/billing/stripe', async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'] as string;
    // Stripe signature verification would go here
    await handleStripeWebhook(req.body.type, req.body.data?.object);
    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

webhookRouter.post('/whatsapp', async (req, res) => {
  try {
    await handleWhatsAppWebhook(req.body);
    res.json({ received: true });
  } catch (err) {
    console.error('WhatsApp webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

webhookRouter.post('/pluggy', async (req, res) => {
  try {
    await handlePluggyWebhook(req.body);
    res.json({ received: true });
  } catch (err) {
    console.error('Pluggy webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

webhookRouter.post('/focus-nfe', async (req, res) => {
  try {
    await handleFocusNFeWebhook(req.body);
    res.json({ received: true });
  } catch (err) {
    console.error('Focus NFe webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});
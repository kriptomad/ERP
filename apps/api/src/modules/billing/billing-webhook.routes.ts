import { Router } from 'express';
import { handleAsaasWebhook } from './asaas-webhook.service';
import { handleStripeWebhook } from './stripe-webhook.service';

export const billingWebhookRouter = Router();

billingWebhookRouter.post('/asaas', async (req, res) => {
  try {
    const { event, payment, subscription } = req.body;

    console.log(`[Asaas Webhook] Evento recebido: ${event}`);

    const data = {
      ...(payment && { payment }),
      ...(subscription && { subscription }),
      id: subscription?.id || payment?.subscription || req.body.id,
    };

    await handleAsaasWebhook(event, data);

    res.json({ received: true });
  } catch (error) {
    console.error('[Asaas Webhook] Erro:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

billingWebhookRouter.post('/stripe', async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

    let event;
    try {
      event = JSON.parse(req.body);
    } catch {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    if (endpointSecret && sig) {
      console.log('[Stripe Webhook] Verificando assinatura...');
    }

    console.log(`[Stripe Webhook] Evento recebido: ${event.type}`);

    await handleStripeWebhook(event.type, event.data?.object);

    res.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Erro:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

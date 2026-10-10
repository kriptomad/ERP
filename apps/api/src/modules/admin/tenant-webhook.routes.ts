import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/auth.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';

export const tenantWebhookRouter = Router();

tenantWebhookRouter.use(authenticate);
tenantWebhookRouter.use(requireRole('OWNER'));

tenantWebhookRouter.get('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const webhooks = await prisma.tenantWebhook.findMany({
      where: { tenantId: tenantId! },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: webhooks, error: null });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
});

tenantWebhookRouter.post('/', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = createSchema.parse(req.body);

    const secret = crypto.randomBytes(32).toString('hex');

    const webhook = await prisma.tenantWebhook.create({
      data: {
        tenantId: tenantId!,
        url: data.url,
        events: data.events,
        secret,
      },
    });

    res.status(201).json({ success: true, data: webhook, error: null });
  } catch (err) {
    next(err);
  }
});

tenantWebhookRouter.delete('/:id', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    await prisma.tenantWebhook.delete({
      where: { id: req.params.id, tenantId: tenantId! },
    });
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
});

tenantWebhookRouter.post('/:id/test', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const webhook = await prisma.tenantWebhook.findFirst({
      where: { id: req.params.id, tenantId: tenantId! },
    });

    if (!webhook) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Webhook não encontrado.' } });
      return;
    }

    const payload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: { message: 'Teste de webhook' },
    };

    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Filitech-Signature': signature,
        },
        body: JSON.stringify(payload),
      });

      await prisma.tenantWebhook.update({
        where: { id: webhook.id },
        data: { lastTriggerAt: new Date() },
      });

      res.json({
        success: true,
        data: {
          status: response.status,
          ok: response.ok,
        },
        error: null,
      });
    } catch (fetchError) {
      res.status(502).json({
        success: false,
        data: null,
        error: { code: 'WEBHOOK_FAILED', message: 'Falha ao enviar webhook.' },
      });
    }
  } catch (err) {
    next(err);
  }
});

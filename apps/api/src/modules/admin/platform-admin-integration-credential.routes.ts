import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/auth.middleware';
import crypto from 'crypto';

export const platformAdminIntegrationCredentialRouter = Router();

platformAdminIntegrationCredentialRouter.use(authenticate);
platformAdminIntegrationCredentialRouter.use(requireRole('SUPER_ADMIN'));

const PROVIDERS = [
  'ASAAS', 'STRIPE', 'META_WHATSAPP', 'FOCUS_NFE', 'RESEND', 'R2', 'PLUGGY', 'VIA_CEP', 'BRASILAPI'
] as const;

const upsertCredentialSchema = z.object({
  provider: z.enum(PROVIDERS),
  credentialType: z.enum(['API_KEY', 'OAUTH_TOKEN', 'CERTIFICATE']),
  encryptedValue: z.string().min(1),
  environment: z.enum(['sandbox', 'production']).default('production'),
  active: z.boolean().default(true),
});

platformAdminIntegrationCredentialRouter.get('/', async (_req, res, next) => {
  try {
    const credentials = await prisma.integrationCredential.findMany({
      select: { id: true, provider: true, credentialType: true, environment: true, active: true, lastHealthCheckAt: true, healthStatus: true, createdAt: true, updatedAt: true },
      orderBy: { provider: 'asc' },
    });
    res.json({ success: true, data: credentials, error: null });
  } catch (err) {
    next(err);
  }
});

platformAdminIntegrationCredentialRouter.post('/', async (req, res, next) => {
  try {
    const data = upsertCredentialSchema.parse(req.body);
    const credential = await prisma.integrationCredential.upsert({
      where: { provider_environment: { provider: data.provider, environment: data.environment } },
      create: data,
      update: { encryptedValue: data.encryptedValue, active: data.active, credentialType: data.credentialType },
    });
    res.status(201).json({ success: true, data: credential, error: null });
  } catch (err) {
    next(err);
  }
});

platformAdminIntegrationCredentialRouter.post('/:id/health-check', async (req, res, next) => {
  try {
    const credential = await prisma.integrationCredential.findUnique({ where: { id: req.params.id } });
    if (!credential) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Credencial não encontrada.' } });
      return;
    }

    let healthStatus = 'HEALTHY';
    let healthDetails: Record<string, unknown> = {};

    try {
      switch (credential.provider) {
        case 'ASAAS': {
          const response = await fetch('https://api.asaas.com/v3/customers?limit=1', {
            headers: { 'access_token': credential.encryptedValue, 'Content-Type': 'application/json' },
          });
          healthStatus = response.ok ? 'HEALTHY' : 'DEGRADED';
          healthDetails = { status: response.status };
          break;
        }
        case 'STRIPE': {
          const response = await fetch('https://api.stripe.com/v1/customers?limit=1', {
            headers: { Authorization: `Bearer ${credential.encryptedValue}` },
          });
          healthStatus = response.ok ? 'HEALTHY' : 'DEGRADED';
          healthDetails = { status: response.status };
          break;
        }
        case 'FOCUS_NFE': {
          const response = await fetch('https://api.focusnfe.com.br/v2/nfce', {
            method: 'GET',
            headers: { Authorization: `Bearer ${credential.encryptedValue}` },
          });
          healthStatus = response.ok ? 'HEALTHY' : 'DEGRADED';
          healthDetails = { status: response.status };
          break;
        }
        case 'PLUGGY': {
          const response = await fetch('https://api.pluggy.ai/connectors', {
            headers: { 'X-API-KEY': credential.encryptedValue },
          });
          healthStatus = response.ok ? 'HEALTHY' : 'DEGRADED';
          healthDetails = { status: response.status };
          break;
        }
        case 'RESEND': {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${credential.encryptedValue}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: 'test@test.com', to: 'test@test.com', subject: 'test', html: 'test' }),
          });
          healthStatus = response.ok ? 'HEALTHY' : 'DEGRADED';
          healthDetails = { status: response.status };
          break;
        }
        default:
          healthStatus = 'UNKNOWN';
      }
    } catch (err) {
      healthStatus = 'DOWN';
      healthDetails = { error: String(err) };
    }

    const updated = await prisma.integrationCredential.update({
      where: { id: req.params.id },
      data: { lastHealthCheckAt: new Date(), healthStatus, healthDetails: healthDetails as Prisma.InputJsonValue },
    });

    res.json({ success: true, data: updated, error: null });
  } catch (err) {
    next(err);
  }
});

platformAdminIntegrationCredentialRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.integrationCredential.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
});
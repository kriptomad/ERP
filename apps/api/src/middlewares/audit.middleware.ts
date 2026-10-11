import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../infra/prisma';
import { getRequestContext } from './request-context.middleware';

const AUDITED_ACTIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const SENSITIVE_MODELS = new Set([
  'User', 'PasswordResetToken', 'ActiveSession', 'TwoFactorBackupCode',
  'Subscription', 'BillingEvent',
]);

export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!AUDITED_ACTIONS.has(req.method)) {
    next();
    return;
  }

  const context = getRequestContext();
  const startTime = Date.now();

  res.on('finish', () => {
    if (res.statusCode >= 400) return;

    const pathParts = req.originalUrl.split('/').filter(Boolean);
    const resource = pathParts[pathParts.length - 1] || 'unknown';
    const resourceId = req.params?.id;

    prisma.auditLog.create({
      data: {
        tenantId: context.tenantId,
        userId: context.userId || undefined,
        action: req.method,
        resource,
        resourceId,
        ip: req.ip || req.socket.remoteAddress || undefined,
        userAgent: req.headers['user-agent'],
        changes: JSON.parse(JSON.stringify({
          body: sanitizeBody(req.body),
          query: req.query,
          params: req.params,
        })) as Prisma.InputJsonValue,
      },
    }).catch((err: Error) => {
      console.error('[Audit] Falha ao registrar log:', err.message);
    });
  });

  next();
}

function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;

  const sensitiveFields = ['password', 'passwordHash', 'creditCard', 'cvv', 'token', 'cnpj', 'cpf'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (sensitiveFields.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
      sanitized[key] = '***REDACTED***';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

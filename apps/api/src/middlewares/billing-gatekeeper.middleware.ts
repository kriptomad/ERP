import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../infra/prisma';
import { getRequestContext } from '../middlewares/request-context.middleware';

export async function billingGatekeeper(req: Request, res: Response, next: NextFunction) {
  const context = getRequestContext();
  const tenantId = context.tenantId || req.tenantId;

  if (!tenantId) {
    return res.status(400).json({
      success: false,
      data: null,
      error: { code: 'TENANT_NOT_RESOLVED', message: 'Tenant não identificado.' },
    });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { status: true, gracePeriodEndsAt: true },
  });

  if (!tenant) {
    return res.status(404).json({
      success: false,
      data: null,
      error: { code: 'TENANT_NOT_FOUND', message: 'Tenant não encontrado.' },
    });
  }

  if (tenant.status === 'SUSPENDED') {
    return res.status(402).json({
      success: false,
      data: null,
      error: {
        code: 'TENANT_SUSPENDED',
        message: 'Conta suspensa por inadimplência. Regularize para continuar.',
        details: { status: 'SUSPENDED' },
      },
    });
  }

  if (tenant.status === 'PAST_DUE') {
    const now = new Date();
    if (tenant.gracePeriodEndsAt && now > tenant.gracePeriodEndsAt) {
      return res.status(402).json({
        success: false,
        data: null,
        error: {
          code: 'GRACE_PERIOD_EXPIRED',
          message: 'Período de graça expirado. Regularize o pagamento.',
          details: { status: 'PAST_DUE', graceEndedAt: tenant.gracePeriodEndsAt },
        },
      });
    }
  }

  if (tenant.status === 'CANCELLED') {
    return res.status(402).json({
      success: false,
      data: null,
      error: {
        code: 'TENANT_CANCELLED',
        message: 'Conta cancelada. Entre em contato com o suporte.',
      },
    });
  }

  next();
}

export function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
  const context = getRequestContext();
  const tenantId = context.tenantId || req.tenantId;

  if (!tenantId) {
    return res.status(400).json({
      success: false,
      data: null,
      error: { code: 'TENANT_NOT_RESOLVED', message: 'Tenant não identificado.' },
    });
  }

  prisma.subscription.findFirst({
    where: { tenantId, status: 'ACTIVE' },
  }).then((subscription) => {
    if (!subscription) {
      return res.status(402).json({
        success: false,
        data: null,
        error: {
          code: 'NO_ACTIVE_SUBSCRIPTION',
          message: 'Nenhuma assinatura ativa encontrada.',
        },
      });
    }
    next();
  }).catch(next);
}
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../infra/prisma';
import { getRequestContext } from '../middlewares/request-context.middleware';

export async function assertAccountingAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const context = getRequestContext();
  const accountingTenantId = context.tenantId || req.tenantId;
  const targetTenantId = req.params.targetTenantId || req.body.targetTenantId || req.query.targetTenantId as string;

  if (!accountingTenantId || !targetTenantId) {
    return res.status(400).json({
      success: false,
      data: null,
      error: { code: 'MISSING_TENANT', message: 'Tenant de origem ou destino não informado.' },
    });
  }

  if (accountingTenantId === targetTenantId) {
    return next();
  }

  const engagement = await prisma.accountingEngagement.findFirst({
    where: {
      firmTenantId: accountingTenantId,
      clientTenantId: targetTenantId,
      status: 'ACTIVE',
    },
    include: { firm: true, client: true },
  });

  if (!engagement) {
    await prisma.auditLog.create({
      data: {
        tenantId: accountingTenantId,
        userId: context.userId,
        action: 'ACCOUNTING_ACCESS_DENIED',
        resource: 'AccountingEngagement',
        resourceId: targetTenantId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        changes: { reason: 'No active engagement' },
      },
    }).catch(() => {});

    return res.status(403).json({
      success: false,
      data: null,
      error: {
        code: 'ACCOUNTING_ACCESS_DENIED',
        message: 'Sem vínculo ativo com este cliente. Verifique a procuração.',
      },
    });
  }

  if (!engagement.scopes?.length) {
    return res.status(403).json({
      success: false,
      data: null,
      error: { code: 'NO_SCOPES', message: 'Engagement sem escopos definidos.' },
    });
  }

  req.accountingEngagement = engagement;
  next();
}

declare global {
  namespace Express {
    interface Request {
      accountingEngagement?: {
        id: string;
        firmTenantId: string;
        clientTenantId: string;
        scopes: string[];
        status: string;
      };
    }
  }
}

export function requireAccountingScope(...requiredScopes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const engagement = req.accountingEngagement;
    if (!engagement) {
      return res.status(403).json({
        success: false,
        data: null,
        error: { code: 'NO_ENGAGEMENT', message: 'Acesso contábil não autorizado.' },
      });
    }

    const hasScope = requiredScopes.some((scope) => engagement.scopes.includes(scope));
    if (!hasScope) {
      return res.status(403).json({
        success: false,
        data: null,
        error: {
          code: 'INSUFFICIENT_SCOPE',
          message: `Escopo insuficiente. Requer: ${requiredScopes.join(', ')}`,
        },
      });
    }
    next();
  };
}
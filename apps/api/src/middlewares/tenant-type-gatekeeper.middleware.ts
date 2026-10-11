import { Request, Response, NextFunction } from 'express';
import { getRequestContext } from '../middlewares/request-context.middleware';

export function tenantTypeGatekeeper(...allowedTypes: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const context = getRequestContext();
    const tenantId = context.tenantId || req.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'TENANT_NOT_RESOLVED', message: 'Tenant não identificado.' },
      });
    }

    const { prisma } = await import('../../infra/prisma');
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { tenantType: true },
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'TENANT_NOT_FOUND', message: 'Tenant não encontrado.' },
      });
    }

    if (!allowedTypes.includes(tenant.tenantType)) {
      return res.status(404).json({
        success: false,
        data: null,
        error: {
          code: 'TENANT_TYPE_MISMATCH',
          message: `Esta funcionalidade não está disponível para o tipo de conta ${tenant.tenantType}.`,
          details: { requiredTypes: allowedTypes, currentType: tenant.tenantType },
        },
      });
    }

    next();
  };
}

export const requireBusinessTenant = tenantTypeGatekeeper('BUSINESS');
export const requirePersonalTenant = tenantTypeGatekeeper('PERSONAL');
export const requireAccountingOfficeTenant = tenantTypeGatekeeper('ACCOUNTING_OFFICE');
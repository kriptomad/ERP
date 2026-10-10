import { Request, Response, NextFunction } from 'express';
import { tenantService } from '../modules/tenant/tenant.service';

export function requireTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.tenantId) {
    res.status(400).json({
      success: false,
      data: null,
      error: { code: 'TENANT_NOT_RESOLVED', message: 'Não foi possível identificar o tenant.' },
    });
    return;
  }

  next();
}

export function requireActiveTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.tenantId) {
    res.status(400).json({
      success: false,
      data: null,
      error: { code: 'TENANT_NOT_RESOLVED', message: 'Não foi possível identificar o tenant.' },
    });
    return;
  }

  next();
}

export async function tenantAccessGuard(req: Request, res: Response, next: NextFunction) {
  if (!req.tenantId || !req.userId) {
    res.status(401).json({
      success: false,
      data: null,
      error: { code: 'UNAUTHORIZED', message: 'Autenticação necessária.' },
    });
    return;
  }

  try {
    const hasAccess = await tenantService.checkUserAccess(req.tenantId, req.userId);
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        data: null,
        error: { code: 'TENANT_ACCESS_DENIED', message: 'Usuário não pertence a este tenant.' },
      });
      return;
    }
    next();
  } catch {
    res.status(500).json({
      success: false,
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Erro ao validar acesso ao tenant.' },
    });
  }
}

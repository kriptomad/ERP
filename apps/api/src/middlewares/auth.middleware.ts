import { Request, Response, NextFunction } from 'express';
import { verifySessionToken } from '../auth/jwt.service';
import { getRequestContext } from './request-context.middleware';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenantId?: string;
      userId?: string;
      userRole?: string;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      data: null,
      error: { code: 'UNAUTHORIZED', message: 'Token de autenticação não fornecido.' },
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const claims = verifySessionToken(token);
    req.tenantId = claims.tenantId;
    req.userId = claims.userId;
    req.userRole = claims.role;

    const context = getRequestContext();
    context.tenantId = claims.tenantId;
    context.userId = claims.userId;

    next();
  } catch {
    res.status(401).json({
      success: false,
      data: null,
      error: { code: 'INVALID_TOKEN', message: 'Token inválido ou expirado.' },
    });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({
        success: false,
        data: null,
        error: { code: 'FORBIDDEN', message: 'Permissão insuficiente para esta operação.' },
      });
      return;
    }
    next();
  };
}

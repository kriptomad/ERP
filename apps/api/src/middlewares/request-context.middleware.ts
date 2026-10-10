import { AsyncLocalStorage } from 'async_hooks';
import { Request, Response, NextFunction } from 'express';

export interface RequestContext {
  tenantId: string | null;
  userId: string | null;
  requestId: string;
  ip: string;
}

export const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext {
  return asyncLocalStorage.getStore()!;
}

export function requestContext(req: Request, _res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id']?.toString() || crypto.randomUUID();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  const context: RequestContext = {
    tenantId: null,
    userId: null,
    requestId,
    ip,
  };

  asyncLocalStorage.run(context, () => {
    next();
  });
}

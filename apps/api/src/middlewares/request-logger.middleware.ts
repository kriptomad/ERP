import { Request, Response, NextFunction } from 'express';
import { logRequest } from '../logging/structured-logger';
import { getRequestContext } from './request-context.middleware';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  res.on('finish', () => {
    const context = getRequestContext();
    const durationMs = Date.now() - startTime;

    logRequest(
      req.method,
      req.originalUrl || req.url,
      res.statusCode,
      durationMs,
      context.tenantId,
      context.userId,
    );
  });

  next();
}

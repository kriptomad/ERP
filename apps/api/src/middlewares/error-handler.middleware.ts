import { Request, Response, NextFunction } from 'express';

export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof DomainError) {
    res.status(getHttpStatus(err.code)).json({
      success: false,
      data: null,
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  console.error('[ERROR]', err);

  res.status(500).json({
    success: false,
    data: null,
    error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' },
  });
}

function getHttpStatus(code: string): number {
  const map: Record<string, number> = {
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    VALIDATION_ERROR: 422,
    MODULE_NOT_ACTIVE: 402,
    INSUFFICIENT_STOCK: 422,
    INSUFFICIENT_LOYALTY_POINTS: 422,
    CREDIT_LIMIT_EXCEEDED: 422,
    DUPLICATE_ENTRY: 409,
  };
  return map[code] || 500;
}

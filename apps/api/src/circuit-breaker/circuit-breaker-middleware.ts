import { Request, Response, NextFunction } from 'express';
import { CircuitBreaker, CircuitBreakerState } from './circuit-breaker';

export function createCircuitBreakerMiddleware(circuitBreaker: CircuitBreaker) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.locals.circuitBreaker = circuitBreaker;
    next();
  };
}

export function getCircuitBreakerState(req: Request): {
  name: string;
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
} | null {
  const cb = (req as unknown as { locals?: { circuitBreaker?: CircuitBreaker } }).locals?.circuitBreaker;
  if (!cb) return null;
  return {
    name: (cb as unknown as { name: string }).name,
    state: cb.getState(),
    failureCount: cb.getFailureCount(),
    successCount: cb.getSuccessCount(),
  };
}

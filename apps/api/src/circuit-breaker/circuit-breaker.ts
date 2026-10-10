import { logger } from '../logging/structured-logger';

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxAttempts?: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMaxAttempts: number;

  constructor(
    private readonly name: string,
    options: CircuitBreakerOptions,
  ) {
    this.failureThreshold = options.failureThreshold;
    this.resetTimeoutMs = options.resetTimeoutMs;
    this.halfOpenMaxAttempts = options.halfOpenMaxAttempts || 3;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.successCount = 0;
        logger.info(`[CircuitBreaker:${this.name}] Transição para HALF_OPEN`);
      } else {
        throw new Error(`Circuit breaker '${this.name}' is OPEN`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  getSuccessCount(): number {
    return this.successCount;
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.lastFailureTime = null;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.halfOpenMaxAttempts) {
        this.state = CircuitBreakerState.CLOSED;
        logger.info(`[CircuitBreaker:${this.name}] Transição para CLOSED`);
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.OPEN;
      logger.warn(`[CircuitBreaker:${this.name}] Transição para OPEN (falha em HALF_OPEN)`);
    } else if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
      logger.warn(`[CircuitBreaker:${this.name}] Transição para OPEN`);
    }
  }

  private shouldAttemptReset(): boolean {
    if (this.lastFailureTime === null) return false;
    return Date.now() - this.lastFailureTime >= this.resetTimeoutMs;
  }
}

export const sefazCircuitBreaker = new CircuitBreaker('SEFAZ', {
  failureThreshold: 3,
  resetTimeoutMs: 60000,
});

export const whatsappCircuitBreaker = new CircuitBreaker('WhatsApp', {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
});

export const asaasCircuitBreaker = new CircuitBreaker('Asaas', {
  failureThreshold: 3,
  resetTimeoutMs: 60000,
});

export const stripeCircuitBreaker = new CircuitBreaker('Stripe', {
  failureThreshold: 3,
  resetTimeoutMs: 60000,
});

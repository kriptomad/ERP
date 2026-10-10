import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis = globalForRedis.redis ?? new Redis(
  process.env.REDIS_URL || 'redis://localhost:6379',
  {
    maxRetriesPerRequest: 3,
  }
);

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

export class TenantCache {
  constructor(private readonly tenantId: string) {}

  private key(resource: string, id: string): string {
    return `tenant:${this.tenantId}:cache:${resource}:${id}`;
  }

  async get<T>(resource: string, id: string): Promise<T | null> {
    const raw = await redis.get(this.key(resource, id));
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async set(resource: string, id: string, value: unknown, ttlSeconds = 300): Promise<void> {
    await redis.set(this.key(resource, id), JSON.stringify(value), 'EX', ttlSeconds);
  }

  async invalidate(resource: string, id: string): Promise<void> {
    await redis.del(this.key(resource, id));
  }
}

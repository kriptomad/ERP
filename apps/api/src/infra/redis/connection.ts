import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redisConnection = globalForRedis.redis ?? new Redis(
  process.env.REDIS_URL || 'redis://localhost:6379',
  {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  }
);

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redisConnection;
}

redisConnection.on('connect', () => {
  console.log('[Redis] Conectado com sucesso');
});

redisConnection.on('error', (err) => {
  console.error('[Redis] Erro de conexão:', err.message);
});

export class TenantCache {
  constructor(private readonly tenantId: string) {}

  private key(resource: string, id: string): string {
    return `tenant:${this.tenantId}:cache:${resource}:${id}`;
  }

  async get<T>(resource: string, id: string): Promise<T | null> {
    const raw = await redisConnection.get(this.key(resource, id));
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async set(resource: string, id: string, value: unknown, ttlSeconds = 300): Promise<void> {
    await redisConnection.set(this.key(resource, id), JSON.stringify(value), 'EX', ttlSeconds);
  }

  async invalidate(resource: string, id: string): Promise<void> {
    await redisConnection.del(this.key(resource, id));
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await redisConnection.keys(`tenant:${this.tenantId}:cache:${pattern}`);
    if (keys.length > 0) {
      await redisConnection.del(...keys);
    }
  }
}

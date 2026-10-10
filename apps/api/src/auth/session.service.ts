import { prisma } from '../infra/prisma';
import { redisConnection } from '../infra/redis/connection';

const SESSION_TTL_SECONDS = 8 * 60 * 60;

export async function createSession(userId: string, tenantId: string, token: string, ip: string, userAgent: string) {
  const sessionId = crypto.randomUUID();

  await redisConnection.setex(
    `session:${sessionId}`,
    SESSION_TTL_SECONDS,
    JSON.stringify({
      userId,
      tenantId,
      token,
      ip,
      userAgent,
      createdAt: new Date().toISOString(),
    }),
  );

  await prisma.activeSession.create({
    data: {
      id: sessionId,
      userId,
      token: token.slice(-16),
      ip,
      userAgent,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
    },
  });

  return sessionId;
}

export async function getSession(sessionId: string) {
  const data = await redisConnection.get(`session:${sessionId}`);
  return data ? JSON.parse(data) : null;
}

export async function revokeSession(sessionId: string) {
  await redisConnection.del(`session:${sessionId}`);
  await prisma.activeSession.updateMany({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserSessions(userId: string, exceptSessionId?: string) {
  const sessions = await prisma.activeSession.findMany({
    where: { userId, revokedAt: null },
  });

  for (const session of sessions) {
    if (exceptSessionId && session.id === exceptSessionId) continue;
    await redisConnection.del(`session:${session.id}`);
  }

  await prisma.activeSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return sessions.length;
}

export async function listActiveSessions(userId: string) {
  const sessions = await prisma.activeSession.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  return sessions.map((s: { id: string; ip: string | null; userAgent: string | null; createdAt: Date; expiresAt: Date }) => ({
    id: s.id,
    ip: s.ip,
    userAgent: s.userAgent,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
  }));
}

import crypto from 'crypto';

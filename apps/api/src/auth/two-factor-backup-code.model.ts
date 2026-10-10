import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface TwoFactorBackupCode {
  id: string;
  userId: string;
  codeHash: string;
  usedAt: Date | null;
  createdAt: Date;
}

export async function createBackupCodes(userId: string, codes: string[]) {
  const hashedCodes = codes.map((code) => ({
    userId,
    codeHash: hashBackupCode(code),
    usedAt: null,
  }));

  return prisma.twoFactorBackupCode.createMany({
    data: hashedCodes,
  });
}

export async function verifyBackupCode(userId: string, code: string): Promise<boolean> {
  const codeHash = hashBackupCode(code);
  const backupCode = await prisma.twoFactorBackupCode.findFirst({
    where: { userId, codeHash, usedAt: null },
  });

  if (!backupCode) return false;

  await prisma.twoFactorBackupCode.update({
    where: { id: backupCode.id },
    data: { usedAt: new Date() },
  });

  return true;
}

export async function getActiveBackupCodesCount(userId: string): Promise<number> {
  return prisma.twoFactorBackupCode.count({
    where: { userId, usedAt: null },
  });
}

export async function revokeAllBackupCodes(userId: string) {
  return prisma.twoFactorBackupCode.deleteMany({
    where: { userId },
  });
}

function hashBackupCode(code: string): string {
  return require('crypto').createHash('sha256').update(code).digest('hex');
}

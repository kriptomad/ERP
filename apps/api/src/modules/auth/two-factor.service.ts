import { prismaUnscoped } from "@filitech/database";
import {
  generateTotpSecret,
  verifyTotp,
  totpOtpauthUrl,
  generateBackupCodes,
} from "../../auth/totp.service";
import { hashPassword, verifyPassword } from "../../auth/password.service";

export async function beginTotpEnrollment(userId: string) {
  const user = await prismaUnscoped.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.totpConfirmedAt) throw new Error("2FA_ALREADY_ENABLED");
  const secret = generateTotpSecret();
  await prismaUnscoped.user.update({
    where: { id: userId },
    data: { totpSecretEncrypted: secret },
  });
  return { secret, otpauthUrl: totpOtpauthUrl({ secret, email: user.email }) };
}

export async function confirmTotpEnrollment(userId: string, code: string) {
  const user = await prismaUnscoped.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.totpSecretEncrypted) throw new Error("2FA_NOT_STARTED");
  if (user.totpConfirmedAt) throw new Error("2FA_ALREADY_ENABLED");
  if (!verifyTotp(user.totpSecretEncrypted, code)) throw new Error("INVALID_TOTP");

  const plainCodes = generateBackupCodes(10);
  await prismaUnscoped.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { totpConfirmedAt: new Date() },
    });
    for (const c of plainCodes) {
      await tx.twoFactorBackupCode.create({
        data: { userId, codeHash: await hashPassword(c) },
      });
    }
  });
  return { backupCodes: plainCodes };
}

export async function verifyUserTotp(userId: string, code: string) {
  const user = await prismaUnscoped.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.totpConfirmedAt || !user.totpSecretEncrypted) return false;
  return verifyTotp(user.totpSecretEncrypted, code);
}

export async function disableTotp(userId: string, password: string) {
  const user = await prismaUnscoped.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(user.passwordHash, password))) throw new Error("INVALID_PASSWORD");
  await prismaUnscoped.$transaction([
    prismaUnscoped.user.update({
      where: { id: userId },
      data: { totpSecretEncrypted: null, totpConfirmedAt: null },
    }),
    prismaUnscoped.twoFactorBackupCode.deleteMany({ where: { userId } }),
  ]);
}

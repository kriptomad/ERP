import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../infra/prisma';
import { authenticate } from '../middlewares/auth.middleware';
import {
  generateTotpSecret,
  verifyTotpToken,
  generateBackupCodes,
  encryptTotpSecret,
} from './totp.service';
import { createBackupCodes, verifyBackupCode, getActiveBackupCodesCount } from './two-factor-backup-code.model';
import { logger } from '../logging/structured-logger';

export const twoFactorRouter = Router();

twoFactorRouter.use(authenticate);

twoFactorRouter.post('/setup', async (req, res, next) => {
  try {
    const userId = req.userId!;

    const { secret, otpauthUrl } = generateTotpSecret();

    await prisma.user.update({
      where: { id: userId },
      data: { totpSecretEncrypted: encryptTotpSecret(secret) },
    });

    logger.info('2FA setup initiated', { userId });

    res.json({
      success: true,
      data: { secret, otpauthUrl },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

const verifySchema = z.object({
  token: z.string().length(6),
});

twoFactorRouter.post('/verify', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const { token } = verifySchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user?.totpSecretEncrypted) {
      res.status(400).json({
        success: false,
        data: null,
        error: { code: '2FA_NOT_SETUP', message: '2FA não foi configurado.' },
      });
      return;
    }

    const isValid = verifyTotpToken(user.totpSecretEncrypted, token);

    if (!isValid) {
      res.status(401).json({
        success: false,
        data: null,
        error: { code: 'INVALID_TOKEN', message: 'Código inválido.' },
      });
      return;
    }

    const backupCodes = generateBackupCodes();
    await createBackupCodes(userId, backupCodes);

    await prisma.user.update({
      where: { id: userId },
      data: { totpConfirmedAt: new Date() },
    });

    logger.info('2FA verified successfully', { userId });

    res.json({
      success: true,
      data: { backupCodes, message: '2FA ativado com sucesso.' },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

twoFactorRouter.post('/validate', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const { token } = verifySchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Usuário não encontrado.' } });
      return;
    }

    if (user.totpSecretEncrypted && verifyTotpToken(user.totpSecretEncrypted, token)) {
      res.json({ success: true, data: { valid: true }, error: null });
      return;
    }

    const backupCodeValid = await verifyBackupCode(userId, token);
    if (backupCodeValid) {
      res.json({ success: true, data: { valid: true }, error: null });
      return;
    }

    res.status(401).json({
      success: false,
      data: null,
      error: { code: 'INVALID_TOKEN', message: 'Código inválido.' },
    });
  } catch (err) {
    next(err);
  }
});

twoFactorRouter.post('/disable', async (req, res, next) => {
  try {
    const userId = req.userId!;

    await prisma.user.update({
      where: { id: userId },
      data: { totpSecretEncrypted: null, totpConfirmedAt: null },
    });

    await prisma.twoFactorBackupCode.deleteMany({ where: { userId } });

    logger.info('2FA disabled', { userId });

    res.json({ success: true, data: { message: '2FA desativado.' }, error: null });
  } catch (err) {
    next(err);
  }
});

twoFactorRouter.get('/status', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { totpConfirmedAt: true },
    });

    const backupCodesCount = await getActiveBackupCodesCount(userId);

    res.json({
      success: true,
      data: {
        enabled: !!user?.totpConfirmedAt,
        backupCodesRemaining: backupCodesCount,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

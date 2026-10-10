import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../infra/prisma';
import { hashPassword } from './password.service';
import { logger } from '../logging/structured-logger';

export const passwordResetRouter = Router();

const requestResetSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

passwordResetRouter.post('/request', async (req, res, next) => {
  try {
    const { email } = requestResetSchema.parse(req.body);

    const user = await prisma.user.findFirst({ where: { email } });

    if (!user) {
      res.json({ success: true, data: { message: 'Se o e-mail existir, você receberá um link de recuperação.' }, error: null });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    logger.info('Password reset requested', { userId: user.id, email });

    res.json({ success: true, data: { message: 'Se o e-mail existir, você receberá um link de recuperação.' }, error: null });
  } catch (err) {
    next(err);
  }
});

passwordResetRouter.post('/reset', async (req, res, next) => {
  try {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      res.status(400).json({
        success: false,
        data: null,
        error: { code: 'INVALID_TOKEN', message: 'Token inválido ou expirado.' },
      });
      return;
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    logger.info('Password reset completed', { userId: resetToken.userId });

    res.json({ success: true, data: { message: 'Senha redefinida com sucesso.' }, error: null });
  } catch (err) {
    next(err);
  }
});

passwordResetRouter.get('/verify/:token', async (req, res, next) => {
  try {
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: req.params.token },
    });

    const isValid = resetToken && !resetToken.usedAt && resetToken.expiresAt > new Date();

    res.json({
      success: true,
      data: { valid: Boolean(isValid) },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

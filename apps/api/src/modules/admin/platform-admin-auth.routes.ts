import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { hashPassword, verifyPassword } from '../../auth/password.service';
import { generateTotpSecret, verifyTotpToken, encryptTotpSecret } from '../../auth/totp.service';
import { logger } from '../../logging/structured-logger';

export const platformAdminAuthRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpToken: z.string().length(6).optional(),
});

platformAdminAuthRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password, totpToken } = loginSchema.parse(req.body);

    const admin = await prisma.platformAdminUser.findUnique({
      where: { email },
    });

    if (!admin || !admin.active) {
      res.status(401).json({ success: false, data: null, error: { code: 'UNAUTHORIZED', message: 'Credenciais inválidas.' } });
      return;
    }

    const valid = await verifyPassword(admin.passwordHash, password);
    if (!valid) {
      res.status(401).json({ success: false, data: null, error: { code: 'UNAUTHORIZED', message: 'Credenciais inválidas.' } });
      return;
    }

    if (admin.totpSecretEncrypted) {
      if (!totpToken) {
        res.status(403).json({
          success: false,
          data: null,
          error: { code: '2FA_REQUIRED', message: 'Token 2FA obrigatório.' },
        });
        return;
      }

      const isValid = verifyTotpToken(admin.totpSecretEncrypted, totpToken);
      if (!isValid) {
        res.status(401).json({ success: false, data: null, error: { code: 'INVALID_TOKEN', message: 'Token 2FA inválido.' } });
        return;
      }
    }

    const token = `pa_${crypto.randomUUID()}`;

    logger.info('Platform admin logged in', { adminId: admin.id, email });

    res.json({
      success: true,
      data: {
        token,
        admin: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        },
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

const createAdminSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['SUPER_ADMIN', 'FINANCE_ANALYST', 'SUPPORT_AGENT']).default('SUPPORT_AGENT'),
});

platformAdminAuthRouter.post('/register', async (req, res, next) => {
  try {
    const data = createAdminSchema.parse(req.body);

    const existing = await prisma.platformAdminUser.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      res.status(409).json({ success: false, data: null, error: { code: 'CONFLICT', message: 'E-mail já cadastrado.' } });
      return;
    }

    const passwordHash = await hashPassword(data.password);

    const admin = await prisma.platformAdminUser.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        role: data.role,
      },
    });

    logger.info('Platform admin created', { adminId: admin.id, email: data.email });

    res.status(201).json({
      success: true,
      data: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

platformAdminAuthRouter.post('/2fa/setup', async (req, res, next) => {
  try {
    const { adminId } = z.object({ adminId: z.string().uuid() }).parse(req.body);

    const { secret, otpauthUrl } = generateTotpSecret();

    await prisma.platformAdminUser.update({
      where: { id: adminId },
      data: { totpSecretEncrypted: encryptTotpSecret(secret) },
    });

    res.json({
      success: true,
      data: { secret, otpauthUrl },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

platformAdminAuthRouter.post('/2fa-verify', async (req, res, next) => {
  try {
    const { adminId, token } = z.object({ adminId: z.string().uuid(), token: z.string().length(6) }).parse(req.body);

    const admin = await prisma.platformAdminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin?.totpSecretEncrypted) {
      res.status(400).json({ success: false, data: null, error: { code: '2FA_NOT_SETUP', message: '2FA não configurado.' } });
      return;
    }

    const isValid = verifyTotpToken(admin.totpSecretEncrypted, token);

    if (!isValid) {
      res.status(401).json({ success: false, data: null, error: { code: 'INVALID_TOKEN', message: 'Token inválido.' } });
      return;
    }

    await prisma.platformAdminUser.update({
      where: { id: adminId },
      data: { totpConfirmedAt: new Date() },
    });

    res.json({ success: true, data: { message: '2FA confirmado.' }, error: null });
  } catch (err) {
    next(err);
  }
});

import crypto from 'crypto';

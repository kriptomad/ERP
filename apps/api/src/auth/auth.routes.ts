import { Router } from 'express';
import { z } from 'zod';
import { login, register } from './auth.service';
import { authenticate } from '../middlewares/auth.middleware';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  tradeName: z.string().min(2),
  legalName: z.string().min(2),
  cnpj: z.string().optional(),
  niche: z.string().optional(),
});

export const authRouter = Router();

authRouter.post('/login', async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await login(input);
    res.json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/register', async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const result = await register(input);
    res.status(201).json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      userId: req.userId,
      tenantId: req.tenantId,
      role: req.userRole,
    },
    error: null,
  });
});

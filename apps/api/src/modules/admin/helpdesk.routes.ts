import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/auth.middleware';

export const helpdeskRouter = Router();

helpdeskRouter.use(authenticate);
helpdeskRouter.use(requireRole('OWNER'));

helpdeskRouter.get('/tickets', async (req, res, next) => {
  try {
    const { status, priority, category, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = {
      ...(status && { status: status as string }),
      ...(priority && { priority: priority as string }),
      ...(category && { category: category as string }),
    };

    const [tickets, total] = await Promise.all([
      prisma.helpdeskTicket.findMany({
        where,
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.helpdeskTicket.count({ where }),
    ]);

    res.json({ success: true, data: { items: tickets, total }, error: null });
  } catch (err) {
    next(err);
  }
});

const createTicketSchema = z.object({
  tenantId: z.string().optional(),
  tenantName: z.string().optional(),
  userId: z.string().optional(),
  userName: z.string().optional(),
  category: z.string().min(1),
  subject: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

helpdeskRouter.post('/tickets', async (req, res, next) => {
  try {
    const data = createTicketSchema.parse(req.body);
    const ticket = await prisma.helpdeskTicket.create({ data });
    res.status(201).json({ success: true, data: ticket, error: null });
  } catch (err) {
    next(err);
  }
});

const updateTicketSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedTo: z.string().optional(),
});

helpdeskRouter.patch('/tickets/:id', async (req, res, next) => {
  try {
    const data = updateTicketSchema.parse(req.body);
    const ticket = await prisma.helpdeskTicket.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ success: true, data: ticket, error: null });
  } catch (err) {
    next(err);
  }
});

helpdeskRouter.get('/tickets/:id', async (req, res, next) => {
  try {
    const ticket = await prisma.helpdeskTicket.findUnique({
      where: { id: req.params.id },
    });
    if (!ticket) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Ticket não encontrado.' } });
      return;
    }
    res.json({ success: true, data: ticket, error: null });
  } catch (err) {
    next(err);
  }
});

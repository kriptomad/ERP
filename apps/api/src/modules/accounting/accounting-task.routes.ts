import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';
import { assertAccountingAccess, requireAccountingScope } from '../../middlewares/accounting-access.middleware';

export const accountingTaskRouter = Router();

accountingTaskRouter.use(authenticate);
accountingTaskRouter.use(assertAccountingAccess);
accountingTaskRouter.use(requireAccountingScope('FULL_BOOKKEEPING', 'TAX_FILING', 'PAYROLL_ESOCIAL', 'PERSONAL_INCOME_TAX'));

const createTaskSchema = z.object({
  engagementId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  documentType: z.enum(['ECD', 'ECF', 'EFD_REINF', 'DCTFWEB', 'DEFIS', 'DAS', 'DIRPF', 'CARNES_LEAO']).optional(),
  recurrence: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL', 'ONE_TIME']).default('ONE_TIME'),
});

accountingTaskRouter.get('/tasks', async (req, res, next) => {
  try {
    const engagement = req.accountingEngagement!;
    const { status, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = {
      firmTenantId: engagement.firmTenantId,
      clientTenantId: engagement.clientTenantId,
      ...(status && { status }),
    };

    const [tasks, total] = await Promise.all([
      prisma.accountingTask.findMany({
        where,
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { dueDate: 'asc' },
      }),
      prisma.accountingTask.count({ where }),
    ]);

    res.json({ success: true, data: { items: tasks, total }, error: null });
  } catch (err) {
    next(err);
  }
});

accountingTaskRouter.post('/tasks', async (req, res, next) => {
  try {
    const engagement = req.accountingEngagement!;
    const data = createTaskSchema.parse(req.body);

    const task = await prisma.accountingTask.create({
      data: {
        tenantId: engagement.firmTenantId,
        firmTenantId: engagement.firmTenantId,
        clientTenantId: engagement.clientTenantId,
        ...data,
      },
    });

    res.status(201).json({ success: true, data: task, error: null });
  } catch (err) {
    next(err);
  }
});

accountingTaskRouter.patch('/tasks/:id', async (req, res, next) => {
  try {
    const engagement = req.accountingEngagement!;
    const data = z.object({ status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional() }).parse(req.body);

    const task = await prisma.accountingTask.update({
      where: { id: req.params.id, firmTenantId: engagement.firmTenantId },
      data: { ...data, ...(data.status === 'COMPLETED' && { completedAt: new Date() }) },
    });

    res.json({ success: true, data: task, error: null });
  } catch (err) {
    next(err);
  }
});

accountingTaskRouter.post('/tasks/generate-recurring', async (req, res, next) => {
  try {
    const engagement = req.accountingEngagement!;
    const { referenceDate } = z.object({ referenceDate: z.string().datetime() }).parse(req.body);
    const refDate = new Date(referenceDate);
    const month = refDate.getMonth() + 1;
    const year = refDate.getFullYear();

    const existingTasks = await prisma.accountingTask.findMany({
      where: {
        firmTenantId: engagement.firmTenantId,
        clientTenantId: engagement.clientTenantId,
        recurrence: { not: 'ONE_TIME' },
        dueDate: { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0) },
      },
    });

    if (existingTasks.length > 0) {
      res.json({ success: true, data: { created: 0, message: 'Tarefas já geradas para este período.' }, error: null });
      return;
    }

    const recurringRules = [
      { title: 'Apuração DAS', documentType: 'DAS', recurrence: 'MONTHLY', dueDay: 20 },
      { title: 'DCTFWeb', documentType: 'DCTFWEB', recurrence: 'MONTHLY', dueDay: 15 },
      { title: 'EFD-Reinf', documentType: 'EFD_REINF', recurrence: 'MONTHLY', dueDay: 15 },
      { title: 'Folha/eSocial', documentType: 'DCTFWEB', recurrence: 'MONTHLY', dueDay: 7 },
    ];

    const created = [];
    for (const rule of recurringRules) {
      if (!engagement.scopes.includes(mapScopeToTask(rule.documentType))) continue;

      const dueDate = new Date(year, month - 1, rule.dueDay);
      const task = await prisma.accountingTask.create({
        data: {
          tenantId: engagement.firmTenantId,
          firmTenantId: engagement.firmTenantId,
          clientTenantId: engagement.clientTenantId,
          title: rule.title,
          documentType: rule.documentType,
          status: 'PENDING',
          dueDate,
          recurrence: rule.recurrence,
        },
      });
      created.push(task);
    }

    res.status(201).json({ success: true, data: { created: created.length, tasks: created }, error: null });
  } catch (err) {
    next(err);
  }
});

function mapScopeToTask(docType: string): string {
  const map: Record<string, string> = {
    'DAS': 'TAX_FILING',
    'DCTFWEB': 'TAX_FILING',
    'EFD_REINF': 'TAX_FILING',
    'ECF': 'FULL_BOOKKEEPING',
    'ECD': 'FULL_BOOKKEEPING',
    'DEFIS': 'TAX_FILING',
  };
  return map[docType] || 'FULL_BOOKKEEPING';
}
import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../infra/redis/connection';
import { prisma } from '../infra/prisma';
import { logger } from '../logging/structured-logger';

export const ACCOUNTING_TASK_QUEUE = 'accounting-tasks';
export const BILLING_QUEUE = 'billing';
export const NOTIFICATION_QUEUE = 'notifications';
export const FISCAL_QUEUE = 'fiscal-emission';
export const REPORT_QUEUE = 'report-generation';
export const SYNC_QUEUE = 'sync-jobs';

const accountingTaskQueue = new Queue(ACCOUNTING_TASK_QUEUE, { connection: redisConnection });
const billingQueue = new Queue(BILLING_QUEUE, { connection: redisConnection });
const notificationQueue = new Queue(NOTIFICATION_QUEUE, { connection: redisConnection });
const fiscalQueue = new Queue(FISCAL_QUEUE, { connection: redisConnection });
const reportQueue = new Queue(REPORT_QUEUE, { connection: redisConnection });
const syncQueue = new Queue(SYNC_QUEUE, { connection: redisConnection });

export async function scheduleRecurringAccountingTasks(): Promise<void> {
  const engagements = await prisma.accountingEngagement.findMany({
    where: { status: 'ACTIVE', scopes: { hasSome: ['FULL_BOOKKEEPING', 'TAX_FILING', 'PAYROLL_ESOCIAL'] } },
  });

  for (const engagement of engagements) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const existing = await prisma.accountingTask.findFirst({
      where: {
        firmTenantId: engagement.firmTenantId,
        clientTenantId: engagement.clientTenantId,
        dueDate: { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0) },
        documentType: { in: ['DAS', 'DCTFWEB', 'EFD_REINF'] },
      },
    });

    if (!existing) {
      await accountingTaskQueue.add('generate-recurring', {
        engagementId: engagement.id,
        referenceDate: new Date(),
      }, { removeOnComplete: 100, removeOnFail: 50 });
    }
  }
}

export const accountingTaskWorker = new Worker(
  ACCOUNTING_TASK_QUEUE,
  async (job: Job) => {
    const { engagementId, referenceDate } = job.data;
    logger.info('Processing accounting task', { engagementId });

    const engagement = await prisma.accountingEngagement.findUnique({
      where: { id: engagementId },
      include: { client: true },
    });

    if (!engagement || engagement.status !== 'ACTIVE') return;

    const refDate = new Date(referenceDate);
    const month = refDate.getMonth() + 1;
    const year = refDate.getFullYear();

    const tasks = [];
    if (engagement.scopes.includes('TAX_FILING')) {
      tasks.push({ title: 'Apuração DAS', documentType: 'DAS', recurrence: 'MONTHLY', dueDay: 20 });
      tasks.push({ title: 'DCTFWeb', documentType: 'DCTFWEB', recurrence: 'MONTHLY', dueDay: 15 });
      tasks.push({ title: 'EFD-Reinf', documentType: 'EFD_REINF', recurrence: 'MONTHLY', dueDay: 15 });
    }
    if (engagement.scopes.includes('PAYROLL_ESOCIAL')) {
      tasks.push({ title: 'Folha/eSocial', documentType: 'DCTFWEB', recurrence: 'MONTHLY', dueDay: 7 });
    }

    if (!engagement.firmTenantId) return;

    for (const task of tasks) {
      const dueDate = new Date(year, month - 1, task.dueDay);
      await prisma.accountingTask.create({
        data: {
          tenantId: engagement.firmTenantId,
          firmTenantId: engagement.firmTenantId,
          clientTenantId: engagement.clientTenantId,
          title: task.title,
          documentType: task.documentType,
          status: 'PENDING',
          dueDate,
          recurrence: task.recurrence,
        },
      });
    }

    logger.info('Recurring accounting tasks generated', { engagementId, count: tasks.length });
  },
  { connection: redisConnection, concurrency: 5 },
);

export const billingWorker = new Worker(
  BILLING_QUEUE,
  async (job: Job) => {
    logger.info('Processing billing job', { type: job.data.type, jobId: job.id });
  },
  { connection: redisConnection, concurrency: 5 },
);

export const notificationWorker = new Worker(
  NOTIFICATION_QUEUE,
  async (job: Job) => {
    logger.info('Processing notification', { type: job.data.type, jobId: job.id });
  },
  { connection: redisConnection, concurrency: 10 },
);

export const fiscalWorker = new Worker(
  FISCAL_QUEUE,
  async (job: Job) => {
    logger.info('Processing fiscal emission', { type: job.data.type, jobId: job.id });
  },
  { connection: redisConnection, concurrency: 3 },
);

accountingTaskWorker.on('completed', (job) => logger.info('Accounting task completed', { jobId: job.id }));
accountingTaskWorker.on('failed', (job, err) => logger.error('Accounting task failed', { jobId: job?.id, error: err }));
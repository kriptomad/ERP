import { Queue, Worker, Job } from 'bullmq';
import { prisma } from '../infra/prisma';
import { logger } from '../logging/structured-logger';
import { ACCOUNTING_TASK_QUEUE } from './queues';

const engagementExpiryQueue = new Queue('engagement-expiry', { connection: { host: 'redis://localhost:6379' } });

// Worker que verifica engajamentos pendentes expirando o prazo de 30 dias
const engagementExpiryWorker = new Worker(
  'engagement-expiry',
  async (job: Job) => {
    logger.info('Checking engagement expiry', { jobId: job.id });

    const now = new Date();
    const pendingEngagements = await prisma.accountingEngagement.findMany({
      where: {
        status: 'PENDING_ACCOUNTANT_ACCEPTANCE',
        createdAt: { lt: new Date(now.getTime() - ENGAGEMENT_TIMEOUT_DAYS * 24 * 60 * 60 * 1000) },
      },
    });

    for (const engagement of pendingEngagements) {
      // Marcar como expirado
      await prisma.accountingEngagement.update({
        where: { id: engagement.id },
        data: { status: 'EXPIRED' },
      });

      // Registrar evento de auditoria
      await prisma.accountingEngagementAuditEvent.create({
        data: {
          engagementId: engagement.id,
          event: 'EXPIRED',
          actorTenantId: engagement.firmTenantId,
          metadata: { expiredAt: now.toISOString(), daysPending: ENGAGEMENT_TIMEOUT_DAYS },
        },
      });

      logger.warn('Engagement expirado por falta de aceite', { engagementId: engagement.id, clientTenantId: engagement.clientTenantId });
    }
  },
  { connection: { host: 'redis://localhost:6379' }, concurrency: 3 },
);

engagementExpiryWorker.on('completed', (job) => logger.info('Engagement expiry check completed', { jobId: job.id }));
engagementExpiryWorker.on('failed', (job, err) => logger.error('Engagement expiry check failed', { jobId: job?.id, error: err }));

const ENGAGEMENT_TIMEOUT_DAYS = 30;
console.log(`🟢 Engagement expiry worker started - timeout: ${ENGAGEMENT_TIMEOUT_DAYS} days`);

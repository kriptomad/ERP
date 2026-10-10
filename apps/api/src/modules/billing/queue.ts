import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../../infra/redis/connection';

export const BILLING_QUEUE_NAME = 'billing';

export const billingQueue = new Queue(BILLING_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export type BillingJobType =
  | 'charge-recurring'
  | 'retry-payment'
  | 'notify-payment-failed'
  | 'suspend-overdue-tenant'
  | 'generate-invoice'
  | 'sync-fiscal-document';

export interface BillingJobData {
  type: BillingJobType;
  tenantId?: string;
  subscriptionId?: string;
  externalSubscriptionId?: string;
  attempt?: number;
  payload?: Record<string, unknown>;
}

export const billingWorker = new Worker(
  BILLING_QUEUE_NAME,
  async (job: Job<BillingJobData>) => {
    console.log(`[BillingWorker] Processando job ${job.id}: ${job.data.type}`);

    switch (job.data.type) {
      case 'charge-recurring':
        await handleRecurringCharge(job.data);
        break;
      case 'retry-payment':
        await handleRetryPayment(job.data);
        break;
      case 'notify-payment-failed':
        await handleNotifyPaymentFailed(job.data);
        break;
      case 'suspend-overdue-tenant':
        await handleSuspendOverdueTenant(job.data);
        break;
      default:
        console.log(`[BillingWorker] Tipo desconhecido: ${job.data.type}`);
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  },
);

async function handleRecurringCharge(_data: BillingJobData): Promise<void> {
  console.log('[BillingWorker] Cobrança recorrente processada');
}

async function handleRetryPayment(_data: BillingJobData): Promise<void> {
  console.log('[BillingWorker] Tentativa de pagamento processada');
}

async function handleNotifyPaymentFailed(_data: BillingJobData): Promise<void> {
  console.log('[BillingWorker] Notificação de falha enviada');
}

async function handleSuspendOverdueTenant(_data: BillingJobData): Promise<void> {
  console.log('[BillingWorker] Tenant suspenso por inadimplência');
}

billingWorker.on('completed', (job) => {
  console.log(`[BillingWorker] Job ${job.id} concluído com sucesso`);
});

billingWorker.on('failed', (job, err) => {
  console.error(`[BillingWorker] Job ${job?.id} falhou:`, err.message);
});

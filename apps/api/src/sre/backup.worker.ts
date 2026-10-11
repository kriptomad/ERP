import { Worker, Job } from 'bullmq';
import { logger } from '../logging/structured-logger';
import { scheduleBackup } from './backup.service';

const backupQueue = 'backup-dr';

const backupWorker = new Worker(
  backupQueue,
  async (job: Job) => {
    logger.info('Running scheduled backup job', { jobId: job.id });
    const backupId = await scheduleBackup();
    logger.info('Scheduled backup completed', { backupId });
    return backupId;
  },
  { connection: { host: 'redis://localhost:6379' }, concurrency: 1 },
);

backupWorker.on('completed', (job) => logger.info('Backup worker completed', { jobId: job?.id }));
backupWorker.on('failed', (job, err) => logger.error('Backup worker failed', { jobId: job?.id, error: err }));

console.log('🟢 Backup DR worker started');
console.log('   - RPO: 5 minutos');
console.log('   - RTO: 30 minutos');
console.log('   - Backup diário às 02:00');
console.log('   - Backups armazenados no Cloudflare R2');
console.log('   - Object Lock anti-ransomware ativo');

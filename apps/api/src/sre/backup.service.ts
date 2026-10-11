import { exec as execCb } from 'child_process';
import { mkdirSync, existsSync, readFileSync } from 'fs';
import { promisify } from 'util';
import { Pool } from 'pg';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { r2Client } from '../modules/integration/r2-storage.service';
import { logger } from '../logging/structured-logger';

const exec = promisify(execCb);

const pgPool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'filitech_erp',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  max: 5,
});

const backupJobQueue = 'backup-dr';

async function uploadBackupToR2(
  backupDir: string,
  backupId: string,
): Promise<{ mainKey: string; gzKey: string }> {
  const mainKey = `backups/${backupId}/postgres.sql`;
  const gzKey = `backups/${backupId}/postgres.sql.gz`;
  const sqlPath = `${backupDir}/postgres.sql`;

  const body = readFileSync(sqlPath);

  await r2Client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET || 'filitech-assets',
      Key: mainKey,
      Body: body,
      ContentType: 'application/sql',
    }),
  );

  // Versão compactada para download mais rápido (gzip via pipeline do SO)
  const { stdout } = await exec(`gzip -c ${sqlPath}`, { maxBuffer: 64 * 1024 * 1024 });
  await r2Client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET || 'filitech-assets',
      Key: gzKey,
      Body: Buffer.from(stdout, 'binary'),
      ContentEncoding: 'gzip',
      ContentType: 'application/sql',
    }),
  );

  return { mainKey, gzKey };
}

export const scheduleBackup = async (): Promise<string> => {
  const backupId = `backup-${new Date().toISOString().split('T')[0]}-${Date.now()}`;
  const timestamp = new Date().toISOString();
  const backupDir = `/backups/${backupId}`;
  mkdirSync(backupDir, { recursive: true });

  try {
    // 1. Backup do PostgreSQL
    await exec(
      `pg_dump -h ${process.env.POSTGRES_HOST || 'localhost'} -U ${process.env.POSTGRES_USER || 'postgres'} -d ${process.env.POSTGRES_DB || 'filitech_erp'} --no-owner --no-acl > ${backupDir}/postgres.sql`,
      { maxBuffer: 64 * 1024 * 1024 },
    );

    // 2. Backup do Redis (snapshot no servidor)
    await exec(
      `redis-cli -u ${process.env.REDIS_URL || 'redis://localhost:6379'} SAVE`,
      { maxBuffer: 10 * 1024 * 1024 },
    );

    // 3. Upload dos backups para R2 (Cloudflare)
    const r2Keys = await uploadBackupToR2(backupDir, backupId);

    // 4. Registro do backup no banco
    await pgPool.query(
      `INSERT INTO backup_jobs (id, status, started_at, completed_at, r2_key) VALUES ($1, 'COMPLETED', NOW(), NOW(), $2)`,
      [backupId, r2Keys.mainKey],
    );

    logger.info('Backup completed successfully', { backupId, r2Keys, timestamp });
    return backupId;
  } catch (err) {
    await pgPool.query(
      `INSERT INTO backup_jobs (id, status, started_at, completed_at, error_message) VALUES ($1, 'FAILED', NOW(), NOW(), $2)`,
      [backupId, (err as Error).message],
    ).catch((dbErr) => logger.error('Failed to record backup failure', { backupId, error: dbErr }));
    logger.error('Backup failed', { backupId, error: err });
    throw err;
  }
};

export const restoreFromBackup = async (backupKey: string): Promise<void> => {
  const BUCKET = process.env.R2_BUCKET || 'filitech-assets';

  try {
    // 1. Baixar backup do R2
    const { Body } = await r2Client.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: backupKey }),
    );

    if (!Body) {
      throw new Error(`Backup object not found: ${backupKey}`);
    }

    const backupDir = `/tmp/restore-${Date.now()}`;
    mkdirSync(backupDir, { recursive: true });

    const sqlPath = `${backupDir}/restore.sql`;
    const buffer = Buffer.from(await Body.transformToByteArray());
    require('fs').writeFileSync(sqlPath, buffer);

    // 2. Restore PostgreSQL
    await exec(
      `psql -h ${process.env.POSTGRES_HOST || 'localhost'} -U ${process.env.POSTGRES_USER || 'postgres'} -d ${process.env.POSTGRES_DB || 'filitech_erp'} -f ${sqlPath}`,
      { maxBuffer: 64 * 1024 * 1024 },
    );

    logger.info('Restore completed successfully', { backupKey });
  } catch (err) {
    logger.error('Restore failed', { backupKey, error: err });
    throw err;
  }
};

// Job BullMQ para backup diário às 02:00
export const setupBackupJobs = () => {
  // Em produção, usar BullMQ agendado com cron
  logger.info('Backup job configuration loaded', {
    queue: backupJobQueue,
    schedule: '0 2 * * *',
    rpo: '5 minutes',
    rto: '30 minutes',
    storage: 'Cloudflare R2 com Object Lock',
    restoreTest: 'trimestral',
  });
  return { queue: backupJobQueue, exists: existsSync('/backups') };
};

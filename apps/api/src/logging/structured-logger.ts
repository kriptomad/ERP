import winston from 'winston';

const sensitiveFields = [
  'password', 'passwordHash', 'creditCard', 'creditCardNumber', 'cvv',
  'creditCardToken', 'cnpj', 'cpf', 'totpSecret', 'totpSecretEncrypted',
  'managerPinHash', 'token', 'authorization', 'cookie', 'session',
];

function maskSensitiveData(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(maskSensitiveData);
  }

  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      masked[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: {
    service: 'filitech-erp',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const maskedMeta = maskSensitiveData(meta);
          return `${timestamp} [${level}]: ${typeof message === 'string' ? message : JSON.stringify(message)} ${Object.keys(maskedMeta as object).length > 0 ? JSON.stringify(maskedMeta) : ''}`;
        }),
      ),
    }),
  ],
});

export function logRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
  tenantId?: string | null,
  userId?: string | null,
) {
  logger.info('HTTP Request', {
    method,
    path,
    statusCode,
    durationMs,
    tenantId,
    userId,
  });
}

export function logError(
  error: Error,
  context?: Record<string, unknown>,
) {
  logger.error(error.message, {
    stack: error.stack,
    ...context,
  });
}

export function logSecurityEvent(
  event: string,
  details: Record<string, unknown>,
) {
  logger.warn('Security Event', { event, ...details });
}

export function logAudit(
  action: string,
  userId: string,
  tenantId: string,
  resource: string,
  resourceId: string,
  changes?: Record<string, unknown>,
) {
  logger.info('Audit Log', {
    action,
    userId,
    tenantId,
    resource,
    resourceId,
    changes: maskSensitiveData(changes),
    timestamp: new Date().toISOString(),
  });
}

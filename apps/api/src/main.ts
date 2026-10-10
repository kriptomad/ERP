import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { authRouter } from './auth/auth.routes';
import { tenantRouter } from './modules/tenant/tenant.routes';
import { productRouter } from './modules/product/product.routes';
import { saleRouter } from './modules/sale/sale.routes';
import { stockRouter } from './modules/stock/stock.routes';
import { financialRouter } from './modules/financial/financial.routes';
import { clientRouter } from './modules/client/client.routes';
import { workOrderRouter } from './modules/work-order/work-order.routes';
import { billingRouter } from './modules/billing/billing.routes';
import { adminRouter } from './auth/admin.routes';
import { errorHandler } from './middlewares/error-handler.middleware';
import { requestContext } from './middlewares/request-context.middleware';
import { requestLogger } from './middlewares/request-logger.middleware';
import { auditMiddleware } from './middlewares/audit.middleware';
import { healthRouter } from './sre/health-check';
import { metricsRouter } from './sre/metrics';
import { twoFactorRouter } from './auth/two-factor.routes';
import { passwordResetRouter } from './auth/password-reset.routes';
import { billingWebhookRouter } from './modules/billing/billing-webhook.routes';
import { billingJobRouter } from './modules/billing/billing-job.routes';
import { logger } from './logging/structured-logger';
import { impersonationRouter } from './modules/admin/impersonation.routes';
import { systemParameterRouter } from './modules/admin/system-parameter.routes';
import { featureFlagRouter } from './modules/admin/feature-flag.routes';
import { integrationCredentialRouter } from './modules/admin/integration-credential.routes';
import { helpdeskRouter } from './modules/admin/helpdesk.routes';
import { apiKeyRouter } from './modules/admin/api-key.routes';
import { tenantWebhookRouter } from './modules/admin/tenant-webhook.routes';
import { officialDocumentLayoutRouter } from './modules/admin/official-document-layout.routes';
import { fiscalCodeCatalogRouter } from './modules/admin/fiscal-code-catalog.routes';
import { platformAdminAuthRouter } from './modules/admin/platform-admin-auth.routes';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.WEB_URL || 'http://localhost:3001',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Muitas requisições. Tente novamente em instantes.' },
  },
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}
app.use(requestLogger);

// Request context (AsyncLocalStorage para tenant)
app.use(requestContext);

// Audit logging
app.use(auditMiddleware);

// Health checks & metrics (SRE)
app.use(healthRouter);
app.use(metricsRouter);

// API Routes v1
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/auth/2fa', twoFactorRouter);
app.use('/api/v1/auth/password-reset', passwordResetRouter);
app.use('/api/v1/tenants', tenantRouter);
app.use('/api/v1/products', productRouter);
app.use('/api/v1/sales', saleRouter);
app.use('/api/v1/stock', stockRouter);
app.use('/api/v1/financial', financialRouter);
app.use('/api/v1/clients', clientRouter);
app.use('/api/v1/work-orders', workOrderRouter);
app.use('/api/v1/billing', billingRouter);
app.use('/api/v1/billing/jobs', billingJobRouter);
app.use('/api/v1/admin', adminRouter);

// Platform Admin routes (Painel do Dono)
app.use('/api/v1/platform/admin/auth', platformAdminAuthRouter);
app.use('/api/v1/platform/admin/impersonation', impersonationRouter);
app.use('/api/v1/platform/admin/system-parameters', systemParameterRouter);
app.use('/api/v1/platform/admin/feature-flags', featureFlagRouter);
app.use('/api/v1/platform/admin/integrations', integrationCredentialRouter);
app.use('/api/v1/platform/admin/helpdesk', helpdeskRouter);
app.use('/api/v1/platform/admin/api-keys', apiKeyRouter);
app.use('/api/v1/platform/admin/tenant-webhooks', tenantWebhookRouter);
app.use('/api/v1/platform/admin/official-document-layouts', officialDocumentLayoutRouter);
app.use('/api/v1/platform/admin/fiscal-code-catalog', fiscalCodeCatalogRouter);

// Webhooks (fora do rate limit e sem auth)
app.use('/webhooks/billing', billingWebhookRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    error: { code: 'NOT_FOUND', message: 'Recurso não encontrado.' },
  });
});

// Global error handler
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`[Filitech ERP] API rodando em http://localhost:${PORT}`);
  logger.info(`[Filitech ERP] Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

export default app;

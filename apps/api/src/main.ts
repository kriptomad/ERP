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
import { fiscalRouter } from './modules/fiscal/fiscal.routes';
import { personalAccountRouter } from './modules/personal/personal-account.routes';
import { personalCategoryRouter } from './modules/personal/personal-category.routes';
import { personalTransactionRouter } from './modules/personal/personal-transaction.routes';
import { personalBudgetRouter } from './modules/personal/personal-budget.routes';
import { personalGoalRouter } from './modules/personal/personal-goal.routes';
import { personalInvestmentRouter } from './modules/personal/personal-investment.routes';
import { personalDebtRouter } from './modules/personal/personal-debt.routes';
import { personalBillRouter } from './modules/personal/personal-bill.routes';
import { personalCarnesLeaoRouter } from './modules/personal/personal-carnes-leao.routes';
import { accountingFirmRouter } from './modules/accounting/accounting-firm.routes';
import { accountingClientRouter } from './modules/accounting/accounting-client.routes';
import { accountingTaskRouter } from './modules/accounting/accounting-task.routes';
import { accountingGeneratorRouter } from './modules/accounting/accounting-generator.routes';
import { accountingHonorariosRouter } from './modules/accounting/accounting-honorarios.routes';
import { accountingEngagementRouter } from './modules/accounting/accounting-engagement.routes';
import { platformAdminTenantRouter } from './modules/admin/platform-admin-tenant.routes';
import { platformAdminPlanRouter } from './modules/admin/platform-admin-plan.routes';
import { platformAdminSubscriptionRouter } from './modules/admin/platform-admin-subscription.routes';
import { platformAdminFeatureFlagRouter } from './modules/admin/platform-admin-feature-flag.routes';
import { platformAdminSystemParameterRouter } from './modules/admin/platform-admin-system-parameter.routes';
import { platformAdminIntegrationCredentialRouter } from './modules/admin/platform-admin-integration-credential.routes';
import { platformAdminHelpdeskRouter } from './modules/admin/platform-admin-helpdesk.routes';
import { platformAdminAuditLogRouter } from './modules/admin/platform-admin-audit-log.routes';
import { platformAdminIncidentRouter } from './modules/admin/platform-admin-incident.routes';
import { platformAdminReleaseRouter } from './modules/admin/platform-admin-release.routes';
import { dreRouter } from './modules/dre/dre.routes';
import { inventoryCountRouter } from './modules/inventory-count/inventory-count.routes';
import { importationRouter } from './modules/importation/importation.routes';
import { lgpdRouter } from './modules/lgpd/lgpd.routes';
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
import { webhookRouter } from './webhooks/webhook.routes';
import { logger } from './logging/structured-logger';

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
app.use('/api/v1/fiscal', fiscalRouter);
app.use('/api/v1/personal/accounts', personalAccountRouter);
app.use('/api/v1/personal/categories', personalCategoryRouter);
app.use('/api/v1/personal/transactions', personalTransactionRouter);
app.use('/api/v1/personal/budgets', personalBudgetRouter);
app.use('/api/v1/personal/goals', personalGoalRouter);
app.use('/api/v1/personal/investments', personalInvestmentRouter);
app.use('/api/v1/personal/debts', personalDebtRouter);
app.use('/api/v1/personal/bills', personalBillRouter);
app.use('/api/v1/personal/carnes-leao', personalCarnesLeaoRouter);
app.use('/api/v1/accounting/firm', accountingFirmRouter);
app.use('/api/v1/accounting/client', accountingClientRouter);
app.use('/api/v1/accounting/tasks', accountingTaskRouter);
app.use('/api/v1/accounting/generators', accountingGeneratorRouter);
app.use('/api/v1/accounting/honorarios', accountingHonorariosRouter);
app.use('/api/v1/accounting/engagements', accountingEngagementRouter);

// Platform Admin routes
app.use('/api/v1/platform/admin/tenants', platformAdminTenantRouter);
app.use('/api/v1/platform/admin/plans', platformAdminPlanRouter);
app.use('/api/v1/platform/admin/subscriptions', platformAdminSubscriptionRouter);
app.use('/api/v1/platform/admin/feature-flags', platformAdminFeatureFlagRouter);
app.use('/api/v1/platform/admin/system-parameters', platformAdminSystemParameterRouter);
app.use('/api/v1/platform/admin/integrations', platformAdminIntegrationCredentialRouter);
app.use('/api/v1/platform/admin/helpdesk', platformAdminHelpdeskRouter);
app.use('/api/v1/platform/admin/audit-logs', platformAdminAuditLogRouter);
app.use('/api/v1/platform/admin/incidents', platformAdminIncidentRouter);
app.use('/api/v1/platform/admin/releases', platformAdminReleaseRouter);

// DRE & Relatórios
app.use('/api/v1/dre', dreRouter);
app.use('/api/v1/inventory-count', inventoryCountRouter);
app.use('/api/v1/importation', importationRouter);

// LGPD
app.use('/api/v1/lgpd', lgpdRouter);

// Webhooks
app.use('/webhooks', webhookRouter);

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

import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextData {
  tenantId: string | null;
  userId: string | null;
  requestId: string;
}

export const asyncLocalStorage = new AsyncLocalStorage<RequestContextData>();

export function getActiveTenantId(): string | null {
  return asyncLocalStorage.getStore()?.tenantId ?? null;
}

const TENANT_SCOPED_MODELS = [
  'Tenant', 'User', 'Client', 'Supplier', 'Product', 'ProductBatch',
  'ProductSerial', 'ProductVariant', 'Sale', 'SaleItem', 'CashRegister',
  'StockMovement', 'AccountPayable', 'AccountReceivable', 'WorkOrder',
  'WorkOrderItem', 'LoyaltyProgram', 'LoyaltyAccount', 'LoyaltyTransaction',
  'FiscalDocument', 'Recipe', 'RecipeItem', 'ProductionBatch',
  'PurchaseOrder', 'PurchaseOrderItem', 'InventoryCount', 'InventoryCountItem',
  'BankAccount', 'ChartOfAccount', 'CostCenter', 'TaxRule',
  'PrescriptionRecord', 'ReturnableContainerLedger',
];

export function createTenantScopedPrismaClient(prisma: PrismaClient) {
  const extension = prisma.$extends({
    query: {
      $allModels: {
        async $allOperations(params: { model?: string; operation?: string; args?: Record<string, unknown>; query: (args: unknown) => Promise<unknown> }) {
          const { model, operation, args, query } = params;

          if (!model || !operation || !args) {
            return query(args);
          }

          if (!TENANT_SCOPED_MODELS.includes(model)) {
            return query(args);
          }

          const tenantId = getActiveTenantId();
          if (!tenantId) {
            return query(args);
          }

          const mutableArgs = args as Record<string, unknown>;

          if (['create', 'createMany', 'upsert'].includes(operation)) {
            if (mutableArgs.data) {
              if (Array.isArray(mutableArgs.data)) {
                mutableArgs.data = (mutableArgs.data as Record<string, unknown>[]).map((item) => ({
                  ...item,
                  tenantId,
                }));
              } else if (typeof mutableArgs.data === 'object') {
                mutableArgs.data = { ...(mutableArgs.data as Record<string, unknown>), tenantId };
              }
            }
          }

          if (['findUnique', 'findFirst', 'update', 'updateMany', 'delete', 'deleteMany'].includes(operation)) {
            if (!mutableArgs.where || typeof mutableArgs.where !== 'object') {
              mutableArgs.where = {};
            }
            if (mutableArgs.where && typeof mutableArgs.where === 'object' && !('tenantId' in mutableArgs.where)) {
              mutableArgs.where = { ...(mutableArgs.where as Record<string, unknown>), tenantId };
            }
          }

          if (['findMany', 'count', 'aggregate', 'groupBy'].includes(operation)) {
            if (!mutableArgs.where || typeof mutableArgs.where !== 'object') {
              mutableArgs.where = {};
            }
            if (mutableArgs.where && typeof mutableArgs.where === 'object' && !('tenantId' in mutableArgs.where)) {
              mutableArgs.where = { ...(mutableArgs.where as Record<string, unknown>), tenantId };
            }
          }

          return query(mutableArgs);
        },
      },
    },
  });

  return extension as PrismaClient;
}

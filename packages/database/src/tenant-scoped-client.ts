import { PrismaClient } from "@prisma/client";
import { getActiveTenantId, tryGetActiveTenantId } from "./tenant-context";

export const TENANT_SCOPED_MODELS = [
  "user",
  "tenantModule",
  "subscription",
  "client",
  "supplier",
  "product",
  "sale",
  "cashRegister",
  "workOrder",
  "stockMovement",
  "loyaltyProgram",
  "loyaltyAccount",
  "personalAccount",
  "personalCategory",
  "personalTransaction",
] as const;

type ScopedModel = (typeof TENANT_SCOPED_MODELS)[number];

function isScoped(model: string): model is ScopedModel {
  return (TENANT_SCOPED_MODELS as readonly string[]).includes(model);
}

export function createTenantScopedPrisma(base: PrismaClient = new PrismaClient()) {
  return base.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (isScoped(model)) {
            args.where = { ...args.where, tenantId: getActiveTenantId() };
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (isScoped(model)) {
            args.where = { ...args.where, tenantId: getActiveTenantId() };
          }
          return query(args);
        },
        async findUnique({ model, args, query }) {
          const result = await query(args);
          if (isScoped(model) && result && "tenantId" in (result as object)) {
            const tenantId = tryGetActiveTenantId();
            if (tenantId && (result as { tenantId: string }).tenantId !== tenantId) {
              return null;
            }
          }
          return result;
        },
        async create({ model, args, query }) {
          if (isScoped(model)) {
            args.data = { ...args.data, tenantId: getActiveTenantId() };
          }
          return query(args);
        },
        async update({ model, args, query }) {
          if (isScoped(model)) {
            args.where = { ...args.where, tenantId: getActiveTenantId() };
          }
          return query(args);
        },
        async delete({ model, args, query }) {
          if (isScoped(model)) {
            args.where = { ...args.where, tenantId: getActiveTenantId() };
          }
          return query(args);
        },
        async updateMany({ model, args, query }) {
          if (isScoped(model)) {
            args.where = { ...args.where, tenantId: getActiveTenantId() };
          }
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (isScoped(model)) {
            args.where = { ...args.where, tenantId: getActiveTenantId() };
          }
          return query(args);
        },
        async count({ model, args, query }) {
          if (isScoped(model)) {
            args.where = { ...args.where, tenantId: getActiveTenantId() };
          }
          return query(args);
        },
      },
    },
  });
}

export type TenantScopedPrisma = ReturnType<typeof createTenantScopedPrisma>;

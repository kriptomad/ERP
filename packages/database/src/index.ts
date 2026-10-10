import { PrismaClient } from "@prisma/client";
import { createTenantScopedPrisma } from "./tenant-scoped-client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaScoped: ReturnType<typeof createTenantScopedPrisma> | undefined;
};

export const prismaUnscoped =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

export const prisma =
  globalForPrisma.prismaScoped ?? createTenantScopedPrisma(prismaUnscoped);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaUnscoped;
  globalForPrisma.prismaScoped = prisma;
}

export * from "@prisma/client";
export {
  runWithTenantContext,
  getActiveTenantId,
  tryGetActiveTenantId,
  getActiveUserId,
} from "./tenant-context";
export { TENANT_SCOPED_MODELS, createTenantScopedPrisma } from "./tenant-scoped-client";
export { prismaUnscoped as default };

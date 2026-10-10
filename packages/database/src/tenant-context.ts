import { AsyncLocalStorage } from "async_hooks";

export type TenantContextStore = {
  tenantId: string;
  userId?: string;
  role?: string;
};

const tenantAls = new AsyncLocalStorage<TenantContextStore>();

export function runWithTenantContext<T>(store: TenantContextStore, fn: () => T): T {
  return tenantAls.run(store, fn);
}

export function getActiveTenantId(): string {
  const store = tenantAls.getStore();
  if (!store?.tenantId) {
    throw new Error("TENANT_CONTEXT_MISSING");
  }
  return store.tenantId;
}

export function tryGetActiveTenantId(): string | null {
  return tenantAls.getStore()?.tenantId ?? null;
}

export function getActiveUserId(): string | null {
  return tenantAls.getStore()?.userId ?? null;
}

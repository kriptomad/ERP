import { prismaUnscoped } from "@filitech/database";
import { MODULE_CATALOG } from "@filitech/shared";

export async function activateModuleForTenant(params: {
  tenantId: string;
  moduleCode: string;
}) {
  const catalog = MODULE_CATALOG[params.moduleCode as keyof typeof MODULE_CATALOG];
  if (!catalog) throw new Error("UNKNOWN_MODULE");

  const mod = await prismaUnscoped.module.findUnique({
    where: { code: params.moduleCode },
  });
  if (!mod?.active) throw new Error("MODULE_NOT_IN_CATALOG");

  return prismaUnscoped.tenantModule.upsert({
    where: {
      tenantId_moduleCode: {
        tenantId: params.tenantId,
        moduleCode: params.moduleCode,
      },
    },
    create: {
      tenantId: params.tenantId,
      moduleCode: params.moduleCode,
      active: true,
    },
    update: { active: true, deactivatedAt: null, activatedAt: new Date() },
  });
}

import { prisma } from '../../infra/prisma';

export const tenantService = {
  async findById(id: string) {
    return prisma.tenant.findUnique({
      where: { id },
      include: {
        subscriptions: true,
        tenantModules: { include: { module: true } },
      },
    });
  },

  async findBySlug(slug: string) {
    return prisma.tenant.findUnique({
      where: { slug },
    });
  },

  async checkUserAccess(tenantId: string, userId: string): Promise<boolean> {
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    return !!user;
  },

  async activateModule(tenantId: string, moduleCode: string) {
    return prisma.tenantModule.upsert({
      where: { tenantId_moduleCode: { tenantId, moduleCode } },
      create: { tenantId, moduleCode, active: true },
      update: { active: true, activatedAt: new Date(), deactivatedAt: null },
    });
  },

  async deactivateModule(tenantId: string, moduleCode: string) {
    return prisma.tenantModule.update({
      where: { tenantId_moduleCode: { tenantId, moduleCode } },
      data: { active: false, deactivatedAt: new Date() },
    });
  },

  async listModules(tenantId: string) {
    return prisma.tenantModule.findMany({
      where: { tenantId },
      include: { module: true },
    });
  },
};

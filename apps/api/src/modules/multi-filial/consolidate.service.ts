import { prismaUnscoped } from "@filitech/database";

/** Cap. 2 MULTI_FILIAL — consolidado parent + filhos */
export async function getConsolidatedSales(params: {
  parentTenantId: string;
  from: Date;
  to: Date;
}) {
  const children = await prismaUnscoped.tenant.findMany({
    where: { parentTenantId: params.parentTenantId },
    select: { id: true, tradeName: true, slug: true },
  });
  const tenantIds = [params.parentTenantId, ...children.map((c) => c.id)];

  const sales = await prismaUnscoped.sale.groupBy({
    by: ["tenantId"],
    where: {
      tenantId: { in: tenantIds },
      createdAt: { gte: params.from, lte: params.to },
      status: "COMPLETED",
    },
    _sum: { totalAmount: true },
    _count: true,
  });

  const byTenant = sales.map((s) => ({
    tenantId: s.tenantId,
    tradeName:
      children.find((c) => c.id === s.tenantId)?.tradeName ??
      (s.tenantId === params.parentTenantId ? "MATRIZ" : s.tenantId),
    salesCount: s._count,
    totalAmount: Number(s._sum.totalAmount ?? 0),
  }));

  return {
    from: params.from,
    to: params.to,
    branches: byTenant,
    grandTotal: byTenant.reduce((a, b) => a + b.totalAmount, 0),
  };
}

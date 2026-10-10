import { prismaUnscoped } from "@filitech/database";

/** Cap. 21.18 — tarefas por competência a partir de taxRegime + scopes */

const MONTHLY_BY_SCOPE: Record<string, string[]> = {
  FULL_BOOKKEEPING: ["ECD_PREP", "BANK_RECON"],
  TAX_FILING: ["DAS", "DCTFWEB", "EFD_REINF", "DEFIS"],
  PAYROLL_ESOCIAL: ["ESOCIAL_FOLHA", "FGTS"],
  PERSONAL_INCOME_TAX: ["CARNE_LEAO_CHECK", "DIRPF_PREP"],
};

export async function generateMonthlyAccountingTasks(params: {
  engagementId: string;
  competence: string; // YYYY-MM
}) {
  const eng = await prismaUnscoped.accountingEngagement.findUniqueOrThrow({
    where: { id: params.engagementId },
  });
  if (eng.status !== "ACTIVE") throw new Error("ENGAGEMENT_NOT_ACTIVE");

  const codes = new Set<string>();
  for (const scope of eng.scopes) {
    for (const c of MONTHLY_BY_SCOPE[scope] ?? []) codes.add(c);
  }

  const created = [];
  for (const code of codes) {
    const task = await prismaUnscoped.accountingTask.create({
      data: {
        tenantId: eng.accountingFirmTenantId,
        engagementId: eng.id,
        code,
        competence: params.competence,
        status: "PENDING",
        dueAt: new Date(`${params.competence}-15T12:00:00Z`),
      },
    });
    created.push(task);
  }
  return created;
}

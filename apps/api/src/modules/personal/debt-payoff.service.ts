import { Prisma } from "@prisma/client";

/** Cap. 22.7 — Avalanche vs Snowball */

export type DebtInput = {
  id: string;
  name: string;
  remainingAmount: number;
  interestRateMonthly: number;
  minimumInstallment: number;
};

export type PayoffPlanMonth = {
  month: number;
  allocations: { debtId: string; paid: number; remainingAfter: number }[];
};

export function calculateDebtPayoffPlan(
  debts: DebtInput[],
  extraMonthlyBudget: number,
  strategy: "AVALANCHE" | "SNOWBALL",
): PayoffPlanMonth[] {
  const sorted = [...debts].sort((a, b) =>
    strategy === "AVALANCHE"
      ? b.interestRateMonthly - a.interestRateMonthly
      : a.remainingAmount - b.remainingAmount,
  );

  let working = sorted.map((d) => ({ ...d }));
  const plan: PayoffPlanMonth[] = [];
  let month = 0;
  const MAX = 600;

  while (working.some((d) => d.remainingAmount > 0) && month < MAX) {
    month++;
    let free = extraMonthlyBudget;
    const allocations: PayoffPlanMonth["allocations"] = [];

    for (const debt of working) {
      if (debt.remainingAmount <= 0) continue;
      const interest = (debt.remainingAmount * debt.interestRateMonthly) / 100;
      debt.remainingAmount += interest;
      const minPay = Math.min(debt.minimumInstallment, debt.remainingAmount);
      debt.remainingAmount -= minPay;
      allocations.push({
        debtId: debt.id,
        paid: minPay,
        remainingAfter: debt.remainingAmount,
      });
    }

    for (const debt of working) {
      if (debt.remainingAmount <= 0 || free <= 0) continue;
      const extra = Math.min(free, debt.remainingAmount);
      debt.remainingAmount -= extra;
      free -= extra;
      const existing = allocations.find((a) => a.debtId === debt.id)!;
      existing.paid += extra;
      existing.remainingAfter = debt.remainingAmount;
      break;
    }

    plan.push({ month, allocations });
  }

  return plan;
}

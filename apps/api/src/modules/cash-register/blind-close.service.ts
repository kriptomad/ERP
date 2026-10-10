import { prisma } from "@filitech/database";

/** Gaveta cega — expectedTotal só após contagem física */
export async function closeCashRegisterBlind(params: {
  cashRegisterId: string;
  countedCash: number;
  countedDebit: number;
  countedCredit: number;
  countedPix: number;
}) {
  const register = await prisma.cashRegister.findFirst({
    where: { id: params.cashRegisterId, status: "OPEN" },
    include: { sales: true },
  });
  if (!register) throw new Error("CASH_REGISTER_NOT_OPEN");

  const expected = register.sales.reduce(
    (sum, s) => sum + Number(s.totalAmount),
    Number(register.openingFloat),
  );
  const counted =
    params.countedCash +
    params.countedDebit +
    params.countedCredit +
    params.countedPix;

  return prisma.cashRegister.update({
    where: { id: register.id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      countedCash: params.countedCash,
      countedDebit: params.countedDebit,
      countedCredit: params.countedCredit,
      countedPix: params.countedPix,
      expectedTotal: expected,
      difference: counted - expected,
      blindCountDone: true,
    },
  });
}

export async function getOpenRegisterPublic(id: string) {
  const r = await prisma.cashRegister.findFirst({ where: { id, status: "OPEN" } });
  if (!r) return null;
  return { id: r.id, status: r.status, openingFloat: r.openingFloat, openedAt: r.openedAt };
}

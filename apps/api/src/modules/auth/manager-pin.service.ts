import { prismaUnscoped } from "@filitech/database";
import { hashPassword, verifyPassword } from "../../auth/password.service";

/** Cap. 8 — aprovação gerente via PIN (não senha da conta) */

export async function setManagerPin(userId: string, pin: string) {
  if (!/^\d{4,6}$/.test(pin)) throw new Error("PIN_MUST_BE_4_TO_6_DIGITS");
  await prismaUnscoped.user.update({
    where: { id: userId },
    data: { managerPinHash: await hashPassword(pin) },
  });
}

export async function verifyManagerPin(
  tenantId: string,
  pin: string,
): Promise<{ userId: string; name: string } | null> {
  const managers = await prismaUnscoped.user.findMany({
    where: {
      tenantId,
      active: true,
      role: { in: ["OWNER", "MANAGER"] },
      managerPinHash: { not: null },
    },
  });
  for (const m of managers) {
    if (m.managerPinHash && (await verifyPassword(m.managerPinHash, pin))) {
      return { userId: m.id, name: m.name };
    }
  }
  return null;
}

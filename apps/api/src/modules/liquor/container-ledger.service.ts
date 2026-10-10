/**
 * Cap. 4 Adega — casco é patrimônio da distribuidora.
 * Ledger separado da conta financeira do cliente.
 */

export type ContainerBalance = {
  clientId: string;
  productId: string;
  quantityHeld: number; // cascos em posse do cliente
  depositUnitValue: number;
};

export function applyContainerMovement(
  balance: ContainerBalance,
  delta: number, // + entrega casco cheio / - retorno vazio
): ContainerBalance {
  const next = balance.quantityHeld + delta;
  if (next < 0) throw new Error("CONTAINER_NEGATIVE_BALANCE");
  return { ...balance, quantityHeld: next };
}

/** Cobrança de reposição quando casco não retorna */
export function computeReplacementCharge(
  balance: ContainerBalance,
  unreturnedQty: number,
): { amount: number; quantity: number } {
  if (unreturnedQty > balance.quantityHeld) {
    throw new Error("UNRETURNED_EXCEEDS_HELD");
  }
  return {
    quantity: unreturnedQty,
    amount: unreturnedQty * balance.depositUnitValue,
  };
}

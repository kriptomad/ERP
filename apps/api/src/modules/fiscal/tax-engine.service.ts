/**
 * Cap. 21 — TaxEngine simplificado Simples Nacional (Anexo I comércio referência).
 * Tabela efetiva deve ser versionada em TaxRule no schema completo.
 */

export type TaxBreakdown = {
  regime: string;
  baseCalculo: number;
  aliquotaEfetiva: number;
  valorImposto: number;
  cbs?: number;
  ibs?: number;
};

/** Faixas simplificadas RBT12 → alíquota nominal Anexo I (exemplo operacional) */
const SIMPLES_ANEXO_I = [
  { ate: 180_000, aliq: 0.04, deduz: 0 },
  { ate: 360_000, aliq: 0.073, deduz: 5940 },
  { ate: 720_000, aliq: 0.095, deduz: 13860 },
  { ate: 1_800_000, aliq: 0.107, deduz: 22500 },
  { ate: 3_600_000, aliq: 0.143, deduz: 87300 },
  { ate: 4_800_000, aliq: 0.19, deduz: 378000 },
] as const;

export function calculateSimplesAnexoI(
  rbt12: number,
  saleAmount: number,
): TaxBreakdown {
  const faixa =
    SIMPLES_ANEXO_I.find((f) => rbt12 <= f.ate) ??
    SIMPLES_ANEXO_I[SIMPLES_ANEXO_I.length - 1];
  const aliquotaEfetiva =
    rbt12 > 0 ? Math.max(0, (rbt12 * faixa.aliq - faixa.deduz) / rbt12) : faixa.aliq;
  const valorImposto = saleAmount * aliquotaEfetiva;
  return {
    regime: "SIMPLES_NACIONAL_ANEXO_I",
    baseCalculo: saleAmount,
    aliquotaEfetiva: Number(aliquotaEfetiva.toFixed(6)),
    valorImposto: Number(valorImposto.toFixed(2)),
  };
}

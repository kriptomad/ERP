/** Cap. 22.11 — sugestão Carnê-Leão (tabela IRPF mensal 2025) — NÃO é declaração oficial */

const FAIXAS_2025 = [
  { ate: 2259.2, aliquota: 0, deducao: 0 },
  { ate: 2826.65, aliquota: 0.075, deducao: 169.44 },
  { ate: 3751.05, aliquota: 0.15, deducao: 381.44 },
  { ate: 4664.68, aliquota: 0.225, deducao: 662.77 },
  { ate: Infinity, aliquota: 0.275, deducao: 896 },
] as const;

export function calculateCarneLeaoSuggestion(rendimentoTributavel: number) {
  const faixa = FAIXAS_2025.find((f) => rendimentoTributavel <= f.ate)!;
  const impostoSugerido = Math.max(
    0,
    rendimentoTributavel * faixa.aliquota - faixa.deducao,
  );
  return {
    rendimentoTributavel,
    aliquotaAplicada: faixa.aliquota,
    impostoSugerido: Number(impostoSugerido.toFixed(2)),
    codigoDarf: "0190",
    disclaimer:
      "Valor sugestivo pela tabela progressiva mensal do IRPF — a apuração oficial e o envio da DARF devem ser feitos no app Carnê-Leão da Receita Federal.",
  };
}

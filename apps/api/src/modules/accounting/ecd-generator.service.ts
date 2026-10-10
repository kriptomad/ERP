/**
 * Cap. 21 — ECD skeleton (SPED Contábil).
 * Layout versionado; não hardcode permanente — usar OfficialDocumentLayoutVersion em prod.
 */

export type EcdJournalLine = {
  date: string; // YYYYMMDD
  accountCode: string;
  description: string;
  debit: number;
  credit: number;
};

export function generateEcdI050Skeleton(params: {
  cnpj: string;
  periodStart: string;
  periodEnd: string;
  lines: EcdJournalLine[];
}): string {
  const rows: string[] = [];
  rows.push(`|0000|LECD|${params.periodStart}|${params.periodEnd}|EMPRESA|${params.cnpj}|0||||`);
  rows.push(`|0001|0|`);
  rows.push(`|I001|0|`);
  rows.push(`|I010|G|8|`); // forma escrituração

  let i = 1;
  for (const line of params.lines) {
    const valor = (line.debit || line.credit).toFixed(2).replace(".", ",");
    const indDc = line.debit > 0 ? "D" : "C";
    rows.push(
      `|I200|${String(i).padStart(6, "0")}|${line.date}|${valor}|N|`,
    );
    rows.push(
      `|I250|${String(i).padStart(6, "0")}|${line.accountCode}||${valor}|${indDc}||${line.description}|`,
    );
    i++;
  }

  rows.push(`|I990|${rows.filter((r) => r.startsWith("|I")).length + 1}|`);
  rows.push(`|9990|${rows.length + 2}|`);
  rows.push(`|9999|${rows.length + 3}|`);
  return rows.join("\n");
}

export function generateEcfSkeleton(params: {
  cnpj: string;
  year: number;
  lucroLiquido: number;
}): string {
  // ECF extremamente reduzido — placeholder estrutural até layout oficial versionado
  return [
    `|0000|${params.year}|${params.cnpj}|0|`,
    `|0010|1|`,
    `|M300|${params.lucroLiquido.toFixed(2).replace(".", ",")}|`,
    `|9999|`,
  ].join("\n");
}

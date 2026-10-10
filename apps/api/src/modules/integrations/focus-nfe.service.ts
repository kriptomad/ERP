/** Cap. 20/21 — Focus NFe como intermediário SEFAZ */

const FOCUS_BASE =
  process.env.FOCUS_NFE_ENV === "production"
    ? "https://api.focusnfe.com.br"
    : "https://homologacao.focusnfe.com.br";

export async function emitNfce(params: {
  ref: string;
  payload: Record<string, unknown>;
}) {
  const token = process.env.FOCUS_NFE_TOKEN;
  if (!token) throw new Error("FOCUS_NFE_TOKEN_MISSING");

  const res = await fetch(`${FOCUS_BASE}/v2/nfce?ref=${encodeURIComponent(params.ref)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(token + ":").toString("base64")}`,
    },
    body: JSON.stringify(params.payload),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(`FOCUS_NFE_ERROR ${res.status}: ${JSON.stringify(body)}`);
  }
  return body as {
    status: string;
    chave_nfe?: string;
    caminho_xml_nota_fiscal?: string;
    caminho_danfe?: string;
  };
}

export async function cancelNfce(params: {
  ref: string;
  justificativa: string;
}) {
  const token = process.env.FOCUS_NFE_TOKEN;
  if (!token) throw new Error("FOCUS_NFE_TOKEN_MISSING");
  const res = await fetch(`${FOCUS_BASE}/v2/nfce/${encodeURIComponent(params.ref)}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(token + ":").toString("base64")}`,
    },
    body: JSON.stringify({ justificativa: params.justificativa }),
  });
  return res.json();
}

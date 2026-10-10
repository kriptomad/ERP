const ASAAS_BASE = process.env.ASAAS_API_URL ?? "https://www.asaas.com/api/v3";

export async function asaasRequest<T>(path: string, body: unknown): Promise<T> {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new Error("ASAAS_API_KEY_MISSING");
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ASAAS_ERROR ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function tokenizeAsaasCard(params: {
  customerId: string;
  creditCard: Record<string, string>;
  creditCardHolderInfo: Record<string, string>;
  remoteIp: string;
}) {
  return asaasRequest<{
    creditCardToken: string;
    creditCardNumber: string;
    creditCardBrand: string;
  }>("/creditCard/tokenize", {
    customer: params.customerId,
    creditCard: params.creditCard,
    creditCardHolderInfo: params.creditCardHolderInfo,
    remoteIp: params.remoteIp,
  });
}

export async function createAsaasSubscription(params: {
  customerId: string;
  value: number;
  nextDueDate: string;
  creditCardToken: string;
  description: string;
}) {
  return asaasRequest<{ id: string }>("/subscriptions", {
    customer: params.customerId,
    billingType: "CREDIT_CARD",
    cycle: "MONTHLY",
    value: params.value,
    nextDueDate: params.nextDueDate,
    creditCardToken: params.creditCardToken,
    description: params.description,
  });
}

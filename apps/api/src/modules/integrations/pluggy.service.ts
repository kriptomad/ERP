/** Cap. 22.5 — Open Finance real via Pluggy (homologado BC) */

const PLUGGY_BASE = "https://api.pluggy.ai";

let cachedApiKey: { value: string; expiresAt: number } | null = null;

export async function getPluggyApiKey(): Promise<string> {
  if (cachedApiKey && cachedApiKey.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedApiKey.value;
  }
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("PLUGGY_CREDENTIALS_MISSING");

  const res = await fetch(`${PLUGGY_BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!res.ok) throw new Error(`PLUGGY_AUTH_FAILED ${res.status}`);
  const data = (await res.json()) as { apiKey: string };
  cachedApiKey = {
    value: data.apiKey,
    expiresAt: Date.now() + 2 * 60 * 60 * 1000,
  };
  return data.apiKey;
}

export async function createConnectToken(tenantId: string): Promise<string> {
  const apiKey = await getPluggyApiKey();
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${PLUGGY_BASE}/connect_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
    body: JSON.stringify({
      options: {
        clientUserId: tenantId,
        webhookUrl: `${appUrl}/api/v1/webhooks/pluggy`,
        avoidDuplicates: true,
      },
    }),
  });
  if (!res.ok) throw new Error(`PLUGGY_CONNECT_TOKEN_FAILED ${res.status}`);
  const data = (await res.json()) as { accessToken: string };
  return data.accessToken;
}

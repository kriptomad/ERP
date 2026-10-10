/** Cap. 20 — Meta Cloud API WhatsApp */

export async function sendWhatsAppTemplate(params: {
  toPhoneE164: string;
  templateName: string;
  languageCode?: string;
  variables?: string[];
}) {
  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) throw new Error("WHATSAPP_CREDENTIALS_MISSING");

  const components =
    params.variables && params.variables.length
      ? [
          {
            type: "body",
            parameters: params.variables.map((text) => ({ type: "text", text })),
          },
        ]
      : undefined;

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: params.toPhoneE164.replace(/\D/g, ""),
        type: "template",
        template: {
          name: params.templateName,
          language: { code: params.languageCode ?? "pt_BR" },
          components,
        },
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`WHATSAPP_ERROR ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

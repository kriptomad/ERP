import { prisma } from '../../infra/prisma';
import { logger } from '../../logging/structured-logger';

const META_API_URL = 'https://graph.facebook.com/v19.0';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';

interface WhatsAppMessage {
  to: string;
  type: 'text' | 'template' | 'image' | 'document';
  text?: { body: string };
  template?: { name: string; language: { code: string }; components?: any[] };
  image?: { link: string; caption?: string };
  document?: { link: string; filename: string; caption?: string };
}

async function metaFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${META_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Meta API error: ${response.status} - ${JSON.stringify(data)}`);
  }

  return data;
}

export async function sendWhatsAppMessage(message: WhatsAppMessage): Promise<{ messageId: string }> {
  const response = await metaFetch<{ messages: Array<{ id: string }> }>(
    `/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    { method: 'POST', body: JSON.stringify(message) },
  );

  return { messageId: response.messages[0]?.id || '' };
}

export async function sendTextMessage(to: string, body: string): Promise<{ messageId: string }> {
  return sendWhatsAppMessage({ to, type: 'text', text: { body } });
}

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string,
  components?: any[],
): Promise<{ messageId: string }> {
  return sendWhatsAppMessage({
    to,
    type: 'template',
    template: { name: templateName, language: { code: languageCode }, components },
  });
}

export async function sendWorkOrderApproval(
  tenantId: string,
  clientPhone: string,
  workOrderId: string,
  approvalLink: string,
): Promise<void> {
  try {
    await sendTemplateMessage(clientPhone, 'work_order_approval', 'pt_BR', [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: workOrderId },
          { type: 'text', text: approvalLink },
        ],
      },
    ]);
  } catch (err) {
    logger.error('Failed to send WhatsApp approval', { tenantId, workOrderId, error: err });
    throw err;
  }
}

export async function sendPaymentReminder(
  tenantId: string,
  clientPhone: string,
  amount: number,
  dueDate: string,
): Promise<void> {
  await sendTemplateMessage(clientPhone, 'payment_reminder', 'pt_BR', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: `R$ ${amount.toFixed(2).replace('.', ',')}` },
        { type: 'text', text: dueDate },
      ],
    },
  ]);
}

export async function sendLowStockAlert(
  tenantId: string,
  managerPhone: string,
  productName: string,
  currentStock: number,
): Promise<void> {
  await sendTemplateMessage(managerPhone, 'low_stock_alert', 'pt_BR', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: productName },
        { type: 'text', text: currentStock.toString() },
      ],
    },
  ]);
}

export async function handleWhatsAppWebhook(payload: any): Promise<void> {
  const entry = payload.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (value?.messages) {
    for (const message of value.messages) {
      logger.info('WhatsApp message received', { from: message.from, type: message.type });
    }
  }

  if (value?.statuses) {
    for (const status of value.statuses) {
      logger.info('WhatsApp status update', { id: status.id, status: status.status });
    }
  }
}
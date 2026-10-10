/** Cap. 3 — BullMQ queues (requer REDIS_URL em runtime) */

export const QUEUE_NAMES = {
  WHATSAPP: "whatsapp-notifications",
  FISCAL: "fiscal-emission",
  NFE_XML: "nfe-xml-ingestion",
  REPORTS: "report-generation",
  SUSPEND_OVERDUE: "suspend-overdue-tenants",
  PERSONAL_RECURRENCE: "personal-recurrence-processing",
  PERSONAL_BILLS: "personal-bill-alerts",
  NET_WORTH: "personal-net-worth-snapshot",
  OPEN_FINANCE: "personal-open-finance-sync",
  LOYALTY_EXPIRE: "loyalty-points-expiration",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

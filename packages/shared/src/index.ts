// Shared types and utilities for Filitech ERP

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  } | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export enum UserRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  TECHNICIAN = 'TECHNICIAN',
  CASHIER = 'CASHIER',
}

export enum TenantStatus {
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  PIX = 'PIX',
  STORE_CREDIT = 'STORE_CREDIT',
  BOLETO = 'BOLETO',
}

export enum SaleStatus {
  COMPLETED = 'COMPLETED',
  PENDING = 'PENDING',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum WorkOrderStatus {
  RECEIVED = 'RECEIVED',
  DIAGNOSING = 'DIAGNOSING',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  IN_REPAIR = 'IN_REPAIR',
  READY = 'READY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export const MODULE_CATALOG: Record<string, { label: string; monthlyPrice: number }> = {
  FISCAL_NFCE: { label: 'Emissão Fiscal (NFC-e/NFe)', monthlyPrice: 49.9 },
  WHATSAPP_INTEGRATION: { label: 'Integração WhatsApp', monthlyPrice: 39.9 },
  MULTI_FILIAL: { label: 'Multi-Filial', monthlyPrice: 59.9 },
  WORK_ORDER: { label: 'Assistência Técnica (O.S.)', monthlyPrice: 69.9 },
  LIQUOR_LEDGER: { label: 'Adega — Conta-Corrente de Cascos', monthlyPrice: 29.9 },
  RECIPE_BOM: { label: 'Ficha Técnica (Padaria/Confeitaria)', monthlyPrice: 44.9 },
  PHARMACY_SNGPC: { label: 'Farmácia — SNGPC/Controlados', monthlyPrice: 79.9 },
};

export const NICHES = [
  { name: 'Mercado', color: '#6366F1' },
  { name: 'Assistência Técnica', color: '#06B6D4' },
  { name: 'Adega', color: '#A855F7' },
  { name: 'Padaria', color: '#F59E0B' },
  { name: 'Farmácia', color: '#10B981' },
  { name: 'Varejo Geral', color: '#F43F5E' },
] as const;

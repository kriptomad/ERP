const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '';

interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
  mobilePhone?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  postalCode?: string;
}

interface AsaasSubscription {
  id: string;
  customer: string;
  billingType: 'CREDIT_CARD' | 'BOLETO' | 'PIX';
  cycle: 'MONTHLY' | 'WEEKLY' | 'BIWEEKLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY';
  value: number;
  nextDueDate: string;
  creditCardToken?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'OVERDUE';
  description?: string;
}

export async function createAsaasCustomer(data: Omit<AsaasCustomer, 'id'>): Promise<AsaasCustomer> {
  const response = await fetch(`${ASAAS_API_URL}/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Asaas erro: ${JSON.stringify(error)}`);
  }

  return response.json();
}

export async function tokenizeAsaasCreditCard(params: {
  customerId: string;
  creditCard: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone: string;
  };
  remoteIp: string;
}): Promise<{ creditCardToken: string; creditCardNumber: string; creditCardBrand: string }> {
  const response = await fetch(`${ASAAS_API_URL}/creditCard/tokenize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Asaas tokenização erro: ${JSON.stringify(error)}`);
  }

  return response.json();
}

export async function createAsaasSubscription(params: {
  customerId: string;
  billingType: 'CREDIT_CARD' | 'BOLETO' | 'PIX';
  cycle: string;
  value: number;
  nextDueDate: string;
  creditCardToken?: string;
  description?: string;
}): Promise<AsaasSubscription> {
  const response = await fetch(`${ASAAS_API_URL}/subscriptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    },
    body: JSON.stringify({
      customer: params.customerId,
      billingType: params.billingType,
      cycle: params.cycle,
      value: params.value,
      nextDueDate: params.nextDueDate,
      ...(params.creditCardToken && { creditCardToken: params.creditCardToken }),
      ...(params.description && { description: params.description }),
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Asaas assinatura erro: ${JSON.stringify(error)}`);
  }

  return response.json();
}

export async function cancelAsaasSubscription(subscriptionId: string): Promise<void> {
  const response = await fetch(`${ASAAS_API_URL}/subscriptions/${subscriptionId}`, {
    method: 'DELETE',
    headers: {
      'access_token': ASAAS_API_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Asaas cancelamento erro: ${JSON.stringify(error)}`);
  }
}

export async function getAsaasSubscription(subscriptionId: string): Promise<AsaasSubscription> {
  const response = await fetch(`${ASAAS_API_URL}/subscriptions/${subscriptionId}`, {
    headers: {
      'access_token': ASAAS_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error('Erro ao buscar assinatura Asaas');
  }

  return response.json();
}

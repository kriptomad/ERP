import { logger } from '../../logging/structured-logger';
import { prisma } from '../../infra/prisma';

const FOCUS_NFE_API_URL = process.env.FOCUS_NFE_API_URL || 'https://api.focusnfe.com.br/v2';
const FOCUS_NFE_API_KEY = process.env.FOCUS_NFE_API_KEY || '';

export interface FocusNFeEmitRequest {
  cnpj_emitente: string;
  natureza_operacao: string;
  modelo: '55' | '65';
  serie: number;
  numero: number;
  data_emissao: string;
  data_entrada_saida: string;
  tipo_operacao: '0' | '1';
  finalidade_emissao: '1' | '2' | '3' | '4';
  consumidor_final: '0' | '1';
  presenca_comprador: '0' | '1' | '2' | '3' | '4' | '5' | '9';
  destinatario: {
    cpf?: string;
    cnpj?: string;
    nome: string;
    endereco: string;
    numero: string;
    complemento?: string;
    bairro: string;
    codigo_municipio: number;
    uf: string;
    cep: string;
    telefone?: string;
    email?: string;
    indicador_ie: '1' | '2' | '9';
    inscricao_estadual?: string;
  };
  itens: Array<{
    numero_item: number;
    codigo_produto: string;
    descricao: string;
    ncm: string;
    cest?: string;
    cfop: string;
    unidade_comercial: string;
    quantidade_comercial: number;
    valor_unitario_comercial: number;
    unidade_tributavel: string;
    quantidade_tributavel: number;
    valor_unitario_tributavel: number;
    valor_bruto: number;
    valor_desconto?: number;
    valor_frete?: number;
    valor_seguro?: number;
    valor_outras_despesas?: number;
    origem: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
    icms: {
      cst: string;
      valor_bc?: number;
      aliquota?: number;
      valor_icms?: number;
      modalidade_bc?: string;
      valor_bc_st?: number;
      aliquota_st?: number;
      valor_icms_st?: number;
      percentual_reducao_bc?: number;
      percentual_reducao_bc_st?: number;
    };
    ipi?: {
      cst: string;
      valor_bc?: number;
      aliquota?: number;
      valor_ipi?: number;
    };
    pis?: {
      cst: string;
      valor_bc?: number;
      aliquota?: number;
      valor_pis?: number;
    };
    cofins?: {
      cst: string;
      valor_bc?: number;
      aliquota?: number;
      valor_cofins?: number;
    };
  }>;
  transporte?: {
    modalidade_frete: '0' | '1' | '2' | '3' | '4' | '9';
    transportadora?: {
      cnpj?: string;
      cpf?: string;
      nome?: string;
      ie?: string;
      endereco?: string;
      uf?: string;
      cidade?: string;
    };
    volumes?: Array<{
      quantidade: number;
      especie: string;
      marca?: string;
      numero?: string;
      peso_liquido: number;
      peso_bruto: number;
    }>;
  };
  pagamento?: {
    forma_pagamento: '01' | '02' | '03' | '04' | '05' | '10' | '11' | '12' | '13' | '14' | '15' | '16' | '17' | '99';
    valor: number;
    parcelas?: Array<{
      numero: number;
      valor: number;
      vencimento: string;
    }>;
  };
  informacoes_adicionais?: {
    fisco?: string;
    complementares?: string;
  };
}

interface FocusNFeResponse {
  status: string;
  mensagem?: string;
  erro?: string;
  chaves?: string[];
  arquivo?: string;
  pdf?: string;
  qrcode?: string;
}

async function focusNFeFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${FOCUS_NFE_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FOCUS_NFE_API_KEY}`,
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Focus NFe error: ${response.status} - ${JSON.stringify(data)}`);
  }

  return data;
}

export async function emitNFCe(
  tenantId: string,
  data: FocusNFeEmitRequest,
): Promise<{ key: string; xml: string; pdf: string; qrcode: string }> {
  const response = await focusNFeFetch<FocusNFeResponse>('/nfce', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  await prisma.fiscalDocument.create({
    data: {
      tenantId,
      type: 'NFC_E',
      number: data.numero.toString(),
      series: data.serie.toString(),
      key: response.chaves?.[0],
      status: 'AUTHORIZED',
      xmlContent: response.arquivo,
      danfeUrl: response.pdf,
      qrCodeUrl: response.qrcode,
      issuedAt: new Date(),
    },
  });

  await prisma.fiscalDocumentEvent.create({
    data: {
      tenantId,
      fiscalDocumentId: (await prisma.fiscalDocument.findFirst({
        where: { tenantId, key: response.chaves?.[0] },
        select: { id: true },
      }))?.id || '',
      eventType: 'AUTHORIZATION',
      eventNumber: response.chaves?.[0],
      registeredAt: new Date(),
    },
  });

  logger.info('NFC-e emitted', { tenantId, key: response.chaves?.[0] });

  return {
    key: response.chaves?.[0] || '',
    xml: response.arquivo || '',
    pdf: response.pdf || '',
    qrcode: response.qrcode || '',
  };
}

export async function emitNFe(
  tenantId: string,
  data: FocusNFeEmitRequest,
): Promise<{ key: string; xml: string; pdf: string }> {
  const response = await focusNFeFetch<FocusNFeResponse>('/nfe', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  await prisma.fiscalDocument.create({
    data: {
      tenantId,
      type: 'NFE',
      number: data.numero.toString(),
      series: data.serie.toString(),
      key: response.chaves?.[0],
      status: 'AUTHORIZED',
      xmlContent: response.arquivo,
      danfeUrl: response.pdf,
      issuedAt: new Date(),
    },
  });

  return {
    key: response.chaves?.[0] || '',
    xml: response.arquivo || '',
    pdf: response.pdf || '',
  };
}

export async function cancelFiscalDocument(
  tenantId: string,
  key: string,
  justification: string,
): Promise<void> {
  await focusNFeFetch(`/nfce/${key}/cancelamento`, {
    method: 'POST',
    body: JSON.stringify({ justificativa: justification }),
  });

  await prisma.fiscalDocument.update({
    where: { tenantId_key: { tenantId, key } },
    data: { status: 'CANCELLED' },
  });

  await prisma.fiscalDocumentEvent.create({
    data: {
      tenantId,
      fiscalDocumentId: (await prisma.fiscalDocument.findFirst({
        where: { tenantId, key },
        select: { id: true },
      }))?.id || '',
      eventType: 'CANCELLATION',
      justification,
      registeredAt: new Date(),
    },
  });
}

export async function sendCorrectionLetter(
  tenantId: string,
  key: string,
  correction: string,
): Promise<void> {
  await focusNFeFetch(`/nfce/${key}/carta_correcao`, {
    method: 'POST',
    body: JSON.stringify({ texto: correction }),
  });

  await prisma.fiscalDocumentEvent.create({
    data: {
      tenantId,
      fiscalDocumentId: (await prisma.fiscalDocument.findFirst({
        where: { tenantId, key },
        select: { id: true },
      }))?.id || '',
      eventType: 'CORRECTION_LETTER',
      eventNumber: key,
      justification: correction,
      registeredAt: new Date(),
    },
  });
}

export async function queryNFeStatus(key: string): Promise<FocusNFeResponse> {
  return focusNFeFetch(`/nfce/${key}`);
}

export async function downloadXml(key: string): Promise<string> {
  const response = await fetch(`${FOCUS_NFE_API_URL}/nfce/${key}/xml`, {
    headers: { 'Authorization': `Bearer ${FOCUS_NFE_API_KEY}` },
  });
  return response.text();
}

export async function downloadPdf(key: string): Promise<Buffer> {
  const response = await fetch(`${FOCUS_NFE_API_URL}/nfce/${key}/pdf`, {
    headers: { 'Authorization': `Bearer ${FOCUS_NFE_API_KEY}` },
  });
  return Buffer.from(await response.arrayBuffer());
}
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireModule } from '../../middlewares/module-gating.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';
import { emitNFCe, emitNFe, cancelFiscalDocument, sendCorrectionLetter, queryNFeStatus, downloadXml, downloadPdf } from './focus-nfe.service';

export const fiscalRouter = Router();

fiscalRouter.use(authenticate);

fiscalRouter.post('/nfce', requireModule('FISCAL_NFCE'), async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = z.object({
      natureza_operacao: z.string().min(1),
      modelo: z.literal('65'),
      serie: z.number().int(),
      numero: z.number().int(),
      data_emissao: z.string().datetime(),
      data_entrada_saida: z.string().datetime(),
      tipo_operacao: z.enum(['0', '1']),
      finalidade_emissao: z.enum(['1', '2', '3', '4']),
      consumidor_final: z.enum(['0', '1']),
      presenca_comprador: z.enum(['0', '1', '2', '3', '4', '5', '9']),
      destinatario: z.object({
        cpf: z.string().optional(),
        cnpj: z.string().optional(),
        nome: z.string().min(1),
        endereco: z.string().min(1),
        numero: z.string().min(1),
        complemento: z.string().optional(),
        bairro: z.string().min(1),
        codigo_municipio: z.number().int(),
        uf: z.string().length(2),
        cep: z.string(),
        telefone: z.string().optional(),
        email: z.string().email().optional(),
        indicador_ie: z.enum(['1', '2', '9']),
        inscricao_estadual: z.string().optional(),
      }),
      itens: z.array(z.object({
        numero_item: z.number().int(),
        codigo_produto: z.string(),
        descricao: z.string(),
        ncm: z.string().length(8),
        cest: z.string().optional(),
        cfop: z.string().length(4),
        unidade_comercial: z.string(),
        quantidade_comercial: z.number().positive(),
        valor_unitario_comercial: z.number().positive(),
        unidade_tributavel: z.string(),
        quantidade_tributavel: z.number().positive(),
        valor_unitario_tributavel: z.number().positive(),
        valor_bruto: z.number().positive(),
        valor_desconto: z.number().min(0).optional(),
        valor_frete: z.number().min(0).optional(),
        valor_seguro: z.number().min(0).optional(),
        valor_outras_despesas: z.number().min(0).optional(),
        origem: z.enum(['0','1','2','3','4','5','6','7','8']),
        icms: z.object({
          cst: z.string(),
          valor_bc: z.number().optional(),
          aliquota: z.number().optional(),
          valor_icms: z.number().optional(),
          modalidade_bc: z.string().optional(),
          valor_bc_st: z.number().optional(),
          aliquota_st: z.number().optional(),
          valor_icms_st: z.number().optional(),
          percentual_reducao_bc: z.number().optional(),
          percentual_reducao_bc_st: z.number().optional(),
        }),
        ipi: z.object({ cst: z.string(), valor_bc: z.number().optional(), aliquota: z.number().optional(), valor_ipi: z.number().optional() }).optional(),
        pis: z.object({ cst: z.string(), valor_bc: z.number().optional(), aliquota: z.number().optional(), valor_pis: z.number().optional() }).optional(),
        cofins: z.object({ cst: z.string(), valor_bc: z.number().optional(), aliquota: z.number().optional(), valor_cofins: z.number().optional() }).optional(),
      })).min(1),
      transporte: z.object({
        modalidade_frete: z.enum(['0','1','2','3','4','9']),
        transportadora: z.object({ cnpj: z.string().optional(), cpf: z.string().optional(), nome: z.string().optional(), ie: z.string().optional(), endereco: z.string().optional(), uf: z.string().optional(), cidade: z.string().optional() }).optional(),
        volumes: z.array(z.object({ quantidade: z.number().int(), especie: z.string(), marca: z.string().optional(), numero: z.string().optional(), peso_liquido: z.number().positive(), peso_bruto: z.number().positive() })).optional(),
      }).optional(),
      pagamento: z.object({
        forma_pagamento: z.enum(['01','02','03','04','05','10','11','12','13','14','15','16','17','99']),
        valor: z.number().positive(),
        parcelas: z.array(z.object({ numero: z.number().int(), valor: z.number().positive(), vencimento: z.string().datetime() })).optional(),
      }).optional(),
      informacoes_adicionais: z.object({ fisco: z.string().optional(), complementares: z.string().optional() }).optional(),
      cnpj_emitente: z.string().optional(),
    }).parse(req.body);

    const result = await emitNFCe(tenantId!, { ...data, cnpj_emitente: data.cnpj_emitente ?? '' });
    res.status(201).json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
});

fiscalRouter.post('/nfe', requireModule('FISCAL_NFCE'), async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const data = z.object({
      // similar to NFC-e but modelo: '55'
      modelo: z.literal('55'),
      natureza_operacao: z.string().min(1),
      serie: z.number().int(),
      numero: z.number().int(),
      data_emissao: z.string().datetime(),
      data_entrada_saida: z.string().datetime(),
      tipo_operacao: z.enum(['0', '1']),
      finalidade_emissao: z.enum(['1', '2', '3', '4']),
      consumidor_final: z.enum(['0', '1']),
      presenca_comprador: z.enum(['0', '1', '2', '3', '4', '5', '9']),
      destinatario: z.object({
        cpf: z.string().optional(),
        cnpj: z.string().optional(),
        nome: z.string().min(1),
        endereco: z.string().min(1),
        numero: z.string().min(1),
        complemento: z.string().optional(),
        bairro: z.string().min(1),
        codigo_municipio: z.number().int(),
        uf: z.string().length(2),
        cep: z.string(),
        telefone: z.string().optional(),
        email: z.string().email().optional(),
        indicador_ie: z.enum(['1', '2', '9']),
        inscricao_estadual: z.string().optional(),
      }),
      itens: z.array(z.object({
        numero_item: z.number().int(),
        codigo_produto: z.string(),
        descricao: z.string(),
        ncm: z.string().length(8),
        cest: z.string().optional(),
        cfop: z.string().length(4),
        unidade_comercial: z.string(),
        quantidade_comercial: z.number().positive(),
        valor_unitario_comercial: z.number().positive(),
        unidade_tributavel: z.string(),
        quantidade_tributavel: z.number().positive(),
        valor_unitario_tributavel: z.number().positive(),
        valor_bruto: z.number().positive(),
        valor_desconto: z.number().min(0).optional(),
        valor_frete: z.number().min(0).optional(),
        valor_seguro: z.number().min(0).optional(),
        valor_outras_despesas: z.number().min(0).optional(),
        origem: z.enum(['0','1','2','3','4','5','6','7','8']),
        icms: z.object({
          cst: z.string(),
          valor_bc: z.number().optional(),
          aliquota: z.number().optional(),
          valor_icms: z.number().optional(),
          modalidade_bc: z.string().optional(),
          valor_bc_st: z.number().optional(),
          aliquota_st: z.number().optional(),
          valor_icms_st: z.number().optional(),
          percentual_reducao_bc: z.number().optional(),
          percentual_reducao_bc_st: z.number().optional(),
        }),
        ipi: z.object({ cst: z.string(), valor_bc: z.number().optional(), aliquota: z.number().optional(), valor_ipi: z.number().optional() }).optional(),
        pis: z.object({ cst: z.string(), valor_bc: z.number().optional(), aliquota: z.number().optional(), valor_pis: z.number().optional() }).optional(),
        cofins: z.object({ cst: z.string(), valor_bc: z.number().optional(), aliquota: z.number().optional(), valor_cofins: z.number().optional() }).optional(),
      })).min(1),
      transporte: z.object({
        modalidade_frete: z.enum(['0','1','2','3','4','9']),
        transportadora: z.object({ cnpj: z.string().optional(), cpf: z.string().optional(), nome: z.string().optional(), ie: z.string().optional(), endereco: z.string().optional(), uf: z.string().optional(), cidade: z.string().optional() }).optional(),
        volumes: z.array(z.object({ quantidade: z.number().int(), especie: z.string(), marca: z.string().optional(), numero: z.string().optional(), peso_liquido: z.number().positive(), peso_bruto: z.number().positive() })).optional(),
      }).optional(),
      pagamento: z.object({
        forma_pagamento: z.enum(['01','02','03','04','05','10','11','12','13','14','15','16','17','99']),
        valor: z.number().positive(),
        parcelas: z.array(z.object({ numero: z.number().int(), valor: z.number().positive(), vencimento: z.string().datetime() })).optional(),
      }).optional(),
      informacoes_adicionais: z.object({ fisco: z.string().optional(), complementares: z.string().optional() }).optional(),
      cnpj_emitente: z.string().optional(),
    }).parse(req.body);

    const result = await emitNFe(tenantId!, { ...data, cnpj_emitente: data.cnpj_emitente ?? '' });
    res.status(201).json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
});

fiscalRouter.post('/:key/cancel', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { justification } = z.object({ justification: z.string().min(15).max(255) }).parse(req.body);
    await cancelFiscalDocument(tenantId!, req.params.key, justification);
    res.json({ success: true, data: { message: 'Documento cancelado.' }, error: null });
  } catch (err) {
    next(err);
  }
});

fiscalRouter.post('/:key/correction-letter', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { correction } = z.object({ correction: z.string().min(15).max(1000) }).parse(req.body);
    await sendCorrectionLetter(tenantId!, req.params.key, correction);
    res.json({ success: true, data: { message: 'Carta de correção enviada.' }, error: null });
  } catch (err) {
    next(err);
  }
});

fiscalRouter.get('/:key/status', async (req, res, next) => {
  try {
    const status = await queryNFeStatus(req.params.key);
    res.json({ success: true, data: status, error: null });
  } catch (err) {
    next(err);
  }
});

fiscalRouter.get('/:key/xml', async (req, res, next) => {
  try {
    const xml = await downloadXml(req.params.key);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.key}.xml"`);
    res.send(xml);
  } catch (err) {
    next(err);
  }
});

fiscalRouter.get('/:key/pdf', async (req, res, next) => {
  try {
    const pdf = await downloadPdf(req.params.key);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.key}.pdf"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

fiscalRouter.get('/documents', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { type, status, page = '1', limit = '20' } = req.query;

    const where: Record<string, unknown> = { tenantId: tenantId! };
    if (type) where.type = type;
    if (status) where.status = status;

    const [documents, total] = await Promise.all([
      prisma.fiscalDocument.findMany({
        where,
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.fiscalDocument.count({ where }),
    ]);

    res.json({ success: true, data: { items: documents, total }, error: null });
  } catch (err) {
    next(err);
  }
});

fiscalRouter.get('/documents/:id/events', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const events = await prisma.fiscalDocumentEvent.findMany({
      where: { fiscalDocumentId: req.params.id, tenantId: tenantId! },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: events, error: null });
  } catch (err) {
    next(err);
  }
});
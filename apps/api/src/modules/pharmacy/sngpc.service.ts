import { PrismaClient } from '@prisma/client';
import { DomainError } from '../../middlewares/error-handler.middleware';

const prisma = new PrismaClient();

/**
 * SNGPC — Sistema Nacional de Gerenciamento de Produtos Controlados.
 * Regulação: Portaria 344/1998 (psicotrópicos, entorpecentes — Lista B).
 * Migração: RDC 1.000/2025 → SNCR (Sistema Nacional de Controle de Receituários).
 *
 * REGRA: toda venda de produto isControlledSubstance = true exige
 * PrescriptionRecord obrigatório (foto da receita ou referência eletrônica).
 * A venda NÃO pode ser concluída sem esse registro.
 */

export interface PrescriptionInput {
  saleId: string;
  productId: string;
  type: 'PHYSICAL' | 'ELECTRONIC_SNCR';
  retentionImageUrl?: string;
  electronicKey?: string;
  prescriptionNumber?: string;
  pharmacistName: string;
  pharmacistCrf: string;
}

export async function requirePrescriptionForSale(
  tenantId: string,
  productId: string,
): Promise<{
  required: boolean;
  isControlled: boolean;
  requiresRetention: boolean;
}> {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    select: {
      id: true,
      name: true,
      isControlledSubstance: true,
      requiresPrescriptionRetention: true,
    },
  });

  if (!product) {
    throw new DomainError('NOT_FOUND', 'Produto não encontrado.');
  }

  return {
    required: product.isControlledSubstance,
    isControlled: product.isControlledSubstance,
    requiresRetention: product.requiresPrescriptionRetention,
  };
}

export async function registerPrescription(
  tenantId: string,
  input: PrescriptionInput,
): Promise<{ id: string }> {
  const product = await prisma.product.findFirst({
    where: { id: input.productId, tenantId },
  });

  if (!product) {
    throw new DomainError('NOT_FOUND', 'Produto não encontrado.');
  }

  if (!product.isControlledSubstance) {
    throw new DomainError(
      'NOT_CONTROLLED_SUBSTANCE',
      'Este produto não é controlado. Receita não é obrigatória.',
    );
  }

  if (product.requiresPrescriptionRetention && !input.retentionImageUrl && !input.electronicKey) {
    throw new DomainError(
      'PRESCRIPTION_REQUIRED',
      'Retenção de receita é obrigatória para este produto.',
    );
  }

  const existing = await prisma.prescriptionRecord.findFirst({
    where: { saleId: input.saleId, productId: input.productId },
  });

  if (existing) {
    throw new DomainError('CONFLICT', 'Receita já registrada para esta venda/produto.');
  }

  const prescription = await prisma.prescriptionRecord.create({
    data: {
      tenantId,
      saleId: input.saleId,
      productId: input.productId,
      type: input.type,
      retentionImageUrl: input.retentionImageUrl,
      electronicKey: input.electronicKey,
      prescriptionNumber: input.prescriptionNumber,
      pharmacistName: input.pharmacistName,
      pharmacistCrf: input.pharmacistCrf,
    },
  });

  return { id: prescription.id };
}

export async function validatePrescriptionForSale(
  tenantId: string,
  saleId: string,
  productId: string,
): Promise<{
  valid: boolean;
  prescription?: {
    id: string;
    type: string;
    prescriptionNumber?: string;
    pharmacistName: string;
  };
}> {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
  });

  if (!product?.isControlledSubstance) {
    return { valid: true };
  }

  const prescription = await prisma.prescriptionRecord.findFirst({
    where: { saleId, productId },
  });

  if (!prescription) {
    return { valid: false };
  }

  return {
    valid: true,
    prescription: {
      id: prescription.id,
      type: prescription.type,
      prescriptionNumber: prescription.prescriptionNumber ?? undefined,
      pharmacistName: prescription.pharmacistName,
    },
  };
}

/**
 * Gera o registro de movimentação SNGPC para transmissão ao sistema nacional.
 * Estrutura preparada para migração ao SNCR (numeração única de receita eletrônica).
 */
export async function generateSngpcMovement(
  tenantId: string,
  saleId: string,
): Promise<Array<{
  productId: string;
  productName: string;
  quantity: number;
  prescriptionType: string;
  prescriptionKey: string | null;
  isSncrReady: boolean;
}>> {
  const prescriptions = await prisma.prescriptionRecord.findMany({
    where: { tenantId, saleId },
    include: {
      product: { select: { id: true, name: true, isControlledSubstance: true } },
    },
  });

  return prescriptions.map((p) => ({
    productId: p.productId,
    productName: p.product.name,
    quantity: 0, // preenchido pelo chamador com o quantity do SaleItem
    prescriptionType: p.type,
    prescriptionKey: p.electronicKey ?? null,
    isSncrReady: p.type === 'ELECTRONIC_SNCR' && !!p.prescriptionNumber,
  }));
}

export async function getSngpcReport(
  tenantId: string,
  startDate: Date,
  endDate: Date,
) {
  const prescriptions = await prisma.prescriptionRecord.findMany({
    where: { tenantId, createdAt: { gte: startDate, lte: endDate } },
    include: {
      product: { select: { name: true, isControlledSubstance: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return {
    period: { startDate, endDate },
    totalPrescriptions: prescriptions.length,
    physicalPrescriptions: prescriptions.filter((p) => p.type === 'PHYSICAL').length,
    electronicPrescriptions: prescriptions.filter((p) => p.type === 'ELECTRONIC_SNCR').length,
    sncrReadyPrescriptions: prescriptions.filter(
      (p) => p.type === 'ELECTRONIC_SNCR' && !!p.prescriptionNumber,
    ).length,
    prescriptions: prescriptions.map((p) => ({
      id: p.id,
      saleId: p.saleId,
      productName: p.product.name,
      type: p.type,
      prescriptionNumber: p.prescriptionNumber,
      pharmacistName: p.pharmacistName,
      pharmacistCrf: p.pharmacistCrf,
      createdAt: p.createdAt,
    })),
  };
}

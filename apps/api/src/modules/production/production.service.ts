import { PrismaClient } from '@prisma/client';
import { DomainError } from '../../middlewares/error-handler.middleware';

const prisma = new PrismaClient();

/**
 * Produção diária (Padaria/Confeitaria).
 *
 * REGRA: o ProductionBatch baixa os insumos proporcionalmente NO MOMENTO DA
 * PRODUÇÃO, não apenas no momento da venda. Isso é essencial porque nem tudo
 * que é produzido é vendido no mesmo dia.
 *
 * Custo do produto final é recalculado automaticamente sempre que o preço
 * de um insumo muda, mantendo o CMV sempre atualizado.
 */

export interface ProductionInput {
  recipeId: string;
  outputQuantity: number;
  productionDate?: Date;
  notes?: string;
}

export interface ProductionResult {
  batchId: string;
  recipeName: string;
  outputProductName: string;
  outputQuantity: number;
  ingredientsConsumed: Array<{
    ingredientId: string;
    ingredientName: string;
    quantity: number;
    unit: string;
    unitCost: number;
    totalCost: number;
  }>;
  totalProductionCost: number;
  unitCost: number;
}

export async function registerProductionBatch(
  tenantId: string,
  input: ProductionInput,
): Promise<ProductionResult> {
  return prisma.$transaction(async (tx: import('@prisma/client').Prisma.TransactionClient) => {
    const recipe = await tx.recipe.findFirst({
      where: { id: input.recipeId, tenantId },
      include: {
        product: { select: { id: true, name: true, stockQuantity: true, costPrice: true } },
        items: {
          include: { ingredient: { select: { id: true, name: true, stockQuantity: true, costPrice: true, unitPrice: true } } },
        },
      },
    });

    if (!recipe) {
      throw new DomainError('NOT_FOUND', 'Receita não encontrada.');
    }

    if (recipe.product.stockQuantity.toNumber() + input.outputQuantity <= 0) {
      throw new DomainError('VALIDATION_ERROR', 'Quantidade de produção inválida.');
    }

    // Calcula quanto de cada insumo é necessário proporcionalmente
    const recipeYield = recipe.yieldQuantity.toNumber();
    if (recipeYield <= 0) {
      throw new DomainError('VALIDATION_ERROR', 'Rendimento da receita deve ser maior que zero.');
    }

    const scaleFactor = input.outputQuantity / recipeYield;
    const ingredientsConsumed: ProductionResult['ingredientsConsumed'] = [];
    let totalProductionCost = 0;

    for (const item of recipe.items) {
      const neededQuantity = item.quantity.toNumber() * scaleFactor;
      const available = item.ingredient.stockQuantity.toNumber();

      if (available < neededQuantity) {
        throw new DomainError(
          'INSUFFICIENT_STOCK',
          `Insumo ${item.ingredient.name} insuficiente. Disponível: ${available}, Necessário: ${neededQuantity.toFixed(3)}.`,
        );
      }

      const unitCost = item.unitCost?.toNumber() ?? item.ingredient.costPrice?.toNumber() ?? 0;
      const totalCost = neededQuantity * unitCost;
      totalProductionCost += totalCost;

      ingredientsConsumed.push({
        ingredientId: item.ingredientId,
        ingredientName: item.ingredient.name,
        quantity: neededQuantity,
        unit: item.unit,
        unitCost,
        totalCost,
      });

      // Baixa do insumo no momento da produção
      await tx.product.update({
        where: { id: item.ingredientId },
        data: { stockQuantity: { decrement: neededQuantity } },
      });

      await tx.stockMovement.create({
        data: {
          tenantId,
          productId: item.ingredientId,
          type: 'PRODUCTION',
          quantity: neededQuantity,
          unitCost,
          reason: `Produção de ${input.outputQuantity}x ${recipe.name}`,
          referenceType: 'PRODUCTION_BATCH',
        },
      });
    }

    // Credita o produto final
    const unitCost = totalProductionCost / input.outputQuantity;
    await tx.product.update({
      where: { id: recipe.productId },
      data: {
        stockQuantity: { increment: input.outputQuantity },
        costPrice: unitCost,
      },
    });

    // Atualiza o custo da receita
    const updatedRecipe = await tx.recipe.update({
      where: { id: recipe.id },
      data: {
        items: {
          updateMany: {
            where: {},
            data: {},
          },
        },
      },
      include: { items: { include: { ingredient: true } } },
    });

    // Cria o lote de produção
    const batch = await tx.productionBatch.create({
      data: {
        tenantId,
        recipeId: recipe.id,
        outputProductId: recipe.productId,
        quantityProduced: input.outputQuantity,
        productionDate: input.productionDate ?? new Date(),
        notes: input.notes,
      },
    });

    return {
      batchId: batch.id,
      recipeName: recipe.name,
      outputProductName: recipe.product.name,
      outputQuantity: input.outputQuantity,
      ingredientsConsumed,
      totalProductionCost,
      unitCost,
    };
  });
}

/**
 * Registro de perdas e quebras — desvinculado de qualquer venda.
 * StockMovement do tipo ADJUSTMENT com subtipo LOSS.
 * Essencial para o cálculo da margem real.
 */
export async function registerLoss(
  tenantId: string,
  productId: string,
  quantity: number,
  reason: string,
): Promise<void> {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
  });

  if (!product) {
    throw new DomainError('NOT_FOUND', 'Produto não encontrado.');
  }

  if (product.stockQuantity.toNumber() < quantity) {
    throw new DomainError(
      'VALIDATION_ERROR',
      'Quantidade de perda maior que o estoque atual.',
    );
  }

  await prisma.$transaction(async (tx: import('@prisma/client').Prisma.TransactionClient) => {
    await tx.product.update({
      where: { id: productId },
      data: { stockQuantity: { decrement: quantity } },
    });

    await tx.stockMovement.create({
      data: {
        tenantId,
        productId,
        type: 'ADJUSTMENT',
        subtype: 'LOSS',
        quantity,
        reason,
        referenceType: 'MANUAL_LOSS',
      },
    });
  });
}

/**
 * Recalcula o custo do produto final quando o preço de um insumo muda.
 * Atualiza o costPrice do produto com base na ficha técnica.
 */
export async function recalculateRecipeCost(
  tenantId: string,
  recipeId: string,
): Promise<{
  recipeId: string;
  productId: string;
  productName: string;
  oldCostPrice: number | null;
  newCostPrice: number;
}> {
  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, tenantId },
    include: {
      product: { select: { id: true, name: true, costPrice: true } },
      items: {
        include: { ingredient: { select: { costPrice: true } } },
      },
    },
  });

  if (!recipe) {
    throw new DomainError('NOT_FOUND', 'Receita não encontrada.');
  }

  const recipeYield = recipe.yieldQuantity.toNumber();
  if (recipeYield <= 0) {
    throw new DomainError('VALIDATION_ERROR', 'Rendimento da receita deve ser maior que zero.');
  }

  let totalCost = 0;
  for (const item of recipe.items) {
    const ingredientCost = item.unitCost?.toNumber() ?? item.ingredient.costPrice?.toNumber() ?? 0;
    totalCost += item.quantity.toNumber() * ingredientCost;
  }

  const newCostPrice = totalCost / recipeYield;
  const oldCostPrice = recipe.product.costPrice?.toNumber() ?? null;

  await prisma.product.update({
    where: { id: recipe.productId },
    data: { costPrice: newCostPrice },
  });

  return {
    recipeId: recipe.id,
    productId: recipe.productId,
    productName: recipe.product.name,
    oldCostPrice,
    newCostPrice,
  };
}

export async function getProductionCostHistory(
  tenantId: string,
  productId: string,
  startDate?: Date,
  endDate?: Date,
) {
  return prisma.productionBatch.findMany({
    where: {
      tenantId,
      outputProductId: productId,
      ...(startDate && endDate && {
        productionDate: { gte: startDate, lte: endDate },
      }),
    },
    include: { recipe: { select: { name: true, yieldQuantity: true } } },
    orderBy: { productionDate: 'desc' },
  });
}

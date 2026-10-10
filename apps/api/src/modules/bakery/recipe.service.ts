/**
 * Cap. 4 Padaria — ficha técnica + CMV + perdas desvinculadas da venda.
 */

export type RecipeIngredient = {
  productId: string;
  quantity: number; // por batch de rendimento
  costUnit: number;
};

export type RecipeDef = {
  name: string;
  yieldQuantity: number;
  ingredients: RecipeIngredient[];
};

export function computeRecipeCmv(recipe: RecipeDef): {
  totalCost: number;
  unitCost: number;
} {
  const totalCost = recipe.ingredients.reduce(
    (s, i) => s + i.quantity * i.costUnit,
    0,
  );
  const unitCost =
    recipe.yieldQuantity > 0 ? totalCost / recipe.yieldQuantity : 0;
  return { totalCost, unitCost };
}

/**
 * Produção diária: baixa insumos, sobe produto acabado, registra perdas
 * (quantityProduced - quantitySoldable) SEM gerar Sale.
 */
export function planProductionBatch(input: {
  recipe: RecipeDef;
  batchesToProduce: number;
  lossQuantity: number;
}) {
  const scale = input.batchesToProduce;
  const ingredientConsumption = input.recipe.ingredients.map((i) => ({
    productId: i.productId,
    quantity: i.quantity * scale,
  }));
  const finishedGoods = input.recipe.yieldQuantity * scale;
  const sellable = Math.max(0, finishedGoods - input.lossQuantity);
  const cmv = computeRecipeCmv(input.recipe);

  return {
    ingredientConsumption,
    finishedGoodsProduced: finishedGoods,
    sellableQuantity: sellable,
    lossQuantity: input.lossQuantity,
    unitCost: cmv.unitCost,
    totalCost: cmv.totalCost * scale,
  };
}

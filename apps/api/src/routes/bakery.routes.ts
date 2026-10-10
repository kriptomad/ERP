import { Router } from "express";
import { z } from "zod";
import { requireSession, type AuthedRequest } from "../middlewares/session.middleware";
import { requireModule } from "../middlewares/module-gating.middleware";
import { requireTenantType } from "../middlewares/tenant-type.middleware";
import { prismaUnscoped } from "@filitech/database";
import { planProductionBatch, computeRecipeCmv } from "../modules/bakery/recipe.service";

export const bakeryRouter = Router();
bakeryRouter.use(requireSession);
bakeryRouter.use(requireTenantType("BUSINESS"));
bakeryRouter.use(requireModule("RECIPE_BOM"));

bakeryRouter.post("/recipes", async (req: AuthedRequest, res) => {
  const p = z
    .object({
      name: z.string().min(1),
      yieldQuantity: z.number().positive(),
      items: z.array(
        z.object({ productId: z.string().uuid(), quantity: z.number().positive() }),
      ),
    })
    .safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ success: false, error: p.error.flatten() });
    return;
  }
  const recipe = await prismaUnscoped.recipe.create({
    data: {
      tenantId: req.tenantId!,
      name: p.data.name,
      yieldQuantity: p.data.yieldQuantity,
      items: {
        create: p.data.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
      },
    },
    include: { items: true },
  });
  res.status(201).json({ success: true, data: recipe });
});

bakeryRouter.post("/produce", async (req: AuthedRequest, res) => {
  const p = z
    .object({
      recipeId: z.string().uuid(),
      batchesToProduce: z.number().positive(),
      lossQuantity: z.number().min(0).default(0),
    })
    .safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ success: false, error: p.error.flatten() });
    return;
  }
  const recipe = await prismaUnscoped.recipe.findFirstOrThrow({
    where: { id: p.data.recipeId, tenantId: req.tenantId! },
    include: { items: true },
  });

  const ingredients = await Promise.all(
    recipe.items.map(async (it) => {
      const prod = await prismaUnscoped.product.findFirstOrThrow({
        where: { id: it.productId, tenantId: req.tenantId! },
      });
      return {
        productId: it.productId,
        quantity: Number(it.quantity),
        costUnit: Number(prod.costPrice ?? 0),
      };
    }),
  );

  const plan = planProductionBatch({
    recipe: {
      name: recipe.name,
      yieldQuantity: Number(recipe.yieldQuantity),
      ingredients,
    },
    batchesToProduce: p.data.batchesToProduce,
    lossQuantity: p.data.lossQuantity,
  });

  await prismaUnscoped.$transaction(async (tx) => {
    for (const c of plan.ingredientConsumption) {
      await tx.product.update({
        where: { id: c.productId },
        data: { stockQuantity: { decrement: c.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          tenantId: req.tenantId!,
          productId: c.productId,
          type: "PRODUCTION",
          quantity: c.quantity,
          reason: "RECIPE_CONSUME",
        },
      });
    }
    await tx.productionBatch.create({
      data: {
        tenantId: req.tenantId!,
        recipeId: recipe.id,
        quantityProduced: plan.finishedGoodsProduced,
        lossQuantity: plan.lossQuantity,
        unitCost: plan.unitCost,
      },
    });
  });

  res.status(201).json({ success: true, data: plan });
});

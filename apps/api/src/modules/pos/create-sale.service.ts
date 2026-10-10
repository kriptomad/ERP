import { prismaUnscoped, Prisma } from "@filitech/database";

export async function createPosSale(params: {
  tenantId: string;
  userId: string;
  clientId?: string;
  cashRegisterId?: string;
  paymentMethod: string;
  items: { productId: string; quantity: number; unitPrice?: number }[];
}) {
  if (!params.items.length) throw new Error("SALE_EMPTY");

  return prismaUnscoped.$transaction(async (tx) => {
    if (params.paymentMethod === "CREDIT_STORE" && params.clientId) {
      const client = await tx.client.findFirstOrThrow({
        where: { id: params.clientId, tenantId: params.tenantId },
      });
      let saleTotal = 0;
      for (const line of params.items) {
        const p = await tx.product.findFirstOrThrow({
          where: { id: line.productId, tenantId: params.tenantId },
        });
        saleTotal += (line.unitPrice ?? Number(p.unitPrice)) * line.quantity;
      }
      if (Number(client.creditBalanceUsed) + saleTotal > Number(client.creditLimit)) {
        throw new Error("CREDIT_LIMIT_EXCEEDED");
      }
    }

    const lineResults: {
      productId: string;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      total: Prisma.Decimal;
    }[] = [];

    for (const line of params.items) {
      const product = await tx.product.findFirstOrThrow({
        where: { id: line.productId, tenantId: params.tenantId, active: true },
      });
      const qty = new Prisma.Decimal(line.quantity);
      if (product.stockQuantity.lessThan(qty)) {
        throw new Error(`INSUFFICIENT_STOCK:${product.sku}`);
      }
      await tx.product.update({
        where: { id: product.id },
        data: { stockQuantity: { decrement: qty } },
      });
      const unitPrice = new Prisma.Decimal(line.unitPrice ?? Number(product.unitPrice));
      lineResults.push({
        productId: product.id,
        quantity: qty,
        unitPrice,
        total: unitPrice.mul(qty),
      });
    }

    const totalAmount = lineResults.reduce(
      (s, l) => s.plus(l.total),
      new Prisma.Decimal(0),
    );

    const sale = await tx.sale.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        clientId: params.clientId,
        cashRegisterId: params.cashRegisterId,
        totalAmount,
        paymentMethod: params.paymentMethod,
        channel: "POS",
        status: "COMPLETED",
        items: {
          create: lineResults.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            total: l.total,
          })),
        },
      },
      include: { items: true },
    });

    for (const l of lineResults) {
      await tx.stockMovement.create({
        data: {
          tenantId: params.tenantId,
          productId: l.productId,
          type: "OUT",
          quantity: l.quantity,
          reason: "POS_SALE",
          saleId: sale.id,
        },
      });
    }

    if (params.paymentMethod === "CREDIT_STORE" && params.clientId) {
      await tx.client.update({
        where: { id: params.clientId },
        data: { creditBalanceUsed: { increment: totalAmount } },
      });
    }

    // Loyalty EARN na mesma TX (Cap. 4.1.1)
    if (params.clientId) {
      const program = await tx.loyaltyProgram.findUnique({
        where: { tenantId: params.tenantId },
      });
      if (program?.active) {
        const earned = Math.floor(Number(totalAmount) * Number(program.pointsPerCurrencyUnit));
        if (earned > 0) {
          const account = await tx.loyaltyAccount.upsert({
            where: { clientId: params.clientId },
            create: {
              tenantId: params.tenantId,
              clientId: params.clientId,
              pointsBalance: earned,
            },
            update: { pointsBalance: { increment: earned } },
          });
          await tx.loyaltyTransaction.create({
            data: {
              loyaltyAccountId: account.id,
              type: "EARN",
              points: earned,
              saleId: sale.id,
              expiresAt: program.pointsExpireAfterDays
                ? new Date(Date.now() + program.pointsExpireAfterDays * 86400000)
                : null,
            },
          });
        }
      }
    }

    return sale;
  });
}

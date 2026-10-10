import { Router } from "express";
import { prismaUnscoped } from "@filitech/database";

export const pluggyWebhooksRouter = Router();

/** Cap. 22 — webhook Pluggy (item/updated, transactions) */
pluggyWebhooksRouter.post("/", async (req, res) => {
  const event = req.body as {
    event?: string;
    itemId?: string;
    data?: { id?: string };
  };
  const itemId = event.itemId ?? event.data?.id;
  if (!itemId) {
    res.json({ received: true, matched: false });
    return;
  }

  const consent = await prismaUnscoped.openFinanceConsent.findUnique({
    where: { itemId },
  });
  if (!consent) {
    res.json({ received: true, matched: false });
    return;
  }

  await prismaUnscoped.openFinanceConsent.update({
    where: { id: consent.id },
    data: {
      status: event.event ?? consent.status,
      lastSyncedAt: new Date(),
    },
  });

  res.json({ received: true, matched: true });
});

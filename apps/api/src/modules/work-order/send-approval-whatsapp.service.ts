import { prismaUnscoped } from "@filitech/database";
import { sendWhatsAppTemplate } from "../integrations/whatsapp.service";
import { issueWorkOrderApprovalToken } from "./approval-token.service";

/** Cap. 4 Assistência — envia link 72h via WhatsApp se módulo ativo + opt-in */
export async function requestApprovalWithWhatsApp(params: {
  workOrderId: string;
  tenantId: string;
  quoteAmount: number;
  laborAmount: number;
  validDays?: number;
}) {
  const wo = await prismaUnscoped.workOrder.findFirstOrThrow({
    where: { id: params.workOrderId, tenantId: params.tenantId },
    include: { client: true },
  });

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + (params.validDays ?? 7));

  await prismaUnscoped.workOrder.update({
    where: { id: wo.id },
    data: {
      quoteAmount: params.quoteAmount,
      laborAmount: params.laborAmount,
      quoteValidUntil: validUntil,
    },
  });

  const issued = await issueWorkOrderApprovalToken(wo.id);

  let whatsappSent = false;
  if (
    wo.client.phone &&
    wo.client.whatsappOptInAt &&
    !wo.client.whatsappOptOutAt
  ) {
    try {
      await sendWhatsAppTemplate({
        toPhoneE164: wo.client.phone,
        templateName: "os_aprovacao",
        variables: [
          wo.client.name,
          String(params.quoteAmount),
          issued.publicUrl,
        ],
      });
      whatsappSent = true;
    } catch (e) {
      console.error("[whatsapp] OS approval send failed", e);
    }
  }

  return { ...issued, whatsappSent };
}

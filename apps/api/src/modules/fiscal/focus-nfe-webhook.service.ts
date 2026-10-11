import { prisma } from '../../infra/prisma';
import { FiscalDocumentStatus } from '@prisma/client';
import { logger } from '../../logging/structured-logger';

export async function handleFocusNFeWebhook(payload: any): Promise<void> {
  const { status, chave, numero, serie, modelo, cnpj_emitente } = payload;

  if (!chave) {
    logger.warn('Focus NFe webhook: missing chave', { payload });
    return;
  }

  const doc = await prisma.fiscalDocument.findFirst({
    where: { tenant: { cnpj: cnpj_emitente }, key: chave },
  });

  if (!doc) {
    logger.warn('Focus NFe webhook: document not found', { chave, cnpj_emitente });
    return;
  }

  const statusMap: Record<string, string> = {
    'autorizado': 'AUTHORIZED',
    'cancelado': 'CANCELLED',
    'denegado': 'DENIED',
    'processando': 'PENDING',
    'erro': 'DENIED',
  };

  const newStatus = statusMap[status] || 'PENDING';

  await prisma.$transaction(async (tx) => {
    await tx.fiscalDocument.update({
      where: { id: doc.id },
      data: { status: newStatus as FiscalDocumentStatus, issuedAt: newStatus === 'AUTHORIZED' ? new Date() : doc.issuedAt },
    });

    await tx.fiscalDocumentEvent.create({
      data: {
        tenantId: doc.tenantId,
        fiscalDocumentId: doc.id,
        eventType: newStatus === 'AUTHORIZED' ? 'AUTHORIZATION' :
                   newStatus === 'CANCELLED' ? 'CANCELLATION' :
                   newStatus === 'DENIED' ? 'DENIAL' : 'OTHER',
        eventNumber: numero?.toString(),
        justification: payload.motivo,
        registeredAt: new Date(),
      },
    });
  });

  logger.info('Focus NFe webhook processed', { chave, status: newStatus });
}
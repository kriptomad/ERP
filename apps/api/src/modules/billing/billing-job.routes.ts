import { prisma } from '../../infra/prisma';
import { logger } from '../../logging/structured-logger';

export async function processDunningCycle(): Promise<void> {
  const pastDueTenants = await prisma.tenant.findMany({
    where: { status: 'PAST_DUE' },
  });

  const now = new Date();

  for (const tenant of pastDueTenants) {
    const graceEndsAt = tenant.gracePeriodEndsAt;
    if (!graceEndsAt) continue;

    if (now > graceEndsAt) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { status: 'SUSPENDED' },
      });
      logger.warn('Tenant suspenso por fim de graça', { tenantId: tenant.id });
    } else {
      // Enviar lembrete de pagamento via WhatsApp
      const daysOverdue = Math.ceil((now.getTime() - graceEndsAt.getTime()) / (1000 * 60 * 60 * 24)) * -1;
      const clients = await prisma.client.findMany({ where: { tenantId: tenant.id } });

      for (const client of clients) {
        const receivables = await prisma.accountReceivable.findMany({
          where: { tenantId: tenant.id, clientId: client.id, status: 'PENDING' },
        });

        for (const receivable of receivables) {
          await sendPaymentReminder(tenant.id, client.phone || '', receivable.amount.toNumber(), receivable.dueDate.toISOString());
        }
      }
    }
  }
}

function sendPaymentReminder(_tenantId: string, _phone: string, _amount: number, _dueDate: string): Promise<void> {
  // Implementar envio real via WhatsApp
  logger.info('Payment reminder would be sent', { amount: _amount, dueDate: _dueDate });
  return Promise.resolve();
}

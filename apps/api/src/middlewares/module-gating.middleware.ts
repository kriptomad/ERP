import { Request, Response, NextFunction } from 'express';
import { prisma } from '../infra/prisma';
import { getRequestContext } from './request-context.middleware';

const MODULE_CATALOG: Record<string, { label: string; monthlyPrice: number }> = {
  FISCAL_NFCE: { label: 'Emissão Fiscal (NFC-e/NFe)', monthlyPrice: 49.9 },
  WHATSAPP_INTEGRATION: { label: 'Integração WhatsApp', monthlyPrice: 39.9 },
  MULTI_FILIAL: { label: 'Multi-Filial', monthlyPrice: 59.9 },
  WORK_ORDER: { label: 'Assistência Técnica (O.S.)', monthlyPrice: 69.9 },
  LIQUOR_LEDGER: { label: 'Adega — Conta-Corrente de Cascos', monthlyPrice: 29.9 },
  RECIPE_BOM: { label: 'Ficha Técnica (Padaria/Confeitaria)', monthlyPrice: 44.9 },
  PHARMACY_SNGPC: { label: 'Farmácia — SNGPC/Controlados', monthlyPrice: 79.9 },
};

export function requireModule(moduleCode: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const context = getRequestContext();
    const tenantId = context.tenantId || req.tenantId;

    if (!tenantId) {
      res.status(400).json({
        success: false,
        data: null,
        error: { code: 'TENANT_NOT_RESOLVED', message: 'Não foi possível identificar o tenant.' },
      });
      return;
    }

    const tenantModule = await prisma.tenantModule.findUnique({
      where: { tenantId_moduleCode: { tenantId, moduleCode } },
    });

    if (!tenantModule?.active) {
      const moduleInfo = MODULE_CATALOG[moduleCode];
      res.status(402).json({
        success: false,
        data: null,
        error: {
          code: 'MODULE_NOT_ACTIVE',
          message: `O módulo '${moduleInfo?.label ?? moduleCode}' não está ativo para sua conta.`,
          details: {
            upsell: {
              moduleCode,
              label: moduleInfo?.label,
              monthlyPrice: moduleInfo?.monthlyPrice,
              checkoutUrl: `/api/v1/billing/modules/${moduleCode}/activate`,
            },
          },
        },
      });
      return;
    }

    next();
  };
}

export { MODULE_CATALOG };

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePersonalTenant } from '../../middlewares/tenant-type-gatekeeper.middleware';
import { getRequestContext } from '../../middlewares/request-context.middleware';

export const personalCarnesLeaoRouter = Router();

personalCarnesLeaoRouter.use(authenticate);
personalCarnesLeaoRouter.use(requirePersonalTenant);

const TAX_BRACKETS_2025 = [
  { min: 0, max: 2259.20, rate: 0, deduction: 0 },
  { min: 2259.21, max: 2826.65, rate: 0.075, deduction: 169.44 },
  { min: 2826.66, max: 3751.05, rate: 0.15, deduction: 381.44 },
  { min: 3751.06, max: 4664.68, rate: 0.225, deduction: 662.77 },
  { min: 4664.69, max: Infinity, rate: 0.275, deduction: 896.00 },
];

personalCarnesLeaoRouter.post('/calculate', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { year, monthlyIncome } = z.object({ year: z.number().int().default(2025), monthlyIncome: z.number().positive() }).parse(req.body);

    let taxableBase = monthlyIncome * 12;
    let annualTax = 0;

    for (const bracket of TAX_BRACKETS_2025) {
      if (taxableBase > bracket.min) {
        const taxableInBracket = Math.min(taxableBase, bracket.max) - bracket.min;
        annualTax += taxableInBracket * bracket.rate;
      }
    }
    annualTax -= TAX_BRACKETS_2025.reduce((sum, b) => sum + (Math.max(0, Math.min(taxableBase, b.max) - b.min) * b.rate), 0) - annualTax;
    annualTax = Math.max(0, annualTax - TAX_BRACKETS_2025.reduce((sum, b) => {
      if (taxableBase > b.min) {
        const taxableInBracket = Math.min(taxableBase, b.max) - b.min;
        return sum + taxableInBracket * b.rate;
      }
      return sum;
    }, 0) - TAX_BRACKETS_2025.reduce((sum, b) => {
      if (taxableBase > b.min) {
        const taxableInBracket = Math.min(taxableBase, b.max) - b.min;
        return sum + b.deduction;
      }
      return sum;
    }, 0));

    let finalTax = 0;
    let remaining = taxableBase;
    for (const bracket of TAX_BRACKETS_2025) {
      if (remaining <= 0) break;
      const taxableInBracket = Math.min(remaining, bracket.max - bracket.min);
      finalTax += taxableInBracket * bracket.rate;
      remaining -= taxableInBracket;
    }
    finalTax = finalTax - TAX_BRACKETS_2025.reduce((sum, b) => {
      if (taxableBase > b.min) {
        const taxableInBracket = Math.min(taxableBase, b.max) - b.min;
        return sum + b.deduction;
      }
      return sum;
    }, 0);
    finalTax = Math.max(0, finalTax);

    const monthlyTax = finalTax / 12;

    res.json({
      success: true,
      data: {
        year,
        monthlyIncome,
        annualTaxableBase: taxableBase,
        annualTax: finalTax,
        monthlyTax: monthlyTax,
        brackets: TAX_BRACKETS_2025,
        disclaimer: 'Cálculo sugerido baseado na tabela progressiva 2025. Consulte contador para apuração oficial.',
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

personalCarnesLeaoRouter.get('/export-dirpf', async (req, res, next) => {
  try {
    const { tenantId } = getRequestContext();
    const { year } = req.query;

    const income = await prisma.personalTransaction.aggregate({
      where: {
        tenantId: tenantId!,
        type: 'INCOME',
        transactionDate: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) },
        isPrivate: false,
      },
      _sum: { amount: true },
    });

    res.json({
      success: true,
      data: {
        year: parseInt(year as string) || new Date().getFullYear(),
        totalIncome: income._sum.amount?.toNumber() ?? 0,
        dirpfFields: {
          rendimentosTributaveis: income._sum.amount?.toNumber() ?? 0,
        },
        disclaimer: 'Exportação para DIRPF - consulte contador para preenchimento oficial.',
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});
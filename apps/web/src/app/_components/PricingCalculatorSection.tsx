'use client';

import { useState, useMemo } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

interface ModuleOption {
  code: string;
  label: string;
  monthlyPrice: number;
  description: string;
}

const BASE_PLANS = [
  { code: 'BASIC', label: 'Essencial', basePrice: 89.9, includedModules: ['pdv', 'estoque', 'financeiro'] },
  { code: 'PRO', label: 'Profissional', basePrice: 169.9, includedModules: ['pdv', 'estoque', 'financeiro', 'crm'] },
];

const ADDON_MODULES: ModuleOption[] = [
  { code: 'FISCAL_NFCE', label: 'Emissão Fiscal (NFC-e/NFe)', monthlyPrice: 49.9, description: 'Emissão ilimitada de documentos fiscais com contingência automática.' },
  { code: 'WHATSAPP_INTEGRATION', label: 'Integração WhatsApp', monthlyPrice: 39.9, description: 'Envio de orçamentos, cobranças e notificações de O.S. direto pelo WhatsApp.' },
  { code: 'MULTI_FILIAL', label: 'Multi-Filial', monthlyPrice: 59.9, description: 'Dashboard consolidado para múltiplas lojas sob o mesmo CNPJ matriz.' },
  { code: 'WORK_ORDER', label: 'Assistência Técnica (O.S.)', monthlyPrice: 69.9, description: 'Ordens de serviço, checklist, laudo fotográfico e controle de IMEI/Serial.' },
  { code: 'LIQUOR_LEDGER', label: 'Adega — Conta-Corrente de Cascos', monthlyPrice: 29.9, description: 'Controle de vasilhames retornáveis por cliente.' },
  { code: 'RECIPE_BOM', label: 'Ficha Técnica (Padaria/Confeitaria)', monthlyPrice: 44.9, description: 'Receitas, custo de produção e baixa automática de insumos.' },
  { code: 'PHARMACY_SNGPC', label: 'Farmácia — SNGPC/Controlados', monthlyPrice: 79.9, description: 'Escrituração eletrônica de controlados e retenção digital de receituário.' },
];

function AnimatedCurrency({ value }: { value: number }) {
  const motionValue = useMotionValue(value);
  const rounded = useTransform(motionValue, (latest) => `R$ ${latest.toFixed(2).replace('.', ',')}`);

  useMemo(() => {
    animate(motionValue, value, { duration: 0.5, ease: [0.22, 1, 0.36, 1] });
  }, [value, motionValue]);

  return <motion.span>{rounded}</motion.span>;
}

export function PricingCalculatorSection() {
  const [selectedPlan, setSelectedPlan] = useState(BASE_PLANS[0]);
  const [activeModules, setActiveModules] = useState<Set<string>>(new Set());

  const totalMrr = useMemo(() => {
    const addonsTotal = ADDON_MODULES
      .filter((m) => activeModules.has(m.code))
      .reduce((sum, m) => sum + m.monthlyPrice, 0);
    return selectedPlan.basePrice + addonsTotal;
  }, [selectedPlan, activeModules]);

  function toggleModule(code: string) {
    setActiveModules((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }

  return (
    <section className="bg-zinc-950/60 px-10 py-32 lg:px-24">
      <h2 className="mb-4 text-4xl font-bold">Monte o plano do seu negócio</h2>
      <p className="mb-12 max-w-2xl text-zinc-400">
        Pague apenas pelos módulos que o seu nicho realmente usa. Sem contrato de fidelidade, sem letra miúda.
      </p>

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-8 flex gap-4">
            {BASE_PLANS.map((plan) => (
              <button
                key={plan.code}
                onClick={() => setSelectedPlan(plan)}
                className={`flex-1 rounded-2xl border p-6 text-left transition-all ${
                  selectedPlan.code === plan.code
                    ? 'border-brand-500 bg-brand-500/10 shadow-[0_0_30px_rgba(99,102,241,0.3)]'
                    : 'border-zinc-800 hover:border-zinc-600'
                }`}
              >
                <h3 className="text-xl font-semibold">{plan.label}</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  PDV + Estoque + Financeiro{plan.code === 'PRO' ? ' + CRM' : ''}
                </p>
                <p className="mt-4 text-2xl font-bold">
                  R$ {plan.basePrice.toFixed(2).replace('.', ',')}
                  <span className="text-sm font-normal text-zinc-500">/mês</span>
                </p>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {ADDON_MODULES.map((moduleOption) => {
              const isActive = activeModules.has(moduleOption.code);
              return (
                <motion.button
                  key={moduleOption.code}
                  onClick={() => toggleModule(moduleOption.code)}
                  whileTap={{ scale: 0.98 }}
                  className={`flex w-full items-center justify-between rounded-xl border p-4 transition-colors ${
                    isActive ? 'border-brand-500/60 bg-brand-500/5' : 'border-zinc-800'
                  }`}
                >
                  <div className="text-left">
                    <p className="font-medium">{moduleOption.label}</p>
                    <p className="text-xs text-zinc-500">{moduleOption.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-zinc-400">
                      +R$ {moduleOption.monthlyPrice.toFixed(2).replace('.', ',')}
                    </span>
                    <span className={`h-6 w-11 rounded-full p-1 transition-colors ${isActive ? 'bg-brand-500' : 'bg-zinc-700'}`}>
                      <motion.span
                        className="block h-4 w-4 rounded-full bg-white"
                        animate={{ x: isActive ? 20 : 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="h-fit rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 backdrop-blur-md lg:sticky lg:top-10">
          <p className="text-sm text-zinc-400">Sua assinatura mensal estimada</p>
          <p className="mb-6 mt-2 text-5xl font-bold">
            <AnimatedCurrency value={totalMrr} />
          </p>
          <button className="w-full rounded-xl bg-brand-600 py-4 font-semibold shadow-[0_0_30px_rgba(99,102,241,0.4)]">
            Assinar agora
          </button>
        </div>
      </div>
    </section>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

interface ModuleOption {
  code: string;
  label: string;
  monthlyPrice: number;
  description: string;
  audience: 'BUSINESS' | 'PERSONAL' | 'BOTH';
}

const B2B_BASE_PLANS = [
  { code: 'ESSENCIAL', label: 'Essencial', basePrice: 89.9, includedModules: ['pdv', 'estoque', 'financeiro'], audience: 'BUSINESS' as const },
  { code: 'PROFISSIONAL', label: 'Profissional', basePrice: 169.9, includedModules: ['pdv', 'estoque', 'financeiro', 'crm'], audience: 'BUSINESS' as const },
];

const B2C_PLANS = [
  { code: 'GRATUITO', label: 'Gratuito', basePrice: 0, includedModules: ['contas', 'orcamento', 'dividas', 'calculadora'], audience: 'PERSONAL' as const, maxConnectedAccounts: 1 },
  { code: 'PLENO', label: 'Pleno', basePrice: 29.9, includedModules: ['contas', 'orcamento', 'dividas', 'calculadora', 'openfinance_ilimitado', 'splits', 'patrimonio_historico', 'exportacao'], audience: 'PERSONAL' as const, maxConnectedAccounts: null },
];

const ACCOUNTING_PLANS = [
  { code: 'ESCRITORIO_BASE', label: 'Escritório Base', basePrice: 199.9, includedModules: ['marketplace', 'procuration', 'tasks', 'generators'], audience: 'ACCOUNTING_OFFICE' as const },
];

const ADDON_MODULES: ModuleOption[] = [
  { code: 'FISCAL_NFCE', label: 'Emissão Fiscal (NFC-e/NFe)', monthlyPrice: 49.9, description: 'Emissão ilimitada de documentos fiscais com contingência automática.', audience: 'BUSINESS' },
  { code: 'WHATSAPP_INTEGRATION', label: 'Integração WhatsApp', monthlyPrice: 39.9, description: 'Envio de orçamentos, cobranças e notificações de O.S. direto pelo WhatsApp.', audience: 'BUSINESS' },
  { code: 'MULTI_FILIAL', label: 'Multi-Filial', monthlyPrice: 59.9, description: 'Dashboard consolidado para múltiplas lojas sob o mesmo CNPJ matriz.', audience: 'BUSINESS' },
  { code: 'WORK_ORDER', label: 'Assistência Técnica (O.S.)', monthlyPrice: 69.9, description: 'Ordens de serviço, checklist, laudo fotográfico e controle de IMEI/Serial.', audience: 'BUSINESS' },
  { code: 'LIQUOR_LEDGER', label: 'Adega — Conta-Corrente de Cascos', monthlyPrice: 29.9, description: 'Controle de vasilhames retornáveis por cliente.', audience: 'BUSINESS' },
  { code: 'RECIPE_BOM', label: 'Ficha Técnica (Padaria/Confeitaria)', monthlyPrice: 44.9, description: 'Receitas, custo de produção e baixa automática de insumos.', audience: 'BUSINESS' },
  { code: 'PHARMACY_SNGPC', label: 'Farmácia — SNGPC/Controlados', monthlyPrice: 79.9, description: 'Escrituração eletrônica de controlados e retenção digital de receituário.', audience: 'BUSINESS' },
  { code: 'ACCOUNTING_TAX', label: 'Contabilidade — Apuração Tributos', monthlyPrice: 89.9, description: 'Apuração ICMS/IPI/PIS/COFINS/ISS por regime.', audience: 'BOTH' },
  { code: 'ACCOUNTING_PAYROLL', label: 'Contabilidade — Folha/eSocial', monthlyPrice: 99.9, description: 'Folha de pagamento, eSocial, DCTFWeb, GFIP.', audience: 'BOTH' },
];

const COMBOS = [
  { name: 'Combo Mercado Pro', plans: ['ESSENCIAL'], modules: ['FISCAL_NFCE', 'WHATSAPP_INTEGRATION'], discount: 12, audience: 'BUSINESS' },
  { name: 'Combo Assistência Pro', plans: ['ESSENCIAL'], modules: ['WORK_ORDER', 'WHATSAPP_INTEGRATION', 'FISCAL_NFCE'], discount: 15, audience: 'BUSINESS' },
  { name: 'Combo Adega Pro', plans: ['ESSENCIAL'], modules: ['LIQUOR_LEDGER', 'FISCAL_NFCE'], discount: 10, audience: 'BUSINESS' },
  { name: 'Combo Padaria Pro', plans: ['PROFISSIONAL'], modules: ['RECIPE_BOM', 'FISCAL_NFCE'], discount: 15, audience: 'BUSINESS' },
  { name: 'Combo Farmácia Pro', plans: ['PROFISSIONAL'], modules: ['PHARMACY_SNGPC', 'FISCAL_NFCE', 'WHATSAPP_INTEGRATION'], discount: 18, audience: 'BUSINESS' },
];

function formatBRL(value: number) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function AnimatedCurrency({ value }: { value: number }) {
  const motionValue = useMotionValue(value);
  const formatted = useTransform(motionValue, (latest) => formatBRL(latest));

  useMemo(() => {
    animate(motionValue, value, { duration: 0.5, ease: [0.22, 1, 0.36, 1] });
  }, [value]);

  return <motion.span>{formatted}</motion.span>;
}

export function PricingCalculatorSection() {
  const [activeTab, setActiveTab] = useState<'B2B' | 'B2C' | 'ACCOUNTING'>('B2B');
  const [selectedPlan, setSelectedPlan] = useState(B2B_BASE_PLANS[0]);
  const [activeModules, setActiveModules] = useState<Set<string>>(new Set());

  const currentPlans = activeTab === 'B2B' ? B2B_BASE_PLANS : activeTab === 'B2C' ? B2C_PLANS : ACCOUNTING_PLANS;
  const currentAddons = ADDON_MODULES.filter(m => m.audience === activeTab || m.audience === 'BOTH');

  if (selectedPlan && !currentPlans.find(p => p.code === selectedPlan.code)) {
    setSelectedPlan(currentPlans[0]);
    setActiveModules(new Set());
  }

  const totalMrr = useMemo(() => {
    const addonsTotal = currentAddons
      .filter((m) => activeModules.has(m.code))
      .reduce((sum, m) => sum + m.monthlyPrice, 0);
    return selectedPlan.basePrice + addonsTotal;
  }, [selectedPlan, activeModules, currentAddons]);

  function toggleModule(code: string) {
    setActiveModules((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }

  return (
    <section className="py-24 px-6 lg:px-24 bg-zinc-950/60">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-12"
      >
        <h2 className="text-3xl font-bold lg:text-4xl">Monte o plano do seu negócio</h2>
        <p className="mt-2 max-w-2xl text-zinc-400">
          Pague apenas pelos módulos que o seu nicho realmente usa. Sem contrato de fidelidade, sem letra miúda.
        </p>
      </motion.div>

      <div className="mb-8 flex gap-4 flex-wrap">
        {(['B2B', 'B2C', 'ACCOUNTING'] as const).map((tab) => (
          <motion.button
            key={tab}
            onClick={() => { setActiveTab(tab); setActiveModules(new Set()); }}
            whileTap={{ scale: 0.98 }}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              activeTab === tab
                ? 'bg-indigo-600 text-white shadow-[0_0_30px_rgba(99,102,241,0.4)]'
                : 'bg-zinc-900/50 text-zinc-400 border border-zinc-800 hover:border-indigo-500/50'
            }`}
          >
            {tab === 'B2B' && '🏪 Lojista (B2B)'}
            {tab === 'B2C' && '🏠 Doméstico (B2C)'}
            {tab === 'ACCOUNTING' && '📊 Contabilidade'}
          </motion.button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2">
          <div className="flex gap-4 mb-8">
            {currentPlans.map((plan) => (
              <motion.button
                key={plan.code}
                onClick={() => { setSelectedPlan(plan); setActiveModules(new Set()); }}
                whileTap={{ scale: 0.98 }}
                className={`flex-1 rounded-2xl border p-6 text-left transition-all ${
                  selectedPlan.code === plan.code
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_30px_rgba(99,102,241,0.3)]'
                    : 'border-zinc-800 hover:border-zinc-600'
                }`}
              >
                <h3 className="text-xl font-semibold">{plan.label}</h3>
                <p className="text-zinc-400 text-sm mt-1">
                  {plan.includedModules.join(', ')}
                  {plan.maxConnectedAccounts !== undefined && (
                    <span> • Open Finance: {plan.maxConnectedAccounts === null ? 'Ilimitado' : plan.maxConnectedAccounts} conta(s)</span>
                  )}
                </p>
                <p className="mt-4 text-2xl font-bold">
                  {formatBRL(plan.basePrice)}<span className="text-sm font-normal text-zinc-500">/mês</span>
                </p>
              </motion.button>
            ))}
          </div>

          <div className="space-y-3">
            {currentAddons.map((moduleOption) => {
              const isActive = activeModules.has(moduleOption.code);
              return (
                <motion.button
                  key={moduleOption.code}
                  onClick={() => toggleModule(moduleOption.code)}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full flex items-center justify-between rounded-xl border p-4 transition-colors ${
                    isActive ? 'border-indigo-500/60 bg-indigo-500/5' : 'border-zinc-800'
                  }`}
                >
                  <div className="text-left">
                    <p className="font-medium">{moduleOption.label}</p>
                    <p className="text-xs text-zinc-500">{moduleOption.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-zinc-400">+{formatBRL(moduleOption.monthlyPrice)}/mês</span>
                    <span className={`h-6 w-11 rounded-full p-1 transition-colors ${isActive ? 'bg-indigo-500' : 'bg-zinc-700'}`}>
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

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="h-fit rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 backdrop-blur-md lg:sticky lg:top-10"
        >
          <p className="text-zinc-400 text-sm">Sua assinatura mensal estimada</p>
          <p className="text-4xl font-bold mt-2 mb-6">
            <AnimatedCurrency value={totalMrr} />
          </p>
          <button className="w-full rounded-xl bg-indigo-600 py-4 font-semibold shadow-[0_0_30px_rgba(99,102,241,0.4)]">
            Assinar agora
          </button>
        </motion.div>
      </div>

      <div className="mt-16">
        <h3 className="text-2xl font-bold mb-6">Combos por nicho (com desconto)</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {COMBOS.map((combo) => (
            <motion.div
              key={combo.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm"
            >
              <h4 className="font-semibold text-lg">{combo.name}</h4>
              <p className="text-sm text-zinc-400 mt-1">
                Plano: {combo.plans.join(', ')} + {combo.modules.length} módulos
              </p>
              <p className="text-2xl font-bold text-green-400 mt-3">
                -{combo.discount}% desconto
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
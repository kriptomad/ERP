"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { BASE_PLANS, MODULE_CATALOG } from "@filitech/shared";

const businessPlans = BASE_PLANS.filter((p) => p.audience === "BUSINESS");
const addons = Object.values(MODULE_CATALOG);

function AnimatedCurrency({ value }: { value: number }) {
  const mv = useMotionValue(value);
  const rounded = useTransform(mv, (v) => `R$ ${v.toFixed(2).replace(".", ",")}`);
  useEffect(() => {
    animate(mv, value, { duration: 0.5, ease: [0.22, 1, 0.36, 1] });
  }, [value, mv]);
  return <motion.span>{rounded}</motion.span>;
}

export function PricingCalculatorSection() {
  const [selectedPlan, setSelectedPlan] = useState(businessPlans[0]);
  const [activeModules, setActiveModules] = useState<Set<string>>(new Set());

  const totalMrr = useMemo(() => {
    const add =
      addons.filter((m) => activeModules.has(m.code)).reduce((s, m) => s + m.monthlyPrice, 0);
    return selectedPlan.basePrice + add;
  }, [selectedPlan, activeModules]);

  function toggle(code: string) {
    setActiveModules((prev) => {
      const n = new Set(prev);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });
  }

  return (
    <section id="precos" className="py-24 px-6 lg:px-24">
      <h2 className="text-3xl lg:text-4xl font-bold mb-4">Monte o plano do seu negócio</h2>
      <p className="text-zinc-400 mb-12 max-w-2xl">
        Valor base + módulos à la carte. Sem fidelidade. Free: 100 vendas/mês · 1 usuário · 200 SKUs.
      </p>
      <div className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          <div className="flex flex-col sm:flex-row gap-4">
            {businessPlans.map((plan) => (
              <button
                key={plan.code}
                type="button"
                onClick={() => setSelectedPlan(plan)}
                className={`flex-1 rounded-2xl border p-6 text-left ${
                  selectedPlan.code === plan.code
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-zinc-800"
                }`}
              >
                <h3 className="text-xl font-semibold">{plan.label}</h3>
                <p className="text-zinc-400 text-sm mt-1">
                  {plan.includedModules.join(" · ").toUpperCase()}
                </p>
                <p className="mt-4 text-2xl font-bold">
                  R$ {plan.basePrice.toFixed(2).replace(".", ",")}
                  <span className="text-sm font-normal text-zinc-500">/mês</span>
                </p>
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {addons.map((mod) => {
              const on = activeModules.has(mod.code);
              return (
                <button
                  key={mod.code}
                  type="button"
                  onClick={() => toggle(mod.code)}
                  className={`w-full flex items-center justify-between rounded-xl border p-4 text-left ${
                    on ? "border-indigo-500/60 bg-indigo-500/5" : "border-zinc-800"
                  }`}
                >
                  <div>
                    <p className="font-medium">{mod.label}</p>
                    <p className="text-xs text-zinc-500">{mod.description}</p>
                  </div>
                  <span className="text-sm text-zinc-400 shrink-0">
                    +R$ {mod.monthlyPrice.toFixed(2).replace(".", ",")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-800 p-8 h-fit sticky top-10 bg-zinc-900/60">
          <p className="text-zinc-400 text-sm">Assinatura mensal estimada</p>
          <p className="text-5xl font-bold mt-2 mb-6">
            <AnimatedCurrency value={totalMrr} />
          </p>
          <a
            href="/cadastro?type=business"
            className="block w-full text-center rounded-xl bg-indigo-600 py-4 font-semibold"
          >
            Assinar agora
          </a>
        </div>
      </div>
    </section>
  );
}

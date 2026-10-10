'use client';

import { motion } from 'framer-motion';

const fadeUpStagger = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center justify-between overflow-hidden px-10 lg:px-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.25),transparent_60%)]" />

      <div className="relative z-10 max-w-2xl">
        {['Gestão completa.', 'Em qualquer nicho.', 'Sem fricção.'].map((line, i) => (
          <motion.h1
            key={line}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={fadeUpStagger}
            className="text-5xl font-bold leading-[1.05] tracking-tight lg:text-7xl"
          >
            {line}
          </motion.h1>
        ))}

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="mt-6 max-w-lg text-lg text-zinc-400"
        >
          O ERP que se adapta ao seu negócio — mercado, assistência técnica, adega, padaria,
          farmácia ou varejo geral — com PDV que nunca para, mesmo sem internet.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="mt-10 flex gap-4"
        >
          <button className="group relative rounded-xl bg-brand-600 px-8 py-4 font-semibold shadow-[0_0_40px_rgba(99,102,241,0.4)] transition-shadow hover:shadow-[0_0_60px_rgba(99,102,241,0.6)]">
            Começar grátis
          </button>
          <button className="rounded-xl border border-zinc-700 px-8 py-4 font-semibold transition-all hover:border-brand-400 hover:shadow-[0_0_24px_rgba(99,102,241,0.3)]">
            Ver demonstração
          </button>
        </motion.div>
      </div>

      <div className="relative z-10 hidden h-[600px] w-[600px] items-center justify-center lg:flex">
        <div className="flex h-80 w-80 items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm">
          <div className="text-center">
            <div className="mx-auto mb-4 h-20 w-20 rounded-2xl bg-brand-600/20" />
            <p className="text-sm text-zinc-500">Filitech ERP Dashboard</p>
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
};

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center px-6 lg:px-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.25),transparent_60%)]" />
      <div className="relative z-10 max-w-3xl py-24">
        {["Gestão completa.", "Em qualquer nicho.", "Sem fricção."].map((line, i) => (
          <motion.h1
            key={line}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="text-5xl lg:text-7xl font-bold tracking-tight leading-[1.05]"
          >
            {line}
          </motion.h1>
        ))}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6 text-lg text-zinc-400 max-w-xl"
        >
          ERP para lojistas, contabilidade online com marketplace de escritórios e ERP
          doméstico para a casa — no mesmo backbone.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="mt-10 flex flex-wrap gap-3"
        >
          <a href="/cadastro" className="rounded-xl bg-indigo-600 px-6 py-3.5 font-semibold shadow-[0_0_40px_rgba(99,102,241,0.4)]">
            Começar grátis
          </a>
          <a href="#produtos" className="rounded-xl border border-zinc-700 px-6 py-3.5 font-semibold hover:border-indigo-400">
            Ver demonstração
          </a>
          <a href="/cadastro?type=accounting" className="rounded-xl border border-zinc-800 px-6 py-3.5 font-semibold text-zinc-300">
            Sou contador
          </a>
          <a href="/cadastro?type=personal" className="rounded-xl border border-zinc-800 px-6 py-3.5 font-semibold text-zinc-300">
            Organizar minha casa
          </a>
          <a href="/login" className="rounded-xl px-6 py-3.5 font-semibold text-indigo-400">
            Login
          </a>
        </motion.div>
      </div>
    </section>
  );
}

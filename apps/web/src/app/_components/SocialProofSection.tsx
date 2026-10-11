'use client';

import { motion } from 'framer-motion';

const TESTIMONIALS = [
  { name: 'Carlos Mendes', role: 'Proprietário — Mercado Bom Preço', quote: 'A gaveta cega mudou tudo. Parei de perder dinheiro no fechamento.', avatar: 'CM', color: '#6366F1' },
  { name: 'Ana Paula', role: 'Gerente — TechFix Assistência', quote: 'Aprovação via WhatsApp reduziu 70% o tempo de espera do cliente.', avatar: 'AP', color: '#06B6D4' },
  { name: 'Dr. Roberto', role: 'Farmacêutico — Drogaria Saúde+', quote: 'SNGPC integrado nos salvou de multas. FEFO automático é paz.', avatar: 'DR', color: '#10B981' },
  { name: 'Mariana & João', role: 'Casal — Filitech Pessoal', quote: 'Finalmente organizamos as finanças da casa. Open Finance é mágica.', avatar: 'MJ', color: '#F59E0B' },
  { name: 'Escritório Contábil Silva', role: 'Sócio — Contabilidade Online', quote: 'Geramos ECD/ECF direto do ERP dos clientes. Zero retrabalho.', avatar: 'EC', color: '#A855F7' },
];

export function SocialProofSection() {
  return (
    <section className="px-6 py-24 lg:px-24">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-16 text-center text-3xl font-bold lg:text-4xl"
      >
        Quem usa, recomenda.
      </motion.h2>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {TESTIMONIALS.map((t, i) => (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm" style={{ backgroundColor: t.color }}>
                {t.avatar}
              </div>
              <div>
                <p className="font-semibold text-sm">{t.name}</p>
                <p className="text-xs text-zinc-500">{t.role}</p>
              </div>
            </div>
            <p className="text-zinc-300">&ldquo;{t.quote}&rdquo;</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3 }}
        className="mt-16 text-center"
      >
        <a
          href="/cadastro?type=BUSINESS"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-indigo-600 font-semibold shadow-[0_0_30px_rgba(99,102,241,0.4)]"
        >
          Começar grátis agora
        </a>
      </motion.div>
    </section>
  );
}
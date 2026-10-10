'use client';

import { motion } from 'framer-motion';

const NICHES = [
  { name: 'Mercado', color: '#6366F1' },
  { name: 'Assistência Técnica', color: '#06B6D4' },
  { name: 'Adega', color: '#A855F7' },
  { name: 'Padaria', color: '#F59E0B' },
  { name: 'Farmácia', color: '#10B981' },
  { name: 'Varejo Geral', color: '#F43F5E' },
];

export function NicheShowcaseSection() {
  return (
    <section className="px-10 py-32 lg:px-24">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-16 text-4xl font-bold"
      >
        Um sistema. Seis negócios.
      </motion.h2>

      <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
        {NICHES.map((niche, i) => (
          <motion.div
            key={niche.name}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, duration: 0.5 }}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 backdrop-blur-sm transition-all hover:border-opacity-100"
            style={{ borderColor: `${niche.color}33` }}
            whileHover={{ boxShadow: `0 0 40px ${niche.color}33` }}
          >
            <h3 className="text-2xl font-semibold" style={{ color: niche.color }}>
              {niche.name}
            </h3>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

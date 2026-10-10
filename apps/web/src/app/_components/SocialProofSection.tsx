'use client';

import { motion } from 'framer-motion';

const TESTIMONIALS = [
  {
    name: 'Carlos Mendes',
    role: 'Proprietário — Mercado Bom Preço',
    quote: 'O Filitech organizou completamente meu estoque. A curva ABC mudou a forma como faço compras.',
  },
  {
    name: 'Ana Paula Rodrigues',
    role: 'Gerente — Assistência Técnica TechFix',
    quote: 'A aprovação de orçamento via WhatsApp reduziu em 70% o tempo de espera dos clientes.',
  },
  {
    name: 'Roberto Almeida',
    role: 'Farmacêutico — Drogaria Saúde+',
    quote: 'O controle de lote e validade com FEFO é essencial. O SNGPC integrado nos salvou de multas.',
  },
];

export function SocialProofSection() {
  return (
    <section className="px-10 py-32 lg:px-24">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-16 text-center text-4xl font-bold"
      >
        Quem usa, recomenda.
      </motion.h2>

      <div className="grid gap-8 md:grid-cols-3">
        {TESTIMONIALS.map((testimonial, i) => (
          <motion.div
            key={testimonial.name}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8"
          >
            <p className="mb-6 text-zinc-300">&ldquo;{testimonial.quote}&rdquo;</p>
            <div>
              <p className="font-semibold">{testimonial.name}</p>
              <p className="text-sm text-zinc-500">{testimonial.role}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

'use client';

import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const NICHES = [
  { name: 'Mercado', color: '#6366F1', features: ['Gaveta cega', 'Curva ABC', 'Alerta validade 30/60d', 'Balança Toledo', 'Fidelidade'] },
  { name: 'Assistência Técnica', color: '#06B6D4', features: ['Checklist assinado', 'Orçamento com validade', 'Aprovação WhatsApp', 'Comissão por técnico', 'IMEI/Garantia'] },
  { name: 'Adega', color: '#A855F7', features: ['Conta-corrente cascos', 'Cobrança reposição', 'Preço cascata', 'Unidade/Caixa/Revenda', 'Rastreabilidade'] },
  { name: 'Padaria', color: '#F59E0B', features: ['Ficha técnica + rendimento', 'CMV automático', 'Produção diária', 'Perdas desvinculadas', 'Grade insumos'] },
  { name: 'Farmácia', color: '#10B981', features: ['SNGPC/SNCR', 'Retenção receita', 'FEFO', 'Bloqueio lote vencido', 'Controlados'] },
  { name: 'Varejo Geral', color: '#F43F5E', features: ['Crediário com limite', 'Devoluções', 'Grade cor/tamanho', 'Split pagamento', 'Omnichannel'] },
  { name: 'Restaurante', color: '#EC4899', features: ['Delivery iFood', 'Mesa/comanda', 'Cardápio digital', 'Cozinha KDS', 'Split gorjeta'] },
  { name: 'Ótica', color: '#8B5CF6', features: ['Receita oftalmológica', 'Lentes/armações', 'Laboratório', 'Garantia', 'Convênio'] },
  { name: 'Petshop', color: '#F97316', features: ['Banho/tosa agenda', 'Prontuário animal', 'Vacinas', 'Produtos/serviços', 'Fidelidade'] },
  { name: 'Moda', color: '#EAB308', features: ['Grade cor/tamanho', 'Coleções', 'Troca/devolução', 'Consignação', 'Marketplace'] },
  { name: 'Papelaria', color: '#22C55E', features: ['Lista escolar', 'Kits', 'Impressão', 'Convênios', 'Entrega'] },
  { name: 'Beleza', color: '#06B6D4', features: ['Agenda profissional', 'Comissão', 'Produtos/serviços', 'Pacotes', 'Fidelidade'] },
];

export function NicheShowcaseSection() {
  const sectionRef = useGSAP(() => {
    const cards = gsap.utils.toArray<HTMLElement>('.niche-card');

    cards.forEach((card, index) => {
      gsap.to(card, {
        yPercent: -10 * (index % 2 === 0 ? 1 : -1),
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.6,
        },
      });
    });

    gsap.from(cards, {
      opacity: 0,
      y: 60,
      stagger: 0.08,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
    });
  }, { scope: sectionRef });

  return (
    <section ref={sectionRef} className="py-24 px-6 lg:px-24">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-16 text-center text-3xl font-bold lg:text-4xl"
      >
        Um sistema. Dezoito negócios. Três produtos.
      </motion.h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {NICHES.map((niche, i) => (
          <motion.div
            key={niche.name}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06, duration: 0.5 }}
            className="niche-card group rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm transition-all hover:border-opacity-100"
            style={{ borderColor: `${niche.color}33` }}
            whileHover={{ boxShadow: `0 0 40px ${niche.color}33` }}
          >
            <h3 className="text-xl font-semibold mb-3" style={{ color: niche.color }}>
              {niche.name}
            </h3>
            <ul className="space-y-1 text-sm text-zinc-400">
              {niche.features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: niche.color }} />
                  {f}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
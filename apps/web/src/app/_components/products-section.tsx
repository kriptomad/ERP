"use client";

const PRODUCTS = [
  {
    id: "erp",
    title: "Filitech ERP",
    audience: "Lojistas · B2B",
    color: "#6366F1",
    description:
      "PDV offline-first, estoque, financeiro, fiscal, CRM e 18 nichos — gaveta cega, FEFO, O.S., cascos, SNGPC, crediário, fidelidade.",
    cta: "Começar grátis no negócio",
    href: "/cadastro?type=business",
  },
  {
    id: "accounting",
    title: "Contabilidade Online",
    audience: "Escritórios + clientes · B2B",
    color: "#10B981",
    description:
      "Contrate escritório parceiro no marketplace ou exporte SPED/XML. Procuração eletrônica, tarefas, ECD/ECF, honorários e Informe de Rendimentos.",
    cta: "Ver escritórios / Sou contador",
    href: "/cadastro?type=accounting",
  },
  {
    id: "personal",
    title: "Filitech Pessoal",
    audience: "Casa e vida · B2C",
    color: "#A855F7",
    description:
      "ERP doméstico: contas, orçamento, dívidas, Open Finance (Pluggy), patrimônio, splits de casal e Carnê-Leão — sem CNPJ.",
    cta: "Organizar minha casa",
    href: "/cadastro?type=personal",
  },
];

export function ProductsSection() {
  return (
    <section id="produtos" className="py-24 px-6 lg:px-24 border-t border-zinc-900">
      <h2 className="text-3xl lg:text-4xl font-bold mb-4">Três produtos. Um backbone.</h2>
      <p className="text-zinc-400 max-w-2xl mb-12">
        Multi-tenant, billing, 2FA e filas compartilhados. O que muda é o menu, o onboarding e as
        regras de domínio.
      </p>
      <div className="grid md:grid-cols-3 gap-6">
        {PRODUCTS.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 flex flex-col"
            style={{ boxShadow: `0 0 0 1px ${p.color}22` }}
          >
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: p.color }}>
              {p.audience}
            </p>
            <h3 className="text-2xl font-semibold mt-2">{p.title}</h3>
            <p className="text-zinc-400 text-sm mt-4 flex-1">{p.description}</p>
            <a
              href={p.href}
              className="mt-8 inline-flex justify-center rounded-xl px-4 py-3 font-semibold text-sm"
              style={{ backgroundColor: p.color }}
            >
              {p.cta}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

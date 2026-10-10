"use client";

import Link from "next/link";

export default function PessoalHome() {
  return (
    <main className="min-h-screen bg-canvas text-zinc-100 p-8">
      <h1 className="text-2xl font-bold mb-2">Filitech Pessoal</h1>
      <p className="text-zinc-400 mb-10">ERP doméstico — contas, orçamento, dívidas, Open Finance</p>
      <div className="grid sm:grid-cols-2 gap-4 max-w-3xl">
        {[
          ["Contas", "/app/pessoal/contas"],
          ["Lançamentos", "/app/pessoal/lancamentos"],
          ["Dívidas (Avalanche/Snowball)", "/app/pessoal/dividas"],
          ["Carnê-Leão", "/app/pessoal/carne-leao"],
          ["Open Finance", "/app/pessoal/open-finance"],
          ["Cobrança", "/app/cobranca"],
        ].map(([label, href]) => (
          <Link key={href} href={href}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 hover:border-purple-500/50">
            {label}
          </Link>
        ))}
      </div>
    </main>
  );
}

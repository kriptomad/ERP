"use client";

import Link from "next/link";

export default function ContabilHome() {
  return (
    <main className="min-h-screen bg-canvas text-zinc-100 p-8">
      <h1 className="text-2xl font-bold mb-2">Filitech Contábil</h1>
      <p className="text-zinc-400 mb-10">Escritório — procurações, tarefas, marketplace</p>
      <div className="grid sm:grid-cols-2 gap-4 max-w-3xl">
        {[
          ["Procuracões pendentes", "/app/contabil/engagements"],
          ["Carteira de clientes", "/app/contabil/clientes"],
          ["Perfil marketplace", "/app/contabil/perfil"],
          ["Tarefas recorrentes", "/app/contabil/tarefas"],
        ].map(([label, href]) => (
          <Link key={href} href={href}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 hover:border-emerald-500/50">
            {label}
          </Link>
        ))}
      </div>
    </main>
  );
}

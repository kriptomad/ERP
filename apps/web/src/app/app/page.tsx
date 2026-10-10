"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AppHome() {
  const [tenant, setTenant] = useState<{ tradeName?: string; tenantType?: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("filitech_tenant");
      if (raw) setTenant(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  return (
    <main className="min-h-screen bg-canvas text-zinc-100 p-8">
      <header className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-2xl font-bold">{tenant?.tradeName ?? "Filitech ERP"}</h1>
          <p className="text-zinc-500 text-sm">{tenant?.tenantType ?? "BUSINESS"}</p>
        </div>
        <Link href="/" className="text-sm text-zinc-400 hover:text-white">Sair</Link>
      </header>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
        {[
          ["PDV / Vendas", "/app/pdv"],
          ["Produtos", "/app/produtos"],
          ["Clientes", "/app/clientes"],
          ["Caixa", "/app/caixa"],
          ["O.S.", "/app/os"],
          ["Cobrança", "/app/cobranca"],
          ["2FA", "/app/seguranca"],
          ["Contador", "/app/contador"],
        ].map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 hover:border-indigo-500/50 transition-colors"
          >
            <span className="font-semibold">{label}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}

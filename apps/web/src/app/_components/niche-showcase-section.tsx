"use client";

import { NICHES } from "@filitech/shared";

export function NicheShowcaseSection() {
  return (
    <section className="py-24 px-6 lg:px-24 bg-zinc-950/50">
      <h2 className="text-3xl lg:text-4xl font-bold mb-4">Um sistema. Seis negócios (e mais).</h2>
      <p className="text-zinc-400 max-w-2xl mb-12">
        Cada nicho com facilidades reais de operação — não texto genérico de ERP.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {NICHES.map((niche) => (
          <div
            key={niche.code}
            className="rounded-2xl border p-6 bg-zinc-900/40"
            style={{ borderColor: `${niche.color}33` }}
          >
            <h3 className="text-xl font-semibold" style={{ color: niche.color }}>
              {niche.name}
            </h3>
            <ul className="mt-4 space-y-2">
              {niche.features.map((f) => (
                <li key={f} className="text-sm text-zinc-400 flex gap-2">
                  <span style={{ color: niche.color }}>·</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

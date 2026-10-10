"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("filitech_token")}`,
  };
}

export default function CaixaPage() {
  const [registerId, setRegisterId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [float, setFloat] = useState(100);
  const [counted, setCounted] = useState({ cash: 0, debit: 0, credit: 0, pix: 0 });

  async function openReg() {
    const res = await fetch(`${API}/api/v1/cash-registers/open`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ openingFloat: float }),
    });
    const j = await res.json();
    if (j.success) {
      setRegisterId(j.data.id);
      setMsg(`Caixa aberto ${j.data.id}`);
    } else setMsg(j.error?.code ?? "erro");
  }

  async function closeBlind() {
    if (!registerId) return;
    const res = await fetch(`${API}/api/v1/cash-registers/${registerId}/close-blind`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        countedCash: counted.cash,
        countedDebit: counted.debit,
        countedCredit: counted.credit,
        countedPix: counted.pix,
      }),
    });
    const j = await res.json();
    setMsg(j.success ? `Fechado · diff ${j.data.difference}` : j.error?.code);
  }

  return (
    <main className="min-h-screen bg-canvas text-zinc-100 p-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Caixa · gaveta cega</h1>
      <label className="block text-sm text-zinc-400 mb-1">Troco inicial</label>
      <input
        type="number"
        value={float}
        onChange={(e) => setFloat(Number(e.target.value))}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 mb-4"
      />
      <button type="button" onClick={openReg} className="w-full rounded-xl bg-indigo-600 py-3 font-semibold mb-8">
        Abrir caixa
      </button>

      <h2 className="font-semibold mb-3">Fechamento cego (sem ver expected)</h2>
      {(["cash", "debit", "credit", "pix"] as const).map((k) => (
        <label key={k} className="block mb-2">
          <span className="text-xs text-zinc-500 uppercase">{k}</span>
          <input
            type="number"
            value={counted[k]}
            onChange={(e) => setCounted((c) => ({ ...c, [k]: Number(e.target.value) }))}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2"
          />
        </label>
      ))}
      <button type="button" onClick={closeBlind} className="w-full rounded-xl border border-zinc-600 py-3 mt-4">
        Fechar gaveta cega
      </button>
      {msg && <p className="mt-4 text-sm text-zinc-400">{msg}</p>}
    </main>
  );
}

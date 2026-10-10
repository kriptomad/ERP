"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function CarneLeaoPage() {
  const [value, setValue] = useState(5000);
  const [out, setOut] = useState<string | null>(null);

  async function calc() {
    const token = localStorage.getItem("filitech_token");
    const res = await fetch(`${API}/api/v1/personal/carne-leao`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ rendimentoTributavel: value }),
    });
    setOut(JSON.stringify(await res.json(), null, 2));
  }

  return (
    <main className="min-h-screen bg-canvas text-zinc-100 p-8 max-w-xl">
      <h1 className="text-2xl font-bold mb-4">Carnê-Leão (sugestivo)</h1>
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 mb-4"
      />
      <button type="button" onClick={calc} className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold">
        Calcular
      </button>
      {out && <pre className="mt-6 text-xs text-zinc-400 border border-zinc-800 rounded-xl p-4">{out}</pre>}
    </main>
  );
}

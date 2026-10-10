"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function DividasPage() {
  const [result, setResult] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<"AVALANCHE" | "SNOWBALL">("AVALANCHE");

  async function run() {
    const token = localStorage.getItem("filitech_token");
    const res = await fetch(`${API}/api/v1/personal/debt-payoff`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        strategy,
        extraMonthlyBudget: 500,
        debts: [
          {
            id: "1",
            name: "Cartão",
            remainingAmount: 5000,
            interestRateMonthly: 2.5,
            minimumInstallment: 200,
          },
          {
            id: "2",
            name: "Empréstimo",
            remainingAmount: 8000,
            interestRateMonthly: 1.2,
            minimumInstallment: 350,
          },
        ],
      }),
    });
    const j = await res.json();
    setResult(JSON.stringify(j, null, 2));
  }

  return (
    <main className="min-h-screen bg-canvas text-zinc-100 p-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-4">Quitação de dívidas</h1>
      <div className="flex gap-3 mb-4">
        <button
          type="button"
          onClick={() => setStrategy("AVALANCHE")}
          className={`px-4 py-2 rounded-xl border ${strategy === "AVALANCHE" ? "border-indigo-500" : "border-zinc-700"}`}
        >
          Avalanche
        </button>
        <button
          type="button"
          onClick={() => setStrategy("SNOWBALL")}
          className={`px-4 py-2 rounded-xl border ${strategy === "SNOWBALL" ? "border-indigo-500" : "border-zinc-700"}`}
        >
          Snowball
        </button>
        <button type="button" onClick={run} className="rounded-xl bg-indigo-600 px-6 py-2 font-semibold">
          Calcular
        </button>
      </div>
      {result && <pre className="text-xs text-zinc-400 overflow-auto border border-zinc-800 rounded-xl p-4">{result}</pre>}
    </main>
  );
}

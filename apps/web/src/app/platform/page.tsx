"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function PlatformAdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenants, setTenants] = useState<unknown[] | null>(null);
  const [plans, setPlans] = useState<unknown[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const headers = {
      "X-Platform-Admin-Email": email,
      "X-Platform-Admin-Password": password,
    };
    try {
      const [t, p] = await Promise.all([
        fetch(`${API}/api/v1/platform/tenants`, { headers }).then((r) => r.json()),
        fetch(`${API}/api/v1/platform/plans`, { headers }).then((r) => r.json()),
      ]);
      if (!t.success) {
        setError(t.error?.code ?? "UNAUTHORIZED");
        return;
      }
      setTenants(t.data);
      setPlans(p.data);
    } catch {
      setError("API offline");
    }
  }

  return (
    <main className="min-h-screen bg-canvas text-zinc-100 p-8">
      <h1 className="text-2xl font-bold mb-6">Painel do dono</h1>
      <div className="flex flex-wrap gap-3 mb-8 max-w-xl">
        <input
          placeholder="Admin e-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 flex-1"
        />
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 flex-1"
        />
        <button onClick={load} className="rounded-xl bg-indigo-600 px-6 py-2 font-semibold">
          Carregar
        </button>
      </div>
      {error && <p className="text-rose-400 mb-4">{error}</p>}
      {tenants && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">Tenants ({tenants.length})</h2>
          <pre className="text-xs text-zinc-400 overflow-auto max-h-80 rounded-xl border border-zinc-800 p-4">
            {JSON.stringify(tenants, null, 2)}
          </pre>
        </section>
      )}
      {plans && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Planos</h2>
          <pre className="text-xs text-zinc-400 overflow-auto max-h-80 rounded-xl border border-zinc-800 p-4">
            {JSON.stringify(plans, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, tenantSlug: tenantSlug || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.code ?? "Falha no login");
        return;
      }
      localStorage.setItem("filitech_token", json.data.token);
      localStorage.setItem("filitech_tenant", JSON.stringify(json.data.tenant));
      if (json.data.requires2fa) {
        window.location.href = "/login/2fa";
        return;
      }
      const t = json.data.tenant?.tenantType;
      if (t === "PERSONAL") window.location.href = "/app/pessoal";
      else if (t === "ACCOUNTING_OFFICE") window.location.href = "/app/contabil";
      else window.location.href = "/app";
    } catch {
      setError("Não foi possível conectar à API");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-canvas flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8">
        <h1 className="text-2xl font-bold">Entrar no Filitech</h1>
        <p className="text-zinc-400 text-sm mt-2">ERP · Contábil · Pessoal</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-sm text-zinc-400">E-mail</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-indigo-500" />
          </label>
          <label className="block">
            <span className="text-sm text-zinc-400">Senha</span>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-indigo-500" />
          </label>
          <label className="block">
            <span className="text-sm text-zinc-400">Slug (opcional)</span>
            <input type="text" value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-indigo-500" />
          </label>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full rounded-xl bg-indigo-600 py-3 font-semibold disabled:opacity-50">
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-zinc-500">
          Não tem conta? <Link href="/cadastro" className="text-indigo-400 hover:underline">Criar grátis</Link>
        </p>
      </div>
    </main>
  );
}

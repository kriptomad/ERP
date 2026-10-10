"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TERMS_VERSION = "2026-10-01";
const PRIVACY_VERSION = "2026-10-01";

type Mode = "business" | "personal" | "accounting";

function CadastroForm() {
  const params = useSearchParams();
  const t = params.get("type");
  const initial: Mode =
    t === "personal" ? "personal" : t === "accounting" ? "accounting" : "business";

  const [mode, setMode] = useState<Mode>(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [tradeName, setTradeName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [invitePartnerEmail, setInvitePartnerEmail] = useState("");
  const [displayName, setDisplayName] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!termsAccepted || !privacyAccepted) {
      setError("Aceite Termos e Privacidade (LGPD)");
      return;
    }
    setLoading(true);
    try {
      const path =
        mode === "business"
          ? "/api/v1/auth/onboard/business"
          : mode === "personal"
            ? "/api/v1/auth/onboard/personal"
            : "/api/v1/auth/onboard/accounting-office";

      const body =
        mode === "business"
          ? {
              tradeName,
              legalName: legalName || tradeName,
              cnpj,
              ownerName,
              ownerEmail,
              ownerPassword,
              termsVersion: TERMS_VERSION,
              privacyVersion: PRIVACY_VERSION,
              termsAccepted: true as const,
              privacyAccepted: true as const,
            }
          : mode === "personal"
            ? {
                householdName,
                ownerName,
                ownerEmail,
                ownerPassword,
                termsVersion: TERMS_VERSION,
                privacyVersion: PRIVACY_VERSION,
                termsAccepted: true as const,
                privacyAccepted: true as const,
                invitePartnerEmail: invitePartnerEmail || undefined,
              }
            : {
                tradeName,
                legalName: legalName || tradeName,
                cnpj,
                ownerName,
                ownerEmail,
                ownerPassword,
                termsVersion: TERMS_VERSION,
                privacyVersion: PRIVACY_VERSION,
                termsAccepted: true as const,
                privacyAccepted: true as const,
                displayName: displayName || tradeName,
                servicesOffered: ["FULL_BOOKKEEPING", "TAX_FILING"],
              };

      const res = await fetch(`${API}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.code ?? "Falha no cadastro");
        return;
      }
      localStorage.setItem("filitech_token", json.data.token);
      localStorage.setItem("filitech_tenant", JSON.stringify(json.data.tenant));
      if (mode === "personal") window.location.href = "/app/pessoal";
      else if (mode === "accounting") window.location.href = "/app/contabil";
      else window.location.href = "/app";
    } catch {
      setError("Não foi possível conectar à API");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-canvas flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8">
        <h1 className="text-2xl font-bold">Criar conta grátis</h1>
        <p className="text-zinc-400 text-sm mt-2">Sem cartão. LGPD com consentimento explícito.</p>

        <div className="mt-6 grid grid-cols-3 gap-2">
          {(
            [
              ["business", "Negócio"],
              ["personal", "Casa"],
              ["accounting", "Contador"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-xl py-2 text-sm font-medium border ${
                mode === m ? "border-indigo-500 bg-indigo-500/10" : "border-zinc-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          {mode === "personal" ? (
            <>
              <Field label="Nome da residência" value={householdName} onChange={setHouseholdName} required />
              <Field label="Convidar parceiro(a)" value={invitePartnerEmail} onChange={setInvitePartnerEmail} />
            </>
          ) : (
            <>
              <Field label="Nome fantasia" value={tradeName} onChange={setTradeName} required />
              <Field label="Razão social" value={legalName} onChange={setLegalName} />
              <Field label="CNPJ" value={cnpj} onChange={setCnpj} required />
              {mode === "accounting" && (
                <Field label="Nome no marketplace" value={displayName} onChange={setDisplayName} />
              )}
            </>
          )}
          <Field label="Seu nome" value={ownerName} onChange={setOwnerName} required />
          <Field label="E-mail" value={ownerEmail} onChange={setOwnerEmail} type="email" required />
          <Field label="Senha (mín. 8)" value={ownerPassword} onChange={setOwnerPassword} type="password" required />

          <label className="flex items-start gap-3 text-sm text-zinc-300">
            <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-1" />
            <span>Aceito os Termos de Uso (v. {TERMS_VERSION})</span>
          </label>
          <label className="flex items-start gap-3 text-sm text-zinc-300">
            <input type="checkbox" checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)} className="mt-1" />
            <span>Aceito a Política de Privacidade (v. {PRIVACY_VERSION})</span>
          </label>

          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={loading || !termsAccepted || !privacyAccepted}
            className="w-full rounded-xl bg-indigo-600 py-3 font-semibold disabled:opacity-40"
          >
            {loading ? "Criando…" : "Criar conta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Já tem conta? <Link href="/login" className="text-indigo-400 hover:underline">Entrar</Link>
        </p>
      </div>
    </main>
  );
}

function Field({
  label, value, onChange, type = "text", required,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm text-zinc-400">{label}</span>
      <input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-indigo-500" />
    </label>
  );
}

export default function CadastroPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-canvas" />}>
      <CadastroForm />
    </Suspense>
  );
}

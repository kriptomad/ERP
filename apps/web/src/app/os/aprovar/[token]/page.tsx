"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function ApproveOsPage() {
  const params = useParams();
  const token = String(params.token ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function approve() {
    const res = await fetch(`${API}/api/v1/work-orders/public/approve/${token}`, {
      method: "POST",
    });
    const json = await res.json();
    if (res.ok) {
      setOk(true);
      setMsg(`O.S. aprovada — status: ${json.data?.status}`);
    } else {
      setMsg(json.error?.code ?? "Falha");
    }
  }

  return (
    <main className="min-h-screen bg-canvas text-zinc-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
        <h1 className="text-xl font-bold mb-2">Aprovar ordem de serviço</h1>
        <p className="text-zinc-400 text-sm mb-8">
          Link de uso único · válido por 72 horas
        </p>
        {!ok && (
          <button
            onClick={approve}
            className="w-full rounded-xl bg-indigo-600 py-3 font-semibold"
          >
            Confirmar aprovação
          </button>
        )}
        {msg && <p className={`mt-6 text-sm ${ok ? "text-emerald-400" : "text-rose-400"}`}>{msg}</p>}
      </div>
    </main>
  );
}

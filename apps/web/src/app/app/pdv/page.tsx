"use client";

import { useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const OFFLINE_KEY = "filitech_offline_sales";

type Product = { id: string; name: string; sku: string; unitPrice: string | number; stockQuantity: string | number };
type CartLine = { productId: string; name: string; quantity: number; unitPrice: number };

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("filitech_token") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function PdvPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [msg, setMsg] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    fetch(`${API}/api/v1/products`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setProducts(j.data);
      })
      .catch(() => setMsg("API offline — use fila local"));
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const total = useMemo(
    () => cart.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
    [cart],
  );

  function addProduct(p: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          quantity: 1,
          unitPrice: Number(p.unitPrice),
        },
      ];
    });
  }

  async function checkout() {
    if (!cart.length) return;
    const payload = {
      paymentMethod,
      items: cart.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
    };

    if (!navigator.onLine) {
      const offlineId = crypto.randomUUID();
      const queue = JSON.parse(localStorage.getItem(OFFLINE_KEY) ?? "[]");
      queue.push({ offlineId, ...payload, createdAt: new Date().toISOString() });
      localStorage.setItem(OFFLINE_KEY, JSON.stringify(queue));
      setMsg(`Venda offline enfileirada (${offlineId.slice(0, 8)})`);
      setCart([]);
      return;
    }

    try {
      const res = await fetch(`${API}/api/v1/pos/sales`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg(j.error?.code ?? "Falha");
        return;
      }
      setMsg(`Venda OK · R$ ${Number(j.data.totalAmount).toFixed(2)}`);
      setCart([]);
    } catch {
      setMsg("Erro de rede");
    }
  }

  async function syncOffline() {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_KEY) ?? "[]");
    if (!queue.length) {
      setMsg("Fila vazia");
      return;
    }
    const res = await fetch(`${API}/api/v1/pos/sync-offline`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ sales: queue }),
    });
    const j = await res.json();
    if (j.success) {
      localStorage.setItem(OFFLINE_KEY, "[]");
      setMsg(`Sync: ${JSON.stringify(j.data)}`);
    } else setMsg("Sync falhou");
  }

  return (
    <main className="min-h-screen bg-canvas text-zinc-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">PDV</h1>
        <span className={`text-sm ${online ? "text-emerald-400" : "text-amber-400"}`}>
          {online ? "Online" : "Offline"}
        </span>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-2 max-h-[60vh] overflow-auto">
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => addProduct(p)}
              className="w-full text-left rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 hover:border-indigo-500/50"
            >
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-zinc-500">
                {p.sku} · R$ {Number(p.unitPrice).toFixed(2)} · est. {Number(p.stockQuantity)}
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-zinc-800 p-6 bg-zinc-900/40">
          <h2 className="font-semibold mb-4">Carrinho</h2>
          {cart.map((l) => (
            <div key={l.productId} className="flex justify-between text-sm py-1">
              <span>
                {l.quantity}× {l.name}
              </span>
              <span>R$ {(l.quantity * l.unitPrice).toFixed(2)}</span>
            </div>
          ))}
          <p className="text-2xl font-bold mt-4">R$ {total.toFixed(2)}</p>

          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="mt-4 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2"
          >
            {["CASH", "PIX", "DEBIT", "CREDIT", "CREDIT_STORE"].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={checkout}
            className="mt-4 w-full rounded-xl bg-indigo-600 py-3 font-semibold"
          >
            Finalizar
          </button>
          <button
            type="button"
            onClick={syncOffline}
            className="mt-2 w-full rounded-xl border border-zinc-700 py-2 text-sm"
          >
            Sincronizar fila offline
          </button>
          {msg && <p className="mt-4 text-sm text-zinc-400">{msg}</p>}
        </div>
      </div>
    </main>
  );
}

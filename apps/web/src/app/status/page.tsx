"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function StatusPage() {
  const [data, setData] = useState<unknown>(null);

  useEffect(() => {
    fetch(`${API}/status`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ api: "down" }));
  }, []);

  return (
    <main className="min-h-screen bg-canvas text-zinc-100 p-8">
      <h1 className="text-2xl font-bold mb-4">Status Filitech</h1>
      <pre className="text-sm text-zinc-400 border border-zinc-800 rounded-xl p-6">
        {JSON.stringify(data, null, 2)}
      </pre>
    </main>
  );
}

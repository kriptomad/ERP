import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Filitech ERP — Gestão completa. Em qualquer nicho. Sem fricção.",
  description:
    "ERP multi-nicho, contabilidade online com marketplace e ERP doméstico. PDV offline, fiscal, Open Finance.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-canvas text-zinc-100 antialiased">{children}</body>
    </html>
  );
}

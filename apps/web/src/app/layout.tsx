import type { Metadata } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "./_components/sw-register";

export const metadata: Metadata = {
  title: "Filitech ERP — Gestão completa. Em qualquer nicho. Sem fricção.",
  description:
    "ERP multi-nicho, contabilidade online com marketplace e ERP doméstico. PDV offline, fiscal, Open Finance.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-canvas text-zinc-100 antialiased">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}

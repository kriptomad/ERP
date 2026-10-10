import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Filitech ERP — Gestão completa para qualquer negócio',
  description: 'O ERP que se adapta ao seu negócio — mercado, assistência técnica, adega, padaria, farmácia ou varejo geral — com PDV que nunca para, mesmo sem internet.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-surface-900 text-zinc-100 antialiased`}>
        {children}
      </body>
    </html>
  );
}

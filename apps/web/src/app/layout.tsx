import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { HeroSection } from './_components/HeroSection';
import { NicheShowcaseSection } from './_components/NicheShowcaseSection';
import { PricingCalculatorSection } from './_components/PricingCalculatorSection';
import { SocialProofSection } from './_components/SocialProofSection';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Filitech ERP — Gestão completa para lojistas, contadores e vida doméstica',
  description: 'ERP multi-nicho com PDV offline, fiscal, CRM + Contabilidade Online (marketplace, procuração e-CAC, SPED) + ERP Doméstico (Open Finance, orçamento, dívidas). Comece grátis.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-[#05060A] text-zinc-100 antialiased`}>
        {children}
      </body>
    </html>
  );
}
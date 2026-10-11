'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

const FOOTER_LINKS = {
  Produto: [
    { label: 'ERP Lojista', href: '/cadastro?type=BUSINESS' },
    { label: 'Contabilidade Online', href: '/cadastro?type=ACCOUNTING_OFFICE' },
    { label: 'ERP Doméstico', href: '/cadastro?type=PERSONAL' },
    { label: 'Preços', href: '#precos' },
    { label: 'API', href: '/docs/api' },
  ],
  Empresa: [
    { label: 'Sobre', href: '/sobre' },
    { label: 'Blog', href: '/blog' },
    { label: 'Carreiras', href: '/carreiras' },
    { label: 'Imprensa', href: '/imprensa' },
  ],
  Juridico: [
    { label: 'Termos de Uso', href: '/legal/termos' },
    { label: 'Política de Privacidade', href: '/legal/privacidade' },
    { label: 'Subprocessadores', href: '/legal/subprocessadores' },
    { label: 'Cookies', href: '/legal/cookies' },
  ],
  Suporte: [
    { label: 'Central de Ajuda', href: '/ajuda' },
    { label: 'Status', href: '/status' },
    { label: 'Contato', href: '/contato' },
    { label: 'Comunidade', href: '/comunidade' },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-zinc-900 bg-zinc-950/50">
      <div className="max-w-7xl mx-auto px-6 py-16 lg:px-24">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <p className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              Filitech
            </p>
            <p className="mt-4 text-zinc-400 max-w-xs">
              O sistema operacional para o seu negócio — seja uma loja, um escritório de contabilidade ou a sua casa.
            </p>
            <div className="mt-6 flex gap-4">
              <a href="#" className="text-zinc-500 hover:text-white transition-colors" aria-label="Twitter">𝕏</a>
              <a href="#" className="text-zinc-500 hover:text-white transition-colors" aria-label="LinkedIn">in</a>
              <a href="#" className="text-zinc-500 hover:text-white transition-colors" aria-label="GitHub">⌘</a>
              <a href="#" className="text-zinc-500 hover:text-white transition-colors" aria-label="Discord">⎋</a>
            </div>
          </div>
          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-semibold mb-4">{category}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-zinc-400 hover:text-white transition-colors text-sm">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-8 border-t border-zinc-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-zinc-500 text-sm">
            © {new Date().getFullYear()} Filitech. Todos os direitos reservados.
          </p>
          <div className="flex gap-6 text-sm text-zinc-500">
            <Link href="/legal/termos" className="hover:text-white transition-colors">Termos</Link>
            <Link href="/legal/privacidade" className="hover:text-white transition-colors">Privacidade</Link>
            <Link href="/legal/cookies" className="hover:text-white transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
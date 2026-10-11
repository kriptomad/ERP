'use client';

import { motion } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { Environment, Float } from '@react-three/drei';

const fadeUpStagger = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
};

const products = [
  { name: 'ERP Lojista', icon: 'Store', color: '#6366F1', desc: 'PDV offline, estoque, fiscal, CRM, multi-filial', href: '/cadastro?type=BUSINESS' },
  { name: 'Contabilidade Online', icon: 'Calculator', color: '#06B6D4', desc: 'Marketplace de contadores, procuração e-CAC, geração SPED', href: '/cadastro?type=ACCOUNTING_OFFICE' },
  { name: 'ERP Doméstico', icon: 'Home', color: '#10B981', desc: 'Open Finance, orçamento, dívidas, patrimônio, casal', href: '/cadastro?type=PERSONAL' },
];

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-between overflow-hidden px-6 lg:px-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.25),transparent_60%)]" />

      <div className="relative z-10 max-w-2xl">
        {['Gestão completa.', 'Em qualquer nicho.', 'Sem fricção.'].map((line, i) => (
          <motion.h1
            key={line}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={fadeUpStagger}
            className="text-4xl font-bold leading-[1.05] tracking-tight lg:text-6xl"
          >
            {line}
          </motion.h1>
        ))}

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="mt-6 max-w-lg text-lg text-zinc-400"
        >
          O ERP que se adapta ao seu negócio — lojista, contador ou vida doméstica —
          com PDV que nunca para, mesmo sem internet.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="mt-10 flex flex-wrap gap-4"
        >
          <a
            href="/cadastro?type=BUSINESS"
            className="group relative rounded-xl bg-indigo-600 px-8 py-4 font-semibold shadow-[0_0_40px_rgba(99,102,241,0.4)] transition-shadow hover:shadow-[0_0_60px_rgba(99,102,241,0.6)]"
          >
            Começar grátis — Lojista
          </a>
          <a
            href="/cadastro?type=PERSONAL"
            className="rounded-xl border border-zinc-700 px-8 py-4 font-semibold transition-all hover:border-indigo-400 hover:shadow-[0_0_24px_rgba(99,102,241,0.3)]"
          >
            Organizar minha casa
          </a>
          <a
            href="/cadastro?type=ACCOUNTING_OFFICE"
            className="rounded-xl border border-zinc-700 px-8 py-4 font-semibold text-cyan-400 border-cyan-400/30 transition-all hover:bg-cyan-400/10"
          >
            Sou contador
          </a>
        </motion.div>
      </div>

      <div className="relative z-10 hidden lg:block h-[500px] w-[500px]">
        <Canvas camera={{ position: [0, 0, 5], fov: 35 }}>
          <Environment preset="city" />
          <ambientLight intensity={0.4} />
          <directionalLight position={[3, 3, 3]} intensity={1.2} />
          <Float speed={1.4} rotationIntensity={0.6} floatIntensity={0.8}>
            <DeviceMesh />
          </Float>
        </Canvas>
      </div>
    </section>
  );
}

function DeviceMesh() {
  return (
    <group>
      <mesh>
        <boxGeometry args={[2.5, 1.6, 0.15]} />
        <meshStandardMaterial color="#0a0a0f" roughness={0.2} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0, 0.12]}>
        <planeGeometry args={[2.3, 1.4]} />
        <meshBasicMaterial color="#1a1a2e" transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 0, 0.13]} scale={0.95}>
        <planeGeometry args={[2.2, 1.3]} />
        <meshBasicMaterial
          color="#6366f1"
          transparent
          opacity={0.15}
        />
      </mesh>
    </group>
  );
}
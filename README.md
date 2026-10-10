# Filitech ERP V2

**Contrato:** `BIBLE_ENGINEERING_V2.md` + mega-prompt de implementação.
**Zero tolerância** a débito técnico não documentado, mock em produção ou regra de negócio omitida.

## Três produtos · um backbone

| Produto | TenantType | Público |
|---------|------------|--------|
| Filitech ERP | `BUSINESS` | Lojistas · 18 nichos |
| Filitech Contábil | `ACCOUNTING_OFFICE` | Escritórios + marketplace |
| Filitech Pessoal | `PERSONAL` | Residências · ERP doméstico |

Compartilhado: multi-tenant, JWT RS256 + argon2id, 2FA TOTP, billing Asaas/Stripe, BullMQ, R2, RBAC, painel do dono.

## Stack

- Turborepo + pnpm
- `apps/web` — Next.js 14 App Router, Tailwind, Framer Motion, GSAP, R3F
- `apps/api` — Express + TypeScript
- `packages/database` — Prisma + isolamento por tenant
- `packages/shared` — catálogos e constantes

## Setup

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:generate && pnpm db:migrate && pnpm db:seed
pnpm dev
```

Repo: https://github.com/kriptomad/ERP

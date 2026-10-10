# Filitech ERP

> **A Bíblia de Engenharia 360º do Filitech ERP** — SaaS Multi-Nicho, Billing Dinâmico e Big Tech UI/UX

Sistema ERP completo para pequenos e médios lojistas brasileiros, cobrindo 6+ nichos de negócio com PDV offline-first, gestão de estoque, financeiro, fiscal, CRM e billing por assinatura.

---

## Arquitetura

```
Filitecherp/
├── apps/
│   ├── api/                 # Node.js + Express + Prisma + PostgreSQL
│   │   ├── prisma/          # Schema + Migrations + Seed
│   │   ├── src/
│   │   │   ├── auth/        # JWT, Argon2, RBAC, 2FA
│   │   │   ├── infra/       # Prisma client, Redis, storage
│   │   │   ├── middlewares/ # Auth, tenant, feature-gating, error-handler
│   │   │   └── modules/     # Domínios: tenant, product, sale, stock, financial, client, work-order, billing, loyalty
│   │   └── Dockerfile
│   └── web/                 # Next.js 14 + TailwindCSS + Framer Motion
│       └── src/app/         # Landing page + componentes
├── packages/
│   └── shared/              # Tipos e utilitários compartilhados
├── docker-compose.yml       # PostgreSQL + Redis + API + Web
├── package.json             # Workspace root
└── tsconfig.base.json       # Config TypeScript compartilhada
```

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| **Backend** | Node.js 20, Express 4, TypeScript 5 |
| **ORM** | Prisma 6 + PostgreSQL 15 |
| **Cache/Filas** | Redis 7, BullMQ |
| **Auth** | JWT (RS256), Argon2id, TOTP 2FA |
| **Frontend** | Next.js 14, React 18, TailwindCSS, Framer Motion |
| **Infra** | Docker, Cloudflare (WAF/R2), Hetzner/DigitalOcean |

## Quick Start

### Pré-requisitos

- Node.js 20+
- Docker + Docker Compose (recomendado) ou PostgreSQL 15 + Redis 7 locais

### 1. Clonar e instalar dependências

```bash
cd C:\Users\User\Documents\Filitecherp
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp apps/api/.env.example apps/api/.env
# Edite DATABASE_URL, REDIS_URL e demais variáveis
```

### 3. Subir infraestrutura (PostgreSQL + Redis)

```bash
docker-compose up -d postgres redis
```

### 4. Gerar cliente Prisma e rodar migrations

```bash
npm run db:generate
npm run db:migrate
```

### 5. Popular banco com dados de demonstração

```bash
npm --workspace apps/api run db:seed
# ou via Docker:
docker-compose exec api npx prisma db seed
```

### 6. Gerar chaves JWT (RS256)

```bash
mkdir -p apps/api/keys
openssl genrsa -out apps/api/keys/jwt-private.pem 2048
openssl rsa -in apps/api/keys/jwt-private.pem -pubout -out apps/api/keys/jwt-public.pem
```

### 7. Iniciar aplicação

```bash
npm run dev
# API: http://localhost:3000
# Web: http://localhost:3001
```

### Acesso Demo

| Campo | Valor |
|---|---|
| **E-mail** | `admin@demo.com` |
| **Senha** | `demo1234` |

## API — Endpoints Principais

### Autenticação
- `POST /api/v1/auth/login` — Login
- `POST /api/v1/auth/register` — Cadastro (cria tenant + owner)
- `GET /api/v1/auth/me` — Perfil do usuário logado

### Tenants & Módulos
- `GET /api/v1/tenants/:id` — Detalhes do tenant
- `GET /api/v1/tenants/:id/modules` — Módulos ativos
- `POST /api/v1/tenants/:id/modules/activate` — Ativar módulo
- `POST /api/v1/tenants/:id/modules/deactivate` — Desativar módulo

### Produtos
- `GET /api/v1/products` — Listar (com busca, paginação, filtros)
- `POST /api/v1/products` — Criar
- `PUT /api/v1/products/:id` — Atualizar
- `DELETE /api/v1/products/:id` — Desativar

### Vendas (PDV)
- `GET /api/v1/sales` — Listar vendas
- `POST /api/v1/sales` — Registrar venda (baixa estoque, transacional)
- `POST /api/v1/sales/:id/refund` — Estornar venda (requer OWNER/MANAGER)

### Estoque
- `GET /api/v1/stock/movements` — Histórico de movimentações
- `POST /api/v1/stock/adjust` — Ajuste manual
- `GET /api/v1/stock/low-stock` — Produtos abaixo do mínimo
- `GET /api/v1/stock/batches/:productId` — Lotes (FEFO)

### Financeiro
- `GET /api/v1/financial/payables` — Contas a pagar
- `POST /api/v1/financial/payables` — Criar conta a pagar
- `POST /api/v1/financial/payables/:id/pay` — Marcar como paga
- `GET /api/v1/financial/receivables` — Contas a receber
- `POST /api/v1/financial/receivables` — Criar conta a receber
- `POST /api/v1/financial/receivables/:id/receive` — Marcar como recebida
- `GET /api/v1/financial/cash-flow/summary` — Resumo de fluxo de caixa

### Clientes
- `GET /api/v1/clients` — Listar
- `POST /api/v1/clients` — Criar
- `PUT /api/v1/clients/:id` — Atualizar
- `DELETE /api/v1/clients/:id` — Excluir

### Ordens de Serviço (Assistência Técnica)
- `GET /api/v1/work-orders` — Listar O.S.
- `POST /api/v1/work-orders` — Abrir O.S.
- `PATCH /api/v1/work-orders/:id/status` — Atualizar status
- `POST /api/v1/work-orders/:id/items` — Adicionar item/serviço

### Billing
- `GET /api/v1/billing/plans` — Planos disponíveis
- `GET /api/v1/billing/modules` — Módulos à la carte
- `GET /api/v1/billing/subscription` — Assinatura atual
- `POST /api/v1/billing/checkout` — Checkout (cria assinatura + ativa módulos)
- `POST /api/v1/billing/subscription/cancel` — Cancelar (fim do ciclo)
- `GET /api/v1/billing/billing-events` — Histórico de cobranças

### Admin (Platform Owner)
- `GET /api/v1/admin/dashboard/stats` — Estatísticas globais
- `GET /api/v1/admin/tenants` — Listar todos os tenants
- `PATCH /api/v1/admin/tenants/:id/status` — Alterar status do tenant

## Funcionalidades por Nicho

| Nicho | Módulo | Funcionalidades |
|---|---|---|
| **Mercado** | `pdv`, `estoque`, `financeiro` | Gaveta cega, curva ABC, fidelidade, balança |
| **Assistência Técnica** | `work-order` | O.S. completa, aprovação WhatsApp, comissão por técnico |
| **Adega** | `liquor-ledger` | Conta-corrente de cascos, precificação em cascata |
| **Padaria** | `recipe-bom` | Ficha técnica, produção, perdas, CMV |
| **Farmácia** | `pharmacy-sngpc` | SNGPC, retenção de receita, FEFO, controlados |
| **Varejo Geral** | `pdv`, `crm` | Crediário, devoluções, grades |

## Segurança

- **Autenticação:** JWT RS256 com expiração de 8h
- **Senhas:** Argon2id (memoryCost: 19456, timeCost: 2, parallelism: 1)
- **2FA:** TOTP (Google Authenticator) + backup codes
- **RBAC:** OWNER, MANAGER, TECHNICIAN, CASHIER, ACCOUNTANT
- **Multi-tenant:** AsyncLocalStorage + Prisma Client Extension
- **Rate Limiting:** 100 req/min por IP
- **LGPD:** Consentimento registrado, subprocessadores documentados

## Licença

Uso interno — Filitech ERP

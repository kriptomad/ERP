# syntax=docker/dockerfile:1
# ============================================================================
# Filitech ERP V2 — API (Express + Prisma + BullMQ)
# Multi-stage build: builder → runtime
# ATENÇÃO: monorepo npm workspaces — dependências ficam HOISTED na raiz
# (/app/node_modules), NÃO em apps/api/node_modules. Copiar de apps/api/
# resulta em "Cannot find module 'express'".
# ============================================================================

FROM node:20-bullseye-slim AS builder
WORKDIR /app

# Manifestos do workspace (lockfile raiz garante npm ci determinístico)
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci

# Código da API
COPY tsconfig.base.json ./
COPY apps/api ./apps/api

RUN npm --workspace apps/api run build

# Sanity check: o bundle DEVE importar express (falha o build se não)
RUN grep -q 'require("express")' apps/api/dist/main.js || \
    (echo "FATAL: express não encontrado no bundle compilado" && exit 1)

# Prisma client GERADO no builder (usa o schema e o engines do lockfile)
RUN npm --workspace apps/api exec prisma generate

# ----------------------------------------------------------------------------
# Runtime
# ----------------------------------------------------------------------------
FROM node:20-bullseye-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Dependências hoisted da raiz do monorepo (inclui express, @prisma/client
# já gerado, bullmq, stripe, argon2, etc.)
COPY --from=builder /app/node_modules ./node_modules

# Código compilado + manifestos + schema Prisma
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/apps/api/prisma ./prisma

# Regenera o Prisma Client para o runtime (engines do SO alvo)
RUN npx prisma generate && npx prisma --version

EXPOSE 3000

# Healthcheck via /health (Cap. 3 — SRE)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER node
CMD ["node", "dist/main.js"]

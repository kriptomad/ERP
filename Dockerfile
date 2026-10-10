# Cap. 3 — multi-stage distroless
FROM node:20-bullseye-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm --filter @filitech/database generate || true
RUN pnpm --filter @filitech/api build || true

FROM gcr.io/distroless/nodejs20-debian12 AS runtime
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./package.json
ENV NODE_ENV=production
EXPOSE 4000
USER nonroot
CMD ["dist/main.js"]

# Build stage
FROM node:20-bullseye-slim AS builder
WORKDIR /app

COPY package*.json ./
COPY apps/web/package*.json ./apps/web/

RUN npm ci

COPY apps/web ./apps/web

RUN npm --workspace apps/web run build

# Production stage
FROM node:20-bullseye-slim AS runtime
WORKDIR /app

COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/node_modules ./node_modules
COPY --from=builder /app/apps/web/package.json ./package.json
COPY --from=builder /app/apps/web/next.config.js ./next.config.js

ENV NODE_ENV=production
EXPOSE 3001

USER node
CMD ["npm", "start"]

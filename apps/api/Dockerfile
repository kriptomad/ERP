# Build stage
FROM node:20-bullseye-slim AS builder
WORKDIR /app

# Copy workspace files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages ./packages

# Install dependencies
RUN npm ci

# Copy source
COPY apps/api ./apps/api
COPY tsconfig.base.json ./

# Build
RUN npm --workspace apps/api run build

# Production stage
FROM node:20-bullseye-slim AS runtime
WORKDIR /app

# Copy built files
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/apps/api/prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

ENV NODE_ENV=production
EXPOSE 3000

USER node
CMD ["node", "dist/main.js"]

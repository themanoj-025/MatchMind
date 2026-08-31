# ── Match-Mind — Multi-stage Docker Build ───────────────────────────────────
# Targets:
#   backend  — Express + Prisma (Node 20-slim, glibc for Prisma engines)
#   frontend — Vite-built React SPA (Node 20-alpine → nginx)
#
# Usage:
#   docker compose up               # builds both services
#   docker build --target backend .  # backend only
#   docker build --target frontend . # frontend only
# ────────────────────────────────────────────────────────────────────────────

# ════════════════════════════════════════════════════════════════════════════
# BACKEND — Express + Prisma (glibc required for Prisma query engine)
# ════════════════════════════════════════════════════════════════════════════
FROM node:26-slim AS backend-builder

WORKDIR /app

# Copy workspace manifests for dependency install
COPY package.json package-lock.json* ./
COPY backend/package.json backend/
COPY packages/shared-types/package.json packages/shared-types/

# System deps for Prisma (OpenSSL + glibc)
RUN apt-get update && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN npm ci --ignore-scripts

# Copy source
COPY backend/ backend/
COPY packages/ packages/

# Build shared-types first (backend imports its compiled dist/)
WORKDIR /app/packages/shared-types
RUN npm run build

# Generate Prisma client
WORKDIR /app/backend
RUN mkdir -p /app/docs && npx prisma generate

# Compile TypeScript
RUN npx tsc --module commonjs --moduleResolution node --ignoreDeprecations 6.0

# Mirror JSON assets into dist tree
RUN mkdir -p /app/backend/dist/src/config /app/backend/dist/src/data && \
    cp -r /app/backend/src/config/. /app/backend/dist/src/config/ && \
    cp -r /app/backend/src/data/. /app/backend/dist/src/data/

# Production runner
FROM node:26-slim AS backend

WORKDIR /app

RUN apt-get update && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Remove npm to eliminate known advisories in bundled deps
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Non-root user
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/false --create-home nodejs

COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/package.json ./package.json
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/dist ./dist
COPY --from=backend-builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=backend-builder --chown=nodejs:nodejs /app/packages/shared-types ./packages/shared-types

USER nodejs

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD ["node", "-e", "require('http').get('http://localhost:5000/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"]

CMD ["node", "dist/src/index.js"]

# ════════════════════════════════════════════════════════════════════════════
# FRONTEND — Vite React SPA → nginx
# ════════════════════════════════════════════════════════════════════════════
FROM node:26-alpine AS frontend-build

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
COPY packages/shared-types/package.json packages/shared-types/
RUN npm ci --no-audit --no-fund

COPY frontend/ .
COPY packages/ packages/

# Build shared-types (frontend imports it)
WORKDIR /app/packages/shared-types
RUN npm run build

# Build frontend
WORKDIR /app/frontend
RUN npm run build

# Production runner — nginx for static SPA
FROM nginx:alpine AS frontend

# SPA fallback for client-side routing
RUN echo 'server { \
    listen 3000; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location /api { \
        proxy_pass http://backend:5000; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
    } \
}' > /etc/nginx/conf.d/default.conf

COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html

EXPOSE 3000

STOPSIGNAL SIGTERM
CMD ["nginx", "-g", "daemon off;"]

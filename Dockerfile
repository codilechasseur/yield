# ─────────────────────────────────────────────
# Stage 1: Build
# ─────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy manifests first for better layer caching
COPY package*.json ./

RUN npm ci --legacy-peer-deps

# Copy all source files
COPY . .

# Build the SvelteKit app (adapter-node produces /app/build)
RUN npm run build

# Prune dev dependencies
RUN npm prune --production --legacy-peer-deps

# ─────────────────────────────────────────────
# Stage 2: Runtime
# Uses Debian-based image for Chromium compatibility (Puppeteer)
# ─────────────────────────────────────────────
FROM node:22-slim AS runner

# Install Chromium for Puppeteer — apt resolves all transitive shared-lib deps.
# fonts-liberation is added explicitly so PDFs render correctly.
RUN apt-get update && apt-get install -y --no-install-recommends \
  chromium \
  fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use the system Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy built output and production node_modules from builder
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# PocketBase URL — overridden by docker-compose in production
ENV PB_URL=http://pocketbase:8090
# ORIGIN is set at runtime by docker-compose (required by SvelteKit for CSRF)
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["node", "build"]

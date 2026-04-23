FROM node:20-slim AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Next.js inlines NEXT_PUBLIC_* vars at build time into the client bundle.
# These are public, non-secret values.
ENV NEXT_PUBLIC_SUPABASE_URL=https://syzjsukrnzlnbyqbttja.supabase.co
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_AoWyEf9yL7m5MFTSDeTGkg_XqOAPbUA

RUN npm run build

# Production image — standalone output + Playwright chromium
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Install Playwright chromium + its system deps (Debian packages pulled in by --with-deps).
# Must run as root for apt-get; world-readable so the nextjs user can launch the browser.
RUN npx --yes playwright@1.49.1 install --with-deps chromium \
 && chmod -R a+rX /ms-playwright

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs --shell /bin/false nextjs

# Copy standalone server + static assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Explicitly include playwright runtime — Next's tracer can miss dynamic imports.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/playwright ./node_modules/playwright
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/playwright-core ./node_modules/playwright-core

USER nextjs

# Cloud Run injects PORT at runtime (default 8080)
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"
EXPOSE 8080

CMD ["node", "server.js"]

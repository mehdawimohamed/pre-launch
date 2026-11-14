# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# Base stage: provides Node.js runtime and installs pnpm
# -----------------------------------------------------------------------------
FROM node:26-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@12.11.2

# -----------------------------------------------------------------------------
# Dependencies stage: install full workspace dependencies for building
# -----------------------------------------------------------------------------
FROM base AS deps
WORKDIR /app

# Copy dependency manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies (including devDependencies required for build)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Builder stage: compile shared packages and apps/api
# -----------------------------------------------------------------------------
FROM deps AS builder
WORKDIR /app

# Copy all source code and tsconfigs
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build shared package first, generate prisma client, then build api
RUN pnpm --filter @pre-launch/shared run build
RUN pnpm --filter @pre-launch/api run prisma:generate
RUN pnpm --filter @pre-launch/api run build

# Prune devDependencies to keep only production dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm --filter @pre-launch/api deploy --prod /prod/api

# -----------------------------------------------------------------------------
# Runner stage: minimal production image running as non-root
# -----------------------------------------------------------------------------
FROM node:26-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Install curl or wget for healthcheck (wget comes with busybox/alpine)
RUN apk --no-cache add wget

# Create non-root system group and user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy deployed production node_modules and package.json
COPY --from=builder --chown=nestjs:nodejs /prod/api/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /prod/api/package.json ./package.json

# Copy compiled artifacts from builder
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist

USER nestjs

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/health || exit 1

CMD ["node", "dist/main.js"]

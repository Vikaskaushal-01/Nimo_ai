# ── Build stage: compile TypeScript → dist/ ──────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Runtime stage: production deps + compiled JS only ───────────────────────
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    BACKEND_PORT=4000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=build /app/dist ./dist

# Run as the unprivileged user that ships with the official image.
USER node
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/api/v1/health > /dev/null || exit 1

CMD ["node", "dist/server.js"]

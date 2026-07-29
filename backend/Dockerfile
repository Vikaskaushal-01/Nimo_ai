# ── Backend image (runs via tsx; no separate build step needed for iteration 1) ──
FROM node:20-alpine

WORKDIR /app

# Install deps first for better layer caching
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Copy source
COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production
ENV BACKEND_PORT=4000
EXPOSE 4000

# Typecheck happens in CI; runtime uses tsx so ESM resolution "just works".
CMD ["npx", "tsx", "src/server.ts"]

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /app

# Leave empty to call the API same-origin at /api/v1 (proxied by nginx below).
# Only set this when the API is hosted on a different origin.
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ── Serve stage ──────────────────────────────────────────────────────────────
FROM nginx:1.29-alpine

# Where nginx forwards /api requests. The official image renders
# /etc/nginx/templates/*.template with envsubst at container start.
ENV BACKEND_URL=http://backend:4000

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

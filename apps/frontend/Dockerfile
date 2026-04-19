# syntax=docker/dockerfile:1.7

# --- Stage 1: install + build ----------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# VITE_API_URL is baked into the bundle at build time. Pass it via
# --build-arg VITE_API_URL=https://api.example.com so the UI points at
# the right backend in production.
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# --- Stage 2: nginx serving the static bundle ------------------------
FROM nginx:1.27-alpine AS runtime

# Replace the default config with an SPA-aware one (see nginx.conf).
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

# Drop capabilities the container does not need. nginx itself already
# runs worker processes as the `nginx` user.
RUN chown -R nginx:nginx /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --spider --quiet http://127.0.0.1:80/ || exit 1

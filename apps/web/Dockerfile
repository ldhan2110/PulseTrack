# Build context = repo root: docker build -f apps/web/Dockerfile .
# VITE_* are build-time; pass with --build-arg (baked into the static bundle).
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @pm/web...
COPY packages/shared packages/shared
COPY apps/web apps/web

ARG VITE_API_URL
ARG VITE_SOCKET_URL
ARG VITE_SOCKET_PATH
ARG VITE_BLUEPRINT_URL
ARG VITE_KEYCLOAK_URL
ARG VITE_KEYCLOAK_REALM
ARG VITE_KEYCLOAK_CLIENT_ID
RUN pnpm --filter @pm/web build

# ---- static serve ----
FROM nginx:alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
# SPA fallback so client-side routes resolve to index.html
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80

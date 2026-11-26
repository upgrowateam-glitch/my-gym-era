# FitZone website: builds the web version of the app, then serves it with Nginx.
# Built and started by docker-compose.yml in the project root.

# ── Stage 1: build the website ────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Server address the website talks to. It is built into the website, so the
# website must be rebuilt when it changes (docker compose up -d --build).
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
RUN test -n "$EXPO_PUBLIC_API_URL" || (echo "EXPO_PUBLIC_API_URL is empty: set PUBLIC_BASE_URL in .env" && exit 1)
RUN npx expo export --platform web --output-dir dist

# ── Stage 2: serve the finished files ─────────────────────────────────────────
FROM nginx:alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

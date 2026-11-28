# FitZone API server, packaged as a Docker container.
# Built and started by docker-compose.yml in the project root.

FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Install libraries first (cached until package files change).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts
# Photos for the starter food list (and their credits), shipped with the server.
COPY static ./static

# Folder for uploaded files (kept in a Docker volume), owned by the
# unprivileged "node" user the server runs as.
RUN mkdir -p uploads && chown -R node:node uploads
USER node

EXPOSE 4000

# Apply any new database migrations, then start the server.
CMD ["sh", "-c", "node scripts/migrate.js && exec node src/server.js"]

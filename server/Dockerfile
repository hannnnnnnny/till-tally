# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app
ENV DATABASE_URL=postgresql://tilltally:tilltally@db:5432/tilltally?schema=public
# Install dependencies using the workspace manifests + lockfile for cacheable layers.
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm ci
# Compile the server (tsc -> server/dist).
COPY tsconfig.base.json ./
COPY server ./server
RUN npm run prisma:generate -w server
RUN npm run build -w server

# ---- Runtime stage ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HEALTHCHECK_URL=http://127.0.0.1:4000/api/health/ready
# Production dependencies only.
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/server/node_modules/.prisma ./server/node_modules/.prisma
COPY --from=build /app/server/dist ./server/dist
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "server/dist/healthcheck.js"]
CMD ["node", "server/dist/app.js"]

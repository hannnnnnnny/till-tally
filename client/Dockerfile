# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY packages/analytics-contracts/package.json ./packages/analytics-contracts/
RUN npm ci
COPY tsconfig.base.json ./
COPY client ./client
RUN npm run build -w client

# ---- Runtime stage (static files served by nginx) ----
FROM nginx:alpine AS runtime
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html
EXPOSE 80

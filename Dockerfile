# =========================
# Stage 1: Dependencies
# =========================
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci

# =========================
# Stage 2: Build
# =========================
FROM node:20-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN node ace build --ignore-ts-errors

# =========================
# Stage 3: Production
# =========================
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Copier uniquement les dépendances nécessaires
COPY --from=deps /app/node_modules ./node_modules

# Copier uniquement le build final
COPY --from=build /app/build ./build

# Swagger (optionnel)
COPY swagger.yaml ./swagger.yaml

EXPOSE 3333

CMD ["node", "build/bin/server.js"]

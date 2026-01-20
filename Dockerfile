# =========================
# Stage 1: Base
# =========================
FROM node:20-alpine AS base
WORKDIR /app

# =========================
# Stage 2: Dependencies
# =========================
FROM base AS deps
COPY package*.json ./
RUN npm ci

# =========================
# Stage 3: Build
# =========================
FROM base AS build
WORKDIR /app

# Copier les dépendances installées
COPY --from=deps /app/node_modules ./node_modules

# Copier tout le code
COPY . .

# Build Adonis (TypeScript → JS)
RUN node ace build --ignore-ts-errors

# =========================
# Stage 4: Production
# =========================
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production

# Installer toutes les dépendances pour pouvoir utiliser Ace (migrations)
COPY package*.json ./
RUN npm ci

# Copier le build
COPY --from=build /app/build ./build

# Copier swagger (optionnel)
COPY swagger.yaml /app/swagger.yaml

# Exposer le port de l'application
EXPOSE 3333

# Commande par défaut
CMD ["node", "build/bin/server.js"]

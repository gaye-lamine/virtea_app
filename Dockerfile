# Stage 1: Base
FROM node:20-alpine AS base

# Stage 2: Dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 3: Build
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node ace build --ignore-ts-errors

# Stage 4: Production
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production

# Install production deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy build output
COPY --from=build /app/build ./build

# Copy required runtime files
COPY .env .env

EXPOSE 3333

CMD ["node", "build/bin/server.js"]

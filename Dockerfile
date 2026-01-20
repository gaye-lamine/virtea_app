# Stage 1: Base
FROM node:20-alpine AS base

# Stage 2: Dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 3: Production Dependencies
FROM base AS production-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 4: Build
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node ace build

# Stage 5: Production Runtime
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3333
ENV HOST=0.0.0.0

# Copy necessary files from build stages
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./

# Expose the API port
EXPOSE 3333

# Start the server
CMD ["node", "bin/server.js"]

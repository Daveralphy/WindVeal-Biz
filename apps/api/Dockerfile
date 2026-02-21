# Backend Dockerfile - Multi-stage for dev and prod
FROM node:20-alpine AS development
WORKDIR /app

# Install required system dependencies for Prisma
RUN apk add --no-cache openssl libc6-compat

# Copy root and app packages
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN npm install 2>/dev/null || npm install --legacy-peer-deps

# Copy API source code and config
COPY apps/api/src ./apps/api/src
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/tsconfig.json ./apps/api/

# Generate Prisma Client
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

EXPOSE 3000
CMD ["npm", "--prefix", "apps/api", "run", "dev"]

# Production build stage
FROM base AS builder
WORKDIR /app
# Build the TypeScript
RUN npm --prefix apps/api run build

# Production runtime stage
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Copy root package files
COPY package.json package-lock.json ./

# Install only production dependencies for root
RUN npm ci --only=production

# Copy API package.json for runtime
COPY apps/api/package.json ./apps/api/

# Install API production dependencies
WORKDIR /app/apps/api
RUN npm ci --only=production

# Go back to root
WORKDIR /app

# Copy built app
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

EXPOSE 3000

# Generate Prisma client and start
CMD ["sh", "-c", "npx prisma generate --schema=./apps/api/prisma/schema.prisma && node apps/api/dist/index.js"]

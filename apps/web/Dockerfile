# Frontend Dockerfile - Multi-stage for dev and prod
FROM node:20-alpine AS development
WORKDIR /app

# Copy root and app packages
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN npm install 2>/dev/null || npm install --legacy-peer-deps

# Copy web source files and config
COPY apps/web/src ./apps/web/src
COPY apps/web/index.html ./apps/web/
COPY apps/web/public ./apps/web/public
COPY apps/web/vite.config.ts ./apps/web/
COPY apps/web/tsconfig.json ./apps/web/
COPY apps/web/tsconfig.node.json ./apps/web/
COPY apps/web/tailwind.config.js ./apps/web/
COPY apps/web/postcss.config.js ./apps/web/
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY tsconfig.json ./

EXPOSE 5173
CMD ["npm", "--prefix", "apps/web", "run", "dev", "--", "--host"]

# Production build stage
FROM base AS builder
WORKDIR /app
RUN npm --prefix apps/web run build

# Production runtime - serve with nginx
FROM nginx:alpine AS production
COPY nginx.prod.conf /etc/nginx/nginx.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

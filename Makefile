.PHONY: help setup install dev build test lint format clean docker-up docker-down docker-logs migrate seed backup restore deploy

# Default target
help:
	@echo "VealBiz Project - Available Commands"
	@echo "===================================="
	@echo ""
	@echo "Setup & Installation:"
	@echo "  setup                - Full setup (install deps, configure env)"
	@echo "  install              - Install dependencies"
	@echo "  clean                - Clean all build artifacts"
	@echo ""
	@echo "Development:"
	@echo "  dev                  - Start development servers (Vite + Fastify)"
	@echo "  dev-web              - Start only frontend dev server"
	@echo "  dev-api              - Start only backend dev server"
	@echo "  lint                 - Run ESLint on all TypeScript files"
	@echo "  format               - Format code with Prettier"
	@echo "  type-check           - Run TypeScript type checking"
	@echo ""
	@echo "Building & Testing:"
	@echo "  build                - Build frontend (production)"
	@echo "  build-api            - Build backend (TypeScript compilation)"
	@echo "  build-all            - Build both frontend and backend"
	@echo "  test                 - Run unit tests"
	@echo "  test-watch           - Run tests in watch mode"
	@echo ""
	@echo "Docker:"
	@echo "  docker-up            - Start Docker Compose (development)"
	@echo "  docker-down          - Stop Docker Compose"
	@echo "  docker-up-prod       - Start production Docker Compose"
	@echo "  docker-down-prod     - Stop production Docker Compose"
	@echo "  docker-logs          - Tail Docker logs"
	@echo "  docker-rebuild       - Rebuild Docker images"
	@echo ""
	@echo "Database:"
	@echo "  migrate              - Run Prisma migrations"
	@echo "  seed                 - Seed database with sample data"
	@echo "  db-push              - Push schema to database (dev)"
	@echo "  db-studio            - Open Prisma Studio"
	@echo "  backup               - Backup PostgreSQL database"
	@echo "  backup-prod          - Backup production database"
	@echo ""
	@echo "Deployment:"
	@echo "  deploy-railway       - Deploy to Railway"
	@echo "  deploy-vercel        - Deploy frontend to Vercel"
	@echo "  deploy-local         - Deploy locally with Docker"
	@echo ""
	@echo "Utilities:"
	@echo "  env-local            - Create .env.local from template"
	@echo "  env-prod             - Create .env.production from template"
	@echo "  health               - Check service health"
	@echo "  logs-api             - Tail API logs"
	@echo "  logs-web             - Tail web logs"
	@echo ""

# Setup & Installation
setup: install migrate
	@echo "✅ Setup complete!"

install:
	@echo "📦 Installing dependencies..."
	npm install
	@echo "✅ Dependencies installed"

clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf dist build .next coverage
	find . -name "node_modules" -type d -prune -o -type f -name "*.tsbuildinfo" -delete
	@echo "✅ Cleaned"

# Development
dev:
	@echo "🚀 Starting development servers..."
	npm run dev

dev-web:
	@echo "🚀 Starting web dev server..."
	cd apps/web && npm run dev

dev-api:
	@echo "🚀 Starting API dev server..."
	cd apps/api && npm run dev

lint:
	@echo "🔍 Linting code..."
	npm run lint

format:
	@echo "✨ Formatting code..."
	npm run format

type-check:
	@echo "📝 Type checking..."
	npm run type-check

# Building & Testing
build: build-web build-api
	@echo "✅ Build complete"

build-web:
	@echo "🔨 Building frontend..."
	cd apps/web && npm run build
	@echo "✅ Frontend built"

build-api:
	@echo "🔨 Building backend..."
	cd apps/api && npm run build
	@echo "✅ Backend built"

build-all: build-web build-api
	@echo "✅ All builds complete"

test:
	@echo "🧪 Running tests..."
	npm run test

test-watch:
	@echo "👀 Running tests in watch mode..."
	npm run test -- --watch

# Docker
docker-up:
	@echo "🐳 Starting Docker Compose (development)..."
	docker-compose up -d
	@echo "✅ Services started"
	@echo "   - PostgreSQL: localhost:5432"
	@echo "   - API: http://localhost:3000"
	@echo "   - Web: http://localhost:5173"

docker-down:
	@echo "🛑 Stopping Docker Compose..."
	docker-compose down

docker-up-prod:
	@echo "🐳 Starting Docker Compose (production)..."
	docker-compose -f docker-compose.prod.yml up -d
	@echo "✅ Production services started"

docker-down-prod:
	@echo "🛑 Stopping production Docker Compose..."
	docker-compose -f docker-compose.prod.yml down

docker-logs:
	@echo "📋 Tailing Docker logs..."
	docker-compose logs -f

docker-rebuild:
	@echo "🔨 Rebuilding Docker images..."
	docker-compose build --no-cache

docker-ps:
	@echo "📊 Docker services:"
	docker-compose ps

# Database
migrate:
	@echo "📦 Running Prisma migrations..."
	npx prisma migrate deploy
	@echo "✅ Migrations complete"

seed:
	@echo "🌱 Seeding database..."
	npx prisma db seed
	@echo "✅ Database seeded"

db-push:
	@echo "🚀 Pushing schema to database..."
	npx prisma db push
	@echo "✅ Schema pushed"

db-studio:
	@echo "🎨 Opening Prisma Studio..."
	npx prisma studio

backup:
	@echo "💾 Backing up database..."
	@mkdir -p backups
	@docker-compose exec -T db pg_dump -U $${DB_USER:-vealbiz_user} $${DB_NAME:-vealbiz_db} > backups/backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "✅ Backup created"

backup-prod:
	@echo "💾 Backing up production database..."
	@mkdir -p backups
	@docker-compose -f docker-compose.prod.yml exec -T db pg_dump -U $${DB_USER:-vealbiz_user} $${DB_NAME:-vealbiz_db} > backups/backup_prod_$$(date +%Y%m%d_%H%M%S).sql
	@echo "✅ Production backup created"

# Deployment
deploy-railway:
	@echo "🚀 Deploying to Railway..."
	@echo "Prerequisites:"
	@echo "  1. Install Railway CLI: npm i -g @railway/cli"
	@echo "  2. Login: railway login"
	@echo "  3. Create project: railway init"
	@echo "  4. Deploy: railway up"
	@echo ""
	@echo "Or push to connected GitHub repo: git push origin main"

deploy-vercel:
	@echo "🚀 Deploying frontend to Vercel..."
	@echo "Prerequisites:"
	@echo "  1. Install Vercel CLI: npm i -g vercel"
	@echo "  2. Login: vercel login"
	@echo ""
	cd apps/web && vercel

deploy-local: docker-up migrate
	@echo "✅ Local deployment complete"
	@echo "   Access at: http://localhost"

# Utilities
env-local:
	@echo "📝 Creating .env.local..."
	@if [ -f .env.local ]; then echo "⚠️  .env.local exists"; else cp .env.local .env.local; echo "✅ .env.local created"; fi

env-prod:
	@echo "📝 Creating .env.production..."
	@if [ -f .env.production ]; then echo "⚠️  .env.production exists"; else cp .env.production .env.production; echo "✅ .env.production created"; fi

health:
	@echo "🏥 Checking service health..."
	@echo ""
	@echo "API Health:"
	@curl -s http://localhost:3000/health | jq . || echo "❌ API not responding"
	@echo ""
	@echo "Web Status:"
	@curl -s -I http://localhost:5173 | head -1 || echo "❌ Web not responding"
	@echo ""
	@echo "Docker Services:"
	@docker-compose ps

logs-api:
	@echo "📋 API Logs:"
	docker-compose logs -f api

logs-web:
	@echo "📋 Web Logs:"
	docker-compose logs -f web

logs-db:
	@echo "📋 Database Logs:"
	docker-compose logs -f db

# Development shortcuts
refresh-deps:
	@echo "🔄 Refreshing dependencies..."
	rm -rf node_modules apps/*/node_modules
	npm install
	@echo "✅ Dependencies refreshed"

check: lint type-check test
	@echo "✅ All checks passed!"

# Git shortcuts
commit-msg ?= "Update"
commit:
	@git add .
	@git commit -m "$(commit-msg)"
	@git push origin main

.DEFAULT_GOAL := help

# VealBiz Quick Start Guide

## 🚀 First Time Setup (5 minutes)

### 1. Prerequisites
```bash
# Ensure you have Node.js 18+ installed
node --version
npm --version

# Ensure you have Docker installed (optional but recommended)
docker --version
```

### 2. Environment Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/vealbiz.git
cd vealbiz

# Create environment file (copy template)
cp .env.local .env  # For local development with Docker
```

### 3. Install & Run
```bash
# Option A: Using Docker (recommended)
make docker-up
# Services will be available at:
# - Frontend: http://localhost:5173
# - API: http://localhost:3000
# - Database: localhost:5432

# Option B: Without Docker (manual setup)
npm install
npm run dev
# Frontend: http://localhost:5173
# API: http://localhost:3000
# Database: Configure DATABASE_URL in .env
```

### 4. Database Setup
```bash
# Run migrations to create tables
make migrate

# (Optional) Seed with sample data
make seed
```

### 5. Access the App
- **Frontend**: http://localhost:5173
- **API**: http://localhost:3000/api
- **API Docs**: http://localhost:3000/health
- **Database Studio**: `make db-studio`

---

## 📁 Project Structure

```
VealBiz/
├── apps/
│   ├── web/                  # React frontend (Vite)
│   │   ├── src/
│   │   │   ├── pages/        # Page components (Dashboard, Jobs, etc)
│   │   │   ├── components/   # Reusable UI components
│   │   │   ├── hooks/        # Custom React hooks (useAuth, useJobs)
│   │   │   ├── lib/          # Utilities (API client)
│   │   │   ├── App.tsx       # Root component with routing
│   │   │   └── main.tsx      # Entry point
│   │   └── package.json
│   │
│   └── api/                  # Fastify backend (Node.js)
│       ├── src/
│       │   ├── routes/       # API endpoints (auth, jobs, candidates)
│       │   ├── services/     # Business logic
│       │   ├── middleware/   # Auth, error handling
│       │   └── index.ts      # Server entry point
│       └── package.json
│
├── packages/shared/          # Shared types/utilities (future)
├── prisma/
│   └── schema.prisma        # Database schema (PostgreSQL)
│
├── docker-compose.yml        # Development environment
├── docker-compose.prod.yml   # Production environment
├── Dockerfile                # Backend container
├── nginx.conf               # Development web server
├── nginx.prod.conf          # Production web server
│
├── .env.local               # Development env vars
├── .env.production          # Production env vars
├── Makefile                 # Common commands
├── DEPLOYMENT.md            # Deployment guide
└── DEPLOYMENT_CHECKLIST.md  # Pre-deployment checklist
```

---

## 🔑 Key Files to Know

### Frontend (apps/web/src/)
- **`App.tsx`**: Root component with React Router setup
- **`pages/Login.tsx`**: Authentication entry point
- **`pages/Dashboard.tsx`**: Main app dashboard
- **`hooks/useAuth.ts`**: Global auth state (Zustand)
- **`lib/api.ts`**: Backend API client

### Backend (apps/api/src/)
- **`index.ts`**: Fastify server setup and middleware
- **`routes/auth.ts`**: Login/register/verify endpoints
- **`services/auth/authService.ts`**: User/org creation logic
- **`services/auth/tokenService.ts`**: JWT token generation

### Database
- **`prisma/schema.prisma`**: Database schema definition
- **`prisma/migrations/`**: Database version control

### Configuration
- **`docker-compose.yml`**: Local dev environment (PostgreSQL + services)
- **`.env.local`**: Development environment variables

---

## 🛠️ Common Development Tasks

### Start Development
```bash
# All services with Docker (recommended)
make docker-up

# Or without Docker (manual)
npm install
npm run dev

# Or individual services
make dev-web     # Just frontend
make dev-api     # Just backend
```

### Code Quality
```bash
make lint        # Check code style
make format      # Format code
make type-check  # TypeScript type checking
make check       # Run all checks
```

### Database Operations
```bash
make db-push     # Push schema changes to database
make db-studio   # Open visual database editor
make migrate     # Run migrations
make seed        # Add sample data
```

### Testing
```bash
make test        # Run unit tests
make test-watch  # Run tests in watch mode
```

### Building
```bash
make build       # Build frontend + backend (production)
make build-web   # Build frontend only
make build-api   # Build backend only
```

---

## 🔐 Authentication Flow

### Login Process
1. User enters email/password
2. Frontend calls `POST /api/auth/login` with credentials
3. Backend verifies against database
4. Returns JWT token + user data
5. Frontend stores token in localStorage via Zustand
6. API client automatically includes token in Authorization header
7. Protected routes check token validity

### Protected Routes
- Routes under `/` are protected (require login)
- Redirects to `/login` if not authenticated
- Layout component wraps protected routes with header + sidebar

---

## 🐛 Debugging

### Frontend Issues
```bash
# Check browser console for errors
# Frontend dev server: http://localhost:5173

# Check Vite server logs
make dev-web

# Open React DevTools in browser extension
```

### Backend Issues
```bash
# View API logs
make logs-api

# Test endpoints with curl
curl http://localhost:3000/health

# Use Prisma Studio to inspect database
make db-studio
```

### Docker Issues
```bash
# Check all services running
make docker-ps

# View all logs
make docker-logs

# Restart services
make docker-down
make docker-up
```

---

## 📚 API Documentation

### Authentication Endpoints
```
POST   /api/auth/register   # Create account
POST   /api/auth/login      # Login user
GET    /api/auth/me         # Get current user (requires token)
```

### Request Examples
```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "organizationName": "Acme Corp",
    "email": "admin@acme.com",
    "password": "SecurePassword123",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@acme.com",
    "password": "SecurePassword123"
  }'

# Get current user (use token from login)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/auth/me
```

---

## 🚀 Deployment

### Local Deployment (Quick Demo)
```bash
make deploy-local
# Access at http://localhost
```

### Cloud Deployment
```bash
# Railway (recommended - easiest)
make deploy-railway

# Vercel (frontend only)
make deploy-vercel

# See DEPLOYMENT.md for other options
```

### Pre-Deployment Checklist
```bash
# Use the deployment checklist
cat DEPLOYMENT_CHECKLIST.md

# Run pre-deployment checks
make check          # Tests, lint, type-check
make build-all      # Build both images
docker-compose -f docker-compose.prod.yml build  # Prod images
```

---

## 📝 Environment Variables

### Required for Local Development
```env
# Frontend
VITE_API_URL=http://localhost:3000/api

# Backend
DATABASE_URL=postgresql://user:password@localhost:5432/vealbiz_db
JWT_SECRET=your-secret-key-here
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

### Required for Production
See `.env.production` template with 40+ documented variables.

---

## 🤝 Development Workflow

### 1. Create New Feature
```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and test
make check          # Run checks
npm run dev         # Test locally

# Commit
git add .
git commit -m "Add my feature"
git push origin feature/my-feature
```

### 2. Create Pull Request
- Push to GitHub
- Create PR against `main`
- Wait for CI/CD checks to pass
- Request review
- Merge after approval

### 3. Deploy to Production
```bash
# PR merged to main triggers auto-deployment (if CI/CD configured)
# Or manually deploy:
make deploy-railway
```

---

## ⚡ Performance Tips

### Frontend
- Use React DevTools to detect unnecessary re-renders
- Lazy load pages: `const Dashboard = lazy(() => import('./Dashboard'))`
- Check bundle size: `npm run build`

### Backend
- Use Prisma Studio to understand query performance
- Enable query logging: check API logs
- Database indexes are important (see schema.prisma)

### Docker
- Development images optimized for speed (ts-node-dev, Vite)
- Production images optimized for size (multi-stage builds)
- Use `docker-compose down -v` to clean up volumes

---

## 📞 Common Commands Quick Reference

```bash
# Development
npm run dev              # Start all services
make dev-web           # Frontend only
make dev-api           # Backend only

# Quality
npm run lint           # Lint code
npm run format         # Format code
npm run type-check     # Type checking

# Database
make db-studio         # Visual database editor
make migrate           # Run migrations
make backup            # Backup database

# Docker
make docker-up         # Start services
make docker-down       # Stop services
make docker-logs       # View logs

# Deployment
make deploy-railway    # Deploy to Railway
make deploy-local      # Local deployment
make deploy-vercel     # Deploy to Vercel

# Utilities
make help              # Show all commands
make check             # Run full checks
make health            # Check service health
```

---

## 🆘 Troubleshooting

### Docker won't start
```bash
# Check if ports are in use
docker ps
# Or check Docker daemon
docker info
```

### Database connection failed
```bash
# Check DATABASE_URL in .env
# Verify PostgreSQL is running
docker-compose ps db
# Check database exists
docker-compose exec db psql -U $DB_USER -l
```

### Frontend not compiling
```bash
# Clear cache and reinstall
rm -rf node_modules apps/*/node_modules
npm install
```

### Backend not responding
```bash
# Check API logs
make logs-api
# Test health endpoint
curl http://localhost:3000/health
```

### Login not working
```bash
# Check browser console for errors
# Check API logs: make logs-api
# Verify database migrations: make migrate
# Check .env variables are set
```

---

## 📖 Further Reading

- **Architecture**: See README.md (700+ lines of documentation)
- **Deployment**: See DEPLOYMENT.md (multiple platform options)
- **Checking before deploy**: See DEPLOYMENT_CHECKLIST.md
- **Docker setup**: See docker-compose.yml comments
- **Database schema**: See prisma/schema.prisma

---

**Last Updated**: 2026-02-20  
**Maintained By**: Development Team  
**Issues?** Check TROUBLESHOOTING section or run `make help`

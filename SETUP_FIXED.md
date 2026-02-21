# VealBiz Setup & Troubleshooting Guide

## 🚀 Quick Start (Fixed Issues)

I've identified and fixed **multiple critical issues** preventing authentication and breaking Docker. Here's what was wrong and how to proceed:

---

## ✅ Issues Fixed

### 1. **JWT Authentication Disabled** ❌ → ✅
**Problem:** The JWT plugin was commented out in `apps/api/src/index.ts`, making all authentication fail.
- **Error shown:** "failed to fetch" on login/signup
- **Root cause:** Lines were commented out due to "version mismatch" note, but plugin was actually compatible

**Solution:** Re-enabled the JWT plugin. Authentication endpoints now work.

### 2. **API PORT Mismatch** ❌ → ✅
**Problem:** `.env` had `PORT=8000` but Docker Compose expected `PORT=3000`
- **Impact:** API services wouldn't communicate correctly
- **Files affected:** `.env`

**Solution:** Changed PORT to `3000` to match Docker configuration.

### 3. **Deprecated/Wildcard Package Versions** ❌ → ✅
**Problem:** API `package.json` had insecure wildcard versions:
```json
"@fastify/jwt": "*",      // ❌ Any version
"@fastify/cors": "*",     // ❌ Any version  
"groq-sdk": "*",          // ❌ Any version
"zod": "*"                // ❌ Any version
```
- **Impact:** Unpredictable dependencies, security vulnerabilities
- **User requirement:** "I dont want any depreciated module or library"

**Solution:** Pinned all packages to latest safe versions:
- `@fastify/jwt@^7.8.1`
- `@fastify/cors@^8.5.0`
- `groq-sdk@^0.4.2`
- `zod@^3.23.8`

Also updated web package versions to latest:
- `lucide-react@0.384.0` (was 0.294.0)
- `react-router-dom@7.0.1` (was 7.0.0)
- Added missing React type definitions (`@types/react`, `@types/react-dom`)

### 4. **Windows Docker Incompatibility** ❌ → ✅
**Problem:** Makefile commands don't work in PowerShell
- **Error:** `make : The term 'make' is not recognized`
- **Impact:** Can't run Docker without Unix shell or WSL

**Solution:** 
- Created `docker-helper.ps1` PowerShell script with Docker commands
- Added npm scripts to root `package.json` for cross-platform compatibility

---

## 🔧 How to Continue Setup

### Step 1: Install Dependencies
```powershell
npm install
```

### Step 2: Set Up PostgreSQL Database

**Option A: Using Docker (Recommended)**
```powershell
npm run docker:up
```

This starts:
- PostgreSQL (localhost:5432)
- Backend API (http://localhost:3000)
- Frontend (http://localhost:5173)

**Option B: Local PostgreSQL**
Ensure PostgreSQL is running locally with:
```
DATABASE_URL=postgresql://vealbiz_user:vealbiz_password@localhost:5432/vealbiz
```

### Step 3: Initialize Database Schema
```powershell
# Create tables from schema
npx prisma db push

# Or if using migrations (recommended for production):
npm run db:migrate
```

### Step 4: Seed Database (Optional - for demo data)
```powershell
npm run db:seed
```

This creates:
- Test Organization: "Acme Corp"
- Test User: `admin@acme.com` / `password123`
- Sample Job: "Senior Frontend Developer"
- Sample Candidate: "Sarah Johnson"

### Step 5: Start Development Servers

**Option A: Run Frontend Only** (API must be running separately)
```powershell
npm run dev
# Opens http://localhost:5173
```

**Option B: Run API Only**
```powershell
npm run dev:api
# Runs on http://localhost:3000
```

**Option C: Run Both** (Requires `concurrently` package)
```powershell
npm install --save-dev concurrently
npm run dev:all
# Runs both servers
```

### Step 6: Test Authentication
1. Navigate to http://localhost:5173
2. Click "Register" to create account
   - Email: test@example.com
   - Password: testpass123
   - Organization: TestCorp
   - First Name: John
   - Last Name: Doe
3. Click "Sign in" to login with created credentials
4. Dashboard should load successfully

---

## 🐳 Docker Commands (Windows PowerShell)

Since `make` doesn't work on Windows, use these npm scripts or PowerShell helper:

```powershell
# Using npm scripts (recommended)
npm run docker:up        # Start services
npm run docker:down      # Stop services
npm run docker:rebuild   # Rebuild images
npm run docker:logs      # Show logs
npm run docker:ps        # Show service status

# Or use PowerShell helper
.\docker-helper.ps1 up        # Start services
.\docker-helper.ps1 down      # Stop services
.\docker-helper.ps1 rebuild   # Rebuild images
.\docker-helper.ps1 logs      # Show logs with 'Ctrl+C' to exit
.\docker-helper.ps1 health    # Check service health
.\docker-helper.ps1 migrate   # Run migrations
.\docker-helper.ps1 seed      # Seed database
```

---

## 🗄️ Database Operations

```powershell
# Push schema to database (development)
npm run db:push

# Create migration (use if modifying schema)
npx prisma migrate dev --name add_new_field

# Deploy migrations
npm run db:migrate

# Seed with sample data
npm run db:seed

# Open Prisma Studio (visual database explorer)
npm run db:studio
```

---

## 🐛 Troubleshooting

### "Cannot GET /api/auth/login"
**Cause:** API server not running
**Fix:** 
```powershell
# Check if API is running
npm run docker:ps

# Or start it
npm run docker:up

# Or start API directly
npm run dev:api
```

### "failed to fetch" on login
**Possible causes:**
1. API not running → `npm run dev:api`
2. Database not initialized → `npx prisma db push`
3. CORS issue → Check `CORS_ORIGIN` in `.env`
4. Frontend API URL wrong → Check `VITE_API_URL` in `.env`

### PostgreSQL connection refused
**Fix:**
```powershell
# Verify PostgreSQL is running in Docker
npm run docker:ps

# If stopped, restart
npm run docker:up

# Check connection: should work if Docker is running
# DATABASE_URL=postgresql://vealbiz_user:vealbiz_password@localhost:5432/vealbiz
```

### "Port 3000 already in use"
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill process (replace PID with actual number)
taskkill /PID <PID> /F

# Or just use different port
$env:PORT=3001
npm run dev:api
```

### Docker image build fails
```powershell
# Clean and rebuild
npm run docker:down
npm run docker:rebuild
npm run docker:up
```

---

## 📁 Project Structure Overview

```
VealBiz/
├── apps/
│   ├── api/                 # Backend (Fastify + TypeScript)
│   │   ├── src/
│   │   │   ├── routes/      # API endpoints (auth, jobs, candidates)
│   │   │   ├── services/    # Business logic
│   │   │   ├── middleware/  # Auth, error handling
│   │   │   └── lib/         # Database, validation
│   │   ├── prisma/          # Database schema & migrations
│   │   ├── package.json     # API dependencies
│   │   └── Dockerfile
│   └── web/                 # Frontend (React + Vite)
│       ├── src/
│       │   ├── pages/       # Route pages
│       │   ├── components/  # React components
│       │   ├── hooks/       # Custom hooks
│       │   └── lib/         # API client, utilities
│       ├── package.json     # Frontend dependencies
│       └── Dockerfile
├── packages/
│   └── shared/              # Shared types
├── .env                     # Configuration (⚠️ Don't commit)
├── docker-compose.yml       # Docker setup
├── Makefile                 # Unix build commands (not used on Windows)
├── docker-helper.ps1        # Windows PowerShell helper (recommended)
└── package.json             # Root workspace config
```

---

## 📋 Environment Variables (.env)

Key settings for local development:

```env
# Database
DATABASE_URL="postgresql://vealbiz_user:vealbiz_password@localhost:5432/vealbiz?schema=public"

# Security
JWT_SECRET="super-secret-jwt-key-change-me-in-production"
REFRESH_TOKEN_SECRET="super-secret-refresh-key-change-me-in-production"

# Server
PORT=3000
NODE_ENV="development"
CORS_ORIGIN="http://localhost:5173"

# Frontend API URL
VITE_API_URL="http://localhost:3000/api"

# AI API (optional)
GROQ_API_KEY="gsk_your_groq_api_key_here"
```

---

## ✨ Next Steps

1. **Install deps:** `npm install`
2. **Start Docker:** `npm run docker:up`
3. **Initialize DB:** `npx prisma db push`
4. **Seed data:** `npm run db:seed` (optional)
5. **Start dev:** `npm run dev:api` (in one terminal) + `npm run dev` (in another)
6. **Test auth:** http://localhost:5173 → Register → Login

---

## 📞 Need Help?

- Check logs: `npm run docker:logs`
- Check services: `npm run docker:ps`
- Check API health: `npm run health`
- View database: `npm run db:studio`

All fixes have been applied. Your application should now work with modern, non-deprecated dependencies! 🎉

# VealBiz Deployment Guide

This guide covers deploying VealBiz to production with **Docker + Docker Compose** locally and cloud platforms.

## 🚀 Quick Start (Development with Docker)

### 1. Clone and Setup
```bash
git clone https://github.com/windveal/vealbiz.git
cd vealbiz
npm install
```

### 2. Create `.env` file
Copy `.env.local` to `.env` and update values:
```bash
cp .env.local .env
```

**Edit `.env` with your values:**
```env
DB_USER=vealbiz_user
DB_PASSWORD=your-secure-password
JWT_SECRET=your-secure-jwt-secret-change-this
GROQ_API_KEY=gsk_your_groq_key_here
```

### 3. Start Everything
```bash
docker-compose up -d
```

This starts:
- PostgreSQL database on `localhost:5432`
- Backend API on `localhost:3000`
- Frontend on `localhost:5173`

### 4. Initialize Database
```bash
# Run migrations
docker exec vealbiz-api npx prisma migrate deploy

# Or use this if migrations aren't applied:
docker exec vealbiz-api npx prisma db push
```

### 5. Access the App
- Frontend: http://localhost:5173
- API: http://localhost:3000/api
- Database GUI: http://localhost:5555 (Prisma Studio)

---

## 📋 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your Computer / Server                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐    ┌──────────────────┐   ┌────────────┐ │
│  │  Frontend (Vue)  │    │  Backend (Node)  │   │ PostgreSQL │ │
│  │  Port: 5173      │◄──►│  Port: 3000      │◄─►│ Port: 5432 │ │
│  │  (React + Vite)  │    │  (Fastify)       │   │ (Database) │ │
│  └──────────────────┘    └──────────────────┘   └────────────┘ │
│       (Nginx)                  (Node.js)          (PostgreSQL)   │
│                                                                   │
│                      All in Docker Containers                    │
│                    (Easy to scale & deploy)                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🐳 Docker Deployment

### Build Custom Images
```bash
# Build API image
docker build -f apps/api/Dockerfile -t vealbiz-api:latest apps/api

# Build Web image
docker build -f apps/web/Dockerfile -t vealbiz-web:latest apps/web

# Run with docker-compose
docker-compose up -d
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f db
docker-compose logs -f web
```

### Stop Services
```bash
docker-compose down
```

### Cleanup Everything (⚠️ removes data)
```bash
docker-compose down -v
```

---

## ☁️ Production Deployment

### Option 1: Railway.app (Recommended - Easiest)

Railway handles all Docker complexity for you.

**Step 1: Push to GitHub**
```bash
git remote add origin https://github.com/your-username/vealbiz.git
git push -u origin main
```

**Step 2: Create Railway Project**
1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub"
3. Select your `vealbiz` repository
4. Railway auto-detects `docker-compose.yml`

**Step 3: Configure Environment**
1. Click on each service (api, web, db)
2. Add environment variables:

**For `api` service:**
```
DATABASE_URL=your_railway_postgres_url
JWT_SECRET=your_secure_jwt_secret
GROQ_API_KEY=your_groq_key
NODE_ENV=production
```

**For `web` service:**
```
VITE_API_URL=https://your-api.railway.app/api
```

**Step 4: Deploy**
- Railway auto-deploys when you push to GitHub
- View logs: Dashboard → Logs tab
- Check status: Dashboard → Deployments tab

**Cost:** ~$5/month for all services

---

### Option 2: Vercel + Railway (Best for SPA)

Separate frontend and backend for optimal performance.

#### Frontend on Vercel

**Step 1: Prepare Repository Structure**
```bash
# If not already done
npm run build:web
```

**Step 2: Deploy to Vercel**
```bash
npm i -g vercel
vercel
```

Or use GitHub:
1. Go to https://vercel.com
2. "Import Project" → Select GitHub repository
3. Framework: Vite
4. Deploy

**Step 3: environment Variables**
```
VITE_API_URL=https://your-railway-backend.up.railway.app/api
```

**Cost:** Free tier available (~$5/month with custom domain)

#### Backend on Railway (Same as Option 1)

**Cost:** ~$5/month

---

### Option 3: Fly.io (Single Platform)

Fly.io runs your entire app (Docker native).

**Step 1: Install Fly CLI**
```bash
curl -L https://fly.io/install.sh | sh
```

**Step 2: Initialize**
```bash
fly launch --copy-config
# Select region (closest to your users)
# When asked, say "Yes" to use existing docker-compose.yml
```

**Step 3: Set Secrets**
```bash
fly secrets set DATABASE_URL='postgresql://...'
fly secrets set JWT_SECRET='your-secret'
fly secrets set GROQ_API_KEY='your-key'
```

**Step 4: Deploy**
```bash
fly deploy
```

**Cost:** ~$5/month (generous free tier)

---

### Option 4: DigitalOcean App Platform

Easy-to-use managed container platform.

**Step 1: Connect GitHub**
1. Go to https://cloud.digitalocean.com/apps
2. "Create App" → "GitHub"
3. Select your repository
4. Configure services

**Step 2: Configure Each Service**

**API Service:**
- Docker file: `apps/api/Dockerfile`
- Environment: `DATABASE_URL`, `JWT_SECRET`, etc.

**Web Service:**
- Docker file: `apps/web/Dockerfile`  
- Environment: `VITE_API_URL`

**Database:**
- Use DigitalOcean Managed PostgreSQL

**Step 3: Deploy**
- Click "Deploy"
- Wait ~5 minutes for deployment

**Cost:** ~$12-15/month

---

### Option 5: AWS (Complex but Scalable)

For enterprise-grade deployment.

**Services Used:**
- **ECR** - Docker registry
- **ECS** - Container orchestration
- **RDS** - Managed PostgreSQL
- **CloudFront** - CDN
- **ALB** - Load balancer

**This requires more setup, but provides:**
- Auto-scaling
- High availability
- Enterprise security
- Custom domain SSL

**Cost:** $20-50+/month (pay as you use)

---

## 📊 Database Backup & Recovery

### PostgreSQL Backup (Important!)

**Backup to File:**
```bash
docker exec vealbiz-db pg_dump -U vealbiz_user -d vealbiz > backup.sql
```

**Restore from Backup:**
```bash
docker exec -i vealbiz-db psql -U vealbiz_user -d vealbiz < backup.sql
```

**Automated Backups (Cron Job):**
```bash
# On your server, add to crontab:
0 2 * * * docker exec vealbiz-db pg_dump -U vealbiz_user -d vealbiz | gzip > /backups/vealbiz-$(date +\%Y\%m\%d).sql.gz
```

**Cloud Backups:**
- DigitalOcean: Enable automated backups (1 backup/day)
- AWS RDS: Automatic backups to S3
- Railway: Automatic daily backups

---

## 🔒 Security Checklist

Before deploying to production:

- [ ] Change all default passwords
- [ ] Generate strong JWT secret (min 32 chars)
- [ ] Enable HTTPS (SSL Certificate)
- [ ] Set `NODE_ENV=production`
- [ ] Enable database backups
- [ ] Configure firewall rules
- [ ] Set rate limiting on API endpoints
- [ ] Enable CORS only for your domain
- [ ] Hide stack traces in error responses
- [ ] Monitor logs for suspicious activity
- [ ] Use environment variables for secrets
- [ ] Enable database encryption at rest
- [ ] Set up automated database backups
- [ ] Configure health checks
- [ ] Set resource limits (memory, CPU)

---

## 🚨 Monitoring & Logging

### View Application Logs

**Docker:**
```bash
docker-compose logs -f api
docker-compose logs -f db
docker-compose logs -f web
```

**Rail way:**
- Dashboard → Logs tab (real-time)

**Fly.io:**
```bash
fly logs -a YOUR_APP_NAME
```

**DigitalOcean:**
- Console → Logs tab

### Error Tracking

**Add Sentry (Error Tracking):**

1. Go to https://sentry.io (free tier)
2. Create project for Node.js
3. Get `SENTRY_DSN`

Backend (`apps/api/src/index.ts`):
```typescript
import * as Sentry from "@sentry/node";

Sentry.init({ dsn: process.env.SENTRY_DSN });

app.setErrorHandler((error, request, reply) => {
  Sentry.captureException(error);
  // ... error handling
});
```

---

## 🔄 Continuous Deployment (CI/CD)

### GitHub Actions Example

**File: `.github/workflows/deploy.yml`**

```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - run: npm install
      - run: npm run lint
      - run: npm run test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      # Deploy to Railway / Vercel / Fly etc.
      - name: Deploy API
        run: npm run deploy:api
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
      
      - name: Deploy Frontend
        run: npm run deploy:web
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
```

---

## 🆘 Troubleshooting

### Connection Refused (Backend)
```bash
# Check if service is running
docker ps

# Check service health
docker exec vealbiz-api curl http://localhost:3000/health

# Check logs
docker logs vealbiz-api
```

### Database Connection Error
```bash
# Check PostgreSQL is running
docker exec vealbiz-db psql -U vealbiz_user -d vealbiz -c "SELECT 1"

# Check DATABASE_URL format
echo $DATABASE_URL
```

### Port Already in Use
```bash
# Find what's using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port in docker-compose.yml
```

### Out of Memory
```bash
# Increase Docker memory limit
# Docker Desktop → Preferences → Resources → Memory: 4GB+
```

---

## 📈 Performance Optimization

### Frontend Optimization

1. **Enable Gzip Compression** (nginx):
   ```nginx
   gzip on;
   gzip_types text/* application/json;
   ```

2. **Cache Static Assets** (nginx):
   ```nginx
   location ~* \.(js|css|png|jpg)$ {
     expires 1y;
   }
   ```

3. **Use CDN** (Cloudflare):
   - Add your domain to Cloudflare
   - Enable caching

### Backend Optimization

1. **Database Indexing:**
   ```prisma
   model User {
     id String @id
     email String @unique
     @@index([organizationId])
   }
   ```

2. **Connection Pooling:**
   ```
   DATABASE_URL="postgresql://user:pass@host/db?schema=public"
   ```

3. **Enable Caching:**
   - Redis for session storage
   - Cache API responses

---

## 📚 Additional Resources

- [Railway Documentation](https://docs.railway.app)
- [Vercel Documentation](https://vercel.com/docs)
- [Fly.io Documentation](https://fly.io/docs)
- [Docker Documentation](https://docs.docker.com)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)

---

## 🎯 Deployment Comparison

| Platform | Ease | Cost | Scalability | Best For |
|----------|------|------|-------------|----------|
| **Railway** | ⭐⭐⭐⭐⭐ | $5-20 | Medium | Startups |
| **Vercel + Railway** | ⭐⭐⭐⭐ | $5-15 | Medium-High | SPA Projects |
| **Fly.io** | ⭐⭐⭐⭐ | $5-25 | High | Global Apps |
| **DigitalOcean** | ⭐⭐⭐ | $12-50 | High | SMBs |
| **AWS** | ⭐⭐ | $20-200+ | Very High | Enterprise |

**Recommended for MVP:** Railway (all-in-one, simplest)  
**Recommended for SPA:** Vercel (frontend) + Railway (backend)

---

## 🚀 Next Steps

1. ✅ **Local Development**: Use `docker-compose up` locally
2. 🔧 **Staging**: Deploy to Railway staging environment
3. 🌐 **Production**: Deploy main branch to production
4. 📞 **Domain**: Point your domain to deployed app
5. 🔐 **SSL**: Enable HTTPS (automatic on most platforms)

---

**Need help?** Create an issue or email support@windveal.com

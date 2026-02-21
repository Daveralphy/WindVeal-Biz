# VealBiz Troubleshooting Guide

## 🚀 Quick Diagnostics

Run this command to check system health:
```bash
make health
```

This shows API status, web status, and Docker services. If any service is down, see relevant section below.

---

## 🐳 Docker Issues

### Docker Compose won't start
**Symptom**: `make docker-up` fails or services don't start

**Solution**:
```bash
# Check Docker daemon is running
docker ps

# If not, start Docker Desktop

# Check for port conflicts
lsof -i :5173  # Web port
lsof -i :3000  # API port
lsof -i :5432  # Database port

# If ports in use, either:
# 1. Kill the process: kill -9 <PID>
# 2. Change ports in docker-compose.yml

# Try starting again
make docker-up

# View logs to see error
docker-compose logs
```

### Containers keep restarting
**Symptom**: `docker-compose ps` shows "Starting" or "Restarting" status

**Solution**:
```bash
# Check logs for actual error
docker-compose logs api
docker-compose logs web
docker-compose logs db

# Common fix: Remove volumes and rebuild
make docker-down
docker-compose down -v
make docker-up
```

### PostgreSQL container won't initialize
**Symptom**: Database logs show initialization errors

**Solution**:
```bash
# Remove database volume (WARNING: deletes data)
docker-compose down -v

# Check env variables are set
cat .env

# Restart
make docker-up

# Check database initialized
docker-compose exec db psql -U $DB_USER -l
```

### Out of disk space
**Symptom**: Docker build fails with "No space left"

**Solution**:
```bash
# Clean up Docker system
docker system prune

# Or more aggressive
docker system prune -a  # Removes all unused images

# Check disk space
df -h

# Remove old backups if needed
rm -rf backups/old_*.sql
```

---

## 🌐 Frontend Issues

### Blank web page
**Symptom**: Visit http://localhost:5173, see white screen

**Solution**:
```bash
# Check browser console for JavaScript errors (F12)
# Common issues:
# - VITE_API_URL not set → Check .env file
# - API unreachable → Check `make logs-api`
# - React component error → Check browser console

# Solution 1: Check .env
cat .env | grep VITE_API_URL

# Solution 2: Verify API is running
curl http://localhost:3000/health

# Solution 3: Rebuild frontend
make docker-down
make build-web
make docker-up

# Solution 4: Clear browser cache (Ctrl+Shift+Delete)
```

### Vite dev server not responding
**Symptom**: Web loads but says "Cannot GET /"

**Solution**:
```bash
# Check Vite is running
make logs-web

# If not running, check errors
make dev-web  # Run directly to see errors

# Common fix: Kill and restart
make docker-down
make docker-up

# If still fails: Check package.json
cd apps/web
npm install
npm run dev
```

### CSS/Tailwind not loading
**Symptom**: Page loads but no styling

**Solution**:
```bash
# Check Tailwind config
cat apps/web/tailwind.config.js

# Rebuild CSS
cd apps/web
npm run build

# Restart dev server
make docker-down
make docker-up

# If still broken: Reinstall dependencies
rm -rf apps/web/node_modules
npm install
```

### Images not loading
**Symptom**: Broken image icons

**Solution**:
```bash
# Check image paths are correct
# Frontend should use relative paths or environment variables

# For local dev, images must be in:
# apps/web/public/images/

# Create directory if missing
mkdir -p apps/web/public/images

# Test image path
curl http://localhost:5173/images/filename.png
```

### React hooks error
**Symptom**: "React Hook used outside of React component" in console

**Solution**:
```bash
# This happens when using hooks in wrong component
# Common: useAuth outside of component

# Fix: Wrap with context provider or use hooks inside component
# See apps/web/App.tsx for example

# Or restart server
make docker-down
make docker-up
```

---

## 🔌 Backend API Issues

### API not responding
**Symptom**: `curl http://localhost:3000/health` fails

**Solution**:
```bash
# Check API is running
docker-compose ps api

# If not running, check logs
make logs-api

# Common errors:
# - Port already in use: Change port in docker-compose.yml
# - DATABASE_URL not set: Check .env file
# - Migrations not run: Run `make migrate`

# Restart API
docker-compose restart api

# Or full restart
make docker-down
make docker-up
```

### 500 Internal Server Error
**Symptom**: API returns 500 error

**Solution**:
```bash
# Check API logs for stack trace
make logs-api

# Common fixes:
# 1. Database connection issue
docker-compose exec db psql -U $DB_USER -d $DB_NAME -c "\l"

# 2. Missing environment variables
cat .env | grep -E "JWT_SECRET|DATABASE_URL"

# 3. Migrations not run
make migrate

# 4. Restart API
docker-compose restart api
```

### Login/Register fails
**Symptom**: Frontend shows "Network error" when trying to login

**Solution**:
```bash
# Step 1: Check API is running
curl http://localhost:3000/health

# Step 2: Check CORS is configured
# In .env, verify:
# CORS_ORIGIN=http://localhost:5173
# FRONTEND_URL=http://localhost:5173

# Step 3: Check database
make db-studio
# Look for users table (should be empty initially)

# Step 4: Check logs
make logs-api

# Step 5: Test endpoint directly
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"organizationName":"Test","email":"test@test.com","password":"Test123!","firstName":"Test","lastName":"User"}'

# Step 6: Restart everything
make docker-down
make docker-up
make migrate
```

### JWT token invalid
**Symptom**: "Invalid token" or "Unauthorized" when accessing protected endpoints

**Solution**:
```bash
# Check JWT_SECRET is set and same everywhere
cat .env | grep JWT_SECRET

# JWT token expires after 15 minutes
# Solution: Login again

# If token was valid before:
# Check server time is correct (Docker container vs host)
docker-compose exec db date

# Restart API with new JWT_SECRET
make docker-down

# Edit .env: Change JWT_SECRET to new value
# Then:
make docker-up
```

### CORS errors
**Symptom**: Browser console shows "CORS policy" error

**Solution**:
```bash
# Check CORS_ORIGIN in .env
cat .env | grep CORS_ORIGIN

# Should match your frontend URL
# For local dev:
# CORS_ORIGIN=http://localhost:5173

# For production:
# CORS_ORIGIN=https://yourdomain.com

# Update .env
nano .env  # Edit the file

# Restart API
docker-compose restart api
```

### File upload fails
**Symptom**: Resume upload returns 413 or 400 error

**Solution**:
```bash
# Check file size limit
# Fastify has default 1MB limit

# In apps/api/index.ts, adjust:
# fastify.register(require('@fastify/multipart'), { limits: { fileSize: 50 * 1024 * 1024 } })

# Check file type
# Only PDF and DOCX supported

# Restart after changes
make docker-down
make docker-up
```

---

## 💾 Database Issues

### Database won't connect
**Symptom**: "connect ECONNREFUSED" errors

**Solution**:
```bash
# Check PostgreSQL is running
docker-compose ps db

# Check DATABASE_URL is correct
echo $DATABASE_URL

# Should be: postgresql://user:password@host:port/database

# Common issues:
# - Wrong port (default 5432)
# - Wrong username (default postgres)
# - Database doesn't exist

# Connect to database and check
docker-compose exec db psql -U postgres
# Inside psql:
\l              # List databases
\du             # List users
\q              # Quit

# If database missing, create it
docker-compose exec db psql -U postgres -c "CREATE DATABASE vealbiz_db;"

# Restart
make docker-down
make docker-up
```

### Migrations failed
**Symptom**: `make migrate` shows errors

**Solution**:
```bash
# Check migration status
npx prisma migrate status

# If conflict, resolve with:
npx prisma migrate resolve --rolled-back <migration-name>

# Or push schema directly (WARNING: may lose data)
make db-push

# Or reset database (WARNING: deletes all data)
make docker-down
docker-compose down -v
make docker-up
make migrate
```

### Can't connect to Prisma Studio
**Symptom**: `make db-studio` fails

**Solution**:
```bash
# Check DATABASE_URL is set
echo $DATABASE_URL

# Make sure database is running
docker-compose ps db

# Generate Prisma client
npx prisma generate

# Try again
make db-studio
```

### Slow database queries
**Symptom**: Page loading very slow

**Solution**:
```bash
# Enable query logging in Prisma
# In apps/api/src/index.ts:
// Add this when creating Prisma client:
// log: ['query', 'error', 'warn']

# Check slow queries with Prisma Studio
make db-studio

# Add database indexes
# Edit prisma/schema.prisma, then:
make migrate

# View query performance
docker-compose logs db | grep "duration"
```

### Out of storage in database
**Symptom**: Database reports "no space left"

**Solution**:
```bash
# Check PostgreSQL data size
docker-compose exec db du -sh /var/lib/postgresql/data

# Check available disk
docker-compose exec db df -h

# Backup old data
make backup

# Clean up old records (if safe)
docker-compose exec db psql -U $DB_USER -d $DB_NAME -c "DELETE FROM candidates WHERE created_at < NOW() - INTERVAL '90 days';"

# Or expand Docker volume
# Edit docker-compose.yml: volumes.postgres_data size

# Or connect to external database with more space
```

---

## 🔐 Authentication Issues

### Can't reset password
**Symptom**: No password reset functionality

**Solution**:
```bash
# Currently not implemented
# To add password reset:

# 1. Create migration
npx prisma migrate dev --name add_password_reset

# 2. In schema.prisma, add:
# model User {
#   ...
#   passwordResetToken String?
#   passwordResetExpiresAt DateTime?
# }

# 3. Create password reset endpoint in apps/api/src/routes/auth.ts

# See DEPLOYMENT.md "Roadmap" section for planned features
```

### Session expires too quickly
**Symptom**: Logged in users get "Unauthorized" after 15 minutes

**Solution**:
```bash
# Tokens expire by design (15 min access, 7 day refresh)
# Currently tokens don't auto-refresh

# To add token refresh:

# 1. In apps/api/src/services/auth/tokenService.ts
#    Add endpoint for JWT refresh

# 2. In apps/web/src/hooks/useAuth.ts
#    Add refresh logic when token expires

# 3. In apps/web/src/lib/api.ts
#    Handle 401 and retry with new token

# Workaround: Increase token expiry in tokenService.ts
# Edit expiresIn: '7d' (increase from '15m')

# Or users manually login again
```

### Enterprise/organizational users not separated
**Symptom**: Can access another organization's candidates/jobs

**Solution**:
```bash
# Ensure all queries filter by organization
# In apps/api/src/routes/jobs.ts and candidates.ts:

# When retrieving records:
// const jobs = await prisma.job.findMany({
//   where: { organizationId: user.organizationId }
// })

# Check schema.prisma for @unique constraints

# Add authorization middleware to verify organization
# See apps/api/src/middleware/auth.ts for example
```

---

## 📦 Dependency Issues

### Module not found error
**Symptom**: "Cannot find module 'xxx'"

**Solution**:
```bash
# Clear and reinstall dependencies
make refresh-deps

# Or manually:
rm -rf node_modules apps/*/node_modules
npm install

# Check specific package installed
npm list xxx

# Or install specific package
npm install xxx
```

### Version conflicts
**Symptom**: "npm ERR! peer dep missing"

**Solution**:
```bash
# View conflicts
npm install

# Fix by updating package-lock.json
rm package-lock.json
npm install

# Or install specific version
npm install package@latest
```

### TypeScript errors
**Symptom**: `npm run type-check` fails

**Solution**:
```bash
# See specific errors
npm run type-check

# Ensure tsconfig.json is correct
cat apps/web/tsconfig.json

# Regenerate Prisma types
npx prisma generate

# Restart TypeScript server (in VSCode: Cmd+Shift+P -> TypeScript: Restart TS Server)
```

---

## 🧪 Testing Issues

### Tests won't run
**Symptom**: `npm run test` fails

**Solution**:
```bash
# Check test files exist
find . -name "*.test.ts" -o -name "*.spec.ts"

# If none exist, tests not implemented yet

# To add tests, see section below
```

### Coverage report issues
**Symptom**: Can't generate coverage report

**Solution**:
```bash
# Ensure Jest is installed
npm list jest

# Generate coverage
npm run test -- --coverage

# Coverage report in coverage/
open coverage/index.html
```

---

## 🚀 Deployment Issues

### Build fails in production
**Symptom**: `docker build` fails

**Solution**:
```bash
# Check build logs
docker build -f apps/api/Dockerfile -t vealbiz-api:test . 2>&1 | grep -i error

# Common issues:
# 1. Node cache issues: Add --no-cache flag
docker build --no-cache -f apps/api/Dockerfile -t vealbiz-api:test .

# 2. Missing .dockerignore: Create it
touch .dockerignore

# 3. Node modules conflict: Clean first
rm -rf apps/api/node_modules

# 4. Env variables missing: Check .env file
cat .env | grep -v "^#" | grep -v "^$"
```

### Docker push fails
**Symptom**: Can't push image to registry

**Solution**:
```bash
# Check Docker login
docker login

# Tag image correctly
docker tag vealbiz-api:latest yourregistry/vealbiz-api:latest

# Push
docker push yourregistry/vealbiz-api:latest

# If authentication fails:
docker logout
docker login
```

### Railway deployment fails
**Symptom**: Railway build fails or doesn't start

**Solution**:
```bash
# Check Railway CLI
railway --version

# Log in to Railway
railway login

# Link to project
railway link

# View logs
railway logs

# Common issues:
# 1. Missing environment variables: Set in Railway dashboard
# 2. Database migration failed: Run manually
# 3. Port not exposed: Check Procfile or railway.toml
```

### Production app won't start
**Symptom**: Services start but app unreachable

**Solution**:
```bash
# Check Docker logs
docker-compose -f docker-compose.prod.yml logs

# Check networking
docker network ls
docker network inspect vealbiz-network

# Check ports
docker-compose -f docker-compose.prod.yml ps

# Test health endpoint
curl http://localhost/health  # Through Nginx
curl http://localhost:3000/health  # Direct API

# Check process running in container
docker-compose -f docker-compose.prod.yml exec api ps aux
```

---

## 📊 Performance Issues

### Frontend slow
**Symptom**: Page takes >3 seconds to load

**Solution**:
```bash
# Check bundle size
cd apps/web
npm run build
# Check dist/ folder size

# Identify large dependencies
npm list --all | grep -i node_modules

# Use React DevTools Profiler
# In browser: F12 → Profiler tab

# Lazy load non-critical pages
# In apps/web/src/App.tsx:
// const Jobs = lazy(() => import('./pages/Jobs'))
// const Dashboard = lazy(() => import('./pages/Dashboard'))
```

### Backend slow
**Symptom**: API responses take >1 second

**Solution**:
```bash
# Enable API logging
# In apps/api/index.ts, set: logger: { level: 'debug' }

# View timestamps in logs
make logs-api

# Check database query performance
make db-studio
# Look at query times

# Add .index() to frequently queried fields in schema.prisma
# Then run migrations

# Use connection pooling for database
# Check PgBouncer configuration
```

### Docker containers slow
**Symptom**: Services take a long time to start

**Solution**:
```bash
# Check logs during startup
docker-compose up (don't use -d)

# Increase resource limits
# Edit docker-compose.yml:
# services:
#   api:
#     environment:
#       - NODE_OPTIONS=--max-old-space-size=2048

# Or add limits
# deploy:
#   resources:
#     limits:
#       cpus: '2'
#       memory: 2G

make docker-down
make docker-up
```

---

## 🔧 Configuration Issues

### Environment variables not loading
**Symptom**: Process uses wrong values

**Solution**:
```bash
# Check .env file exists
ls -la .env

# Check variables are set
cat .env | head -20

# Check format (no spaces around =)
# CORRECT: DATABASE_URL=postgresql://...
# WRONG:  DATABASE_URL = postgresql://...

# Restart services to reload
make docker-down
make docker-up

# Verify in running container
docker-compose exec api env | grep DATABASE_URL
```

### Wrong environment detected
**Symptom**: Development config used in production

**Solution**:
```bash
# Check NODE_ENV
echo $NODE_ENV

# Set for current session
export NODE_ENV=production

# Or in docker-compose.prod.yml:
# environment:
#   - NODE_ENV=production

# Verify running
docker-compose -f docker-compose.prod.yml exec api echo $NODE_ENV
```

---

## 🆘 Emergency Procedures

### Database corrupted
**Solution**:
```bash
# Restore from backup
make docker-down

# List backups
ls -la backups/

# Restore
docker-compose up -d db
cat backups/backup_XXXXXXX.sql | docker-compose exec -T db psql -U $DB_USER -d $DB_NAME

make migrate
make docker-up
```

### Complete reset (WARNING: deletes all data)
**Solution**:
```bash
# Stop everything
make docker-down

# Remove all Docker artifacts
docker-compose down -v  # Removes volumes
docker system prune -a  # Removes unused images

# Clean build artifacts
make clean

# Start fresh
make install
make docker-up
make migrate
```

### Security breach suspected
**Solution**:
```bash
# 1. Stop services immediately
make docker-down

# 2. Change secrets
# Generate new: openssl rand -base64 32
# Update: JWT_SECRET, DB passwords

# 3. Rotate tokens
# All users need to re-login

# 4. Review logs for unauthorized access
# docker-compose logs --since 2hours

# 5. Audit database changes
# Check for unexpected records

# 6. Update .env with new secrets
# Restart services

make docker-up
```

---

## 📞 Getting More Help

### Debug mode
```bash
# Enable verbose logging
export DEBUG=vealbiz:*

# Or check individual services
DEBUG=fastify:* make dev-api
DEBUG=react:* make dev-web
```

### Check logs
```bash
# All logs
make docker-logs

# Specific service
make logs-api
make logs-web
make logs-db

# With timestamps
docker-compose logs --timestamps

# Last 100 lines
docker-compose logs --tail 100
```

### SQL debugging
```bash
# Connect to database directly
docker-compose exec db psql -U $DB_USER -d $DB_NAME

# Inside psql:
\dt                  # Show tables
SELECT COUNT(*) FROM "User";  # Count records
SELECT * FROM "User" WHERE email = 'test@test.com';
```

---

**Last Updated**: 2026-02-20  
**Maintained By**: Development Team  
**Questions?** See QUICKSTART.md or DEPLOYMENT.md

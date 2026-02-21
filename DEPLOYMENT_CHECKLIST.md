# VealBiz Deployment Checklist

## Pre-Deployment

### Code Quality
- [ ] Run `npm run lint` - no errors/warnings
- [ ] Run `npm run type-check` - TypeScript passes
- [ ] Run `npm run test` - all tests pass
- [ ] Run `npm run build` - builds successfully
- [ ] Review code for console.log() and debug statements
- [ ] Check for hardcoded credentials or secrets

### Database
- [ ] Database migrations are reviewed
- [ ] Backup existing database (if upgrading)
- [ ] Test migrations in staging environment
- [ ] Verify database has required indexes
- [ ] Check disk space for database growth

### Security
- [ ] Generate new JWT_SECRET
- [ ] Set strong database password
- [ ] Enable SSL/HTTPS certificate
- [ ] Configure firewall rules
- [ ] Review CORS settings (only allow your domain)
- [ ] Check that .env is in .gitignore
- [ ] Verify no secrets in repository
- [ ] Enable rate limiting
- [ ] Set Content Security Policy headers

### Environment
- [ ] Set `NODE_ENV=production`
- [ ] Configure GROQ_API_KEY
- [ ] Set FRONTEND_URL to your domain
- [ ] Set CORS_ORIGIN to your domain
- [ ] Test API keys (Groq, SendGrid, etc.)

### Performance
- [ ] Enable gzip compression
- [ ] Configure caching headers
- [ ] Optimize database queries
- [ ] Test with load generation
- [ ] Verify CDN is configured
- [ ] Set resource limits (memory, CPU)

### Monitoring
- [ ] Set up error tracking (Sentry)
- [ ] Configure logging
- [ ] Set up health checks
- [ ] Configure alerting
- [ ] Set up uptime monitoring
- [ ] Plan incident response

---

## Deployment Steps

### Step 1: Prepare Environment
```bash
# Create .env file from template
cp .env.production .env

# Edit with production values
nano .env

# Verify environment variables
cat .env | grep -v "^#" | grep -v "^$"
```

### Step 2: Build Docker Images
```bash
# Local testing
docker-compose -f docker-compose.prod.yml build

# Or push to registry
docker build -f apps/api/Dockerfile -t vealbiz-api:latest .
docker tag vealbiz-api:latest your-registry/vealbiz-api:latest
docker push your-registry/vealbiz-api:latest
```

### Step 3: Database Migration
```bash
# Run migrations
docker-compose -f docker-compose.prod.yml up -d db

# Connect and run migrations
docker-compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# Verify migration
docker-compose -f docker-compose.prod.yml exec api npx prisma db execute --stdin < check.sql
```

### Step 4: Start Services
```bash
# Option A: Local Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# Option B: Railway (Git push to deploy)
git push origin main

# Option C: Manually deploy on server
ssh user@server
cd /opt/vealbiz
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

### Step 5: Verify Deployment
```bash
# Check service health
docker-compose -f docker-compose.prod.yml ps

# Check application logs
docker-compose -f docker-compose.prod.yml logs api
docker-compose -f docker-compose.prod.yml logs web
docker-compose -f docker-compose.prod.yml logs db

# Test API endpoint
curl https://api.vealbiz.com/health

# Test frontend
curl https://vealbiz.com

# Verify SSL certificate
curl -I https://vealbiz.com
```

### Step 6: Run Tests
```bash
# Integration tests
npm run test:integration

# End-to-end tests (if available)
npm run test:e2e

# Load testing
npm run test:load
```

### Step 7: Monitor
```bash
# Watch logs for errors
docker-compose -f docker-compose.prod.yml logs -f

# Monitor resource usage
docker stats

# Check database connections
docker-compose -f docker-compose.prod.yml exec db psql -U $DB_USER -d $DB_NAME -c "SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"
```

---

## Post-Deployment

### Health Checks
- [ ] API responds to requests
- [ ] Frontend loads without errors
- [ ] Database connections working
- [ ] Authentication and login working
- [ ] File uploads working
- [ ] AI ranking service working
- [ ] Emails sending (if configured)
- [ ] No error logs in aggregator

### Performance Checks
- [ ] API response time < 200ms
- [ ] Frontend load time < 3s
- [ ] No memory leaks
- [ ] CPU usage acceptable
- [ ] Database slow queries log empty

### Functionality Tests
- [ ] Create account/register working
- [ ] Login working
- [ ] Create job working
- [ ] Upload resume working
- [ ] View candidates with scores
- [ ] Update candidate stage
- [ ] Download reports (if available)

### Security Checks
- [ ] HTTPS working (no insecure warnings)
- [ ] Session tokens secure
- [ ] Database credentials not exposed
- [ ] API rate limiting working
- [ ] CSRF protection working
- [ ] No exposed secrets in logs

---

## Rollback Plan

If something goes wrong:

### Quick Rollback
```bash
# Stop current deployment
docker-compose -f docker-compose.prod.yml down

# Switch to previous image
docker-compose -f docker-compose.prod.yml up -d

# Or rollback database
docker-compose -f docker-compose.prod.yml exec db psql -U $DB_USER -d $DB_NAME < backup.sql
```

### Database Rollback
```bash
# If migrations failed
npx prisma migrate resolve --rolled-back <migration-name>
npx prisma migrate deploy

# Point to backup database
export DATABASE_URL="postgresql://user:pass@backup-host/vealbiz"
npx prisma db push
```

### Repository Rollback
```bash
# Revert to previous version
git revert <commit-hash>
git push origin main

# Wait for redeployment (auto deployment)
```

---

## Maintenance Tasks

### Daily
- [ ] Check error log aggregator (Sentry)
- [ ] Monitor API/frontend response times
- [ ] Check disk space
- [ ] Verify backups ran

### Weekly
- [ ] Review database performance
- [ ] Check for security updates
- [ ] Test restore/recovery procedures
- [ ] Review user feedback/issues

### Monthly
- [ ] Full database backup verification
- [ ] Security audit
- [ ] Update dependencies
- [ ] Performance optimization review

---

## Rollback Triggers

Rollback immediately if:
- [ ] API not responding
- [ ] Authentication broken
- [ ] Data loss occurring
- [ ] Critical security issue
- [ ] Severe performance degradation

---

## Communication

### Team Notification
```bash
# Before deployment
- Inform team in #deployments channel
- Schedule maintenance window if needed
- Expected downtime: 5-10 minutes

# After deployment
- Confirm deployment successful
- Share deployment notes
- List changed features
- Report any issues
```

### User Communication
```bash
# Before maintenance
- Send email to users
- Post in-app banner
- Schedule maintenance window
- Expected downtime: X minutes

# After maintenance
- Confirm service is up
- Thank users for patience
- Report any issues
```

---

## Escalation

If issues occur:
1. Page on-call developer
2. Start incident call (Bridge)
3. Update status page
4. Prepare rollback plan
5. Execute rollback if necessary
6. Post-mortem within 24 hours

---

## Success Criteria

Deployment is successful when:
- ✅ All services are healthy
- ✅ Tests pass (unit, integration, E2E)
- ✅ No critical errors in logs
- ✅ Performance metrics acceptable
- ✅ Users can login and use app
- ✅ AI ranking is functional
- ✅ File uploads work
- ✅ No data loss

---

**Last Updated:** 2026-02-20
**Version:** 1.0
**Maintained By:** DevOps Team

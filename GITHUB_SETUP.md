# GitHub Repository Setup Guide

## 🚀 Step 1: Create GitHub Repository

### Option A: Using GitHub CLI (Recommended)
```bash
# Install GitHub CLI if not already installed
# https://cli.github.com/

# Authenticate
gh auth login

# Create repository
gh repo create vealbiz \
  --public \
  --description "Recruitment and candidate ranking platform" \
  --homepage "https://vealbiz.com" \
  --remote=origin \
  --source=. \
  --git-push
```

### Option B: Manual GitHub Setup
1. Go to https://github.com/new
2. **Repository name**: `vealbiz`
3. **Description**: "Recruitment and candidate ranking platform"
4. **Public/Private**: Choose (public recommended for portfolio)
5. **Add .gitignore**: Select "Node"
6. **Add license**: Select "MIT"
7. Click "Create repository"

Then push your local code:
```bash
git init
git add .
git commit -m "Initial commit: VealBiz application"
git branch -M main
git remote add origin https://github.com/yourusername/vealbiz.git
git push -u origin main
```

---

## 🔐 Step 2: Configure GitHub Secrets

GitHub Actions CI/CD pipeline needs secrets for deployment and access tokens.

### Navigate to Settings
1. Go to your repository: https://github.com/yourusername/vealbiz
2. Click "Settings" tab
3. Left sidebar → "Secrets and variables" → "Actions"

### Add Secrets

#### Required Secrets (for Railway deployment)

**1. RAILWAY_TOKEN**
```
Purpose: Railway API access for development deployment
Obtain: https://app.railway.app/account/tokens
Steps:
1. Login to Railway
2. Click profile → Account
3. Tokens section → Create
4. Copy token
5. Add to GitHub Secrets with name: RAILWAY_TOKEN
```

**2. RAILWAY_TOKEN_PROD**
```
Purpose: Railway API access for production deployment (use different account/project)
Same steps as RAILWAY_TOKEN, but for production Railway project
```

**3. DEV_DATABASE_URL**
```
Purpose: Development database connection string
Format: postgresql://username:password@host:port/database
Example: postgresql://devuser:securepass@db.dev.railway.app:5432/vealbiz_dev

Obtain:
1. Set up PostgreSQL database (e.g., Railway, Render.com, Heroku)
2. Copy connection string
3. Replace username:password with actual credentials
```

**4. PROD_DATABASE_URL**
```
Purpose: Production database connection string
Format: Same as DEV_DATABASE_URL but for production database
Important: Use strong password and verify connection is secure (SSL required)
```

**5. DEV_JWT_SECRET**
```
Purpose: JWT signing key for development
Generate: openssl rand -base64 32
Example: AbCdEfGhIjKlMnOpQrStUvWxYz1234567890+/==

Security: Different dev and prod secrets recommended
```

**6. PROD_JWT_SECRET**
```
Purpose: JWT signing key for production
Generate: openssl rand -base64 32 (different from dev)
Security: Store securely, rotate periodically
```

**7. GROQ_API_KEY**
```
Purpose: Groq API access for AI-powered resume ranking
Obtain:
1. Go to https://console.groq.com/keys
2. Create new API key
3. Copy and paste value
4. This key can be same for test/prod (but consider rate limits)
```

#### Optional Secrets (for Slack notifications)

**SLACK_WEBHOOK**
```
Purpose: Post deployment notifications to Slack
Obtain:
1. Go to your Slack workspace settings
2. Apps & integrations → Manage apps
3. Create New App → From scratch
4. Name: "VealBiz Deployments"
5. Under "Incoming Webhooks" → Add New Webhook to Workspace
6. Select channel (e.g., #deployments)
7. Allow
8. Copy Webhook URL (starts with https://hooks.slack.com/)
9. Add to GitHub Secrets with name: SLACK_WEBHOOK

Note: Skip if you don't use Slack
```

### Add Environment Variables (GitHub Variables)

GitHub Variables are non-sensitive configuration visible in logs (use for config, not secrets):

1. Same Settings page → "Variables" tab
2. Add these variables:

```
REGISTRY=ghcr.io
REPOSITORY_NAME=yourusername/vealbiz
NODE_ENV=production
```

---

## 📋 Step 3: Configure Branch Protection

Protect production deployments from accidental pushes:

1. Settings → Branches (left sidebar)
2. Click "Add rule"
3. **Branch name pattern**: `main`
4. Check:
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
5. Click "Create"

Now `main` branch requires:
- Pull request created
- All CI checks pass (tests, build, security)
- At least 1 code review
- Before merging

---

## 🔍 Step 4: Configure Status Checks

Tell GitHub which CI checks must pass before merging:

1. Settings → Branches → main rule
2. Under "Required status checks", search and select:
   - ✅ test (from "Test & Lint" job)
   - ✅ build (from "Build Docker Images" job)
   - ✅ security (from "Security Check" job)
3. Save changes

---

## 🚀 Step 5: Deploy from GitHub

Now your CI/CD pipeline is configured:

### Development Deployment
```bash
# Push to develop branch
git checkout -b develop
git push origin develop

# GitHub Actions automatically:
# 1. Runs tests and linting
# 2. Builds Docker images
# 3. Pushes to GitHub Container Registry
# 4. Deploys to Railway development environment
# 5. Runs smoke tests

# Watch deployment
# GitHub repo → Actions tab → Watch workflow
```

### Production Deployment
```bash
# Create pull request from develop to main
git push origin develop
# Go to GitHub → Create Pull Request

# GitHub Actions runs all checks
# Team reviews and approves
# Merge to main

# GitHub Actions automatically:
# 1. Runs all tests and security checks
# 2. Builds Docker images
# 3. Deploys to Railway production
# 4. Runs smoke tests
# 5. Posts Slack notification

# Watch at: GitHub repo → Actions tab → Deployments
```

---

## 🔗 Step 6: Connect Railway to GitHub

Integrate Railway with GitHub for automatic deployments:

### Option A: Railway CLI Deployment (via GitHub Actions)
Currently configured in `.github/workflows/ci-cd.yml` - no additional setup needed.

### Option B: Railway Native GitHub Integration
For alternative deployment method:

1. Go to https://railway.app
2. Dashboard → Projects
3. Select your project
4. Settings → Integrations
5. GitHub → Connect
6. Select repository
7. Authorize

Now Railway watches your GitHub repository for pushes and automatically deploys.

---

## 📊 Step 7: Monitor Deployments

### GitHub Actions Dashboard
```
1. Go to your repository
2. Click "Actions" tab
3. See all workflow runs
4. Click workflow to see details:
   - Job logs
   - Step output
   - Test/build artifacts
5. Click "Deployments" tab for deployment history
```

### Watch Workflow
```bash
# Using GitHub CLI
gh run list                    # List recent runs
gh run view <run-id>          # View specific run
gh run view <run-id> --log    # Stream logs
```

### Real-time Deployment Logs
```bash
# From Railway CLI
railway logs --environment production
railway logs --environment development

# Watch specific service
railway logs --service api
```

---

## 🔒 Step 8: Security Best Practices

### Environment Variables
```yaml
✅ DO:
- Store sensitive values in GitHub Secrets
- Use different tokens/secrets for dev and prod
- Rotate secrets regularly (monthly recommended)
- Use strong passwords (20+ chars with symbols)
- Enable 2FA on GitHub account

❌ DON'T:
- Commit .env files to repository
- Commit API keys or tokens
- Use same secret for dev and prod
- Share secrets between team members (use GitHub Teams)
- Log sensitive values in CI output
```

### Access Control
```bash
# Protect production secrets
# Only repository admins should manage production secrets

# Require branch protection on main
# No one can push directly to main

# Use GitHub Teams for code review
# @mention team instead of individual
```

### Audit Trail
```bash
# Review who deployed what and when
# GitHub Actions → Deployments tab shows history

# Railway deployment logs
railway logs --since 24h

# GitHub audit log
Settings → Audit log
```

---

## 🧪 Step 9: Test Your CI/CD Pipeline

### Test Development Deployment
```bash
# Create test branch
git checkout -b test/deployment

# Make small change (e.g., update README)
echo "# Test deployment" >> README.md
git add README.md
git commit -m "Test CI/CD deployment"
git push origin test/deployment

# Create pull request
# GitHub Actions runs, but doesn't deploy (only on develop/main)

# Watch workflow
# GitHub repo → Actions tab

# Merge after tests pass (if testing on develop)
```

### Verify Production Secrets
```bash
# Before setting production secrets, test with dummy values:
# PROD_DATABASE_URL = postgresql://test:test@localhost:5432/test
# PROD_JWT_SECRET = test-secret-123

# This will fail to connect to database (expected)
# Shows CI/CD pipeline works, just needs real secrets

# After verifying, update secrets with real values
```

### Test Rollback
```bash
# On production deployment failure:
# 1. GitHub Actions shows failed job
# 2. Fix in code/env variables
# 3. Merge to main or manually trigger
# 4. GitHub Actions auto-retries
```

---

## 📈 Step 10: Monitoring & Alerts

### GitHub Notifications
```
1. Go to Settings → Notifications
2. Configure:
   - Email on failed workflows: ✅ Yes
   - Email on deployment: ✅ Yes
   - Comment mentions: ✅ Yes
```

### Slack Integration
Already configured in GitHub Actions workflow (when SLACK_WEBHOOK set):
- ✅ Notifications on production deployment success
- ✅ Notifications on production deployment failure
- ✅ Deployment details (commit, author, URL)

### Status Badges
Add to your README.md:

```markdown
# VealBiz

[![CI/CD Pipeline](https://github.com/yourusername/vealbiz/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/yourusername/vealbiz/actions)

[![Deploy Status](https://img.shields.io/badge/Production-Live-green)](https://vealbiz.com)

Latest deployment: [![Latest deployment](https://img.shields.io/github/deployments/yourusername/vealbiz/production?label=Production&color=blue)](https://github.com/yourusername/vealbiz/deployments/production)
```

---

## 🆘 Troubleshooting

### Workflow fails with "secret not found"
```
Solution:
1. GitHub Settings → Secrets
2. Verify SECRET_NAME exists
3. Check spelling matches workflow file
4. Re-add secret if needed
5. Retry workflow
```

### Deployment stuck on "In Progress"
```
Solution:
1. Check Railway status: https://status.railway.app
2. Check workflow logs: Actions → Click workflow
3. Cancel stuck workflow: Actions → [...] → Cancel workflow
4. Manually redeploy: railway up --service api --service web
```

### PR won't merge - checks failing
```
Solution:
1. Click "Details" on failed check
2. Review error message
3. Fix code locally
4. git push to update PR
5. Workflow auto-reruns
6. Once all checks pass, can merge
```

### Production secrets exposed in logs
```
Emergency Response:
1. Regenerate all secrets immediately
2. GitHub: Update Secrets to new values
3. Railway/Database: Rotate credentials
4. Review audit log for unauthorized access
5. Disable old credentials
6. Review code for hardcoded values
7. Git history check for accidental commits
```

---

## 📚 Additional Resources

### GitHub Actions
- Docs: https://docs.github.com/actions
- Marketplace: https://github.com/marketplace/actions

### Railway Deployment
- Docs: https://docs.railway.app
- CLI: https://docs.railway.app/cli

### Secrets Management
- GitHub Secrets: https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions
- Best Practices: https://docs.github.com/en/code-security/secret-scanning

---

## 🎯 Deployment Checklist

After completing all steps:

```bash
☐ GitHub repository created
☐ Code pushed to main/develop branches
☐ RAILWAY_TOKEN secret added
☐ RAILWAY_TOKEN_PROD secret added
☐ DEV_DATABASE_URL secret added
☐ PROD_DATABASE_URL secret added
☐ DEV_JWT_SECRET secret added
☐ PROD_JWT_SECRET secret added
☐ GROQ_API_KEY secret added
☐ SLACK_WEBHOOK secret added (optional)
☐ Branch protection enabled on main
☐ Status checks required: test, build, security
☐ PR review required: Enabled
☐ Test workflow runs successfully on develop push
☐ Production deployment tested (via PR merge to main)
☐ Slack notifications working (if Slack configured)
☐ Monitoring dashboard set up
☐ Team access configured
☐ Documentation updated with deployment instructions
```

---

**Last Updated**: 2026-02-20  
**Maintained By**: DevOps Team  
**Emergency Issues?** See TROUBLESHOOTING.md

For quick help, run: `make help`

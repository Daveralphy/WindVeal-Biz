# VealBiz Quick Reference Card

Keep this handy while working on VealBiz! 🚀

---

## 🚀 Setup (One Time)

```bash
# Clone and setup
git clone https://github.com/yourusername/vealbiz.git
cd vealbiz
cp .env.local .env

# Install and run
npm install
make docker-up
make migrate

# Verify
make health
# Open: http://localhost:5173
```

---

## 📝 Common Commands

### Development
```bash
make dev                # Start all servers
make dev-web           # Frontend only
make dev-api           # Backend only
make check              # Lint + type-check + test
make format             # Auto-format code
```

### Docker
```bash
make docker-up          # Start containers
make docker-down        # Stop containers
make docker-logs        # View logs
make docker-ps          # Show status
```

### Database
```bash
make db-studio          # Open visual editor
make migrate            # Run migrations
make seed               # Add sample data
make backup             # Create backup
```

### Testing & Quality
```bash
make lint               # ESLint check
make type-check         # TypeScript check
make test               # Run tests
make test-watch         # Watch mode
```

---

## 🔗 URLs

| Address | Service | Port |
|---------|---------|------|
| http://localhost:5173 | Frontend (Vite dev) | 5173 |
| http://localhost:3000 | Backend API | 3000 |
| http://localhost:5432 | PostgreSQL (Docker) | 5432 |

**Quick test**:
```bash
# API health check
curl http://localhost:3000/health

# Frontend
open http://localhost:5173

# Database
make db-studio
```

---

## 📚 Documentation

```
DOCUMENTATION.md      ← Start here for doc index
README.md            ← Full project guide (700+ lines)
QUICKSTART.md        ← 5-minute setup
ONBOARDING.md        ← Developer onboarding
CONTRIBUTING.md      ← Code standards & workflow
TROUBLESHOOTING.md   ← Fix issues (1000+ lines)
DEPLOYMENT.md        ← Deploy to production
DEPLOYMENT_CHECKLIST.md ← Pre-deploy verification
GITHUB_SETUP.md      ← GitHub & CI/CD setup
```

**Quick lookup**: `grep -r "your issue" TROUBLESHOOTING.md`

---

## 💻 File Structure

```
apps/web/src/
├── pages/              Login, Dashboard, Jobs...
├── components/         Reusable UI components
├── hooks/             useAuth, useJobs...
└── lib/api.ts         API client

apps/api/src/
├── routes/            API endpoints
├── services/          Business logic
└── index.ts           Server entry

prisma/
└── schema.prisma      Database schema
```

---

## 🔐 Authentication Flow

```
User Login Page
     ↓
POST /api/auth/login
     ↓
Backend validates → JWT token
     ↓
Frontend stores token → localStorage
     ↓
Protected routes check auth
     ↓
API calls include token in header
```

**Test**: Create account → Auto-login → See dashboard

---

## 🐛 Debugging

### Browser Issues
```bash
# 1. Open F12 (Developer Tools)
# 2. Console tab - see JavaScript errors
# 3. Network tab - see API calls
# 4. Application tab - see localStorage/cookies
```

### Backend Issues
```bash
# View logs
make logs-api

# Test endpoint
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}'
```

### Database Issues
```bash
# Visual explorer
make db-studio

# Direct connection
docker-compose exec db psql -U postgres -d vealbiz_db
# Then: SELECT * FROM "User";
```

---

## 📤 Committing Code

```bash
# Create branch
git checkout -b feature/my-feature

# Make changes
# ... edit files ...

# Check quality
make check

# Commit
git add .
git commit -m "feat: clear description of change"

# Push
git push origin feature/my-feature

# Create PR on GitHub
```

---

## 🚀 Deployment

### Local Test
```bash
make deploy-local
# http://localhost
```

### Production (Railway - Recommended)
```bash
# See DEPLOYMENT.md for setup
# Then: git push to trigger auto-deploy
```

### Pre-Deployment Check
```bash
make check              # Tests pass?
make build-all          # Builds succeed?

# Follow: DEPLOYMENT_CHECKLIST.md
```

---

## 🔧 Environment Variables

### Development (.env)
```
VITE_API_URL=http://localhost:3000/api
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
```

### Production (.env.production)
```
# See .env.production file (40+ variables)
# Update with production values before deploy
```

---

## 🆘 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| App won't start | `make docker-down && make docker-up` |
| Port in use | `lsof -i :5173` then kill PID |
| Database error | `make db-studio` to check schema |
| Login not working | `make logs-api` to see errors |
| Blank page | Check browser console (F12) |
| TypeScript error | `make type-check` to see all errors |

**More help**: See [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## 👥 Team Communication

```
Issue/Bug?       → Create GitHub Issue
Feature idea?    → Create GitHub Discussion
Questions?       → GitHub Discussions or team chat
Emergency?       → Contact project lead
Documentation?   → See CONTRIBUTING.md
```

---

## 📋 Pre-Commit Checklist

- [ ] Code compiles (`make type-check`)
- [ ] No linting errors (`make lint`)
- [ ] Tests pass (`make test`)
- [ ] Formatted code (`make format`)
- [ ] Meaningful commit message
- [ ] No debug console.log()
- [ ] Related issue mentioned

**Shortcut**: `make check`

---

## 🎯 Common Tasks

### Add a new page
```bash
# 1. Create: apps/web/src/pages/NewPage.tsx
# 2. Export: export const NewPage = () => {...}
# 3. Add route in App.tsx
# 4. Test: http://localhost:5173/newpage
```

### Add API endpoint
```bash
# 1. Create in: apps/api/src/routes/
# 2. Define interface for request/response
# 3. Handle errors with try/catch
# 4. Test with curl
```

### Update database schema
```bash
# 1. Edit: prisma/schema.prisma
# 2. Migrate: npx prisma migrate dev --name description
# 3. Deploy: make migrate
```

---

## 🔄 Development Cycle

```
1. Create branch: git checkout -b feature/...
2. Make changes: Edit files, save
3. Hot reload: See changes instantly
4. Check quality: make check
5. Commit: git add . && git commit -m "..."
6. Push: git push origin feature/...
7. Create PR: GitHub UI
8. Review & merge: Team review → Merge
9. Deploy: Automatic (GitHub Actions)
```

---

## 📱 Useful Keyboard Shortcuts

### VS Code
- `Ctrl+Shift+P` - Command palette
- `Ctrl+F` - Find in file
- `Ctrl+H` - Find & replace
- `Ctrl+Shift+Delete` - Clear console
- `Ctrl+Shift+X` - Extensions

### Browser Dev Tools (F12)
- `Ctrl+Shift+C` - Inspect element
- `Ctrl+Shift+K` - Open console
- `Ctrl+Shift+I` - Toggle dev tools
- `F5` - Refresh page
- `Ctrl+Shift+Delete` - Clear cache

### Git
- `git status` - See changes
- `git diff` - See what changed
- `git log --oneline` - See history
- `git stash` - Save work temporarily

---

## 🚨 Emergency Recovery

```bash
# Lost changes? Restore from git
git restore filename.tsx

# Need fresh start?
make docker-down
docker-compose down -v
make docker-up
make migrate

# Database corrupted?
cat backups/backup_XXXXX.sql | docker-compose exec -T db psql -U postgres

# Stuck deployment?
make docker-down
git reset --hard HEAD~1
git push --force-with-lease
```

---

## 📊 Quick Stats

| Metric | Value |
|--------|-------|
| Frontend Components | 20+ |
| Backend Routes | 3+ |
| Database Tables | 4 |
| Documentation Lines | 4100+ |
| Common Commands | 50+ |
| Supported Deployments | 5 |
| Setup Time | 5 min |
| First Deploy Time | 10 min |

---

## ✨ Pro Tips

1. **Auto-format on save** - Set up Prettier/ESLint in IDE
2. **Use Makefile** - `make help` shows all commands
3. **Keep branches small** - Easier to review and merge
4. **Commit often** - Better history, easier to debug
5. **Test before push** - Run `make check` always
6. **Read error messages** - They usually tell you what's wrong
7. **Check docs first** - 4100+ lines of help available
8. **Ask questions** - Better than guessing wrong

---

## 🎓 Learning Resources

- **React**: https://react.dev
- **Fastify**: https://www.fastify.io/docs/
- **Prisma**: https://www.prisma.io/docs/
- **TypeScript**: https://www.typescriptlang.org/docs/

---

## 🎉 You're Ready!

1. ✅ Everything is set up
2. ✅ Documentation is complete
3. ✅ Commands are available
4. ✅ Deployment is ready

**Next Steps**:
1. Run: `make docker-up && make migrate`
2. Create test account at http://localhost:5173
3. Start developing features!

---

**Last Updated**: 2026-02-20  
**Keep this handy while working!**

💪 Happy coding!

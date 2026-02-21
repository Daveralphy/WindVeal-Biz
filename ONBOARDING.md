# VealBiz Developer Onboarding Guide

Welcome to VealBiz! 👋 This guide will get you up and running in 30 minutes.

## ⏱️ 30-Minute Setup

### 1. Prerequisites (5 min)
```bash
# Verify you have these installed:
node --version          # Should be v20+ (check nodejs.org)
npm --version           # Should be v10+
docker --version        # Optional but recommended
git --version           # Should be v2.30+

# If missing, install from:
# Node.js: https://nodejs.org/ (LTS version)
# Docker: https://www.docker.com/products/docker-desktop/
# Git: https://git-scm.com/
```

### 2. Clone Repository (2 min)
```bash
# Clone the repository
git clone https://github.com/yourusername/vealbiz.git
cd vealbiz

# View branches
git branch -a

# Checkout develop to get latest dev version
git checkout develop
```

### 3. Environment Setup (3 min)
```bash
# Copy environment template
cp .env.local .env

# View what variables are available
cat .env

# No edits needed - defaults work for local development!
```

### 4. Install & Run (15 min)
```bash
# Option A: Using Docker (Recommended)
make docker-up

# Wait for containers to start... (~30 seconds)
# Then migrate database:
make migrate

# Your app is ready!
# Open: http://localhost:5173 (frontend)
#       http://localhost:3000/api/health (API)

# Option B: Without Docker (Manual)
npm install
npm run dev

# Then in another terminal:
npx prisma migrate deploy
```

### 5. Verify Everything Works (5 min)
```bash
# Check all services are running
make health

# Expected output:
# API Health: { "status": "ok" }
# Web Status: 200 OK
# Docker Services: all healthy

# If any service is down, see TROUBLESHOOTING.md
```

---

## 📚 Understanding the Codebase

### Project Structure at a Glance
```
VealBiz/
├── apps/web/                    # Frontend React app
│   ├── src/pages/              # Page components
│   ├── src/components/         # Reusable components
│   ├── src/hooks/              # Custom React hooks
│   └── src/lib/api.ts          # API client
│
├── apps/api/                    # Backend Node.js/Fastify
│   ├── src/routes/auth.ts      # Auth endpoints
│   ├── src/services/           # Business logic
│   └── src/index.ts            # Server entry
│
├── prisma/
│   └── schema.prisma           # Database schema
│
└── docker-compose.yml          # Local development

→ See README.md for detailed architecture
```

### Key Technologies
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Fastify, Node.js, TypeScript
- **Database**: PostgreSQL, Prisma ORM
- **Deployment**: Docker, Railway

### Data Flow
```
User Types Credentials
         ↓
   React Form
         ↓
   API Client (api.ts)
    [POST to /api/auth/login]
         ↓
   Fastify Backend (routes/auth.ts)
         ↓
   Database Check (Prisma)
         ↓
   JWT Token Generated
         ↓
   Store in Browser localStorage
         ↓
   Protected Routes Load with Auth
```

---

## 🛠️ Common Development Tasks

### Making Code Changes

#### 1. Frontend Changes
```bash
# Files are auto-reloaded (Vite hot reload)
# Edit apps/web/src/pages/Dashboard.tsx

# Changes appear instantly at http://localhost:5173
# No restart needed!
```

#### 2. Backend Changes
```bash
# Restart API to load changes
docker-compose restart api

# Or view logs to see hot-reload working
make logs-api
```

#### 3. Database Schema Changes
```bash
# Edit prisma/schema.prisma
# E.g., add new field to User model

# Create migration
npx prisma migrate dev --name add_new_field

# Follow prompts to name the migration
# Database automatically updated!
```

### Testing Your Changes

```bash
# Check code quality
make lint              # ESLint
make type-check        # TypeScript types
make format            # Auto-format code

# All together
make check             # Runs lint + type-check + tests
```

### Before Committing

```bash
# Stage your changes
git add .

# Create descriptive commit
git commit -m "Add user profile page"

# Check what will be pushed
git log --oneline -5

# Push to your branch
git push origin my-feature
```

---

## 🌳 Git Workflow

### Branch Naming Convention
```
feature/user-profile           # New feature
bugfix/login-error             # Bug fix
docs/update-readme             # Documentation
chore/upgrade-dependencies     # Maintenance
test/database-performance      # Testing
```

### Create Feature Branch
```bash
# Start from latest develop
git checkout develop
git pull

# Create your branch
git checkout -b feature/my-feature

# Make changes
# ... edit files ...

# Commit regularly
git add .
git commit -m "Clear, descriptive message"

# Push to GitHub
git push origin feature/my-feature
```

### Create Pull Request
```
1. Go to GitHub.com/yourusername/vealbiz
2. Click "Pull requests" tab
3. Click "New pull request"
4. Base: "develop", Compare: "my-feature"
5. Fill title and description
6. Click "Create pull request"

GitHub Actions will automatically:
✅ Run tests
✅ Check code quality
✅ Build Docker images
✅ Show results

Iterate until all checks pass!
```

### Merge to Main
```
1. Create PR from develop → main
2. Wait for all checks to pass
3. Team reviews and approves  
4. Click "Merge pull request"

GitHub Actions deploys to production automatically!
```

---

## 🐛 Debugging Guide

### See What's Running
```bash
# All services
docker-compose ps

# Check specific service
docker-compose ps api

# View logs
make logs-api           # API logs
make logs-web           # Web logs
make logs-db            # Database logs
```

### Debug Frontend Issues
```bash
# Browser Developer Tools (F12)
1. Open http://localhost:5173
2. Press F12
3. Console tab shows errors
4. Network tab shows API calls
5. React DevTools extension for component debugging
```

### Debug Backend Issues
```bash
# View API logs in real-time
make logs-api

# Test API endpoint with curl
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}'

# Expected response: 200 with token (or 401 auth error)

# Visual database explorer
make db-studio
```

### Database Debugging
```bash
# Open database in visual editor
make db-studio

# Or connect directly
docker-compose exec db psql -U postgres -d vealbiz_db

# Inside psql:
\dt                 # Show tables
\d "User"           # Show User table schema
SELECT * FROM "User" LIMIT 5;  # See data
\q                  # Quit
```

---

## 📋 Code Style & Standards

### TypeScript
```typescript
// ✅ Good - Proper types, clear naming
interface User {
  id: string;
  email: string;
  firstName: string | null;
}

export function getUserById(userId: string): Promise<User | null> {
  // Implementation
}

// ❌ Avoid - No types, unclear naming
function getU(u) {
  // Implementation
}
```

### React Components
```typescript
// ✅ Good - Functional component with types
interface DashboardProps {
  userId: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ userId }) => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  return <div>{/* JSX */}</div>;
};

// ❌ Avoid - Class component, no types
export class Dashboard extends React.Component {
  render() {
    // Implementation
  }
}
```

### File Organization
```
apps/web/src/
├── pages/          # Full-page components (Dashboard, Jobs, etc)
├── components/     # Reusable UI components (Button, Card, etc)
├── hooks/          # Custom React hooks (useAuth, useJobs, etc)
├── lib/            # Utilities (api.ts, validation.ts, etc)
└── types.ts        # Global TypeScript types
```

---

## 🚀 Making Your First Contribution

### Example: Add a New Page

**Step 1: Create page component**
```bash
touch apps/web/src/pages/Settings.tsx
```

**Step 2: Add component code**
```typescript
// apps/web/src/pages/Settings.tsx
import { Layout } from '../components/layout/Layout';

export const Settings = () => {
  return (
    <Layout>
      <div className="p-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        {/* Your content here */}
      </div>
    </Layout>
  );
};
```

**Step 3: Add route**
```typescript
// apps/web/src/App.tsx - Add to routes:
import { Settings } from './pages/Settings';

// Inside BrowserRouter:
{
  path: '/settings',
  element: <Settings />,
}
```

**Step 4: Add navigation link**
```typescript
// apps/web/src/components/layout/Sidebar.tsx
// Add to NAVIGATION:
{
  href: '/settings',
  icon: Settings,
  label: 'Settings',
}
```

**Step 5: Test**
```bash
# No restart needed - Vite hot reload
# Visit http://localhost:5173/settings
```

**Step 6: Commit**
```bash
git add .
git commit -m "Add settings page"
git push origin feature/settings-page
```

**Step 7: Create PR**
```
On GitHub: Create PR → wait for checks → merge!
```

---

## 🤝 Collaboration Tips

### Code Review Best Practices
```
✅ DO:
- Ask questions if code is unclear
- Suggest improvements kindly
- Test the changes locally
- Praise good solutions
- Reference related issues

❌ DON'T:
- Comment on style issues (use eslint instead)
- Be dismissive
- Approve without testing
- Pick fights
```

### Asking for Help
```
Good question:
"I'm trying to add user profile editing. 
Where should I add the API endpoint?
See my PR: [link]"

Vague question:
"Why isn't this working?"
```

### Sharing Knowledge
```
✅ Document as you learn:
- Add comments for complex logic
- Update README if structure changes
- Create decision documents for architecture changes
- Share tips in team chat
```

---

## 📚 Learning Resources

### For Specific Errors
1. Read error message carefully
2. Search error in TROUBLESHOOTING.md
3. Check docs: React, Fastify, Prisma, PostgreSQL
4. Ask in team chat with error message + what you tried

### Documentation to Review
- **README.md**: Project overview & features
- **QUICKSTART.md**: 30-minute setup (this file)
- **TROUBLESHOOTING.md**: Common issues & solutions
- **DEPLOYMENT.md**: Deployment options
- **CODE_STYLE.md**: (if exists) Code conventions

### External Resources
- React: https://react.dev
- Fastify: https://www.fastify.io/docs/latest/
- Prisma: https://www.prisma.io/docs/
- PostgreSQL: https://www.postgresql.org/docs/
- TypeScript: https://www.typescriptlang.org/docs/

---

## 🎯 Your First Week Checklist

### Day 1
- [ ] Clone repository
- [ ] Run `make docker-up`
- [ ] Verify everything works (`make health`)
- [ ] Read README.md

### Day 2
- [ ] Explore codebase structure
- [ ] Open Prisma Studio (`make db-studio`)
- [ ] View database schema
- [ ] Test login page manually

### Day 3
- [ ] Make small code change (e.g., update text on page)
- [ ] See hot-reload work
- [ ] Run `make check` - verify no errors
- [ ] Commit and push

### Day 4
- [ ] Create first feature branch
- [ ] Make more substantial change
- [ ] Create pull request
- [ ] Get feedback

### Day 5
- [ ] Deploy to development environment
- [ ] Verify changes on dev site
- [ ] Answer questions about your PR
- [ ] Merge when approved!

---

## 🚨 When Things Go Wrong

### "I broke the database"
```bash
# No problem! Reset everything:
make docker-down
docker-compose down -v  # Remove database
make docker-up
make migrate            # Start fresh
```

### "I committed something I shouldn't have"
```bash
# Undo last commit (still have your changes)
git reset --soft HEAD~1

# Undo with file changes lost (be careful!)
git reset --hard HEAD~1

# Remove from history
git push --force-with-lease origin my-branch
```

### "My branch is out of sync"
```bash
# Update from develop
git fetch origin
git merge origin/develop

# Or rebase (cleaner history)
git rebase origin/develop
```

### "API won't respond"
```bash
# Restart API
docker-compose restart api

# View logs
make logs-api

# If still broken, see TROUBLESHOOTING.md → Backend Issues
```

---

## 🎓 Next Steps

After your first week:
1. ✅ Explore each major feature (Auth, Jobs, Candidates)
2. ✅ Understand database relationships (view in Prisma Studio)
3. ✅ Learn deployment process (see DEPLOYMENT.md)
4. ✅ Setup IDE shortcuts (ESLint, Prettier, TypeScript)
5. ✅ Read contributing guidelines (if exists: CONTRIBUTING.md)

---

## ❓ FAQ

**Q: What if I want to work offline?**
A: You can! Your Git history and local database work offline. Just `docker-compose up` first to populate your local database.

**Q: How do I add new dependencies?**
A: `npm install package-name` for frontend, or `cd apps/api && npm install package-name` for backend. But discuss major dependencies in team first.

**Q: Can I test without Docker?**
A: Yes! You'll need PostgreSQL and Node.js v20 installed locally. See DEPLOYMENT.md "Manual Setup" section.

**Q: How do I reach the team?**
A: Via [Team Communication Channel] or create an Issue on GitHub with the question tag.

**Q: What if I find a bug?**
A: Create an Issue on GitHub with: what you did, what happened, what you expected, screenshots if possible.

**Q: How do I deploy my changes?**
A: Push to `develop` for testing, create PR to `main` for production. This happens automatically!

---

## 🎉 Welcome Aboard!

You're now part of the VealBiz team. Start with small changes, ask questions, and learn from the codebase. The team is here to help!

**Quick Links:**
- 📝 Questions? GitHub Discussions
- 🐛 Found a bug? Create GitHub Issue
- 💬 Need help? Reach out to team lead
- 📚 More info? See documentation files

---

**Last Updated**: 2026-02-20  
**Maintained By**: Development Team  
**Version**: 1.0

💪 Happy coding!

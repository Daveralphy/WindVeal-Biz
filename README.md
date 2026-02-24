# VealBiz - AI-Powered Recruitment ATS

> Smart hiring for Nigerian businesses. AI-powered applicant tracking system that parses resumes, ranks candidates, and streamlines your recruitment process.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequests.com)

---

## 🚀 Features

- **AI Resume Parsing** - Automatically extract candidate information from PDFs and DOCX files
- **Smart Candidate Ranking** - AI scores candidates against job requirements
- **AI Chat Assistant** - Built-in AI-powered chat for recruitment insights
- **AI Dashboard Insights** - Intelligent summaries of hiring activity and trends
- **Visual Pipeline** - Drag-and-drop candidates through customizable hiring stages
- **Interview Scheduling** - Schedule and track interviews with scorecards
- **Career Portal** - Public-facing career page for organizations
- **Analytics Dashboard** - Track hiring metrics and team performance
- **Team Collaboration** - Invite team members, assign roles, and collaborate on hiring
- **Communications Hub** - Centralized email and messaging for candidates
- **Multi-tenant SaaS** - Each company gets isolated, secure workspace
- **Role-based Access** - Admin, Recruiter, Hiring Manager, Interviewer, and Viewer roles
- **Super Admin Panel** - Platform-wide management for organizations, users, AI usage, and analytics
- **Freemium Model** - Starter, Professional, and Enterprise tiers with Naira pricing
- **Dark Mode** - Full light/dark/system theme support
- **Mobile Guard** - Desktop-required notice for optimal experience
- **Nigerian-focused** - Built with African business realities in mind

---

## 💡 How VealBiz Works (Simple Explanation)

### **The Problem It Solves**
You post a job → Get 50 resumes → Manually read each one (painful!) → Forget which candidates were good → Lose track in Excel

### **The VealBiz Solution**

```
Step 1: Recruiter logs into VealBiz
        ↓
Step 2: Creates job: "Frontend Developer needed"
        ↓
Step 3: Uploads candidate resumes (PDF/DOCX)
        ↓
Step 4: AI automatically:
        • Reads the resume
        • Extracts: name, email, skills, experience
        • Scores candidate: 95% match!
        • Writes summary: "Excellent React developer with 5 years experience"
        ↓
Step 5: Recruiter sees dashboard:
        Applied (8) → Screening (4) → Interview (2) → Offer (1)
        ⭐ Sarah - 98%
        ⭐ John - 95%
        ⭐ Jane - 87%
        ↓
Step 6: Drag candidates between stages
        Add notes, schedule interviews, track progress
        ↓
Step 7: Make hiring decisions faster and smarter!
```

---

## 🧩 The 5 Components (Technical Overview)

VealBiz is built from 5 main pieces that work together:

| Component | What It Does | Technology | Where It Lives |
|-----------|-------------|------------|----------------|
| **Frontend** | Website you see & click | React + TypeScript | `apps/web/` |
| **Backend** | Brain that processes everything | Node.js + Fastify | `apps/api/` |
| **Database** | Stores all data permanently | PostgreSQL | Docker container |
| **AI Service** | Reads & scores resumes, chat | Groq API (cloud) | https://groq.com |
| **File Storage** | Saves resume PDFs | Local folder | `apps/api/uploads/` |

### **How They Talk to Each Other**

```
┌──────────────┐
│   FRONTEND   │  "Hey backend, upload this resume!"
│   (React)    │ ────────────────────────────────────┐
└──────────────┘                                     │
                                                     ▼
                                            ┌──────────────┐
                                            │   BACKEND    │
                                            │  (Fastify)   │
                                            └──────────────┘
                                                     │
                        ┌────────────────────────────┼────────────────┐
                        │                            │                │
                        ▼                            ▼                ▼
                 ┌─────────────┐            ┌─────────────┐   ┌────────────┐
                 │  DATABASE   │            │  AI SERVICE │   │   FILES    │
                 │ (PostgreSQL)│            │   (Groq)    │   │  (uploads/)│
                 └─────────────┘            └─────────────┘   └────────────┘
                  Saves candidate             Analyzes          Stores PDFs
                  data & scores               resume text
```

---

## 📋 Tech Stack

### Frontend
- **React 18** + TypeScript 5.7
- **Vite 6** - Lightning fast build tool
- **Tailwind CSS 3.4** - Utility-first styling
- **Radix UI** - Accessible, unstyled component primitives
- **Lucide React** - Beautiful icon library
- **Zustand 5** - Lightweight state management
- **React Hook Form** + **Zod** - Form handling and validation
- **Axios** - HTTP client
- **class-variance-authority** + **clsx** + **tailwind-merge** - Styling utilities
- **React Router DOM 7** - Client-side routing

### Backend
- **Node.js 18+** + TypeScript 5.7
- **Fastify 5** - High-performance web framework
- **Prisma 6** - Type-safe database ORM
- **PostgreSQL 16** - Primary database
- **JWT** + **bcrypt** - Authentication & password hashing
- **Groq SDK** - AI-powered resume parsing, ranking, and chat
- **pdf-parse** - PDF text extraction
- **Zod** - Input validation
- **@fastify/multipart** - File upload handling
- **@fastify/cookie** - Cookie management
- **@fastify/cors** - Cross-origin support

### Development Tools
- **Docker Compose** - PostgreSQL 16 + Redis 7 containers
- **concurrently** - Parallel dev server execution
- **tsx** - TypeScript execution for backend dev

---

## 🏗️ What's Inside This Project

VealBiz has **5 main components** working together:

### **1. Frontend (The Website) - `apps/web/`**
What users see and click on. Built with React.

```
apps/web/src/
├── pages/                     # Application screens
│   ├── Login.tsx              # Login page
│   ├── Register.tsx           # Registration page
│   ├── Dashboard.tsx          # Main dashboard with AI insights
│   ├── Jobs.tsx               # Job listing & management
│   ├── Applicants.tsx         # Applicant management
│   ├── Pipeline.tsx           # Visual candidate pipeline
│   ├── Interviews.tsx         # Interview scheduling
│   ├── Communications.tsx     # Email & messaging hub
│   ├── Careers.tsx            # Public career page management
│   ├── Analytics.tsx          # Hiring analytics dashboard
│   ├── Team.tsx               # Team management & invitations
│   ├── Settings.tsx           # User settings (profile, theme, security)
│   └── admin/                 # Super admin pages
│       ├── AdminDashboard.tsx
│       ├── AdminOrganizations.tsx
│       ├── AdminUsers.tsx
│       ├── AdminAIUsage.tsx
│       ├── AdminAnalytics.tsx
│       └── AdminSettings.tsx
│
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx      # User sidebar layout with profile popover
│   │   ├── AdminLayout.tsx    # Admin sidebar layout
│   │   └── MobileGuard.tsx    # Desktop-required screen for mobile
│   ├── auth/
│   │   └── AuthLayout.tsx     # Auth page wrapper
│   └── ai/
│       └── VealAIChat.tsx     # AI chat assistant component
│
├── contexts/
│   └── ThemeContext.tsx        # Light/dark/system theme provider
│
├── hooks/
│   └── useAdminMetadata.ts    # Admin metadata hook
│
├── lib/
│   ├── api.ts                 # Axios instance & API client
│   └── utils.ts               # Utility functions
│
├── App.tsx                    # Route definitions & auth guards
├── main.tsx                   # Entry point
└── index.css                  # Tailwind CSS base styles
```

---

### **2. Backend (The Brain) - `apps/api/`**
The server that processes everything. Built with Fastify.

```
apps/api/
├── src/
│   ├── index.ts               # Server entry point & route registration
│   │
│   ├── routes/                # API endpoints
│   │   ├── auth.ts            # /api/auth - register, login, logout, refresh, change-password
│   │   ├── jobs.ts            # /api/jobs - CRUD for job postings
│   │   ├── applicants.ts      # /api/applicants - applicant management & resume upload
│   │   ├── dashboard.ts       # /api/dashboard - dashboard stats
│   │   ├── interviews.ts      # /api/interviews - interview scheduling
│   │   ├── team.ts            # /api/team - team member management
│   │   ├── notifications.ts   # /api/notifications - user notifications
│   │   ├── analytics.ts       # /api/analytics - hiring analytics data
│   │   ├── communications.ts  # /api/communications - email & messaging
│   │   ├── careers.ts         # /api/careers - public career portal
│   │   ├── ai.ts              # /api/ai - AI insights generation
│   │   ├── chat.ts            # /api/chat - AI chat conversations
│   │   └── admin.ts           # /api/admin - super admin platform management
│   │
│   ├── services/
│   │   └── groqService.ts     # Groq AI integration (parsing, ranking, chat)
│   │
│   ├── middleware/
│   │   ├── auth.ts            # JWT authentication middleware
│   │   └── superAdmin.ts      # Super admin authorization check
│   │
│   ├── config/
│   │   ├── env.ts             # Environment variable validation
│   │   └── seedData.ts        # Seed data configuration
│   │
│   └── lib/
│       ├── prisma.ts          # Prisma client instance
│       └── validation.ts      # Shared validation schemas
│
├── prisma/
│   ├── schema.prisma          # Database schema (all models & enums)
│   └── seed.ts                # Database seeder (plans, admin, platform org)
│
└── uploads/                   # Resume file storage
```

---

### **3. Database (The Memory) - PostgreSQL**
Where all data is stored permanently. Runs in Docker.

**Core Tables:**
| Table | Purpose |
|-------|---------|
| `subscription_plans` | Starter, Professional, Enterprise tiers |
| `organizations` | Companies using VealBiz |
| `users` | Team members with roles |
| `jobs` | Job postings with status & requirements |
| `job_assignments` | User-to-job assignments |
| `pipeline_stages` | Custom pipeline stages per job |
| `applicants` | Candidates with source tracking |
| `application_data` | Custom application form responses |
| `uploaded_files` | Resume PDFs and documents |
| `stage_history` | Candidate stage movement log |
| `ai_reports` | AI scoring results & recommendations |
| `interviews` | Scheduled interviews |
| `scorecards` | Interview evaluation scorecards |
| `applicant_notes` | Recruiter notes on candidates |
| `email_templates` | Reusable email templates |
| `email_logs` | Sent email tracking |
| `offers` | Job offer management |
| `notifications` | User notification system |
| `team_invitations` | Team member invitations |
| `audit_logs` | Activity audit trail |
| `ai_usage_logs` | AI feature usage tracking |
| `refresh_tokens` | JWT refresh token storage |
| `password_reset_tokens` | Password reset flow |

**Accessed through:** Prisma ORM (type-safe queries with auto-generated client)

---

### **4. AI Service (The Smart Reader) - Groq API**
Cloud service that reads and analyzes resumes. You don't download this - you call it via internet.

**What it does:**
```
Input:  "John Smith, 5 years React experience..."
Output: { score: 95, summary: "Excellent match", skills: [...] }
```

**Where it lives:** https://api.groq.com (cloud service)
**Cost:** Free tier (14,400 requests/day)

---

### **5. Configuration Files (The Instructions)**

```
vealbiz/
├── package.json            # Root: workspaces, scripts, dev tools
├── docker-compose.yml      # PostgreSQL 16 + Redis 7 containers
├── tsconfig.json           # Root TypeScript config
├── tailwind.config.js      # Tailwind CSS configuration
├── postcss.config.js       # PostCSS configuration
├── vite.config.ts          # Vite build & dev server config
├── nginx.conf              # Nginx config (development)
├── nginx.prod.conf         # Nginx config (production)
├── docker-compose.prod.yml # Production Docker setup
├── Makefile                # Build automation commands
└── README.md               # This file
```

---

## 📁 Complete Folder Structure

```
vealbiz/
│
├── apps/
│   ├── web/                       ← FRONTEND (React + Vite)
│   │   ├── src/
│   │   │   ├── pages/             ← 12 user pages + 6 admin pages
│   │   │   ├── components/        ← Layout, auth, AI components
│   │   │   ├── contexts/          ← Theme context (light/dark/system)
│   │   │   ├── hooks/             ← Custom hooks (admin metadata)
│   │   │   ├── lib/               ← API client, utilities
│   │   │   ├── App.tsx            ← Routes & auth guards
│   │   │   └── main.tsx           ← Entry point
│   │   ├── public/                ← Static assets
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── api/                       ← BACKEND (Fastify + Prisma)
│       ├── src/
│       │   ├── routes/            ← 13 route modules
│       │   ├── services/          ← Groq AI service
│       │   ├── middleware/        ← Auth & super admin guards
│       │   ├── config/            ← Env validation, seed data
│       │   ├── lib/               ← Prisma client, validation
│       │   └── index.ts           ← Server entry point
│       ├── prisma/
│       │   ├── schema.prisma      ← 23 database models
│       │   └── seed.ts            ← Database seeder
│       └── uploads/               ← Resume file storage
│
├── packages/
│   └── shared/                    ← Shared TypeScript types
│       └── src/types.ts
│
├── package.json                   ← Root workspaces config
├── docker-compose.yml             ← Dev database containers
└── README.md                      ← This file
```

---

## 🚦 Getting Started

### What You Need First

- **Node.js** 18 or newer ([Download here](https://nodejs.org))
- **Docker Desktop** ([Download here](https://www.docker.com/products/docker-desktop)) - For running PostgreSQL
- **Code Editor** - VS Code recommended ([Download here](https://code.visualstudio.com/))
- **Groq API Key** (optional) - Free account at [console.groq.com](https://console.groq.com)

### Installation (Step by Step)

**1. Download the code**

```bash
git clone https://github.com/windveal/vealbiz.git
cd vealbiz
```

**2. Install all dependencies**

This downloads all the tools and libraries needed (React, Fastify, Prisma, etc.)

```bash
npm install
```

This might take 2-3 minutes. You'll see a progress bar.

**3. Get your Groq API key (optional - for AI features)**

- Go to https://console.groq.com
- Sign up (it's free)
- Click "Create API Key"
- Copy the key (looks like: `gsk_xxxxxxxxxxxxx`)

**4. Set up your configuration files**

Create two `.env` files with your secrets:

**File 1: `apps/api/.env`** (Backend secrets)
```env
# Database connection
DATABASE_URL="postgresql://vealbiz_user:vealbiz_password@localhost:5432/vealbiz"

# Security keys (change these!)
JWT_SECRET="your-random-secret-here-make-it-long"
REFRESH_TOKEN_SECRET="another-random-secret"

# Groq AI API key (optional - paste your key here for AI features)
GROQ_API_KEY="gsk_your_key_from_groq_console"

# Super admin password (optional - set for initial super admin account)
SUPER_ADMIN_PASSWORD="SuperAdmin123!"

# Server settings
PORT=8000
NODE_ENV="development"
CORS_ORIGIN="http://localhost:5173"

# File upload settings
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE=5242880
```

**File 2: `apps/web/.env`** (Frontend config)
```env
VITE_API_URL="http://localhost:8000/api"
```

**5. Start the database**

This starts PostgreSQL in a Docker container (like a mini virtual machine)

```bash
docker-compose up -d
```

You should see:
```
✔ Container vealbiz-postgres  Started
✔ Container vealbiz-redis     Started
```

**6. Set up database tables**

This creates all the tables and seeds initial data (subscription plans + super admin account).

```bash
cd apps/api
npx prisma db push
npx prisma generate
npx prisma db seed
cd ../..
```

**7. Start the app!**

```bash
npm run dev
```

You should see:
```
🚀 Server running on http://localhost:8000
🌐 Frontend running on http://localhost:5173
```

**8. Open your browser**

Go to: http://localhost:5173

You should see the VealBiz login page! 🎉

**Default Super Admin Login:**
- Email: `admin@vealbiz.com`
- Password: `SuperAdmin123!`

---

### Troubleshooting

**"Cannot connect to database"**
- Make sure Docker is running
- Run `docker-compose ps` to check if PostgreSQL is up

**"GROQ_API_KEY is not defined"**
- AI features are optional. The app works without it.
- To enable AI, create a free key at https://console.groq.com

**"Port 5173 already in use"**
- Another app is using that port
- Kill it: `npx kill-port 5173` or restart your terminal

**"npm install" fails**
- Make sure you have Node.js 18 or newer
- Check: `node --version`

---

## 🗄️ Database Setup

### Using Docker (Recommended for Development)

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379

### Using Local PostgreSQL

1. Install PostgreSQL
2. Create database:

```sql
CREATE DATABASE vealbiz;
CREATE USER vealbiz_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE vealbiz TO vealbiz_user;
```

3. Update `DATABASE_URL` in `apps/api/.env`

### Push Schema & Seed

```bash
cd apps/api
npx prisma db push
npx prisma db seed
```

### Prisma Studio (Database GUI)

```bash
cd apps/api
npx prisma studio
```

Opens at http://localhost:5555

---

## 🔑 API Keys Setup

### Groq API (Optional - for AI features)

1. Go to https://console.groq.com
2. Sign up for free account
3. Create API key
4. Add to `apps/api/.env`:
   ```
   GROQ_API_KEY="gsk_xxxxxxxxxxxxx"
   ```

### Free Tier Limits
- 14,400 requests per day
- 6,000 requests per minute
- Sufficient for development and small teams

---

## 📦 Building for Production

### Build All Apps

```bash
npm run build
```

### Build Individually

```bash
# Frontend
npm run build:web

# Backend
npm run build:api
```

---

## 📚 API Documentation

### Route Prefixes

| Prefix | Description |
|--------|-------------|
| `/api/auth` | Authentication (register, login, logout, refresh, change-password) |
| `/api/jobs` | Job posting CRUD |
| `/api/applicants` | Applicant management & resume upload |
| `/api/dashboard` | Dashboard statistics |
| `/api/interviews` | Interview scheduling & management |
| `/api/team` | Team member management & invitations |
| `/api/notifications` | User notifications |
| `/api/analytics` | Hiring analytics data |
| `/api/communications` | Email & messaging |
| `/api/careers` | Public career portal |
| `/api/ai` | AI-powered insights |
| `/api/chat` | AI chat conversations |
| `/api/admin` | Super admin platform management |
| `/api/health` | Health check endpoint |

### Authentication

**Register Organization & User**
```bash
POST /api/auth/register
Content-Type: application/json

{
  "organizationName": "Acme Corp",
  "email": "admin@acme.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Login**
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@acme.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGc...",
  "user": {
    "id": "clx...",
    "email": "admin@acme.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "ADMIN",
    "organizationId": "clx..."
  }
}
```

> Refresh token is set as an httpOnly cookie (30-day expiry).

**Change Password**
```bash
PATCH /api/auth/change-password
Authorization: Bearer {token}
Content-Type: application/json

{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass456!"
}
```

### Jobs

**Create Job**
```bash
POST /api/jobs
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Senior Frontend Developer",
  "department": "Engineering",
  "location": "Lagos, Nigeria",
  "type": "FULL_TIME",
  "description": "We are looking for...",
  "requirements": "5+ years React experience..."
}
```

**List Jobs**
```bash
GET /api/jobs
Authorization: Bearer {token}
```

### Applicants

**Upload Resume**
```bash
POST /api/applicants
Authorization: Bearer {token}
Content-Type: multipart/form-data

{
  "resume": (file),
  "jobId": "clx...",
  "email": "candidate@email.com"
}
```

**Get Applicant Details**
```bash
GET /api/applicants/{applicantId}
Authorization: Bearer {token}
```

### AI Endpoints

**Get AI Insights**
```bash
GET /api/ai/insights
Authorization: Bearer {token}
```

**AI Chat**
```bash
POST /api/chat
Authorization: Bearer {token}
Content-Type: application/json

{
  "message": "What are the top candidates for the Frontend Developer role?"
}
```

### Admin Endpoints

**Get Admin Dashboard**
```bash
GET /api/admin/dashboard
Authorization: Bearer {token}  (super admin only)
```

**List All Organizations**
```bash
GET /api/admin/organizations
Authorization: Bearer {token}  (super admin only)
```

---

## 🛠️ Development Guidelines

### Code Style

- **ESLint** for linting
- Run before commit:
  ```bash
  npm run lint
  ```

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add video interview analysis
fix: resolve resume parsing error
docs: update API documentation
style: format code with prettier
refactor: restructure candidate service
chore: update dependencies
```

### Branch Naming

```
feature/resume-parsing
fix/authentication-bug
docs/api-documentation
refactor/database-schema
```

### Pull Request Process

1. Create feature branch from `main`
2. Make changes and commit
3. Update documentation if needed
4. Submit PR with clear description
5. Wait for review and approval

---

## 🗺️ Roadmap

### MVP ✅
- [x] Authentication & Organizations
- [x] Job posting management
- [x] Resume upload & parsing
- [x] AI candidate ranking
- [x] Candidate pipeline
- [x] Dashboard with AI insights
- [x] Dark mode / theme support

### Phase 2 ✅
- [x] Interview scheduling & scorecards
- [x] Career page (public job portal)
- [x] Analytics & reporting dashboard
- [x] Team collaboration & invitations
- [x] Communications hub
- [x] Super admin panel
- [x] Subscription tier management
- [x] AI chat assistant

### Phase 3
- [ ] Email notifications (SMTP integration)
- [ ] Video interview link analysis
- [ ] Advanced search & filtering
- [ ] Mobile-responsive design
- [ ] Integration APIs

### Future
- [ ] Chrome extension for LinkedIn
- [ ] Zapier integration
- [ ] WhatsApp integration
- [ ] Multi-language support (Yoruba, Igbo, Hausa)

---

## 🔐 Security

### Security Features

- Passwords hashed with bcrypt (12 rounds)
- JWT access token + httpOnly refresh cookie authentication
- SQL injection prevention (Prisma ORM)
- XSS protection (React auto-escaping)
- CORS configuration
- File upload validation (type & size limits)
- Role-based access control (5 roles)
- Super admin authorization layer
- Input validation with Zod schemas

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

### Quick Start for Contributors

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 👥 Team

**WindVeal Technologies**
- Website: https://windveal.github.io
- Email: contact@windveal.com
- Phone: +234 703 2580 0065

---

## 🙏 Acknowledgments

- [Groq](https://groq.com) for fast, free AI inference
- [Radix UI](https://www.radix-ui.com) for accessible component primitives
- [Lucide](https://lucide.dev) for beautiful icons
- [Prisma](https://prisma.io) for excellent ORM
- Nigerian tech community for inspiration

---

## 📞 Support

- **Email:** support@windveal.com
- **GitHub Issues:** [Create an issue](https://github.com/windveal/vealbiz/issues)

---

## 📊 Project Status

**Current Version:** 1.0.0
**Last Updated:** June 2025

---

## 🎯 Quick Commands Reference

```bash
# Development
npm run dev              # Start all services (frontend + backend)
npm run dev:web          # Frontend only (port 5173)
npm run dev:api          # Backend only (port 8000)

# Database
npm run db:migrate       # Run Prisma migrations
npm run db:studio        # Open Prisma Studio (port 5555)
npm run db:seed          # Seed database (plans + super admin)
npm run db:reset         # Reset database

# Building
npm run build            # Build all apps
npm run build:web        # Build frontend only
npm run build:api        # Build backend only

# Code Quality
npm run lint             # Lint all code

# Docker
docker-compose up -d     # Start database containers
docker-compose down      # Stop containers
docker-compose logs -f   # View container logs
```

---

## 🌟 Star History

If you find VealBiz useful, please consider giving it a star ⭐

---

**Built with ❤️ in Nigeria by WindVeal Technologies**

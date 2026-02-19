# VealBiz - AI-Powered Recruitment ATS

> Smart hiring for Nigerian businesses. AI-powered applicant tracking system that parses resumes, ranks candidates, and streamlines your recruitment process.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequests.com)

---

## 🚀 Features

- **AI Resume Parsing** - Automatically extract candidate information from PDFs and DOCX files
- **Smart Candidate Ranking** - AI scores candidates against job requirements
- **Visual Pipeline** - Drag-and-drop candidates through hiring stages
- **Multi-tenant SaaS** - Each company gets isolated, secure workspace
- **Role-based Access** - Admin, Recruiter, and Hiring Manager permissions
- **Freemium Model** - Free plan with upgrade options in Naira pricing
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
        Add notes, track progress
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
| **AI Service** | Reads & scores resumes | Groq API (cloud) | https://groq.com |
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
                                            │  (Node.js)   │
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
- **React 18** + TypeScript
- **Vite** - Lightning fast build tool
- **Tailwind CSS** - Utility-first styling
- **Shadcn/ui** - Beautiful, accessible components
- **Zustand** - Lightweight state management
- **React Hook Form** + Zod - Form handling and validation

### Backend
- **Node.js 18+** + TypeScript
- **Fastify** - High-performance web framework
- **Prisma** - Type-safe database ORM
- **PostgreSQL** - Primary database
- **JWT** - Authentication
- **Groq API** - AI-powered resume parsing and ranking

### Infrastructure
- **Vercel** - Frontend hosting
- **Render/Railway** - Backend hosting
- **Neon** - Serverless PostgreSQL
- **Cloudflare R2** - File storage (production)

---

## 🏗️ What's Inside This Project

VealBiz has **5 main components** working together:

### **1. Frontend (The Website) - `apps/web/`**
What users see and click on. Built with React.

```
apps/web/
├── src/
│   ├── pages/              # Different screens
│   │   ├── Login.tsx       # Login page
│   │   ├── Dashboard.tsx   # Main dashboard
│   │   ├── Jobs.tsx        # List of jobs
│   │   └── Candidates.tsx  # Candidate pipeline
│   │
│   ├── components/         # Reusable UI pieces
│   │   ├── JobCard.tsx     # Shows one job
│   │   └── CandidateCard.tsx  # Shows one candidate
│   │
│   └── lib/
│       └── api.ts          # Talks to backend
│
├── package.json            # Frontend dependencies
└── .env                    # Frontend secrets (API URL)
```

**What it does:** Login page → Dashboard → View jobs → Upload resumes → See AI scores

---

### **2. Backend (The Brain) - `apps/api/`**
The server that processes everything. Built with Node.js.

```
apps/api/
├── src/
│   ├── routes/             # API endpoints (URLs)
│   │   ├── auth.ts         # /api/auth/login, /api/auth/register
│   │   ├── jobs.ts         # /api/jobs - create, list jobs
│   │   └── candidates.ts   # /api/candidates - upload resumes
│   │
│   ├── services/           # Core business logic
│   │   ├── ai/
│   │   │   └── groq.ts     # Talks to Groq AI
│   │   ├── resume-parser.ts  # Extracts text from PDFs
│   │   └── auth.ts         # Password checking, JWT tokens
│   │
│   └── middleware/
│       └── auth.ts         # Checks if user is logged in
│
├── prisma/
│   └── schema.prisma       # Database blueprint (tables)
│
├── uploads/                # Where resume PDFs are saved
├── package.json            # Backend dependencies
└── .env                    # Backend secrets (API keys, DB password)
```

**What it does:** 
- Receives resume → Extracts text → Sends to AI → Gets score → Saves to database → Sends back to frontend

---

### **3. Database (The Memory) - PostgreSQL**
Where all data is stored permanently. Runs in Docker.

**Tables:**
- `organizations` - Companies using VealBiz (Acme Corp, Tech Startup, etc.)
- `users` - People who log in (john@acme.com, jane@acme.com)
- `jobs` - Job postings (Frontend Developer, Backend Engineer)
- `candidates` - People who applied (with resumes, AI scores, stages)

**Accessed through:** Prisma (a tool that makes database queries easy and safe)

---

### **4. AI Service (The Smart Reader) - Groq API**
Cloud service that reads and analyzes resumes. You don't download this - you call it via internet.

**What it does:**
```
Input:  "John Smith, 5 years React experience..."
Output: { score: 95, summary: "Excellent match", skills: [...] }
```

**Where it lives:** https://api.groq.com (cloud service)  
**Cost:** Free (14,400 requests/day)

---

### **5. Configuration Files (The Instructions)**

```
vealbiz/
├── package.json            # Root: Lists all tools needed
├── docker-compose.yml      # Starts PostgreSQL in Docker
├── .gitignore              # Don't upload these files to GitHub
└── README.md               # This file you're reading
```

---

## 📁 Complete Folder Structure

```
vealbiz/                        ← Your project folder
│
├── apps/                       ← The actual applications
│   ├── web/                    ← FRONTEND (React website)
│   │   ├── src/                ← Your React code
│   │   ├── package.json        ← Frontend tools list
│   │   └── .env                ← Frontend config (API URL)
│   │
│   └── api/                    ← BACKEND (Node.js server)
│       ├── src/                ← Your server code
│       ├── prisma/             ← Database schema
│       ├── uploads/            ← Resume files stored here
│       ├── package.json        ← Backend tools list
│       └── .env                ← Backend config (secrets, API keys)
│
├── package.json                ← Root config (manages both apps)
├── docker-compose.yml          ← Database setup
├── .gitignore                  ← Files to not upload
└── README.md                   ← Instructions (this file)
```

---

## 🚦 Getting Started

### What You Need First

- **Node.js** 18 or newer ([Download here](https://nodejs.org))
- **Docker Desktop** ([Download here](https://www.docker.com/products/docker-desktop)) - For running PostgreSQL
- **Code Editor** - VS Code recommended ([Download here](https://code.visualstudio.com/))
- **Groq API Key** - Free account at [console.groq.com](https://console.groq.com)

### Installation (Step by Step)

**1. Download the code**

```bash
git clone https://github.com/windveal/vealbiz.git
cd vealbiz
```

**2. Install all dependencies**

This downloads all the tools and libraries needed (React, Node.js packages, etc.)

```bash
npm install
```

This might take 2-3 minutes. You'll see a progress bar.

**3. Get your Groq API key**

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

# Groq AI API key (paste your key here)
GROQ_API_KEY="gsk_your_key_from_groq_console"

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

This creates all the tables (organizations, users, jobs, candidates, etc.)

```bash
cd apps/api
npx prisma migrate dev --name init
npx prisma generate
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

---

### Troubleshooting

**"Cannot connect to database"**
- Make sure Docker is running
- Run `docker-compose ps` to check if PostgreSQL is up

**"GROQ_API_KEY is not defined"**
- Check that you created `apps/api/.env`
- Make sure you pasted your actual Groq API key

**"Port 5173 already in use"**
- Another app is using that port
- Kill it: `lsof -ti:5173 | xargs kill` (Mac/Linux)

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
- Redis on port 6379 (optional, for caching)

### Using Local PostgreSQL

1. Install PostgreSQL
2. Create database:

```sql
CREATE DATABASE vealbiz;
CREATE USER vealbiz_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE vealbiz TO vealbiz_user;
```

3. Update `DATABASE_URL` in `.env`

### Run Migrations

```bash
cd apps/api
npx prisma migrate dev
```

### Prisma Studio (Database GUI)

```bash
cd apps/api
npx prisma studio
```

Opens at http://localhost:5555

---

## 🔑 API Keys Setup

### Groq API (Required)

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
- Sufficient for MVP and testing

---

## 🧪 Testing

### Run Tests

```bash
# Backend tests
cd apps/api
npm run test

# Frontend tests
cd apps/web
npm run test

# E2E tests
npm run test:e2e
```

### Test Coverage

```bash
npm run test:coverage
```

---

## 📦 Building for Production

### Build All Apps

```bash
npm run build
```

### Build Individually

```bash
# Frontend
cd apps/web
npm run build

# Backend
cd apps/api
npm run build
```

---

## 🚀 Deployment

### Frontend (Vercel)

1. Push code to GitHub
2. Import repository in [Vercel](https://vercel.com)
3. Set environment variables:
   - `VITE_API_URL` = your backend URL
4. Deploy

### Backend (Render)

1. Create new Web Service on [Render](https://render.com)
2. Connect GitHub repository
3. Set build command: `cd apps/api && npm install && npm run build`
4. Set start command: `cd apps/api && npm start`
5. Add environment variables (see `.env.example`)
6. Deploy

### Database (Neon)

1. Create database at [Neon](https://neon.tech)
2. Copy connection string
3. Update `DATABASE_URL` in production environment
4. Run migrations:
   ```bash
   npx prisma migrate deploy
   ```

---

## 📚 API Documentation

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
  "refreshToken": "eyJhbGc...",
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

### Candidates

**Upload Resume**
```bash
POST /api/jobs/{jobId}/candidates
Authorization: Bearer {token}
Content-Type: multipart/form-data

{
  "resume": (file),
  "email": "candidate@email.com" (optional)
}
```

**Get Candidate Details**
```bash
GET /api/candidates/{candidateId}
Authorization: Bearer {token}
```

**Update Candidate Stage**
```bash
PUT /api/candidates/{candidateId}/stage
Authorization: Bearer {token}
Content-Type: application/json

{
  "stage": "INTERVIEW"
}
```

Full API documentation available at `/api/docs` when running in development mode.

---

## 🛠️ Development Guidelines

### Code Style

- **ESLint** for linting
- **Prettier** for formatting
- Run before commit:
  ```bash
  npm run lint
  npm run format
  ```

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add video interview analysis
fix: resolve resume parsing error
docs: update API documentation
style: format code with prettier
refactor: restructure candidate service
test: add unit tests for AI ranking
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
3. Write/update tests
4. Update documentation
5. Submit PR with clear description
6. Wait for review and approval

---

## 🗺️ Roadmap

### MVP (Week 1-3) ✅
- [x] Authentication & Organizations
- [x] Job posting management
- [x] Resume upload & parsing
- [x] AI candidate ranking
- [x] Candidate pipeline

### Phase 2 (Week 4-6)
- [ ] Video interview link analysis
- [ ] Email notifications
- [ ] Advanced search & filtering
- [ ] Team collaboration features
- [ ] Interview scheduling

### Phase 3 (Week 7-12)
- [ ] Career page builder (public job board)
- [ ] Applicant portal
- [ ] Advanced analytics & reporting
- [ ] Integration APIs
- [ ] Mobile app (React Native)

### Future
- [ ] Chrome extension for LinkedIn
- [ ] Zapier integration
- [ ] WhatsApp integration
- [ ] Multi-language support (Yoruba, Igbo, Hausa)

---

## 🔐 Security

### Reporting Security Issues

If you discover a security vulnerability, please email security@windveal.com. Do not create public GitHub issues for security vulnerabilities.

### Security Features

- Passwords hashed with bcrypt (12 rounds)
- JWT token authentication
- SQL injection prevention (Prisma ORM)
- XSS protection (React auto-escaping)
- CSRF tokens
- Rate limiting
- File upload validation
- Role-based access control

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
- [Shadcn/ui](https://ui.shadcn.com) for beautiful components
- [Prisma](https://prisma.io) for excellent ORM
- Nigerian tech community for inspiration

---

## 📞 Support

- **Documentation:** [docs.vealbiz.com](https://docs.vealbiz.com) (coming soon)
- **Email:** support@windveal.com
- **GitHub Issues:** [Create an issue](https://github.com/windveal/vealbiz/issues)

---

## 📊 Project Status

**Current Version:** 0.1.0 (MVP)  
**Status:** 🚧 In Development  
**Last Updated:** February 2026

---

## 🎯 Quick Commands Reference

```bash
# Development
npm run dev              # Start all services
npm run dev:web          # Frontend only
npm run dev:api          # Backend only

# Database
npm run db:migrate       # Run migrations
npm run db:studio        # Open Prisma Studio
npm run db:seed          # Seed database
npm run db:reset         # Reset database

# Testing
npm run test             # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report

# Building
npm run build            # Build all
npm run build:web        # Build frontend
npm run build:api        # Build backend

# Code Quality
npm run lint             # Lint code
npm run lint:fix         # Fix linting issues
npm run format           # Format with Prettier
npm run type-check       # TypeScript check

# Docker
docker-compose up -d     # Start services
docker-compose down      # Stop services
docker-compose logs -f   # View logs
```

---

## 🌟 Star History

If you find VealBiz useful, please consider giving it a star ⭐

---

**Built with ❤️ in Nigeria by WindVeal Technologies**
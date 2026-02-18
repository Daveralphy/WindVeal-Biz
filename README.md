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

## 🏗️ Project Structure

```
vealbiz/
├── apps/
│   ├── web/                    # Frontend React app
│   │   ├── src/
│   │   │   ├── components/     # React components
│   │   │   ├── pages/          # Page components
│   │   │   ├── hooks/          # Custom hooks
│   │   │   ├── lib/            # Utilities and API client
│   │   │   └── types/          # TypeScript types
│   │   ├── public/             # Static assets
│   │   └── package.json
│   │
│   └── api/                    # Backend API
│       ├── src/
│       │   ├── routes/         # API routes
│       │   ├── services/       # Business logic
│       │   ├── middleware/     # Auth, validation, etc.
│       │   ├── lib/            # Utilities
│       │   └── types/          # TypeScript types
│       ├── prisma/
│       │   └── schema.prisma   # Database schema
│       └── package.json
│
├── packages/                   # Shared packages (optional)
│   └── shared/                 # Shared types/utils
│
├── .github/                    # GitHub Actions CI/CD
├── docker-compose.yml          # Local development setup
├── .env.example                # Environment variables template
├── package.json                # Root package.json
└── README.md                   # This file
```

---

## 🚦 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 18.0.0 ([Download](https://nodejs.org))
- **npm** or **pnpm** (we recommend pnpm)
- **PostgreSQL** >= 15 (or use Docker)
- **Git**

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/windveal/vealbiz.git
cd vealbiz
```

2. **Install dependencies**

```bash
# Using npm
npm install

# Or using pnpm (recommended)
pnpm install
```

3. **Set up environment variables**

Create `.env` files in both `apps/web` and `apps/api`:

**`apps/api/.env`**
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/vealbiz"

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_EXPIRES_IN="24h"
REFRESH_TOKEN_SECRET="your-refresh-token-secret"
REFRESH_TOKEN_EXPIRES_IN="7d"

# Groq API (get free key at: https://console.groq.com)
GROQ_API_KEY="your-groq-api-key"

# Server
PORT=8000
NODE_ENV="development"

# CORS
CORS_ORIGIN="http://localhost:5173"

# File Upload
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE=5242880  # 5MB in bytes
```

**`apps/web/.env`**
```env
VITE_API_URL="http://localhost:8000/api"
```

4. **Set up the database**

```bash
# Start PostgreSQL (if using Docker)
docker-compose up -d postgres

# Run database migrations
cd apps/api
npx prisma migrate dev --name init
npx prisma generate

# Optional: Seed database with sample data
npx prisma db seed
```

5. **Start development servers**

```bash
# From root directory, start both frontend and backend
npm run dev

# Or start them separately:

# Terminal 1 - Backend
cd apps/api
npm run dev

# Terminal 2 - Frontend
cd apps/web
npm run dev
```

6. **Open your browser**

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs (if enabled)

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
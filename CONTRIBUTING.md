# Contributing to VealBiz

Thank you for your interest in contributing to VealBiz! This document provides guidelines for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

---

## 🤝 Code of Conduct

### Our Pledge
We are committed to providing a welcoming and inspiring environment for all contributors. We value:
- 🤝 Respect for all individuals and their backgrounds
- 💡 Focus on constructive feedback
- 🏆 Celebration of diversity of thought
- ⚖️ Fair and inclusive collaboration

### Our Standards
- Use inclusive language
- Be respectful in disagreements
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

### Enforcement
Project maintainers will review and moderate contributions. Violations can result in temporary or permanent ban from project participation.

---

## 🚀 Getting Started

### Prerequisites
- Node.js v20 or higher
- Docker and Docker Compose (optional but recommended)
- Git v2.30 or higher
- Basic knowledge of React, Node.js, or TypeScript

### Setup Development Environment
```bash
# Clone the repository
git clone https://github.com/yourusername/vealbiz.git
cd vealbiz

# Create and switch to develop branch
git checkout develop

# Setup environment
cp .env.local .env

# Install dependencies
npm install

# Start development environment
make docker-up

# Run migrations
make migrate

# Verify setup
make health
```

For more detailed setup, see [QUICKSTART.md](QUICKSTART.md).

---

## 🌳 Development Workflow

### 1. Create Feature Branch
```bash
# Always start from latest develop
git checkout develop
git pull origin develop

# Create descriptive branch name
git checkout -b feature/descriptive-name

# Branch naming convention:
# feature/new-feature            # New functionality
# bugfix/fix-description         # Bug fixes
# docs/update-section            # Documentation
# chore/maintenance-task         # Maintenance
# test/test-description          # Test additions
# refactor/component-name        # Code refactoring
```

### 2. Implement Changes

```bash
# Make your changes
# ... edit files ...

# Keep commits focused and atomic
git add .
git commit -m "Brief description of changes"

# Commit frequently - easier to debug and review
```

### 3. Verify Quality Before Pushing

```bash
# Run all quality checks
make check

# This runs:
# ✓ Linting (ESLint)
# ✓ Type checking (TypeScript)
# ✓ Tests (Jest - when available)

# Format code automatically
make format

# Run specific checks
make lint
make type-check
make test
```

### 4. Push to GitHub
```bash
# Push your branch
git push origin feature/descriptive-name

# GitHub Actions automatically runs CI checks
# Watch: GitHub repo → Actions tab
```

### 5. Create Pull Request
```
1. Go to https://github.com/yourusername/vealbiz
2. Click "Compare & pull request" (or "Pull requests" → "New")
3. Set:
   - Base branch: develop (for features), main (for hotfixes)
   - Compare branch: your feature branch
4. Fill PR template:
   - Title: Clear, concise description
   - Description: What changed and why
   - Issues: Link related issues with "Closes #123"
5. Click "Create pull request"
```

### 6. Address Review Feedback
```bash
# Make requested changes
# ... edit files ...

# Commit changes (don't squash - allows tracking discussion)
git add .
git commit -m "Address review feedback: specific change"

# Push updated changes
git push origin feature/descriptive-name

# GitHub Actions re-runs automatically
```

### 7. Merge
Once approved and all checks pass:
- Reviewer clicks "Merge pull request"
- For development: merges to `develop`
- For main: merges to `main` (triggers production deployment)

---

## 💻 Code Standards

### TypeScript
```typescript
// ✅ DO: Use proper typing
interface UserProfile {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: Date;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  return await prisma.user.findUnique({
    where: { id: userId }
  });
}

// ❌ DON'T: Avoid 'any' type
export async function getUser(id: any): Promise<any> {
  return await prisma.user.findUnique({ where: { id } });
}
```

### React Components
```typescript
// ✅ DO: Functional components with explicit types
interface UserCardProps {
  userId: string;
  onSelect?: (id: string) => void;
}

export const UserCard: React.FC<UserCardProps> = ({ userId, onSelect }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load user
  }, [userId]);

  if (loading) return <LoadingSpinner />;
  if (!user) return <div>User not found</div>;

  return (
    <div onClick={() => onSelect?.(userId)}>
      {user.firstName} {user.lastName}
    </div>
  );
};

// ❌ DON'T: Class components or unclear props
export class UserCard extends React.Component {
  render() {
    // ...
  }
}
```

### Backend Endpoints
```typescript
// ✅ DO: Clear, consistent API patterns
interface RegisterRequest {
  organizationName: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface AuthResponse {
  user: { id: string; email: string };
  token: string;
}

export async function registerHandler(req: FastifyRequest, reply: FastifyReply) {
  const body = registerSchema.parse(req.body);
  
  try {
    const userData = await registerUser(body);
    return reply.status(201).send({
      user: userData.user,
      token: userData.token
    });
  } catch (error) {
    // Handle error
  }
}

// ❌ DON'T: Inconsistent error handling or response format
export async function register(req, res) {
  try {
    const user = await db.user.create(req.body);
    res.json(user);
  } catch (e) {
    res.json({ error: 'Something went wrong' });
  }
}
```

### Error Handling
```typescript
// ✅ DO: Handle errors explicitly
try {
  const user = await authenticateUser(email, password);
  if (!user) {
    return reply.status(401).send({
      error: 'INVALID_CREDENTIALS',
      message: 'Email or password is incorrect'
    });
  }
} catch (error: unknown) {
  logger.error('Auth error:', error);
  return reply.status(500).send({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred'
  });
}

// ❌ DON'T: Silent failures
const user = await db.user.findOne({ email });
return reply.send(user);
```

### File Structure
```
✅ DO:
apps/web/src/
├── pages/
│   ├── Dashboard.tsx
│   ├── Jobs.tsx
│   └── Login.tsx
├── components/
│   ├── common/
│   │   ├── Header.tsx
│   │   └── Sidebar.tsx
│   └── features/
│       ├── JobCard.tsx
│       └── CandidateList.tsx
├── hooks/
│   ├── useAuth.ts
│   └── useJobs.ts
└── lib/
    ├── api.ts
    └── validation.ts

❌ DON'T:
components/
├── DashboardPage.tsx
├── Header.tsx
├── FooterComponent.tsx
├── useAuthHook.ts
└── MyUtilityFunction.ts
```

### ESLint & Prettier
```bash
# Format on save (configure in IDE)
# Or manually:
make format

# ESLint will auto-fix some issues:
make lint

# Never disable rules without comment:
// ✅ Good
// eslint-disable-next-line react/prop-types
export const Component = () => {

// ❌ Bad
// eslint-disable
export const Component = () => {
```

---

## 🧪 Testing Requirements

### Frontend Tests
```typescript
// ✅ DO: Have test cases for components
describe('LoginForm', () => {
  it('should show loading state during submission', async () => {
    const { getByText, getByRole } = render(<LoginForm />);
    
    const input = getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test@test.com' } });
    
    const button = getByText('Login');
    fireEvent.click(button);
    
    expect(getByText('Loading...')).toBeInTheDocument();
  });

  it('should show error message on failed login', async () => {
    const { getByText, getByRole } = render(<LoginForm />);
    
    // Fill form
    fireEvent.change(getByRole('textbox'), { target: { value: 'test@test.com' } });
    fireEvent.click(getByText('Login'));
    
    // Wait for error
    await waitFor(() => {
      expect(getByText('Invalid credentials')).toBeInTheDocument();
    });
  });
});

// ❌ DON'T: Skip tests or have untested components
export const Component = () => {
  // No tests
};
```

### Backend Tests
```typescript
// ✅ DO: Test API endpoints with different scenarios
describe('POST /api/auth/login', () => {
  it('should return token for valid credentials', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'test@example.com',
        password: 'ValidPassword123'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('token');
  });

  it('should return 401 for invalid password', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'test@example.com',
        password: 'WrongPassword'
      }
    });

    expect(response.statusCode).toBe(401);
  });
});

// ❌ DON'T: Leave endpoints untested
app.post('/api/auth/login', async (req, reply) => {
  // No tests
});
```

### Run Tests
```bash
make test              # Run all tests
make test-watch       # Watch mode
npm run test -- --coverage  # Coverage report
```

---

## 📝 Commit Message Guidelines

### Format
```
[Type] Brief description of changes

Optional longer explanation if needed.
- Bullet points can be used
- For multiple changes

Closes #123
Relates to #456
```

### Types
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style (formatting, missing semicolons, etc)
- **refactor**: Code refactoring without feature changes
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Build process, dependencies, tooling

### Examples
```bash
✅ Good:
git commit -m "feat: Add user profile editing page

- Add settings page component
- Create PUT /api/users/:id endpoint
- Add form validation for user data

Closes #45"

git commit -m "fix: Resolve login infinite loop on token expiry

Token refresh now handled correctly in API client interceptor.

Relates to #123"

git commit -m "docs: Update API endpoint documentation"

❌ Bad:
git commit -m "fixed stuff"
git commit -m "updates"
git commit -m "wip: work in progress"
```

---

## 🐛 Reporting Bugs

### Before Reporting
- [ ] Check existing issues (don't create duplicates)
- [ ] Update to latest `develop` branch
- [ ] Clear browser cache and rebuild (`make docker-down && make docker-up`)
- [ ] Search TROUBLESHOOTING.md for similar issues

### Bug Report Template
```markdown
## Description
Brief description of the bug.

## Steps to Reproduce
1. First step
2. Second step
3. Third step

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens.

## Environment
- OS: [Windows/Mac/Linux]
- Node version: [e.g., v20.x.x]
- Browser: [Chrome/Firefox/Safari]

## Screenshots
Attach screenshots/videos if applicable.

## Logs
```
Paste relevant error messages or logs here
```

## Possible Solution
Optional - suggested fix or workaround.
```

### Creating Bug Report
1. Go to GitHub → Issues → New Issue
2. Click "Bug report"
3. Fill template
4. Click "Submit new issue"

### Guidelines
- Be specific and clear
- Include reproducible steps
- Include error messages and logs
- One bug per issue
- Search for duplicates first

---

## 💡 Suggesting Features

### Feature Request Template
```markdown
## Description
Clear description of the feature request.

## Problem It Solves
What problem does this feature solve?
Why is this needed?

## Proposed Solution
How would you implement this?
Any implementation suggestions?

## Examples
Real-world examples of usage.

## Alternatives Considered
Other approaches you considered.
```

### Creating Feature Request
1. Go to GitHub → Issues → New Issue
2. Click "Feature request"
3. Fill template
4. Click "Submit new issue"

### Guidelines
- One feature per issue
- Provide clear use cases
- Explain why it's important
- Include examples
- Be open to feedback and discussion

---

## 📋 Pull Request Process

### PR Checklist
Before submitting PR, ensure:
- [ ] Branch is based on latest `develop`
- [ ] All changes are relevant to PR purpose (no unrelated changes)
- [ ] Code follows style guidelines (`make lint`)
- [ ] TypeScript compiles without errors (`make type-check`)
- [ ] Tests pass (`make test`)
- [ ] New tests added for new functionality
- [ ] Documentation updated if needed
- [ ] Commit messages follow guidelines
- [ ] No merge conflicts
- [ ] Git history is clean (atomic commits)

### PR Description Template
```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Breaking change

## Testing Done
Description of testing performed.
- [ ] Manual testing completed
- [ ] Unit tests added
- [ ] Integration tests passed

## Screenshots
Attach screenshots for UI changes.

## Checklist
- [ ] Code follows style guidelines
- [ ] No new warnings generated
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes (or documented)

## Closes
Closes #[issue number]
```

### Review Process
1. **Syntax Check**: GitHub Actions runs automated checks
2. **Code Review**: At least one maintainer reviews code
3. **Discussion**: Address feedback and suggestions
4. **Approval**: At least one approval required
5. **Merge**: Merged by maintainer

### Common Review Feedback
```
"Consider using hooks instead of class component"
→ Refactor to functional component with hooks

"This needs tests"
→ Add tests for the new functionality

"Can you add a docstring here?"
→ Add JSDoc comment explaining the function

"This creates a type safety issue"
→ Fix TypeScript types to be more strict
```

---

## 🏆 Best Practices

### Do's
- ✅ Keep PRs focused and small
- ✅ Write descriptive commit messages
- ✅ Test your changes thoroughly
- ✅ Follow existing code patterns
- ✅ Ask questions if unclear
- ✅ Be respectful and collaborative
- ✅ Update documentation
- ✅ Review others' PRs

### Don'ts
- ❌ Commit directly to `main` (without PR)
- ❌ Mix unrelated changes in one PR
- ❌ Add dependencies without discussion
- ❌ Skip tests or linting
- ❌ Use `any` type in TypeScript
- ❌ Rewrite others' code without discussion
- ❌ Ignore review feedback
- ❌ Leave commented code

---

## 📊 Review Timeline

| Step | Typical Time |
|------|-------------|
| Automated checks | 2-5 minutes |
| Code review assignment | Same day |
| Review feedback | 24-48 hours |
| Changes/revisions | 24 hours |
| Approval | 24-48 hours |
| Merge | Immediately |
| Deployment | Automatic |

---

## 🆘 Getting Help

### Resources
- 💬 GitHub Discussions for questions
- 🐛 GitHub Issues for bugs
- 📚 See TROUBLESHOOTING.md for common issues
- 👥 Reach out to team on Slack/Discord

### Report Security Issues
For security issues, **do not** create public issues:
1. Email security@vealbiz.com with details
2. Include: description, steps to reproduce, severity
3. Give maintainers time to fix before disclosure

---

## 📄 License

By contributing to VealBiz, you agree that your contributions will be licensed under the same license as the project (MIT).

---

## 🎉 Thank You!

Your contributions make VealBiz better! We appreciate your effort and time.

**Questions?** See [QUICKSTART.md](QUICKSTART.md), [TROUBLESHOOTING.md](TROUBLESHOOTING.md), or reach out to the team.

---

**Last Updated**: 2026-02-20  
**Version**: 1.0  
**Maintained By**: Development Team

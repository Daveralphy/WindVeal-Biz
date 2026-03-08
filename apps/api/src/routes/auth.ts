import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { env } from '../config/env.js';

const registerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/, 
    'Password must have uppercase, number, and special character'),
  username: z.string().min(3).optional(),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  organizationName: z.string().min(1),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  website: z.string().optional(),
  country: z.string().optional(),
  pipelineStages: z.array(z.string()).optional(),
});

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function generateTokens(userId: string, organizationId: string, role: string, isSuperAdmin: boolean = false) {
  const accessToken = jwt.sign(
    { userId, organizationId, role, isSuperAdmin },
    env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  const refreshToken = jwt.sign(
    { userId, organizationId, role, isSuperAdmin },
    env.REFRESH_TOKEN_SECRET,
    { expiresIn: '30d' }
  );
  return { accessToken, refreshToken };
}

const DEFAULT_STAGES = ['Applied', 'Screening', 'Interview', 'Technical Assessment', 'Final Interview', 'Offer Sent', 'Hired', 'Rejected'];

export async function authRoutes(app: FastifyInstance) {
  // Register
  app.post('/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const data = parsed.data;

    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    if (data.username) {
      const existingUsername = await prisma.user.findUnique({ where: { username: data.username } });
      if (existingUsername) {
        return reply.status(409).send({ error: 'Username already taken' });
      }
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    let slug = generateSlug(data.organizationName);

    // Ensure slug is unique — append short suffix only on collision
    const existingSlug = await prisma.organization.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = slug + '-' + Math.random().toString(36).slice(2, 6);
    }

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: data.organizationName,
          slug,
          industry: data.industry,
          companySize: data.companySize,
          website: data.website,
          country: data.country,
        },
      });

      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          email: data.email,
          username: data.username,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          jobTitle: data.jobTitle,
          phone: data.phone,
          role: 'ADMIN',
        },
      });

      // Create default email templates
      await tx.emailTemplate.createMany({
        data: [
          { organizationId: organization.id, name: 'Application Received', subject: 'Application Received - {{job_title}}', body: 'Dear {{first_name}},\n\nThank you for applying for the {{job_title}} position at {{company_name}}. We have received your application and will review it shortly.\n\nBest regards,\n{{company_name}}', isSystem: true },
          { organizationId: organization.id, name: 'Rejection', subject: 'Update on Your Application - {{job_title}}', body: 'Dear {{first_name}},\n\nThank you for your interest in the {{job_title}} position at {{company_name}}. After careful consideration, we have decided to move forward with other candidates.\n\nWe wish you the best in your job search.\n\nBest regards,\n{{company_name}}', isSystem: true },
        ],
      });

      return { organization, user };
    });

    const tokens = generateTokens(result.user.id, result.organization.id, result.user.role, false);

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        userId: result.user.id,
        token: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    reply.setCookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    return reply.status(201).send({
      accessToken: tokens.accessToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        username: result.user.username,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
        jobTitle: result.user.jobTitle,
        phone: result.user.phone,
        avatarUrl: result.user.avatarUrl,
        timezone: result.user.timezone,
        organizationId: result.organization.id,
        organizationName: result.organization.name,
        organizationLogo: result.organization.logoUrl,
      },
    });
  });

  // Login
  app.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username: email }],
      },
      include: { organization: true },
    });

    if (!user || !user.isActive) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = generateTokens(user.id, user.organizationId, user.role, user.isSuperAdmin);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    reply.setCookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    return {
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
        jobTitle: user.jobTitle,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        timezone: user.timezone,
        organizationId: user.organizationId,
        organizationName: user.organization.name,
        organizationLogo: user.organization.logoUrl,
      },
    };
  });

  // Refresh token
  app.post('/refresh', async (request, reply) => {
    const token = request.cookies.refreshToken;
    if (!token) {
      return reply.status(401).send({ error: 'No refresh token' });
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.expiresAt < new Date()) {
      return reply.status(401).send({ error: 'Invalid or expired refresh token' });
    }

    try {
      const payload = jwt.verify(token, env.REFRESH_TOKEN_SECRET) as { userId: string; organizationId: string; role: string; isSuperAdmin?: boolean };
      const tokens = generateTokens(payload.userId, payload.organizationId, payload.role, payload.isSuperAdmin || false);

      // Rotate refresh token
      await prisma.refreshToken.delete({ where: { id: stored.id } });
      await prisma.refreshToken.create({
        data: {
          userId: payload.userId,
          token: tokens.refreshToken,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      reply.setCookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });

      return { accessToken: tokens.accessToken };
    } catch {
      return reply.status(401).send({ error: 'Invalid refresh token' });
    }
  });

  // Logout
  app.post('/logout', async (request, reply) => {
    const token = request.cookies.refreshToken;
    if (token) {
      await prisma.refreshToken.deleteMany({ where: { token } });
    }
    reply.clearCookie('refreshToken', { path: '/' });
    return { message: 'Logged out' };
  });

  // Change password (regular user)
  app.patch('/change-password', { preHandler: [authenticate] }, async (request, reply) => {
    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8).regex(
        /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/,
        'Password must have uppercase, number, and special character'
      ),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const user = await prisma.user.findUnique({
      where: { id: request.user!.userId },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    return { message: 'Password updated successfully' };
  });

  // Get current user
  app.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.userId },
      include: { organization: true },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isSuperAdmin: user.isSuperAdmin,
      jobTitle: user.jobTitle,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      timezone: user.timezone,
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      organizationLogo: user.organization.logoUrl,
    };
  });

  // Update timezone
  app.patch('/timezone', { preHandler: [authenticate] }, async (request) => {
    const schema = z.object({ timezone: z.string().min(1) });
    const { timezone } = schema.parse(request.body);

    await prisma.user.update({
      where: { id: request.user!.userId },
      data: { timezone },
    });

    return { timezone };
  });
}

// Import here to avoid circular — used in the route
import { authenticate } from '../middleware/auth.js';

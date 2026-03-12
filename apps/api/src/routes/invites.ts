import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { env } from '../config/env.js';

function generateTokens(userId: string, organizationId: string, role: string) {
  const accessToken = jwt.sign(
    { userId, organizationId, role, isSuperAdmin: false },
    env.JWT_SECRET,
    { expiresIn: '15m' },
  );
  const refreshToken = jwt.sign(
    { userId, organizationId, role, isSuperAdmin: false },
    env.REFRESH_TOKEN_SECRET,
    { expiresIn: '30d' },
  );
  return { accessToken, refreshToken };
}

export async function inviteRoutes(app: FastifyInstance) {
  // GET /invites/:token — public, returns invite info for the accept page
  app.get<{ Params: { token: string } }>('/:token', async (request, reply) => {
    const invite = await prisma.teamInvitation.findUnique({
      where: { token: request.params.token },
      include: { organization: { select: { name: true } } },
    });

    if (!invite) return reply.status(404).send({ error: 'Invitation not found' });
    if (invite.acceptedAt) return reply.status(410).send({ error: 'This invitation has already been used' });
    if (invite.expiresAt < new Date()) return reply.status(410).send({ error: 'This invitation has expired' });

    return {
      email: invite.email,
      firstName: invite.firstName ?? '',
      lastName: invite.lastName ?? '',
      jobTitle: invite.jobTitle ?? '',
      role: invite.role,
      orgName: invite.organization.name,
      invitedByName: invite.invitedByName,
    };
  });

  // POST /invites/:token/accept — public, create user + auto-login
  app.post<{ Params: { token: string } }>('/:token/accept', async (request, reply) => {
    const schema = z.object({
      username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9._-]+$/, 'Username may only contain letters, numbers, dots, dashes and underscores'),
      password: z.string().min(8).regex(/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/, 'Password must contain uppercase, number and special character'),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const invite = await prisma.teamInvitation.findUnique({
      where: { token: request.params.token },
      include: { organization: true },
    });

    if (!invite) return reply.status(404).send({ error: 'Invitation not found' });
    if (invite.acceptedAt) return reply.status(410).send({ error: 'This invitation has already been used' });
    if (invite.expiresAt < new Date()) return reply.status(410).send({ error: 'This invitation has expired' });

    const { username, password, firstName, lastName } = parsed.data;

    // Uniqueness checks
    const emailTaken = await prisma.user.findUnique({ where: { email: invite.email } });
    if (emailTaken) return reply.status(409).send({ error: 'An account with this email already exists' });

    const usernameTaken = await prisma.user.findUnique({ where: { username } });
    if (usernameTaken) return reply.status(409).send({ error: 'Username is already taken' });

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        organizationId: invite.organizationId,
        email: invite.email,
        username,
        passwordHash,
        firstName,
        lastName,
        jobTitle: invite.jobTitle ?? undefined,
        role: invite.role,
        isActive: true,
        emailVerified: true, // invite link = email confirmed
      },
    });

    // Mark invitation as accepted
    await prisma.teamInvitation.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });

    const { accessToken, refreshToken } = generateTokens(user.id, user.organizationId, user.role);

    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: invite.organization.name,
        isSuperAdmin: false,
      },
    };
  });
}

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { sendSystemEmail, inviteEmailHtml } from '../services/emailService.js';
import { env } from '../config/env.js';

export async function teamRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // List team members
  app.get('/', async (request) => {
    const { organizationId } = request.user!;

    const users = await prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        emailVerified: true,
        avatarUrl: true,
        jobTitle: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const pending = await prisma.teamInvitation.findMany({
      where: { organizationId, acceptedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, role: true, firstName: true, lastName: true, createdAt: true },
    });

    return {
      members: users.map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
        role: u.role,
        jobTitle: u.jobTitle,
        status: u.isActive ? 'active' : 'inactive',
        avatarUrl: u.avatarUrl,
      })),
      pendingInvitations: pending,
    };
  });

  // Send an invitation to a new team member
  app.post('/invite', async (request, reply) => {
    const { organizationId, userId } = request.user!;

    const inviter = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
    const inviterFirst = inviter?.firstName ?? '';
    const inviterLast = inviter?.lastName ?? '';

    const schema = z.object({
      email: z.string().email(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      jobTitle: z.string().optional(),
      role: z.enum(['RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER']).default('RECRUITER'),
      message: z.string().max(500).optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid input' });

    const { email, firstName, lastName, jobTitle, role, message } = parsed.data;

    // No duplicate active members
    const existing = await prisma.user.findFirst({ where: { email, organizationId } });
    if (existing) return reply.status(409).send({ error: 'This person is already a member of your team' });

    // Cancel any previous pending invite for same email
    await prisma.teamInvitation.updateMany({
      where: { organizationId, email, acceptedAt: null },
      data: { expiresAt: new Date() }, // expire immediately
    });

    const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
    const inviterName = `${inviterFirst} ${inviterLast}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await prisma.teamInvitation.create({
      data: { organizationId, email, role, firstName, lastName, jobTitle, message, invitedByName: inviterName, expiresAt },
    });

    const acceptUrl = `${env.APP_URL}/invite/${invitation.token}`;
    await sendSystemEmail(
      email,
      `You're invited to join ${org?.name ?? 'a team'} on VealBiz`,
      inviteEmailHtml({ inviterName, orgName: org?.name ?? 'a team', role, message, acceptUrl }),
    );

    return { message: 'Invitation sent successfully' };
  });

  // Cancel a pending invitation
  app.delete<{ Params: { id: string } }>('/invite/:id', async (request, reply) => {
    const { organizationId } = request.user!;
    await prisma.teamInvitation.deleteMany({ where: { id: request.params.id, organizationId } });
    return { message: 'Invitation cancelled' };
  });
}

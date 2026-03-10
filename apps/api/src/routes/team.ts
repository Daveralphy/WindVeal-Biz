import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

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
      where: { organizationId, acceptedAt: null },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    return {
      members: users.map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
        role: u.role,
        jobTitle: u.jobTitle,
        status: u.isActive ? (u.emailVerified ? 'active' : 'pending') : 'inactive',
        avatarUrl: u.avatarUrl,
      })),
      pendingInvitations: pending,
    };
  });

  // Verify a team member's email
  app.patch<{ Params: { id: string } }>('/:id/verify', async (request, reply) => {
    const { organizationId } = request.user!;

    const user = await prisma.user.findFirst({
      where: { id: request.params.id, organizationId },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    return { message: 'User verified' };
  });
}

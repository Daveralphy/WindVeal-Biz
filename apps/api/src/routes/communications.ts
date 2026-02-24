import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export async function communicationsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // Email stats + recent emails
  app.get('/', async (request) => {
    const { organizationId } = request.user!;

    const emailLogs = await prisma.emailLog.findMany({
      where: { applicant: { organizationId } },
      include: {
        applicant: { select: { firstName: true, lastName: true } },
        sentBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { sentAt: 'desc' },
      take: 50,
    });

    const sent = emailLogs.filter((e) => e.sentAt).length;
    const opened = emailLogs.filter((e) => e.openedAt).length;

    return {
      stats: { sent, opened, scheduled: 0 },
      emails: emailLogs.map((e) => ({
        id: e.id,
        to: `${e.applicant.firstName} ${e.applicant.lastName}`,
        subject: e.subject,
        status: 'sent',
        sentAt: e.sentAt,
        openedAt: e.openedAt,
      })),
    };
  });
}

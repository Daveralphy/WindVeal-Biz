import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export async function interviewRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // List interviews
  app.get('/', async (request) => {
    const { organizationId } = request.user!;

    const interviews = await prisma.interview.findMany({
      where: { job: { organizationId } },
      include: {
        applicant: { select: { firstName: true, lastName: true } },
        job: { select: { title: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    });

    // Resolve interviewer names
    const interviewerIds = [...new Set(interviews.flatMap((i) => i.interviewerIds))];
    const interviewers = await prisma.user.findMany({
      where: { id: { in: interviewerIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const interviewerMap = Object.fromEntries(
      interviewers.map((u) => [u.id, `${u.firstName} ${u.lastName}`])
    );

    return interviews.map((i) => ({
      id: i.id,
      candidateName: `${i.applicant.firstName} ${i.applicant.lastName}`,
      jobTitle: i.job.title,
      type: i.type,
      scheduledAt: i.scheduledAt,
      durationMinutes: i.durationMinutes,
      location: i.location,
      meetingLink: i.meetingLink,
      status: i.status,
      interviewer: i.interviewerIds.map((id) => interviewerMap[id] || 'Unknown').join(', '),
    }));
  });
}

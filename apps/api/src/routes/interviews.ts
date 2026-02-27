import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const scheduleInterviewSchema = z.object({
  applicantId: z.string().min(1),
  jobId: z.string().min(1),
  scheduledAt: z.string().min(1),
  durationMinutes: z.number().int().min(15).max(480).default(60),
  medium: z.enum(['teams', 'google_meet', 'zoom']),
  meetingLink: z.string().url().optional().or(z.literal('')),
  emailSubject: z.string().min(1),
  emailBody: z.string().min(1),
});

export async function interviewRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // List interviews
  app.get('/', async (request) => {
    const { organizationId } = request.user!;

    const interviews = await prisma.interview.findMany({
      where: { job: { organizationId } },
      include: {
        applicant: { select: { firstName: true, lastName: true, email: true } },
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
      applicantId: i.applicantId,
      candidateName: `${i.applicant.firstName} ${i.applicant.lastName}`,
      candidateEmail: i.applicant.email,
      jobTitle: i.job.title,
      type: i.type,
      scheduledAt: i.scheduledAt,
      durationMinutes: i.durationMinutes,
      location: i.location,
      meetingLink: i.meetingLink,
      status: i.status,
      notes: i.notes,
      interviewer: i.interviewerIds.map((id) => interviewerMap[id] || 'Unknown').join(', '),
    }));
  });

  // Get applicants at the Interview pipeline stage
  app.get('/candidates', async (request) => {
    const { organizationId } = request.user!;

    const applicants = await prisma.applicant.findMany({
      where: {
        organizationId,
        currentStage: { name: 'Interview' },
      },
      include: {
        currentStage: true,
        job: { select: { id: true, title: true } },
        aiReport: { select: { overallScore: true, recommendation: true } },
        interviews: {
          select: { id: true, scheduledAt: true, status: true },
          orderBy: { scheduledAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return applicants;
  });

  // Schedule a new interview
  app.post('/', async (request) => {
    const { userId, organizationId } = request.user!;
    const data = scheduleInterviewSchema.parse(request.body);

    // Verify applicant belongs to the organization
    const applicant = await prisma.applicant.findFirst({
      where: { id: data.applicantId, organizationId },
    });
    if (!applicant) {
      return app.httpErrors.notFound('Applicant not found');
    }

    const result = await prisma.$transaction(async (tx) => {
      const interview = await tx.interview.create({
        data: {
          applicantId: data.applicantId,
          jobId: data.jobId,
          type: 'VIDEO_CALL',
          scheduledAt: new Date(data.scheduledAt),
          durationMinutes: data.durationMinutes,
          meetingLink: data.meetingLink || null,
          notes: `Medium: ${data.medium}`,
          interviewerIds: [userId],
          status: 'SCHEDULED',
        },
      });

      // Save email as a log (sending deferred)
      await tx.emailLog.create({
        data: {
          applicantId: data.applicantId,
          subject: data.emailSubject,
          body: data.emailBody,
          sentById: userId,
        },
      });

      return interview;
    });

    return result;
  });
}

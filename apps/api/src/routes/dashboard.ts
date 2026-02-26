import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // Dashboard stats
  app.get('/stats', async (request) => {
    const { organizationId } = request.user!;

    const [
      activeJobs,
      totalApplicants,
      applicantsByStage,
      interviews,
      offers,
    ] = await Promise.all([
      prisma.job.count({ where: { organizationId, status: 'ACTIVE' } }),
      prisma.applicant.count({ where: { organizationId } }),
      prisma.applicant.findMany({
        where: { organizationId },
        include: { currentStage: { select: { name: true } } },
      }),
      prisma.interview.findMany({
        where: { job: { organizationId } },
        include: { job: true },
      }),
      prisma.offer.findMany({
        where: { job: { organizationId } },
      }),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const interviewsToday = interviews.filter((i) => {
      const d = new Date(i.scheduledAt);
      return d >= today && d < tomorrow && i.status === 'SCHEDULED';
    }).length;

    const stageNames = applicantsByStage.map((a) => a.currentStage.name);
    const pendingReview = stageNames.filter((n) => n === 'Applied').length;
    const inPipeline = stageNames.filter((n) => !['Applied', 'Hired'].includes(n)).length;
    const hired = stageNames.filter((n) => n === 'Hired').length;
    const offersSent = offers.filter((o) => o.status === 'SENT' || o.status === 'VIEWED').length;

    return {
      activeJobs,
      totalApplicants,
      pendingReview,
      inPipeline,
      hired,
      rejected: 0, // no "Rejected" stage in our seed, would come from stage name
      offersSent,
      interviewsToday,
    };
  });

  // Recent activity
  app.get('/activity', async (request) => {
    const { organizationId } = request.user!;

    // Get recent stage changes
    const recentHistory = await prisma.stageHistory.findMany({
      where: { applicant: { organizationId } },
      include: {
        applicant: true,
        toStage: true,
        fromStage: true,
      },
      orderBy: { movedAt: 'desc' },
      take: 10,
    });

    // Get recent applicants
    const recentApplicants = await prisma.applicant.findMany({
      where: { organizationId },
      include: { job: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Get recent interviews
    const recentInterviews = await prisma.interview.findMany({
      where: { job: { organizationId } },
      include: { applicant: true, job: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Combine + sort
    const activities = [
      ...recentApplicants.map((a) => ({
        type: 'application' as const,
        action: 'New application',
        detail: `${a.firstName} ${a.lastName} applied for ${a.job.title}`,
        time: a.createdAt,
        color: 'bg-blue-500',
      })),
      ...recentHistory.map((h) => ({
        type: 'stage_change' as const,
        action: 'Stage changed',
        detail: `${h.applicant.firstName} ${h.applicant.lastName} moved to ${h.toStage.name}`,
        time: h.movedAt,
        color: 'bg-amber-500',
      })),
      ...recentInterviews.map((i) => ({
        type: 'interview' as const,
        action: i.status === 'SCHEDULED' ? 'Interview scheduled' : 'Interview ' + i.status.toLowerCase(),
        detail: `${i.applicant.firstName} ${i.applicant.lastName} — ${i.job.title}`,
        time: i.createdAt,
        color: 'bg-purple-500',
      })),
    ]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 3);

    return activities;
  });
}

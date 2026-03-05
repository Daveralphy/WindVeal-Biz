import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

function getRangeSince(range?: string): Date | null {
  if (!range || range === 'all') return null;
  const now = new Date();
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 0;
  if (!days) return null;
  now.setDate(now.getDate() - days);
  now.setHours(0, 0, 0, 0);
  return now;
}

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // Dashboard stats
  app.get('/stats', async (request) => {
    const { organizationId } = request.user!;
    const query = request.query as Record<string, string>;

    const since = getRangeSince(query.range);

    const [
      activeJobs,
      totalApplicants,
      interviews,
      teamMembers,
    ] = await Promise.all([
      prisma.job.count({ where: { organizationId, status: 'ACTIVE' } }),
      prisma.applicant.count({ where: { organizationId, ...(since && { createdAt: { gte: since } }) } }),
      prisma.interview.count({
        where: { job: { organizationId }, status: 'COMPLETED', ...(since && { scheduledAt: { gte: since } }) },
      }),
      prisma.user.count({ where: { organizationId } }),
    ]);

    return {
      activeJobs,
      totalApplicants,
      interviews,
      teamMembers,
    };
  });

  // Recent activity
  app.get('/activity', async (request) => {
    const { organizationId } = request.user!;
    const query = request.query as Record<string, string>;
    const since = getRangeSince(query.range);

    // Get recent stage changes
    const recentHistory = await prisma.stageHistory.findMany({
      where: { applicant: { organizationId }, ...(since && { movedAt: { gte: since } }) },
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
      where: { organizationId, ...(since && { createdAt: { gte: since } }) },
      include: { job: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Get recent interviews
    const recentInterviews = await prisma.interview.findMany({
      where: { job: { organizationId }, ...(since && { createdAt: { gte: since } }) },
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

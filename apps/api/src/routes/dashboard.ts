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
      ...recentHistory.map((h) => {
        const isRevert = h.fromStage != null && h.toStage.order < h.fromStage.order;
        return {
          type: 'stage_change' as const,
          action: isRevert ? 'Stage reverted' : 'Stage changed',
          detail: `${h.applicant.firstName} ${h.applicant.lastName} ${isRevert ? 'reverted to' : 'moved to'} ${h.toStage.name}`,
          time: h.movedAt,
          color: isRevert ? 'bg-orange-500' : 'bg-amber-500',
        };
      }),
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

  // Today's scheduled interviews
  app.get('/today-interviews', async (request) => {
    const { organizationId, userId } = request.user!;

    // Use the user's stored timezone, fall back to UTC
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    const tz = user?.timezone || 'UTC';

    // Compute start/end of today in the user's timezone
    const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
    const startOfDay = new Date(nowInTz.getFullYear(), nowInTz.getMonth(), nowInTz.getDate());
    const endOfDay = new Date(nowInTz.getFullYear(), nowInTz.getMonth(), nowInTz.getDate() + 1);

    // Convert back to UTC for the database query
    const offsetMs = startOfDay.getTime() - new Date(startOfDay.toLocaleString('en-US', { timeZone: 'UTC' })).getTime();
    const utcStart = new Date(startOfDay.getTime() - offsetMs);
    const utcEnd = new Date(endOfDay.getTime() - offsetMs);

    const interviews = await prisma.interview.findMany({
      where: {
        job: { organizationId },
        scheduledAt: { gte: utcStart, lt: utcEnd },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
      include: {
        applicant: { select: { firstName: true, lastName: true } },
        job: { select: { title: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return interviews.map((i) => ({
      id: i.id,
      applicantName: `${i.applicant.firstName} ${i.applicant.lastName}`,
      jobTitle: i.job.title,
      scheduledAt: i.scheduledAt,
      type: i.type,
      status: i.status,
    }));
  });

  // Trend data for the last 8 weeks
  app.get('/trends', async (request) => {
    const { organizationId } = request.user!;

    const since = new Date();
    since.setDate(since.getDate() - 56);
    since.setHours(0, 0, 0, 0);

    const [applicants, jobs, hiredEntries] = await Promise.all([
      prisma.applicant.findMany({
        where: { organizationId, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      prisma.job.findMany({
        where: { organizationId, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      prisma.stageHistory.findMany({
        where: {
          applicant: { organizationId },
          movedAt: { gte: since },
          toStage: { name: { contains: 'hired', mode: 'insensitive' } },
        },
        select: { movedAt: true },
      }),
    ]);

    const labels: string[] = [];
    const appCounts: number[] = [];
    const jobCounts: number[] = [];
    const hiredCounts: number[] = [];

    for (let i = 7; i >= 0; i--) {
      const bucketEnd = new Date();
      bucketEnd.setDate(bucketEnd.getDate() - i * 7);
      bucketEnd.setHours(23, 59, 59, 999);
      const bucketStart = new Date(bucketEnd);
      bucketStart.setDate(bucketStart.getDate() - 6);
      bucketStart.setHours(0, 0, 0, 0);

      labels.push(bucketStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      appCounts.push(applicants.filter((a) => { const d = new Date(a.createdAt); return d >= bucketStart && d <= bucketEnd; }).length);
      jobCounts.push(jobs.filter((j) => { const d = new Date(j.createdAt); return d >= bucketStart && d <= bucketEnd; }).length);
      hiredCounts.push(hiredEntries.filter((h) => { const d = new Date(h.movedAt); return d >= bucketStart && d <= bucketEnd; }).length);
    }

    return {
      labels,
      series: [
        { name: 'Applications', color: '#3B82F6', data: appCounts },
        { name: 'Jobs Created', color: '#10B981', data: jobCounts },
        { name: 'Hired', color: '#8B5CF6', data: hiredCounts },
      ],
    };
  });
}

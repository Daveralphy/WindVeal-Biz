import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/', async (request) => {
    const { organizationId } = request.user!;

    const [applicants, jobs, interviews, offers] = await Promise.all([
      prisma.applicant.findMany({
        where: { organizationId },
        include: {
          currentStage: { select: { name: true } },
          aiReport: { select: { overallScore: true } },
          job: { select: { title: true } },
        },
      }),
      prisma.job.count({ where: { organizationId, status: 'ACTIVE' } }),
      prisma.interview.findMany({
        where: { job: { organizationId } },
      }),
      prisma.offer.findMany({
        where: { job: { organizationId } },
      }),
    ]);

    const totalApplicants = applicants.length;
    const hired = applicants.filter((a) => a.currentStage.name === 'Hired').length;
    const offerAcceptRate = offers.length > 0
      ? Math.round((offers.filter((o) => o.status === 'SIGNED').length / offers.length) * 100)
      : 0;

    // Pipeline funnel
    const stageCounts: Record<string, number> = {};
    for (const a of applicants) {
      const name = a.currentStage.name;
      stageCounts[name] = (stageCounts[name] || 0) + 1;
    }

    const stageOrder = ['Applied', 'Screening', 'Interview', 'Technical', 'Offer Sent', 'Hired'];
    const pipelineFunnel = stageOrder.map((stage) => ({
      stage,
      count: stageCounts[stage] || 0,
    }));

    // Add percent relative to max
    const maxCount = Math.max(1, ...pipelineFunnel.map((s) => s.count));
    const pipelineWithPercent = pipelineFunnel.map((s) => ({
      ...s,
      percent: Math.round((s.count / maxCount) * 100),
    }));

    // Source distribution
    const sourceCounts: Record<string, number> = {};
    for (const a of applicants) {
      const source = a.source || 'Other';
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    }
    const sourceTotal = Math.max(1, totalApplicants);
    const sourceMap: Record<string, string> = {
      PORTAL: 'Careers Page',
      MANUAL: 'Manual Entry',
      IMPORTED: 'Imported',
      REFERRAL: 'Referral',
    };
    const sourceDistribution = Object.entries(sourceCounts).map(([source, count]) => ({
      source: sourceMap[source] || source,
      count,
      percent: Math.round((count / sourceTotal) * 100),
    }));

    return {
      stats: {
        totalApplicants,
        openPositions: jobs,
        hired,
        offerAcceptRate,
      },
      pipelineFunnel: pipelineWithPercent,
      sourceDistribution,
    };
  });
}

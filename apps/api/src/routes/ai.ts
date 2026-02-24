import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { generateDashboardInsights } from '../services/groqService.js';

export async function aiRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // GET /api/ai/insights — AI-generated dashboard insights
  app.get('/insights', async (request) => {
    const { organizationId } = request.user!;

    // Gather context data for AI
    const [applicantsWithScores, activeJobs, pendingReview] = await Promise.all([
      prisma.applicant.findMany({
        where: { organizationId },
        include: {
          aiReport: true,
          job: { select: { id: true, title: true } },
        },
      }),
      prisma.job.count({ where: { organizationId, status: 'ACTIVE' } }),
      prisma.applicant.count({
        where: {
          organizationId,
          currentStage: { name: { in: ['Applied', 'New'] } },
        },
      }),
    ]);

    // Build context for AI
    const scored = applicantsWithScores.filter((a) => a.aiReport);
    const avgScore = scored.length > 0
      ? Math.round(scored.reduce((sum, a) => sum + (a.aiReport?.overallScore || 0), 0) / scored.length)
      : 0;

    // Top candidates (score >= 80, recommend ADVANCE)
    const topCandidates = scored
      .filter((a) => a.aiReport && a.aiReport.overallScore >= 80)
      .sort((a, b) => (b.aiReport?.overallScore || 0) - (a.aiReport?.overallScore || 0))
      .slice(0, 5)
      .map((a) => ({
        name: `${a.firstName} ${a.lastName}`,
        score: a.aiReport!.overallScore,
        jobTitle: a.job.title,
        recommendation: a.aiReport!.recommendation,
      }));

    // Low quality pools (jobs where avg score < 50)
    const jobScores = new Map<string, { title: string; scores: number[] }>();
    for (const a of scored) {
      const entry = jobScores.get(a.jobId) || { title: a.job.title, scores: [] };
      entry.scores.push(a.aiReport!.overallScore);
      jobScores.set(a.jobId, entry);
    }
    const lowQualityPools = [...jobScores.entries()]
      .map(([, v]) => ({
        jobTitle: v.title,
        avgScore: Math.round(v.scores.reduce((s, x) => s + x, 0) / v.scores.length),
        count: v.scores.length,
      }))
      .filter((p) => p.avgScore < 50);

    // Cross-role matches from AI reports
    const crossRoleMatches: { name: string; appliedJob: string; suggestedJob: string; matchPercent: number }[] = [];
    for (const a of scored) {
      const suggestions = a.aiReport?.crossRoleSuggestions as Array<{ jobId: string; matchPercent: number }> | null;
      if (suggestions && Array.isArray(suggestions)) {
        for (const s of suggestions) {
          const job = await prisma.job.findUnique({ where: { id: s.jobId }, select: { title: true } });
          if (job) {
            crossRoleMatches.push({
              name: `${a.firstName} ${a.lastName}`,
              appliedJob: a.job.title,
              suggestedJob: job.title,
              matchPercent: s.matchPercent,
            });
          }
        }
      }
    }

    const insights = await generateDashboardInsights({
      topCandidates,
      lowQualityPools,
      crossRoleMatches,
      stats: {
        totalApplicants: applicantsWithScores.length,
        activeJobs,
        pendingReview,
        avgScore,
      },
    });

    // Log AI usage
    await prisma.aIUsageLog.create({
      data: {
        userId: request.user!.userId,
        organizationId,
        type: 'AI_INSIGHTS',
        model: 'llama-3.1-8b-instant',
        success: true,
      },
    }).catch(() => {});

    return { insights, aiEnabled: true };
  });
}

import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export async function careersRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // Careers page dashboard data
  app.get('/', async (request) => {
    const { organizationId } = request.user!;

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { slug: true },
    });

    const [publishedJobs, totalApplicants] = await Promise.all([
      prisma.job.findMany({
        where: { organizationId, status: 'ACTIVE', visibility: 'PORTAL' },
        select: {
          id: true,
          title: true,
          department: true,
          location: true,
          type: true,
          createdAt: true,
          _count: { select: { applicants: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.applicant.count({ where: { organizationId, source: 'PORTAL' } }),
    ]);

    return {
      slug: org?.slug || '',
      publishedCount: publishedJobs.length,
      totalApplications: totalApplicants,
      jobs: publishedJobs.map((j) => ({
        id: j.id,
        title: j.title,
        department: j.department,
        location: j.location,
        type: j.type,
        createdAt: j.createdAt,
        applicantCount: j._count.applicants,
      })),
    };
  });
}

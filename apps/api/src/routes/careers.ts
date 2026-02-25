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

// Public careers routes — no auth required
export async function publicCareersRoutes(app: FastifyInstance) {
  // GET /api/public/careers/:slug — list published jobs for an org
  app.get<{ Params: { slug: string } }>('/:slug', async (request, reply) => {
    const { slug } = request.params;

    const org = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, website: true, industry: true },
    });

    if (!org) {
      return reply.status(404).send({ error: 'Organization not found' });
    }

    const jobs = await prisma.job.findMany({
      where: { organizationId: org.id, status: 'ACTIVE', visibility: 'PORTAL' },
      select: {
        id: true,
        title: true,
        department: true,
        location: true,
        type: true,
        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
        showSalary: true,
        description: true,
        requirements: true,
        niceToHave: true,
        deadline: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      organization: {
        name: org.name,
        slug: org.slug,
        website: org.website,
        industry: org.industry,
      },
      jobs,
    };
  });

  // GET /api/public/careers/:slug/jobs/:jobId — single job detail
  app.get<{ Params: { slug: string; jobId: string } }>('/:slug/jobs/:jobId', async (request, reply) => {
    const { slug, jobId } = request.params;

    const org = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true },
    });

    if (!org) {
      return reply.status(404).send({ error: 'Organization not found' });
    }

    const job = await prisma.job.findFirst({
      where: { id: jobId, organizationId: org.id, status: 'ACTIVE', visibility: 'PORTAL' },
      select: {
        id: true,
        title: true,
        department: true,
        location: true,
        type: true,
        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
        showSalary: true,
        description: true,
        responsibilities: true,
        requirements: true,
        niceToHave: true,
        deadline: true,
        createdAt: true,
      },
    });

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    return { organization: { name: org.name, slug: org.slug }, job };
  });

  // POST /api/public/careers/:slug/jobs/:jobId/apply — submit an application
  app.post<{ Params: { slug: string; jobId: string } }>('/:slug/jobs/:jobId/apply', async (request, reply) => {
    const { slug, jobId } = request.params;

    const org = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!org) {
      return reply.status(404).send({ error: 'Organization not found' });
    }

    const job = await prisma.job.findFirst({
      where: { id: jobId, organizationId: org.id, status: 'ACTIVE', visibility: 'PORTAL' },
      select: { id: true, pipelineStages: { orderBy: { order: 'asc' }, take: 1, select: { id: true } } },
    });

    if (!job) {
      return reply.status(404).send({ error: 'Job not found or no longer accepting applications' });
    }

    const body = request.body as {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      linkedinUrl?: string;
      coverLetter?: string;
    };

    if (!body.firstName || !body.lastName || !body.email) {
      return reply.status(400).send({ error: 'First name, last name, and email are required' });
    }

    // Check for duplicate application
    const existing = await prisma.applicant.findFirst({
      where: { jobId, email: body.email },
    });

    if (existing) {
      return reply.status(409).send({ error: 'You have already applied for this position' });
    }

    const firstStageId = job.pipelineStages[0]?.id;
    if (!firstStageId) {
      return reply.status(500).send({ error: 'This job is not properly configured for applications' });
    }

    const applicant = await prisma.applicant.create({
      data: {
        organizationId: org.id,
        jobId,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone || null,
        linkedinUrl: body.linkedinUrl || null,
        source: 'PORTAL',
        currentStageId: firstStageId,
      },
    });

    // Store cover letter as application data if provided
    if (body.coverLetter) {
      await prisma.applicationData.create({
        data: {
          applicantId: applicant.id,
          fieldId: 'cover_letter',
          value: body.coverLetter,
        },
      });
    }

    return reply.status(201).send({
      message: 'Application submitted successfully',
      applicationId: applicant.id,
    });
  });
}

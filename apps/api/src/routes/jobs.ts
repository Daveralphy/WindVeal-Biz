import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const createJobSchema = z.object({
  title: z.string().min(1),
  department: z.string().optional(),
  type: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'VOLUNTEER']).default('FULL_TIME'),
  location: z.string().optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  salaryCurrency: z.string().min(1).max(5).default('NGN'),
  showSalary: z.boolean().default(false),
  companyDescription: z.string().optional(),
  description: z.string().min(1),
  responsibilities: z.string().optional(),
  requirements: z.string().optional(),
  niceToHave: z.string().optional(),
  deadline: z.string().datetime().optional(),
  aiScreeningEnabled: z.boolean().default(true),
  aiScoreThreshold: z.number().min(0).max(100).optional(),
  aiKeywords: z.array(z.string()).optional(),
  visibility: z.enum(['PORTAL', 'INTERNAL', 'DRAFT']).default('PORTAL'),
  pipelineStages: z.array(z.string()).optional(),
});

const DEFAULT_STAGES = [
  'Applied', 'Screening', 'Initial Interview', 'Group Call',
  'Technical Assessment', 'Final Interview', 'Offer Sent', 'Hired', 'Rejected',
];

const STAGE_COLORS: Record<string, string> = {
  'Applied': '#6B7280',
  'Screening': '#3B82F6',
  'Initial Interview': '#F59E0B',
  'Group Call': '#8B5CF6',
  'Technical Assessment': '#EC4899',
  'Final Interview': '#F97316',
  'Offer Sent': '#10B981',
  'Hired': '#22C55E',
  'Rejected': '#EF4444',
};

export async function jobRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // List jobs
  app.get('/', async (request) => {
    const { organizationId } = request.user!;
    const jobs = await prisma.job.findMany({
      where: { organizationId },
      include: {
        _count: { select: { applicants: true } },
        pipelineStages: { orderBy: { order: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return jobs.map((job) => ({
      id: job.id,
      title: job.title,
      department: job.department,
      type: job.type,
      location: job.location,
      status: job.status,
      deadline: job.deadline,
      applicantCount: job._count.applicants,
      createdAt: job.createdAt,
    }));
  });

  // Get single job
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { organizationId } = request.user!;
    const job = await prisma.job.findFirst({
      where: { id: request.params.id, organizationId },
      include: {
        pipelineStages: { orderBy: { order: 'asc' } },
        applicants: {
          include: { currentStage: true, aiReport: true },
          orderBy: { createdAt: 'desc' },
        },
        applicationForm: true,
        _count: { select: { applicants: true } },
      },
    });

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    return job;
  });

  // Create job
  app.post('/', async (request, reply) => {
    const parsed = createJobSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const { pipelineStages, deadline, ...data } = parsed.data;
    const { userId, organizationId } = request.user!;
    const stages = pipelineStages?.length ? pipelineStages : DEFAULT_STAGES;

    const job = await prisma.job.create({
      data: {
        ...data,
        deadline: deadline ? new Date(deadline) : undefined,
        organizationId,
        createdById: userId,
        status: data.visibility === 'DRAFT' ? 'DRAFT' : 'ACTIVE',
        pipelineStages: {
          create: stages.map((name, index) => ({
            name,
            order: index,
            color: STAGE_COLORS[name] || '#6B7280',
          })),
        },
      },
      include: { pipelineStages: { orderBy: { order: 'asc' } } },
    });

    return reply.status(201).send(job);
  });

  // Update job
  app.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { organizationId } = request.user!;
    const job = await prisma.job.findFirst({
      where: { id: request.params.id, organizationId },
    });

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    const body = request.body as Record<string, unknown>;
    const applicationForm = body.applicationForm as { fields?: unknown } | undefined;
    const pipelineStages = body.pipelineStages as string[] | undefined;
    const jobData = { ...body };
    delete jobData.applicationForm;
    delete jobData.pipelineStages;

    await prisma.job.update({
      where: { id: job.id },
      data: jobData,
    });

    if (applicationForm?.fields) {
      await prisma.applicationForm.upsert({
        where: { jobId: job.id },
        update: { fields: applicationForm.fields },
        create: { jobId: job.id, fields: applicationForm.fields },
      });
    }

    // Update pipeline stages if provided
    if (pipelineStages && Array.isArray(pipelineStages) && pipelineStages.length >= 3) {
      const existingStages = await prisma.pipelineStage.findMany({
        where: { jobId: job.id },
        orderBy: { order: 'asc' },
        include: { _count: { select: { applicants: true, historyFrom: true, historyTo: true } } },
      });

      const existingByName = new Map(existingStages.map((s) => [s.name, s]));
      const newNames = new Set(pipelineStages);

      // Delete stages that are no longer in the list and have no applicants
      for (const existing of existingStages) {
        if (!newNames.has(existing.name)) {
          const hasData = existing._count.applicants > 0 || existing._count.historyFrom > 0 || existing._count.historyTo > 0;
          if (!hasData) {
            await prisma.pipelineStage.delete({ where: { id: existing.id } });
          }
        }
      }

      // Upsert stages with new order
      for (let i = 0; i < pipelineStages.length; i++) {
        const name = pipelineStages[i];
        const existing = existingByName.get(name);
        if (existing) {
          await prisma.pipelineStage.update({
            where: { id: existing.id },
            data: { order: i, name },
          });
        } else {
          await prisma.pipelineStage.create({
            data: {
              jobId: job.id,
              name,
              order: i,
              color: STAGE_COLORS[name] || '#6B7280',
            },
          });
        }
      }
    }

    const updated = await prisma.job.findFirst({
      where: { id: job.id, organizationId },
      include: { applicationForm: true },
    });

    return updated;
  });

  // Delete job
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { organizationId } = request.user!;
    const job = await prisma.job.findFirst({
      where: { id: request.params.id, organizationId },
    });

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    await prisma.job.delete({ where: { id: job.id } });
    return { message: 'Job deleted' };
  });

  // Get pipeline for a job
  app.get<{ Params: { id: string } }>('/:id/pipeline', async (request, reply) => {
    const { organizationId } = request.user!;
    const job = await prisma.job.findFirst({
      where: { id: request.params.id, organizationId },
      include: {
        pipelineStages: {
          orderBy: { order: 'asc' },
          include: {
            applicants: {
              include: { aiReport: true, uploadedFiles: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    return job.pipelineStages;
  });

  // Get interviews for a job
  app.get<{ Params: { id: string } }>('/:id/interviews', async (request, reply) => {
    const { organizationId } = request.user!;
    const job = await prisma.job.findFirst({
      where: { id: request.params.id, organizationId },
      select: { id: true },
    });

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    const interviews = await prisma.interview.findMany({
      where: { jobId: job.id },
      include: {
        applicant: { select: { id: true, firstName: true, lastName: true, email: true } },
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
      type: i.type,
      scheduledAt: i.scheduledAt,
      durationMinutes: i.durationMinutes,
      meetingLink: i.meetingLink,
      status: i.status,
      groupId: i.groupId,
      interviewer: i.interviewerIds.map((id) => interviewerMap[id] || 'Unknown').join(', '),
    }));
  });
}

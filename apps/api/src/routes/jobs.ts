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
  showSalary: z.boolean().default(false),
  description: z.string().min(1),
  responsibilities: z.string().optional(),
  requirements: z.string().min(1),
  niceToHave: z.string().optional(),
  deadline: z.string().datetime().optional(),
  aiScreeningEnabled: z.boolean().default(true),
  aiScoreThreshold: z.number().min(0).max(100).optional(),
  visibility: z.enum(['PORTAL', 'INTERNAL', 'DRAFT']).default('PORTAL'),
  pipelineStages: z.array(z.string()).optional(),
});

const DEFAULT_STAGES = [
  'Applied', 'Screening', 'Phone Screen', 'Interview',
  'Technical Assessment', 'Final Interview', 'Offer Sent', 'Hired', 'Rejected',
];

const STAGE_COLORS: Record<string, string> = {
  'Applied': '#6B7280',
  'Screening': '#3B82F6',
  'Phone Screen': '#8B5CF6',
  'Interview': '#F59E0B',
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

    const updated = await prisma.job.update({
      where: { id: job.id },
      data: request.body as Record<string, unknown>,
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
}

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const addApplicantSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  linkedinUrl: z.string().url().optional(),
  jobId: z.string().min(1),
  source: z.enum(['PORTAL', 'MANUAL', 'IMPORTED', 'REFERRAL']).default('MANUAL'),
});

const updateStageSchema = z.object({
  stageId: z.string().min(1),
  note: z.string().optional(),
});

export async function applicantRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // List all applicants for the organization
  app.get('/', async (request) => {
    const { organizationId } = request.user!;
    const query = request.query as Record<string, string>;

    const where: Record<string, unknown> = { organizationId };
    if (query.jobId) where.jobId = query.jobId;
    if (query.stageId) where.currentStageId = query.stageId;
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const applicants = await prisma.applicant.findMany({
      where,
      include: {
        currentStage: true,
        job: { select: { id: true, title: true } },
        aiReport: { select: { overallScore: true, recommendation: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return applicants;
  });

  // Get single applicant
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { organizationId } = request.user!;
    const applicant = await prisma.applicant.findFirst({
      where: { id: request.params.id, organizationId },
      include: {
        currentStage: true,
        job: true,
        aiReport: true,
        uploadedFiles: true,
        stageHistory: {
          include: { fromStage: true, toStage: true, movedBy: true },
          orderBy: { movedAt: 'desc' },
        },
        notes: {
          include: { author: { select: { firstName: true, lastName: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
        },
        emailLogs: { orderBy: { sentAt: 'desc' } },
        interviews: {
          include: { scorecards: true },
          orderBy: { scheduledAt: 'desc' },
        },
        offer: true,
      },
    });

    if (!applicant) {
      return reply.status(404).send({ error: 'Applicant not found' });
    }

    return applicant;
  });

  // Add applicant manually
  app.post('/', async (request, reply) => {
    const parsed = addApplicantSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const { organizationId } = request.user!;
    const data = parsed.data;

    // Find the first pipeline stage (Applied) for this job
    const firstStage = await prisma.pipelineStage.findFirst({
      where: { jobId: data.jobId },
      orderBy: { order: 'asc' },
    });

    if (!firstStage) {
      return reply.status(400).send({ error: 'Job has no pipeline stages configured' });
    }

    const applicant = await prisma.applicant.create({
      data: {
        organizationId,
        jobId: data.jobId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        linkedinUrl: data.linkedinUrl,
        currentStageId: firstStage.id,
        source: data.source,
      },
      include: { currentStage: true, job: true },
    });

    // Create initial stage history
    await prisma.stageHistory.create({
      data: {
        applicantId: applicant.id,
        toStageId: firstStage.id,
        movedById: request.user!.userId,
      },
    });

    return reply.status(201).send(applicant);
  });

  // Update applicant stage
  app.patch<{ Params: { id: string } }>('/:id/stage', async (request, reply) => {
    const parsed = updateStageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const { organizationId, userId } = request.user!;
    const { stageId, note } = parsed.data;

    const applicant = await prisma.applicant.findFirst({
      where: { id: request.params.id, organizationId },
    });

    if (!applicant) {
      return reply.status(404).send({ error: 'Applicant not found' });
    }

    const [updated] = await prisma.$transaction([
      prisma.applicant.update({
        where: { id: applicant.id },
        data: { currentStageId: stageId },
        include: { currentStage: true },
      }),
      prisma.stageHistory.create({
        data: {
          applicantId: applicant.id,
          fromStageId: applicant.currentStageId,
          toStageId: stageId,
          movedById: userId,
          note,
        },
      }),
    ]);

    return updated;
  });

  // Add note to applicant
  app.post<{ Params: { id: string } }>('/:id/notes', async (request, reply) => {
    const { organizationId, userId } = request.user!;
    const { content } = request.body as { content: string };

    if (!content?.trim()) {
      return reply.status(400).send({ error: 'Note content is required' });
    }

    const applicant = await prisma.applicant.findFirst({
      where: { id: request.params.id, organizationId },
    });

    if (!applicant) {
      return reply.status(404).send({ error: 'Applicant not found' });
    }

    const note = await prisma.applicantNote.create({
      data: {
        applicantId: applicant.id,
        authorId: userId,
        content: content.trim(),
      },
      include: { author: { select: { firstName: true, lastName: true, avatarUrl: true } } },
    });

    return reply.status(201).send(note);
  });

  // Delete applicant
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { organizationId } = request.user!;
    const applicant = await prisma.applicant.findFirst({
      where: { id: request.params.id, organizationId },
    });

    if (!applicant) {
      return reply.status(404).send({ error: 'Applicant not found' });
    }

    await prisma.applicant.delete({ where: { id: applicant.id } });
    return { message: 'Applicant deleted' };
  });
}

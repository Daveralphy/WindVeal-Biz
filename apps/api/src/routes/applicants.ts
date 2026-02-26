import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { env } from '../config/env.js';

const addApplicantSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  linkedinUrl: z.string().url().optional(),
  jobId: z.string().min(1),
  source: z.enum(['PORTAL', 'MANUAL', 'IMPORTED', 'REFERRAL']).default('MANUAL'),
  customFields: z.array(z.object({
    label: z.string().min(1),
    value: z.string(),
  })).optional(),
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
        job: {
          include: {
            applicationForm: true,
            pipelineStages: { orderBy: { order: 'asc' } },
          },
        },
        aiReport: true,
        applicationData: true,
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

  // Add applicant manually (supports multipart with file uploads)
  app.post('/', async (request, reply) => {
    const { organizationId } = request.user!;

    let data: z.infer<typeof addApplicantSchema>;
    const uploadedFiles: Array<{ type: string; fileName: string; storageUrl: string; mimeType: string | null }> = [];

    if (request.isMultipart()) {
      const fields: Record<string, string> = {};
      await mkdir(env.UPLOAD_DIR, { recursive: true });

      for await (const part of request.parts()) {
        if (part.type === 'file') {
          const fieldType = part.fieldname; // 'resume' or 'video'
          const ext = path.extname(part.filename || '') || '';
          const safeName = `${randomUUID()}${ext}`;
          const filePath = path.join(env.UPLOAD_DIR, safeName);
          await pipeline(part.file, createWriteStream(filePath));
          uploadedFiles.push({
            type: fieldType,
            fileName: part.filename || safeName,
            storageUrl: safeName,
            mimeType: part.mimetype || null,
          });
        } else {
          fields[part.fieldname] = String(part.value ?? '');
        }
      }

      // Parse JSON body from the 'data' field
      const bodyData = fields.data ? JSON.parse(fields.data) : fields;
      const parsed = addApplicantSchema.safeParse(bodyData);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
      }
      data = parsed.data;
    } else {
      const parsed = addApplicantSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
      }
      data = parsed.data;
    }

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

    // Store custom fields as ApplicationData
    if (data.customFields && data.customFields.length > 0) {
      await prisma.applicationData.createMany({
        data: data.customFields.map((cf) => ({
          applicantId: applicant.id,
          fieldId: `custom_${cf.label.toLowerCase().replace(/\s+/g, '_')}`,
          value: cf.value,
        })),
      });
    }

    // Store uploaded files
    if (uploadedFiles.length > 0) {
      await prisma.uploadedFile.createMany({
        data: uploadedFiles.map((file) => ({
          applicantId: applicant.id,
          type: file.type,
          fileName: file.fileName,
          storageUrl: file.storageUrl,
          mimeType: file.mimeType,
        })),
      });
    }

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

  // Import applicants from CSV/Excel/JSON
  app.post('/import', async (request, reply) => {
    const { organizationId, userId } = request.user!;

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    const buffer = await data.toBuffer();
    const fileName = data.filename.toLowerCase();
    let rows: Record<string, unknown>[] = [];

    try {
      if (fileName.endsWith('.json')) {
        const parsed = JSON.parse(buffer.toString('utf-8'));
        rows = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        // CSV or Excel — SheetJS handles both
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          return reply.status(400).send({ error: 'Empty workbook' });
        }
        rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]!);
      }
    } catch {
      return reply.status(400).send({ error: 'Could not parse file. Ensure it is a valid CSV, Excel, or JSON file.' });
    }

    if (rows.length === 0) {
      return reply.status(400).send({ error: 'File contains no data rows' });
    }

    // Parse jobId from query
    const query = request.query as Record<string, string>;
    const jobId = query.jobId;
    if (!jobId) {
      return reply.status(400).send({ error: 'jobId query parameter is required' });
    }

    // Validate job belongs to org and get first stage
    const job = await prisma.job.findFirst({ where: { id: jobId, organizationId } });
    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }
    const firstStage = await prisma.pipelineStage.findFirst({
      where: { jobId },
      orderBy: { order: 'asc' },
    });
    if (!firstStage) {
      return reply.status(400).send({ error: 'Job has no pipeline stages configured' });
    }

    // Normalize field names from any common format
    const normalize = (key: string) => key.trim().toLowerCase().replace(/[\s_-]+/g, '');

    const FIELD_MAP: Record<string, string> = {
      firstname: 'firstName', first: 'firstName', givenname: 'firstName',
      lastname: 'lastName', last: 'lastName', surname: 'lastName', familyname: 'lastName',
      email: 'email', emailaddress: 'email', mail: 'email',
      phone: 'phone', phonenumber: 'phone', mobile: 'phone', tel: 'phone', telephone: 'phone',
      linkedin: 'linkedinUrl', linkedinurl: 'linkedinUrl', linkedinprofile: 'linkedinUrl',
    };

    const mapRow = (raw: Record<string, unknown>) => {
      const mapped: Record<string, string> = {};
      for (const [key, val] of Object.entries(raw)) {
        const norm = normalize(key);
        const target = FIELD_MAP[norm];
        if (target && val != null && String(val).trim()) {
          mapped[target] = String(val).trim();
        }
      }
      // Try to split "name" / "full name" into first + last
      if (!mapped.firstName || !mapped.lastName) {
        for (const [key, val] of Object.entries(raw)) {
          const norm = normalize(key);
          if ((norm === 'name' || norm === 'fullname') && val) {
            const parts = String(val).trim().split(/\s+/);
            if (!mapped.firstName) mapped.firstName = parts[0] || '';
            if (!mapped.lastName) mapped.lastName = parts.slice(1).join(' ') || parts[0] || '';
          }
        }
      }
      return mapped;
    };

    const results = { imported: 0, skipped: 0, errors: [] as string[] };

    for (let i = 0; i < rows.length; i++) {
      const mapped = mapRow(rows[i] as Record<string, unknown>);
      if (!mapped.firstName || !mapped.lastName || !mapped.email) {
        results.skipped++;
        results.errors.push(`Row ${i + 1}: Missing required fields (firstName, lastName, email)`);
        continue;
      }

      // Basic email validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mapped.email)) {
        results.skipped++;
        results.errors.push(`Row ${i + 1}: Invalid email "${mapped.email}"`);
        continue;
      }

      try {
        const applicant = await prisma.applicant.create({
          data: {
            organizationId,
            jobId,
            firstName: mapped.firstName,
            lastName: mapped.lastName,
            email: mapped.email,
            phone: mapped.phone || null,
            linkedinUrl: mapped.linkedinUrl || null,
            currentStageId: firstStage.id,
            source: 'IMPORTED',
          },
        });

        await prisma.stageHistory.create({
          data: {
            applicantId: applicant.id,
            toStageId: firstStage.id,
            movedById: userId,
          },
        });

        results.imported++;
      } catch {
        results.skipped++;
        results.errors.push(`Row ${i + 1}: Failed to import (possible duplicate)`);
      }
    }

    return reply.send(results);
  });
}

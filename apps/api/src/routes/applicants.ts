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
import { notifyOrgUsers } from '../services/notificationService.js';
import { env } from '../config/env.js';
import { screenApplicant } from '../services/groqService.js';
import { triggerAiScreenBackground } from '../services/aiScreenService.js';

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
        job: {
          select: {
            id: true,
            title: true,
            applicationForm: { select: { fields: true } },
          },
        },
        aiReport: { select: { overallScore: true, recommendation: true } },
        applicationData: { select: { fieldId: true, value: true } },
        uploadedFiles: { select: { type: true, fileName: true, storageUrl: true } },
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

    // Notify org users about the new application
    notifyOrgUsers(organizationId, 'APPLICATION_RECEIVED', {
      applicantName: `${applicant.firstName} ${applicant.lastName}`,
      jobTitle: applicant.job.title,
    }, request.user!.userId).catch(() => {});

    setImmediate(() => triggerAiScreenBackground(applicant.id).catch(console.error));
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

    // Determine if this is a backward move
    const allStages = await prisma.pipelineStage.findMany({
      where: { jobId: applicant.jobId },
      orderBy: { order: 'asc' },
    });
    const currentOrder = allStages.find((s) => s.id === applicant.currentStageId)?.order ?? 0;
    const targetOrder = allStages.find((s) => s.id === stageId)?.order ?? 0;
    const isMovingBack = targetOrder < currentOrder;

    if (isMovingBack) {
      const stageIdsToRemove = allStages
        .filter((s) => s.order > targetOrder && s.order <= currentOrder)
        .map((s) => s.id);

      // Find the earliest time the applicant entered any of those stages — used to prune emails
      const firstEntry = await prisma.stageHistory.findFirst({
        where: { applicantId: applicant.id, toStageId: { in: stageIdsToRemove } },
        orderBy: { movedAt: 'asc' },
      });
      const revertTimestamp = firstEntry?.movedAt;

      const ops = [
        prisma.applicant.update({
          where: { id: applicant.id },
          data: { currentStageId: stageId, qualified: null },
          include: { currentStage: true },
        }),
        // Delete interviews tied to the reverted stages
        prisma.interview.deleteMany({
          where: { applicantId: applicant.id, stageId: { in: stageIdsToRemove } },
        }),
        // Delete emails sent after the applicant first entered the reverted stages
        ...(revertTimestamp
          ? [prisma.emailLog.deleteMany({
              where: { applicantId: applicant.id, sentAt: { gte: revertTimestamp } },
            })]
          : []),
        // Remove any offer (becomes invalid when moving back)
        prisma.offer.deleteMany({ where: { applicantId: applicant.id } }),
        // Remove stage history for the reverted stages
        prisma.stageHistory.deleteMany({
          where: { applicantId: applicant.id, toStageId: { in: stageIdsToRemove } },
        }),
        // Record the backward move
        prisma.stageHistory.create({
          data: {
            applicantId: applicant.id,
            fromStageId: applicant.currentStageId,
            toStageId: stageId,
            movedById: userId,
            note,
          },
        }),
      ];

      const [updated] = await prisma.$transaction(ops);
      return updated;
    }

    const [updated] = await prisma.$transaction([
      prisma.applicant.update({
        where: { id: applicant.id },
        data: { currentStageId: stageId, qualified: null },
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

  // Qualify or disqualify an applicant
  app.patch<{ Params: { id: string } }>('/:id/qualify', async (request, reply) => {
    const { organizationId } = request.user!;
    const { qualified } = request.body as { qualified: boolean | null };

    if (qualified !== null && typeof qualified !== 'boolean') {
      return reply.status(400).send({ error: 'qualified must be a boolean or null' });
    }

    const applicant = await prisma.applicant.findFirst({
      where: { id: request.params.id, organizationId },
    });

    if (!applicant) {
      return reply.status(404).send({ error: 'Applicant not found' });
    }

    const updated = await prisma.applicant.update({
      where: { id: applicant.id },
      data: { qualified },
      include: { currentStage: true, job: { select: { title: true } } },
    });

    // If qualified on an offer stage, notify as offer accepted
    if (qualified === true && updated.currentStage) {
      const stageName = updated.currentStage.name.toLowerCase();
      if (stageName.includes('offer')) {
        notifyOrgUsers(organizationId, 'OFFER_SIGNED', {
          applicantName: `${updated.firstName} ${updated.lastName}`,
          jobTitle: updated.job.title,
        }, request.user!.userId).catch(() => {});
      }
    }

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

  // Update note
  app.patch<{ Params: { id: string; noteId: string } }>('/:id/notes/:noteId', async (request, reply) => {
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

    const existing = await prisma.applicantNote.findFirst({
      where: { id: request.params.noteId, applicantId: applicant.id, authorId: userId },
    });

    if (!existing) {
      return reply.status(404).send({ error: 'Note not found or not yours' });
    }

    const updated = await prisma.applicantNote.update({
      where: { id: request.params.noteId },
      data: { content: content.trim() },
      include: { author: { select: { firstName: true, lastName: true, avatarUrl: true } } },
    });

    return updated;
  });

  // Delete note
  app.delete<{ Params: { id: string; noteId: string } }>('/:id/notes/:noteId', async (request, reply) => {
    const { organizationId, userId } = request.user!;

    const applicant = await prisma.applicant.findFirst({
      where: { id: request.params.id, organizationId },
    });

    if (!applicant) {
      return reply.status(404).send({ error: 'Applicant not found' });
    }

    const existing = await prisma.applicantNote.findFirst({
      where: { id: request.params.noteId, applicantId: applicant.id, authorId: userId },
    });

    if (!existing) {
      return reply.status(404).send({ error: 'Note not found or not yours' });
    }

    await prisma.applicantNote.delete({ where: { id: request.params.noteId } });

    return { message: 'Note deleted' };
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

  // AI Screen applicant
  app.post<{ Params: { id: string } }>('/:id/ai-screen', async (request, reply) => {
    const { organizationId } = request.user!;

    const applicant = await prisma.applicant.findFirst({
      where: { id: request.params.id, organizationId },
      include: {
        job: {
          select: {
            title: true,
            description: true,
            requirements: true,
            responsibilities: true,
            niceToHave: true,
            aiKeywords: true,
            applicationForm: true,
          },
        },
        applicationData: true,
        uploadedFiles: true,
      },
    });

    if (!applicant) {
      return reply.status(404).send({ error: 'Applicant not found' });
    }

    // Build field label lookup from application form
    const formFields = (applicant.job.applicationForm?.fields as Array<{ id: string; label: string; type?: string }>) || [];
    const fieldLabelMap = new Map(formFields.map((f) => [f.id, f.label]));

    // Personal fields to exclude from AI evaluation text (but we pass identity separately)
    const personalFieldIds = new Set(['first_name', 'last_name', 'email', 'phone', 'linkedin', 'linkedin_url']);

    const applicationText = applicant.applicationData
      .filter((d) => !personalFieldIds.has(d.fieldId) && d.fieldId !== 'cover_letter')
      .map((d) => {
        const label = fieldLabelMap.get(d.fieldId) || d.fieldId;
        const val = typeof d.value === 'string' ? d.value : JSON.stringify(d.value);
        return `${label}: ${val}`;
      })
      .join('\n');

    const coverLetterData = applicant.applicationData.find((d) => d.fieldId === 'cover_letter');
    const coverLetter = coverLetterData ? String(coverLetterData.value) : '';

    // Extract text from PDF resume files
    let resumeText = '';
    const pdfFiles = applicant.uploadedFiles.filter(
      (f) => f.mimeType === 'application/pdf'
    );
    for (const pdfFile of pdfFiles) {
      try {
        const filePath = path.join(env.UPLOAD_DIR, pdfFile.storageUrl.replace(/.*[/\\]/, ''));
        const { readFile } = await import('node:fs/promises');
        const pdfParse = (await import('pdf-parse')).default;
        const dataBuffer = await readFile(filePath);
        const parsed = await pdfParse(dataBuffer);
        if (parsed.text) {
          resumeText += (resumeText ? '\n\n--- Next Document ---\n\n' : '') + parsed.text;
        }
      } catch (err) {
        console.error(`Failed to parse PDF ${pdfFile.fileName}:`, err);
      }
    }

    // Fetch LinkedIn profile data if available
    let linkedinProfileData = '';
    if (applicant.linkedinUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(applicant.linkedinUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; VealATS/1.0)',
            'Accept': 'text/html',
          },
          signal: controller.signal,
          redirect: 'follow',
        });
        clearTimeout(timeout);
        if (res.ok) {
          const html = await res.text();
          // Extract text content from HTML, stripping tags
          linkedinProfileData = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 5000);
        }
      } catch (err) {
        console.error('Failed to fetch LinkedIn profile:', err);
      }
    }

    const report = await screenApplicant({
      applicationData: applicationText,
      coverLetter,
      resumeText,
      linkedinProfileData,
      applicantName: `${applicant.firstName} ${applicant.lastName}`,
      applicantEmail: applicant.email,
      applicantPhone: applicant.phone || '',
      hasResume: applicant.uploadedFiles.some((f) => f.type === 'resume'),
      hasVideo: applicant.uploadedFiles.some((f) => f.type === 'video'),
      jobTitle: applicant.job.title,
      jobDescription: applicant.job.description,
      jobRequirements: applicant.job.requirements,
      jobResponsibilities: applicant.job.responsibilities,
      jobNiceToHave: applicant.job.niceToHave,
      aiKeywords: applicant.job.aiKeywords || [],
    });

    // Upsert AIReport
    const aiReport = await prisma.aIReport.upsert({
      where: { applicantId: applicant.id },
      update: {
        overallScore: report.overallScore,
        dimensionScores: report.dimensionScores,
        strengths: report.strengths,
        concerns: report.concerns,
        recommendation: report.recommendation,
        confidenceLevel: report.confidenceLevel,
        sectionAnalysis: report.sectionAnalysis ?? undefined,
      },
      create: {
        applicantId: applicant.id,
        overallScore: report.overallScore,
        dimensionScores: report.dimensionScores,
        strengths: report.strengths,
        concerns: report.concerns,
        recommendation: report.recommendation,
        confidenceLevel: report.confidenceLevel,
        sectionAnalysis: report.sectionAnalysis ?? undefined,
      },
    });

    return { ...aiReport, resumeAnalysis: report.resumeAnalysis };
  });

  // Delete AI report (reject analysis)
  app.delete<{ Params: { id: string } }>('/:id/ai-report', async (request, reply) => {
    const { organizationId } = request.user!;

    const applicant = await prisma.applicant.findFirst({
      where: { id: request.params.id, organizationId },
    });

    if (!applicant) {
      return reply.status(404).send({ error: 'Applicant not found' });
    }

    await prisma.aIReport.deleteMany({
      where: { applicantId: applicant.id },
    });

    return { message: 'AI report removed' };
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

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { resolveSmtpConfig, sendEmail } from '../services/emailService.js';
import { composeOfferEmail } from '../services/groqService.js';

export async function offerRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // Get offer for an applicant
  app.get('/:applicantId', async (request) => {
    const { organizationId } = request.user!;
    const { applicantId } = request.params as { applicantId: string };

    const applicant = await prisma.applicant.findFirst({
      where: { id: applicantId, organizationId },
    });
    if (!applicant) return app.httpErrors.notFound('Applicant not found');

    const offer = await prisma.offer.findUnique({
      where: { applicantId },
    });

    return offer || null;
  });

  // Create or update offer
  app.put('/:applicantId', async (request) => {
    const { organizationId } = request.user!;
    const { applicantId } = request.params as { applicantId: string };

    const schema = z.object({
      salary: z.number().int().optional(),
      startDate: z.string().optional(),
      conditions: z.string().optional(),
    });

    const data = schema.parse(request.body);

    const applicant = await prisma.applicant.findFirst({
      where: { id: applicantId, organizationId },
      include: { job: { select: { id: true } } },
    });
    if (!applicant) return app.httpErrors.notFound('Applicant not found');

    const offer = await prisma.offer.upsert({
      where: { applicantId },
      create: {
        applicantId,
        jobId: applicant.job.id,
        salary: data.salary || null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        conditions: data.conditions || null,
        status: 'DRAFT',
      },
      update: {
        salary: data.salary || null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        conditions: data.conditions || null,
      },
    });

    return offer;
  });

  // Send offer email
  app.post('/:applicantId/send', async (request) => {
    const { userId, organizationId } = request.user!;
    const { applicantId } = request.params as { applicantId: string };

    const schema = z.object({
      emailSubject: z.string().min(1),
      emailBody: z.string().min(1),
    });

    const data = schema.parse(request.body);

    const applicant = await prisma.applicant.findFirst({
      where: { id: applicantId, organizationId },
    });
    if (!applicant) return app.httpErrors.notFound('Applicant not found');

    // Update offer status to SENT
    await prisma.offer.updateMany({
      where: { applicantId },
      data: { status: 'SENT', sentAt: new Date() },
    });

    // Log the email
    await prisma.emailLog.create({
      data: {
        applicantId,
        subject: data.emailSubject,
        body: data.emailBody,
        sentById: userId,
      },
    });

    // Send via SMTP
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { smtpSettings: true },
    });

    const smtpConfig = resolveSmtpConfig(org?.smtpSettings as any);
    let emailSent = false;
    if (smtpConfig && applicant.email) {
      try {
        await sendEmail(smtpConfig, {
          to: applicant.email,
          subject: data.emailSubject,
          html: data.emailBody,
        });
        emailSent = true;
      } catch (err) {
        console.error('Failed to send offer email:', err);
      }
    }

    return { success: true, emailSent };
  });

  // Compose offer email with AI
  app.post('/compose-email', async (request) => {
    const { userId, organizationId } = request.user!;

    const schema = z.object({
      applicantId: z.string().min(1),
      jobId: z.string().min(1),
      salary: z.number().int().optional(),
      startDate: z.string().optional(),
      conditions: z.string().optional(),
    });

    const data = schema.parse(request.body);

    const [applicant, job, user, org] = await Promise.all([
      prisma.applicant.findFirst({
        where: { id: data.applicantId, organizationId },
        select: { firstName: true, lastName: true },
      }),
      prisma.job.findFirst({
        where: { id: data.jobId, organizationId },
        select: { title: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      }),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      }),
    ]);

    if (!applicant || !job) {
      return app.httpErrors.notFound('Applicant or job not found');
    }

    const result = await composeOfferEmail({
      candidateFirstName: applicant.firstName,
      candidateLastName: applicant.lastName,
      jobTitle: job.title,
      companyName: org?.name || 'Our Company',
      salary: data.salary,
      startDate: data.startDate ? new Date(data.startDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }) : null,
      conditions: data.conditions,
      senderName: user ? `${user.firstName} ${user.lastName}` : 'Hiring Team',
    });

    return result;
  });
}

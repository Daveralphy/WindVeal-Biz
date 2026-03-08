import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { composeInterviewEmail } from '../services/groqService.js';
import { resolveSmtpConfig, sendEmail, verifySmtpConnection } from '../services/emailService.js';
import { notifyOrgUsers } from '../services/notificationService.js';

const scheduleInterviewSchema = z.object({
  applicantId: z.string().min(1),
  jobId: z.string().min(1),
  stageId: z.string().min(1).optional(),
  scheduledAt: z.string().min(1),
  durationMinutes: z.number().int().min(15).max(480).default(60),
  medium: z.enum(['teams', 'google_meet', 'zoom']),
  meetingLink: z.string().url().optional().or(z.literal('')),
  emailSubject: z.string().min(1),
  emailBody: z.string().min(1),
});

export async function interviewRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // Update interview status
  app.patch('/:id/status', async (request) => {
    const { organizationId } = request.user!;
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };

    const valid = ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'PASSED'];
    if (!valid.includes(status)) return app.httpErrors.badRequest('Invalid status');

    const interview = await prisma.interview.findFirst({
      where: { id, job: { organizationId } },
    });
    if (!interview) return app.httpErrors.notFound('Interview not found');

    const updated = await prisma.interview.update({ where: { id }, data: { status: status as any } });
    return updated;
  });

  // Edit an interview (reschedule)
  app.patch('/:id', async (request) => {
    const { userId, organizationId } = request.user!;
    const { id } = request.params as { id: string };

    const editSchema = z.object({
      scheduledAt: z.string().min(1).optional(),
      durationMinutes: z.number().int().min(15).max(480).optional(),
      medium: z.enum(['teams', 'google_meet', 'zoom']).optional(),
      meetingLink: z.string().url().optional().or(z.literal('')),
      emailSubject: z.string().min(1).optional(),
      emailBody: z.string().min(1).optional(),
    });

    const data = editSchema.parse(request.body);

    const interview = await prisma.interview.findFirst({
      where: { id, job: { organizationId } },
      include: { applicant: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
    if (!interview) return app.httpErrors.notFound('Interview not found');

    const updateData: Record<string, unknown> = {};
    if (data.scheduledAt) updateData.scheduledAt = new Date(data.scheduledAt);
    if (data.durationMinutes) updateData.durationMinutes = data.durationMinutes;
    if (data.meetingLink !== undefined) updateData.meetingLink = data.meetingLink || null;
    if (data.medium) updateData.notes = `Medium: ${data.medium}`;

    const updated = await prisma.interview.update({ where: { id }, data: updateData });

    // Send updated email if provided
    let emailSent = false;
    if (data.emailSubject && data.emailBody) {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { smtpSettings: true },
      });

      await prisma.emailLog.create({
        data: {
          applicantId: interview.applicantId,
          subject: data.emailSubject,
          body: data.emailBody,
          sentById: userId,
        },
      });

      const smtpConfig = resolveSmtpConfig(org?.smtpSettings as any);
      if (smtpConfig && interview.applicant.email) {
        try {
          await sendEmail(smtpConfig, {
            to: interview.applicant.email,
            subject: data.emailSubject,
            html: data.emailBody,
          });
          emailSent = true;
        } catch (err) {
          console.error('Failed to send interview update email:', err);
        }
      }
    }

    return { ...updated, emailSent };
  });

  // Delete an interview
  app.delete('/:id', async (request) => {
    const { organizationId } = request.user!;
    const { id } = request.params as { id: string };

    const interview = await prisma.interview.findFirst({
      where: { id, job: { organizationId } },
    });
    if (!interview) return app.httpErrors.notFound('Interview not found');

    await prisma.interview.delete({ where: { id } });
    return { success: true };
  });

  // List interviews
  app.get('/', async (request) => {
    const { organizationId } = request.user!;

    // Auto-expire past scheduled interviews
    const now = new Date();
    await prisma.interview.updateMany({
      where: {
        job: { organizationId },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        scheduledAt: { lt: now },
      },
      data: { status: 'PASSED' },
    });

    const interviews = await prisma.interview.findMany({
      where: { job: { organizationId } },
      include: {
        applicant: { select: { firstName: true, lastName: true, email: true } },
        job: { select: { title: true } },
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
      stageId: i.stageId,
      candidateName: `${i.applicant.firstName} ${i.applicant.lastName}`,
      candidateEmail: i.applicant.email,
      jobTitle: i.job.title,
      type: i.type,
      scheduledAt: i.scheduledAt,
      durationMinutes: i.durationMinutes,
      location: i.location,
      meetingLink: i.meetingLink,
      status: i.status,
      notes: i.notes,
      interviewer: i.interviewerIds.map((id) => interviewerMap[id] || 'Unknown').join(', '),
    }));
  });

  // Get applicants at the Interview pipeline stage
  app.get('/candidates', async (request) => {
    const { organizationId } = request.user!;

    const applicants = await prisma.applicant.findMany({
      where: {
        organizationId,
        currentStage: { name: { contains: 'Interview', mode: 'insensitive' } },
      },
      include: {
        currentStage: true,
        job: { select: { id: true, title: true } },
        aiReport: { select: { overallScore: true, recommendation: true } },
        interviews: {
          select: { id: true, scheduledAt: true, status: true },
          orderBy: { scheduledAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return applicants;
  });

  // ── SMTP / Email Settings ──────────────────────────────

  // Get email settings
  app.get('/email-settings', async (request) => {
    const { organizationId } = request.user!;
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { smtpSettings: true },
    });

    const settings = (org?.smtpSettings as Record<string, unknown>) || null;
    if (!settings) return { configured: false };

    return {
      configured: true,
      host: settings.host || '',
      port: settings.port || 587,
      user: settings.user || '',
      fromName: settings.fromName || '',
      fromEmail: settings.fromEmail || '',
      // Never return the password
    };
  });

  // Save email settings
  app.put('/email-settings', async (request) => {
    const { organizationId } = request.user!;

    const schema = z.object({
      host: z.string().min(1),
      port: z.coerce.number().int().min(1).max(65535),
      user: z.string().min(1),
      pass: z.string().min(1),
      fromName: z.string().optional(),
      fromEmail: z.string().email().optional(),
    });

    const data = schema.parse(request.body);

    await prisma.organization.update({
      where: { id: organizationId },
      data: { smtpSettings: data },
    });

    return { success: true };
  });

  // Test SMTP connection
  app.post('/email-settings/test', async (request) => {
    const { organizationId } = request.user!;

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { smtpSettings: true },
    });

    const smtpConfig = resolveSmtpConfig(org?.smtpSettings as any);
    if (!smtpConfig) {
      return app.httpErrors.badRequest('No email settings configured');
    }

    try {
      await verifySmtpConnection(smtpConfig);
      return { success: true, message: 'Connection successful' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Connection failed' };
    }
  });

  // Schedule a new interview (individual)
  app.post('/', async (request) => {
    const { userId, organizationId } = request.user!;
    const data = scheduleInterviewSchema.parse(request.body);

    // Verify applicant belongs to the organization
    const applicant = await prisma.applicant.findFirst({
      where: { id: data.applicantId, organizationId },
    });
    if (!applicant) {
      return app.httpErrors.notFound('Applicant not found');
    }

    // Get org for SMTP settings
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { smtpSettings: true, name: true },
    });

    const result = await prisma.$transaction(async (tx) => {
      const interview = await tx.interview.create({
        data: {
          applicantId: data.applicantId,
          jobId: data.jobId,
          stageId: data.stageId || null,
          type: 'VIDEO_CALL',
          scheduledAt: new Date(data.scheduledAt),
          durationMinutes: data.durationMinutes,
          meetingLink: data.meetingLink || null,
          notes: `Medium: ${data.medium}`,
          interviewerIds: [userId],
          status: 'SCHEDULED',
        },
      });

      // Save email log
      await tx.emailLog.create({
        data: {
          applicantId: data.applicantId,
          subject: data.emailSubject,
          body: data.emailBody,
          sentById: userId,
        },
      });

      return interview;
    });

    // Actually send the email via SMTP  (best-effort, don't fail the schedule)
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
        console.error('Failed to send interview email:', err);
      }
    }

    // Notify org users about the scheduled interview
    const scheduledDate = new Date(data.scheduledAt);
    notifyOrgUsers(organizationId, 'INTERVIEW_SCHEDULED', {
      applicantName: `${applicant.firstName} ${applicant.lastName}`,
      jobTitle: result.jobId,
      time: scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
    }, userId).catch(() => {});

    return { ...result, emailSent };
  });

  // Schedule a group interview (multiple applicants, same meeting)
  app.post('/group', async (request) => {
    const { userId, organizationId } = request.user!;

    const groupSchema = z.object({
      applicantIds: z.array(z.string().min(1)).min(1),
      jobId: z.string().min(1),
      stageId: z.string().min(1).optional(),
      scheduledAt: z.string().min(1),
      durationMinutes: z.number().int().min(15).max(480).default(60),
      medium: z.enum(['teams', 'google_meet', 'zoom']),
      meetingLink: z.string().url().optional().or(z.literal('')),
      emailSubject: z.string().min(1),
      emailBody: z.string().min(1),
    });

    const data = groupSchema.parse(request.body);

    // Verify all applicants belong to the organization
    const applicants = await prisma.applicant.findMany({
      where: { id: { in: data.applicantIds }, organizationId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (applicants.length !== data.applicantIds.length) {
      return app.httpErrors.badRequest('Some applicants were not found');
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { smtpSettings: true, name: true },
    });

    const groupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const results = await prisma.$transaction(async (tx) => {
      const interviews = [];
      for (const applicant of applicants) {
        const interview = await tx.interview.create({
          data: {
            applicantId: applicant.id,
            jobId: data.jobId,
            stageId: data.stageId || null,
            groupId,
            type: 'VIDEO_CALL',
            scheduledAt: new Date(data.scheduledAt),
            durationMinutes: data.durationMinutes,
            meetingLink: data.meetingLink || null,
            notes: `Medium: ${data.medium} | Group Interview`,
            interviewerIds: [userId],
            status: 'SCHEDULED',
          },
        });

        // Personalize the email body by replacing placeholders
        const personalizedBody = data.emailBody
          .replace(/\{\{firstName\}\}/g, applicant.firstName)
          .replace(/\{\{lastName\}\}/g, applicant.lastName)
          .replace(/\{\{fullName\}\}/g, `${applicant.firstName} ${applicant.lastName}`);

        const personalizedSubject = data.emailSubject
          .replace(/\{\{firstName\}\}/g, applicant.firstName)
          .replace(/\{\{lastName\}\}/g, applicant.lastName)
          .replace(/\{\{fullName\}\}/g, `${applicant.firstName} ${applicant.lastName}`);

        await tx.emailLog.create({
          data: {
            applicantId: applicant.id,
            subject: personalizedSubject,
            body: personalizedBody,
            sentById: userId,
          },
        });

        interviews.push({ interview, applicant });
      }
      return interviews;
    });

    // Send emails (best-effort)
    const smtpConfig = resolveSmtpConfig(org?.smtpSettings as any);
    let emailsSent = 0;
    if (smtpConfig) {
      for (const { interview, applicant } of results) {
        try {
          const personalizedBody = data.emailBody
            .replace(/\{\{firstName\}\}/g, applicant.firstName)
            .replace(/\{\{lastName\}\}/g, applicant.lastName)
            .replace(/\{\{fullName\}\}/g, `${applicant.firstName} ${applicant.lastName}`);

          await sendEmail(smtpConfig, {
            to: applicant.email,
            subject: data.emailSubject
              .replace(/\{\{firstName\}\}/g, applicant.firstName)
              .replace(/\{\{lastName\}\}/g, applicant.lastName)
              .replace(/\{\{fullName\}\}/g, `${applicant.firstName} ${applicant.lastName}`),
            html: personalizedBody,
          });
          emailsSent++;
        } catch (err) {
          console.error(`Failed to send group interview email to ${applicant.email}:`, err);
        }
      }
    }

    return {
      groupId,
      interviewCount: results.length,
      emailsSent,
    };
  });

  // Compose interview email with AI
  app.post('/compose-email', async (request) => {
    const { userId, organizationId } = request.user!;

    const schema = z.object({
      applicantId: z.string().min(1),
      jobId: z.string().min(1),
      scheduledAt: z.string().min(1),
      durationMinutes: z.number().int().min(15),
      platform: z.string().min(1),
      meetingLink: z.string().optional(),
      stageName: z.string().optional(),
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

    const PLATFORM_LABELS: Record<string, string> = {
      google_meet: 'Google Meet',
      teams: 'Microsoft Teams',
      zoom: 'Zoom',
    };

    const scheduledDate = new Date(data.scheduledAt);
    const dateStr = scheduledDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = scheduledDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const result = await composeInterviewEmail({
      candidateFirstName: applicant.firstName,
      candidateLastName: applicant.lastName,
      jobTitle: job.title,
      companyName: org?.name || 'Our Company',
      scheduledDate: dateStr,
      scheduledTime: timeStr,
      durationMinutes: data.durationMinutes,
      platform: PLATFORM_LABELS[data.platform] || data.platform,
      meetingLink: data.meetingLink || '(to be provided)',
      interviewerName: user ? `${user.firstName} ${user.lastName}` : 'Hiring Team',
      stageName: data.stageName,
    });

    return result;
  });

  // Get email logs for an applicant
  app.get('/emails/:applicantId', async (request) => {
    const { organizationId } = request.user!;
    const { applicantId } = request.params as { applicantId: string };

    const applicant = await prisma.applicant.findFirst({
      where: { id: applicantId, organizationId },
      select: { id: true },
    });
    if (!applicant) return app.httpErrors.notFound('Applicant not found');

    const emails = await prisma.emailLog.findMany({
      where: { applicantId },
      include: {
        sentBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { sentAt: 'desc' },
    });

    return emails.map((e) => ({
      id: e.id,
      subject: e.subject,
      body: e.body,
      sentBy: e.sentBy ? `${e.sentBy.firstName} ${e.sentBy.lastName}` : 'System',
      sentAt: e.sentAt,
    }));
  });
}

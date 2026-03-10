import path from 'node:path';
import prisma from '../lib/prisma.js';
import { env } from '../config/env.js';
import { screenApplicant } from './groqService.js';

/**
 * Runs AI screening for an applicant in the background.
 * Reads all submitted files (PDFs), application data, cover letter,
 * and optionally LinkedIn profile, then generates and stores an AI report.
 */
export async function triggerAiScreenBackground(applicantId: string): Promise<void> {
  const applicant = await prisma.applicant.findUnique({
    where: { id: applicantId },
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

  if (!applicant) return;

  const formFields =
    (applicant.job.applicationForm?.fields as Array<{ id: string; label: string }>) || [];
  const fieldLabelMap = new Map(formFields.map((f) => [f.id, f.label]));
  const personalFieldIds = new Set([
    'first_name', 'last_name', 'email', 'phone', 'linkedin', 'linkedin_url',
  ]);

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

  // Extract text from all uploaded PDF files
  let resumeText = '';
  const pdfFiles = applicant.uploadedFiles.filter((f) => f.mimeType === 'application/pdf');
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
      console.error(`AI screen: failed to parse PDF ${pdfFile.fileName}:`, err);
    }
  }

  // Optionally fetch LinkedIn profile text
  let linkedinProfileData = '';
  if (applicant.linkedinUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(applicant.linkedinUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; VealATS/1.0)',
          Accept: 'text/html',
        },
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timeout);
      if (res.ok) {
        const html = await res.text();
        linkedinProfileData = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 5000);
      }
    } catch (err) {
      console.error('AI screen: failed to fetch LinkedIn profile:', err);
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

  await prisma.aIReport.upsert({
    where: { applicantId },
    update: {
      overallScore: report.overallScore,
      dimensionScores: report.dimensionScores,
      strengths: report.strengths,
      concerns: report.concerns,
      recommendation: report.recommendation,
      confidenceLevel: report.confidenceLevel,
    },
    create: {
      applicantId,
      overallScore: report.overallScore,
      dimensionScores: report.dimensionScores,
      strengths: report.strengths,
      concerns: report.concerns,
      recommendation: report.recommendation,
      confidenceLevel: report.confidenceLevel,
    },
  });
}

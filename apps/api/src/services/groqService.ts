import Groq from 'groq-sdk';
import { env } from '../config/env.js';

const groq = env.GROQ_API_KEY
  ? new Groq({ apiKey: env.GROQ_API_KEY })
  : null;

interface AIDashboardInsight {
  title: string;
  description: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
}

interface InsightContext {
  topCandidates: { name: string; score: number; jobTitle: string; recommendation: string }[];
  lowQualityPools: { jobTitle: string; avgScore: number; count: number }[];
  crossRoleMatches: { name: string; appliedJob: string; suggestedJob: string; matchPercent: number }[];
  stats: { totalApplicants: number; activeJobs: number; pendingReview: number; avgScore: number };
}

export async function generateDashboardInsights(context: InsightContext): Promise<AIDashboardInsight[]> {
  if (!groq) {
    return getFallbackInsights(context);
  }

  try {
    const prompt = buildInsightPrompt(context);

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are VealAI, an intelligent ATS assistant for talent acquisition teams. Analyze recruiting data and provide actionable insights. Always respond with valid JSON array only — no markdown, no explanation. Each insight object must have: title (string, max 40 chars), description (string, max 120 chars), action (string, max 20 chars), priority ("high"|"medium"|"low"). Return exactly 3 insights.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const text = completion.choices[0]?.message?.content?.trim() || '';
    const parsed = JSON.parse(text);

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 3).map((item: Record<string, unknown>) => ({
        title: String(item.title || 'Insight').slice(0, 60),
        description: String(item.description || '').slice(0, 200),
        action: String(item.action || 'View').slice(0, 30),
        priority: ['high', 'medium', 'low'].includes(String(item.priority)) ? String(item.priority) as 'high' | 'medium' | 'low' : 'medium',
      }));
    }

    return getFallbackInsights(context);
  } catch (err) {
    console.error('Groq AI error, using fallback insights:', err);
    return getFallbackInsights(context);
  }
}

function buildInsightPrompt(ctx: InsightContext): string {
  const parts: string[] = [];

  parts.push(`Recruiting dashboard data summary:`);
  parts.push(`- ${ctx.stats.totalApplicants} total applicants across ${ctx.stats.activeJobs} active jobs`);
  parts.push(`- ${ctx.stats.pendingReview} applicants pending review`);
  parts.push(`- Average AI score: ${ctx.stats.avgScore}%`);

  if (ctx.topCandidates.length > 0) {
    parts.push(`\nTop candidates:`);
    for (const c of ctx.topCandidates.slice(0, 5)) {
      parts.push(`- ${c.name}: ${c.score}% match for ${c.jobTitle} (${c.recommendation})`);
    }
  }

  if (ctx.lowQualityPools.length > 0) {
    parts.push(`\nLow quality talent pools (avg score < 50%):`);
    for (const p of ctx.lowQualityPools) {
      parts.push(`- ${p.jobTitle}: avg ${p.avgScore}% across ${p.count} applicants`);
    }
  }

  if (ctx.crossRoleMatches.length > 0) {
    parts.push(`\nCross-role match opportunities:`);
    for (const m of ctx.crossRoleMatches.slice(0, 3)) {
      parts.push(`- ${m.name} (applied: ${m.appliedJob}) → ${m.matchPercent}% match for ${m.suggestedJob}`);
    }
  }

  parts.push(`\nProvide 3 actionable insights based on this data.`);

  return parts.join('\n');
}

function getFallbackInsights(ctx: InsightContext): AIDashboardInsight[] {
  const insights: AIDashboardInsight[] = [];

  if (ctx.topCandidates.length > 0) {
    const top = ctx.topCandidates[0];
    insights.push({
      title: 'Top Candidate Alert',
      description: `${top.name} (${top.score}% match) for ${top.jobTitle} — recommend advancing to interview.`,
      action: 'View Profile',
      priority: 'high',
    });
  }

  if (ctx.lowQualityPools.length > 0) {
    const pool = ctx.lowQualityPools[0];
    insights.push({
      title: 'Low Quality Pool',
      description: `${pool.jobTitle} role has avg score of ${pool.avgScore}%. Consider revising job requirements.`,
      action: 'View Job',
      priority: 'medium',
    });
  }

  if (ctx.crossRoleMatches.length > 0) {
    const match = ctx.crossRoleMatches[0];
    insights.push({
      title: 'Cross-Role Match',
      description: `${match.name} (applied ${match.appliedJob}) is ${match.matchPercent}% match for ${match.suggestedJob} role.`,
      action: 'Review',
      priority: 'medium',
    });
  }

  // Fill remaining slots
  if (insights.length < 3 && ctx.stats.pendingReview > 0) {
    insights.push({
      title: 'Pending Reviews',
      description: `${ctx.stats.pendingReview} applicants are awaiting review. Timely reviews improve candidate experience.`,
      action: 'Review Now',
      priority: 'high',
    });
  }

  if (insights.length < 3) {
    insights.push({
      title: 'Pipeline Health',
      description: `${ctx.stats.totalApplicants} applicants across ${ctx.stats.activeJobs} active jobs with ${ctx.stats.avgScore}% avg AI score.`,
      action: 'View Analytics',
      priority: 'low',
    });
  }

  return insights.slice(0, 3);
}

// ─── AI Interview Email Composition ─────────────────────────────

interface ComposeEmailContext {
  candidateFirstName: string;
  candidateLastName: string;
  jobTitle: string;
  companyName: string;
  scheduledDate: string;   // e.g. "Monday, June 2, 2025"
  scheduledTime: string;   // e.g. "2:00 PM"
  durationMinutes: number;
  platform: string;        // e.g. "Google Meet"
  meetingLink: string;
  interviewerName: string;
  stageName?: string;      // e.g. "Panel Interview", "Final Review"
}

export async function composeInterviewEmail(
  context: ComposeEmailContext,
): Promise<{ subject: string; body: string }> {
  const fallback = getFallbackInterviewEmail(context);
  if (!groq) return fallback;

  try {
    const stageLabel = context.stageName || 'Interview';
    const prompt = `Write a professional interview invitation email for:
- Candidate: ${context.candidateFirstName} ${context.candidateLastName}
- Position: ${context.jobTitle}
- Company: ${context.companyName}
- Interview Stage: ${stageLabel}
- Date: ${context.scheduledDate}
- Time: ${context.scheduledTime}
- Duration: ${context.durationMinutes} minutes
- Platform: ${context.platform}
- Meeting Link: ${context.meetingLink}
- Interviewer: ${context.interviewerName}

This is a "${stageLabel}" stage interview. Tailor the tone and content to match this stage — for example, a "Final Review" or "Panel Interview" should sound different from an initial "Interview" or "Phone Screen". Mention the stage name naturally in the email. Write a warm, professional email. Include all the details above clearly. Do NOT use placeholder brackets. Use actual values provided.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are a professional HR email writer. Write interview invitation emails that are warm, clear, and informative. Tailor the email based on the interview stage — an initial interview should be welcoming, a phone screen should be casual and brief, a panel interview should mention meeting multiple team members, and a final review should convey excitement about being a top candidate. Respond with valid JSON only — no markdown, no explanation. The JSON must have: subject (string, concise email subject line that reflects the stage), body (string, the full email body as clean HTML with <p>, <strong>, <ul>, <li> tags — do NOT use markdown). The email should include: greeting by first name, context appropriate to the stage, interview details (date, time, duration, platform), meeting link as a clickable <a> tag, what to prepare for this specific stage, and a professional sign-off from the interviewer. Keep it concise but thorough.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 800,
    });

    const text = completion.choices[0]?.message?.content?.trim() || '';
    const parsed = JSON.parse(text);

    if (parsed.subject && parsed.body) {
      return {
        subject: String(parsed.subject).slice(0, 200),
        body: String(parsed.body),
      };
    }

    return fallback;
  } catch (err) {
    console.error('Groq interview email composition error:', err);
    return fallback;
  }
}

function getFallbackInterviewEmail(ctx: ComposeEmailContext): { subject: string; body: string } {
  const stageLabel = ctx.stageName || 'Interview';
  const subject = `${stageLabel} Invitation: ${ctx.jobTitle} at ${ctx.companyName}`;
  const body = `<p>Dear ${ctx.candidateFirstName},</p>

<p>We are pleased to invite you to a <strong>${stageLabel}</strong> for the <strong>${ctx.jobTitle}</strong> position at <strong>${ctx.companyName}</strong>.</p>

<p><strong>Interview Details:</strong></p>
<ul>
  <li><strong>Date:</strong> ${ctx.scheduledDate}</li>
  <li><strong>Time:</strong> ${ctx.scheduledTime}</li>
  <li><strong>Duration:</strong> ${ctx.durationMinutes} minutes</li>
  <li><strong>Platform:</strong> ${ctx.platform}</li>
  <li><strong>Meeting Link:</strong> <a href="${ctx.meetingLink}">${ctx.meetingLink}</a></li>
</ul>

<p>Please ensure you have a stable internet connection and a quiet environment for the interview. If you need to reschedule, please let us know as soon as possible.</p>

<p>We look forward to speaking with you!</p>

<p>Best regards,<br/>${ctx.interviewerName}<br/>${ctx.companyName}</p>`;

  return { subject, body };
}

interface ScreeningContext {
  applicationData: string;
  coverLetter: string;
  resumeText: string;
  linkedinProfileData: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  hasResume: boolean;
  hasVideo: boolean;
  jobTitle: string;
  jobDescription: string;
  jobRequirements: string | null;
  jobResponsibilities: string | null;
  jobNiceToHave: string | null;
  aiKeywords: string[];
}

interface AIScreeningResult {
  overallScore: number;
  dimensionScores: Record<string, number>;
  strengths: string[];
  concerns: string[];
  recommendation: string;
  confidenceLevel: string;
  resumeAnalysis: {
    score: number;
    feedback: string[];
  };
}

// ─── Full AI Applicant Screening ─────────────────────────────

export async function screenApplicant(context: ScreeningContext): Promise<AIScreeningResult> {
  if (!groq) {
    return getFallbackScreening(context);
  }

  try {
    const prompt = buildScreeningPrompt(context);

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are VealAI, a STRICT ATS screening assistant. Analyze applicant data rigorously against job requirements. You have access to the applicant's resume text (extracted from PDF), all application responses, cover letter, and LinkedIn profile data. Use ALL of this information holistically. Always respond with valid JSON only — no markdown, no explanation. The JSON must have: overallScore (0-100), dimensionScores (object with skillsMatch, experienceRelevance, communicationQuality, cultureFit, completeness, identityConsistency as 0-100 numbers), strengths (string array, max 5), concerns (string array, max 5), recommendation (one of: ADVANCE, REQUEST_INFO, CONSIDER_OTHER, REJECT), confidenceLevel (HIGH, MEDIUM, or LOW), resumeAnalysis (object with score 0-100 and feedback string array max 4).

SCORING RULES (follow strictly):
- 0-10: Applicant provided no useful information, nonsensical content, or completely irrelevant submissions (random text, jokes, unrelated documents, single phrases)
- 11-25: Very little relevant information, mostly empty or filler, no evidence of qualifications
- 26-40: Some relevant info but major gaps, few keywords matched, unclear qualifications
- 41-55: Moderate match — some relevant experience but missing important requirements
- 56-70: Good match — addresses most requirements with evidence
- 71-85: Strong match — clear evidence of most required skills and experience
- 86-100: Exceptional — addresses virtually all requirements with specific details

IDENTITY & CONSISTENCY CHECKS:
- Verify the resume contains the applicant's registered name. If the name differs, flag it as a concern and lower identityConsistency score.
- Cross-reference claims across resume, cover letter, application responses, and LinkedIn. Flag contradictions.
- Check that experience levels, job titles, and skills are consistent across all sources.

CRITICAL: If the applicant submitted irrelevant content (not a real resume, gibberish cover letter, unrelated documents), score them 0-10 regardless of other factors. Recommend REJECT for scores under 25.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const text = completion.choices[0]?.message?.content?.trim() || '';
    const parsed = JSON.parse(text);

    return {
      overallScore: Math.min(100, Math.max(0, Number(parsed.overallScore) ?? 0)),
      dimensionScores: parsed.dimensionScores || {},
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5) : [],
      concerns: Array.isArray(parsed.concerns) ? parsed.concerns.slice(0, 5) : [],
      recommendation: ['ADVANCE', 'REQUEST_INFO', 'CONSIDER_OTHER', 'REJECT'].includes(parsed.recommendation) ? parsed.recommendation : 'REJECT',
      confidenceLevel: ['HIGH', 'MEDIUM', 'LOW'].includes(parsed.confidenceLevel) ? parsed.confidenceLevel : 'LOW',
      resumeAnalysis: {
        score: Math.min(100, Math.max(0, Number(parsed.resumeAnalysis?.score) ?? 0)),
        feedback: Array.isArray(parsed.resumeAnalysis?.feedback) ? parsed.resumeAnalysis.feedback.slice(0, 4) : [],
      },
    };
  } catch (err) {
    console.error('Groq AI screening error, using fallback:', err);
    return getFallbackScreening(context);
  }
}

function buildScreeningPrompt(ctx: ScreeningContext): string {
  const parts: string[] = [];

  parts.push(`Screen this applicant for the "${ctx.jobTitle}" role.`);
  parts.push('');
  parts.push('=== JOB DETAILS ===');
  parts.push(`Title: ${ctx.jobTitle}`);
  parts.push(`Description: ${ctx.jobDescription}`);
  if (ctx.jobRequirements) parts.push(`Requirements: ${ctx.jobRequirements}`);
  if (ctx.jobResponsibilities) parts.push(`Responsibilities: ${ctx.jobResponsibilities}`);
  if (ctx.jobNiceToHave) parts.push(`Nice to have: ${ctx.jobNiceToHave}`);
  if (ctx.aiKeywords && ctx.aiKeywords.length > 0) {
    parts.push(`Key screening keywords (IMPORTANT - evaluate applicant strongly against these): ${ctx.aiKeywords.join(', ')}`);
  }

  parts.push('');
  parts.push('=== APPLICANT IDENTITY ===');
  parts.push(`Name: ${ctx.applicantName}`);
  if (ctx.applicantEmail) parts.push(`Email: ${ctx.applicantEmail}`);
  if (ctx.applicantPhone) parts.push(`Phone: ${ctx.applicantPhone}`);

  parts.push('');
  parts.push('=== APPLICANT SUBMISSION ===');

  if (ctx.resumeText) {
    parts.push('');
    parts.push('=== RESUME CONTENT (extracted from PDF) ===');
    parts.push(ctx.resumeText.slice(0, 6000));
  }

  if (ctx.applicationData) {
    parts.push('');
    parts.push('=== APPLICATION RESPONSES ===');
    parts.push(ctx.applicationData);
  }

  if (ctx.coverLetter) {
    parts.push('');
    parts.push('=== COVER LETTER ===');
    parts.push(ctx.coverLetter);
  }

  if (ctx.linkedinProfileData) {
    parts.push('');
    parts.push('=== LINKEDIN PROFILE ===');
    parts.push(ctx.linkedinProfileData.slice(0, 4000));
  }

  if (!ctx.applicationData && !ctx.coverLetter && !ctx.resumeText) {
    parts.push('No application responses, cover letter, or resume text were provided.');
  }

  parts.push('');
  parts.push('=== EVALUATION INSTRUCTIONS ===');
  parts.push('Evaluate this applicant HOLISTICALLY using ALL the data above. Specifically:');
  parts.push('1. IDENTITY VERIFICATION: Confirm the resume contains the applicant\'s name and contact details. Flag if the name on the resume does not match the applicant\'s registered name.');
  parts.push('2. CONSISTENCY CHECK: Verify that information across the resume, cover letter, application responses, and LinkedIn profile is consistent. Flag any contradictions (e.g. different job titles, date mismatches, conflicting claims).');
  parts.push('3. ROLE MATCH: Evaluate how well the applicant\'s skills, experience, and qualifications match the job requirements, responsibilities, and keywords.');
  parts.push('4. CONTENT QUALITY: Assess the quality of all written submissions — cover letter professionalism, resume completeness, application response depth.');
  parts.push('5. RED FLAGS: Note any concerns such as missing information, generic/template content, or irrelevant submissions.');
  parts.push('If there is no resume text and no meaningful application data, the score must be very low (0-10).');

  return parts.join('\n');
}

function getFallbackScreening(ctx: ScreeningContext): AIScreeningResult {
  // Simple heuristic-based scoring when AI is unavailable
  let score = 10;
  const strengths: string[] = [];
  const concerns: string[] = [];

  if (ctx.applicationData && ctx.applicationData.length > 100) { score += 15; strengths.push('Provided detailed application responses'); }
  if (ctx.coverLetter && ctx.coverLetter.length > 200) { score += 15; strengths.push('Submitted a substantial cover letter'); }
  if (ctx.hasResume) { score += 20; strengths.push('Resume uploaded'); }
  if (ctx.resumeText && ctx.resumeText.length > 100) { score += 10; strengths.push('Resume content was readable and parsed'); }
  if (ctx.hasVideo) { score += 10; strengths.push('Video introduction provided'); }
  if (ctx.linkedinProfileData) { score += 5; strengths.push('LinkedIn profile data available'); }

  if (!ctx.hasResume) concerns.push('No resume uploaded');
  if (!ctx.coverLetter) concerns.push('No cover letter provided');

  score = Math.min(100, score);

  return {
    overallScore: score,
    dimensionScores: {
      skillsMatch: score,
      experienceRelevance: Math.max(0, score - 10),
      communicationQuality: ctx.coverLetter ? Math.min(100, score + 10) : Math.max(0, score - 15),
      cultureFit: 30,
      completeness: Math.round(((ctx.hasResume ? 20 : 0) + (ctx.coverLetter ? 20 : 0) + (ctx.hasVideo ? 20 : 0) + (ctx.applicationData ? 20 : 0) + (ctx.linkedinProfileData ? 20 : 0))),
      identityConsistency: 50,
    },
    strengths,
    concerns,
    recommendation: score >= 70 ? 'ADVANCE' : score >= 50 ? 'REQUEST_INFO' : score >= 30 ? 'CONSIDER_OTHER' : 'REJECT',
    confidenceLevel: 'LOW',
    resumeAnalysis: {
      score: ctx.hasResume ? Math.min(100, score + 5) : 0,
      feedback: ctx.hasResume
        ? ['Resume was uploaded but content analysis requires AI', 'Manual review recommended']
        : ['No resume was uploaded', 'Applicant should be asked to provide a resume'],
    },
  };
}

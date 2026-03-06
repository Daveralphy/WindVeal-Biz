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
}

export async function composeInterviewEmail(
  context: ComposeEmailContext,
): Promise<{ subject: string; body: string }> {
  const fallback = getFallbackInterviewEmail(context);
  if (!groq) return fallback;

  try {
    const prompt = `Write a professional interview invitation email for:
- Candidate: ${context.candidateFirstName} ${context.candidateLastName}
- Position: ${context.jobTitle}
- Company: ${context.companyName}
- Date: ${context.scheduledDate}
- Time: ${context.scheduledTime}
- Duration: ${context.durationMinutes} minutes
- Platform: ${context.platform}
- Meeting Link: ${context.meetingLink}
- Interviewer: ${context.interviewerName}

Write a warm, professional email. Include all the details above clearly. Do NOT use placeholder brackets. Use actual values provided.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are a professional HR email writer. Write interview invitation emails that are warm, clear, and informative. Respond with valid JSON only — no markdown, no explanation. The JSON must have: subject (string, concise email subject line), body (string, the full email body as clean HTML with <p>, <strong>, <ul>, <li> tags — do NOT use markdown). The email should include: greeting by first name, congratulations on being selected, interview details (date, time, duration, platform), meeting link as a clickable <a> tag, what to prepare, and a professional sign-off from the interviewer. Keep it concise but thorough.`,
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
  const subject = `Interview Invitation: ${ctx.jobTitle} at ${ctx.companyName}`;
  const body = `<p>Dear ${ctx.candidateFirstName},</p>

<p>We are pleased to invite you to an interview for the <strong>${ctx.jobTitle}</strong> position at <strong>${ctx.companyName}</strong>.</p>

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

// ─── Per-field AI Evaluation ─────────────────────────────

export interface FieldEvaluationResult {
  score: number;
  feedback: string;
  keywordsFound: string[];
}

export async function evaluateFieldContent(
  fieldLabel: string,
  content: string,
  aiKeywords: string[],
  jobTitle: string,
): Promise<FieldEvaluationResult> {
  if (!groq || !content.trim()) {
    return getFallbackFieldEvaluation(content, aiKeywords);
  }

  try {
    const keywordsStr = aiKeywords.length > 0 ? aiKeywords.join(', ') : 'general job relevance';
    const prompt = `Evaluate this "${fieldLabel}" submission for a "${jobTitle}" role.\n\nKeywords to evaluate against: ${keywordsStr}\n\nContent:\n${content.slice(0, 2000)}\n\nRate 0-100 how well this content addresses the keywords and job requirements. Identify which keywords are present or addressed. Give 1-2 sentence feedback.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'You are VealAI, a STRICT job application evaluator. Respond with valid JSON only — no markdown: { "score": number 0-100, "feedback": "1-2 sentences", "keywordsFound": ["kw1", "kw2"] }\n\nSCORING RULES (follow strictly):\n- 0-5: Content is completely irrelevant, nonsensical, a joke, or random text with zero connection to the job\n- 6-15: Content mentions the field topic but has no substance or job-relevant information\n- 16-30: Minimal relevant content, very few keywords addressed, mostly filler\n- 31-50: Some relevant content but missing key qualifications or keywords\n- 51-70: Decent content addressing several keywords with relevant detail\n- 71-85: Strong content covering most keywords with specific evidence\n- 86-100: Exceptional, addresses nearly all keywords with concrete specifics\n\nIMPORTANT: If the content does not contain actual job-relevant information (e.g. a random statement, a Bible quote, lorem ipsum, or unrelated text), score it 0-5. Do NOT be generous with irrelevant content. A cover letter must actually discuss qualifications. A resume must list real experience. Judge ONLY what is written.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    const text = completion.choices[0]?.message?.content?.trim() || '';
    const parsed = JSON.parse(text);

    return {
      score: Math.min(100, Math.max(0, Number(parsed.score) ?? 0)),
      feedback: String(parsed.feedback || 'Evaluation complete.').slice(0, 300),
      keywordsFound: Array.isArray(parsed.keywordsFound) ? parsed.keywordsFound.slice(0, 10) : [],
    };
  } catch (err) {
    console.error('Groq field evaluation error:', err);
    return getFallbackFieldEvaluation(content, aiKeywords);
  }
}

function getFallbackFieldEvaluation(content: string, aiKeywords: string[]): FieldEvaluationResult {
  const lower = (content || '').toLowerCase();
  const found = aiKeywords.filter((kw) => lower.includes(kw.toLowerCase()));
  const score =
    aiKeywords.length > 0
      ? Math.round((found.length / aiKeywords.length) * 100)
      : 0;

  return {
    score,
    feedback:
      found.length > 0
        ? `Found ${found.length} of ${aiKeywords.length} keywords in this response.`
        : 'No matching keywords detected.',
    keywordsFound: found,
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
          content: `You are VealAI, a STRICT ATS screening assistant. Analyze applicant data rigorously against job requirements. Always respond with valid JSON only — no markdown, no explanation. The JSON must have: overallScore (0-100), dimensionScores (object with skillsMatch, experienceRelevance, communicationQuality, cultureFit, completeness as 0-100 numbers), strengths (string array, max 5), concerns (string array, max 5), recommendation (one of: ADVANCE, REQUEST_INFO, CONSIDER_OTHER, REJECT), confidenceLevel (HIGH, MEDIUM, or LOW), resumeAnalysis (object with score 0-100 and feedback string array max 4).

SCORING RULES (follow strictly):
- 0-10: Applicant provided no useful information, nonsensical content, or completely irrelevant submissions (random text, jokes, unrelated documents, single phrases)
- 11-25: Very little relevant information, mostly empty or filler, no evidence of qualifications
- 26-40: Some relevant info but major gaps, few keywords matched, unclear qualifications
- 41-55: Moderate match — some relevant experience but missing important requirements
- 56-70: Good match — addresses most requirements with evidence
- 71-85: Strong match — clear evidence of most required skills and experience
- 86-100: Exceptional — addresses virtually all requirements with specific details

CRITICAL: If the applicant submitted irrelevant content (not a real resume, gibberish cover letter, unrelated documents), score them 0-10 regardless of other factors. Do NOT give points for simply submitting something — the content must be genuinely relevant. A cover letter with random words or phrases is 0-5. A file that is not a resume is 0-10. Recommend REJECT for scores under 25.`,
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
  parts.push('=== APPLICANT SUBMISSION ===');

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

  if (!ctx.applicationData && !ctx.coverLetter) {
    parts.push('No application responses or cover letter were provided. The applicant only submitted file uploads which cannot be read here.');
  }

  parts.push('');
  parts.push('Rate this applicant STRICTLY based ONLY on the text content above. If there are no application responses and no cover letter text, the score must be 0-5. Do not assume uploaded files contain relevant content — you cannot read them. A cover letter must contain actual professional content about qualifications — random phrases or quotes score 0-5. Do not give credit for simply submitting content — judge the actual quality and relevance. For the resumeAnalysis, evaluate based on: completeness of information provided, relevance to job requirements, communication quality, and professional presentation.');

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
  if (ctx.hasVideo) { score += 10; strengths.push('Video introduction provided'); }

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
      completeness: Math.round(((ctx.hasResume ? 25 : 0) + (ctx.coverLetter ? 25 : 0) + (ctx.hasVideo ? 25 : 0) + (ctx.applicationData ? 25 : 0))),
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

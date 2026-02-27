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

// ─── AI Applicant Screening ─────────────────────────────

interface ScreeningContext {
  applicantName: string;
  email: string;
  phone: string | null;
  linkedinUrl: string | null;
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
          content: `You are VealAI, an intelligent ATS screening assistant. Analyze applicant data against job requirements and provide a detailed screening report. Always respond with valid JSON only — no markdown, no explanation. The JSON must have: overallScore (0-100), dimensionScores (object with skillsMatch, experienceRelevance, communicationQuality, cultureFit, completeness as 0-100 numbers), strengths (string array, max 5), concerns (string array, max 5), recommendation (one of: ADVANCE, REQUEST_INFO, CONSIDER_OTHER, REJECT), confidenceLevel (HIGH, MEDIUM, or LOW), resumeAnalysis (object with score 0-100 and feedback string array max 4).`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 1000,
    });

    const text = completion.choices[0]?.message?.content?.trim() || '';
    const parsed = JSON.parse(text);

    return {
      overallScore: Math.min(100, Math.max(0, Number(parsed.overallScore) || 50)),
      dimensionScores: parsed.dimensionScores || {},
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5) : [],
      concerns: Array.isArray(parsed.concerns) ? parsed.concerns.slice(0, 5) : [],
      recommendation: ['ADVANCE', 'REQUEST_INFO', 'CONSIDER_OTHER', 'REJECT'].includes(parsed.recommendation) ? parsed.recommendation : 'REQUEST_INFO',
      confidenceLevel: ['HIGH', 'MEDIUM', 'LOW'].includes(parsed.confidenceLevel) ? parsed.confidenceLevel : 'MEDIUM',
      resumeAnalysis: {
        score: Math.min(100, Math.max(0, Number(parsed.resumeAnalysis?.score) || 50)),
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
  parts.push('=== APPLICANT ===');
  parts.push(`Name: ${ctx.applicantName}`);
  parts.push(`Email: ${ctx.email}`);
  if (ctx.phone) parts.push(`Phone: ${ctx.phone}`);
  if (ctx.linkedinUrl) parts.push(`LinkedIn: ${ctx.linkedinUrl}`);
  parts.push(`Has resume uploaded: ${ctx.hasResume ? 'Yes' : 'No'}`);
  parts.push(`Has video intro: ${ctx.hasVideo ? 'Yes' : 'No'}`);

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

  parts.push('');
  parts.push('Rate this applicant. For the resumeAnalysis, evaluate based on: completeness of information provided, relevance to job requirements, communication quality, and professional presentation.');

  return parts.join('\n');
}

function getFallbackScreening(ctx: ScreeningContext): AIScreeningResult {
  // Simple heuristic-based scoring when AI is unavailable
  let score = 40;
  const strengths: string[] = [];
  const concerns: string[] = [];

  if (ctx.applicationData && ctx.applicationData.length > 50) { score += 10; strengths.push('Provided detailed application responses'); }
  if (ctx.coverLetter && ctx.coverLetter.length > 100) { score += 10; strengths.push('Submitted a cover letter'); }
  if (ctx.hasResume) { score += 15; strengths.push('Resume uploaded'); }
  if (ctx.hasVideo) { score += 5; strengths.push('Video introduction provided'); }
  if (ctx.linkedinUrl) { score += 5; strengths.push('LinkedIn profile provided'); }
  if (ctx.phone) { score += 5; }

  if (!ctx.hasResume) concerns.push('No resume uploaded');
  if (!ctx.coverLetter) concerns.push('No cover letter provided');
  if (!ctx.linkedinUrl) concerns.push('No LinkedIn profile');

  score = Math.min(100, score);

  return {
    overallScore: score,
    dimensionScores: {
      skillsMatch: score,
      experienceRelevance: Math.max(20, score - 10),
      communicationQuality: ctx.coverLetter ? Math.min(100, score + 10) : Math.max(20, score - 15),
      cultureFit: 50,
      completeness: Math.round(((ctx.hasResume ? 25 : 0) + (ctx.coverLetter ? 25 : 0) + (ctx.hasVideo ? 25 : 0) + (ctx.applicationData ? 25 : 0))),
    },
    strengths,
    concerns,
    recommendation: score >= 70 ? 'ADVANCE' : score >= 50 ? 'REQUEST_INFO' : 'CONSIDER_OTHER',
    confidenceLevel: 'LOW',
    resumeAnalysis: {
      score: ctx.hasResume ? Math.min(100, score + 5) : 20,
      feedback: ctx.hasResume
        ? ['Resume was uploaded but content analysis requires AI', 'Manual review recommended']
        : ['No resume was uploaded', 'Applicant should be asked to provide a resume'],
    },
  };
}

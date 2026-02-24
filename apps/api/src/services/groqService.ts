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

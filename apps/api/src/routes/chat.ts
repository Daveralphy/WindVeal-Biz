import { FastifyInstance } from 'fastify';
import Groq from 'groq-sdk';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { env } from '../config/env.js';

// Cached plan config loaded from DB (refreshed every 5 minutes)
interface PlanConfig { dailyMessages: number; features: string[] }
let planCache: Record<string, PlanConfig> | null = null;
let planCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getPlanLimits(): Promise<Record<string, PlanConfig>> {
  if (planCache && Date.now() - planCacheTime < CACHE_TTL) return planCache;

  const plans = await prisma.subscriptionPlan.findMany();
  const result: Record<string, PlanConfig> = {};
  for (const p of plans) {
    result[p.tier] = { dailyMessages: p.aiChatLimit, features: p.features };
  }

  // Fallback if DB is empty
  if (Object.keys(result).length === 0) {
    result.STARTER = { dailyMessages: 15, features: ['general_questions', 'view_stats'] };
    result.PROFESSIONAL = { dailyMessages: 100, features: ['general_questions', 'view_stats', 'manage_jobs', 'manage_applicants', 'analytics'] };
    result.ENTERPRISE = { dailyMessages: -1, features: ['general_questions', 'view_stats', 'manage_jobs', 'manage_applicants', 'analytics', 'bulk_actions', 'reports'] };
  }

  planCache = result;
  planCacheTime = Date.now();
  return result;
}

// In-memory daily counter (per user). Resets each calendar day.
const usageBuckets = new Map<string, { count: number; date: string }>();

async function checkRateLimit(userId: string, tier: string): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const planLimits = await getPlanLimits();
  const limit = planLimits[tier]?.dailyMessages ?? 15;
  if (limit === -1) return { allowed: true, remaining: -1, limit: -1 };

  const key = `${userId}:${today}`;
  const bucket = usageBuckets.get(key);
  if (!bucket || bucket.date !== today) {
    usageBuckets.set(key, { count: 1, date: today });
    return { allowed: true, remaining: limit - 1, limit };
  }
  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, limit };
  }
  bucket.count++;
  return { allowed: true, remaining: limit - bucket.count, limit };
}

async function gatherContext(organizationId: string) {
  const [jobs, applicantCount, recentApplicants, interviewCount] = await Promise.all([
    prisma.job.findMany({
      where: { organizationId },
      select: { id: true, title: true, status: true, department: true, location: true, type: true, _count: { select: { applicants: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.applicant.count({ where: { organizationId } }),
    prisma.applicant.findMany({
      where: { organizationId },
      select: {
        id: true, firstName: true, lastName: true, email: true, source: true,
        job: { select: { title: true } },
        currentStage: { select: { name: true } },
        aiReport: { select: { overallScore: true, recommendation: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.interview.count({ where: { job: { organizationId }, status: 'SCHEDULED' } }),
  ]);

  const activeJobs = jobs.filter((j) => j.status === 'ACTIVE');
  const summary = [
    `Organization has ${jobs.length} total jobs (${activeJobs.length} active), ${applicantCount} total applicants, ${interviewCount} scheduled interviews.`,
    '',
    'Active jobs:',
    ...activeJobs.map((j) => `- "${j.title}" (${j.department || 'No dept'}, ${j.location || 'Remote'}, ${j.type}) — ${j._count.applicants} applicants`),
    '',
    'Recent applicants:',
    ...recentApplicants.map((a) => {
      const score = a.aiReport ? `AI Score: ${a.aiReport.overallScore}%` : 'Not scored';
      const stage = a.currentStage?.name || 'Applied';
      return `- ${a.firstName} ${a.lastName} (${a.email}) — Applied to "${a.job.title}", Stage: ${stage}, ${score}`;
    }),
  ];

  return { summary: summary.join('\n'), jobs, recentApplicants };
}

const SYSTEM_PROMPT = `You are VealAI, the AI assistant for VealBiz — an Applicant Tracking System (ATS).

Style:
- Be concise. Give short, direct answers — 1-3 sentences unless the user asks for detail.
- Use bullet points only when listing multiple items.
- Don't over-explain or repeat information. Don't add disclaimers or filler.
- Professional yet friendly — VealBiz is a Nigerian-founded HR tech company.
- When referencing data, cite specific numbers from the context.
- If you don't have the data, say so briefly.

Capabilities:
- Answer questions about the user's jobs, applicants, pipeline, interviews, and analytics
- Help users create jobs through conversation (see Job Creation Flow below)
- Provide brief recruiting tips when asked

Job Creation Flow:
When a user wants to add/create a job, follow this process exactly:
1. Ask: "Would you like to add the job manually on the Create Job page, or should I help you fill in the details here?"
2. If they choose bot-assisted, collect these fields ONE AT A TIME in this order:
   a. Job title (required)
   b. Department (optional — ask "Which department? Or skip")
   c. Job type (FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP, VOLUNTEER — default FULL_TIME)
   d. Location (optional)
   e. Salary range and currency (optional — e.g. "50000-80000 NGN")
   f. Job description (required)
   g. Requirements (required)
   h. Nice-to-have skills (optional — ask "Any nice-to-have skills? Or skip")
3. After collecting all fields, show a summary and ask "Should I create this job?"
4. If confirmed, respond with EXACTLY this format on its own line:
   <<<CREATE_JOB>>>{"title":"...","department":"...","type":"...","location":"...","salaryMin":...,"salaryMax":...,"salaryCurrency":"...","description":"...","requirements":"...","niceToHave":"..."}<<<END_JOB>>>
   Include only the fields that were provided. Use null for skipped optional fields.
5. After the job data line, add a brief confirmation message.

Rules:
- Never make up data not in the provided context
- Keep responses under 100 words unless the user asks for more detail
- If the user asks to go to the manual page, just say: "Head to the **Create Job** page from the sidebar or dashboard."`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function chatRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // POST /api/chat — Send a message to VealAI
  app.post<{ Body: { message: string; history?: ChatMessage[] } }>('/', async (request, reply) => {
    const { userId, organizationId } = request.user!;
    const { message, history = [] } = request.body || {};

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return reply.status(400).send({ error: 'Message is required' });
    }

    if (message.length > 2000) {
      return reply.status(400).send({ error: 'Message too long (max 2000 characters)' });
    }

    // Get subscription tier
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: { select: { subscriptionTier: true, name: true } } },
    });

    if (!user) return reply.status(401).send({ error: 'User not found' });

    const tier = user.organization.subscriptionTier;
    const allPlans = await getPlanLimits();
    const planConfig = allPlans[tier] || allPlans.STARTER || { dailyMessages: 15, features: ['general_questions', 'view_stats'] };

    // Rate limit check
    const rateCheck = await checkRateLimit(userId, tier);
    if (!rateCheck.allowed) {
      return reply.status(429).send({
        error: 'Daily message limit reached',
        limit: rateCheck.limit,
        tier,
        upgradeMessage: tier === 'STARTER'
          ? 'Upgrade to Professional for 100 messages/day'
          : 'Upgrade to Enterprise for unlimited messages',
      });
    }

    // Gather live ATS context
    const context = await gatherContext(organizationId);

    // Build messages
    const systemMessage = [
      SYSTEM_PROMPT,
      '',
      `User: ${user.firstName} ${user.lastName} (${user.role})`,
      `Organization: ${user.organization.name}`,
      `Plan: ${tier}`,
      `Allowed features: ${planConfig.features.join(', ')}`,
      '',
      '--- LIVE ATS DATA ---',
      context.summary,
    ].join('\n');

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemMessage },
    ];

    // Include up to 10 messages of history for context
    const trimmedHistory = history.slice(-10);
    for (const msg of trimmedHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: 'user', content: message });

    // Call Groq
    if (!env.GROQ_API_KEY) {
      return reply.send({
        reply: "I'm currently unavailable — the AI service hasn't been configured yet. Please contact your administrator.",
        remaining: rateCheck.remaining,
        limit: rateCheck.limit,
        tier,
      });
    }

    try {
      const groq = new Groq({ apiKey: env.GROQ_API_KEY });
      const completion = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages,
        temperature: 0.6,
        max_tokens: 800,
      });

      const aiReply = completion.choices[0]?.message?.content?.trim() || "I couldn't generate a response. Please try again.";

      // Log AI usage
      await prisma.aIUsageLog.create({
        data: {
          userId,
          organizationId,
          type: 'CHAT',
          model: 'llama-3.1-8b-instant',
          tokensUsed: completion.usage?.total_tokens ?? null,
          success: true,
        },
      });

      return reply.send({
        reply: aiReply,
        remaining: rateCheck.remaining,
        limit: rateCheck.limit,
        tier,
      });
    } catch (err) {
      console.error('VealAI chat error:', err);
      // Log failed usage
      await prisma.aIUsageLog.create({
        data: { userId, organizationId, type: 'CHAT', model: 'llama-3.1-8b-instant', success: false },
      }).catch(() => {});
      return reply.status(500).send({
        error: 'Failed to generate response',
        reply: "Sorry, I'm having trouble right now. Please try again in a moment.",
        remaining: rateCheck.remaining,
        limit: rateCheck.limit,
        tier,
      });
    }
  });

  // GET /api/chat/status — Check usage and plan limits
  app.get('/status', async (request, reply) => {
    const { userId, organizationId } = request.user!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: { select: { subscriptionTier: true } } },
    });

    if (!user) return reply.status(401).send({ error: 'User not found' });

    const tier = user.organization.subscriptionTier;
    const allPlans = await getPlanLimits();
    const planConfig = allPlans[tier] || allPlans.STARTER || { dailyMessages: 15, features: ['general_questions', 'view_stats'] };
    const today = new Date().toISOString().slice(0, 10);
    const bucket = usageBuckets.get(`${userId}:${today}`);
    const used = bucket?.date === today ? bucket.count : 0;
    const limit = planConfig.dailyMessages;

    return reply.send({
      tier,
      features: planConfig.features,
      daily: {
        used,
        limit: limit === -1 ? 'unlimited' : limit,
        remaining: limit === -1 ? 'unlimited' : Math.max(0, limit - used),
      },
    });
  });
}

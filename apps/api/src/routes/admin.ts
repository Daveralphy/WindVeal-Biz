import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/superAdmin.js';

export async function adminRoutes(app: FastifyInstance) {
  // All admin routes require authentication + super admin
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', requireSuperAdmin);

  // Helper: load tier pricing from DB
  async function getTierPricing(): Promise<Record<string, number>> {
    const plans = await prisma.subscriptionPlan.findMany();
    return Object.fromEntries(plans.map((p) => [p.tier, p.monthlyPrice]));
  }

  // Helper: load AI chat limits from DB
  async function getAIChatLimits(): Promise<Record<string, number>> {
    const plans = await prisma.subscriptionPlan.findMany();
    return Object.fromEntries(plans.map((p) => [p.tier, p.aiChatLimit]));
  }

  // ─── Subscription Plans ─────────────────────────────
  app.get('/subscription-plans', async () => {
    return prisma.subscriptionPlan.findMany({ orderBy: { monthlyPrice: 'asc' } });
  });

  // ─── Platform Metadata (single source of truth) ────
  app.get('/metadata', async () => {
    const plans = await prisma.subscriptionPlan.findMany({ orderBy: { monthlyPrice: 'asc' } });

    return {
      tiers: plans.map((p) => ({
        value: p.tier,
        label: p.name,
        monthlyPrice: p.monthlyPrice,
        aiChatLimit: p.aiChatLimit,
        features: p.features,
      })),
      roles: [
        { value: 'ADMIN', label: 'Admin' },
        { value: 'RECRUITER', label: 'Recruiter' },
        { value: 'HIRING_MANAGER', label: 'Hiring Manager' },
        { value: 'INTERVIEWER', label: 'Interviewer' },
        { value: 'VIEWER', label: 'Viewer' },
      ],
      aiUsageTypes: [
        { value: 'CHAT', label: 'VealAI Chat' },
        { value: 'AI_INSIGHTS', label: 'Dashboard Insights' },
        { value: 'AI_SCORING', label: 'Resume Scoring' },
      ],
      featureKeys: [
        { key: 'jobs', label: 'Job Posting' },
        { key: 'applicants', label: 'Applicant Tracking' },
        { key: 'interviews', label: 'Interviews' },
        { key: 'aiScoring', label: 'AI Resume Scoring' },
        { key: 'careersPage', label: 'Careers Portal' },
        { key: 'communications', label: 'Email Communications' },
      ],
    };
  });

  // ─── Dashboard — Business KPIs ──────────────────────
  app.get('/dashboard', async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    // Exclude orgs that belong to super admin accounts
    const customerOrgFilter = { users: { none: { isSuperAdmin: true } } };

    const [
      totalOrgs,
      totalUsers,
      totalJobs,
      totalApplicants,
      tierCounts,
      recentOrgs,
      activeOrgs,
      activeUsers,
      newOrgsWeek,
      newOrgsMonth,
    ] = await Promise.all([
      prisma.organization.count({ where: customerOrgFilter }),
      prisma.user.count({ where: { isSuperAdmin: false } }),
      prisma.job.count({ where: { organization: customerOrgFilter } }),
      prisma.applicant.count({ where: { organization: customerOrgFilter } }),
      prisma.organization.groupBy({
        by: ['subscriptionTier'],
        where: customerOrgFilter,
        _count: true,
      }),
      prisma.organization.findMany({
        where: customerOrgFilter,
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          industry: true,
          subscriptionTier: true,
          createdAt: true,
          _count: { select: { users: true, jobs: true } },
        },
      }),
      prisma.organization.count({
        where: { ...customerOrgFilter, users: { some: { lastLoginAt: { gte: thirtyDaysAgo }, isSuperAdmin: false } } },
      }),
      prisma.user.count({
        where: { lastLoginAt: { gte: thirtyDaysAgo }, isSuperAdmin: false },
      }),
      prisma.organization.count({ where: { ...customerOrgFilter, createdAt: { gte: weekAgo } } }),
      prisma.organization.count({ where: { ...customerOrgFilter, createdAt: { gte: thirtyDaysAgo } } }),
    ]);

    const tierBreakdown = Object.fromEntries(
      tierCounts.map((t) => [t.subscriptionTier, t._count])
    );

    // MRR & ARR from DB-stored pricing
    const tierPricing = await getTierPricing();
    let mrr = 0;
    const revenueByTier: Record<string, { count: number; price: number; revenue: number }> = {};
    for (const t of tierCounts) {
      const price = tierPricing[t.subscriptionTier] || 0;
      const revenue = price * t._count;
      mrr += revenue;
      revenueByTier[t.subscriptionTier] = { count: t._count, price, revenue };
    }
    const arr = mrr * 12;

    // Churn indicator: orgs with no logins in 60 days
    const inactiveOrgs = await prisma.organization.count({
      where: {
        ...customerOrgFilter,
        users: { every: { OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: sixtyDaysAgo } }] } },
      },
    });

    // Signups over the last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlySignups = await prisma.organization.findMany({
      where: { ...customerOrgFilter, createdAt: { gte: twelveMonthsAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const signupsByMonth: Record<string, number> = {};
    for (const org of monthlySignups) {
      const key = `${org.createdAt.getFullYear()}-${String(org.createdAt.getMonth() + 1).padStart(2, '0')}`;
      signupsByMonth[key] = (signupsByMonth[key] || 0) + 1;
    }

    return {
      totalOrgs,
      totalUsers,
      totalJobs,
      totalApplicants,
      activeOrgs,
      activeUsers,
      inactiveOrgs,
      newOrgsWeek,
      newOrgsMonth,
      mrr,
      arr,
      tierBreakdown,
      revenueByTier,
      signupsByMonth,
      recentOrgs,
    };
  });

  // ─── List organizations ─────────────────────────────
  app.get('/organizations', async (request) => {
    const { search, tier, page = '1', limit = '20' } = request.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Exclude orgs that belong to super admin accounts
    const where: Record<string, unknown> = { users: { none: { isSuperAdmin: true } } };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (tier) {
      where.subscriptionTier = tier;
    }

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          industry: true,
          companySize: true,
          country: true,
          subscriptionTier: true,
          createdAt: true,
          _count: { select: { users: true, jobs: true, applicants: true } },
        },
      }),
      prisma.organization.count({ where }),
    ]);

    return { organizations, total, page: parseInt(page), limit: parseInt(limit) };
  });

  // ─── Organization detail ────────────────────────────
  app.get('/organizations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const org = await prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        industry: true,
        companySize: true,
        website: true,
        country: true,
        subscriptionTier: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { users: true, jobs: true, applicants: true } },
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!org) {
      return reply.status(404).send({ error: 'Organization not found' });
    }

    return org;
  });

  // ─── Update subscription tier ───────────────────────
  app.patch('/organizations/:id/tier', async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      tier: z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid tier' });
    }

    const org = await prisma.organization.update({
      where: { id },
      data: { subscriptionTier: parsed.data.tier },
      select: { id: true, name: true, subscriptionTier: true },
    });

    return org;
  });

  // ─── List users ─────────────────────────────────────
  app.get('/users', async (request) => {
    const { search, role, active, page = '1', limit = '20' } = request.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: Record<string, unknown> = { isSuperAdmin: false };
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;
    if (active !== undefined) where.isActive = active === 'true';

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          isSuperAdmin: true,
          lastLoginAt: true,
          createdAt: true,
          organization: {
            select: { id: true, name: true, subscriptionTier: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total, page: parseInt(page), limit: parseInt(limit) };
  });

  // ─── AI & API Usage ─────────────────────────────────
  app.get('/ai-usage', async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Exclude usage from super admin's org
    const customerUsageFilter = { organization: { users: { none: { isSuperAdmin: true } } } };

    const [
      totalRequests,
      requestsThisMonth,
      requestsThisWeek,
      failedRequests,
      requestsByType,
      totalTokens,
    ] = await Promise.all([
      prisma.aIUsageLog.count({ where: customerUsageFilter }),
      prisma.aIUsageLog.count({ where: { ...customerUsageFilter, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.aIUsageLog.count({ where: { ...customerUsageFilter, createdAt: { gte: sevenDaysAgo } } }),
      prisma.aIUsageLog.count({ where: { ...customerUsageFilter, success: false } }),
      prisma.aIUsageLog.groupBy({ by: ['type'], where: customerUsageFilter, _count: true }),
      prisma.aIUsageLog.aggregate({ where: customerUsageFilter, _sum: { tokensUsed: true } }),
    ]);

    // Requests by subscription tier (exclude super admin orgs)
    const requestsByTier = await prisma.$queryRaw<Array<{ tier: string; count: bigint }>>`
      SELECT o."subscriptionTier" as tier, COUNT(a.id)::bigint as count
      FROM ai_usage_logs a
      JOIN organizations o ON a."organizationId" = o.id
      WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u."organizationId" = o.id AND u."isSuperAdmin" = true)
      GROUP BY o."subscriptionTier"
    `;

    // Top 10 orgs by usage (exclude super admin orgs)
    const topOrgsByUsage = await prisma.$queryRaw<Array<{ id: string; name: string; tier: string; count: bigint }>>`
      SELECT o.id, o.name, o."subscriptionTier" as tier, COUNT(a.id)::bigint as count
      FROM ai_usage_logs a
      JOIN organizations o ON a."organizationId" = o.id
      WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u."organizationId" = o.id AND u."isSuperAdmin" = true)
      GROUP BY o.id, o.name, o."subscriptionTier"
      ORDER BY count DESC
      LIMIT 10
    `;

    // Daily usage last 30 days (exclude super admin orgs)
    const dailyUsage = await prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
      SELECT DATE(a."createdAt") as day, COUNT(a.id)::bigint as count
      FROM ai_usage_logs a
      JOIN organizations o ON a."organizationId" = o.id
      WHERE a."createdAt" >= ${thirtyDaysAgo}
        AND NOT EXISTS (SELECT 1 FROM users u WHERE u."organizationId" = o.id AND u."isSuperAdmin" = true)
      GROUP BY DATE(a."createdAt")
      ORDER BY day ASC
    `;

    // Rate limit hits (users who hit daily cap today, exclude super admin)
    const todayUsagePerUser = await prisma.$queryRaw<Array<{ tier: string; cnt: bigint }>>`
      SELECT o."subscriptionTier" as tier, COUNT(a.id)::bigint as cnt
      FROM ai_usage_logs a
      JOIN users u ON a."userId" = u.id
      JOIN organizations o ON u."organizationId" = o.id
      WHERE a."createdAt" >= ${today}
        AND u."isSuperAdmin" = false
      GROUP BY a."userId", o."subscriptionTier"
    `;

    const planLimits = await getAIChatLimits();
    const rateLimitHits = todayUsagePerUser.filter((u) => {
      const limit = planLimits[u.tier] ?? 15;
      return limit !== -1 && Number(u.cnt) >= limit;
    }).length;

    // Estimated cost
    const totalTokensUsed = totalTokens._sum.tokensUsed || 0;
    const estimatedCost = Math.round(((totalTokensUsed / 1000) * 0.0001) * 100) / 100;

    return {
      totalRequests,
      requestsThisMonth,
      requestsThisWeek,
      failedRequests,
      rateLimitHits,
      totalTokensUsed,
      estimatedCost,
      requestsByType: Object.fromEntries(requestsByType.map((r) => [r.type, r._count])),
      requestsByTier: Object.fromEntries(requestsByTier.map((r) => [r.tier, Number(r.count)])),
      topOrgsByUsage: topOrgsByUsage.map((o) => ({
        id: o.id, name: o.name, tier: o.tier, count: Number(o.count),
      })),
      dailyUsage: dailyUsage.map((d) => ({ day: d.day, count: Number(d.count) })),
    };
  });

  // ─── Platform Analytics ─────────────────────────────
  app.get('/analytics', async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Exclude orgs that belong to super admin accounts
    const customerOrgFilter = { users: { none: { isSuperAdmin: true } } };
    const totalOrgs = await prisma.organization.count({ where: customerOrgFilter });

    // Feature adoption: count distinct customer orgs using each feature
    const customerJobFilter = { organization: customerOrgFilter };
    const [
      orgsWithJobs,
      orgsWithApplicants,
      orgsWithCareersPage,
    ] = await Promise.all([
      prisma.job.groupBy({ by: ['organizationId'], where: customerJobFilter }).then((r) => r.length),
      prisma.applicant.groupBy({ by: ['organizationId'], where: { organization: customerOrgFilter } }).then((r) => r.length),
      prisma.job.groupBy({ by: ['organizationId'], where: { ...customerJobFilter, visibility: 'PORTAL' } }).then((r) => r.length),
    ]);

    const [orgsWithInterviews, orgsWithAIReports, orgsWithEmails] = await Promise.all([
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT j."organizationId")::bigint as count
        FROM interviews i JOIN jobs j ON i."jobId" = j.id
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u."organizationId" = j."organizationId" AND u."isSuperAdmin" = true)
      `.then((r) => Number(r[0]?.count || 0)),
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT a."organizationId")::bigint as count
        FROM ai_reports ar JOIN applicants a ON ar."applicantId" = a.id
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u."organizationId" = a."organizationId" AND u."isSuperAdmin" = true)
      `.then((r) => Number(r[0]?.count || 0)),
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT j."organizationId")::bigint as count
        FROM email_logs el
        JOIN applicants a ON el."applicantId" = a.id
        JOIN jobs j ON a."jobId" = j.id
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u."organizationId" = j."organizationId" AND u."isSuperAdmin" = true)
      `.then((r) => Number(r[0]?.count || 0)),
    ]);

    const pct = (n: number) => totalOrgs ? Math.round((n / totalOrgs) * 100) : 0;
    const featureAdoption = {
      jobs: { count: orgsWithJobs, pct: pct(orgsWithJobs) },
      applicants: { count: orgsWithApplicants, pct: pct(orgsWithApplicants) },
      interviews: { count: orgsWithInterviews, pct: pct(orgsWithInterviews) },
      aiScoring: { count: orgsWithAIReports, pct: pct(orgsWithAIReports) },
      careersPage: { count: orgsWithCareersPage, pct: pct(orgsWithCareersPage) },
      communications: { count: orgsWithEmails, pct: pct(orgsWithEmails) },
    };

    // DAU / WAU / MAU (exclude super admin)
    const [dau, wau, mau, totalUsers] = await Promise.all([
      prisma.user.count({ where: { lastLoginAt: { gte: oneDayAgo }, isSuperAdmin: false } }),
      prisma.user.count({ where: { lastLoginAt: { gte: sevenDaysAgo }, isSuperAdmin: false } }),
      prisma.user.count({ where: { lastLoginAt: { gte: thirtyDaysAgo }, isSuperAdmin: false } }),
      prisma.user.count({ where: { isSuperAdmin: false } }),
    ]);

    // Average metrics per org (customer orgs only)
    const [totalJobsCount, totalApplicantsCount] = await Promise.all([
      prisma.job.count({ where: { organization: customerOrgFilter } }),
      prisma.applicant.count({ where: { organization: customerOrgFilter } }),
    ]);

    const averages = {
      jobsPerOrg: totalOrgs ? Math.round((totalJobsCount / totalOrgs) * 10) / 10 : 0,
      applicantsPerOrg: totalOrgs ? Math.round((totalApplicantsCount / totalOrgs) * 10) / 10 : 0,
      usersPerOrg: totalOrgs ? Math.round((totalUsers / totalOrgs) * 10) / 10 : 0,
    };

    // User growth over the last 12 months (exclude super admin)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const userGrowth = await prisma.user.findMany({
      where: { createdAt: { gte: twelveMonthsAgo }, isSuperAdmin: false },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const usersByMonth: Record<string, number> = {};
    for (const u of userGrowth) {
      const key = `${u.createdAt.getFullYear()}-${String(u.createdAt.getMonth() + 1).padStart(2, '0')}`;
      usersByMonth[key] = (usersByMonth[key] || 0) + 1;
    }

    // Most & least active orgs (customer orgs only)
    const orgActivity = await prisma.organization.findMany({
      where: customerOrgFilter,
      select: {
        id: true,
        name: true,
        subscriptionTier: true,
        _count: { select: { users: true, jobs: true, applicants: true } },
        users: { select: { lastLoginAt: true }, orderBy: { lastLoginAt: 'desc' }, take: 1 },
      },
    });

    const sortedByActivity = orgActivity
      .map((o) => ({
        id: o.id,
        name: o.name,
        tier: o.subscriptionTier,
        users: o._count.users,
        jobs: o._count.jobs,
        applicants: o._count.applicants,
        lastActive: o.users[0]?.lastLoginAt?.toISOString() || null,
      }))
      .sort((a, b) => {
        if (!a.lastActive && !b.lastActive) return 0;
        if (!a.lastActive) return 1;
        if (!b.lastActive) return -1;
        return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
      });

    return {
      featureAdoption,
      engagement: { dau, wau, mau, totalUsers, dauMauRatio: mau ? Math.round((dau / mau) * 100) : 0 },
      averages,
      usersByMonth,
      mostActive: sortedByActivity.slice(0, 5),
      leastActive: sortedByActivity.slice(-5).reverse(),
    };
  });

  // ─── Change admin password ──────────────────────────
  app.patch('/change-password', async (request, reply) => {
    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8).regex(
        /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/,
        'Password must have uppercase, number, and special character'
      ),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const user = await prisma.user.findUnique({
      where: { id: request.user!.userId },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    return { message: 'Password updated successfully' };
  });

  // ─── User Detail ────────────────────────────────────
  app.get('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        role: true,
        isActive: true,
        isSuperAdmin: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        organization: {
          select: { id: true, name: true, subscriptionTier: true },
        },
      },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return user;
  });

  // ─── Toggle user active status ──────────────────────
  app.patch('/users/:id/toggle-active', async (request, reply) => {
    const { id } = request.params as { id: string };

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }
    if (user.isSuperAdmin) {
      return reply.status(403).send({ error: 'Cannot modify super admin accounts' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: { id: true, email: true, isActive: true },
    });

    return { message: `User ${updated.isActive ? 'activated' : 'deactivated'}`, user: updated };
  });

  // ─── Admin‑triggered password reset ─────────────────
  app.post('/users/:id/reset-password', async (request, reply) => {
    const { id } = request.params as { id: string };

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }
    if (user.isSuperAdmin) {
      return reply.status(403).send({ error: 'Cannot reset super admin password from here' });
    }

    // Generate secure token (valid 24 hours)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Invalidate any existing tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: id, used: false },
      data: { used: true },
    });

    await prisma.passwordResetToken.create({
      data: { userId: id, token, expiresAt },
    });

    // TODO: Send email when SMTP is configured
    // For now, log the token for dev use
    console.log(`[ADMIN] Password reset token for ${user.email}: ${token}`);

    return {
      message: `Password reset initiated for ${user.email}. Reset link has been generated.`,
      // In production, don't return the token — it would be emailed
      resetToken: process.env.NODE_ENV !== 'production' ? token : undefined,
    };
  });

  // ─── Delete user ────────────────────────────────────
  app.delete('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }
    if (user.isSuperAdmin) {
      return reply.status(403).send({ error: 'Cannot delete super admin accounts' });
    }

    await prisma.user.delete({ where: { id } });
    return { message: `User ${user.email} has been deleted` };
  });

  // ─── Delete organization ────────────────────────────
  app.delete('/organizations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) {
      return reply.status(404).send({ error: 'Organization not found' });
    }

    // Check if org belongs to super admin
    const superAdminCount = await prisma.user.count({
      where: { organizationId: id, isSuperAdmin: true },
    });
    if (superAdminCount > 0) {
      return reply.status(403).send({ error: 'Cannot delete VealBiz platform account' });
    }

    await prisma.organization.delete({ where: { id } });
    return { message: `Organization ${org.name} has been deleted` };
  });

  // ─── AI & API Usage with date filters ───────────────
  app.get('/ai-usage-filtered', async (request) => {
    const { period = 'all', startDate, endDate } = request.query as Record<string, string>;

    let dateFilter: { gte?: Date; lte?: Date } = {};

    if (period === 'daily') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dateFilter.gte = today;
    } else if (period === 'weekly') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      dateFilter.gte = weekAgo;
    } else if (period === 'monthly') {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      dateFilter.gte = monthAgo;
    } else if (period === 'range' && startDate && endDate) {
      dateFilter.gte = new Date(startDate);
      dateFilter.lte = new Date(endDate);
    }

    const customerUsageFilter = { organization: { users: { none: { isSuperAdmin: true } } } };
    const where: Record<string, unknown> = { ...customerUsageFilter };
    if (Object.keys(dateFilter).length > 0) {
      where.createdAt = dateFilter;
    }

    const [totalRequests, failedRequests, requestsByType, totalTokens] = await Promise.all([
      prisma.aIUsageLog.count({ where }),
      prisma.aIUsageLog.count({ where: { ...where, success: false } }),
      prisma.aIUsageLog.groupBy({ by: ['type'], where, _count: true }),
      prisma.aIUsageLog.aggregate({ where, _sum: { tokensUsed: true } }),
    ]);

    // Requests by subscription tier - using raw SQL with proper parameters
    const requestsByTier = await prisma.$queryRaw<Array<{ tier: string; count: bigint }>>(
      // Using template literals with Prisma parameter syntax
      Prisma.sql`
        SELECT o."subscriptionTier" as tier, COUNT(a.id)::bigint as count
        FROM ai_usage_logs a
        JOIN organizations o ON a."organizationId" = o.id
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u."organizationId" = o.id AND u."isSuperAdmin" = true)
        ${Object.keys(dateFilter).length > 0 ? Prisma.sql`AND a."createdAt" >= ${dateFilter.gte}` : Prisma.empty}
        ${dateFilter.lte ? Prisma.sql`AND a."createdAt" <= ${dateFilter.lte}` : Prisma.empty}
        GROUP BY o."subscriptionTier"
      `
    );

    // Top 10 orgs by usage
    const topOrgsByUsage = await prisma.$queryRaw<Array<{ id: string; name: string; tier: string; count: bigint }>>(
      Prisma.sql`
        SELECT o.id, o.name, o."subscriptionTier" as tier, COUNT(a.id)::bigint as count
        FROM ai_usage_logs a
        JOIN organizations o ON a."organizationId" = o.id
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u."organizationId" = o.id AND u."isSuperAdmin" = true)
        ${Object.keys(dateFilter).length > 0 ? Prisma.sql`AND a."createdAt" >= ${dateFilter.gte}` : Prisma.empty}
        ${dateFilter.lte ? Prisma.sql`AND a."createdAt" <= ${dateFilter.lte}` : Prisma.empty}
        GROUP BY o.id, o.name, o."subscriptionTier"
        ORDER BY count DESC
        LIMIT 10
      `
    );

    // Daily usage breakdown
    const dailyUsage = await prisma.$queryRaw<Array<{ day: string; count: bigint }>>(
      Prisma.sql`
        SELECT DATE(a."createdAt") as day, COUNT(a.id)::bigint as count
        FROM ai_usage_logs a
        JOIN organizations o ON a."organizationId" = o.id
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u."organizationId" = o.id AND u."isSuperAdmin" = true)
        ${Object.keys(dateFilter).length > 0 ? Prisma.sql`AND a."createdAt" >= ${dateFilter.gte}` : Prisma.empty}
        ${dateFilter.lte ? Prisma.sql`AND a."createdAt" <= ${dateFilter.lte}` : Prisma.empty}
        GROUP BY DATE(a."createdAt")
        ORDER BY day ASC
      `
    );

    const totalTokensUsed = totalTokens._sum.tokensUsed || 0;
    const estimatedCost = Math.round(((totalTokensUsed / 1000) * 0.0001) * 100) / 100;
    const successRate = totalRequests > 0 ? Math.round(((totalRequests - failedRequests) / totalRequests) * 100) : 100;

    return {
      period,
      totalRequests,
      failedRequests,
      successRate,
      totalTokensUsed,
      estimatedCost,
      requestsByType: Object.fromEntries(requestsByType.map((r) => [r.type, r._count])),
      requestsByTier: Object.fromEntries(requestsByTier.map((r) => [r.tier, Number(r.count)])),
      topOrgsByUsage: topOrgsByUsage.map((o) => ({
        id: o.id,
        name: o.name,
        tier: o.tier,
        count: Number(o.count),
      })),
      dailyUsage: dailyUsage.map((d) => ({ day: d.day, count: Number(d.count) })),
    };
  });
}

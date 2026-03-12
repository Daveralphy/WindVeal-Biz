import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Subscription Plans (upsert — safe to re-run) ───
  for (const plan of [
    {
      tier: 'STARTER',
      name: 'Starter',
      monthlyPrice: 0,
      aiChatLimit: 15,
      features: ['Up to 3 active jobs', 'Basic candidate management', '15 AI chats/day'],
    },
    {
      tier: 'PROFESSIONAL',
      name: 'Professional',
      monthlyPrice: 49,
      aiChatLimit: 100,
      features: ['Unlimited active jobs', 'AI candidate scoring', '100 AI chats/day', 'Custom pipelines', 'Email templates'],
    },
    {
      tier: 'ENTERPRISE',
      name: 'Enterprise',
      monthlyPrice: 199,
      aiChatLimit: -1,
      features: ['Everything in Professional', 'Unlimited AI chats', 'Priority support', 'Custom integrations', 'SSO', 'Dedicated account manager'],
    },
  ]) {
    await prisma.subscriptionPlan.upsert({
      where: { tier: plan.tier },
      update: { name: plan.name, monthlyPrice: plan.monthlyPrice, aiChatLimit: plan.aiChatLimit, features: plan.features },
      create: plan,
    });
  }
  console.log('✅ Subscription plans seeded');

  // ─── VealBiz Platform Super Admin (upsert) ──────────
  const superAdminEmail    = process.env.SUPER_ADMIN_EMAIL      || 'admin@vealbiz.com';
  const superAdminUsername = process.env.SUPER_ADMIN_USERNAME   || 'vealbiz.admin';
  const superAdminFirstName = process.env.SUPER_ADMIN_FIRST_NAME || 'VealBiz';
  const superAdminLastName  = process.env.SUPER_ADMIN_LAST_NAME  || 'Admin';
  const superAdminPassword  = process.env.SUPER_ADMIN_PASSWORD   || 'SuperAdmin123!';
  const superAdminHash = await bcrypt.hash(superAdminPassword, 12);

  let platformOrg = await prisma.organization.findUnique({ where: { slug: 'vealbiz-platform' } });
  if (!platformOrg) {
    platformOrg = await prisma.organization.create({
      data: {
        name: 'VealBiz Platform',
        slug: 'vealbiz-platform',
        industry: 'Technology',
        companySize: '1-10',
        website: 'https://vealbiz.com',
        country: 'Nigeria',
        subscriptionTier: 'ENTERPRISE',
      },
    });
  }

  await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: { passwordHash: superAdminHash, isSuperAdmin: true, username: superAdminUsername },
    create: {
      organizationId: platformOrg.id,
      email: superAdminEmail,
      username: superAdminUsername,
      passwordHash: superAdminHash,
      firstName: superAdminFirstName,
      lastName: superAdminLastName,
      jobTitle: 'Platform Administrator',
      role: 'ADMIN',
      isSuperAdmin: true,
      isActive: true,
      emailVerified: true,
    },
  });
  console.log(`✅ Super admin seeded: ${superAdminEmail}`);

  // ─── Optional test org-admin (only when SEED_ADMIN_EMAIL is set) ─
  const seedEmail = process.env.SEED_ADMIN_EMAIL;
  if (seedEmail) {
    const seedPassword  = process.env.SEED_ADMIN_PASSWORD   || 'Admin123!';
    const seedFirst     = process.env.SEED_ADMIN_FIRST_NAME || 'Admin';
    const seedLast      = process.env.SEED_ADMIN_LAST_NAME  || 'User';
    const seedUsername  = process.env.SEED_ADMIN_USERNAME   || seedEmail.split('@')[0];
    const seedOrgName   = process.env.SEED_ADMIN_ORG_NAME   || `${seedFirst}'s Company`;
    const seedOrgSlug   = (process.env.SEED_ADMIN_ORG_SLUG  || seedOrgName)
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const seedHash = await bcrypt.hash(seedPassword, 12);

    let seedOrg = await prisma.organization.findUnique({ where: { slug: seedOrgSlug } });
    if (!seedOrg) {
      seedOrg = await prisma.organization.create({
        data: { name: seedOrgName, slug: seedOrgSlug, subscriptionTier: 'PROFESSIONAL' },
      });
    }

    await prisma.user.upsert({
      where: { email: seedEmail },
      update: { passwordHash: seedHash },
      create: {
        organizationId: seedOrg.id,
        email: seedEmail,
        username: seedUsername,
        passwordHash: seedHash,
        firstName: seedFirst,
        lastName: seedLast,
        role: 'ADMIN',
        isActive: true,
        emailVerified: true,
      },
    });
    console.log(`✅ Test admin created: ${seedEmail} / ${seedPassword}`);
  }

  console.log('✅ Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

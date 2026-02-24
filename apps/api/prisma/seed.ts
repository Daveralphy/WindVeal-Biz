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
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!';
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
    where: { email: 'admin@vealbiz.com' },
    update: { passwordHash: superAdminHash, isSuperAdmin: true },
    create: {
      organizationId: platformOrg.id,
      email: 'admin@vealbiz.com',
      username: 'vealbiz.admin',
      passwordHash: superAdminHash,
      firstName: 'VealBiz',
      lastName: 'Admin',
      jobTitle: 'Platform Administrator',
      role: 'ADMIN',
      isSuperAdmin: true,
      isActive: true,
      emailVerified: true,
    },
  });

  console.log('✅ Seed complete!');
  console.log('');
  console.log('📊 Created:');
  console.log('   3 Subscription plans (Starter, Professional, Enterprise)');
  console.log('   1 Platform organization (VealBiz Platform)');
  console.log('   1 Super admin user');
  console.log('');
  console.log('🔑 Super Admin login:');
  console.log(`   admin@vealbiz.com / ${superAdminPassword}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

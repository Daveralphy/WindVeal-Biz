import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corp',
      slug: 'acme-corp',
    },
  });

  // Create User
  const password = await bcrypt.hash('password123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'admin@acme.com' },
    update: {},
    create: {
      email: 'admin@acme.com',
      password,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      organizationId: org.id,
    },
  });

  // Create Job
  const job = await prisma.job.create({
    data: {
      title: 'Senior Frontend Developer',
      department: 'Engineering',
      location: 'Lagos, Nigeria',
      type: 'FULL_TIME',
      description: 'We are looking for a React expert...',
      requirements: '5+ years experience...',
      organizationId: org.id,
    },
  });

  // Create Candidate
  await prisma.candidate.create({
    data: {
      name: 'Sarah Johnson',
      email: 'sarah@example.com',
      resumeUrl: 'uploads/resume.pdf',
      score: 95,
      summary: 'Excellent candidate with strong React skills.',
      skills: ['React', 'TypeScript', 'Node.js'],
      stage: 'INTERVIEW',
      jobId: job.id,
    },
  });

  console.log({ org, user, job });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.teamInvitation.deleteMany();
  await prisma.emailLog.deleteMany();
  await prisma.emailTemplate.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.scorecard.deleteMany();
  await prisma.interview.deleteMany();
  await prisma.applicantNote.deleteMany();
  await prisma.stageHistory.deleteMany();
  await prisma.aIReport.deleteMany();
  await prisma.uploadedFile.deleteMany();
  await prisma.applicationData.deleteMany();
  await prisma.applicant.deleteMany();
  await prisma.applicationForm.deleteMany();
  await prisma.pipelineStage.deleteMany();
  await prisma.jobAssignment.deleteMany();
  await prisma.job.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // ─── Organization ────────────────────────────────────
  const org = await prisma.organization.create({
    data: {
      name: 'WindVeal Technologies',
      slug: 'windveal',
      industry: 'Technology',
      companySize: '11-50',
      website: 'https://windveal.com',
      country: 'Nigeria',
      subscriptionTier: 'PROFESSIONAL',
    },
  });

  // ─── Users ───────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Password123!', 12);

  const admin = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'james@windveal.com',
      username: 'james.okonkwo',
      passwordHash,
      firstName: 'James',
      lastName: 'Okonkwo',
      jobTitle: 'Head of Talent',
      role: 'ADMIN',
      isActive: true,
      emailVerified: true,
    },
  });

  const recruiter1 = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'funmi@windveal.com',
      username: 'funmi.ade',
      passwordHash,
      firstName: 'Funmi',
      lastName: 'Ade',
      jobTitle: 'Senior Recruiter',
      role: 'RECRUITER',
      isActive: true,
      emailVerified: true,
    },
  });

  const hiringManager = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'ngozi@windveal.com',
      username: 'ngozi.eze',
      passwordHash,
      firstName: 'Ngozi',
      lastName: 'Eze',
      jobTitle: 'Engineering Manager',
      role: 'HIRING_MANAGER',
      isActive: true,
      emailVerified: true,
    },
  });

  const recruiter2 = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'tunde@windveal.com',
      username: 'tunde.bakare',
      passwordHash,
      firstName: 'Tunde',
      lastName: 'Bakare',
      jobTitle: 'Recruiter',
      role: 'RECRUITER',
      isActive: true,
      emailVerified: true,
    },
  });

  await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'aisha@windveal.com',
      username: 'aisha.suleiman',
      passwordHash,
      firstName: 'Aisha',
      lastName: 'Suleiman',
      jobTitle: 'HR Assistant',
      role: 'VIEWER',
      isActive: true,
      emailVerified: false,
    },
  });

  // ─── Default pipeline stages helper ──────────────────
  const DEFAULT_STAGES = [
    { name: 'Applied', order: 0, color: '#6B7280' },
    { name: 'Screening', order: 1, color: '#3B82F6' },
    { name: 'Interview', order: 2, color: '#F59E0B' },
    { name: 'Technical', order: 3, color: '#EC4899' },
    { name: 'Offer Sent', order: 4, color: '#10B981' },
    { name: 'Hired', order: 5, color: '#22C55E' },
  ];

  // ─── Jobs ────────────────────────────────────────────
  const job1 = await prisma.job.create({
    data: {
      organizationId: org.id,
      title: 'Senior Frontend Developer',
      department: 'Engineering',
      type: 'FULL_TIME',
      location: 'Lagos, NG',
      salaryMin: 800000,
      salaryMax: 1500000,
      description: 'We are looking for an experienced Frontend Developer to join our engineering team and build modern, performant web applications.',
      requirements: '5+ years React/TypeScript experience, strong CSS skills, experience with state management, testing, and CI/CD pipelines.',
      niceToHave: 'Experience with Next.js, Tailwind CSS, or design systems.',
      status: 'ACTIVE',
      deadline: new Date('2026-03-30'),
      createdById: admin.id,
      pipelineStages: {
        create: DEFAULT_STAGES,
      },
    },
    include: { pipelineStages: { orderBy: { order: 'asc' } } },
  });

  const job2 = await prisma.job.create({
    data: {
      organizationId: org.id,
      title: 'UX Designer',
      department: 'Design',
      type: 'FULL_TIME',
      location: 'Remote',
      salaryMin: 600000,
      salaryMax: 1200000,
      description: 'Join our design team to create intuitive and beautiful user experiences for our SaaS products.',
      requirements: '3+ years UX design experience, proficiency in Figma, strong portfolio, user research skills.',
      status: 'ACTIVE',
      deadline: new Date('2026-04-15'),
      createdById: recruiter1.id,
      pipelineStages: {
        create: DEFAULT_STAGES,
      },
    },
    include: { pipelineStages: { orderBy: { order: 'asc' } } },
  });

  const job3 = await prisma.job.create({
    data: {
      organizationId: org.id,
      title: 'Backend Engineer',
      department: 'Engineering',
      type: 'FULL_TIME',
      location: 'Abuja, NG',
      salaryMin: 900000,
      salaryMax: 1800000,
      description: 'We need a backend engineer to build scalable APIs and microservices.',
      requirements: '4+ years Node.js/Python experience, PostgreSQL, REST/GraphQL APIs, Docker.',
      status: 'PAUSED',
      createdById: admin.id,
      pipelineStages: {
        create: DEFAULT_STAGES,
      },
    },
    include: { pipelineStages: { orderBy: { order: 'asc' } } },
  });

  const job4 = await prisma.job.create({
    data: {
      organizationId: org.id,
      title: 'Product Manager',
      department: 'Product',
      type: 'CONTRACT',
      location: 'Lagos, NG',
      description: 'Lead product strategy and roadmap for our ATS platform.',
      requirements: '3+ years PM experience in SaaS, strong analytical skills, excellent communication.',
      status: 'ACTIVE',
      deadline: new Date('2026-03-15'),
      createdById: recruiter1.id,
      pipelineStages: {
        create: DEFAULT_STAGES,
      },
    },
    include: { pipelineStages: { orderBy: { order: 'asc' } } },
  });

  const job5 = await prisma.job.create({
    data: {
      organizationId: org.id,
      title: 'Data Analyst',
      department: 'Analytics',
      type: 'FULL_TIME',
      location: 'Remote',
      description: 'Analyse recruitment data and build dashboards to improve hiring outcomes.',
      requirements: 'SQL proficiency, Python/R, data visualization tools (Tableau/Power BI).',
      status: 'DRAFT',
      createdById: hiringManager.id,
      pipelineStages: {
        create: DEFAULT_STAGES,
      },
    },
    include: { pipelineStages: { orderBy: { order: 'asc' } } },
  });

  const job6 = await prisma.job.create({
    data: {
      organizationId: org.id,
      title: 'DevOps Engineer',
      department: 'Engineering',
      type: 'FULL_TIME',
      location: 'Lagos, NG',
      description: 'Manage CI/CD pipelines, cloud infrastructure, and monitoring.',
      requirements: 'AWS/GCP, Docker, Kubernetes, Terraform, GitHub Actions.',
      status: 'CLOSED',
      createdById: admin.id,
      pipelineStages: {
        create: DEFAULT_STAGES,
      },
    },
    include: { pipelineStages: { orderBy: { order: 'asc' } } },
  });

  // ─── Job Assignments ─────────────────────────────────
  await prisma.jobAssignment.createMany({
    data: [
      { jobId: job1.id, userId: admin.id },
      { jobId: job1.id, userId: recruiter1.id },
      { jobId: job2.id, userId: recruiter1.id },
      { jobId: job3.id, userId: admin.id },
      { jobId: job3.id, userId: hiringManager.id },
      { jobId: job4.id, userId: recruiter1.id },
    ],
  });

  // ─── Applicants ──────────────────────────────────────
  // Helper: get stage ID by name for a job
  const stageId = (job: typeof job1, stageName: string) => {
    const s = job.pipelineStages.find((st) => st.name === stageName);
    if (!s) throw new Error(`Stage "${stageName}" not found for job "${job.title}"`);
    return s.id;
  };

  const applicantsData = [
    // Job 1: Senior Frontend Developer (8 applicants)
    { firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.johnson@email.com', jobId: job1.id, stage: 'Interview', source: 'PORTAL' as const, tags: ['Strong'], linkedinUrl: 'https://linkedin.com/in/sarahjohnson' },
    { firstName: 'David', lastName: 'Okafor', email: 'david.okafor@email.com', jobId: job1.id, stage: 'Applied', source: 'PORTAL' as const, tags: [] },
    { firstName: 'Fatima', lastName: 'Bello', email: 'fatima.bello@email.com', jobId: job1.id, stage: 'Applied', source: 'IMPORTED' as const, tags: [] },
    { firstName: 'John', lastName: 'Adeyemi', email: 'john.adeyemi@email.com', jobId: job1.id, stage: 'Screening', source: 'REFERRAL' as const, tags: ['Referral'] },
    { firstName: 'Amara', lastName: 'Obi', email: 'amara.obi@email.com', jobId: job1.id, stage: 'Screening', source: 'PORTAL' as const, tags: [] },
    { firstName: 'Chidi', lastName: 'Nwosu', email: 'chidi.nwosu@email.com', jobId: job1.id, stage: 'Interview', source: 'PORTAL' as const, tags: ['Top Pick'] },
    { firstName: 'Ngozi', lastName: 'Ekwueme', email: 'ngozi.ekwueme@email.com', jobId: job1.id, stage: 'Offer Sent', source: 'PORTAL' as const, tags: [] },
    { firstName: 'Emeka', lastName: 'Igwe', email: 'emeka.igwe@email.com', jobId: job1.id, stage: 'Applied', source: 'PORTAL' as const, tags: [] },

    // Job 2: UX Designer (5 applicants)
    { firstName: 'Aisha', lastName: 'Suleiman', email: 'aisha.s.applicant@email.com', jobId: job2.id, stage: 'Screening', source: 'PORTAL' as const, tags: [] },
    { firstName: 'Tunde', lastName: 'Williams', email: 'tunde.w@email.com', jobId: job2.id, stage: 'Applied', source: 'IMPORTED' as const, tags: [] },
    { firstName: 'Blessing', lastName: 'Ojo', email: 'blessing.ojo@email.com', jobId: job2.id, stage: 'Interview', source: 'PORTAL' as const, tags: ['Strong'] },
    { firstName: 'Kemi', lastName: 'Adebayo', email: 'kemi.adebayo@email.com', jobId: job2.id, stage: 'Applied', source: 'PORTAL' as const, tags: [] },
    { firstName: 'Yusuf', lastName: 'Mohammed', email: 'yusuf.m@email.com', jobId: job2.id, stage: 'Applied', source: 'REFERRAL' as const, tags: ['Referral'] },

    // Job 3: Backend Engineer (6 applicants)
    { firstName: 'Oluwaseun', lastName: 'Afolabi', email: 'seun.afolabi@email.com', jobId: job3.id, stage: 'Technical', source: 'PORTAL' as const, tags: ['Strong'] },
    { firstName: 'Ibrahim', lastName: 'Musa', email: 'ibrahim.musa@email.com', jobId: job3.id, stage: 'Screening', source: 'PORTAL' as const, tags: [] },
    { firstName: 'Grace', lastName: 'Okonkwo', email: 'grace.okonkwo@email.com', jobId: job3.id, stage: 'Applied', source: 'IMPORTED' as const, tags: [] },
    { firstName: 'Daniel', lastName: 'Chukwu', email: 'daniel.chukwu@email.com', jobId: job3.id, stage: 'Interview', source: 'PORTAL' as const, tags: [] },
    { firstName: 'Halima', lastName: 'Bala', email: 'halima.bala@email.com', jobId: job3.id, stage: 'Hired', source: 'REFERRAL' as const, tags: ['Hired'] },
    { firstName: 'Peter', lastName: 'Ogunleye', email: 'peter.ogunleye@email.com', jobId: job3.id, stage: 'Applied', source: 'PORTAL' as const, tags: [] },

    // Job 4: Product Manager (4 applicants)
    { firstName: 'Chidinma', lastName: 'Eze', email: 'chidinma.eze@email.com', jobId: job4.id, stage: 'Applied', source: 'PORTAL' as const, tags: [] },
    { firstName: 'Oluwatobi', lastName: 'Falade', email: 'tobi.falade@email.com', jobId: job4.id, stage: 'Screening', source: 'PORTAL' as const, tags: [] },
    { firstName: 'Maryam', lastName: 'Abdullahi', email: 'maryam.a@email.com', jobId: job4.id, stage: 'Applied', source: 'IMPORTED' as const, tags: [] },
    { firstName: 'Victor', lastName: 'Nnamdi', email: 'victor.nnamdi@email.com', jobId: job4.id, stage: 'Applied', source: 'PORTAL' as const, tags: [] },

    // Job 6: DevOps Engineer (closed - 3 applicants, all rejected/hired)
    { firstName: 'Sola', lastName: 'Adeyinka', email: 'sola.adeyinka@email.com', jobId: job6.id, stage: 'Hired', source: 'PORTAL' as const, tags: ['Hired'] },
    { firstName: 'Uche', lastName: 'Okoro', email: 'uche.okoro@email.com', jobId: job6.id, stage: 'Applied', source: 'PORTAL' as const, tags: [] },
    { firstName: 'Abdullahi', lastName: 'Garba', email: 'abdullahi.garba@email.com', jobId: job6.id, stage: 'Applied', source: 'IMPORTED' as const, tags: [] },
  ];

  const jobMap: Record<string, typeof job1> = {
    [job1.id]: job1,
    [job2.id]: job2,
    [job3.id]: job3,
    [job4.id]: job4,
    [job5.id]: job5,
    [job6.id]: job6,
  };

  const createdApplicants = [];
  for (const a of applicantsData) {
    const job = jobMap[a.jobId];
    const applicant = await prisma.applicant.create({
      data: {
        organizationId: org.id,
        jobId: a.jobId,
        firstName: a.firstName,
        lastName: a.lastName,
        email: a.email,
        linkedinUrl: a.linkedinUrl,
        currentStageId: stageId(job, a.stage),
        source: a.source,
        tags: a.tags,
      },
    });
    createdApplicants.push({ ...applicant, _stage: a.stage, _jobId: a.jobId });
  }

  // ─── AI Reports (scores for applicants) ──────────────
  const scores: Record<string, { score: number; rec: string; confidence: string }> = {
    'sarah.johnson@email.com': { score: 98, rec: 'ADVANCE', confidence: 'HIGH' },
    'david.okafor@email.com': { score: 85, rec: 'ADVANCE', confidence: 'HIGH' },
    'fatima.bello@email.com': { score: 72, rec: 'CONSIDER_OTHER', confidence: 'MEDIUM' },
    'john.adeyemi@email.com': { score: 91, rec: 'ADVANCE', confidence: 'HIGH' },
    'amara.obi@email.com': { score: 78, rec: 'ADVANCE', confidence: 'MEDIUM' },
    'chidi.nwosu@email.com': { score: 94, rec: 'ADVANCE', confidence: 'HIGH' },
    'ngozi.ekwueme@email.com': { score: 96, rec: 'ADVANCE', confidence: 'HIGH' },
    'emeka.igwe@email.com': { score: 62, rec: 'REQUEST_INFO', confidence: 'LOW' },
    'aisha.s.applicant@email.com': { score: 82, rec: 'ADVANCE', confidence: 'MEDIUM' },
    'tunde.w@email.com': { score: 45, rec: 'REJECT', confidence: 'MEDIUM' },
    'blessing.ojo@email.com': { score: 89, rec: 'ADVANCE', confidence: 'HIGH' },
    'kemi.adebayo@email.com': { score: 68, rec: 'CONSIDER_OTHER', confidence: 'MEDIUM' },
    'yusuf.m@email.com': { score: 74, rec: 'ADVANCE', confidence: 'MEDIUM' },
    'seun.afolabi@email.com': { score: 93, rec: 'ADVANCE', confidence: 'HIGH' },
    'ibrahim.musa@email.com': { score: 76, rec: 'ADVANCE', confidence: 'MEDIUM' },
    'grace.okonkwo@email.com': { score: 58, rec: 'REQUEST_INFO', confidence: 'LOW' },
    'daniel.chukwu@email.com': { score: 87, rec: 'ADVANCE', confidence: 'HIGH' },
    'halima.bala@email.com': { score: 95, rec: 'ADVANCE', confidence: 'HIGH' },
    'peter.ogunleye@email.com': { score: 51, rec: 'CONSIDER_OTHER', confidence: 'LOW' },
    'chidinma.eze@email.com': { score: 79, rec: 'ADVANCE', confidence: 'MEDIUM' },
    'tobi.falade@email.com': { score: 84, rec: 'ADVANCE', confidence: 'HIGH' },
    'maryam.a@email.com': { score: 66, rec: 'REQUEST_INFO', confidence: 'MEDIUM' },
    'victor.nnamdi@email.com': { score: 71, rec: 'CONSIDER_OTHER', confidence: 'MEDIUM' },
    'sola.adeyinka@email.com': { score: 97, rec: 'ADVANCE', confidence: 'HIGH' },
    'uche.okoro@email.com': { score: 54, rec: 'REJECT', confidence: 'MEDIUM' },
    'abdullahi.garba@email.com': { score: 48, rec: 'REJECT', confidence: 'HIGH' },
  };

  for (const applicant of createdApplicants) {
    const s = scores[applicant.email];
    if (s) {
      await prisma.aIReport.create({
        data: {
          applicantId: applicant.id,
          overallScore: s.score,
          dimensionScores: {
            skillsMatch: Math.min(100, s.score + Math.floor(Math.random() * 10) - 5),
            careerTrajectory: Math.min(100, s.score + Math.floor(Math.random() * 15) - 7),
            educationFit: Math.min(100, s.score + Math.floor(Math.random() * 12) - 6),
            culturalFit: Math.min(100, s.score + Math.floor(Math.random() * 10) - 5),
          },
          strengths: ['Relevant experience', 'Strong technical skills', 'Good communication'],
          concerns: s.score < 60 ? ['Limited experience', 'Skills gap'] : [],
          recommendation: s.rec,
          confidenceLevel: s.confidence,
        },
      });
    }
  }

  // ─── Interviews ──────────────────────────────────────
  const sarahApplicant = createdApplicants.find((a) => a.email === 'sarah.johnson@email.com')!;
  const johnApplicant = createdApplicants.find((a) => a.email === 'john.adeyemi@email.com')!;
  const chidiApplicant = createdApplicants.find((a) => a.email === 'chidi.nwosu@email.com')!;
  const blessingApplicant = createdApplicants.find((a) => a.email === 'blessing.ojo@email.com')!;
  const danielApplicant = createdApplicants.find((a) => a.email === 'daniel.chukwu@email.com')!;

  const now = new Date();
  const today10am = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0);
  const today2pm = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0);
  const tomorrow11am = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 11, 0);
  const yesterday3pm = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 15, 0);
  const lastWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5, 9, 30);

  await prisma.interview.createMany({
    data: [
      {
        applicantId: sarahApplicant.id,
        jobId: job1.id,
        type: 'VIDEO_CALL',
        scheduledAt: today10am,
        durationMinutes: 45,
        meetingLink: 'https://meet.google.com/abc-defg-hij',
        interviewerIds: [admin.id],
        status: 'SCHEDULED',
      },
      {
        applicantId: johnApplicant.id,
        jobId: job1.id,
        type: 'VIDEO_CALL',
        scheduledAt: today2pm,
        durationMinutes: 60,
        meetingLink: 'https://meet.google.com/klm-nopq-rst',
        interviewerIds: [recruiter1.id],
        status: 'SCHEDULED',
      },
      {
        applicantId: chidiApplicant.id,
        jobId: job1.id,
        type: 'IN_PERSON',
        scheduledAt: tomorrow11am,
        durationMinutes: 45,
        location: 'WindVeal HQ, Lagos',
        interviewerIds: [admin.id],
        status: 'SCHEDULED',
      },
      {
        applicantId: blessingApplicant.id,
        jobId: job2.id,
        type: 'PHONE_SCREEN',
        scheduledAt: yesterday3pm,
        durationMinutes: 30,
        interviewerIds: [hiringManager.id],
        status: 'COMPLETED',
      },
      {
        applicantId: danielApplicant.id,
        jobId: job3.id,
        type: 'VIDEO_CALL',
        scheduledAt: lastWeek,
        durationMinutes: 45,
        interviewerIds: [recruiter2.id],
        status: 'CANCELLED',
      },
    ],
  });

  // ─── Notifications (for admin) ───────────────────────
  await prisma.notification.createMany({
    data: [
      {
        userId: admin.id,
        type: 'APPLICATION_RECEIVED',
        payload: { applicantName: 'Sarah Johnson', jobTitle: 'Frontend Developer' },
        read: false,
        createdAt: new Date(Date.now() - 2 * 60 * 1000),
      },
      {
        userId: admin.id,
        type: 'INTERVIEW_SCHEDULED',
        payload: { applicantName: 'John Adeyemi', time: 'Tomorrow 2:00 PM' },
        read: false,
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
      },
      {
        userId: admin.id,
        type: 'STAGE_CHANGED',
        payload: { applicantName: 'Amara Obi', fromStage: 'Applied', toStage: 'Screening' },
        read: true,
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
      {
        userId: admin.id,
        type: 'AI_ANALYSIS_COMPLETE',
        payload: { count: 5, jobTitle: 'UX Designer' },
        read: true,
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      },
      {
        userId: admin.id,
        type: 'OFFER_SIGNED',
        payload: { applicantName: 'Halima Bala', jobTitle: 'Backend Engineer' },
        read: true,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    ],
  });

  // ─── Email Templates ─────────────────────────────────
  await prisma.emailTemplate.createMany({
    data: [
      {
        organizationId: org.id,
        name: 'Application Received',
        subject: 'Application Received — {{jobTitle}}',
        body: 'Dear {{firstName}},\n\nThank you for applying for the {{jobTitle}} position at {{companyName}}. We have received your application and will review it shortly.\n\nBest regards,\n{{companyName}} Hiring Team',
        isSystem: true,
      },
      {
        organizationId: org.id,
        name: 'Interview Invitation',
        subject: 'Interview Invitation — {{jobTitle}}',
        body: 'Dear {{firstName}},\n\nWe are pleased to invite you for an interview for the {{jobTitle}} position.\n\nDate: {{interviewDate}}\nTime: {{interviewTime}}\n\nPlease confirm your availability.\n\nBest regards,\n{{companyName}} Hiring Team',
        isSystem: true,
      },
      {
        organizationId: org.id,
        name: 'Rejection',
        subject: 'Update on Your Application — {{jobTitle}}',
        body: 'Dear {{firstName}},\n\nThank you for your interest in the {{jobTitle}} position. After careful review, we have decided to move forward with other candidates.\n\nWe appreciate your time and wish you the best.\n\nBest regards,\n{{companyName}} Hiring Team',
        isSystem: true,
      },
    ],
  });

  // ─── Applicant Notes ─────────────────────────────────
  await prisma.applicantNote.createMany({
    data: [
      { applicantId: sarahApplicant.id, authorId: admin.id, content: 'Outstanding portfolio. Strong React and TypeScript skills. Proceed to interview.' },
      { applicantId: sarahApplicant.id, authorId: recruiter1.id, content: 'Phone screen went very well. Candidate is articulate and enthusiastic.' },
      { applicantId: chidiApplicant.id, authorId: admin.id, content: 'Excellent technical assessment score. Schedule final round.' },
      { applicantId: johnApplicant.id, authorId: recruiter1.id, content: 'Referred by Emeka. Has strong background in Vue but transitioning to React.' },
    ],
  });

  // ─── Offer ───────────────────────────────────────────
  const ngoziApplicant = createdApplicants.find((a) => a.email === 'ngozi.ekwueme@email.com')!;
  await prisma.offer.create({
    data: {
      applicantId: ngoziApplicant.id,
      jobId: job1.id,
      status: 'SENT',
      salary: 1200000,
      startDate: new Date('2026-04-01'),
      conditions: 'Subject to reference check and background verification.',
      sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('✅ Seed complete!');
  console.log('');
  console.log('📊 Created:');
  console.log(`   1 Organization: ${org.name}`);
  console.log(`   5 Users (password: Password123!)`);
  console.log(`   6 Jobs`);
  console.log(`   ${createdApplicants.length} Applicants with AI scores`);
  console.log(`   5 Interviews`);
  console.log(`   5 Notifications`);
  console.log(`   3 Email templates`);
  console.log(`   4 Applicant notes`);
  console.log(`   1 Offer`);
  console.log('');
  console.log('🔑 Login credentials:');
  console.log('   Admin:   james@windveal.com / Password123!');
  console.log('   Recruiter: funmi@windveal.com / Password123!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

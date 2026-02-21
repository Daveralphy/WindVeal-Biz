import prisma from '../../lib/prisma';
import { CreateJobRequest } from '../../types';

export const createJob = async (data: CreateJobRequest, organizationId: string) => {
  return prisma.job.create({
    data: {
      ...data,
      organizationId,
    },
  });
};

export const getJobs = async (organizationId: string) => {
  return prisma.job.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { candidates: true },
      },
    },
  });
};

export const getJobById = async (id: string, organizationId: string) => {
  const job = await prisma.job.findFirst({
    where: { id, organizationId },
    include: {
      _count: {
        select: { candidates: true },
      },
    },
  });

  if (!job) {
    throw new Error('Job not found');
  }

  return job;
};
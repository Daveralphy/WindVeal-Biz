import { FastifyPluginAsync } from 'fastify';
import prisma from '../lib/prisma';

const jobRoutes: FastifyPluginAsync = async (fastify) => {
  // Middleware to check auth
  fastify.addHook('onRequest', async (request) => {
    await request.jwtVerify();
  });

  fastify.get('/', async (request) => {
    const user = request.user as any;
    
    const jobs = await prisma.job.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { candidates: true }
        }
      }
    });

    return jobs.map(job => ({
      ...job,
      candidateCount: job._count.candidates
    }));
  });

  fastify.post('/', async (request) => {
    const user = request.user as any;
    const data = request.body as any;

    const job = await prisma.job.create({
      data: {
        ...data,
        organizationId: user.organizationId,
      },
    });

    return job;
  });

  fastify.get('/:id', async (request) => {
    // Implementation for single job details
  });
};

export default jobRoutes;
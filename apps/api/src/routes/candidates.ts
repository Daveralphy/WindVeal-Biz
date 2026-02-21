import { FastifyPluginAsync } from 'fastify';
import prisma from '../lib/prisma';
import { processCandidateUpload } from '../services/candidates/candidateService';

const candidateRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request) => {
    await request.jwtVerify();
  });

  // Upload resume
  fastify.post('/jobs/:jobId/candidates', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const data = await request.file();
    
    if (!data) {
      return reply.status(400).send({ message: 'No file uploaded' });
    }

    return processCandidateUpload(data, jobId);
  });

  // Get candidates for a job
  fastify.get('/jobs/:jobId/candidates', async (request) => {
    const { jobId } = request.params as { jobId: string };
    
    return prisma.candidate.findMany({
      where: { jobId },
      orderBy: { score: 'desc' },
    });
  });

  // Update stage
  fastify.put('/:id/stage', async (request) => {
    const { id } = request.params as { id: string };
    const { stage } = request.body as { stage: string };

    return prisma.candidate.update({
      where: { id },
      data: { stage: stage as any },
    });
  });
};

export default candidateRoutes;
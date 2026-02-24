import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export async function notificationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // List notifications
  app.get('/', async (request) => {
    const { userId } = request.user!;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return notifications;
  });

  // Mark as read
  app.patch<{ Params: { id: string } }>('/:id/read', async (request, reply) => {
    const { userId } = request.user!;
    const notif = await prisma.notification.findFirst({
      where: { id: request.params.id, userId },
    });
    if (!notif) return reply.status(404).send({ error: 'Not found' });
    await prisma.notification.update({
      where: { id: notif.id },
      data: { read: true },
    });
    return { success: true };
  });

  // Mark all as read
  app.patch('/read-all', async (request) => {
    const { userId } = request.user!;
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { success: true };
  });
}

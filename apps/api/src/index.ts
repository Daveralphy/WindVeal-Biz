import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import sensible from '@fastify/sensible';
import { createReadStream, promises as fsPromises } from 'node:fs';
import path from 'node:path';
import { env } from './config/env.js';
import { authRoutes } from './routes/auth.js';
import { jobRoutes } from './routes/jobs.js';
import { applicantRoutes } from './routes/applicants.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { interviewRoutes } from './routes/interviews.js';
import { teamRoutes } from './routes/team.js';
import { notificationRoutes } from './routes/notifications.js';
import { analyticsRoutes } from './routes/analytics.js';
import { careersRoutes, publicCareersRoutes } from './routes/careers.js';
import { aiRoutes } from './routes/ai.js';
import { chatRoutes } from './routes/chat.js';
import { adminRoutes } from './routes/admin.js';
import { offerRoutes } from './routes/offers.js';
import { inviteRoutes } from './routes/invites.js';
import { oauthRoutes } from './routes/oauth.js';
import prisma from './lib/prisma.js';

// ─── Cleanup: delete unverified accounts older than 7 days ───────────────────
async function cleanupExpiredUnverifiedAccounts() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const expired = await prisma.user.findMany({
    where: { emailVerified: false, createdAt: { lt: cutoff } },
    select: { id: true, organizationId: true },
  });
  for (const user of expired) {
    try {
      const count = await prisma.user.count({ where: { organizationId: user.organizationId } });
      if (count <= 1) {
        await prisma.organization.delete({ where: { id: user.organizationId } });
      } else {
        await prisma.user.delete({ where: { id: user.id } });
      }
    } catch (e) {
      console.error('[cleanup] Failed to delete expired unverified account:', user.id, e);
    }
  }
  if (expired.length > 0) {
    console.log(`[cleanup] Removed ${expired.length} expired unverified account(s)`);
  }
}
cleanupExpiredUnverifiedAccounts();
setInterval(cleanupExpiredUnverifiedAccounts, 60 * 60 * 1000); // every hour

const app = Fastify({
  logger: env.NODE_ENV === 'development',
});

// Plugins
await app.register(sensible);

await app.register(cors, {
  origin: env.CORS_ORIGIN,
  credentials: true,
});

await app.register(cookie);

await app.register(multipart, {
  limits: { fileSize: env.MAX_FILE_SIZE },
});

// Routes
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(oauthRoutes, { prefix: '/api/auth' });
await app.register(jobRoutes, { prefix: '/api/jobs' });
await app.register(applicantRoutes, { prefix: '/api/applicants' });
await app.register(dashboardRoutes, { prefix: '/api/dashboard' });
await app.register(interviewRoutes, { prefix: '/api/interviews' });
await app.register(teamRoutes, { prefix: '/api/team' });
await app.register(notificationRoutes, { prefix: '/api/notifications' });
await app.register(analyticsRoutes, { prefix: '/api/analytics' });
await app.register(careersRoutes, { prefix: '/api/careers' });
await app.register(publicCareersRoutes, { prefix: '/api/public/careers' });
await app.register(aiRoutes, { prefix: '/api/ai' });
await app.register(chatRoutes, { prefix: '/api/chat' });
await app.register(adminRoutes, { prefix: '/api/admin' });
await app.register(offerRoutes, { prefix: '/api/offers' });
await app.register(inviteRoutes, { prefix: '/api/invites' });

// Health check
app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Serve uploaded files
app.get<{ Params: { filename: string } }>('/api/uploads/:filename', async (request, reply) => {
  const { filename } = request.params;
  // Only allow safe filenames
  if (/[/\\]/.test(filename) || filename.includes('..')) {
    return reply.status(400).send({ error: 'Invalid filename' });
  }
  const filePath = path.join(env.UPLOAD_DIR, filename);
  try {
    const stat = await fsPromises.stat(filePath);
    if (!stat.isFile()) throw new Error('Not a file');
  } catch {
    return reply.status(404).send({ error: 'File not found' });
  }
  const ext = path.extname(filename).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska', '.ogg': 'video/ogg',
    '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  reply.header('Content-Type', mimeMap[ext] || 'application/octet-stream');
  reply.header('Cache-Control', 'public, max-age=86400');
  return reply.send(createReadStream(filePath));
});

// Start server
try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`🚀 Server running on http://localhost:${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { env } from './config/env.js';
import { authRoutes } from './routes/auth.js';
import { jobRoutes } from './routes/jobs.js';
import { applicantRoutes } from './routes/applicants.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { interviewRoutes } from './routes/interviews.js';
import { teamRoutes } from './routes/team.js';
import { notificationRoutes } from './routes/notifications.js';
import { analyticsRoutes } from './routes/analytics.js';
import { communicationsRoutes } from './routes/communications.js';
import { careersRoutes } from './routes/careers.js';
import { aiRoutes } from './routes/ai.js';
import { chatRoutes } from './routes/chat.js';

const app = Fastify({
  logger: env.NODE_ENV === 'development',
});

// Plugins
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
await app.register(jobRoutes, { prefix: '/api/jobs' });
await app.register(applicantRoutes, { prefix: '/api/applicants' });
await app.register(dashboardRoutes, { prefix: '/api/dashboard' });
await app.register(interviewRoutes, { prefix: '/api/interviews' });
await app.register(teamRoutes, { prefix: '/api/team' });
await app.register(notificationRoutes, { prefix: '/api/notifications' });
await app.register(analyticsRoutes, { prefix: '/api/analytics' });
await app.register(communicationsRoutes, { prefix: '/api/communications' });
await app.register(careersRoutes, { prefix: '/api/careers' });
await app.register(aiRoutes, { prefix: '/api/ai' });
await app.register(chatRoutes, { prefix: '/api/chat' });

// Health check
app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Start server
try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`🚀 Server running on http://localhost:${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

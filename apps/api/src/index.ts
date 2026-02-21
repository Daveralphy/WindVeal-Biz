import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import authRoutes from './routes/auth';
import jobRoutes from './routes/jobs';
import candidateRoutes from './routes/candidates';
import { errorHandler } from './middleware/errorHandler';

const start = async () => {
  const app = Fastify({
    logger: true,
  });

  // Register plugins
  await app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  });

  await app.register(fastifyCors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  });

  await app.register(fastifyMultipart);

  // Error handler
  app.setErrorHandler(errorHandler);

  // Health check
  app.get('/health', async () => {
    return { status: 'ok' };
  });

  // Routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(jobRoutes, { prefix: '/api/jobs' });
  await app.register(candidateRoutes, { prefix: '/api/candidates' });

  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '0.0.0.0';

  try {
    await app.listen({ port, host });
    console.log(`Server running at http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

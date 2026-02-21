import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { registerSchema, loginSchema } from '../lib/validation';
import { registerUser, loginUser } from '../services/auth/authService';
import { generateTokens } from '../services/auth/tokenService';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Register endpoint
  fastify.post<{ Body: any }>('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validated = registerSchema.parse(request.body);
      const user = await registerUser(validated);
      const tokens = generateTokens(fastify, user);

      return reply.code(201).send({
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          organizationId: user.organizationId,
        },
        ...tokens,
      });
    } catch (error: any) {
      return reply.code(400).send({
        message: error.message || 'Registration failed',
      });
    }
  });

  // Login endpoint
  fastify.post<{ Body: any }>('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validated = loginSchema.parse(request.body);
      const user = await loginUser(validated);
      const tokens = generateTokens(fastify, user);

      return reply.code(200).send({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          organizationId: user.organizationId,
        },
        ...tokens,
      });
    } catch (error: any) {
      return reply.code(401).send({
        message: error.message || 'Login failed',
      });
    }
  });

  // Verify token endpoint
  fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const user = (request.user as any);
      return reply.code(200).send({
        user,
      });
    } catch (error) {
      return reply.code(401).send({
        message: 'Unauthorized',
      });
    }
  });
};

export default authRoutes;

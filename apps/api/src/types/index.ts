import { z } from 'zod';
import { registerSchema, loginSchema, createJobSchema } from '../lib/validation';

export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type CreateJobRequest = z.infer<typeof createJobSchema>;

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyJWT {
    payload: {
      id: string;
      email: string;
      role: string;
      organizationId: string;
    };
    user: {
      id: string;
      email: string;
      role: string;
      organizationId: string;
    };
  }
}
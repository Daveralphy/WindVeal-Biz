import { FastifyInstance } from 'fastify';
import { User } from '@prisma/client';

export const generateTokens = (app: FastifyInstance, user: User) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
  };

  const accessToken = app.jwt.sign(payload, { expiresIn: '15m' });
  
  // In a real app, you might want to store refresh tokens in the DB
  const refreshToken = app.jwt.sign(
    { id: user.id }, 
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};
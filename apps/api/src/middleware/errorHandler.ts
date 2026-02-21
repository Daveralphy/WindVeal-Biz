import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export const errorHandler = (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: 'Validation Error',
      errors: error.flatten().fieldErrors,
    });
  }

  if (error.statusCode) {
    return reply.status(error.statusCode).send({ message: error.message });
  }

  request.log.error(error);
  return reply.status(500).send({ message: 'Internal Server Error' });
};
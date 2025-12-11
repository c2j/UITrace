import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from '@fastify/jwt';

export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticate = async (request: AuthenticatedRequest, reply: FastifyReply) => {
  try {
    await request.jwtVerify();

    // Attach user info to request
    request.user = {
      id: request.user.sub as string,
      email: request.user.email as string,
      role: request.user.role as string,
    };
  } catch (err) {
    reply.send(err);
  }
};

export const authorize = (roles: string[]) => {
  return async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) {
      reply.status(401).send({ error: 'Unauthorized' });
      return;
    }

    if (!roles.includes(request.user.role)) {
      reply.status(403).send({ error: 'Forbidden' });
      return;
    }
  };
};

export const generateToken = (payload: { id: string; email: string; role: string }, secret: string) => {
  const token = require('@fastify/jwt').default.sign(payload, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
  return token;
};
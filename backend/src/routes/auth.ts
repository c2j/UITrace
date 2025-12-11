import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  role?: 'ADMIN' | 'USER' | 'VIEWER';
}

interface LoginRequest {
  email: string;
  password: string;
}

export default async function authRoutes(app: FastifyInstance) {
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

  // Add authenticate decorator
  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  // Helper function to sign JWT
  const signToken = (payload: any) => {
    return app.jwt.sign(payload, {
      secret: JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
  };

  // Register endpoint
  app.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { email, password, name, role } = request.body as RegisterRequest;

      if (!email || !password) {
        return reply.status(400).send({
          error: 'Email and password are required',
        });
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return reply.status(409).send({
          error: 'User already exists',
        });
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name: name || null,
          role: (role || 'USER') as any,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      });

      // Generate JWT
      const token = signToken({ sub: user.id, email: user.email, role: user.role });

      return reply.send({
        success: true,
        data: {
          user,
          token,
          expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        },
      });
    } catch (error) {
      console.error('Registration error:', error);
      return reply.status(500).send({
        error: 'Registration failed',
      });
    }
  });

  // Login endpoint
  app.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { email, password } = request.body as LoginRequest;

      if (!email || !password) {
        return reply.status(400).send({
          error: 'Email and password are required',
        });
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return reply.status(401).send({
          error: 'Invalid credentials',
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        return reply.status(401).send({
          error: 'Invalid credentials',
        });
      }

      // Generate JWT
      const token = signToken({ sub: user.id, email: user.email, role: user.role });

      return reply.send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            createdAt: user.createdAt,
          },
          token,
          expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      return reply.status(500).send({
        error: 'Login failed',
      });
    }
  });

  // Logout endpoint
  app.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    // In a real implementation, you might want to blacklist the token
    // For now, just return success
    return reply.send({
      success: true,
      message: 'Logged out successfully',
    });
  });

  // Get current user endpoint
  app.get('/me', { preHandler: [app.authenticate] }, async (request: any, reply: FastifyReply) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: request.user.sub },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });

      if (!user) {
        return reply.status(404).send({
          error: 'User not found',
        });
      }

      return reply.send({
        success: true,
        data: user,
      });
    } catch (error) {
      console.error('Get user error:', error);
      return reply.status(500).send({
        error: 'Failed to get user',
      });
    }
  });
}

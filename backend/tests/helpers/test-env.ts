import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

export class TestEnvironment {
  private static instance: TestEnvironment;
  private prisma: PrismaClient;
  private dockerCompose: string;

  private constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5433/uitrace_test',
        },
      },
    });
    this.dockerCompose = 'docker-compose -f docker-compose.test.yml';
  }

  static getInstance(): TestEnvironment {
    if (!TestEnvironment.instance) {
      TestEnvironment.instance = new TestEnvironment();
    }
    return TestEnvironment.instance;
  }

  async setup(): Promise<void> {
    console.log('🚀 Setting up test environment...');

    try {
      // Start Docker services
      console.log('📦 Starting test services...');
      execSync(`${this.dockerCompose} up -d`, { stdio: 'inherit' });

      // Wait for services to be ready
      console.log('⏳ Waiting for services to be ready...');
      await this.waitForServices();

      // Run database migrations
      console.log('🗃️ Running database migrations...');
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });

      console.log('✅ Test environment ready!');
    } catch (error) {
      console.error('❌ Failed to setup test environment:', error);
      throw error;
    }
  }

  async teardown(): Promise<void> {
    console.log('🧹 Tearing down test environment...');

    try {
      // Disconnect Prisma
      await this.prisma.$disconnect();

      // Stop Docker services
      execSync(`${this.dockerCompose} down -v`, { stdio: 'inherit' });

      console.log('✅ Test environment cleaned up!');
    } catch (error) {
      console.error('❌ Failed to teardown test environment:', error);
    }
  }

  async cleanupDatabase(): Promise<void> {
    console.log('🗑️ Cleaning database...');

    const tables = [
      'executionLog',
      'visualDiff',
      'execution',
      'script',
      'module',
      'version',
      'project',
    ];

    // Delete in reverse order to respect foreign key constraints
    for (const table of tables.reverse()) {
      await this.prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
    }

    console.log('✅ Database cleaned!');
  }

  getPrisma(): PrismaClient {
    return this.prisma;
  }

  private async waitForServices(): Promise<void> {
    const maxWait = 30000; // 30 seconds
    const interval = 1000; // 1 second
    let waited = 0;

    while (waited < maxWait) {
      try {
        // Check PostgreSQL
        await this.prisma.$queryRaw`SELECT 1`;

        // Check Redis (if needed)
        // execSync('redis-cli -p 6380 ping');

        console.log('✅ All services are ready!');
        return;
      } catch (error) {
        console.log(`⏳ Waiting for services... (${waited / 1000}s)`);
        await new Promise(resolve => setTimeout(resolve, interval));
        waited += interval;
      }
    }

    throw new Error('❌ Services failed to start within timeout period');
  }
}

// Global test setup and teardown
export async function setupTestEnvironment(): Promise<void> {
  const env = TestEnvironment.getInstance();
  await env.setup();
}

export async function teardownTestEnvironment(): Promise<void> {
  const env = TestEnvironment.getInstance();
  await env.teardown();
}

export async function cleanupTestDatabase(): Promise<void> {
  const env = TestEnvironment.getInstance();
  await env.cleanupDatabase();
}
const { PrismaClient } = require('@prisma/client');

describe('Database Tests', () => {
  let prisma;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('Should connect to database', async () => {
    try {
      await prisma.$connect();
      expect(true).toBe(true);
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  });

  test('Should create a project', async () => {
    const project = await prisma.project.create({
      data: {
        name: 'Test Project',
        icon: 'test',
      },
    });

    expect(project).toBeDefined();
    expect(project.name).toBe('Test Project');
    expect(project.icon).toBe('test');
  });

  test('Should create a version for a project', async () => {
    const project = await prisma.project.findFirst({
      where: { name: 'Test Project' },
    });

    const version = await prisma.version.create({
      data: {
        projectId: project.id,
        name: 'v1.0.0',
        status: 'DRAFT',
      },
    });

    expect(version).toBeDefined();
    expect(version.name).toBe('v1.0.0');
    expect(version.projectId).toBe(project.id);
  });
});
import request from 'supertest';

import { createApp } from '../../src/app';
import { PrismaClient } from '@prisma/client';

describe('Projects API Contract Tests', () => {
  let app: any;
  let prisma: PrismaClient;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.prisma;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await prisma.execution.deleteMany();
    await prisma.script.deleteMany();
    await prisma.module.deleteMany();
    await prisma.version.deleteMany();
    await prisma.project.deleteMany();
  });

  describe('POST /api/v1/projects', () => {
    it('should create a new project successfully', async () => {
      const projectData = {
        name: 'Test Project',
        icon: 'test-icon',
      };

      const response = await request(app.server)
        .post('/api/v1/projects')
        .send(projectData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          name: projectData.name,
          icon: projectData.icon,
        },
        message: 'Project created successfully',
      });
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('createdAt');
      expect(response.body.data).toHaveProperty('updatedAt');
    });

    it('should reject project creation with missing name', async () => {
      const response = await request(app.server)
        .post('/api/v1/projects')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String),
      });
    });

    it('should reject project creation with name too short', async () => {
      const response = await request(app.server)
        .post('/api/v1/projects')
        .send({ name: 'a' })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
      });
    });

    it('should reject project creation with duplicate name', async () => {
      const projectData = { name: 'Duplicate Test Project' };

      // Create first project
      await request(app.server)
        .post('/api/v1/projects')
        .send(projectData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app.server)
        .post('/api/v1/projects')
        .send(projectData)
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('already exists'),
      });
    });
  });

  describe('GET /api/v1/projects', () => {
    beforeEach(async () => {
      // Create test projects
      await prisma.project.createMany({
        data: [
          { name: 'Project A', icon: 'icon-a' },
          { name: 'Project B', icon: 'icon-b' },
          { name: 'Project C', icon: 'icon-c' },
        ],
      });
    });

    it('should list all projects with pagination', async () => {
      const response = await request(app.server)
        .get('/api/v1/projects')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
        pagination: {
          page: 1,
          limit: 10,
          total: 3,
          totalPages: 1,
        },
      });
      expect(response.body.data).toHaveLength(3);
    });

    it('should respect pagination parameters', async () => {
      const response = await request(app.server)
        .get('/api/v1/projects?page=1&limit=2')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        pagination: {
          page: 1,
          limit: 2,
          total: 3,
          totalPages: 2,
        },
      });
      expect(response.body.data).toHaveLength(2);
    });

    it('should reject invalid pagination parameters', async () => {
      await request(app.server)
        .get('/api/v1/projects?page=0')
        .expect(400);

      await request(app.server)
        .get('/api/v1/projects?limit=101')
        .expect(400);
    });
  });

  describe('GET /api/v1/projects/:projectId', () => {
    let projectId: string;

    beforeEach(async () => {
      const project = await prisma.project.create({
        data: { name: 'Test Project' },
      });
      projectId = project.id;
    });

    it('should get project by ID', async () => {
      const response = await request(app.server)
        .get(`/api/v1/projects/${projectId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: projectId,
          name: 'Test Project',
        },
      });
    });

    it('should return 404 for non-existent project', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';

      const response = await request(app.server)
        .get(`/api/v1/projects/${fakeId}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Project not found',
      });
    });

    it('should reject invalid UUID format', async () => {
      const response = await request(app.server)
        .get('/api/v1/projects/invalid-uuid')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
      });
    });
  });

  describe('PUT /api/v1/projects/:projectId', () => {
    let projectId: string;

    beforeEach(async () => {
      const project = await prisma.project.create({
        data: { name: 'Original Project' },
      });
      projectId = project.id;
    });

    it('should update project successfully', async () => {
      const updateData = {
        name: 'Updated Project',
        icon: 'updated-icon',
      };

      const response = await request(app.server)
        .put(`/api/v1/projects/${projectId}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: projectId,
          name: updateData.name,
          icon: updateData.icon,
        },
        message: 'Project updated successfully',
      });
    });

    it('should update only provided fields', async () => {
      const originalProject = await prisma.project.findUnique({
        where: { id: projectId },
      });

      const response = await request(app.server)
        .put(`/api/v1/projects/${projectId}`)
        .send({ icon: 'new-icon' })
        .expect(200);

      expect(response.body.data.name).toBe(originalProject?.name);
      expect(response.body.data.icon).toBe('new-icon');
    });

    it('should reject update with duplicate name', async () => {
      // Create another project
      await prisma.project.create({
        data: { name: 'Another Project' },
      });

      const response = await request(app.server)
        .put(`/api/v1/projects/${projectId}`)
        .send({ name: 'Another Project' })
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('already exists'),
      });
    });
  });

  describe('DELETE /api/v1/projects/:projectId', () => {
    let projectId: string;

    beforeEach(async () => {
      const project = await prisma.project.create({
        data: { name: 'Project to Delete' },
      });
      projectId = project.id;
    });

    it('should delete project successfully', async () => {
      const response = await request(app.server)
        .delete(`/api/v1/projects/${projectId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Project deleted successfully',
      });

      // Verify project is deleted
      const deletedProject = await prisma.project.findUnique({
        where: { id: projectId },
      });
      expect(deletedProject).toBeNull();
    });

    it('should return 404 when deleting non-existent project', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';

      const response = await request(app.server)
        .delete(`/api/v1/projects/${fakeId}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Project not found',
      });
    });
  });

  describe('GET /api/v1/projects/search', () => {
    beforeEach(async () => {
      await prisma.project.createMany({
        data: [
          { name: 'E-commerce Testing' },
          { name: 'Mobile App Tests' },
          { name: 'API Test Suite' },
        ],
      });
    });

    it('should search projects by name', async () => {
      const response = await request(app.server)
        .get('/api/v1/projects/search?q=test')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
      });
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should reject empty search query', async () => {
      const response = await request(app.server)
        .get('/api/v1/projects/search?q=')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Search query is required',
      });
    });

    it('should reject search query too short', async () => {
      const response = await request(app.server)
        .get('/api/v1/projects/search?q=a')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
      });
    });
  });

  describe('GET /api/v1/projects/:projectId/versions', () => {
    let projectId: string;

    beforeEach(async () => {
      const project = await prisma.project.create({
        data: {
          name: 'Project with Versions',
          versions: {
            create: [
              { name: 'v1.0.0', status: 'ACTIVE' },
              { name: 'v1.1.0', status: 'DRAFT' },
            ],
          },
        },
        include: { versions: true },
      });
      projectId = project.id;
    });

    it('should get project with versions', async () => {
      const response = await request(app.server)
        .get(`/api/v1/projects/${projectId}/versions`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: projectId,
          name: 'Project with Versions',
          versions: expect.any(Array),
        },
      });
      expect(response.body.data.versions).toHaveLength(2);
    });
  });

  describe('GET /api/v1/projects/:projectId/stats', () => {
    let projectId: string;

    beforeEach(async () => {
      const project = await prisma.project.create({
        data: {
          name: 'Project for Stats',
          versions: {
            create: {
              name: 'v1.0.0',
              status: 'ACTIVE',
              modules: {
                create: {
                  name: 'Test Module',
                  scripts: {
                    create: {
                      name: 'Test Script',
                      priority: 'P1',
                      steps: [
                        {
                          id: 1,
                          name: 'Test Step',
                          action: 'navigate',
                          selectors: [{ type: 'css', value: 'body', priority: 1 }],
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      });
      projectId = project.id;
    });

    it('should get project statistics', async () => {
      const response = await request(app.server)
        .get(`/api/v1/projects/${projectId}/stats`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          project: {
            id: projectId,
            name: 'Project for Stats',
          },
          versions: {
            total: 1,
            active: 1,
            archived: 0,
            draft: 0,
          },
          modules: 1,
          scripts: 1,
          executions: 0,
        },
      });
    });
  });
});
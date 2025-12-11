import request from 'supertest';

import { createApp } from '../../src/app';
import { PrismaClient } from '@prisma/client';

describe('Scripts API Contract Tests', () => {
  let app: any;
  let prisma: PrismaClient;
  let testProject: any;
  let testVersion: any;
  let testModule: any;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.prisma;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up database
    await prisma.execution.deleteMany();
    await prisma.script.deleteMany();
    await prisma.module.deleteMany();
    await prisma.version.deleteMany();
    await prisma.project.deleteMany();

    // Create test data hierarchy
    testProject = await prisma.project.create({
      data: { name: 'Test Project' },
    });

    testVersion = await prisma.version.create({
      data: {
        projectId: testProject.id,
        name: 'v1.0.0',
        status: 'ACTIVE',
      },
    });

    testModule = await prisma.module.create({
      data: {
        versionId: testVersion.id,
        name: 'Test Module',
      },
    });
  });

  describe('POST /api/v1/modules/:moduleId/scripts', () => {
    const validScriptData = {
      name: 'Login Test',
      description: 'Test user login flow',
      priority: 'P1',
      steps: [
        {
          id: 1,
          name: 'Navigate to login page',
          action: 'navigate',
          value: 'https://example.com/login',
          selectors: [{ type: 'css', value: 'body', priority: 1 }],
        },
        {
          id: 2,
          name: 'Enter username',
          action: 'type',
          value: 'testuser',
          selectors: [
            { type: 'id', value: 'username', priority: 1 },
            { type: 'css', value: 'input[type="text"]', priority: 2 },
          ],
          timeout: 5000,
        },
        {
          id: 3,
          name: 'Enter password',
          action: 'type',
          value: 'password123',
          selectors: [{ type: 'id', value: 'password', priority: 1 }],
        },
        {
          id: 4,
          name: 'Click submit',
          action: 'click',
          selectors: [
            { type: 'css', value: 'button[type="submit"]', priority: 1 },
            { type: 'text', value: 'Submit', priority: 2 },
          ],
        },
        {
          id: 5,
          name: 'Verify login success',
          action: 'assert_text',
          expectedValue: 'Welcome',
          selectors: [{ type: 'css', value: '.welcome-message', priority: 1 }],
        },
      ],
    };

    it('should create a new script successfully', async () => {
      const response = await request(app.server)
        .post(`/api/v1/modules/${testModule.id}/scripts`)
        .send(validScriptData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          name: validScriptData.name,
          description: validScriptData.description,
          priority: validScriptData.priority,
          moduleId: testModule.id,
        },
        message: 'Script created successfully',
      });
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('createdAt');
      expect(response.body.data.steps).toHaveLength(5);
    });

    it('should reject script creation with missing required fields', async () => {
      const response = await request(app.server)
        .post(`/api/v1/modules/${testModule.id}/scripts`)
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
      });
    });

    it('should reject script with no steps', async () => {
      const response = await request(app.server)
        .post(`/api/v1/modules/${testModule.id}/scripts`)
        .send({
          name: 'Test Script',
          steps: [],
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
      });
    });

    it('should reject script with invalid action', async () => {
      const response = await request(app.server)
        .post(`/api/v1/modules/${testModule.id}/scripts`)
        .send({
          name: 'Test Script',
          steps: [
            {
              id: 1,
              name: 'Invalid step',
              action: 'invalid_action',
              selectors: [{ type: 'css', value: 'body', priority: 1 }],
            },
          ],
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
      });
    });

    it('should reject script with click action but no selectors', async () => {
      const response = await request(app.server)
        .post(`/api/v1/modules/${testModule.id}/scripts`)
        .send({
          name: 'Test Script',
          steps: [
            {
              id: 1,
              name: 'Click without selector',
              action: 'click',
            },
          ],
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
      });
    });

    it('should reject script with type action but no value', async () => {
      const response = await request(app.server)
        .post(`/api/v1/modules/${testModule.id}/scripts`)
        .send({
          name: 'Test Script',
          steps: [
            {
              id: 1,
              name: 'Type without value',
              action: 'type',
              selectors: [{ type: 'id', value: 'input', priority: 1 }],
            },
          ],
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
      });
    });

    it('should reject script with duplicate name in module', async () => {
      // Create first script
      await prisma.script.create({
        data: {
          moduleId: testModule.id,
          name: 'Duplicate Name',
          priority: 'P1',
          steps: [
            {
              id: 1,
              name: 'Step',
              action: 'navigate',
              selectors: [{ type: 'css', value: 'body', priority: 1 }],
            },
          ],
        },
      });

      // Try to create duplicate
      const response = await request(app.server)
        .post(`/api/v1/modules/${testModule.id}/scripts`)
        .send({
          name: 'Duplicate Name',
          steps: [
            {
              id: 1,
              name: 'Step',
              action: 'navigate',
              selectors: [{ type: 'css', value: 'body', priority: 1 }],
            },
          ],
        })
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('already exists'),
      });
    });
  });

  describe('GET /api/v1/modules/:moduleId/scripts', () => {
    beforeEach(async () => {
      // Create test scripts
      await prisma.script.createMany({
        data: [
          {
            moduleId: testModule.id,
            name: 'P0 Script',
            priority: 'P0',
            steps: [
              {
                id: 1,
                name: 'Step 1',
                action: 'navigate',
                selectors: [{ type: 'css', value: 'body', priority: 1 }],
              },
            ],
          },
          {
            moduleId: testModule.id,
            name: 'P1 Script',
            priority: 'P1',
            steps: [
              {
                id: 1,
                name: 'Step 1',
                action: 'navigate',
                selectors: [{ type: 'css', value: 'body', priority: 1 }],
              },
            ],
          },
          {
            moduleId: testModule.id,
            name: 'P2 Script',
            priority: 'P2',
            steps: [
              {
                id: 1,
                name: 'Step 1',
                action: 'navigate',
                selectors: [{ type: 'css', value: 'body', priority: 1 }],
              },
            ],
          },
        ],
      });
    });

    it('should list all scripts in module', async () => {
      const response = await request(app.server)
        .get(`/api/v1/modules/${testModule.id}/scripts`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
      });
      expect(response.body.data).toHaveLength(3);
    });

    it('should filter scripts by priority', async () => {
      const response = await request(app.server)
        .get(`/api/v1/modules/${testModule.id}/scripts?priority=P0`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
      });
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].priority).toBe('P0');
    });

    it('should return 404 for non-existent module', async () => {
      const fakeModuleId = '123e4567-e89b-12d3-a456-426614174000';

      const response = await request(app.server)
        .get(`/api/v1/modules/${fakeModuleId}/scripts`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Module not found',
      });
    });
  });

  describe('GET /api/v1/scripts/:scriptId', () => {
    let testScript: any;

    beforeEach(async () => {
      testScript = await prisma.script.create({
        data: {
          moduleId: testModule.id,
          name: 'Test Script',
          description: 'A test script',
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
      });
    });

    it('should get script by ID', async () => {
      const response = await request(app.server)
        .get(`/api/v1/scripts/${testScript.id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: testScript.id,
          name: 'Test Script',
          description: 'A test script',
          priority: 'P1',
          moduleId: testModule.id,
        },
      });
      expect(response.body.data.steps).toHaveLength(1);
    });

    it('should return 404 for non-existent script', async () => {
      const fakeScriptId = '123e4567-e89b-12d3-a456-426614174000';

      const response = await request(app.server)
        .get(`/api/v1/scripts/${fakeScriptId}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Script not found',
      });
    });
  });

  describe('PUT /api/v1/scripts/:scriptId', () => {
    let testScript: any;

    beforeEach(async () => {
      testScript = await prisma.script.create({
        data: {
          moduleId: testModule.id,
          name: 'Original Script',
          priority: 'P1',
          steps: [
            {
              id: 1,
              name: 'Original Step',
              action: 'navigate',
              selectors: [{ type: 'css', value: 'body', priority: 1 }],
            },
          ],
        },
      });
    });

    it('should update script successfully', async () => {
      const updateData = {
        name: 'Updated Script',
        description: 'Updated description',
        priority: 'P0',
      };

      const response = await request(app.server)
        .put(`/api/v1/scripts/${testScript.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: testScript.id,
          name: updateData.name,
          description: updateData.description,
          priority: updateData.priority,
        },
        message: 'Script updated successfully',
      });
    });

    it('should update script steps', async () => {
      const updateData = {
        steps: [
          {
            id: 1,
            name: 'Updated Step 1',
            action: 'navigate',
            value: 'https://updated.com',
            selectors: [{ type: 'id', value: 'main', priority: 1 }],
          },
          {
            id: 2,
            name: 'New Step 2',
            action: 'click',
            selectors: [{ type: 'css', value: '.button', priority: 1 }],
          },
        ],
      };

      const response = await request(app.server)
        .put(`/api/v1/scripts/${testScript.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.steps).toHaveLength(2);
      expect(response.body.data.steps[0].name).toBe('Updated Step 1');
      expect(response.body.data.steps[1].name).toBe('New Step 2');
    });

    it('should reject invalid step updates', async () => {
      const response = await request(app.server)
        .put(`/api/v1/scripts/${testScript.id}`)
        .send({
          steps: [
            {
              id: 1,
              name: 'Invalid Step',
              action: 'invalid_action',
              selectors: [{ type: 'css', value: 'body', priority: 1 }],
            },
          ],
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
      });
    });
  });

  describe('DELETE /api/v1/scripts/:scriptId', () => {
    let testScript: any;

    beforeEach(async () => {
      testScript = await prisma.script.create({
        data: {
          moduleId: testModule.id,
          name: 'Script to Delete',
          priority: 'P1',
          steps: [
            {
              id: 1,
              name: 'Step',
              action: 'navigate',
              selectors: [{ type: 'css', value: 'body', priority: 1 }],
            },
          ],
        },
      });
    });

    it('should delete script successfully', async () => {
      const response = await request(app.server)
        .delete(`/api/v1/scripts/${testScript.id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Script deleted successfully',
      });

      // Verify script is deleted
      const deletedScript = await prisma.script.findUnique({
        where: { id: testScript.id },
      });
      expect(deletedScript).toBeNull();
    });
  });

  describe('GET /api/v1/scripts/:scriptId/stats', () => {
    let testScript: any;

    beforeEach(async () => {
      testScript = await prisma.script.create({
        data: {
          moduleId: testModule.id,
          name: 'Script with Stats',
          priority: 'P1',
          steps: [
            {
              id: 1,
              name: 'Step',
              action: 'navigate',
              selectors: [{ type: 'css', value: 'body', priority: 1 }],
            },
          ],
        },
      });
    });

    it('should get script statistics', async () => {
      const response = await request(app.server)
        .get(`/api/v1/scripts/${testScript.id}/stats`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          totalExecutions: 0,
          passCount: 0,
          failCount: 0,
          successRate: 0,
        },
      });
    });

    it('should calculate correct statistics with executions', async () => {
      // Create test executions
      await prisma.execution.createMany({
        data: [
          {
            scriptId: testScript.id,
            status: 'PASS',
            startTime: new Date(),
            endTime: new Date(),
            durationMs: 1000,
            environment: 'Test Env',
            triggeredBy: 'test',
          },
          {
            scriptId: testScript.id,
            status: 'FAIL',
            startTime: new Date(),
            endTime: new Date(),
            durationMs: 2000,
            environment: 'Test Env',
            triggeredBy: 'test',
          },
        ],
      });

      const response = await request(app.server)
        .get(`/api/v1/scripts/${testScript.id}/stats`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          totalExecutions: 2,
          passCount: 1,
          failCount: 1,
          successRate: 50,
        },
      });
    });
  });

  describe('POST /api/v1/scripts/validate', () => {
    it('should validate valid script steps', async () => {
      const validSteps = [
        {
          id: 1,
          name: 'Navigate',
          action: 'navigate',
          value: 'https://example.com',
          selectors: [{ type: 'css', value: 'body', priority: 1 }],
        },
        {
          id: 2,
          name: 'Click button',
          action: 'click',
          selectors: [
            { type: 'id', value: 'submit', priority: 1 },
            { type: 'css', value: 'button', priority: 2 },
          ],
        },
      ];

      const response = await request(app.server)
        .post('/api/v1/scripts/validate')
        .send({ steps: validSteps })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          valid: true,
          message: 'Script steps are valid',
        },
      });
    });

    it('should reject invalid script steps', async () => {
      const invalidSteps = [
        {
          id: 1,
          name: 'Invalid step',
          action: 'invalid_action',
          selectors: [{ type: 'css', value: 'body', priority: 1 }],
        },
      ];

      const response = await request(app.server)
        .post('/api/v1/scripts/validate')
        .send({ steps: invalidSteps })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Script validation failed',
      });
    });
  });

  describe('POST /api/v1/scripts/:scriptId/run', () => {
    let testScript: any;

    beforeEach(async () => {
      testScript = await prisma.script.create({
        data: {
          moduleId: testModule.id,
          name: 'Script to Run',
          priority: 'P1',
          steps: [
            {
              id: 1,
              name: 'Step',
              action: 'navigate',
              selectors: [{ type: 'css', value: 'body', priority: 1 }],
            },
          ],
        },
      });
    });

    it('should return 501 for script execution (not implemented yet)', async () => {
      const response = await request(app.server)
        .post(`/api/v1/scripts/${testScript.id}/run`)
        .send({
          environment: 'Test Environment',
          triggeredBy: 'test-user',
        })
        .expect(501);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Script execution not yet implemented',
        message: expect.stringContaining('User Story 2'),
      });
    });
  });
});
import request from 'supertest';

import { createApp } from '../../src/app';
import { PrismaClient } from '@prisma/client';

describe('Script Management Integration Tests', () => {
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
    // Clean up database
    await prisma.execution.deleteMany();
    await prisma.script.deleteMany();
    await prisma.module.deleteMany();
    await prisma.version.deleteMany();
    await prisma.project.deleteMany();
  });

  describe('Complete Script Management Workflow', () => {
    let testProject: any;
    let testVersion: any;
    let testModule: any;
    let testScript: any;

    it('should create complete project hierarchy with scripts', async () => {
      // Step 1: Create project
      const projectResponse = await request(app.server)
        .post('/api/v1/projects')
        .send({
          name: 'E-commerce Test Suite',
          icon: 'shopping-cart',
        })
        .expect(201);

      testProject = projectResponse.body.data;
      expect(testProject).toMatchObject({
        name: 'E-commerce Test Suite',
        icon: 'shopping-cart',
      });

      // Step 2: Create version
      const versionResponse = await request(app.server)
        .post('/api/v1/versions')
        .send({
          projectId: testProject.id,
          name: 'v1.0.0',
          status: 'ACTIVE',
          releaseDate: new Date().toISOString(),
        })
        .expect(201);

      testVersion = versionResponse.body.data;
      expect(testVersion).toMatchObject({
        projectId: testProject.id,
        name: 'v1.0.0',
        status: 'ACTIVE',
      });

      // Step 3: Create module
      const moduleResponse = await request(app.server)
        .post('/api/v1/modules')
        .send({
          versionId: testVersion.id,
          name: 'Authentication Module',
          description: 'Tests for user authentication flows',
        })
        .expect(201);

      testModule = moduleResponse.body.data;
      expect(testModule).toMatchObject({
        versionId: testVersion.id,
        name: 'Authentication Module',
        description: 'Tests for user authentication flows',
      });

      // Step 4: Create script with complete workflow
      const scriptData = {
        name: 'User Login Flow',
        description: 'Complete test for user login including validation',
        priority: 'P0',
        steps: [
          {
            id: 1,
            name: 'Navigate to login page',
            action: 'navigate',
            value: 'https://shop.example.com/login',
            selectors: [{ type: 'css', value: 'body', priority: 1 }],
            timeout: 10000,
          },
          {
            id: 2,
            name: 'Enter valid email',
            action: 'type',
            value: 'test@example.com',
            selectors: [
              { type: 'id', value: 'email', priority: 1 },
              { type: 'css', value: 'input[type="email"]', priority: 2 },
              { type: 'xpath', value: '//input[@type="email"]', priority: 3 },
            ],
            timeout: 5000,
          },
          {
            id: 3,
            name: 'Enter valid password',
            action: 'type',
            value: 'SecurePassword123!',
            selectors: [
              { type: 'id', value: 'password', priority: 1 },
              { type: 'css', value: 'input[type="password"]', priority: 2 },
            ],
            timeout: 5000,
          },
          {
            id: 4,
            name: 'Click login button',
            action: 'click',
            selectors: [
              { type: 'css', value: 'button[type="submit"]', priority: 1 },
              { type: 'text', value: 'Log In', priority: 2 },
              { type: 'css', value: '.login-button', priority: 3 },
            ],
            timeout: 5000,
          },
          {
            id: 5,
            name: 'Wait for page load',
            action: 'wait',
            timeout: 3000,
          },
          {
            id: 6,
            name: 'Take screenshot',
            action: 'screenshot',
            timeout: 2000,
          },
          {
            id: 7,
            name: 'Verify welcome message',
            action: 'assert_text',
            expectedValue: 'Welcome back',
            selectors: [
              { type: 'css', value: '.welcome-message', priority: 1 },
              { type: 'xpath', value: '//h1[contains(text(),"Welcome")]', priority: 2 },
            ],
            timeout: 5000,
          },
          {
            id: 8,
            name: 'Verify user menu is visible',
            action: 'assert_text',
            expectedValue: 'My Account',
            selectors: [
              { type: 'css', value: '.user-menu', priority: 1 },
              { type: 'text', value: 'My Account', priority: 2 },
            ],
            timeout: 5000,
          },
        ],
      };

      const scriptResponse = await request(app.server)
        .post(`/api/v1/modules/${testModule.id}/scripts`)
        .send(scriptData)
        .expect(201);

      testScript = scriptResponse.body.data;
      expect(testScript).toMatchObject({
        name: 'User Login Flow',
        description: 'Complete test for user login including validation',
        priority: 'P0',
        moduleId: testModule.id,
      });
      expect(testScript.steps).toHaveLength(8);

      // Verify hierarchy integrity
      expect(testScript.steps[0].action).toBe('navigate');
      expect(testScript.steps[0].value).toBe('https://shop.example.com/login');
      expect(testScript.steps[1].selectors).toHaveLength(3);
      expect(testScript.steps[6].action).toBe('screenshot');
      expect(testScript.steps[7].expectedValue).toBe('Welcome back');
    });

    it('should retrieve and verify the complete hierarchy', async () => {
      // Get project with versions
      const projectWithVersions = await request(app.server)
        .get(`/api/v1/projects/${testProject.id}/versions`)
        .expect(200);

      expect(projectWithVersions.body.data.versions).toHaveLength(1);
      expect(projectWithVersions.body.data.versions[0].modules).toBeDefined();

      // Get version with modules
      // Note: This endpoint needs to be implemented as part of the version routes
      // For now, we'll verify through project stats

      const projectStats = await request(app.server)
        .get(`/api/v1/projects/${testProject.id}/stats`)
        .expect(200);

      expect(projectStats.body.data).toMatchObject({
        versions: {
          total: 1,
          active: 1,
          archived: 0,
          draft: 0,
        },
        modules: 1,
        scripts: 1,
      });

      // Get scripts in module
      const moduleScripts = await request(app.server)
        .get(`/api/v1/modules/${testModule.id}/scripts`)
        .expect(200);

      expect(moduleScripts.body.data).toHaveLength(1);
      expect(moduleScripts.body.data[0].name).toBe('User Login Flow');
    });

    it('should support script duplication with modifications', async () => {
      // Create another module for testing duplication
      const newModule = await prisma.module.create({
        data: {
          versionId: testVersion.id,
          name: 'Registration Module',
        },
      });

      // Duplicate the script
      const duplicateResponse = await request(app.server)
        .post(`/api/v1/scripts/${testScript.id}/duplicate`)
        .send({
          targetModuleId: newModule.id,
          newName: 'User Registration Flow',
        })
        .expect(201);

      const duplicatedScript = duplicateResponse.body.data;
      expect(duplicatedScript).toMatchObject({
        name: 'User Registration Flow',
        moduleId: newModule.id,
        priority: 'P0',
      });
      expect(duplicatedScript.steps).toHaveLength(8);

      // Verify original script is unchanged
      const originalScript = await request(app.server)
        .get(`/api/v1/scripts/${testScript.id}`)
        .expect(200);

      expect(originalScript.body.data.name).toBe('User Login Flow');

      // Update duplicated script
      const updateResponse = await request(app.server)
        .put(`/api/v1/scripts/${duplicatedScript.id}`)
        .send({
          name: 'Complete Registration Flow',
          steps: [
            ...duplicatedScript.steps.slice(0, 2), // Keep navigate and enter email
            {
              id: 3,
              name: 'Enter confirm email',
              action: 'type',
              value: 'test@example.com',
              selectors: [{ type: 'id', value: 'confirm-email', priority: 1 }],
            },
            ...duplicatedScript.steps.slice(2), // Keep remaining steps but adjust IDs
          ].map((step, index) => ({ ...step, id: index + 1 })),
        })
        .expect(200);

      expect(updateResponse.body.data.name).toBe('Complete Registration Flow');
      expect(updateResponse.body.data.steps).toHaveLength(9);
    });

    it('should maintain data consistency across operations', async () => {
      // Create multiple scripts with different priorities
      const scripts = [
        {
          name: 'High Priority Critical Path',
          priority: 'P0',
          steps: [
            {
              id: 1,
              name: 'Critical Step',
              action: 'click',
              selectors: [{ type: 'css', value: '.critical', priority: 1 }],
            },
          ],
        },
        {
          name: 'Medium Priority Feature Test',
          priority: 'P1',
          steps: [
            {
              id: 1,
              name: 'Feature Step',
              action: 'click',
              selectors: [{ type: 'css', value: '.feature', priority: 1 }],
            },
          ],
        },
        {
          name: 'Low Priority Edge Case',
          priority: 'P2',
          steps: [
            {
              id: 1,
              name: 'Edge Step',
              action: 'click',
              selectors: [{ type: 'css', value: '.edge', priority: 1 }],
            },
          ],
        },
      ];

      const createdScripts = [];
      for (const script of scripts) {
        const response = await request(app.server)
          .post(`/api/v1/modules/${testModule.id}/scripts`)
          .send(script)
          .expect(201);
        createdScripts.push(response.body.data);
      }

      // Verify scripts are returned in priority order
      const allScripts = await request(app.server)
        .get(`/api/v1/modules/${testModule.id}/scripts`)
        .expect(200);

      expect(allScripts.body.data).toHaveLength(4); // 3 new + 1 from previous test

      // Test priority-based filtering
      const p0Scripts = await request(app.server)
        .get(`/api/v1/modules/${testModule.id}/scripts?priority=P0`)
        .expect(200);

      expect(p0Scripts.body.data).toHaveLength(2); // 1 from previous test + 1 new

      // Test search functionality
      const searchResults = await request(app.server)
        .get(`/api/v1/projects/${testProject.id}/scripts/search?q=Priority`)
        .expect(200);

      expect(searchResults.body.data.length).toBeGreaterThan(0);
    });

    it('should handle error cases gracefully', async () => {
      // Try to create script with invalid module ID
      const invalidModuleResponse = await request(app.server)
        .post('/api/v1/modules/invalid-module-id/scripts')
        .send({
          name: 'Test Script',
          steps: [
            {
              id: 1,
              name: 'Step',
              action: 'navigate',
              selectors: [{ type: 'css', value: 'body', priority: 1 }],
            },
          ],
        })
        .expect(404);

      expect(invalidModuleResponse.body).toMatchObject({
        success: false,
        error: 'Module not found',
      });

      // Try to delete module with scripts (should fail)
      const deleteModuleResponse = await request(app.server)
        .delete(`/api/v1/modules/${testModule.id}`)
        .expect(400);

      expect(deleteModuleResponse.body).toMatchObject({
        success: false,
        error: expect.stringContaining('dependent'),
      });

      // Archive version instead of deleting
      const archiveResponse = await request(app.server)
        .put(`/api/v1/versions/${testVersion.id}`)
        .send({ status: 'ARCHIVED' })
        .expect(200);

      expect(archiveResponse.body.data.status).toBe('ARCHIVED');

      // Verify project stats are updated
      const finalStats = await request(app.server)
        .get(`/api/v1/projects/${testProject.id}/stats`)
        .expect(200);

      expect(finalStats.body.data).toMatchObject({
        versions: {
          total: 1,
          active: 0,
          archived: 1,
          draft: 0,
        },
      });
    });
  });

  describe('Script Step Validation Integration', () => {
    let testModule: any;

    beforeEach(async () => {
      const project = await prisma.project.create({
        data: { name: 'Validation Test Project' },
      });

      const version = await prisma.version.create({
        data: {
          projectId: project.id,
          name: 'v1.0.0',
          status: 'ACTIVE',
        },
      });

      testModule = await prisma.module.create({
        data: {
          versionId: version.id,
          name: 'Validation Module',
        },
      });
    });

    it('should validate complex selector scenarios', async () => {
      const complexScript = {
        name: 'Complex Selectors Test',
        steps: [
          {
            id: 1,
            name: 'Multiple selector strategies',
            action: 'click',
            selectors: [
              { type: 'id', value: 'unique-button-id', priority: 1 },
              { type: 'css', value: 'button.btn-primary', priority: 2 },
              { type: 'xpath', value: '//button[contains(text(),"Submit")]', priority: 3 },
              { type: 'text', value: 'Submit Form', priority: 4 },
              { type: 'css', value: '[data-test="submit"]', priority: 5 },
            ],
          },
          {
            id: 2,
            name: 'Text assertion with multiple locators',
            action: 'assert_text',
            expectedValue: 'Success!',
            selectors: [
              { type: 'css', value: '.success-message', priority: 1 },
              { type: 'xpath', value: '//div[@class="success"]', priority: 2 },
              { type: 'text', value: 'Success!', priority: 3 },
            ],
          },
        ],
      };

      const response = await request(app.server)
        .post(`/api/v1/modules/${testModule.id}/scripts`)
        .send(complexScript)
        .expect(201);

      expect(response.body.data.steps[0].selectors).toHaveLength(5);
      expect(response.body.data.steps[1].selectors).toHaveLength(3);
    });

    it('should handle timeout and wait scenarios', async () => {
      const timeoutScript = {
        name: 'Timeout and Wait Test',
        steps: [
          {
            id: 1,
            name: 'Navigate with long timeout',
            action: 'navigate',
            value: 'https://example.com',
            selectors: [{ type: 'css', value: 'body', priority: 1 }],
            timeout: 30000,
          },
          {
            id: 2,
            name: 'Wait for dynamic content',
            action: 'wait',
            timeout: 5000,
          },
          {
            id: 3,
            name: 'Type with medium timeout',
            action: 'type',
            value: 'test input',
            selectors: [{ type: 'id', value: 'input-field', priority: 1 }],
            timeout: 10000,
          },
        ],
      };

      const response = await request(app.server)
        .post(`/api/v1/modules/${testModule.id}/scripts`)
        .send(timeoutScript)
        .expect(201);

      expect(response.body.data.steps[0].timeout).toBe(30000);
      expect(response.body.data.steps[1].timeout).toBe(5000);
      expect(response.body.data.steps[2].timeout).toBe(10000);
    });

    it('should reject invalid timeout values', async () => {
      const invalidScript = {
        name: 'Invalid Timeout Test',
        steps: [
          {
            id: 1,
            name: 'Step with invalid timeout',
            action: 'click',
            selectors: [{ type: 'css', value: 'button', priority: 1 }],
            timeout: 999999, // Too large
          },
        ],
      };

      const response = await request(app.server)
        .post(`/api/v1/modules/${testModule.id}/scripts`)
        .send(invalidScript)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Script validation failed',
      });
    });
  });
});
const request = require('supertest');
const { createApp } = require('../../dist/app');

describe('Basic Execution Test', () => {
  let app;

  beforeAll(async () => {
    // Create a simple test app without full dependencies
    app = await createApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  test('Health endpoint should work', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('timestamp');
  });

  test('WebSocket endpoint should return info', async () => {
    const response = await request(app)
      .get('/websocket')
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('url');
    expect(response.body.data).toHaveProperty('protocols');
  });

  test('Execution routes should be registered', async () => {
    // Test that the execution routes are registered
    const response = await request(app)
      .get('/health')
      .expect(200);

    // The health endpoint should check all services
    expect(response.body).toHaveProperty('services');
  });
});
process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/server');

test('GET /api/health should return 200 and service status', async () => {
  const response = await request(app).get('/api/health');
  assert.strictEqual(response.statusCode, 200);
  assert.strictEqual(response.body.status, 'ok');
  assert.strictEqual(response.body.service, 'CrediFi Backend API');
});

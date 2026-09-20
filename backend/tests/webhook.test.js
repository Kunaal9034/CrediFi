const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/server');

const SIGNING_KEY = 'test_secret_signing_key_for_hackathon';

function generateSignature(body, key = SIGNING_KEY) {
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(JSON.stringify(body));
  return hmac.digest('hex');
}

test('Webhook Authentication & Processing', async (t) => {
  process.env.ALCHEMY_WEBHOOK_SIGNING_KEY = SIGNING_KEY;

  await t.test('POST /api/webhooks/alchemy should reject request with invalid signature', async () => {
    const payload = { type: 'PING' };
    const res = await request(app)
      .post('/api/webhooks/alchemy')
      .set('x-alchemy-signature', 'invalid_signature_hash')
      .send(payload);

    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.error, 'Invalid webhook signature');
  });

  await t.test('POST /api/webhooks/alchemy should accept PING with valid signature', async () => {
    const payload = { type: 'PING' };
    const sig = generateSignature(payload);

    const res = await request(app)
      .post('/api/webhooks/alchemy')
      .set('x-alchemy-signature', sig)
      .send(payload);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.status, 'ok');
  });

  await t.test('POST /api/webhooks/alchemy should parse logs without crashing even if DB is disconnected in unit test', async () => {
    const payload = {
      type: 'LOGS',
      event: {
        data: {
          block: {
            logs: [
              {
                transactionHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
                index: 0,
                eventName: 'LoanCreated',
                args: {
                  loanId: 1,
                  borrower: '0x2222222222222222222222222222222222222222',
                  principal: '500000000',
                  interestRate: 1000,
                  duration: 604800,
                },
              },
            ],
          },
        },
      },
    };

    const sig = generateSignature(payload);
    const res = await request(app)
      .post('/api/webhooks/alchemy')
      .set('x-alchemy-signature', sig)
      .send(payload);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.status, 'ok');
  });
});

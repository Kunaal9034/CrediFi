process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const request = require('supertest');
const mongoose = require('mongoose');

const app = require('../src/server');
const Loan = require('../src/models/Loan');
const User = require('../src/models/User');
const Transaction = require('../src/models/Transaction');
const ProtocolStats = require('../src/models/ProtocolStats');

const SIGNING_KEY = 'test_webhook_signing_key_phase13';
const ADMIN_SECRET = 'test_admin_secret_phase13_xyz';

process.env.ALCHEMY_WEBHOOK_SIGNING_KEY = SIGNING_KEY;
process.env.ADMIN_SECRET = ADMIN_SECRET;
process.env.CHAIN_ID = '11155111';
process.env.LOAN_MANAGER_ADDRESS = '0x21b39401646d783690e3902c90963c711ff7cc1c';
process.env.CREDIT_REGISTRY_ADDRESS = '0x9b117d9528c43fb2938e43172b1935f38f2c6f90';

function generateSignature(rawBody, key = SIGNING_KEY) {
  const hmac = crypto.createHmac('sha256', key);
  const data = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
  hmac.update(data);
  return hmac.digest('hex');
}

test('Phase 13 — Complete Event Indexing, Webhook, and Analytics Suite', async (t) => {
  // Setup: Connect to local MongoDB test database if available
  let dbConnected = false;
  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect('mongodb://localhost:27017/credifi_phase13_test');
    }
    dbConnected = mongoose.connection.readyState === 1;
    if (dbConnected) {
      await Promise.all([
        Loan.deleteMany({}),
        User.deleteMany({}),
        Transaction.deleteMany({}),
        ProtocolStats.deleteMany({}),
      ]);
    }
  } catch (err) {
    console.warn('[Test Setup] Could not connect to local MongoDB for live assertion tests:', err.message);
  }

  t.after(async () => {
    if (dbConnected) {
      await mongoose.disconnect();
    }
  });

  // 1. Valid signature accepted
  await t.test('1. Valid signature accepted', async () => {
    const payload = { type: 'PING' };
    const sig = generateSignature(payload);
    const res = await request(app)
      .post('/api/webhooks/alchemy')
      .set('x-alchemy-signature', sig)
      .send(payload);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.status, 'ok');
  });

  // 2. Invalid signature rejected
  await t.test('2. Invalid signature rejected', async () => {
    const payload = { type: 'PING' };
    const res = await request(app)
      .post('/api/webhooks/alchemy')
      .set('x-alchemy-signature', 'definitely_wrong_signature_hash')
      .send(payload);

    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.error, 'Invalid webhook signature');
  });

  // 3. Missing signature rejected
  await t.test('3. Missing signature rejected', async () => {
    const payload = { type: 'PING' };
    const res = await request(app)
      .post('/api/webhooks/alchemy')
      .send(payload);

    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.error, 'Invalid webhook signature');
  });

  // 4. Malformed payload rejected
  await t.test('4. Malformed payload rejected', async () => {
    const malformedRaw = '{ invalid_json: true, ';
    const sig = generateSignature(malformedRaw);

    const res = await request(app)
      .post('/api/webhooks/alchemy')
      .set('x-alchemy-signature', sig)
      .set('content-type', 'application/json')
      .send(malformedRaw);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.error, 'Malformed JSON payload');
  });

  // 5. Wrong chain rejected
  await t.test('5. Wrong chain rejected', async () => {
    const payload = {
      chainId: 1, // Ethereum Mainnet instead of Sepolia
      type: 'LOGS',
      event: {
        network: 'ETH_MAINNET',
        data: { block: { logs: [] } },
      },
    };
    const sig = generateSignature(payload);

    const res = await request(app)
      .post('/api/webhooks/alchemy')
      .set('x-alchemy-signature', sig)
      .send(payload);

    assert.strictEqual(res.statusCode, 400);
    assert.match(res.body.error, /Invalid chainId/);
  });

  // 6. Unknown contract rejected
  await t.test('6. Unknown contract rejected', async () => {
    const payload = {
      type: 'LOGS',
      event: {
        data: {
          block: {
            logs: [
              {
                transactionHash: '0xabc1111111111111111111111111111111111111111111111111111111111111',
                index: 0,
                address: '0x9999999999999999999999999999999999999999', // Unknown contract
                eventName: 'LoanCreated',
                args: { loanId: 99 },
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

    assert.strictEqual(res.statusCode, 400);
    assert.match(res.body.error, /Unknown contract address/);
  });

  // 7. Unknown event ignored/rejected safely
  await t.test('7. Unknown event ignored/rejected safely', async () => {
    const payload = {
      type: 'LOGS',
      event: {
        data: {
          block: {
            logs: [
              {
                transactionHash: '0xabc2222222222222222222222222222222222222222222222222222222222222',
                index: 0,
                address: process.env.LOAN_MANAGER_ADDRESS,
                eventName: 'SomeUnknownArbitraryEvent',
                args: {},
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
    assert.strictEqual(res.body.ignored, 1);
  });

  // 8. Duplicate event is idempotent
  await t.test('8. Duplicate event is idempotent', async () => {
    const payload = {
      type: 'LOGS',
      event: {
        data: {
          block: {
            logs: [
              {
                transactionHash: '0xddd0000000000000000000000000000000000000000000000000000000000001',
                index: 1,
                address: process.env.LOAN_MANAGER_ADDRESS,
                eventName: 'LoanCreated',
                args: {
                  loanId: 888,
                  borrower: '0x5f2a6B32228A1B911128cB11Dd8E0ce94dd6b565',
                  principal: '50000000',
                  interestRateBps: 500,
                  duration: 604800,
                  totalDue: '50047945',
                },
              },
            ],
          },
        },
      },
    };
    const sig = generateSignature(payload);

    // First delivery
    const res1 = await request(app)
      .post('/api/webhooks/alchemy')
      .set('x-alchemy-signature', sig)
      .send(payload);

    assert.strictEqual(res1.statusCode, 200);

    // Second delivery (duplicate)
    const res2 = await request(app)
      .post('/api/webhooks/alchemy')
      .set('x-alchemy-signature', sig)
      .send(payload);

    assert.strictEqual(res2.statusCode, 200);
    if (dbConnected) {
      assert.strictEqual(res2.body.duplicates, 1);

      // Verify no duplicate Transaction created
      const txCount = await Transaction.countDocuments({
        transactionHash: '0xddd0000000000000000000000000000000000000000000000000000000000001',
        logIndex: 1,
      });
      assert.strictEqual(txCount, 1);
    }
  });

  // 9. LoanCreated indexing
  await t.test('9. LoanCreated indexing', async () => {
    const payload = {
      type: 'LOGS',
      event: {
        data: {
          block: {
            number: 11744001,
            logs: [
              {
                transactionHash: '0xaaa1000000000000000000000000000000000000000000000000000000000001',
                index: 0,
                address: process.env.LOAN_MANAGER_ADDRESS,
                eventName: 'LoanCreated',
                args: {
                  loanId: 201,
                  borrower: '0x5f2a6b32228a1b911128cb11dd8e0ce94dd6b565',
                  principal: '50000000',
                  interestRateBps: 500,
                  duration: 604800,
                  totalDue: '50047945',
                  dueDate: 1726830000,
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

    if (dbConnected) {
      const loan = await Loan.findOne({ loanId: 201 });
      assert.ok(loan, 'Loan #201 should exist in DB');
      assert.strictEqual(loan.borrower, '0x5f2a6b32228a1b911128cb11dd8e0ce94dd6b565');
      assert.strictEqual(loan.principal, '50000000');
      assert.strictEqual(loan.status, 0); // REQUESTED
      assert.strictEqual(loan.interestRateBps, 500);
    }
  });

  // 10. LoanFunded indexing
  await t.test('10. LoanFunded indexing', async () => {
    const payload = {
      type: 'LOGS',
      event: {
        data: {
          block: {
            number: 11744002,
            logs: [
              {
                transactionHash: '0xaaa2000000000000000000000000000000000000000000000000000000000002',
                index: 0,
                address: process.env.LOAN_MANAGER_ADDRESS,
                eventName: 'LoanFunded',
                args: {
                  loanId: 201,
                  lender: '0x0c1739791ca3186b1a6142ca226f3a4a16c2796e',
                  borrower: '0x5f2a6b32228a1b911128cb11dd8e0ce94dd6b565',
                  principal: '50000000',
                  dueDate: 1726830000,
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

    if (dbConnected) {
      const loan = await Loan.findOne({ loanId: 201 });
      assert.strictEqual(loan.status, 1); // ACTIVE
      assert.strictEqual(loan.lender, '0x0c1739791ca3186b1a6142ca226f3a4a16c2796e');
      assert.strictEqual(loan.fundingTxHash, '0xaaa2000000000000000000000000000000000000000000000000000000000002');
    }
  });

  // 11. LoanRepaid indexing
  await t.test('11. LoanRepaid indexing', async () => {
    const payload = {
      type: 'LOGS',
      event: {
        data: {
          block: {
            number: 11744003,
            logs: [
              {
                transactionHash: '0xaaa3000000000000000000000000000000000000000000000000000000000003',
                index: 0,
                address: process.env.LOAN_MANAGER_ADDRESS,
                eventName: 'LoanRepaid',
                args: {
                  loanId: 201,
                  borrower: '0x5f2a6b32228a1b911128cb11dd8e0ce94dd6b565',
                  lender: '0x0c1739791ca3186b1a6142ca226f3a4a16c2796e',
                  principal: '50000000',
                  totalDue: '50047945',
                  repaymentType: 0,
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

    if (dbConnected) {
      const loan = await Loan.findOne({ loanId: 201 });
      assert.strictEqual(loan.status, 2); // REPAID
      assert.strictEqual(loan.totalRepaid, '50047945');
      assert.strictEqual(loan.repaymentTxHash, '0xaaa3000000000000000000000000000000000000000000000000000000000003');
    }
  });

  // 12. LoanDefaulted indexing
  await t.test('12. LoanDefaulted indexing', async () => {
    // First create loan #202
    const createPayload = {
      type: 'LOGS',
      event: {
        data: {
          block: {
            number: 11744004,
            logs: [
              {
                transactionHash: '0xaaa4000000000000000000000000000000000000000000000000000000000004',
                index: 0,
                address: process.env.LOAN_MANAGER_ADDRESS,
                eventName: 'LoanCreated',
                args: {
                  loanId: 202,
                  borrower: '0x5f2a6b32228a1b911128cb11dd8e0ce94dd6b565',
                  principal: '30000000',
                  interestRateBps: 800,
                  duration: 604800,
                  totalDue: '30050000',
                },
              },
            ],
          },
        },
      },
    };
    await request(app)
      .post('/api/webhooks/alchemy')
      .set('x-alchemy-signature', generateSignature(createPayload))
      .send(createPayload);

    // Now default loan #202
    const defaultPayload = {
      type: 'LOGS',
      event: {
        data: {
          block: {
            number: 11744005,
            logs: [
              {
                transactionHash: '0xaaa5000000000000000000000000000000000000000000000000000000000005',
                index: 0,
                address: process.env.LOAN_MANAGER_ADDRESS,
                eventName: 'LoanDefaulted',
                args: {
                  loanId: 202,
                  borrower: '0x5f2a6b32228a1b911128cb11dd8e0ce94dd6b565',
                  lender: '0x0c1739791ca3186b1a6142ca226f3a4a16c2796e',
                  principal: '30000000',
                },
              },
            ],
          },
        },
      },
    };
    const sig = generateSignature(defaultPayload);

    const res = await request(app)
      .post('/api/webhooks/alchemy')
      .set('x-alchemy-signature', sig)
      .send(defaultPayload);

    assert.strictEqual(res.statusCode, 200);

    if (dbConnected) {
      const loan = await Loan.findOne({ loanId: 202 });
      assert.strictEqual(loan.status, 3); // DEFAULTED
      assert.strictEqual(loan.defaultTxHash, '0xaaa5000000000000000000000000000000000000000000000000000000000005');
    }
  });

  // 13. CreditProfileUpdated indexing
  await t.test('13. CreditProfileUpdated indexing', async () => {
    const payload = {
      type: 'LOGS',
      event: {
        data: {
          block: {
            number: 11744006,
            logs: [
              {
                transactionHash: '0xaaa6000000000000000000000000000000000000000000000000000000000006',
                index: 0,
                address: process.env.CREDIT_REGISTRY_ADDRESS,
                eventName: 'CreditProfileUpdated',
                args: {
                  borrower: '0x5f2a6b32228a1b911128cb11dd8e0ce94dd6b565',
                  score: 570,
                  borrowingLimit: '570000000',
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

    if (dbConnected) {
      const user = await User.findOne({ wallet: '0x5f2a6b32228a1b911128cb11dd8e0ce94dd6b565' });
      assert.ok(user, 'User should exist');
      assert.strictEqual(user.creditScore, 570);
      assert.strictEqual(user.borrowingLimit, '570000000');
    }
  });

  // 14. User aggregation
  await t.test('14. User aggregation', async () => {
    const res = await request(app).get('/api/users/0x5f2a6b32228a1b911128cb11dd8e0ce94dd6b565');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.user);
    assert.strictEqual(res.body.user.wallet, '0x5f2a6b32228a1b911128cb11dd8e0ce94dd6b565');

    if (dbConnected) {
      assert.strictEqual(res.body.user.loansTaken, 3); // loan 888 + loan 201 + loan 202
      assert.strictEqual(res.body.user.loansRepaid, 1);
      assert.strictEqual(res.body.user.defaults, 1);
    }
  });

  // 15. Protocol statistics
  await t.test('15. Protocol statistics', async () => {
    const res = await request(app).get('/api/analytics');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body.stats);

    if (dbConnected) {
      assert.strictEqual(res.body.stats.totalLoans, 3);
      assert.strictEqual(res.body.stats.repaidLoans, 1);
      assert.strictEqual(res.body.stats.defaultedLoans, 1);
      assert.strictEqual(typeof res.body.stats.totalVolume, 'string');
      assert.strictEqual(typeof res.body.stats.repaymentRate, 'number');
      assert.strictEqual(typeof res.body.stats.defaultRate, 'number');
    }
  });

  // 16. Pagination
  await t.test('16. Pagination', async () => {
    const res = await request(app).get('/api/loans?limit=1&page=1');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.limit, 1);
    assert.strictEqual(res.body.page, 1);

    if (dbConnected) {
      assert.strictEqual(res.body.loans.length, 1);
      assert.strictEqual(res.body.total, 3);
      assert.strictEqual(res.body.totalPages, 3);
    }
  });

  // 17. Wallet filtering
  await t.test('17. Wallet filtering', async () => {
    const res = await request(app).get('/api/loans?borrower=0x5f2a6b32228a1b911128cb11dd8e0ce94dd6b565');
    assert.strictEqual(res.statusCode, 200);

    if (dbConnected) {
      for (const loan of res.body.loans) {
        assert.strictEqual(loan.borrower, '0x5f2a6b32228a1b911128cb11dd8e0ce94dd6b565');
      }
    }
  });

  // 18. Status filtering
  await t.test('18. Status filtering', async () => {
    const res = await request(app).get('/api/loans?status=2'); // REPAID loans
    assert.strictEqual(res.statusCode, 200);

    if (dbConnected) {
      for (const loan of res.body.loans) {
        assert.strictEqual(loan.status, 2);
      }
    }
  });

  // 19. Admin backfill authentication
  await t.test('19. Admin backfill authentication', async () => {
    const res = await request(app)
      .post('/api/admin/backfill')
      .set('Authorization', `Bearer ${ADMIN_SECRET}`)
      .send({
        logs: [
          {
            transactionHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            logIndex: 0,
            contractAddress: process.env.CREDIT_REGISTRY_ADDRESS,
            eventName: 'CreditProfileUpdated',
            blockNumber: 11744010,
            args: {
              borrower: '0x5f2a6b32228a1b911128cb11dd8e0ce94dd6b565',
              score: 580,
              borrowingLimit: '580000000',
            },
          },
        ],
      });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.status, 'ok');
    if (dbConnected) {
      assert.strictEqual(res.body.processed, 1);
      const user = await User.findOne({ wallet: '0x5f2a6b32228a1b911128cb11dd8e0ce94dd6b565' });
      assert.strictEqual(user.creditScore, 580);
    }
  });

  // 20. Invalid admin secret rejected
  await t.test('20. Invalid admin secret rejected', async () => {
    const res = await request(app)
      .post('/api/admin/backfill')
      .set('Authorization', 'Bearer invalid_secret_token')
      .send({ fromBlock: 11740000, toBlock: 11740010 });

    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.error, 'Unauthorized: Invalid or missing ADMIN_SECRET');
  });
});

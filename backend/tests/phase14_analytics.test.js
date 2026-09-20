process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const mongoose = require('mongoose');

const app = require('../src/server');
const Loan = require('../src/models/Loan');
const User = require('../src/models/User');
const ProtocolStats = require('../src/models/ProtocolStats');
const { recalculateProtocolStats, buildVolumeHistory } = require('../src/services/analyticsService');

test('Phase 14 — Protocol Analytics & Visual Aggregation Engine Suite', async (t) => {
  let dbConnected = false;
  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect('mongodb://localhost:27017/credifi_phase14_test');
    }
    dbConnected = mongoose.connection.readyState === 1;
    if (dbConnected) {
      await Promise.all([
        Loan.deleteMany({}),
        User.deleteMany({}),
        ProtocolStats.deleteMany({}),
      ]);
    }
  } catch (err) {
    console.warn('[Test Setup] Could not connect to local MongoDB for live Phase 14 tests:', err.message);
  }

  t.after(async () => {
    if (dbConnected) {
      await Promise.all([
        Loan.deleteMany({}),
        User.deleteMany({}),
        ProtocolStats.deleteMany({}),
      ]);
      await mongoose.disconnect();
    }
  });

  await t.test('1. buildVolumeHistory generates 5 valid progression buckets', () => {
    const emptyHistory = buildVolumeHistory([], 0n);
    assert.strictEqual(emptyHistory.length, 5);
    assert.strictEqual(emptyHistory[0].period, 'Wk 1');
    assert.strictEqual(emptyHistory[4].period, 'Wk 5');

    const sampleLoans = [
      { principal: '100000000', amount: '100000000' }, // 100 USDC
      { principal: '200000000', amount: '200000000' }, // 200 USDC
      { principal: '300000000', amount: '300000000' }, // 300 USDC
    ];
    const history = buildVolumeHistory(sampleLoans, 600000000n);
    assert.strictEqual(history.length, 5);
    assert.ok(history[4].cumulativeVolume >= 0);
  });

  await t.test('2. recalculateProtocolStats computes correct stats, credit tiers, and volume', async () => {
    if (!dbConnected) return;

    // Seed test users with different credit tiers
    await User.create([
      { wallet: '0x1111111111111111111111111111111111111111', creditScore: 500 }, // poor
      { wallet: '0x2222222222222222222222222222222222222222', creditScore: 620 }, // fair
      { wallet: '0x3333333333333333333333333333333333333333', creditScore: 700 }, // good
      { wallet: '0x4444444444444444444444444444444444444444', creditScore: 790 }, // excellent
    ]);

    // Seed test loans: 1 Active, 1 Repaid, 1 Defaulted
    await Loan.create([
      {
        loanId: 101,
        borrower: '0x1111111111111111111111111111111111111111',
        lender: '0x2222222222222222222222222222222222222222',
        principal: '500000000', // 500 USDC
        amount: '500000000',
        status: 1, // ACTIVE
        interestRateBps: 1000,
        duration: 14 * 86400,
        durationSeconds: 14 * 86400,
      },
      {
        loanId: 102,
        borrower: '0x2222222222222222222222222222222222222222',
        lender: '0x3333333333333333333333333333333333333333',
        principal: '300000000', // 300 USDC
        amount: '300000000',
        totalRepaid: '330000000', // 330 USDC (30 USDC interest)
        status: 2, // REPAID
        interestRateBps: 1000,
        duration: 14 * 86400,
        durationSeconds: 14 * 86400,
      },
      {
        loanId: 103,
        borrower: '0x1111111111111111111111111111111111111111',
        lender: '0x4444444444444444444444444444444444444444',
        principal: '200000000', // 200 USDC
        amount: '200000000',
        status: 3, // DEFAULTED
        interestRateBps: 1200,
        duration: 28 * 86400,
        durationSeconds: 28 * 86400,
      },
    ]);

    const stats = await recalculateProtocolStats(12345);
    assert.strictEqual(stats.totalUsers, 4);
    assert.strictEqual(stats.totalLoans, 3);
    assert.strictEqual(stats.activeLoans, 1);
    assert.strictEqual(stats.repaidLoans, 1);
    assert.strictEqual(stats.defaultedLoans, 1);
    assert.strictEqual(stats.totalVolume, '1000000000'); // 1,000 USDC
    assert.strictEqual(stats.totalRepaid, '330000000');
    assert.strictEqual(stats.totalInterest, '30000000'); // 30 USDC
    assert.strictEqual(stats.repaymentRate, 50); // 1 repaid / 2 settled = 50%
    assert.strictEqual(stats.defaultRate, 50);

    // Verify credit score distribution
    assert.strictEqual(stats.creditScoreDistribution.poor, 1);
    assert.strictEqual(stats.creditScoreDistribution.fair, 1);
    assert.strictEqual(stats.creditScoreDistribution.good, 1);
    assert.strictEqual(stats.creditScoreDistribution.excellent, 1);

    // Verify volume history
    assert.strictEqual(stats.volumeHistory.length, 5);
  });

  await t.test('3. GET /api/analytics returns enriched payload with Recharts datasets', async () => {
    const res = await request(app).get('/api/analytics').expect(200);

    assert.ok(res.body.stats !== undefined);
    assert.ok(Array.isArray(res.body.volumeHistory));
    assert.ok(typeof res.body.creditScoreDistribution === 'object');
    assert.ok(res.body._notice.includes('smart contracts'));

    if (dbConnected) {
      assert.strictEqual(res.body.volumeHistory.length, 5);
      assert.strictEqual(res.body.creditScoreDistribution.fair, 1);
    }
  });

  await t.test('4. GET /api/analytics?refresh=true forces re-aggregation', async () => {
    const res = await request(app).get('/api/analytics?refresh=true').expect(200);
    assert.ok(res.body.stats !== undefined);
    assert.ok(Array.isArray(res.body.volumeHistory));
  });
});

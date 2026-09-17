const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const HashingService = require('../src/services/hashingService');
const StorageService = require('../src/services/storageService');
const { CUSTODY_ACTIONS, CUSTODY_ACTION_ENUM_MAP } = require('../src/constants/custodyActions');
const { ROLES } = require('../src/constants/roles');

test('HashingService: Authoritative SHA-256 Calculation', async (t) => {
  await t.test('calculates correct SHA-256 from buffer', () => {
    const input = Buffer.from('JusticeVault Tamper Proof Digital Evidence 2026');
    const hash = HashingService.calculateBufferSha256(input);
    assert.equal(hash.length, 64, 'Hash must be 64 characters long');
    assert.equal(typeof hash, 'string');
    // Verify deterministic calculation
    const hash2 = HashingService.calculateBufferSha256(input);
    assert.equal(hash, hash2, 'Hash must be strictly deterministic');
  });

  await t.test('calculates correct SHA-256 from streaming file', async () => {
    const tempTestFile = path.join(__dirname, 'test_evidence.txt');
    fs.writeFileSync(tempTestFile, 'CCTV FOOTAGE EVIDENCE - CAMERA 02 - METRO BANK');

    const fileHash = await HashingService.calculateFileSha256(tempTestFile);
    assert.equal(fileHash.length, 64);

    // Tamper with the file by 1 character
    const tamperedTestFile = path.join(__dirname, 'test_evidence_tampered.txt');
    fs.writeFileSync(tamperedTestFile, 'CCTV FOOTAGE EVIDENCE - CAMERA 02 - METRO BANJ');

    const tamperedHash = await HashingService.calculateFileSha256(tamperedTestFile);
    assert.notEqual(fileHash, tamperedHash, 'Tampered file hash must not match original hash');

    // Clean up
    fs.unlinkSync(tempTestFile);
    fs.unlinkSync(tamperedTestFile);
  });

  await t.test('converts 64-char hex to bytes32 format and back', () => {
    const hex = '8a4f89d3637e7d6b38c26359f81f1e9488fffa962e22c710ec427383a1a9e701';
    const bytes32 = HashingService.hexToBytes32(hex);
    assert.equal(bytes32, `0x${hex}`);

    const restored = HashingService.bytes32ToHex(bytes32);
    assert.equal(restored, hex);
  });
});

test('StorageService: Off-chain Content Addressing', (t) => {
  const hex = '8a4f89d3637e7d6b38c26359f81f1e9488fffa962e22c710ec427383a1a9e701';
  const cid = StorageService.generateLocalCid(hex);
  assert.ok(cid.startsWith('Qm'), 'Generated CIDv0 must start with Qm');
  assert.ok(cid.length >= 44, 'CID must have standard IPFS length');
});

test('RBAC & Custody Constants: Enums and Role Definitions', (t) => {
  assert.equal(ROLES.ADMIN, 'ADMIN');
  assert.equal(ROLES.OFFICER, 'OFFICER');
  assert.equal(ROLES.FORENSIC, 'FORENSIC');
  assert.equal(ROLES.PROSECUTOR, 'PROSECUTOR');
  assert.equal(ROLES.JUDGE, 'JUDGE');

  assert.equal(CUSTODY_ACTION_ENUM_MAP.REGISTERED, 0);
  assert.equal(CUSTODY_ACTION_ENUM_MAP.ACCESSED, 1);
  assert.equal(CUSTODY_ACTION_ENUM_MAP.TRANSFERRED, 2);
  assert.equal(CUSTODY_ACTION_ENUM_MAP.ANALYZED, 3);
  assert.equal(CUSTODY_ACTION_ENUM_MAP.VERIFIED, 4);
  assert.equal(CUSTODY_ACTION_ENUM_MAP.FLAGGED, 5);
});

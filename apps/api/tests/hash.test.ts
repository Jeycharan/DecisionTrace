import { describe, it, expect } from 'vitest';
import { canonicalise, computeEventHash, GENESIS_HASH, signCheckpoint, verifyCheckpointSignature } from '../src/modules/ledger/hash';

describe('Canonical Serialisation', () => {
  it('produces deterministic output regardless of key insertion order', () => {
    const obj1 = { b: 2, a: 1, c: { z: 26, a: 1 } };
    const obj2 = { a: 1, c: { a: 1, z: 26 }, b: 2 };
    expect(canonicalise(obj1)).toBe(canonicalise(obj2));
  });

  it('produces the same string for identical input', () => {
    const obj = { tenantId: 'demo', caseId: 'case1', sequence: 1 };
    expect(canonicalise(obj)).toBe(canonicalise(obj));
  });

  it('handles undefined values by converting to null', () => {
    const obj = { a: 1, b: undefined, c: 3 };
    const result = JSON.parse(canonicalise(obj));
    expect(result.b).toBeNull();
  });

  it('handles dates by converting to ISO strings', () => {
    const date = new Date('2026-11-20T10:30:00.000Z');
    const obj = { timestamp: date };
    const result = canonicalise(obj);
    expect(result).toContain('2026-11-20T10:30:00.000Z');
  });

  it('handles nested objects with sorted keys', () => {
    const obj = { outer: { z: 1, a: 2, m: { y: 3, b: 4 } } };
    const result = canonicalise(obj);
    // Keys should be sorted at every level
    const parsed = JSON.parse(result);
    const outerKeys = Object.keys(parsed.outer);
    expect(outerKeys).toEqual(['a', 'm', 'z']);
  });

  it('handles arrays without reordering', () => {
    const obj = { items: [3, 1, 2] };
    const result = JSON.parse(canonicalise(obj));
    expect(result.items).toEqual([3, 1, 2]);
  });
});

describe('Event Hashing', () => {
  const baseInput = {
    tenantId: 'demo-bank',
    caseId: 'loan_case_1001',
    sequence: 1,
    eventId: 'evt_demo_0001',
    eventType: 'CASE_CREATED',
    occurredAt: '2026-11-20T10:00:00.000Z',
    recordedAt: '2026-11-20T10:00:01.000Z',
    sourceSystem: 'demo-loan-engine',
    schemaVersion: 1,
    payload: { test: 'data' },
    snapshotId: null,
    previousHash: GENESIS_HASH,
  };

  it('same input produces same SHA-256 hash', () => {
    const hash1 = computeEventHash(baseInput);
    const hash2 = computeEventHash(baseInput);
    expect(hash1).toBe(hash2);
  });

  it('produces a 64-character hex string', () => {
    const hash = computeEventHash(baseInput);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changed payload produces a different hash', () => {
    const modified = { ...baseInput, payload: { test: 'modified' } };
    expect(computeEventHash(baseInput)).not.toBe(computeEventHash(modified));
  });

  it('changed sequence produces a different hash', () => {
    const modified = { ...baseInput, sequence: 2 };
    expect(computeEventHash(baseInput)).not.toBe(computeEventHash(modified));
  });

  it('changed previousHash produces a different hash', () => {
    const modified = { ...baseInput, previousHash: 'somehash' };
    expect(computeEventHash(baseInput)).not.toBe(computeEventHash(modified));
  });

  it('genesis event uses documented genesis value', () => {
    expect(GENESIS_HASH).toBe('GENESIS');
    expect(baseInput.previousHash).toBe('GENESIS');
  });

  it('second event links to first event hash', () => {
    const firstHash = computeEventHash(baseInput);
    const secondInput = {
      ...baseInput,
      sequence: 2,
      eventId: 'evt_demo_0002',
      previousHash: firstHash,
    };
    const secondHash = computeEventHash(secondInput);
    expect(secondHash).not.toBe(firstHash);
    expect(secondInput.previousHash).toBe(firstHash);
  });
});

describe('Checkpoint Signing', () => {
  const secret = 'test-hmac-secret-at-least-32-characters-long';
  const payload = {
    tenantId: 'demo-bank',
    caseId: 'loan_case_1001',
    sequence: 5,
    eventHash: 'abc123def456',
    createdAt: '2026-11-20T10:00:00.000Z',
    keyId: 'prototype-hmac-key-1',
  };

  it('signing and verification work', () => {
    const signature = signCheckpoint(payload, secret);
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyCheckpointSignature(payload, signature, secret)).toBe(true);
  });

  it('invalid signature is rejected', () => {
    const signature = signCheckpoint(payload, secret);
    const tampered = signature.replace(signature[0], signature[0] === 'a' ? 'b' : 'a');
    expect(verifyCheckpointSignature(payload, tampered, secret)).toBe(false);
  });

  it('wrong secret fails verification', () => {
    const signature = signCheckpoint(payload, secret);
    expect(verifyCheckpointSignature(payload, signature, 'wrong-secret-wrong-secret-wrong!')).toBe(false);
  });

  it('modified payload fails verification', () => {
    const signature = signCheckpoint(payload, secret);
    const modified = { ...payload, sequence: 6 };
    expect(verifyCheckpointSignature(modified, signature, secret)).toBe(false);
  });
});

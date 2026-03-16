/**
 * Property-Based Tests for UID Computation Consistency
 *
 * Property 6: Attestation UID determinism and SDK consistency
 * Property 7: Attestation UID uniqueness
 *
 * Also covers Schema UID determinism and format validation.
 *
 * Uses fast-check for property-based testing with vitest.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { AbiCoder, keccak256, ZeroAddress } from 'ethers';
import { computeSchemaUid, computeAttestationUid } from '../src/uid';

const coder = AbiCoder.defaultAbiCoder();

// ─── Generators ──────────────────────────────────────────────────────────────

/** Random string 1-50 chars for schema definitions */
const definitionArb = fc.string({ minLength: 1, maxLength: 50 });

/** Random Ethereum address: 0x + 40 hex chars */
const addressArb = fc
  .uint8Array({ minLength: 20, maxLength: 20 })
  .map(
    (bytes) =>
      '0x' +
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(''),
  );

/** Random bytes32: 0x + 64 hex chars */
const bytes32Arb = fc
  .uint8Array({ minLength: 32, maxLength: 32 })
  .map(
    (bytes) =>
      '0x' +
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(''),
  );

/** Random hex bytes: 0x + even number of hex chars, 0-100 bytes */
const hexBytesArb = fc
  .uint8Array({ minLength: 0, maxLength: 100 })
  .map(
    (bytes) =>
      '0x' +
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(''),
  );

/** Random uint256 as bigint (0 to 2^64-1 for practical purposes) */
const nonceArb = fc.bigInt({ min: 0n, max: (1n << 64n) - 1n });

/** Valid bytes32 hex string pattern */
const BYTES32_REGEX = /^0x[0-9a-f]{64}$/;

// ─── Property 6: Schema UID Determinism ──────────────────────────────────────

describe('Property 6 — Schema UID Determinism', () => {
  /**
   * **Validates: Requirements 2.1**
   *
   * For any given (definition, resolver, revocable), computeSchemaUid
   * always returns the same result — same inputs → same output.
   */
  it('same inputs always produce the same Schema UID (deterministic)', () => {
    fc.assert(
      fc.property(definitionArb, addressArb, fc.boolean(), (definition, resolver, revocable) => {
        const uid1 = computeSchemaUid(definition, resolver, revocable);
        const uid2 = computeSchemaUid(definition, resolver, revocable);
        expect(uid1).toBe(uid2);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 2.1**
   *
   * Schema UID matches the expected keccak256(abi.encode(...)) derivation.
   */
  it('matches keccak256(abi.encode(definition, resolver, revocable))', () => {
    fc.assert(
      fc.property(definitionArb, addressArb, fc.boolean(), (definition, resolver, revocable) => {
        const expected = keccak256(
          coder.encode(['string', 'address', 'bool'], [definition, resolver, revocable]),
        );
        expect(computeSchemaUid(definition, resolver, revocable)).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * Collision resistance: changing any single input produces a different UID.
   * We test changing definition, resolver, and revocable independently.
   */
  it('changing the definition produces a different UID', () => {
    fc.assert(
      fc.property(
        definitionArb,
        definitionArb,
        addressArb,
        fc.boolean(),
        (def1, def2, resolver, revocable) => {
          fc.pre(def1 !== def2);
          const uid1 = computeSchemaUid(def1, resolver, revocable);
          const uid2 = computeSchemaUid(def2, resolver, revocable);
          expect(uid1).not.toBe(uid2);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('changing the resolver produces a different UID', () => {
    fc.assert(
      fc.property(
        definitionArb,
        addressArb,
        addressArb,
        fc.boolean(),
        (definition, resolver1, resolver2, revocable) => {
          fc.pre(resolver1.toLowerCase() !== resolver2.toLowerCase());
          const uid1 = computeSchemaUid(definition, resolver1, revocable);
          const uid2 = computeSchemaUid(definition, resolver2, revocable);
          expect(uid1).not.toBe(uid2);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('changing revocable produces a different UID', () => {
    fc.assert(
      fc.property(definitionArb, addressArb, (definition, resolver) => {
        const uid1 = computeSchemaUid(definition, resolver, true);
        const uid2 = computeSchemaUid(definition, resolver, false);
        expect(uid1).not.toBe(uid2);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * Schema UID is always a valid bytes32 hex string (0x + 64 hex chars).
   */
  it('always returns a valid bytes32 hex string', () => {
    fc.assert(
      fc.property(definitionArb, addressArb, fc.boolean(), (definition, resolver, revocable) => {
        const uid = computeSchemaUid(definition, resolver, revocable);
        expect(uid).toMatch(BYTES32_REGEX);
        expect(uid.length).toBe(66);
      }),
      { numRuns: 200 },
    );
  });
});

// ─── Property 7: Attestation UID Determinism ─────────────────────────────────

describe('Property 7 — Attestation UID Determinism', () => {
  /**
   * **Validates: Requirements 23.1, 23.3**
   *
   * For any given (schemaUid, subject, attester, data, nonce),
   * computeAttestationUid always returns the same result.
   */
  it('same inputs always produce the same Attestation UID (deterministic)', () => {
    fc.assert(
      fc.property(
        bytes32Arb,
        addressArb,
        addressArb,
        hexBytesArb,
        nonceArb,
        (schemaUid, subject, attester, data, nonce) => {
          const uid1 = computeAttestationUid(schemaUid, subject, attester, data, nonce);
          const uid2 = computeAttestationUid(schemaUid, subject, attester, data, nonce);
          expect(uid1).toBe(uid2);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 23.1, 23.3**
   *
   * Attestation UID matches the expected keccak256(abi.encode(...)) derivation.
   */
  it('matches keccak256(abi.encode(schemaUid, subject, attester, data, nonce))', () => {
    fc.assert(
      fc.property(
        bytes32Arb,
        addressArb,
        addressArb,
        hexBytesArb,
        nonceArb,
        (schemaUid, subject, attester, data, nonce) => {
          const expected = keccak256(
            coder.encode(
              ['bytes32', 'address', 'address', 'bytes', 'uint256'],
              [schemaUid, subject, attester, data, nonce],
            ),
          );
          expect(computeAttestationUid(schemaUid, subject, attester, data, nonce)).toBe(expected);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 23.2**
   *
   * Different nonces produce different UIDs — uniqueness via nonce.
   */
  it('different nonces produce different UIDs', () => {
    fc.assert(
      fc.property(
        bytes32Arb,
        addressArb,
        addressArb,
        hexBytesArb,
        nonceArb,
        nonceArb,
        (schemaUid, subject, attester, data, nonce1, nonce2) => {
          fc.pre(nonce1 !== nonce2);
          const uid1 = computeAttestationUid(schemaUid, subject, attester, data, nonce1);
          const uid2 = computeAttestationUid(schemaUid, subject, attester, data, nonce2);
          expect(uid1).not.toBe(uid2);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * Attestation UID is always a valid bytes32 hex string (0x + 64 hex chars).
   */
  it('always returns a valid bytes32 hex string', () => {
    fc.assert(
      fc.property(
        bytes32Arb,
        addressArb,
        addressArb,
        hexBytesArb,
        nonceArb,
        (schemaUid, subject, attester, data, nonce) => {
          const uid = computeAttestationUid(schemaUid, subject, attester, data, nonce);
          expect(uid).toMatch(BYTES32_REGEX);
          expect(uid.length).toBe(66);
        },
      ),
      { numRuns: 200 },
    );
  });
});

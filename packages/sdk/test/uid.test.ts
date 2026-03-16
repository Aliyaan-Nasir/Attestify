import { describe, it, expect } from 'vitest';
import { AbiCoder, keccak256, ZeroAddress } from 'ethers';
import { computeSchemaUid, computeAttestationUid } from '../src/uid';

const coder = AbiCoder.defaultAbiCoder();

describe('computeSchemaUid', () => {
  it('matches manual keccak256(abi.encode(definition, resolver, revocable))', () => {
    const definition = 'string name, uint256 age';
    const resolver = '0x1234567890abcdef1234567890abcdef12345678';
    const revocable = true;

    const expected = keccak256(
      coder.encode(['string', 'address', 'bool'], [definition, resolver, revocable]),
    );

    expect(computeSchemaUid(definition, resolver, revocable)).toBe(expected);
  });

  it('defaults resolver to ZeroAddress when undefined', () => {
    const definition = 'bool active';
    const revocable = false;

    const expected = keccak256(
      coder.encode(['string', 'address', 'bool'], [definition, ZeroAddress, revocable]),
    );

    expect(computeSchemaUid(definition, undefined, revocable)).toBe(expected);
  });

  it('defaults resolver to ZeroAddress when empty string', () => {
    const definition = 'address wallet';
    const revocable = true;

    const expected = keccak256(
      coder.encode(['string', 'address', 'bool'], [definition, ZeroAddress, revocable]),
    );

    expect(computeSchemaUid(definition, '', revocable)).toBe(expected);
  });

  it('returns a 66-character 0x-prefixed hex string', () => {
    const uid = computeSchemaUid('uint256 score', ZeroAddress, true);
    expect(uid).toMatch(/^0x[0-9a-f]{64}$/);
    expect(uid.length).toBe(66);
  });

  it('produces different UIDs for different definitions', () => {
    const uid1 = computeSchemaUid('string a', ZeroAddress, true);
    const uid2 = computeSchemaUid('string b', ZeroAddress, true);
    expect(uid1).not.toBe(uid2);
  });

  it('produces different UIDs when revocable differs', () => {
    const uid1 = computeSchemaUid('string a', ZeroAddress, true);
    const uid2 = computeSchemaUid('string a', ZeroAddress, false);
    expect(uid1).not.toBe(uid2);
  });
});

describe('computeAttestationUid', () => {
  const schemaUid = keccak256(coder.encode(['string'], ['test']));
  const subject = '0x000000000000000000000000000000000000abcd';
  const attester = '0x000000000000000000000000000000000000ef01';
  const data = '0x1234';
  const nonce = 42;

  it('matches manual keccak256(abi.encode(schemaUid, subject, attester, data, nonce))', () => {
    const expected = keccak256(
      coder.encode(
        ['bytes32', 'address', 'address', 'bytes', 'uint256'],
        [schemaUid, subject, attester, data, nonce],
      ),
    );

    expect(computeAttestationUid(schemaUid, subject, attester, data, nonce)).toBe(expected);
  });

  it('accepts bigint nonce', () => {
    const expected = keccak256(
      coder.encode(
        ['bytes32', 'address', 'address', 'bytes', 'uint256'],
        [schemaUid, subject, attester, data, BigInt(99)],
      ),
    );

    expect(computeAttestationUid(schemaUid, subject, attester, data, BigInt(99))).toBe(expected);
  });

  it('returns a 66-character 0x-prefixed hex string', () => {
    const uid = computeAttestationUid(schemaUid, subject, attester, data, nonce);
    expect(uid).toMatch(/^0x[0-9a-f]{64}$/);
    expect(uid.length).toBe(66);
  });

  it('produces different UIDs for different nonces', () => {
    const uid1 = computeAttestationUid(schemaUid, subject, attester, data, 0);
    const uid2 = computeAttestationUid(schemaUid, subject, attester, data, 1);
    expect(uid1).not.toBe(uid2);
  });

  it('produces different UIDs for different data', () => {
    const uid1 = computeAttestationUid(schemaUid, subject, attester, '0xaa', 0);
    const uid2 = computeAttestationUid(schemaUid, subject, attester, '0xbb', 0);
    expect(uid1).not.toBe(uid2);
  });
});

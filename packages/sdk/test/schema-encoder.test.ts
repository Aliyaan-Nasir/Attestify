/**
 * Unit tests for SchemaEncoder — definition getter, generateDefaults, toJSONSchema
 */

import { describe, it, expect } from 'vitest';
import { SchemaEncoder } from '../src/schema-encoder';

describe('SchemaEncoder.definition', () => {
  it('reconstructs the original definition string', () => {
    const def = 'string name, uint256 age, bool active';
    const encoder = new SchemaEncoder(def);
    expect(encoder.definition).toBe(def);
  });

  it('normalizes whitespace', () => {
    const encoder = new SchemaEncoder('string  name ,  uint256   age');
    expect(encoder.definition).toBe('string name, uint256 age');
  });
});

describe('SchemaEncoder.generateDefaults', () => {
  it('returns correct defaults for common types', () => {
    const encoder = new SchemaEncoder(
      'string name, uint256 score, bool active, address wallet, bytes32 hash',
    );
    const defaults = encoder.generateDefaults();

    expect(defaults.name).toBe('');
    expect(defaults.score).toBe(BigInt(0)); // uint256 → BigInt
    expect(defaults.active).toBe(false);
    expect(defaults.wallet).toBe('0x0000000000000000000000000000000000000000');
    expect(defaults.hash).toBe('0x' + '00'.repeat(32));
  });

  it('returns number for small uint types', () => {
    const encoder = new SchemaEncoder('uint8 a, uint16 b, uint32 c, uint48 d');
    const defaults = encoder.generateDefaults();

    expect(defaults.a).toBe(0);
    expect(defaults.b).toBe(0);
    expect(defaults.c).toBe(0);
    expect(defaults.d).toBe(0);
    // All should be number, not BigInt
    expect(typeof defaults.a).toBe('number');
    expect(typeof defaults.d).toBe('number');
  });

  it('returns BigInt for large uint types', () => {
    const encoder = new SchemaEncoder('uint64 a, uint128 b, uint256 c');
    const defaults = encoder.generateDefaults();

    expect(defaults.a).toBe(BigInt(0));
    expect(defaults.b).toBe(BigInt(0));
    expect(defaults.c).toBe(BigInt(0));
  });

  it('returns empty array for array types', () => {
    const encoder = new SchemaEncoder('uint256[] scores, address[] wallets');
    const defaults = encoder.generateDefaults();

    expect(defaults.scores).toEqual([]);
    expect(defaults.wallets).toEqual([]);
  });

  it('returns 0x for dynamic bytes', () => {
    const encoder = new SchemaEncoder('bytes data');
    expect(encoder.generateDefaults().data).toBe('0x');
  });
});

describe('SchemaEncoder.toJSONSchema', () => {
  it('produces a valid JSON Schema object', () => {
    const encoder = new SchemaEncoder('string name, uint256 age, bool active');
    const schema = encoder.toJSONSchema() as Record<string, unknown>;

    expect(schema.type).toBe('object');
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(['name', 'age', 'active']);
  });

  it('maps Solidity types to JSON Schema types correctly', () => {
    const encoder = new SchemaEncoder(
      'string s, uint256 u, bool b, address a, bytes32 bx, bytes d, uint8 small',
    );
    const schema = encoder.toJSONSchema() as any;

    expect(schema.properties.s.type).toBe('string');
    expect(schema.properties.u.type).toBe('integer');
    expect(schema.properties.b.type).toBe('boolean');
    expect(schema.properties.a.type).toBe('string');
    expect(schema.properties.a.format).toBe('address');
    expect(schema.properties.a.pattern).toBe('^0x[0-9a-fA-F]{40}$');
    expect(schema.properties.bx.type).toBe('string');
    expect(schema.properties.bx.format).toBe('bytes32');
    expect(schema.properties.d.type).toBe('string');
    expect(schema.properties.d.format).toBe('bytes');
    expect(schema.properties.small.type).toBe('integer');
  });

  it('maps array types to JSON Schema array', () => {
    const encoder = new SchemaEncoder('uint256[] scores');
    const schema = encoder.toJSONSchema() as any;

    expect(schema.properties.scores.type).toBe('array');
  });

  it('marks all fields as required (Solidity has no optional fields)', () => {
    const encoder = new SchemaEncoder('string a, string b, string c');
    const schema = encoder.toJSONSchema() as any;

    expect(schema.required).toEqual(['a', 'b', 'c']);
  });
});

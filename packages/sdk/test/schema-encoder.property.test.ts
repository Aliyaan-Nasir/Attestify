/**
 * Property-Based Tests for SchemaEncoder
 *
 * Property 24: Schema encoding round-trip
 * Property 25: Schema encoder rejects invalid types
 *
 * Uses fast-check for property-based testing with vitest.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SchemaEncoder, parseSchema, isValidSolidityType } from '../src/schema-encoder';

// ─── Generators ──────────────────────────────────────────────────────────────

/** Valid Solidity field name: starts with a letter, alphanumeric, 1-20 chars */
const fieldNameArb = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 8 })
  .map((s) => `f${s}`); // prefix to guarantee starts with letter and avoid collisions

/** Supported types for round-trip testing (the most common ones) */
const ROUND_TRIP_TYPES = [
  'string',
  'uint256',
  'uint8',
  'uint16',
  'uint32',
  'uint48',
  'uint64',
  'uint128',
  'bool',
  'address',
] as const;

const solidityTypeArb = fc.constantFrom(...ROUND_TRIP_TYPES);

/** Generate a value compatible with a given Solidity type */
function valueArbForType(type: string): fc.Arbitrary<unknown> {
  switch (type) {
    case 'string':
      return fc.string({ minLength: 0, maxLength: 50 });
    case 'bool':
      return fc.boolean();
    case 'address':
      // Valid 20-byte hex address
      return fc
        .uint8Array({ minLength: 20, maxLength: 20 })
        .map((bytes) => '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(''));
    case 'uint8':
      return fc.integer({ min: 0, max: 255 });
    case 'uint16':
      return fc.integer({ min: 0, max: 65535 });
    case 'uint32':
      return fc.integer({ min: 0, max: 0xffffffff });
    case 'uint48':
      return fc.integer({ min: 0, max: 2 ** 48 - 1 });
    case 'uint64':
      return fc.bigInt({ min: 0n, max: (1n << 64n) - 1n });
    case 'uint128':
      return fc.bigInt({ min: 0n, max: (1n << 128n) - 1n });
    case 'uint256':
      return fc.bigInt({ min: 0n, max: (1n << 256n) - 1n });
    default:
      return fc.constant(0);
  }
}

/** Bit threshold for safe int conversion (uint8-uint48 → number, uint64+ → BigInt) */
const SAFE_INT_BIT_THRESHOLD = 48;

function intBitSize(type: string): number | null {
  if (type === 'uint' || type === 'int') return 256;
  const m = type.match(/^u?int(\d+)$/);
  return m ? Number(m[1]) : null;
}


/**
 * Normalize a decoded value to match what the round-trip should produce.
 * - uint8-uint48: decoded as JS number
 * - uint64+: decoded as BigInt
 * - Input numbers for uint64+ are coerced to BigInt for comparison
 */
function normalizeExpected(value: unknown, type: string): unknown {
  const bits = intBitSize(type);
  if (bits === null) return value;

  if (bits <= SAFE_INT_BIT_THRESHOLD) {
    // Small ints: should come back as number
    return typeof value === 'bigint' ? Number(value) : Number(value);
  }
  // Large ints: should come back as BigInt
  return typeof value === 'bigint' ? value : BigInt(value);
}

/**
 * Generate a schema with 1-5 fields, each with a unique name and a supported type,
 * along with compatible values.
 */
const schemaWithValuesArb = fc
  .integer({ min: 1, max: 5 })
  .chain((numFields) => {
    // Generate unique field names
    const namesArb = fc
      .uniqueArray(fieldNameArb, { minLength: numFields, maxLength: numFields })
      .filter((names) => names.length === numFields);

    const typesArb = fc.tuple(...Array.from({ length: numFields }, () => solidityTypeArb));

    return fc.tuple(namesArb, typesArb).chain(([names, types]) => {
      const valuesArbs = types.map((t) => valueArbForType(t));
      return fc.tuple(fc.constant(names), fc.constant(types), fc.tuple(...valuesArbs));
    });
  })
  .map(([names, types, values]) => {
    const definition = names.map((n, i) => `${types[i]} ${n}`).join(', ');
    const valuesRecord: Record<string, unknown> = {};
    names.forEach((n, i) => {
      valuesRecord[n] = values[i];
    });
    return { definition, names, types, valuesRecord };
  });

// ─── Property 24: Schema Encoding Round-Trip ─────────────────────────────────

describe('Property 24: Schema encoding round-trip', () => {
  /**
   * **Validates: Requirements 22.1, 22.2, 22.3**
   *
   * For any valid schema definition and compatible values,
   * decode(encode(values)) should return the original values
   * (with BigInt coercion for small ints).
   */
  it('decode(encode(values)) preserves values for any valid schema and compatible values', () => {
    fc.assert(
      fc.property(schemaWithValuesArb, ({ definition, names, types, valuesRecord }) => {
        const encoder = new SchemaEncoder(definition);

        // Encode then decode
        const encoded = encoder.encode(valuesRecord);
        const decoded = encoder.decode(encoded);

        // Verify round-trip for each field
        for (let i = 0; i < names.length; i++) {
          const name = names[i];
          const type = types[i];
          const expected = normalizeExpected(valuesRecord[name], type);
          const actual = decoded[name];

          if (type === 'address') {
            // Address comparison is case-insensitive
            expect((actual as string).toLowerCase()).toBe((expected as string).toLowerCase());
          } else {
            expect(actual).toEqual(expected);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it('encoded output is a valid hex string with 0x prefix', () => {
    fc.assert(
      fc.property(schemaWithValuesArb, ({ definition, valuesRecord }) => {
        const encoder = new SchemaEncoder(definition);
        const encoded = encoder.encode(valuesRecord);
        expect(encoded).toMatch(/^0x[0-9a-f]+$/i);
      }),
      { numRuns: 100 },
    );
  });

  it('fields array matches the parsed schema definition', () => {
    fc.assert(
      fc.property(schemaWithValuesArb, ({ definition, names, types }) => {
        const encoder = new SchemaEncoder(definition);
        expect(encoder.fields.length).toBe(names.length);
        for (let i = 0; i < names.length; i++) {
          expect(encoder.fields[i].name).toBe(names[i]);
          expect(encoder.fields[i].type).toBe(types[i]);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 25: Schema Validation ──────────────────────────────────────────

describe('Property 25: Schema encoder rejects invalid types', () => {
  /**
   * **Validates: Requirements 22.4**
   *
   * For any valid schema, validate() returns true for compatible values
   * and false for incompatible ones.
   */
  it('validate() returns true for compatible values', () => {
    fc.assert(
      fc.property(schemaWithValuesArb, ({ definition, valuesRecord }) => {
        const encoder = new SchemaEncoder(definition);
        expect(encoder.validate(valuesRecord)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('validate() returns false when a required field is missing', () => {
    fc.assert(
      fc.property(
        schemaWithValuesArb,
        ({ definition, names, valuesRecord }) => {
          const encoder = new SchemaEncoder(definition);

          // Remove a random field
          const fieldToRemove = names[0];
          const incomplete = { ...valuesRecord };
          delete incomplete[fieldToRemove];

          expect(encoder.validate(incomplete)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('validate() returns false when a field has an incompatible type', () => {
    fc.assert(
      fc.property(schemaWithValuesArb, ({ definition, names, types, valuesRecord }) => {
        const encoder = new SchemaEncoder(definition);

        // Find a field and replace its value with an incompatible type
        const corrupted = { ...valuesRecord };
        for (let i = 0; i < names.length; i++) {
          const type = types[i];
          // Assign a value that is incompatible with the field type
          if (type === 'bool') {
            corrupted[names[i]] = 'not-a-boolean';
          } else if (type === 'string') {
            corrupted[names[i]] = 12345; // number is not compatible with string
          } else if (/^uint/.test(type)) {
            corrupted[names[i]] = true; // boolean is not compatible with uint
          } else if (type === 'address') {
            corrupted[names[i]] = 42; // number is not compatible with address
          }
          break; // corrupt just one field
        }

        expect(encoder.validate(corrupted)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  /** Invalid Solidity types should cause parseSchema / constructor to throw */
  it('constructor throws for schemas with invalid Solidity types', () => {
    const invalidTypes = ['uint7', 'int3', 'bytes0', 'bytes33', 'mapping', 'tuple', 'float', 'double'];

    fc.assert(
      fc.property(
        fc.constantFrom(...invalidTypes),
        fieldNameArb,
        (invalidType, name) => {
          const definition = `${invalidType} ${name}`;
          expect(() => new SchemaEncoder(definition)).toThrow(/Invalid Solidity ABI type/);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('parseSchema throws with a message identifying the invalid field', () => {
    const invalidTypes = ['uint7', 'bytes0', 'float128', 'mapping'];

    fc.assert(
      fc.property(
        fc.constantFrom(...invalidTypes),
        fieldNameArb,
        (invalidType, name) => {
          expect(() => parseSchema(`${invalidType} ${name}`)).toThrow(invalidType);
          expect(() => parseSchema(`${invalidType} ${name}`)).toThrow(name);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('isValidSolidityType returns true for all supported round-trip types', () => {
    for (const type of ROUND_TRIP_TYPES) {
      expect(isValidSolidityType(type)).toBe(true);
    }
  });

  it('isValidSolidityType returns false for invalid types', () => {
    const invalidTypes = ['uint7', 'int3', 'bytes0', 'bytes33', 'mapping', 'tuple', 'float'];
    for (const type of invalidTypes) {
      expect(isValidSolidityType(type)).toBe(false);
    }
  });
});

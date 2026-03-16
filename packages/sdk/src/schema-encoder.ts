/**
 * SchemaEncoder — ABI-based schema encoding/decoding for Attestify
 *
 * Parses comma-separated Solidity-typed schema definitions (e.g. "string name, uint256 age, bool active"),
 * encodes attestation data to ABI-encoded hex, and decodes it back to typed values.
 */

import { AbiCoder } from 'ethers';
import type { SchemaFieldDefinition } from './types';

// ─── Valid Solidity ABI type patterns ────────────────────────────────────────

/** Base integer sizes: 8, 16, 24, … 256 */
const VALID_INT_SIZES = new Set(
  Array.from({ length: 32 }, (_, i) => (i + 1) * 8),
);

/** Fixed-size bytes: bytes1 … bytes32 */
const VALID_BYTES_SIZES = new Set(
  Array.from({ length: 32 }, (_, i) => i + 1),
);

/**
 * Integer sizes that can safely be represented as a JS number (≤ 48 bits).
 * uint8–uint48 and int8–int48 decoded values are converted from BigInt → number.
 */
const SAFE_INT_BIT_THRESHOLD = 48;

// ─── Type validation ─────────────────────────────────────────────────────────

/**
 * Returns `true` when `baseType` is a valid Solidity ABI base type
 * (no trailing `[]` or `[N]` — those are handled separately).
 */
function isValidBaseType(baseType: string): boolean {
  // Exact matches
  if (['address', 'bool', 'string', 'bytes'].includes(baseType)) return true;

  // uint<N> / int<N>
  const intMatch = baseType.match(/^(u?int)(\d+)$/);
  if (intMatch) {
    const size = Number(intMatch[2]);
    return VALID_INT_SIZES.has(size);
  }

  // Bare uint / int → aliases for uint256 / int256
  if (baseType === 'uint' || baseType === 'int') return true;

  // bytes<N>
  const bytesMatch = baseType.match(/^bytes(\d+)$/);
  if (bytesMatch) {
    const size = Number(bytesMatch[1]);
    return VALID_BYTES_SIZES.has(size);
  }

  return false;
}

/**
 * Validates a full Solidity ABI type string, including array suffixes.
 * Supports: `uint256`, `address[]`, `bytes32[5]`, etc.
 * Tuples are NOT supported.
 */
function isValidSolidityType(type: string): boolean {
  // Strip trailing array dimensions: `uint256[]` → `uint256`, `address[5]` → `address`
  const stripped = type.replace(/(\[\d*\])+$/, '');
  return isValidBaseType(stripped);
}

// ─── Schema parsing ──────────────────────────────────────────────────────────

/**
 * Parse a comma-separated schema definition string into an array of field definitions.
 *
 * @example
 * parseSchema("string name, uint256 age, bool active")
 * // → [{ type: "string", name: "name" }, { type: "uint256", name: "age" }, { type: "bool", name: "active" }]
 *
 * @throws Error if the definition is empty, a field is malformed, or a type is invalid.
 */
function parseSchema(definition: string): SchemaFieldDefinition[] {
  const trimmed = definition.trim();
  if (!trimmed) {
    throw new Error('Schema definition must not be empty');
  }

  const fields: SchemaFieldDefinition[] = [];
  const parts = trimmed.split(',');

  for (const part of parts) {
    const segment = part.trim();
    if (!segment) {
      throw new Error('Schema definition contains an empty field segment');
    }

    // Split on whitespace — expect exactly "type name"
    const tokens = segment.split(/\s+/);
    if (tokens.length !== 2) {
      throw new Error(
        `Invalid schema field "${segment}": expected "type name" format`,
      );
    }

    const [type, name] = tokens;

    if (!isValidSolidityType(type)) {
      throw new Error(
        `Invalid Solidity ABI type "${type}" for field "${name}"`,
      );
    }

    fields.push({ type, name });
  }

  return fields;
}

// ─── BigInt ↔ number helpers ─────────────────────────────────────────────────

/**
 * Extracts the bit-size from an integer type string.
 * Returns `null` for non-integer types.
 */
function intBitSize(type: string): number | null {
  if (type === 'uint' || type === 'int') return 256;
  const m = type.match(/^u?int(\d+)$/);
  return m ? Number(m[1]) : null;
}

/**
 * Returns `true` when the base type is a small-enough integer that its decoded
 * BigInt value can safely be converted to a JS number.
 */
function isSafeIntType(baseType: string): boolean {
  const bits = intBitSize(baseType);
  return bits !== null && bits <= SAFE_INT_BIT_THRESHOLD;
}

/**
 * Recursively convert BigInt values to numbers for "safe" integer types.
 * For arrays, each element is converted individually.
 */
function coerceDecodedValue(value: unknown, type: string): unknown {
  // Strip array suffix to get the base element type
  const baseType = type.replace(/(\[\d*\])+$/, '');
  const isArray = type !== baseType;

  if (isArray && Array.isArray(value)) {
    return (value as unknown[]).map((v) => coerceDecodedValue(v, baseType));
  }

  if (typeof value === 'bigint' && isSafeIntType(baseType)) {
    return Number(value);
  }

  return value;
}

// ─── SchemaEncoder class ─────────────────────────────────────────────────────

export class SchemaEncoder {
  /** Parsed field definitions (readonly). */
  readonly fields: readonly SchemaFieldDefinition[];

  /** Ordered Solidity type strings for ABI encoding. */
  private readonly types: string[];

  /** Ordered field names matching `types`. */
  private readonly names: string[];

  private readonly coder = AbiCoder.defaultAbiCoder();

  /**
   * @param schema Comma-separated schema definition, e.g. `"string name, uint256 age, bool active"`.
   * @throws Error if the schema is invalid.
   */
  constructor(schema: string) {
    const parsed = parseSchema(schema);
    this.fields = Object.freeze([...parsed]);
    this.types = parsed.map((f) => f.type);
    this.names = parsed.map((f) => f.name);
  }

  /**
   * ABI-encode a set of values according to the schema field order.
   *
   * @param values Record mapping field names to their values.
   * @returns Hex-encoded ABI bytes (with `0x` prefix).
   * @throws Error if a required field is missing.
   */
  encode(values: Record<string, unknown>): string {
    const ordered: unknown[] = [];

    for (const name of this.names) {
      if (!(name in values)) {
        throw new Error(`Missing required field "${name}"`);
      }
      ordered.push(values[name]);
    }

    return this.coder.encode(this.types, ordered);
  }

  /**
   * Decode ABI-encoded hex data back to a typed Record.
   *
   * BigInt values for small integer types (uint8–uint48, int8–int48) are
   * automatically converted to JS numbers. Larger integers remain as BigInt.
   *
   * @param data Hex-encoded ABI bytes (with or without `0x` prefix).
   * @returns Record mapping field names to decoded values.
   */
  decode(data: string): Record<string, unknown> {
    const decoded = this.coder.decode(this.types, data);
    const result: Record<string, unknown> = {};

    for (let i = 0; i < this.names.length; i++) {
      result[this.names[i]] = coerceDecodedValue(decoded[i], this.types[i]);
    }

    return result;
  }

  /**
   * Validate that a values Record is compatible with the schema.
   *
   * Checks:
   * - All required fields are present.
   * - Value types are broadly compatible with their Solidity types.
   *
   * @returns `true` when valid, `false` otherwise.
   */
  validate(values: Record<string, unknown>): boolean {
    for (let i = 0; i < this.names.length; i++) {
      const name = this.names[i];
      if (!(name in values)) return false;

      const value = values[name];
      const type = this.types[i];

      if (!isValueCompatible(value, type)) return false;
    }
    return true;
  }

  /**
   * Reconstruct the original comma-separated schema definition string.
   *
   * @example
   * new SchemaEncoder("string name, uint256 age").definition
   * // → "string name, uint256 age"
   */
  get definition(): string {
    return this.fields.map((f) => `${f.type} ${f.name}`).join(', ');
  }

  /**
   * Generate a Record with sensible default values for every field.
   * Useful for pre-populating forms in the sandbox / frontend.
   *
   * Mirrors the Stellar SDK's `SorobanSchemaEncoder.generateDefaults()`.
   */
  generateDefaults(): Record<string, unknown> {
    const defaults: Record<string, unknown> = {};

    for (let i = 0; i < this.names.length; i++) {
      defaults[this.names[i]] = getDefaultValue(this.types[i]);
    }

    return defaults;
  }

  /**
   * Convert the schema to a JSON Schema (draft-07) object.
   * Useful for form generation, API documentation, and interoperability.
   *
   * Mirrors the Stellar SDK's `SorobanSchemaEncoder.toJSONSchema()`.
   */
  toJSONSchema(): object {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (let i = 0; i < this.names.length; i++) {
      const name = this.names[i];
      const type = this.types[i];

      const prop: Record<string, unknown> = {
        type: solidityTypeToJSONSchemaType(type),
      };

      // Add format hints for Solidity-specific types
      if (type === 'address') {
        prop.format = 'address';
        prop.pattern = '^0x[0-9a-fA-F]{40}$';
      } else if (type === 'bool') {
        // no extra hints needed
      } else if (/^bytes\d+$/.test(type)) {
        const size = Number(type.replace('bytes', ''));
        prop.format = `bytes${size}`;
        prop.pattern = `^0x[0-9a-fA-F]{${size * 2}}$`;
      } else if (type === 'bytes') {
        prop.format = 'bytes';
        prop.pattern = '^0x[0-9a-fA-F]*$';
      }

      properties[name] = prop;
      required.push(name);
    }

    return {
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    };
  }

  /**
   * Static helper: parse a comma-separated schema definition string.
   * Validates each type against known Solidity ABI types.
   *
   * @returns Array of field definitions.
   * @throws Error on invalid definition.
   */
  static parseSchema(definition: string): SchemaFieldDefinition[] {
    return parseSchema(definition);
  }
}

// ─── Default value generation ────────────────────────────────────────────────

/**
 * Return a sensible default value for a Solidity ABI type.
 * Used by `SchemaEncoder.generateDefaults()`.
 */
function getDefaultValue(type: string): unknown {
  const baseType = type.replace(/(\[\d*\])+$/, '');
  const isArray = type !== baseType;

  if (isArray) return [];

  switch (baseType) {
    case 'string':
      return '';
    case 'bool':
      return false;
    case 'address':
      return '0x0000000000000000000000000000000000000000';
    case 'bytes':
      return '0x';
    default:
      break;
  }

  // bytesN → zero-filled hex
  if (/^bytes\d+$/.test(baseType)) {
    const size = Number(baseType.replace('bytes', ''));
    return '0x' + '00'.repeat(size);
  }

  // uint / int variants → 0 (number for small, BigInt for large)
  const bits = intBitSize(baseType);
  if (bits !== null) {
    return bits <= SAFE_INT_BIT_THRESHOLD ? 0 : BigInt(0);
  }

  return null;
}

// ─── JSON Schema mapping ─────────────────────────────────────────────────────

/**
 * Map a Solidity ABI type to a JSON Schema "type" string.
 */
function solidityTypeToJSONSchemaType(type: string): string {
  const baseType = type.replace(/(\[\d*\])+$/, '');
  const isArray = type !== baseType;

  if (isArray) return 'array';

  if (/^u?int\d*$/.test(baseType)) return 'integer';
  if (baseType === 'bool') return 'boolean';
  // string, address, bytes, bytesN all represented as string in JSON Schema
  return 'string';
}

// ─── Value compatibility check ───────────────────────────────────────────────

/**
 * Loose check that `value` is broadly compatible with the given Solidity `type`.
 * This is a best-effort JS-side check — the ABI encoder itself is the final authority.
 */
function isValueCompatible(value: unknown, type: string): boolean {
  const baseType = type.replace(/(\[\d*\])+$/, '');
  const isArray = type !== baseType;

  if (isArray) {
    return Array.isArray(value) && (value as unknown[]).every((v) => isValueCompatible(v, baseType));
  }

  if (value === null || value === undefined) return false;

  // Integer types
  if (/^u?int\d*$/.test(baseType)) {
    return typeof value === 'number' || typeof value === 'bigint' || typeof value === 'string';
  }

  if (baseType === 'bool') {
    return typeof value === 'boolean';
  }

  if (baseType === 'string') {
    return typeof value === 'string';
  }

  if (baseType === 'address') {
    return typeof value === 'string';
  }

  // bytes / bytesN
  if (baseType === 'bytes' || /^bytes\d+$/.test(baseType)) {
    return typeof value === 'string' || value instanceof Uint8Array;
  }

  return false;
}

// Re-export helpers for testing convenience
export { parseSchema, isValidSolidityType };

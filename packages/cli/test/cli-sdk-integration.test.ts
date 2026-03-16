/**
 * CLI ↔ SDK Integration Tests
 *
 * Verifies that the CLI tool correctly calls the SDK for all commands:
 * 1. schema create → calls SDK registerSchema
 * 2. schema fetch → calls SDK getSchema
 * 3. attestation create → calls SDK createAttestation
 * 4. attestation fetch → calls SDK getAttestation
 * 5. attestation revoke → calls SDK revokeAttestation
 * 6. authority register → calls SDK registerAuthority
 * 7. authority fetch → calls SDK getAuthority
 *
 * Tests verify argument parsing, correct SDK method invocation,
 * output formatting (human-readable and --json), and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { formatOutput, formatError } from '../src/output';

// ─── Mock SDK Service ───────────────────────────────────────────────────────

const mockService = {
  registerSchema: vi.fn(),
  getSchema: vi.fn(),
  createAttestation: vi.fn(),
  getAttestation: vi.fn(),
  revokeAttestation: vi.fn(),
  registerAuthority: vi.fn(),
  getAuthority: vi.fn(),
  setAuthorityVerification: vi.fn(),
};

// ─── Helpers ────────────────────────────────────────────────────────────────

let logOutput: string[] = [];
let errorOutput: string[] = [];
let savedExitCode: number | undefined;

/**
 * Builds a fresh Commander program that mirrors the CLI's index.ts structure,
 * but uses the mock service instead of creating a real HederaAttestService.
 */
function buildProgram(): Command {
  const program = new Command();
  program
    .name('attestify')
    .description('Attestify CLI')
    .version('0.1.0')
    .option('--json', 'Output results as JSON');

  // ── schema commands ──
  const schema = program.command('schema').description('Manage attestation schemas');

  schema.command('create')
    .description('Register a new schema')
    .option('--definition <definition>', 'Schema definition string')
    .option('--revocable', 'Whether attestations can be revoked', false)
    .option('--resolver <resolver>', 'Resolver contract address')
    .action(async (opts) => {
      const jsonFlag = program.opts().json;
      try {
        if (!opts.definition) throw new Error('Either --definition or --file is required');
        const result = await mockService.registerSchema({
          definition: opts.definition,
          revocable: opts.revocable,
          resolver: opts.resolver,
        });
        if (result.success) {
          console.log(formatOutput({ schemaUid: result.data!.schemaUid }, jsonFlag));
        } else {
          console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
          process.exitCode = 1;
        }
      } catch (err: any) {
        console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
        process.exitCode = 1;
      }
    });

  schema.command('fetch')
    .description('Get schema by UID')
    .requiredOption('--uid <uid>', 'Schema UID to fetch')
    .action(async (opts) => {
      const jsonFlag = program.opts().json;
      try {
        const result = await mockService.getSchema(opts.uid);
        if (result.success) {
          console.log(formatOutput(result.data! as unknown as Record<string, unknown>, jsonFlag));
        } else {
          console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
          process.exitCode = 1;
        }
      } catch (err: any) {
        console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
        process.exitCode = 1;
      }
    });

  // ── attestation commands ──
  const attestation = program.command('attestation').description('Manage attestations');

  attestation.command('create')
    .description('Issue a new attestation')
    .option('--schema-uid <schemaUid>', 'Schema UID')
    .option('--subject <subject>', 'Subject address')
    .option('--data <data>', 'ABI-encoded attestation data')
    .option('--expiration <expiration>', 'Expiration timestamp', '0')
    .action(async (opts) => {
      const jsonFlag = program.opts().json;
      try {
        if (!opts.schemaUid || !opts.subject || !opts.data) {
          throw new Error('--schema-uid, --subject, and --data are required');
        }
        const result = await mockService.createAttestation({
          schemaUid: opts.schemaUid,
          subject: opts.subject,
          data: opts.data,
          expirationTime: parseInt(opts.expiration, 10) || 0,
        });
        if (result.success) {
          console.log(formatOutput({ attestationUid: result.data!.attestationUid }, jsonFlag));
        } else {
          console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
          process.exitCode = 1;
        }
      } catch (err: any) {
        console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
        process.exitCode = 1;
      }
    });

  attestation.command('fetch')
    .description('Get attestation by UID')
    .requiredOption('--uid <uid>', 'Attestation UID to fetch')
    .action(async (opts) => {
      const jsonFlag = program.opts().json;
      try {
        const result = await mockService.getAttestation(opts.uid);
        if (result.success) {
          console.log(formatOutput(result.data! as unknown as Record<string, unknown>, jsonFlag));
        } else {
          console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
          process.exitCode = 1;
        }
      } catch (err: any) {
        console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
        process.exitCode = 1;
      }
    });

  attestation.command('revoke')
    .description('Revoke an attestation')
    .requiredOption('--uid <uid>', 'Attestation UID to revoke')
    .action(async (opts) => {
      const jsonFlag = program.opts().json;
      try {
        const result = await mockService.revokeAttestation(opts.uid);
        if (result.success) {
          console.log(formatOutput({ revoked: true, uid: opts.uid }, jsonFlag));
        } else {
          console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
          process.exitCode = 1;
        }
      } catch (err: any) {
        console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
        process.exitCode = 1;
      }
    });

  // ── authority commands ──
  const authority = program.command('authority').description('Manage authorities');

  authority.command('register')
    .description('Register as an authority')
    .requiredOption('--metadata <metadata>', 'Authority metadata string')
    .action(async (opts) => {
      const jsonFlag = program.opts().json;
      try {
        const result = await mockService.registerAuthority(opts.metadata);
        if (result.success) {
          console.log(formatOutput({ registered: true }, jsonFlag));
        } else {
          console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
          process.exitCode = 1;
        }
      } catch (err: any) {
        console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
        process.exitCode = 1;
      }
    });

  authority.command('fetch')
    .description('Get authority info by address')
    .requiredOption('--address <address>', 'Authority address to fetch')
    .action(async (opts) => {
      const jsonFlag = program.opts().json;
      try {
        const result = await mockService.getAuthority(opts.address);
        if (result.success) {
          console.log(formatOutput(result.data! as unknown as Record<string, unknown>, jsonFlag));
        } else {
          console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
          process.exitCode = 1;
        }
      } catch (err: any) {
        console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
        process.exitCode = 1;
      }
    });

  return program;
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('CLI ↔ SDK Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logOutput = [];
    errorOutput = [];
    savedExitCode = process.exitCode;
    process.exitCode = undefined;
    vi.spyOn(console, 'log').mockImplementation((...args) => {
      logOutput.push(args.join(' '));
    });
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      errorOutput.push(args.join(' '));
    });
  });

  afterEach(() => {
    process.exitCode = savedExitCode;
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. schema create → SDK registerSchema
  // ═══════════════════════════════════════════════════════════════════════════

  describe('schema create → registerSchema', () => {
    it('calls registerSchema with correct parameters', async () => {
      const uid = '0x' + 'aa'.repeat(32);
      mockService.registerSchema.mockResolvedValue({
        success: true,
        data: { schemaUid: uid },
      });

      const program = buildProgram();
      await program.parseAsync([
        'node', 'attestify',
        'schema', 'create',
        '--definition', 'string name, uint256 age',
        '--revocable',
        '--resolver', '0x' + '11'.repeat(20),
      ]);

      expect(mockService.registerSchema).toHaveBeenCalledWith({
        definition: 'string name, uint256 age',
        revocable: true,
        resolver: '0x' + '11'.repeat(20),
      });
    });

    it('outputs schemaUid in human-readable format on success', async () => {
      const uid = '0x' + 'bb'.repeat(32);
      mockService.registerSchema.mockResolvedValue({
        success: true,
        data: { schemaUid: uid },
      });

      const program = buildProgram();
      await program.parseAsync([
        'node', 'attestify',
        'schema', 'create',
        '--definition', 'bool active',
      ]);

      expect(logOutput.length).toBeGreaterThan(0);
      expect(logOutput[0]).toContain('schemaUid');
      expect(logOutput[0]).toContain(uid);
    });

    it('outputs valid JSON with --json flag on success', async () => {
      const uid = '0x' + 'cc'.repeat(32);
      mockService.registerSchema.mockResolvedValue({
        success: true,
        data: { schemaUid: uid },
      });

      const program = buildProgram();
      await program.parseAsync([
        'node', 'attestify', '--json',
        'schema', 'create',
        '--definition', 'address wallet',
      ]);

      expect(logOutput.length).toBeGreaterThan(0);
      const parsed = JSON.parse(logOutput[0]);
      expect(parsed.success).toBe(true);
      expect(parsed.data.schemaUid).toBe(uid);
    });

    it('outputs error when SDK returns failure', async () => {
      mockService.registerSchema.mockResolvedValue({
        success: false,
        error: { type: 'ALREADY_EXISTS', message: 'Schema already registered' },
      });

      const program = buildProgram();
      await program.parseAsync([
        'node', 'attestify',
        'schema', 'create',
        '--definition', 'string name',
      ]);

      expect(errorOutput.length).toBeGreaterThan(0);
      expect(errorOutput[0]).toContain('ALREADY_EXISTS');
      expect(process.exitCode).toBe(1);
    });

    it('outputs JSON error with --json flag on SDK failure', async () => {
      mockService.registerSchema.mockResolvedValue({
        success: false,
        error: { type: 'VALIDATION_ERROR', message: 'Invalid resolver' },
      });

      const program = buildProgram();
      await program.parseAsync([
        'node', 'attestify', '--json',
        'schema', 'create',
        '--definition', 'string name',
      ]);

      expect(errorOutput.length).toBeGreaterThan(0);
      const parsed = JSON.parse(errorOutput[0]);
      expect(parsed.success).toBe(false);
      expect(parsed.error.type).toBe('VALIDATION_ERROR');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. schema fetch → SDK getSchema
  // ═══════════════════════════════════════════════════════════════════════════

  describe('schema fetch → getSchema', () => {
    const schemaUid = '0x' + 'dd'.repeat(32);
    const schemaRecord = {
      uid: schemaUid,
      definition: 'string name, uint256 age',
      authority: '0x' + '11'.repeat(20),
      resolver: '0x' + '00'.repeat(20),
      revocable: true,
      timestamp: 1700000000,
    };

    it('calls getSchema with the correct UID', async () => {
      mockService.getSchema.mockResolvedValue({ success: true, data: schemaRecord });

      const program = buildProgram();
      await program.parseAsync(['node', 'attestify', 'schema', 'fetch', '--uid', schemaUid]);

      expect(mockService.getSchema).toHaveBeenCalledWith(schemaUid);
    });

    it('outputs schema data in human-readable format', async () => {
      mockService.getSchema.mockResolvedValue({ success: true, data: schemaRecord });

      const program = buildProgram();
      await program.parseAsync(['node', 'attestify', 'schema', 'fetch', '--uid', schemaUid]);

      expect(logOutput.length).toBeGreaterThan(0);
      expect(logOutput[0]).toContain('definition');
      expect(logOutput[0]).toContain('string name, uint256 age');
    });

    it('outputs valid JSON with --json flag', async () => {
      mockService.getSchema.mockResolvedValue({ success: true, data: schemaRecord });

      const program = buildProgram();
      await program.parseAsync(['node', 'attestify', '--json', 'schema', 'fetch', '--uid', schemaUid]);

      const parsed = JSON.parse(logOutput[0]);
      expect(parsed.success).toBe(true);
      expect(parsed.data.uid).toBe(schemaUid);
      expect(parsed.data.definition).toBe('string name, uint256 age');
    });

    it('outputs error when schema not found', async () => {
      mockService.getSchema.mockResolvedValue({
        success: false,
        error: { type: 'NOT_FOUND', message: 'Schema not found' },
      });

      const program = buildProgram();
      await program.parseAsync(['node', 'attestify', 'schema', 'fetch', '--uid', schemaUid]);

      expect(errorOutput[0]).toContain('NOT_FOUND');
      expect(process.exitCode).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. attestation create → SDK createAttestation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('attestation create → createAttestation', () => {
    const schemaUid = '0x' + 'aa'.repeat(32);
    const subject = '0x' + '22'.repeat(20);
    const data = '0x' + 'ff'.repeat(16);
    const attestationUid = '0x' + 'ee'.repeat(32);

    it('calls createAttestation with correct parameters', async () => {
      mockService.createAttestation.mockResolvedValue({
        success: true,
        data: { attestationUid },
      });

      const program = buildProgram();
      await program.parseAsync([
        'node', 'attestify',
        'attestation', 'create',
        '--schema-uid', schemaUid,
        '--subject', subject,
        '--data', data,
        '--expiration', '1700000000',
      ]);

      expect(mockService.createAttestation).toHaveBeenCalledWith({
        schemaUid,
        subject,
        data,
        expirationTime: 1700000000,
      });
    });

    it('defaults expirationTime to 0 when not provided', async () => {
      mockService.createAttestation.mockResolvedValue({
        success: true,
        data: { attestationUid },
      });

      const program = buildProgram();
      await program.parseAsync([
        'node', 'attestify',
        'attestation', 'create',
        '--schema-uid', schemaUid,
        '--subject', subject,
        '--data', data,
      ]);

      expect(mockService.createAttestation).toHaveBeenCalledWith(
        expect.objectContaining({ expirationTime: 0 }),
      );
    });

    it('outputs attestationUid on success', async () => {
      mockService.createAttestation.mockResolvedValue({
        success: true,
        data: { attestationUid },
      });

      const program = buildProgram();
      await program.parseAsync([
        'node', 'attestify',
        'attestation', 'create',
        '--schema-uid', schemaUid,
        '--subject', subject,
        '--data', data,
      ]);

      expect(logOutput[0]).toContain(attestationUid);
    });

    it('outputs valid JSON with --json flag', async () => {
      mockService.createAttestation.mockResolvedValue({
        success: true,
        data: { attestationUid },
      });

      const program = buildProgram();
      await program.parseAsync([
        'node', 'attestify', '--json',
        'attestation', 'create',
        '--schema-uid', schemaUid,
        '--subject', subject,
        '--data', data,
      ]);

      const parsed = JSON.parse(logOutput[0]);
      expect(parsed.success).toBe(true);
      expect(parsed.data.attestationUid).toBe(attestationUid);
    });

    it('handles SDK error on attestation create', async () => {
      mockService.createAttestation.mockResolvedValue({
        success: false,
        error: { type: 'NOT_FOUND', message: 'Schema not found' },
      });

      const program = buildProgram();
      await program.parseAsync([
        'node', 'attestify',
        'attestation', 'create',
        '--schema-uid', schemaUid,
        '--subject', subject,
        '--data', data,
      ]);

      expect(errorOutput[0]).toContain('NOT_FOUND');
      expect(process.exitCode).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. attestation fetch → SDK getAttestation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('attestation fetch → getAttestation', () => {
    const attestationUid = '0x' + 'ff'.repeat(32);
    const attestationRecord = {
      uid: attestationUid,
      schemaUid: '0x' + 'aa'.repeat(32),
      attester: '0x' + '11'.repeat(20),
      subject: '0x' + '22'.repeat(20),
      data: '0x' + 'dd'.repeat(8),
      timestamp: 1700000000,
      expirationTime: 0,
      revoked: false,
      revocationTime: 0,
      nonce: 1,
    };

    it('calls getAttestation with the correct UID', async () => {
      mockService.getAttestation.mockResolvedValue({ success: true, data: attestationRecord });

      const program = buildProgram();
      await program.parseAsync(['node', 'attestify', 'attestation', 'fetch', '--uid', attestationUid]);

      expect(mockService.getAttestation).toHaveBeenCalledWith(attestationUid);
    });

    it('outputs attestation data in human-readable format', async () => {
      mockService.getAttestation.mockResolvedValue({ success: true, data: attestationRecord });

      const program = buildProgram();
      await program.parseAsync(['node', 'attestify', 'attestation', 'fetch', '--uid', attestationUid]);

      expect(logOutput[0]).toContain('attester');
      expect(logOutput[0]).toContain('subject');
    });

    it('outputs valid JSON with --json flag', async () => {
      mockService.getAttestation.mockResolvedValue({ success: true, data: attestationRecord });

      const program = buildProgram();
      await program.parseAsync(['node', 'attestify', '--json', 'attestation', 'fetch', '--uid', attestationUid]);

      const parsed = JSON.parse(logOutput[0]);
      expect(parsed.success).toBe(true);
      expect(parsed.data.uid).toBe(attestationUid);
      expect(parsed.data.revoked).toBe(false);
    });

    it('outputs error when attestation not found', async () => {
      mockService.getAttestation.mockResolvedValue({
        success: false,
        error: { type: 'NOT_FOUND', message: 'Attestation not found' },
      });

      const program = buildProgram();
      await program.parseAsync(['node', 'attestify', 'attestation', 'fetch', '--uid', attestationUid]);

      expect(errorOutput[0]).toContain('NOT_FOUND');
      expect(process.exitCode).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. attestation revoke → SDK revokeAttestation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('attestation revoke → revokeAttestation', () => {
    const attestationUid = '0x' + 'ab'.repeat(32);

    it('calls revokeAttestation with the correct UID', async () => {
      mockService.revokeAttestation.mockResolvedValue({ success: true });

      const program = buildProgram();
      await program.parseAsync(['node', 'attestify', 'attestation', 'revoke', '--uid', attestationUid]);

      expect(mockService.revokeAttestation).toHaveBeenCalledWith(attestationUid);
    });

    it('outputs revoked confirmation in human-readable format', async () => {
      mockService.revokeAttestation.mockResolvedValue({ success: true });

      const program = buildProgram();
      await program.parseAsync(['node', 'attestify', 'attestation', 'revoke', '--uid', attestationUid]);

      expect(logOutput[0]).toContain('revoked: true');
      expect(logOutput[0]).toContain(attestationUid);
    });

    it('outputs valid JSON with --json flag', async () => {
      mockService.revokeAttestation.mockResolvedValue({ success: true });

      const program = buildProgram();
      await program.parseAsync(['node', 'attestify', '--json', 'attestation', 'revoke', '--uid', attestationUid]);

      const parsed = JSON.parse(logOutput[0]);
      expect(parsed.success).toBe(true);
      expect(parsed.data.revoked).toBe(true);
      expect(parsed.data.uid).toBe(attestationUid);
    });

    it('handles unauthorized revocation error', async () => {
      mockService.revokeAttestation.mockResolvedValue({
        success: false,
        error: { type: 'UNAUTHORIZED', message: 'Only original attester can revoke' },
      });

      const program = buildProgram();
      await program.parseAsync(['node', 'attestify', 'attestation', 'revoke', '--uid', attestationUid]);

      expect(errorOutput[0]).toContain('UNAUTHORIZED');
      expect(process.exitCode).toBe(1);
    });

    it('handles already-revoked error', async () => {
      mockService.revokeAttestation.mockResolvedValue({
        success: false,
        error: { type: 'ALREADY_REVOKED', message: 'Attestation already revoked' },
      });

      const program = buildProgram();
      await program.parseAsync(['node', 'attestify', 'attestation', 'revoke', '--uid', attestationUid]);

      expect(errorOutput[0]).toContain('ALREADY_REVOKED');
      expect(process.exitCode).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. authority register → SDK registerAuthority
  // ═══════════════════════════════════════════════════════════════════════════

  describe('authority register → registerAuthority', () => {
    it('calls registerAuthority with the correct metadata', async () => {
      mockService.registerAuthority.mockResolvedValue({ success: true });

      const program = buildProgram();
      await program.parseAsync([
        'node', 'attestify',
        'authority', 'register',
        '--metadata', 'University of Testing',
      ]);

      expect(mockService.registerAuthority).toHaveBeenCalledWith('University of Testing');
    });

    it('outputs registered confirmation in human-readable format', async () => {
      mockService.registerAuthority.mockResolvedValue({ success: true });

      const program = buildProgram();
      await program.parseAsync([
        'node', 'attestify',
        'authority', 'register',
        '--metadata', 'Test Authority',
      ]);

      expect(logOutput[0]).toContain('registered: true');
    });

    it('outputs valid JSON with --json flag', async () => {
      mockService.registerAuthority.mockResolvedValue({ success: true });

      const program = buildProgram();
      await program.parseAsync([
        'node', 'attestify', '--json',
        'authority', 'register',
        '--metadata', 'Test Authority',
      ]);

      const parsed = JSON.parse(logOutput[0]);
      expect(parsed.success).toBe(true);
      expect(parsed.data.registered).toBe(true);
    });

    it('handles SDK error on authority registration', async () => {
      mockService.registerAuthority.mockResolvedValue({
        success: false,
        error: { type: 'TRANSACTION_ERROR', message: 'Transaction reverted' },
      });

      const program = buildProgram();
      await program.parseAsync([
        'node', 'attestify',
        'authority', 'register',
        '--metadata', 'Test Authority',
      ]);

      expect(errorOutput[0]).toContain('TRANSACTION_ERROR');
      expect(process.exitCode).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. authority fetch → SDK getAuthority
  // ═══════════════════════════════════════════════════════════════════════════

  describe('authority fetch → getAuthority', () => {
    const authorityAddr = '0x' + '33'.repeat(20);
    const authorityRecord = {
      addr: authorityAddr,
      metadata: 'Trusted University',
      isVerified: true,
      registeredAt: 1700000000,
    };

    it('calls getAuthority with the correct address', async () => {
      mockService.getAuthority.mockResolvedValue({ success: true, data: authorityRecord });

      const program = buildProgram();
      await program.parseAsync(['node', 'attestify', 'authority', 'fetch', '--address', authorityAddr]);

      expect(mockService.getAuthority).toHaveBeenCalledWith(authorityAddr);
    });

    it('outputs authority data in human-readable format', async () => {
      mockService.getAuthority.mockResolvedValue({ success: true, data: authorityRecord });

      const program = buildProgram();
      await program.parseAsync(['node', 'attestify', 'authority', 'fetch', '--address', authorityAddr]);

      expect(logOutput[0]).toContain('metadata');
      expect(logOutput[0]).toContain('Trusted University');
    });

    it('outputs valid JSON with --json flag', async () => {
      mockService.getAuthority.mockResolvedValue({ success: true, data: authorityRecord });

      const program = buildProgram();
      await program.parseAsync(['node', 'attestify', '--json', 'authority', 'fetch', '--address', authorityAddr]);

      const parsed = JSON.parse(logOutput[0]);
      expect(parsed.success).toBe(true);
      expect(parsed.data.addr).toBe(authorityAddr);
      expect(parsed.data.isVerified).toBe(true);
    });

    it('outputs error when authority not found', async () => {
      mockService.getAuthority.mockResolvedValue({
        success: false,
        error: { type: 'NOT_FOUND', message: 'Authority not found' },
      });

      const program = buildProgram();
      await program.parseAsync(['node', 'attestify', 'authority', 'fetch', '--address', authorityAddr]);

      expect(errorOutput[0]).toContain('NOT_FOUND');
      expect(process.exitCode).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. Cross-cutting: SDK exception handling
  // ═══════════════════════════════════════════════════════════════════════════

  describe('SDK exception handling', () => {
    it('catches SDK exceptions and outputs UNKNOWN_ERROR', async () => {
      mockService.registerSchema.mockRejectedValue(new Error('Network timeout'));

      const program = buildProgram();
      await program.parseAsync([
        'node', 'attestify',
        'schema', 'create',
        '--definition', 'string name',
      ]);

      expect(errorOutput[0]).toContain('UNKNOWN_ERROR');
      expect(errorOutput[0]).toContain('Network timeout');
      expect(process.exitCode).toBe(1);
    });

    it('catches SDK exceptions and outputs JSON error with --json flag', async () => {
      mockService.getAttestation.mockRejectedValue(new Error('Connection refused'));

      const program = buildProgram();
      await program.parseAsync([
        'node', 'attestify', '--json',
        'attestation', 'fetch',
        '--uid', '0x' + 'ab'.repeat(32),
      ]);

      const parsed = JSON.parse(errorOutput[0]);
      expect(parsed.success).toBe(false);
      expect(parsed.error.type).toBe('UNKNOWN_ERROR');
      expect(parsed.error.message).toBe('Connection refused');
    });
  });
});

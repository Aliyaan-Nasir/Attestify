/**
 * Unit Tests for HCSLogger Retry Behavior
 *
 * Tests the retry logic in HCSLogger.submitMessage():
 * - 3 attempts with exponential backoff (1s, 2s, 4s)
 * - Success on first attempt
 * - Transient failure then success
 * - All 3 failures → console.warn, never throws
 * - Message JSON validity
 *
 * Uses vi.mock() to mock @hashgraph/sdk and vi.useFakeTimers() to control backoff.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock setup ──────────────────────────────────────────────────────────────

const mockExecute = vi.fn();

vi.mock('@hashgraph/sdk', () => {
  return {
    Client: {
      forTestnet: vi.fn().mockReturnValue({}),
    },
    TopicId: {
      fromString: vi.fn().mockReturnValue({ toString: () => '0.0.12345' }),
    },
    TopicMessageSubmitTransaction: vi.fn().mockImplementation(() => {
      return {
        setTopicId: vi.fn().mockReturnThis(),
        setMessage: vi.fn().mockReturnThis(),
        execute: mockExecute,
      };
    }),
  };
});

import { HCSLogger } from '../src/hcs';
import type { AttestationRecord } from '../src/types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MOCK_CLIENT = {} as any;
const TOPIC_ID = '0.0.12345';

function makeAttestationRecord(overrides?: Partial<AttestationRecord>): AttestationRecord {
  return {
    uid: '0x' + 'aa'.repeat(32),
    schemaUid: '0x' + 'bb'.repeat(32),
    attester: '0x' + 'cc'.repeat(20),
    subject: '0x' + 'dd'.repeat(20),
    data: '0x1234',
    timestamp: 1700000000,
    expirationTime: 0,
    revoked: false,
    revocationTime: 0,
    nonce: 1,
    ...overrides,
  };
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('HCSLogger retry behavior', () => {
  let logger: HCSLogger;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockExecute.mockReset();
    logger = new HCSLogger(TOPIC_ID, MOCK_CLIENT);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    warnSpy.mockRestore();
  });

  // ── logAttestation ───────────────────────────────────────────────────────

  describe('logAttestation', () => {
    it('submits message on first attempt when execute succeeds', async () => {
      mockExecute.mockResolvedValueOnce({ transactionId: 'tx-1' });

      const promise = logger.logAttestation(makeAttestationRecord());
      await vi.runAllTimersAsync();
      await promise;

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('retries on failure and succeeds on second attempt', async () => {
      mockExecute
        .mockRejectedValueOnce(new Error('UNAVAILABLE'))
        .mockResolvedValueOnce({ transactionId: 'tx-2' });

      const promise = logger.logAttestation(makeAttestationRecord());
      await vi.runAllTimersAsync();
      await promise;

      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('retries 3 times then logs warning and never throws', async () => {
      mockExecute
        .mockRejectedValueOnce(new Error('UNAVAILABLE'))
        .mockRejectedValueOnce(new Error('UNAVAILABLE'))
        .mockRejectedValueOnce(new Error('UNAVAILABLE'));

      const promise = logger.logAttestation(makeAttestationRecord());
      await vi.runAllTimersAsync();

      // Should resolve (never throw)
      await expect(promise).resolves.toBeUndefined();
      expect(mockExecute).toHaveBeenCalledTimes(3);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ── logRevocation ────────────────────────────────────────────────────────

  describe('logRevocation', () => {
    it('submits message on first attempt when execute succeeds', async () => {
      mockExecute.mockResolvedValueOnce({ transactionId: 'tx-3' });

      const promise = logger.logRevocation('0x' + 'aa'.repeat(32), 1700000000);
      await vi.runAllTimersAsync();
      await promise;

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('retries on failure and succeeds on second attempt', async () => {
      mockExecute
        .mockRejectedValueOnce(new Error('UNAVAILABLE'))
        .mockResolvedValueOnce({ transactionId: 'tx-4' });

      const promise = logger.logRevocation('0x' + 'aa'.repeat(32), 1700000000);
      await vi.runAllTimersAsync();
      await promise;

      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('retries 3 times then logs warning and never throws', async () => {
      mockExecute
        .mockRejectedValueOnce(new Error('UNAVAILABLE'))
        .mockRejectedValueOnce(new Error('UNAVAILABLE'))
        .mockRejectedValueOnce(new Error('UNAVAILABLE'));

      const promise = logger.logRevocation('0x' + 'aa'.repeat(32), 1700000000);
      await vi.runAllTimersAsync();

      await expect(promise).resolves.toBeUndefined();
      expect(mockExecute).toHaveBeenCalledTimes(3);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ── console.warn message ─────────────────────────────────────────────────

  describe('console.warn content', () => {
    it('includes failure count and error message after 3 failures', async () => {
      mockExecute
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockRejectedValueOnce(new Error('network timeout'));

      const promise = logger.logAttestation(makeAttestationRecord());
      await vi.runAllTimersAsync();
      await promise;

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const warnMsg = warnSpy.mock.calls[0][0] as string;
      expect(warnMsg).toContain('3');
      expect(warnMsg).toContain('network timeout');
    });
  });

  // ── Message JSON validity ────────────────────────────────────────────────

  describe('message JSON validity', () => {
    it('passes valid JSON to setMessage for logAttestation', async () => {
      const { TopicMessageSubmitTransaction } = await import('@hashgraph/sdk');
      let capturedMessage = '';

      // Capture the message string passed to setMessage
      (TopicMessageSubmitTransaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          setTopicId: vi.fn().mockReturnThis(),
          setMessage: vi.fn().mockImplementation(function (this: any, msg: string) {
            capturedMessage = msg;
            return this;
          }),
          execute: vi.fn().mockResolvedValue({ transactionId: 'tx-json' }),
        }),
      );

      const record = makeAttestationRecord();
      const freshLogger = new HCSLogger(TOPIC_ID, MOCK_CLIENT);
      const promise = freshLogger.logAttestation(record);
      await vi.runAllTimersAsync();
      await promise;

      // Verify it's valid JSON
      const parsed = JSON.parse(capturedMessage);
      expect(parsed.version).toBe('1.0');
      expect(parsed.type).toBe('attestation.created');
      expect(parsed.payload.attestationUid).toBe(record.uid);
      expect(parsed.payload.schemaUid).toBe(record.schemaUid);
      expect(parsed.payload.attester).toBe(record.attester);
      expect(parsed.payload.subject).toBe(record.subject);
      expect(typeof parsed.payload.timestamp).toBe('number');
    });

    it('passes valid JSON to setMessage for logRevocation', async () => {
      const { TopicMessageSubmitTransaction } = await import('@hashgraph/sdk');
      let capturedMessage = '';

      (TopicMessageSubmitTransaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({
          setTopicId: vi.fn().mockReturnThis(),
          setMessage: vi.fn().mockImplementation(function (this: any, msg: string) {
            capturedMessage = msg;
            return this;
          }),
          execute: vi.fn().mockResolvedValue({ transactionId: 'tx-json-2' }),
        }),
      );

      const uid = '0x' + 'ff'.repeat(32);
      const ts = 1700000000;
      const freshLogger = new HCSLogger(TOPIC_ID, MOCK_CLIENT);
      const promise = freshLogger.logRevocation(uid, ts);
      await vi.runAllTimersAsync();
      await promise;

      const parsed = JSON.parse(capturedMessage);
      expect(parsed.version).toBe('1.0');
      expect(parsed.type).toBe('attestation.revoked');
      expect(parsed.payload.attestationUid).toBe(uid);
      expect(parsed.payload.revocationTimestamp).toBe(ts);
    });
  });
});

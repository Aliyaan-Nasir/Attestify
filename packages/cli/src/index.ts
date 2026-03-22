/**
 * Attestify CLI
 * Command-line tool for the Hedera attestation protocol
 */
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { loadConfig } from './config';
import { formatOutput, formatError } from './output';

async function createService(): Promise<import('@attestify/sdk').HederaAttestService> {
  const config = loadConfig();
  const { HederaAttestService } = await import('@attestify/sdk');
  return new HederaAttestService(config);
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

const program = new Command();
program
  .name('attestify')
  .description('Attestify CLI — interact with the Hedera attestation protocol')
  .version('0.1.0')
  .option('--json', 'Output results as JSON');

// ─── Schema Commands ──────────────────────────────────────────────────────────

const schema = program.command('schema').description('Manage attestation schemas');

schema.command('create')
  .description('Register a new schema')
  .option('--definition <definition>', 'Schema definition string')
  .option('--revocable', 'Whether attestations can be revoked', false)
  .option('--resolver <resolver>', 'Resolver contract address')
  .option('--file <file>', 'Path to JSON file with schema parameters')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      let definition: string;
      let revocable: boolean;
      let resolver: string | undefined;
      if (opts.file) {
        const d = readJsonFile(opts.file) as Record<string, unknown>;
        definition = d.definition as string;
        revocable = (d.revocable as boolean) ?? false;
        resolver = d.resolver as string | undefined;
      } else {
        if (!opts.definition) throw new Error('Either --definition or --file is required');
        definition = opts.definition;
        revocable = opts.revocable;
        resolver = opts.resolver;
      }
      const service = await createService();
      const result = await service.registerSchema({ definition, revocable, resolver });
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
      const service = await createService();
      const result = await service.getSchema(opts.uid);
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

schema.command('list')
  .description('List schemas (optionally filter by authority address)')
  .option('--authority <address>', 'Filter by authority address')
  .option('--limit <limit>', 'Max results', '25')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.listSchemas({
        authority: opts.authority,
        limit: parseInt(opts.limit, 10) || 25,
      });
      if (result.success) {
        const schemas = result.data!;
        if (jsonFlag) {
          console.log(JSON.stringify({ success: true, count: schemas.length, data: schemas }, null, 2));
        } else {
          console.log(`Found ${schemas.length} schema(s)\n`);
          for (const s of schemas) {
            console.log(`  UID:        ${s.uid}`);
            console.log(`  Definition: ${s.definition}`);
            console.log(`  Authority:  ${s.authorityAddress}`);
            console.log(`  Revocable:  ${s.revocable}`);
            console.log(`  HCS Topic:  ${s.hcsTopicId || 'N/A'}`);
            console.log(`  Created:    ${s.createdAt}`);
            console.log('');
          }
        }
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

// ─── Attestation Commands ─────────────────────────────────────────────────────

const attestation = program.command('attestation').description('Manage attestations');

attestation.command('create')
  .description('Create a new attestation')
  .requiredOption('--schema-uid <uid>', 'Schema UID to attest against')
  .requiredOption('--subject <address>', 'Subject address')
  .requiredOption('--data <data>', 'ABI-encoded attestation data (hex)')
  .option('--expiration <timestamp>', 'Expiration timestamp (0 = no expiration)')
  .option('--file <file>', 'Path to JSON file with attestation parameters')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      let schemaUid: string;
      let subject: string;
      let data: string;
      let expirationTime: number | undefined;
      if (opts.file) {
        const d = readJsonFile(opts.file) as Record<string, unknown>;
        schemaUid = d.schemaUid as string;
        subject = d.subject as string;
        data = d.data as string;
        expirationTime = d.expirationTime as number | undefined;
      } else {
        schemaUid = opts.schemaUid;
        subject = opts.subject;
        data = opts.data;
        expirationTime = opts.expiration ? parseInt(opts.expiration, 10) : undefined;
      }
      const service = await createService();
      const result = await service.createAttestation({ schemaUid, subject, data, expirationTime });
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
      const service = await createService();
      const result = await service.getAttestation(opts.uid);
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

attestation.command('list')
  .description('List attestations (filter by attester, subject, or schema)')
  .option('--attester <address>', 'Filter by attester address')
  .option('--subject <address>', 'Filter by subject address')
  .option('--schema-uid <uid>', 'Filter by schema UID')
  .option('--limit <limit>', 'Max results', '25')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.listAttestations({
        attester: opts.attester,
        subject: opts.subject,
        schemaUid: opts.schemaUid,
        limit: parseInt(opts.limit, 10) || 25,
      });
      if (result.success) {
        const attestations = result.data!;
        if (jsonFlag) {
          console.log(JSON.stringify({ success: true, count: attestations.length, data: attestations }, null, 2));
        } else {
          console.log(`Found ${attestations.length} attestation(s)\n`);
          for (const a of attestations) {
            const status = a.revoked ? 'Revoked' : (a.expirationTime && new Date(a.expirationTime) < new Date() ? 'Expired' : 'Active');
            console.log(`  UID:      ${a.uid}`);
            console.log(`  Schema:   ${a.schemaUid}`);
            console.log(`  Attester: ${a.attesterAddress}`);
            console.log(`  Subject:  ${a.subjectAddress}`);
            console.log(`  Status:   ${status}`);
            console.log(`  Created:  ${a.createdAt}`);
            console.log('');
          }
        }
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
      const service = await createService();
      const result = await service.revokeAttestation(opts.uid);
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

// ─── Authority Commands ───────────────────────────────────────────────────────

const authority = program.command('authority').description('Manage authorities');

authority.command('register')
  .description('Register as an authority')
  .requiredOption('--metadata <metadata>', 'Authority metadata string')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.registerAuthority(opts.metadata);
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
      const service = await createService();
      const result = await service.getAuthority(opts.address);
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

authority.command('verify')
  .description('Verify or unverify an authority (admin only — contract owner)')
  .requiredOption('--address <address>', 'Authority address to verify/unverify')
  .option('--revoke', 'Unverify the authority instead of verifying', false)
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const verified = !opts.revoke;
      const result = await service.setAuthorityVerification(opts.address, verified);
      if (result.success) {
        console.log(formatOutput({ address: opts.address, verified }, jsonFlag));
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

// ─── Profile Command ─────────────────────────────────────────────────────────

program.command('profile')
  .description('View full profile for an address (authority, schemas, attestations)')
  .requiredOption('--address <address>', 'Wallet address to look up')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.getProfile(opts.address);
      if (result.success) {
        const p = result.data!;
        if (jsonFlag) {
          console.log(JSON.stringify({ success: true, data: p }, null, 2));
        } else {
          console.log(`Profile: ${p.address}\n`);

          // Authority
          if (p.authority) {
            console.log('── Authority ──');
            console.log(`  Status:   ${p.authority.isVerified ? 'Verified ✓' : 'Unverified'}`);
            console.log(`  Metadata: ${p.authority.metadata || '—'}`);
            console.log(`  Since:    ${p.authority.createdAt}`);
            console.log('');
          } else {
            console.log('── Authority ──');
            console.log('  Not registered as an authority\n');
          }

          // Schemas
          console.log(`── Schemas (${p.schemas.length}) ──`);
          if (p.schemas.length === 0) {
            console.log('  No schemas created\n');
          } else {
            for (const s of p.schemas) {
              console.log(`  ${s.uid}`);
              console.log(`    ${s.definition}`);
              console.log(`    Revocable: ${s.revocable} | HCS: ${s.hcsTopicId || 'N/A'} | ${s.createdAt}`);
            }
            console.log('');
          }

          // Attestations issued
          console.log(`── Attestations Issued (${p.attestationsIssued.length}) ──`);
          if (p.attestationsIssued.length === 0) {
            console.log('  No attestations issued\n');
          } else {
            for (const a of p.attestationsIssued) {
              console.log(`  ${a.uid}`);
              console.log(`    Subject: ${a.subjectAddress} | ${a.revoked ? 'Revoked' : 'Active'} | ${a.createdAt}`);
            }
            console.log('');
          }

          // Attestations received
          console.log(`── Attestations Received (${p.attestationsReceived.length}) ──`);
          if (p.attestationsReceived.length === 0) {
            console.log('  No attestations about this address\n');
          } else {
            for (const a of p.attestationsReceived) {
              console.log(`  ${a.uid}`);
              console.log(`    Attester: ${a.attesterAddress} | ${a.revoked ? 'Revoked' : 'Active'} | ${a.createdAt}`);
            }
            console.log('');
          }
        }
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

// ─── HCS Audit Log Commands ─────────────────────────────────────────────────

const hcs = program.command('hcs').description('HCS audit log operations');

hcs.command('topics')
  .description('List configured HCS topic IDs')
  .action(async () => {
    const jsonFlag = program.opts().json;
    try {
      const config = loadConfig();
      const topics: Record<string, string> = {};
      if (config.hcsTopicIds?.schemas) topics.schemas = config.hcsTopicIds.schemas;
      if (config.hcsTopicIds?.attestations) topics.attestations = config.hcsTopicIds.attestations;
      if (config.hcsTopicIds?.authorities) topics.authorities = config.hcsTopicIds.authorities;
      if (config.hcsTopicId && Object.keys(topics).length === 0) topics.default = config.hcsTopicId;

      if (Object.keys(topics).length === 0) {
        console.log(formatError('CONFIGURATION_ERROR', 'No HCS topics configured. Set HCS_TOPIC_SCHEMAS, HCS_TOPIC_ATTESTATIONS, HCS_TOPIC_AUTHORITIES env vars.', jsonFlag));
        return;
      }

      const data: Record<string, unknown> = {};
      for (const [name, id] of Object.entries(topics)) {
        data[name] = { topicId: id, hashscanUrl: `https://hashscan.io/testnet/topic/${id}` };
      }
      console.log(formatOutput(data, jsonFlag));
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

hcs.command('messages')
  .description('Fetch HCS audit messages from a topic')
  .requiredOption('--topic <topicId>', 'HCS topic ID (e.g. 0.0.12345)')
  .option('--limit <limit>', 'Number of messages to fetch', '25')
  .option('--order <order>', 'Sort order: asc or desc', 'desc')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const limit = Math.min(parseInt(opts.limit, 10) || 25, 100);
      const order = opts.order === 'asc' ? 'asc' : 'desc';
      const mirrorUrl = 'https://testnet.mirrornode.hedera.com';
      const url = `${mirrorUrl}/api/v1/topics/${opts.topic}/messages?limit=${limit}&order=${order}`;

      const response = await fetch(url);
      if (!response.ok) {
        console.error(formatError('NETWORK_ERROR', `Mirror node returned ${response.status}`, jsonFlag));
        process.exitCode = 1;
        return;
      }

      const raw = await response.json() as { messages?: Array<{ consensus_timestamp: string; sequence_number: number; message: string; payer_account_id: string }> };
      const messages = (raw.messages || []).map((msg) => {
        let decoded: unknown = null;
        try {
          const buf = Buffer.from(msg.message, 'base64');
          decoded = JSON.parse(buf.toString('utf-8'));
        } catch {
          decoded = msg.message;
        }
        return {
          sequenceNumber: msg.sequence_number,
          consensusTimestamp: msg.consensus_timestamp,
          payer: msg.payer_account_id,
          content: decoded,
        };
      });

      const data: Record<string, unknown> = {
        topicId: opts.topic,
        hashscanUrl: `https://hashscan.io/testnet/topic/${opts.topic}`,
        messageCount: messages.length,
        messages,
      };

      console.log(formatOutput(data, jsonFlag));
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

// ─── Whitelist Resolver Commands ─────────────────────────────────────────────

const whitelist = program.command('whitelist').description('WhitelistResolver operations');

whitelist.command('add')
  .description('Add an address to the whitelist (admin only)')
  .requiredOption('--account <address>', 'Address to whitelist')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.whitelistAdd(opts.account);
      if (result.success) {
        console.log(formatOutput({ added: true, account: opts.account }, jsonFlag));
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

whitelist.command('remove')
  .description('Remove an address from the whitelist (admin only)')
  .requiredOption('--account <address>', 'Address to remove')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.whitelistRemove(opts.account);
      if (result.success) {
        console.log(formatOutput({ removed: true, account: opts.account }, jsonFlag));
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

whitelist.command('check')
  .description('Check if an address is whitelisted')
  .requiredOption('--account <address>', 'Address to check')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.whitelistCheck(opts.account);
      if (result.success) {
        console.log(formatOutput({ account: opts.account, whitelisted: result.data!.whitelisted }, jsonFlag));
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

whitelist.command('owner')
  .description('Get the whitelist resolver owner address')
  .action(async () => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.whitelistOwner();
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

// ─── Fee Resolver Commands ──────────────────────────────────────────────────

const fee = program.command('fee').description('FeeResolver operations');

fee.command('deposit')
  .description('Deposit HBAR into the fee resolver')
  .requiredOption('--amount <hbar>', 'Amount of HBAR to deposit')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.feeDeposit(opts.amount);
      if (result.success) {
        console.log(formatOutput({ deposited: true, amount: opts.amount }, jsonFlag));
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

fee.command('set-fee')
  .description('Set the attestation fee amount (admin only)')
  .requiredOption('--amount <wei>', 'Fee amount in wei (tinybar)')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.feeSetFee(opts.amount);
      if (result.success) {
        console.log(formatOutput({ feeSet: true, amount: opts.amount }, jsonFlag));
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

fee.command('withdraw')
  .description('Withdraw collected fees (admin only)')
  .action(async () => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.feeWithdraw();
      if (result.success) {
        console.log(formatOutput({ withdrawn: true }, jsonFlag));
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

fee.command('get-fee')
  .description('Get the current attestation fee')
  .action(async () => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.feeGetFee();
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

fee.command('balance')
  .description('Check deposited balance for an address')
  .requiredOption('--account <address>', 'Address to check')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.feeGetBalance(opts.account);
      if (result.success) {
        console.log(formatOutput({ account: opts.account, ...result.data! }, jsonFlag));
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

fee.command('owner')
  .description('Get the fee resolver owner address')
  .action(async () => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.feeOwner();
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

// ─── Token Gated Resolver Commands ──────────────────────────────────────────

const tokenGated = program.command('token-gated').description('TokenGatedResolver operations');

tokenGated.command('set-config')
  .description('Set token address and minimum balance (admin only)')
  .requiredOption('--token <address>', 'HTS token address')
  .requiredOption('--min-balance <amount>', 'Minimum token balance required')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.tokenGatedSetConfig(opts.token, opts.minBalance);
      if (result.success) {
        console.log(formatOutput({ configured: true, token: opts.token, minBalance: opts.minBalance }, jsonFlag));
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

tokenGated.command('get-config')
  .description('Get current token gate configuration')
  .action(async () => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.tokenGatedGetConfig();
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

tokenGated.command('owner')
  .description('Get the token gated resolver owner address')
  .action(async () => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.tokenGatedOwner();
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

// ─── NFT Minting Command ───────────────────────────────────────────────────

program.command('nft-mint')
  .description('Mint an HTS NFT credential for an attestation')
  .requiredOption('--subject <address>', 'Subject address to receive the NFT')
  .requiredOption('--attestation-uid <uid>', 'Attestation UID to embed in metadata')
  .requiredOption('--token-id <tokenId>', 'HTS token ID for the NFT collection')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.mintNFT({
        subject: opts.subject,
        attestationUid: opts.attestationUid,
        tokenId: opts.tokenId,
      });
      if (result.success) {
        console.log(formatOutput({ minted: true, serialNumber: result.data!.serialNumber }, jsonFlag));
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

// ─── Delegation Commands ────────────────────────────────────────────────────

const delegate = program.command('delegate').description('Delegation operations');

delegate.command('add')
  .description('Add a delegate who can attest/revoke on your behalf')
  .requiredOption('--address <address>', 'Delegate address to authorize')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.addDelegate(opts.address);
      if (result.success) {
        console.log(formatOutput({ added: true, delegate: opts.address }, jsonFlag));
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

delegate.command('remove')
  .description('Remove a delegate')
  .requiredOption('--address <address>', 'Delegate address to remove')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.removeDelegate(opts.address);
      if (result.success) {
        console.log(formatOutput({ removed: true, delegate: opts.address }, jsonFlag));
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

delegate.command('check')
  .description('Check if an address is a delegate of an authority')
  .requiredOption('--authority <address>', 'Authority address')
  .requiredOption('--delegate <address>', 'Delegate address to check')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.isDelegate(opts.authority, opts.delegate);
      if (result.success) {
        console.log(formatOutput({ authority: opts.authority, delegate: opts.delegate, isDelegate: result.data!.isDelegate }, jsonFlag));
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

delegate.command('list')
  .description('List all delegates for an authority')
  .requiredOption('--authority <address>', 'Authority address')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.getDelegates(opts.authority);
      if (result.success) {
        if (jsonFlag) {
          console.log(JSON.stringify({ success: true, data: result.data!.delegates }, null, 2));
        } else {
          const delegates = result.data!.delegates;
          console.log(`Delegates for ${opts.authority}: ${delegates.length}\n`);
          for (const d of delegates) {
            console.log(`  ${d}`);
          }
        }
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

delegate.command('attest')
  .description('Create an attestation on behalf of an authority (delegated)')
  .requiredOption('--authority <address>', 'Authority address you are delegating for')
  .requiredOption('--schema-uid <uid>', 'Schema UID')
  .requiredOption('--subject <address>', 'Subject address')
  .requiredOption('--data <data>', 'ABI-encoded attestation data (hex)')
  .option('--expiration <timestamp>', 'Expiration timestamp')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.attestOnBehalf({
        authority: opts.authority,
        schemaUid: opts.schemaUid,
        subject: opts.subject,
        data: opts.data,
        expirationTime: opts.expiration ? parseInt(opts.expiration, 10) : undefined,
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

delegate.command('revoke')
  .description('Revoke an attestation on behalf of the original attester (delegated)')
  .requiredOption('--uid <uid>', 'Attestation UID to revoke')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.revokeOnBehalf(opts.uid);
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

// ─── Token Reward Resolver Commands ─────────────────────────────────────────

const tokenReward = program.command('token-reward').description('TokenRewardResolver operations');

tokenReward.command('set-config')
  .description('Set reward token and amount (admin only)')
  .requiredOption('--resolver <address>', 'TokenRewardResolver contract address')
  .requiredOption('--token <address>', 'HTS reward token address')
  .requiredOption('--amount <amount>', 'Reward amount per attestation')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.tokenRewardSetConfig(opts.resolver, opts.token, opts.amount);
      if (result.success) {
        console.log(formatOutput({ configured: true, token: opts.token, amount: opts.amount }, jsonFlag));
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

tokenReward.command('get-config')
  .description('Get current reward configuration')
  .requiredOption('--resolver <address>', 'TokenRewardResolver contract address')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.tokenRewardGetConfig(opts.resolver);
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

tokenReward.command('distributed')
  .description('Check total rewards distributed to a subject')
  .requiredOption('--resolver <address>', 'TokenRewardResolver contract address')
  .requiredOption('--subject <address>', 'Subject address to check')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.tokenRewardGetDistributed(opts.resolver, opts.subject);
      if (result.success) {
        console.log(formatOutput({ subject: opts.subject, ...result.data! }, jsonFlag));
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

tokenReward.command('owner')
  .description('Get the token reward resolver owner')
  .requiredOption('--resolver <address>', 'TokenRewardResolver contract address')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.tokenRewardOwner(opts.resolver);
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

// ─── Cross-Contract Resolver Commands ───────────────────────────────────────

const crossContract = program.command('cross-contract').description('CrossContractResolver operations');

crossContract.command('set-pipeline')
  .description('Set the resolver pipeline (admin only)')
  .requiredOption('--resolver <address>', 'CrossContractResolver contract address')
  .requiredOption('--resolvers <addresses>', 'Comma-separated list of resolver addresses')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const resolvers = opts.resolvers.split(',').map((a: string) => a.trim());
      const service = await createService();
      const result = await service.crossContractSetPipeline(opts.resolver, resolvers);
      if (result.success) {
        console.log(formatOutput({ configured: true, pipeline: resolvers }, jsonFlag));
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

crossContract.command('get-pipeline')
  .description('Get the current resolver pipeline')
  .requiredOption('--resolver <address>', 'CrossContractResolver contract address')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.crossContractGetPipeline(opts.resolver);
      if (result.success) {
        if (jsonFlag) {
          console.log(JSON.stringify({ success: true, data: result.data!.pipeline }, null, 2));
        } else {
          const pipeline = result.data!.pipeline;
          console.log(`Pipeline (${pipeline.length} resolvers):\n`);
          pipeline.forEach((addr: string, i: number) => {
            console.log(`  ${i + 1}. ${addr}`);
          });
        }
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

crossContract.command('owner')
  .description('Get the cross-contract resolver owner')
  .requiredOption('--resolver <address>', 'CrossContractResolver contract address')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.crossContractOwner(opts.resolver);
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

// ─── Schedule Commands ────────────────────────────────────────────────────────

const schedule = program.command('schedule').description('Hedera Scheduled Transactions');

schedule.command('revoke')
  .description('Schedule an automatic revocation at a future time')
  .requiredOption('--uid <uid>', 'Attestation UID to revoke')
  .requiredOption('--execute-at <timestamp>', 'Unix timestamp (seconds) when revocation should execute')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.scheduleRevocation({
        attestationUid: opts.uid,
        executeAt: parseInt(opts.executeAt, 10),
      });
      if (result.success) {
        console.log(formatOutput({
          scheduled: true,
          scheduleId: result.data!.scheduleId,
          transactionId: result.data!.transactionId,
          executeAt: new Date(parseInt(opts.executeAt, 10) * 1000).toISOString(),
        }, jsonFlag));
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

schedule.command('status')
  .description('Check the status of a scheduled revocation')
  .requiredOption('--schedule-id <id>', 'Hedera Schedule ID (e.g. 0.0.12345)')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.getScheduledRevocation(opts.scheduleId);
      if (result.success) {
        console.log(formatOutput({
          scheduleId: result.data!.scheduleId,
          executed: result.data!.executed,
          deleted: result.data!.deleted,
          expirationTime: result.data!.expirationTime,
        }, jsonFlag));
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

// ─── Multi-Sig Authority Commands (Feature 5) ──────────────────────────────

const multisig = program.command('multisig').description('Multi-sig authority operations');

multisig.command('create')
  .description('Create a multi-sig authority account with threshold keys')
  .requiredOption('--keys <keys>', 'Comma-separated ECDSA public keys (hex or DER)')
  .requiredOption('--threshold <threshold>', 'Number of required signatures')
  .option('--initial-balance <hbar>', 'Initial HBAR balance', '10')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const publicKeys = opts.keys.split(',').map((k: string) => k.trim());
      const threshold = parseInt(opts.threshold, 10);
      const service = await createService();
      const result = await service.createMultiSigAuthority({
        publicKeys,
        threshold,
        initialBalance: opts.initialBalance,
      });
      if (result.success) {
        console.log(formatOutput({
          created: true,
          accountId: result.data!.accountId,
          threshold: result.data!.threshold,
          totalKeys: result.data!.totalKeys,
        }, jsonFlag));
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

multisig.command('info')
  .description('Get key structure info for a Hedera account')
  .requiredOption('--account <accountId>', 'Hedera account ID (e.g. 0.0.12345)')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.getAccountKeyInfo(opts.account);
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

// ─── Staking Commands (Feature 6) ──────────────────────────────────────────

const staking = program.command('staking').description('HTS token staking for authorities');

staking.command('stake')
  .description('Stake HTS tokens as an authority')
  .requiredOption('--token <address>', 'HTS token address')
  .requiredOption('--amount <amount>', 'Amount to stake')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.stakeTokens(opts.token, opts.amount);
      if (result.success) {
        console.log(formatOutput({ staked: true, token: opts.token, amount: opts.amount }, jsonFlag));
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

staking.command('unstake')
  .description('Unstake HTS tokens')
  .requiredOption('--token <address>', 'HTS token address')
  .requiredOption('--amount <amount>', 'Amount to unstake')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.unstakeTokens(opts.token, opts.amount);
      if (result.success) {
        console.log(formatOutput({ unstaked: true, token: opts.token, amount: opts.amount }, jsonFlag));
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

staking.command('balance')
  .description('Check staked token balance for an authority')
  .requiredOption('--token <address>', 'HTS token address')
  .requiredOption('--authority <address>', 'Authority address or account ID')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.getStake(opts.token, opts.authority);
      if (result.success) {
        console.log(formatOutput({ authority: opts.authority, ...result.data! }, jsonFlag));
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

// ─── File Service Commands (Feature 7) ─────────────────────────────────────

const fileService = program.command('file-schema').description('Hedera File Service schema storage');

fileService.command('upload')
  .description('Upload a schema definition to Hedera File Service')
  .requiredOption('--definition <definition>', 'Schema definition string')
  .option('--memo <memo>', 'File memo')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.uploadSchemaFile(opts.definition, opts.memo);
      if (result.success) {
        console.log(formatOutput({
          uploaded: true,
          fileId: result.data!.fileId,
          definition: result.data!.definition,
        }, jsonFlag));
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

fileService.command('read')
  .description('Read a schema definition from Hedera File Service')
  .requiredOption('--file-id <fileId>', 'Hedera File ID (e.g. 0.0.12345)')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.readSchemaFile(opts.fileId);
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

fileService.command('register')
  .description('Register a schema from a Hedera File ID (reads definition from File Service)')
  .requiredOption('--file-id <fileId>', 'Hedera File ID containing the schema definition')
  .option('--revocable', 'Whether attestations can be revoked', false)
  .option('--resolver <resolver>', 'Resolver contract address')
  .action(async (opts) => {
    const jsonFlag = program.opts().json;
    try {
      const service = await createService();
      const result = await service.registerSchemaFromFile({
        fileId: opts.fileId,
        revocable: opts.revocable,
        resolver: opts.resolver,
      });
      if (result.success) {
        console.log(formatOutput({ schemaUid: result.data!.schemaUid, fileId: opts.fileId }, jsonFlag));
      } else {
        console.error(formatError(result.error!.type, result.error!.message, jsonFlag));
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

// ─── AI Chat Command ────────────────────────────────────────────────────────

const ai = program.command('ai')
  .description('Chat with the Attestify AI Agent — natural language interface to the protocol')
  .argument('[message]', 'Message to send (omit for interactive mode)')
  .option('--model <model>', 'OpenAI model name', 'gpt-4o-mini')
  .action(async (message: string | undefined, opts: { model: string }) => {
    const jsonFlag = program.opts().json;
    try {
      const openAIApiKey = process.env.OPENAI_API_KEY;
      if (!openAIApiKey) {
        console.error(formatError('CONFIGURATION_ERROR', 'Missing OPENAI_API_KEY environment variable.', jsonFlag));
        process.exitCode = 1;
        return;
      }

      const config = loadConfig();
      const { createAttestifyAgent } = await import('@attestify/sdk/ai');
      const { processMessage } = await createAttestifyAgent({
        accountId: config.operatorAccountId,
        privateKey: config.operatorPrivateKey,
        indexerUrl: config.indexerUrl,
        openAIApiKey,
        modelName: opts.model,
      });

      console.log('[Attestify AI] Agent initialized with 17 tools\n');

      if (message) {
        // One-shot mode
        const response = await processMessage(message);
        if (jsonFlag) {
          console.log(JSON.stringify({ success: true, response }, null, 2));
        } else {
          console.log(response);
        }
      } else {
        // Interactive REPL mode
        const readline = await import('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

        console.log('Interactive mode — type your message and press Enter. Type "exit" to quit.\n');

        const ask = () => {
          rl.question('You: ', async (input: string) => {
            const trimmed = input.trim();
            if (!trimmed || trimmed.toLowerCase() === 'exit') {
              console.log('\nGoodbye!');
              rl.close();
              return;
            }
            try {
              const response = await processMessage(trimmed);
              console.log(`\nAgent: ${response}\n`);
            } catch (err: any) {
              console.error(`\nError: ${err.message}\n`);
            }
            ask();
          });
        };
        ask();
        // Keep process alive for REPL — prevent auto-exit
        (program as any).__replActive = true;
        return;
      }
    } catch (err: any) {
      console.error(formatError('UNKNOWN_ERROR', err.message, jsonFlag));
      process.exitCode = 1;
    }
  });

program.parseAsync().then(() => {
  // In REPL mode, don't auto-exit — the readline keeps the process alive.
  if ((program as any).__replActive) return;
  // For all other commands, exit cleanly after output flushes.
  // Without this, the Hedera SDK gRPC client keeps the process alive.
  setTimeout(() => process.exit(process.exitCode ?? 0), 100);
});
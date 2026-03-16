/**
 * Create HCS Topics for Attestify Protocol
 *
 * Creates 3 global audit topics on Hedera Consensus Service:
 *   1. attestify.schemas — schema registration events
 *   2. attestify.attestations — attestation creation & revocation events
 *   3. attestify.authorities — authority registration & verification events
 *
 * Outputs topic IDs to hcs-topics.json for use by the indexer.
 *
 * Usage: HEDERA_ACCOUNT_ID=0.0.xxx HEDERA_PRIVATE_KEY=xxx npx tsx scripts/create-hcs-topics.ts
 */

import {
  Client,
  AccountId,
  PrivateKey,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TopicId,
} from '@hashgraph/sdk';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import 'dotenv/config';

const OUTPUT_PATH = resolve(__dirname, '../hcs-topics.json');

interface TopicConfig {
  topicId: string;
  name: string;
  createdAt: string;
}

interface HCSTopics {
  network: string;
  schemas: TopicConfig;
  attestations: TopicConfig;
  authorities: TopicConfig;
}

async function createTopic(
  client: Client,
  memo: string,
): Promise<string> {
  const tx = new TopicCreateTransaction()
    .setTopicMemo(memo)
    .setSubmitKey(client.operatorPublicKey!);

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  return receipt.topicId!.toString();
}

async function submitInitMessage(
  client: Client,
  topicId: string,
  topicName: string,
): Promise<void> {
  const message = {
    version: '1.0',
    type: 'topic.initialized',
    payload: {
      protocol: 'attestify',
      topicName,
      description: `Attestify protocol audit log for ${topicName} events`,
      createdAt: new Date().toISOString(),
    },
  };

  await new TopicMessageSubmitTransaction()
    .setTopicId(TopicId.fromString(topicId))
    .setMessage(JSON.stringify(message, null, 2))
    .execute(client);

  console.log(`  ✓ Init message submitted to ${topicId}`);
}

async function main() {
  const accountId = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;

  if (!accountId || !privateKey) {
    console.error('Missing HEDERA_ACCOUNT_ID or HEDERA_PRIVATE_KEY env vars');
    process.exit(1);
  }

  // Check if topics already exist
  if (existsSync(OUTPUT_PATH)) {
    const existing = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8')) as HCSTopics;
    console.log('HCS topics already created:');
    console.log(`  schemas:      ${existing.schemas.topicId}`);
    console.log(`  attestations: ${existing.attestations.topicId}`);
    console.log(`  authorities:  ${existing.authorities.topicId}`);
    console.log('\nDelete hcs-topics.json to recreate.');
    return;
  }

  const client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(accountId),
    PrivateKey.fromStringECDSA(privateKey),
  );

  console.log('Creating HCS topics on Hedera Testnet...\n');

  // Create 3 global topics
  console.log('1/3 Creating attestify.schemas topic...');
  const schemasTopicId = await createTopic(client, 'attestify.schemas — Schema registration audit log');
  console.log(`  ✓ Topic ID: ${schemasTopicId}`);
  await submitInitMessage(client, schemasTopicId, 'schemas');

  console.log('2/3 Creating attestify.attestations topic...');
  const attestationsTopicId = await createTopic(client, 'attestify.attestations — Attestation lifecycle audit log');
  console.log(`  ✓ Topic ID: ${attestationsTopicId}`);
  await submitInitMessage(client, attestationsTopicId, 'attestations');

  console.log('3/3 Creating attestify.authorities topic...');
  const authoritiesTopicId = await createTopic(client, 'attestify.authorities — Authority registration audit log');
  console.log(`  ✓ Topic ID: ${authoritiesTopicId}`);
  await submitInitMessage(client, authoritiesTopicId, 'authorities');

  const now = new Date().toISOString();
  const topics: HCSTopics = {
    network: 'testnet',
    schemas: { topicId: schemasTopicId, name: 'attestify.schemas', createdAt: now },
    attestations: { topicId: attestationsTopicId, name: 'attestify.attestations', createdAt: now },
    authorities: { topicId: authoritiesTopicId, name: 'attestify.authorities', createdAt: now },
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(topics, null, 2));
  console.log(`\n✓ All topics created. Saved to hcs-topics.json`);
  console.log(`\nAdd these to your .env:`);
  console.log(`HCS_TOPIC_SCHEMAS=${schemasTopicId}`);
  console.log(`HCS_TOPIC_ATTESTATIONS=${attestationsTopicId}`);
  console.log(`HCS_TOPIC_AUTHORITIES=${authoritiesTopicId}`);

  client.close();
}

main().catch((err) => {
  console.error('Failed to create topics:', err);
  process.exit(1);
});

/**
 * Register the Attestify Agent in the HOL Registry.
 *
 * This script:
 * 1. Creates HCS-10 inbound/outbound topics for the agent via AgentBuilder
 * 2. Sets up an HCS-11 profile
 * 3. Registers the agent in the Hashgraph Online guarded registry
 *
 * Run: pnpm register
 */

import 'dotenv/config';
import {
  HCS10Client,
  AgentBuilder,
  AIAgentCapability,
  RegistryBrokerClient,
  type AgentRegistrationRequest,
  type HCS11Profile,
  ProfileType,
  AIAgentType,
} from '@hashgraphonline/standards-sdk';

async function main() {
  const accountId = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;
  const apiKey = process.env.REGISTRY_BROKER_API_KEY;

  if (!accountId || !privateKey) {
    console.error('Missing HEDERA_ACCOUNT_ID or HEDERA_PRIVATE_KEY');
    process.exit(1);
  }

  console.log('Registering Attestify Agent in HOL Registry...');
  console.log('Operator:', accountId);

  // ─── Step 1: Create HCS-10 agent via AgentBuilder ─────────────────────────
  console.log('\n[1/3] Creating HCS-10 agent...');

  const hcs10 = new HCS10Client({
    network: 'testnet',
    operatorId: accountId,
    operatorPrivateKey: privateKey,
    logLevel: 'info',
  });

  const builder = new AgentBuilder()
    .setName('Attestify Agent')
    .setNetwork('testnet')
    .setExistingAccount(accountId, privateKey)
    .setBio(
      'AI agent for the Attestify attestation protocol on Hedera. ' +
      'Supports natural language interaction with schemas, attestations, ' +
      'authorities, resolvers, and Hedera-native features like HCS proofs, ' +
      'HTS NFT credentials, and scheduled revocations.',
    )
    .setCapabilities([
      AIAgentCapability.KNOWLEDGE_RETRIEVAL,
      AIAgentCapability.TEXT_GENERATION,
    ])
    .setType('autonomous')
    .setModel('gpt-4o-mini');

  const registration = await hcs10.createAndRegisterAgent(builder, {
    progressCallback: (data) => {
      console.log(`  [${data.stage}] ${data.message}`);
    },
  });

  if (!registration.success) {
    console.error('Agent creation failed:', registration.error);
    process.exit(1);
  }

  const inboundTopicId = registration.state?.inboundTopicId;
  const outboundTopicId = registration.state?.outboundTopicId;

  console.log('Inbound topic:', inboundTopicId);
  console.log('Outbound topic:', outboundTopicId);

  // ─── Step 2: Register in HOL Registry via Broker ───────────────────────────
  if (apiKey && inboundTopicId) {
    console.log('\n[2/3] Registering in HOL Registry via Broker...');

    const broker = new RegistryBrokerClient({ apiKey });

    const profile: HCS11Profile = {
      version: '1.0.0',
      type: ProfileType.AI_AGENT,
      display_name: 'Attestify Agent',
      bio:
        'AI-powered interface to the Attestify attestation protocol. ' +
        'Chat with me to register schemas, create attestations, verify authorities, ' +
        'and interact with Hedera-native features.',
      aiAgent: {
        type: AIAgentType.AUTONOMOUS,
        model: 'gpt-4o-mini',
        capabilities: [
          AIAgentCapability.KNOWLEDGE_RETRIEVAL,
          AIAgentCapability.TEXT_GENERATION,
        ],
      },
    };

    const payload: AgentRegistrationRequest = {
      profile: profile as any,
      registry: 'hashgraph-online',
      communicationProtocol: 'hcs-10',
      endpoint: `hcs-10:${inboundTopicId}`,
    };

    const quote = await broker.getRegistrationQuote(payload);
    console.log('Credits required:', quote);

    const result = await broker.registerAgent(payload);
    console.log('Registration result:', result);
  } else {
    console.log('\n[2/3] Skipping broker registration (no REGISTRY_BROKER_API_KEY or missing topics)');
    console.log('The agent is registered on HCS-10 and can be reached directly.');
  }

  // ─── Step 3: Print env vars to add ─────────────────────────────────────────
  console.log('\n[3/3] Add these to your .env file:\n');
  console.log(`AGENT_INBOUND_TOPIC_ID=${inboundTopicId ?? ''}`);
  console.log(`AGENT_OUTBOUND_TOPIC_ID=${outboundTopicId ?? ''}`);
  console.log('\nDone! Start the agent with: pnpm start');
}

main().catch((err) => {
  console.error('Registration failed:', err);
  process.exit(1);
});

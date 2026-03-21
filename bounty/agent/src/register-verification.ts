/**
 * Register the Verification Agent in the HOL Registry.
 *
 * This script creates a second agent that demonstrates A2A communication.
 * It registers with its own HCS-10 topics and HCS-11 profile so it's
 * discoverable in the HOL Registry alongside the main Attestify Agent.
 *
 * Run: pnpm register-verify
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
  const accountId = process.env.VERIFY_AGENT_ACCOUNT_ID || process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.VERIFY_AGENT_PRIVATE_KEY || process.env.HEDERA_PRIVATE_KEY;
  const apiKey = process.env.REGISTRY_BROKER_API_KEY;

  if (!accountId || !privateKey) {
    console.error('Missing VERIFY_AGENT_ACCOUNT_ID (or HEDERA_ACCOUNT_ID) / VERIFY_AGENT_PRIVATE_KEY (or HEDERA_PRIVATE_KEY)');
    process.exit(1);
  }

  console.log('Registering Verification Agent in HOL Registry...');
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
    .setName('Attestify Verification Agent')
    .setNetwork('testnet')
    .setExistingAccount(accountId, privateKey)
    .setBio(
      'AI agent that verifies on-chain credentials by connecting to the Attestify Agent via HCS-10. ' +
      'Demonstrates agent-to-agent communication for trust verification — checks attestation records, ' +
      'requests new attestations, and validates authority status on behalf of users or other agents.',
    )
    .setCapabilities([
      AIAgentCapability.KNOWLEDGE_RETRIEVAL,
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
      display_name: 'Attestify Verification Agent',
      bio:
        'Verifies on-chain credentials by connecting to the Attestify Agent via HCS-10. ' +
        'Demonstrates agent-to-agent trust verification for the agentic economy.',
      aiAgent: {
        type: AIAgentType.AUTONOMOUS,
        model: 'gpt-4o-mini',
        capabilities: [
          AIAgentCapability.KNOWLEDGE_RETRIEVAL,
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
  }

  // ─── Step 3: Print env vars ────────────────────────────────────────────────
  console.log('\n[3/3] Add these to your .env file:\n');
  console.log(`VERIFY_AGENT_ACCOUNT_ID=${accountId}`);
  console.log(`VERIFY_AGENT_INBOUND_TOPIC_ID=${inboundTopicId ?? ''}`);
  console.log(`VERIFY_AGENT_OUTBOUND_TOPIC_ID=${outboundTopicId ?? ''}`);
  console.log('\nDone! Start the verification agent with: pnpm verify-agent');
}

main().catch((err) => {
  console.error('Registration failed:', err);
  process.exit(1);
});

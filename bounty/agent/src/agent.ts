/**
 * Attestify LangChain Agent
 *
 * Configures the LLM agent with a system prompt that understands the
 * Attestify protocol and has access to all SDK tools.
 */

import { ChatOpenAI } from '@langchain/openai';
import { createToolCallingAgent, AgentExecutor } from 'langchain/agents';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { BufferMemory } from 'langchain/memory';
import { getAllTools } from './attestify-tools.js';

const SYSTEM_PROMPT = `You are the Attestify Agent — an AI assistant that interfaces with the Attestify attestation protocol on Hedera.

You are registered in the Hashgraph Online (HOL) Registry as an autonomous AI agent, discoverable by any agent in the ecosystem.

## Your Identity
- **Name**: Attestify Agent
- **Account**: 0.0.7284771 (Hedera Testnet)
- **Inbound Topic**: 0.0.8238168 (HCS-10)
- **Outbound Topic**: 0.0.8238167 (HCS-10)
- **Profile Topic**: 0.0.8238178 (HCS-11)
- **Registry**: HOL (Hashgraph Online) at hol.org/registry
- **Protocols**: HCS-10 (Hedera-native A2A), Google A2A, MCP (stdio), XMTP, REST API
- **Model**: gpt-4o-mini
- **Type**: Autonomous AI Agent

Attestify is a Hedera-native attestation protocol for issuing, managing, and verifying on-chain attestations. You have direct access to the live smart contracts on Hedera Testnet.

## What You Can Do
- Register schemas (define the structure of attestation data)
- Create attestations (on-chain claims about a subject)
- Revoke attestations
- Register and look up authorities
- Query schemas, attestations, and profiles from the indexer
- Encode/decode attestation data using schema definitions
- Check whitelist and fee resolver status
- Mint HTS NFT credentials linked to attestations
- Schedule automatic revocations via Hedera Scheduled Transactions

## Key Concepts
- **Schema**: A template defining attestation data structure (e.g. "string name, uint256 age, bool verified"). Register once, use for many attestations.
- **Attestation**: An on-chain claim by an attester about a subject, structured according to a schema. Data is ABI-encoded.
- **Authority**: A registered entity that issues attestations. Can be verified by the protocol admin.
- **Resolver**: Optional smart contract for custom validation (whitelist, fee, token-gated).

## Deployed Contracts (Hedera Testnet)
- SchemaRegistry: 0x8320Ae819556C449825F8255e92E7e1bc06c2e80
- AttestationService: 0xce573F82e73F49721255088C7b4D849ad0F64331
- WhitelistResolver: 0x461349A8aEfB220A48b61923095DfF237465c27A
- FeeResolver: 0x7460B74e14d17f0f852959D69Db3F1EAE72aF37C
- TokenGatedResolver: 0x7d04a83cF73CD4853dB4E378DD127440d444718c

## Guidelines
- Be concise and helpful. Show UIDs and addresses in responses.
- When creating attestations, if the user provides field values as text, use the encode tool first or pass JSON data.
- If a user asks to "attest" something, help them create the right schema first if one doesn't exist, then create the attestation.
- Always confirm what you're about to do before executing on-chain write operations.
- The register_schema tool ONLY accepts these parameters: definition (string), revocable (boolean), resolver (optional string). There is NO name parameter. NEVER ask for a name. NEVER say a name is required. If asked to register a schema, call the tool immediately with just definition and revocable.
- For queries (list, get, profile), just execute and return results.`;


// ─── Per-conversation memory store ───────────────────────────────────────────

const conversationMemories = new Map<string, BufferMemory>();

function getMemory(conversationId: string): BufferMemory {
  if (!conversationMemories.has(conversationId)) {
    conversationMemories.set(
      conversationId,
      new BufferMemory({
        memoryKey: 'chat_history',
        returnMessages: true,
      }),
    );
  }
  return conversationMemories.get(conversationId)!;
}

// ─── Agent Factory ───────────────────────────────────────────────────────────

let executor: AgentExecutor | null = null;

export async function initializeAgent(openAIApiKey: string) {
  const llm = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0,
    openAIApiKey: openAIApiKey,
  });

  const tools = getAllTools();

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', SYSTEM_PROMPT],
    new MessagesPlaceholder('chat_history'),
    ['human', '{input}'],
    new MessagesPlaceholder('agent_scratchpad'),
  ]);

  const agent = await createToolCallingAgent({ llm, tools, prompt });

  executor = new AgentExecutor({
    agent,
    tools,
    verbose: process.env.AGENT_VERBOSE === 'true',
    maxIterations: 10,
  });

  console.log(`[Agent] Initialized with ${tools.length} Attestify tools`);
}

/**
 * Process a user message and return the agent's response.
 * Each conversationId gets its own memory for multi-turn context.
 */
export async function processMessage(
  message: string,
  conversationId: string = 'default',
): Promise<string> {
  if (!executor) {
    throw new Error('Agent not initialized. Call initializeAgent() first.');
  }

  const memory = getMemory(conversationId);

  try {
    const result = await executor.invoke({
      input: message,
      chat_history: (await memory.loadMemoryVariables({})).chat_history || [],
    });

    // Save to memory
    await memory.saveContext({ input: message }, { output: result.output });

    return result.output;
  } catch (error: any) {
    console.error('[Agent] Error processing message:', error.message);
    return `I encountered an error: ${error.message}`;
  }
}

/**
 * Clear conversation memory for a given conversation.
 */
export function clearConversation(conversationId: string) {
  conversationMemories.delete(conversationId);
}

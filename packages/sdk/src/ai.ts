/**
 * @attestify/sdk/ai
 *
 * Optional AI integration — exports LangChain-compatible tools and an agent factory
 * for building AI agents that interact with the Attestify protocol.
 *
 * Requires peer dependencies: langchain, @langchain/core, @langchain/openai, zod
 *
 * Usage:
 *   import { getAttestifyTools, createAttestifyAgent } from '@attestify/sdk/ai';
 *
 *   // Get tools for your own agent
 *   const tools = getAttestifyTools({ accountId, privateKey, indexerUrl });
 *
 *   // Or get a ready-to-use agent
 *   const { processMessage, clearConversation } = await createAttestifyAgent({
 *     accountId, privateKey, indexerUrl, openAIApiKey,
 *   });
 *   const response = await processMessage('List all schemas');
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import { createToolCallingAgent, AgentExecutor } from 'langchain/agents';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { BufferMemory } from 'langchain/memory';
import {
  HederaAttestService,
  SchemaEncoder,
  TESTNET_CONTRACT_ADDRESSES,
  TESTNET_RESOLVER_ADDRESSES,
  TESTNET_HCS_TOPICS,
  DEFAULT_RPC_URL,
} from './index';

// ─── Config ──────────────────────────────────────────────────────────────────

export interface AttestifyAIConfig {
  accountId: string;
  privateKey: string;
  indexerUrl?: string;
  rpcUrl?: string;
}

export interface AttestifyAgentConfig extends AttestifyAIConfig {
  openAIApiKey: string;
  modelName?: string;
  temperature?: number;
  systemPrompt?: string;
}

// ─── Tool Factory ────────────────────────────────────────────────────────────

/**
 * Returns 17 LangChain-compatible tools wrapping @attestify/sdk.
 * Plug these into any LangChain, CrewAI, or custom agent.
 */
export function getAttestifyTools(config: AttestifyAIConfig) {
  const service = new HederaAttestService({
    network: 'testnet',
    operatorAccountId: config.accountId,
    operatorPrivateKey: config.privateKey,
    rpcUrl: config.rpcUrl || DEFAULT_RPC_URL,
    contractAddresses: TESTNET_CONTRACT_ADDRESSES,
    resolverAddresses: TESTNET_RESOLVER_ADDRESSES,
    hcsTopicIds: TESTNET_HCS_TOPICS,
    indexerUrl: config.indexerUrl,
  });

  return [
    tool(
      async ({ definition, revocable, resolver }) => {
        const result = await service.registerSchema({ definition, revocable: revocable ?? true, resolver });
        return result.success
          ? `Schema registered! UID: ${result.data!.schemaUid}\nDefinition: ${definition}`
          : `Failed: ${result.error?.message}`;
      },
      {
        name: 'register_schema',
        description: 'Register a new attestation schema on-chain.',
        schema: z.object({
          definition: z.string().describe('Schema definition (e.g. "string name, uint256 age, bool verified")'),
          revocable: z.boolean().optional().describe('Whether attestations can be revoked (default true)'),
          resolver: z.string().optional().describe('Optional resolver contract address'),
        }),
      },
    ),
    tool(
      async ({ uid }) => {
        const result = await service.getSchema(uid);
        if (!result.success) return `Failed: ${result.error?.message}`;
        const s = result.data!;
        return `Schema: ${s.uid}\n  Definition: ${s.definition}\n  Authority: ${s.authority}\n  Revocable: ${s.revocable}`;
      },
      { name: 'get_schema', description: 'Look up a schema by UID.', schema: z.object({ uid: z.string().describe('Schema UID (bytes32 hex)') }) },
    ),
    tool(
      async ({ authority, limit }) => {
        const result = await service.listSchemas({ authority, limit: limit ?? 10 });
        if (!result.success) return `Failed: ${result.error?.message}`;
        const schemas = result.data!;
        if (!schemas.length) return 'No schemas found.';
        return `Found ${schemas.length} schema(s):\n${schemas.map((s) => `  ${s.uid} — ${s.definition}`).join('\n')}`;
      },
      {
        name: 'list_schemas', description: 'List schemas from the indexer.',
        schema: z.object({ authority: z.string().optional().describe('Filter by authority'), limit: z.number().optional().describe('Max results') }),
      },
    ),
    tool(
      async ({ schemaUid, subject, data, expirationTime }) => {
        let encodedData = data;
        if (!data.startsWith('0x')) {
          const schemaResult = await service.getSchema(schemaUid);
          if (schemaResult.success && schemaResult.data) {
            try {
              const encoder = new SchemaEncoder(schemaResult.data.definition);
              encodedData = encoder.encode(JSON.parse(data));
            } catch {
              return `Failed to encode. Schema definition: ${schemaResult.data.definition}`;
            }
          }
        }
        const result = await service.createAttestation({ schemaUid, subject, data: encodedData, expirationTime: expirationTime ?? 0 });
        return result.success ? `Attestation created! UID: ${result.data!.attestationUid}` : `Failed: ${result.error?.message}`;
      },
      {
        name: 'create_attestation', description: 'Create an on-chain attestation.',
        schema: z.object({
          schemaUid: z.string().describe('Schema UID'), subject: z.string().describe('Subject address'),
          data: z.string().describe('ABI-encoded hex or JSON matching schema'), expirationTime: z.number().optional().describe('Expiration timestamp'),
        }),
      },
    ),
    tool(
      async ({ uid }) => {
        const result = await service.getAttestation(uid);
        if (!result.success) return `Failed: ${result.error?.message}`;
        const a = result.data!;
        return `Attestation: ${a.uid}\n  Schema: ${a.schemaUid}\n  Attester: ${a.attester}\n  Subject: ${a.subject}\n  Revoked: ${a.revoked}`;
      },
      { name: 'get_attestation', description: 'Look up an attestation by UID.', schema: z.object({ uid: z.string().describe('Attestation UID') }) },
    ),
    tool(
      async ({ uid }) => {
        const result = await service.revokeAttestation(uid);
        return result.success ? `Revoked! UID: ${uid}` : `Failed: ${result.error?.message}`;
      },
      { name: 'revoke_attestation', description: 'Revoke an attestation.', schema: z.object({ uid: z.string().describe('Attestation UID to revoke') }) },
    ),
    tool(
      async ({ attester, subject, schemaUid, limit }) => {
        const result = await service.listAttestations({ attester, subject, schemaUid, limit: limit ?? 10 });
        if (!result.success) return `Failed: ${result.error?.message}`;
        const list = result.data!;
        if (!list.length) return 'No attestations found.';
        return `Found ${list.length}:\n${list.map((a) => `  ${a.uid} — ${a.attesterAddress} → ${a.subjectAddress} (${a.revoked ? 'Revoked' : 'Active'})`).join('\n')}`;
      },
      {
        name: 'list_attestations', description: 'List attestations from the indexer.',
        schema: z.object({
          attester: z.string().optional(), subject: z.string().optional(),
          schemaUid: z.string().optional(), limit: z.number().optional(),
        }),
      },
    ),
    tool(
      async ({ metadata }) => {
        const result = await service.registerAuthority(metadata);
        return result.success ? `Authority registered! Metadata: ${metadata}` : `Failed: ${result.error?.message}`;
      },
      { name: 'register_authority', description: 'Register as an authority.', schema: z.object({ metadata: z.string().describe('Authority metadata') }) },
    ),
    tool(
      async ({ address }) => {
        const result = await service.getAuthority(address);
        if (!result.success) return `Failed: ${result.error?.message}`;
        const a = result.data!;
        return `Authority: ${a.addr}\n  Metadata: ${a.metadata}\n  Verified: ${a.isVerified}`;
      },
      { name: 'get_authority', description: 'Look up authority info.', schema: z.object({ address: z.string().describe('Authority address') }) },
    ),
    tool(
      async ({ address }) => {
        const result = await service.getProfile(address);
        if (!result.success) return `Failed: ${result.error?.message}`;
        const p = result.data!;
        return `Profile: ${p.address}\n  Authority: ${p.authority ? `${p.authority.metadata} (Verified: ${p.authority.isVerified})` : 'Not registered'}\n  Schemas: ${p.schemas.length}\n  Issued: ${p.attestationsIssued.length}\n  Received: ${p.attestationsReceived.length}`;
      },
      { name: 'get_profile', description: 'Get full profile for an address.', schema: z.object({ address: z.string().describe('Wallet address') }) },
    ),
    tool(
      async ({ definition, values }) => {
        try { return `Encoded: ${new SchemaEncoder(definition).encode(JSON.parse(values))}`; }
        catch (e: any) { return `Failed: ${e.message}`; }
      },
      {
        name: 'encode_attestation_data', description: 'ABI-encode attestation data.',
        schema: z.object({ definition: z.string().describe('Schema definition'), values: z.string().describe('JSON values') }),
      },
    ),
    tool(
      async ({ definition, data }) => {
        try {
          const decoded = new SchemaEncoder(definition).decode(data);
          return `Decoded:\n${Object.entries(decoded).map(([k, v]) => `  ${k}: ${v}`).join('\n')}`;
        } catch (e: any) { return `Failed: ${e.message}`; }
      },
      {
        name: 'decode_attestation_data', description: 'Decode ABI-encoded attestation data.',
        schema: z.object({ definition: z.string().describe('Schema definition'), data: z.string().describe('Hex data') }),
      },
    ),
    tool(
      async ({ account }) => {
        const result = await service.whitelistCheck(account);
        return result.success ? `${account}: ${result.data!.whitelisted ? 'whitelisted ✓' : 'NOT whitelisted ✗'}` : `Failed: ${result.error?.message}`;
      },
      { name: 'whitelist_check', description: 'Check whitelist status.', schema: z.object({ account: z.string() }) },
    ),
    tool(
      async () => {
        const result = await service.feeGetFee();
        return result.success ? `Fee: ${result.data!.fee} wei` : `Failed: ${result.error?.message}`;
      },
      { name: 'fee_get_fee', description: 'Get current attestation fee.', schema: z.object({}) },
    ),
    tool(
      async ({ account }) => {
        const result = await service.feeGetBalance(account);
        return result.success ? `Balance for ${account}: ${result.data!.balance} wei` : `Failed: ${result.error?.message}`;
      },
      { name: 'fee_get_balance', description: 'Check deposited balance on FeeResolver.', schema: z.object({ account: z.string() }) },
    ),
    tool(
      async ({ subject, attestationUid, tokenId }) => {
        const result = await service.mintNFT({ subject, attestationUid, tokenId });
        return result.success ? `NFT minted! Serial: ${result.data!.serialNumber}` : `Failed: ${result.error?.message}`;
      },
      {
        name: 'mint_nft_credential', description: 'Mint an HTS NFT credential linked to an attestation.',
        schema: z.object({ subject: z.string(), attestationUid: z.string(), tokenId: z.string() }),
      },
    ),
    tool(
      async ({ attestationUid, executeAt }) => {
        const result = await service.scheduleRevocation({ attestationUid, executeAt });
        return result.success
          ? `Scheduled! ID: ${result.data!.scheduleId}, executes: ${new Date(executeAt * 1000).toISOString()}`
          : `Failed: ${result.error?.message}`;
      },
      {
        name: 'schedule_revocation', description: 'Schedule automatic revocation via Hedera Scheduled Transactions.',
        schema: z.object({ attestationUid: z.string(), executeAt: z.number().describe('Unix timestamp') }),
      },
    ),
  ];
}

// ─── Default System Prompt ───────────────────────────────────────────────────

const DEFAULT_SYSTEM_PROMPT = `You are an AI assistant for the Attestify attestation protocol on Hedera.

You can register schemas, create attestations, revoke attestations, register authorities, query profiles, encode/decode data, check resolver status, mint NFT credentials, and schedule revocations.

Key concepts:
- Schema: template defining attestation data structure (e.g. "string name, uint256 age, bool verified")
- Attestation: on-chain claim by an attester about a subject, structured by a schema
- Authority: registered entity that issues attestations
- Resolver: optional validation logic (whitelist, fee, token-gated)

Be concise. Show UIDs and addresses. Confirm before on-chain writes.`;

// ─── Agent Factory ───────────────────────────────────────────────────────────

/**
 * Creates a ready-to-use Attestify agent with conversation memory.
 *
 * Returns processMessage() and clearConversation() functions.
 */
export async function createAttestifyAgent(config: AttestifyAgentConfig) {
  const tools = getAttestifyTools(config);

  const llm = new ChatOpenAI({
    modelName: config.modelName || 'gpt-4o-mini',
    temperature: config.temperature ?? 0,
    openAIApiKey: config.openAIApiKey,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', config.systemPrompt || DEFAULT_SYSTEM_PROMPT],
    new MessagesPlaceholder('chat_history'),
    ['human', '{input}'],
    new MessagesPlaceholder('agent_scratchpad'),
  ]);

  const agent = createToolCallingAgent({ llm, tools, prompt });

  const executor = new AgentExecutor({ agent, tools, verbose: false, maxIterations: 10 });

  const memories = new Map<string, BufferMemory>();

  function getMemory(id: string): BufferMemory {
    if (!memories.has(id)) {
      memories.set(id, new BufferMemory({ memoryKey: 'chat_history', returnMessages: true }));
    }
    return memories.get(id)!;
  }

  async function processMessage(message: string, conversationId = 'default'): Promise<string> {
    const memory = getMemory(conversationId);
    const chatHistory = (await memory.loadMemoryVariables({})).chat_history || [];
    const result = await executor.invoke({ input: message, chat_history: chatHistory });
    await memory.saveContext({ input: message }, { output: result.output });
    return result.output;
  }

  function clearConversation(conversationId: string) {
    memories.delete(conversationId);
  }

  return { processMessage, clearConversation, tools, executor };
}

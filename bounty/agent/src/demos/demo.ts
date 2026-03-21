/**
 * Attestify Agent — Scripted Demo
 *
 * Runs a pre-scripted multi-turn conversation with the Attestify Agent.
 * Uses the REST API with a shared conversation ID so the agent has memory
 * across turns — if it asks a follow-up question, the demo replies.
 *
 * Also demonstrates A2A Agent Card discovery at the start.
 *
 * Run: pnpm demo
 */

import 'dotenv/config';

const AGENT_URL = process.env.A2A_BASE_URL || 'http://localhost:3002';

/**
 * Each step has a primary message and optional follow-ups.
 * If the agent asks a clarifying question, the follow-up handles it.
 */
const DEMO_STEPS = [
  {
    label: 'Step 1: List all schemas on-chain',
    message: 'List all registered schemas. Do not filter by authority — show everything.',
  },
  {
    label: 'Step 2: Register a new verification schema',
    message:
      'Register a new schema with definition "string verifierName, string result, bool passed" and make it revocable. No resolver needed.',
    followUp: 'Yes, proceed with registering the schema. The definition is "string verifierName, string result, bool passed", revocable true, no resolver.',
  },
  {
    label: 'Step 3: Check attestations for a subject',
    message: 'List all attestations for subject 0x0000000000000000000000000000000000001234',
  },
  {
    label: 'Step 4: Get profile for an address',
    message: 'Get the full profile for address 0x0F1A0cb488F42b1Bb2A04453BA9c410c5aC72f3c — show schemas created, attestations issued, attestations received, and authority status.',
  },
  {
    label: 'Step 5: Explain what Attestify can do',
    message: 'What operations can you perform? Give me a brief summary of your capabilities.',
  },
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const conversationId = `demo-${Date.now()}`;
let requestCounter = 0;

async function discoverAgent(): Promise<any> {
  const res = await fetch(`${AGENT_URL}/.well-known/agent.json`);
  if (!res.ok) throw new Error(`Discovery failed: ${res.status}`);
  return res.json();
}

async function chat(message: string): Promise<string> {
  requestCounter++;
  const res = await fetch(`${AGENT_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, conversationId }),
  });

  if (!res.ok) throw new Error(`Chat request failed: ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Unknown error');
  return data.response;
}

/** Check if the agent is asking a question / needs more info */
function isAskingFollowUp(response: string): boolean {
  const lower = response.toLowerCase();
  return (
    lower.includes('please provide') ||
    lower.includes('could you') ||
    lower.includes('would you like') ||
    lower.includes('can you provide') ||
    lower.includes('what is the') ||
    lower.includes('what name') ||
    lower.includes('please confirm') ||
    lower.includes('please specify')
  );
}

function printResponse(response: string) {
  console.log();
  console.log('  ◀ Agent response:');
  console.log('  ─────────────────');
  for (const line of response.split('\n')) {
    console.log('  %s', line);
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Attestify Agent — Interactive Demo                    ║');
  console.log('║   Multi-turn conversation with memory                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();
  console.log('[Demo] Target: %s', AGENT_URL);
  console.log('[Demo] Conversation: %s', conversationId);
  console.log();

  // ─── Step 0: A2A Agent Card Discovery ──────────────────────────────────
  console.log('┌──────────────────────────────────────────────────────');
  console.log('│ Step 0: Discover the Attestify Agent (A2A Agent Card)');
  console.log('├──────────────────────────────────────────────────────');
  console.log('│ → GET %s/.well-known/agent.json', AGENT_URL);
  console.log('└──────────────────────────────────────────────────────');

  try {
    const card = await discoverAgent();
    console.log();
    console.log('  ◀ Agent Card:');
    console.log('  ─────────────');
    console.log('  Name:        %s', card.name);
    console.log('  Description: %s', card.description?.substring(0, 80) + '...');
    console.log('  Version:     %s', card.version);
    console.log('  Streaming:   %s', card.capabilities?.streaming ?? false);
    if (card.skills?.length) {
      for (const skill of card.skills) {
        console.log('  Skill:       %s (%s)', skill.name, skill.tags?.join(', '));
      }
    }
  } catch (err: any) {
    console.log('  ⚠ Discovery failed: %s', err.message);
  }

  console.log();
  await sleep(2000);

  // ─── Run conversation steps ────────────────────────────────────────────
  for (const step of DEMO_STEPS) {
    console.log('┌──────────────────────────────────────────────────────');
    console.log('│ %s', step.label);
    console.log('├──────────────────────────────────────────────────────');
    console.log('│ → "%s"', step.message.substring(0, 90) + (step.message.length > 90 ? '...' : ''));
    console.log('└──────────────────────────────────────────────────────');

    try {
      let response = await chat(step.message);
      printResponse(response);

      // If the agent asks a follow-up question and we have a follow-up ready
      if (isAskingFollowUp(response) && step.followUp) {
        console.log();
        console.log('  → Agent asked for clarification. Sending follow-up...');
        console.log('  → "%s"', step.followUp.substring(0, 80) + (step.followUp.length > 80 ? '...' : ''));

        response = await chat(step.followUp);
        printResponse(response);

        // If still asking, try one more time with a more direct prompt
        if (isAskingFollowUp(response)) {
          console.log();
          console.log('  → Sending final clarification...');
          const finalPrompt = 'Just do it with the parameters I already gave you. Proceed.';
          response = await chat(finalPrompt);
          printResponse(response);
        }
      }
    } catch (err: any) {
      console.log('  ⚠ Error: %s', err.message);
    }

    console.log();
    await sleep(2000);
  }

  // ─── Also test A2A protocol with one task ──────────────────────────────
  console.log('┌──────────────────────────────────────────────────────');
  console.log('│ Bonus: A2A Protocol Test (JSON-RPC tasks/send)');
  console.log('├──────────────────────────────────────────────────────');
  console.log('│ → POST %s/a2a', AGENT_URL);
  console.log('└──────────────────────────────────────────────────────');

  try {
    const a2aRes = await fetch(`${AGENT_URL}/a2a`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'demo-a2a-1',
        method: 'tasks/send',
        params: {
          id: 'a2a-demo-task',
          message: {
            role: 'user',
            parts: [{ text: 'How many schemas are registered?' }],
          },
        },
      }),
    });

    const a2aData = await a2aRes.json();
    const agentText =
      a2aData.result?.status?.message?.parts?.[0]?.text || '(no response)';

    console.log();
    console.log('  ◀ A2A Response (task: %s, state: %s):', a2aData.result?.id, a2aData.result?.status?.state);
    console.log('  ─────────────────');
    for (const line of agentText.split('\n')) {
      console.log('  %s', line);
    }
  } catch (err: any) {
    console.log('  ⚠ A2A test failed: %s', err.message);
  }

  console.log();
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Demo complete!                                        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  process.exit(0);
}

main().catch((err) => {
  console.error('[Demo] Fatal error:', err);
  process.exit(1);
});

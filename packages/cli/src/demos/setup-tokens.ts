/**
 * Setup Script — Create HTS tokens needed for the Hedera Native demo.
 *
 * Creates:
 *   1. An HTS NFT collection (for NFT Credential demo)
 *   2. An HTS fungible token (for Token Staking demo)
 *
 * Run ONCE before the demo: pnpm demo:setup
 * Outputs the token IDs to copy into your .env or pass to the demo.
 */

import 'dotenv/config';
import {
  Client,
  AccountId,
  PrivateKey,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenMintTransaction,
  TokenAssociateTransaction,
  TokenId,
  Hbar,
} from '@hashgraph/sdk';

const ACCOUNT_ID = process.env.HEDERA_ACCOUNT_ID!;
const PRIVATE_KEY = process.env.HEDERA_PRIVATE_KEY!;

if (!ACCOUNT_ID || !PRIVATE_KEY) {
  console.error('Missing HEDERA_ACCOUNT_ID or HEDERA_PRIVATE_KEY in .env');
  process.exit(1);
}

async function main() {
  const client = Client.forTestnet();
  const operatorKey = PrivateKey.fromStringECDSA(PRIVATE_KEY);
  client.setOperator(AccountId.fromString(ACCOUNT_ID), operatorKey);

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Attestify — HTS Token Setup                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();
  console.log('Operator: %s', ACCOUNT_ID);
  console.log();

  // ─── 1. Create NFT Collection ──────────────────────────────────────────
  console.log('┌──────────────────────────────────────────────────────');
  console.log('│ Step 1: Create HTS NFT Collection');
  console.log('└──────────────────────────────────────────────────────');

  const nftTx = new TokenCreateTransaction()
    .setTokenName('Attestify Credentials')
    .setTokenSymbol('ACRED')
    .setTokenType(TokenType.NonFungibleUnique)
    .setSupplyType(TokenSupplyType.Infinite)
    .setTreasuryAccountId(AccountId.fromString(ACCOUNT_ID))
    .setSupplyKey(operatorKey.publicKey)
    .setAdminKey(operatorKey.publicKey)
    .setMaxTransactionFee(new Hbar(30));

  const nftReceipt = await (await nftTx.execute(client)).getReceipt(client);
  const nftTokenId = nftReceipt.tokenId!.toString();

  console.log('  ✓ NFT Collection created: %s', nftTokenId);
  console.log('    Name:   Attestify Credentials');
  console.log('    Symbol: ACRED');
  console.log('    Type:   Non-Fungible Unique');
  console.log('    Supply Key: operator');
  console.log();

  // ─── 2. Create Fungible Token ──────────────────────────────────────────
  console.log('┌──────────────────────────────────────────────────────');
  console.log('│ Step 2: Create HTS Fungible Token');
  console.log('└──────────────────────────────────────────────────────');

  const ftTx = new TokenCreateTransaction()
    .setTokenName('Attestify Stake Token')
    .setTokenSymbol('ASTK')
    .setTokenType(TokenType.FungibleCommon)
    .setDecimals(0)
    .setInitialSupply(1000000)
    .setTreasuryAccountId(AccountId.fromString(ACCOUNT_ID))
    .setSupplyKey(operatorKey.publicKey)
    .setAdminKey(operatorKey.publicKey)
    .setMaxTransactionFee(new Hbar(30));

  const ftReceipt = await (await ftTx.execute(client)).getReceipt(client);
  const ftTokenId = ftReceipt.tokenId!.toString();

  console.log('  ✓ Fungible Token created: %s', ftTokenId);
  console.log('    Name:    Attestify Stake Token');
  console.log('    Symbol:  ASTK');
  console.log('    Supply:  1,000,000');
  console.log('    Decimals: 0');
  console.log();

  // ─── Summary ───────────────────────────────────────────────────────────
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Setup Complete!                                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();
  console.log('Add these to your packages/cli/.env:');
  console.log();
  console.log('  DEMO_NFT_TOKEN_ID=%s', nftTokenId);
  console.log('  DEMO_STAKE_TOKEN_ID=%s', ftTokenId);
  console.log();
  console.log('Then run: pnpm demo:native');

  process.exit(0);
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Attestify — Hedera Contract Deployment Script
 *
 * Deploys all contracts in dependency order:
 *   1. SchemaRegistry (no constructor args)
 *   2. AttestationService (references SchemaRegistry)
 *   3. WhitelistResolver (no constructor args)
 *   4. TokenGatedResolver (token address + minimum balance)
 *   5. FeeResolver (fee amount)
 *
 * Outputs deployed addresses to deployed-addresses.json.
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network hedera_testnet
 *   npx hardhat run scripts/deploy.ts                          # local hardhat
 *
 * Environment variables (optional):
 *   TOKEN_ADDRESS     — HTS token address for TokenGatedResolver (default: placeholder)
 *   MINIMUM_BALANCE   — Minimum token balance for TokenGatedResolver (default: 1)
 *   FEE_AMOUNT        — Fee in wei for FeeResolver (default: 1 HBAR = 10^18 tinybars)
 */

interface DeployedContract {
  address: string;
  timestamp: string;
}

interface NetworkDeployment {
  [contractName: string]: DeployedContract;
}

interface DeploymentFile {
  [network: string]: NetworkDeployment;
}

const DEPLOYED_ADDRESSES_PATH = path.join(__dirname, "..", "deployed-addresses.json");

// Default placeholder token address for TokenGatedResolver
const DEFAULT_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000001";
const DEFAULT_MINIMUM_BALANCE = 1;
// 1 HBAR = 10^18 tinybars (wei equivalent on Hedera)
const DEFAULT_FEE = ethers.parseEther("1");

function getNetworkName(): string {
  const chainId = Number(process.env.HARDHAT_NETWORK_CHAIN_ID || "31337");
  // hre.network.name is more reliable but we detect from the runtime
  // The network name is passed via --network flag
  if (process.env.HARDHAT_NETWORK === "hedera_testnet") {
    return "hedera_testnet";
  }
  return "localhost";
}

async function loadExistingDeployments(): Promise<DeploymentFile> {
  try {
    if (fs.existsSync(DEPLOYED_ADDRESSES_PATH)) {
      const raw = fs.readFileSync(DEPLOYED_ADDRESSES_PATH, "utf-8");
      return JSON.parse(raw) as DeploymentFile;
    }
  } catch {
    // If file is corrupted, start fresh
  }
  return {};
}

function saveDeployments(deployments: DeploymentFile): void {
  fs.writeFileSync(DEPLOYED_ADDRESSES_PATH, JSON.stringify(deployments, null, 2) + "\n");
}

async function main() {
  const network = await ethers.provider.getNetwork();
  const networkName = network.chainId === 296n ? "hedera_testnet" : "localhost";
  const [deployer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════════════");
  console.log("  Attestify — Contract Deployment");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Network:  ${networkName} (chainId: ${network.chainId})`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log("═══════════════════════════════════════════════════\n");

  const deployments: NetworkDeployment = {};

  // ── 1. SchemaRegistry ──────────────────────────────────────────────────
  console.log("1/7  Deploying SchemaRegistry...");
  const SchemaRegistry = await ethers.getContractFactory("SchemaRegistry");
  const schemaRegistry = await SchemaRegistry.deploy();
  await schemaRegistry.waitForDeployment();
  const schemaRegistryAddress = await schemaRegistry.getAddress();
  deployments["SchemaRegistry"] = {
    address: schemaRegistryAddress,
    timestamp: new Date().toISOString(),
  };
  console.log(`     ✓ SchemaRegistry deployed at: ${schemaRegistryAddress}\n`);

  // ── 2. AttestationService ──────────────────────────────────────────────
  console.log("2/7  Deploying AttestationService...");
  const AttestationService = await ethers.getContractFactory("AttestationService");
  const attestationService = await AttestationService.deploy(schemaRegistryAddress);
  await attestationService.waitForDeployment();
  const attestationServiceAddress = await attestationService.getAddress();
  deployments["AttestationService"] = {
    address: attestationServiceAddress,
    timestamp: new Date().toISOString(),
  };
  console.log(`     ✓ AttestationService deployed at: ${attestationServiceAddress}\n`);

  // ── 3. WhitelistResolver ───────────────────────────────────────────────
  console.log("3/7  Deploying WhitelistResolver...");
  const WhitelistResolver = await ethers.getContractFactory("WhitelistResolver");
  const whitelistResolver = await WhitelistResolver.deploy();
  await whitelistResolver.waitForDeployment();
  const whitelistResolverAddress = await whitelistResolver.getAddress();
  deployments["WhitelistResolver"] = {
    address: whitelistResolverAddress,
    timestamp: new Date().toISOString(),
  };
  console.log(`     ✓ WhitelistResolver deployed at: ${whitelistResolverAddress}\n`);

  // ── 4. TokenGatedResolver ──────────────────────────────────────────────
  const tokenAddress = process.env.TOKEN_ADDRESS || DEFAULT_TOKEN_ADDRESS;
  const minimumBalance = process.env.MINIMUM_BALANCE
    ? BigInt(process.env.MINIMUM_BALANCE)
    : BigInt(DEFAULT_MINIMUM_BALANCE);

  console.log("4/7  Deploying TokenGatedResolver...");
  console.log(`     Token: ${tokenAddress}, Min balance: ${minimumBalance}`);
  const TokenGatedResolver = await ethers.getContractFactory("TokenGatedResolver");
  const tokenGatedResolver = await TokenGatedResolver.deploy(tokenAddress, minimumBalance);
  await tokenGatedResolver.waitForDeployment();
  const tokenGatedResolverAddress = await tokenGatedResolver.getAddress();
  deployments["TokenGatedResolver"] = {
    address: tokenGatedResolverAddress,
    timestamp: new Date().toISOString(),
  };
  console.log(`     ✓ TokenGatedResolver deployed at: ${tokenGatedResolverAddress}\n`);

  // ── 5. FeeResolver ────────────────────────────────────────────────────
  const feeAmount = process.env.FEE_AMOUNT ? BigInt(process.env.FEE_AMOUNT) : DEFAULT_FEE;

  console.log("5/7  Deploying FeeResolver...");
  console.log(`     Fee: ${ethers.formatEther(feeAmount)} HBAR`);
  const FeeResolver = await ethers.getContractFactory("FeeResolver");
  const feeResolver = await FeeResolver.deploy(feeAmount);
  await feeResolver.waitForDeployment();
  const feeResolverAddress = await feeResolver.getAddress();
  deployments["FeeResolver"] = {
    address: feeResolverAddress,
    timestamp: new Date().toISOString(),
  };
  console.log(`     ✓ FeeResolver deployed at: ${feeResolverAddress}\n`);

  // ── 6. TokenRewardResolver ─────────────────────────────────────────────
  const rewardToken = process.env.REWARD_TOKEN_ADDRESS || DEFAULT_TOKEN_ADDRESS;
  const rewardAmount = process.env.REWARD_AMOUNT ? BigInt(process.env.REWARD_AMOUNT) : BigInt(1);

  console.log("6/7  Deploying TokenRewardResolver...");
  console.log(`     Token: ${rewardToken}, Amount: ${rewardAmount}`);
  const TokenRewardResolver = await ethers.getContractFactory("TokenRewardResolver");
  const tokenRewardResolver = await TokenRewardResolver.deploy(rewardToken, rewardAmount);
  await tokenRewardResolver.waitForDeployment();
  const tokenRewardResolverAddress = await tokenRewardResolver.getAddress();
  deployments["TokenRewardResolver"] = {
    address: tokenRewardResolverAddress,
    timestamp: new Date().toISOString(),
  };
  console.log(`     ✓ TokenRewardResolver deployed at: ${tokenRewardResolverAddress}\n`);

  // ── 7. CrossContractResolver ───────────────────────────────────────────
  console.log("7/7  Deploying CrossContractResolver...");
  console.log(`     Pipeline: [WhitelistResolver, FeeResolver]`);
  const CrossContractResolver = await ethers.getContractFactory("CrossContractResolver");
  const crossContractResolver = await CrossContractResolver.deploy([whitelistResolverAddress, feeResolverAddress]);
  await crossContractResolver.waitForDeployment();
  const crossContractResolverAddress = await crossContractResolver.getAddress();
  deployments["CrossContractResolver"] = {
    address: crossContractResolverAddress,
    timestamp: new Date().toISOString(),
  };
  console.log(`     ✓ CrossContractResolver deployed at: ${crossContractResolverAddress}\n`);

  // ── Save deployed addresses ────────────────────────────────────────────
  const existing = await loadExistingDeployments();
  existing[networkName] = deployments;
  saveDeployments(existing);

  console.log("═══════════════════════════════════════════════════");
  console.log("  Deployment Complete");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Addresses saved to: deployed-addresses.json`);
  console.log("");
  for (const [name, info] of Object.entries(deployments)) {
    console.log(`  ${name.padEnd(22)} ${info.address}`);
  }
  console.log("═══════════════════════════════════════════════════");
  console.log("");
  console.log("  To verify contracts on HashScan, wait a few minutes");
  console.log("  for the contracts to be indexed, then run:");
  console.log("");
  console.log("    npx hardhat run scripts/verify.ts --network hedera_testnet");
  console.log("");
  console.log("  Or use the shorthand:");
  console.log("");
  console.log("    pnpm verify:all");
  console.log("");
}

main().catch((error) => {
  console.error("\n✗ Deployment failed:", error.message || error);
  process.exitCode = 1;
});

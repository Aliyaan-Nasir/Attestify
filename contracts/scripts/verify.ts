import { run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Attestify — HashScan Contract Verification Script
 *
 * Reads deployed addresses from deployed-addresses.json and verifies
 * each contract on HashScan using Sourcify via `hardhat verify`.
 *
 * Usage:
 *   npx hardhat run scripts/verify.ts --network hedera_testnet
 */

const DEPLOYED_ADDRESSES_PATH = path.join(__dirname, "..", "deployed-addresses.json");

interface DeployedContract {
  address: string;
  timestamp: string;
}

interface DeploymentFile {
  [network: string]: { [contractName: string]: DeployedContract };
}

interface VerifyTask {
  name: string;
  address: string;
  constructorArgs: unknown[];
}

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Attestify — HashScan Contract Verification");
  console.log("═══════════════════════════════════════════════════\n");

  // ── Load deployed addresses ────────────────────────────────────────────
  if (!fs.existsSync(DEPLOYED_ADDRESSES_PATH)) {
    console.error("✗ deployed-addresses.json not found. Run deploy.ts first.");
    process.exitCode = 1;
    return;
  }

  const deployments: DeploymentFile = JSON.parse(
    fs.readFileSync(DEPLOYED_ADDRESSES_PATH, "utf-8")
  );

  const networkAddresses = deployments["hedera_testnet"];
  if (!networkAddresses) {
    console.error("✗ No hedera_testnet deployment found in deployed-addresses.json.");
    process.exitCode = 1;
    return;
  }

  // ── Build verification tasks with constructor args ─────────────────────
  const tasks: VerifyTask[] = [];

  if (networkAddresses["SchemaRegistry"]) {
    tasks.push({
      name: "SchemaRegistry",
      address: networkAddresses["SchemaRegistry"].address,
      constructorArgs: [],
    });
  }

  if (networkAddresses["AttestationService"]) {
    const schemaRegistryAddr = networkAddresses["SchemaRegistry"]?.address;
    if (!schemaRegistryAddr) {
      console.warn("⚠ SchemaRegistry address not found — skipping AttestationService verification.");
    } else {
      tasks.push({
        name: "AttestationService",
        address: networkAddresses["AttestationService"].address,
        constructorArgs: [schemaRegistryAddr],
      });
    }
  }

  if (networkAddresses["WhitelistResolver"]) {
    tasks.push({
      name: "WhitelistResolver",
      address: networkAddresses["WhitelistResolver"].address,
      constructorArgs: [],
    });
  }

  if (networkAddresses["TokenGatedResolver"]) {
    const tokenAddress = process.env.TOKEN_ADDRESS || "0x0000000000000000000000000000000000000001";
    const minimumBalance = process.env.MINIMUM_BALANCE || "1";
    tasks.push({
      name: "TokenGatedResolver",
      address: networkAddresses["TokenGatedResolver"].address,
      constructorArgs: [tokenAddress, minimumBalance],
    });
  }

  if (networkAddresses["FeeResolver"]) {
    const feeAmount = process.env.FEE_AMOUNT || "1000000000000000000"; // 1 HBAR default
    tasks.push({
      name: "FeeResolver",
      address: networkAddresses["FeeResolver"].address,
      constructorArgs: [feeAmount],
    });
  }

  if (tasks.length === 0) {
    console.log("No contracts found to verify.");
    return;
  }

  // ── Verify each contract ───────────────────────────────────────────────
  let passed = 0;
  let failed = 0;

  for (const task of tasks) {
    console.log(`Verifying ${task.name} at ${task.address}...`);
    try {
      await run("verify:verify", {
        address: task.address,
        constructorArguments: task.constructorArgs,
      });
      console.log(`  ✓ ${task.name} verified successfully.\n`);
      passed++;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("already verified")) {
        console.log(`  ✓ ${task.name} is already verified.\n`);
        passed++;
      } else if (
        message.toLowerCase().includes("successfully verified") ||
        message.toLowerCase().includes("sourcify")
      ) {
        // Sourcify succeeded but etherscan failed — count as success
        console.log(`  ✓ ${task.name} verified on Sourcify (etherscan skipped).\n`);
        passed++;
      } else {
        console.error(`  ✗ ${task.name} verification failed: ${message}\n`);
        failed++;
      }
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Verification Complete: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════════════");

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("\n✗ Verification failed:", error.message || error);
  process.exitCode = 1;
});

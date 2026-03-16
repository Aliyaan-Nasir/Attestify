import { expect } from "chai";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Address Consistency Tests
 *
 * Verifies that all deployed contract addresses are consistent across
 * configuration files:
 *   1. deployed-addresses.json (source of truth)
 *   2. Frontend contracts.ts
 *   3. SDK config.ts
 *
 * Also validates address format and required contract presence.
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

const REQUIRED_CONTRACTS = [
  "SchemaRegistry",
  "AttestationService",
  "WhitelistResolver",
  "TokenGatedResolver",
  "FeeResolver",
] as const;

interface DeployedEntry {
  address: string;
  timestamp: string;
}

interface DeployedAddresses {
  hedera_testnet: Record<string, DeployedEntry>;
  [key: string]: Record<string, DeployedEntry>;
}

function readDeployedAddresses(): DeployedAddresses {
  const filePath = resolve(__dirname, "..", "deployed-addresses.json");
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function readFrontendContracts(): Record<string, string> {
  const filePath = resolve(
    __dirname,
    "..",
    "..",
    "apps",
    "web",
    "src",
    "lib",
    "contracts.ts"
  );
  const content = readFileSync(filePath, "utf-8");

  // Parse the DEPLOYED_ADDRESSES object from the TS source
  const addresses: Record<string, string> = {};
  const regex = /(\w+):\s*'(0x[0-9a-fA-F]+)'/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    addresses[match[1]] = match[2];
  }
  return addresses;
}

function readSdkConfig(): Record<string, string> {
  const filePath = resolve(
    __dirname,
    "..",
    "..",
    "packages",
    "sdk",
    "src",
    "config.ts"
  );
  const content = readFileSync(filePath, "utf-8");

  // Extract TESTNET_CONTRACT_ADDRESSES block
  const blockMatch = content.match(
    /TESTNET_CONTRACT_ADDRESSES[\s\S]*?=\s*\{([\s\S]*?)\}/
  );
  if (!blockMatch) return {};

  const addresses: Record<string, string> = {};
  const regex = /(\w+):\s*'(0x[0-9a-fA-F]+)'/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(blockMatch[1])) !== null) {
    addresses[match[1]] = match[2];
  }
  return addresses;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Address Consistency", function () {
  let deployedAddresses: DeployedAddresses;
  let testnetAddresses: Record<string, string>;
  let frontendAddresses: Record<string, string>;
  let sdkAddresses: Record<string, string>;

  before(function () {
    deployedAddresses = readDeployedAddresses();
    // Flatten testnet addresses to { ContractName: address }
    testnetAddresses = {};
    for (const [name, entry] of Object.entries(
      deployedAddresses.hedera_testnet
    )) {
      testnetAddresses[name] = entry.address;
    }
    frontendAddresses = readFrontendContracts();
    sdkAddresses = readSdkConfig();
  });

  describe("deployed-addresses.json validity", function () {
    it("should contain a hedera_testnet section", function () {
      expect(deployedAddresses).to.have.property("hedera_testnet");
    });

    for (const contract of REQUIRED_CONTRACTS) {
      it(`should contain ${contract}`, function () {
        expect(testnetAddresses).to.have.property(contract);
      });

      it(`${contract} address should be a valid hex address`, function () {
        const addr = testnetAddresses[contract];
        expect(addr).to.match(
          VALID_HEX_ADDRESS,
          `${contract} address "${addr}" is not a valid 0x + 40 hex char address`
        );
      });
    }
  });

  describe("Frontend contracts.ts matches deployed addresses", function () {
    it("SchemaRegistry address should match", function () {
      expect(frontendAddresses.SchemaRegistry?.toLowerCase()).to.equal(
        testnetAddresses.SchemaRegistry?.toLowerCase()
      );
    });

    it("AttestationService address should match", function () {
      expect(frontendAddresses.AttestationService?.toLowerCase()).to.equal(
        testnetAddresses.AttestationService?.toLowerCase()
      );
    });

    it("WhitelistResolver address should match", function () {
      expect(frontendAddresses.WhitelistResolver?.toLowerCase()).to.equal(
        testnetAddresses.WhitelistResolver?.toLowerCase()
      );
    });

    it("TokenGatedResolver address should match", function () {
      expect(frontendAddresses.TokenGatedResolver?.toLowerCase()).to.equal(
        testnetAddresses.TokenGatedResolver?.toLowerCase()
      );
    });

    it("FeeResolver address should match", function () {
      expect(frontendAddresses.FeeResolver?.toLowerCase()).to.equal(
        testnetAddresses.FeeResolver?.toLowerCase()
      );
    });

    it("all frontend addresses should be valid hex addresses", function () {
      for (const [name, addr] of Object.entries(frontendAddresses)) {
        expect(addr).to.match(
          VALID_HEX_ADDRESS,
          `Frontend ${name} address "${addr}" is not valid`
        );
      }
    });
  });

  describe("SDK config.ts matches deployed addresses", function () {
    it("schemaRegistry address should match", function () {
      expect(sdkAddresses.schemaRegistry?.toLowerCase()).to.equal(
        testnetAddresses.SchemaRegistry?.toLowerCase()
      );
    });

    it("attestationService address should match", function () {
      expect(sdkAddresses.attestationService?.toLowerCase()).to.equal(
        testnetAddresses.AttestationService?.toLowerCase()
      );
    });

    it("all SDK addresses should be valid hex addresses", function () {
      for (const [name, addr] of Object.entries(sdkAddresses)) {
        expect(addr).to.match(
          VALID_HEX_ADDRESS,
          `SDK ${name} address "${addr}" is not valid`
        );
      }
    });
  });

  describe("Cross-file consistency", function () {
    it("frontend and SDK SchemaRegistry addresses should match", function () {
      expect(frontendAddresses.SchemaRegistry?.toLowerCase()).to.equal(
        sdkAddresses.schemaRegistry?.toLowerCase()
      );
    });

    it("frontend and SDK AttestationService addresses should match", function () {
      expect(frontendAddresses.AttestationService?.toLowerCase()).to.equal(
        sdkAddresses.attestationService?.toLowerCase()
      );
    });

    it("all three sources should agree on SchemaRegistry", function () {
      const deployed = testnetAddresses.SchemaRegistry?.toLowerCase();
      const frontend = frontendAddresses.SchemaRegistry?.toLowerCase();
      const sdk = sdkAddresses.schemaRegistry?.toLowerCase();
      expect(deployed).to.equal(frontend);
      expect(deployed).to.equal(sdk);
    });

    it("all three sources should agree on AttestationService", function () {
      const deployed = testnetAddresses.AttestationService?.toLowerCase();
      const frontend = frontendAddresses.AttestationService?.toLowerCase();
      const sdk = sdkAddresses.attestationService?.toLowerCase();
      expect(deployed).to.equal(frontend);
      expect(deployed).to.equal(sdk);
    });
  });
});

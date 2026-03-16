import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { SchemaRegistry, MockResolver } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// ═══════════════════════════════════════════════════════════════════════════
// Property 16: Resolver interface validation
//
// For any address that does not implement the IResolver interface (i.e.,
// does not support the expected supportsInterface selector), attempting to
// register a schema with that address as resolver should revert.
//
// Validates: Requirements 6.3
// ═══════════════════════════════════════════════════════════════════════════
describe("Property 16: Resolver interface validation", function () {
  let registry: SchemaRegistry;
  let validResolver: MockResolver;
  let authority: SignerWithAddress;
  let signers: SignerWithAddress[];

  const DEFINITION = "string name, uint256 age";
  const REVOCABLE = true;

  beforeEach(async function () {
    signers = await ethers.getSigners();
    authority = signers[0];

    const RegistryFactory = await ethers.getContractFactory("SchemaRegistry");
    registry = await RegistryFactory.deploy();
    await registry.waitForDeployment();

    const MockResolverFactory = await ethers.getContractFactory("MockResolver");
    validResolver = await MockResolverFactory.deploy(true);
    await validResolver.waitForDeployment();
  });

  // --- Positive baseline: valid resolver is accepted ---

  it("accepts a valid IResolver implementation", async function () {
    const resolverAddr = await validResolver.getAddress();
    await expect(
      registry.connect(authority).register(DEFINITION, resolverAddr, REVOCABLE)
    ).to.not.be.reverted;
  });

  it("accepts address(0) as no resolver", async function () {
    await expect(
      registry.connect(authority).register(DEFINITION, ethers.ZeroAddress, REVOCABLE)
    ).to.not.be.reverted;
  });

  // --- Negative: various non-conforming addresses ---

  it("rejects an EOA address as resolver", async function () {
    // EOAs have no code, so supportsInterface call will fail
    for (const signer of signers.slice(1, 6)) {
      await expect(
        registry.connect(authority).register(
          `schema-eoa-${signer.address}`,
          signer.address,
          REVOCABLE
        )
      ).to.be.reverted;
    }
  });

  it("rejects a contract that has no supportsInterface function (BadResolver)", async function () {
    const BadFactory = await ethers.getContractFactory("BadResolver");
    const bad = await BadFactory.deploy();
    await bad.waitForDeployment();

    await expect(
      registry.connect(authority).register(DEFINITION, await bad.getAddress(), REVOCABLE)
    ).to.be.revertedWithCustomError(registry, "InvalidResolver");
  });

  it("rejects a contract whose supportsInterface returns false for IResolver", async function () {
    const Factory = await ethers.getContractFactory("FalseSupportsInterfaceResolver");
    const resolver = await Factory.deploy();
    await resolver.waitForDeployment();

    await expect(
      registry.connect(authority).register(DEFINITION, await resolver.getAddress(), REVOCABLE)
    ).to.be.revertedWithCustomError(registry, "InvalidResolver");
  });

  it("rejects a contract that only supports ERC-165 but not IResolver", async function () {
    const Factory = await ethers.getContractFactory("PartialResolver");
    const resolver = await Factory.deploy();
    await resolver.waitForDeployment();

    await expect(
      registry.connect(authority).register(DEFINITION, await resolver.getAddress(), REVOCABLE)
    ).to.be.revertedWithCustomError(registry, "InvalidResolver");
  });

  it("rejects a contract whose supportsInterface reverts", async function () {
    const Factory = await ethers.getContractFactory("RevertingSupportsInterfaceResolver");
    const resolver = await Factory.deploy();
    await resolver.waitForDeployment();

    await expect(
      registry.connect(authority).register(DEFINITION, await resolver.getAddress(), REVOCABLE)
    ).to.be.revertedWithCustomError(registry, "InvalidResolver");
  });

  it("rejects an empty contract with no code logic", async function () {
    const Factory = await ethers.getContractFactory("EmptyContract");
    const empty = await Factory.deploy();
    await empty.waitForDeployment();

    await expect(
      registry.connect(authority).register(DEFINITION, await empty.getAddress(), REVOCABLE)
    ).to.be.revertedWithCustomError(registry, "InvalidResolver");
  });

  // --- Property: valid vs invalid is determined solely by supportsInterface ---

  it("for any non-conforming contract, registration reverts regardless of schema params", async function () {
    const BadFactory = await ethers.getContractFactory("BadResolver");
    const bad = await BadFactory.deploy();
    await bad.waitForDeployment();
    const badAddr = await bad.getAddress();

    // Vary definition and revocable flag — all should revert
    const definitions = [
      "string name",
      "uint256 score, address wallet",
      "bool active, bytes32 hash, string label",
      "",
    ];
    const revocableFlags = [true, false];

    for (const def of definitions) {
      for (const rev of revocableFlags) {
        await expect(
          registry.connect(authority).register(def, badAddr, rev)
        ).to.be.revertedWithCustomError(registry, "InvalidResolver");
      }
    }
  });

  it("for a valid resolver, registration succeeds regardless of schema params", async function () {
    const resolverAddr = await validResolver.getAddress();

    const definitions = [
      "string name",
      "uint256 score, address wallet",
      "bool active, bytes32 hash, string label",
      "",
    ];

    for (const def of definitions) {
      // Each unique (def, resolver, revocable) combo produces a unique UID
      await expect(
        registry.connect(authority).register(def, resolverAddr, true)
      ).to.not.be.reverted;
    }
  });

  // --- Property: multiple non-conforming contracts all rejected ---

  it("all non-conforming contract types are rejected consistently", async function () {
    const factories = [
      "BadResolver",
      "FalseSupportsInterfaceResolver",
      "PartialResolver",
      "RevertingSupportsInterfaceResolver",
      "EmptyContract",
    ];

    for (const name of factories) {
      const Factory = await ethers.getContractFactory(name);
      const contract = await Factory.deploy();
      await contract.waitForDeployment();

      await expect(
        registry.connect(authority).register(
          `schema-for-${name}`,
          await contract.getAddress(),
          REVOCABLE
        )
      ).to.be.reverted;
    }
  });

  // --- Edge case: randomly generated addresses (no deployed code) ---

  it("rejects randomly generated addresses with no deployed code", async function () {
    for (let i = 0; i < 20; i++) {
      const randomWallet = ethers.Wallet.createRandom();
      await expect(
        registry.connect(authority).register(
          `schema-random-${i}`,
          randomWallet.address,
          REVOCABLE
        )
      ).to.be.reverted;
    }
  });
});

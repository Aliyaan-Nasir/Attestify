import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import { SchemaRegistry, MockResolver, BadResolver } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("SchemaRegistry", function () {
  let registry: SchemaRegistry;
  let mockResolver: MockResolver;
  let badResolver: BadResolver;
  let owner: SignerWithAddress;
  let authority1: SignerWithAddress;
  let authority2: SignerWithAddress;

  beforeEach(async function () {
    [owner, authority1, authority2] = await ethers.getSigners();

    const SchemaRegistryFactory = await ethers.getContractFactory("SchemaRegistry");
    registry = await SchemaRegistryFactory.deploy();
    await registry.waitForDeployment();

    const MockResolverFactory = await ethers.getContractFactory("MockResolver");
    mockResolver = await MockResolverFactory.deploy(true);
    await mockResolver.waitForDeployment();

    const BadResolverFactory = await ethers.getContractFactory("BadResolver");
    badResolver = await BadResolverFactory.deploy();
    await badResolver.waitForDeployment();
  });

  describe("register", function () {
    it("should register a schema and return a deterministic UID", async function () {
      const definition = "string name, uint256 age";
      const resolver = ethers.ZeroAddress;
      const revocable = true;

      const tx = await registry.connect(authority1).register(definition, resolver, revocable);
      const receipt = await tx.wait();

      // Compute expected UID off-chain
      const expectedUid = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "address", "bool"],
          [definition, resolver, revocable]
        )
      );

      // Check event
      const event = receipt?.logs.find(
        (log) => registry.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "SchemaRegistered"
      );
      expect(event).to.not.be.undefined;

      const parsed = registry.interface.parseLog({ topics: event!.topics as string[], data: event!.data });
      expect(parsed?.args.uid).to.equal(expectedUid);
      expect(parsed?.args.authority).to.equal(authority1.address);
      expect(parsed?.args.resolver).to.equal(resolver);
    });

    it("should store and retrieve the full schema record", async function () {
      const definition = "address wallet, bool verified";
      const resolver = ethers.ZeroAddress;
      const revocable = false;

      const tx = await registry.connect(authority1).register(definition, resolver, revocable);
      await tx.wait();

      const expectedUid = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "address", "bool"],
          [definition, resolver, revocable]
        )
      );

      const record = await registry.getSchema(expectedUid);
      expect(record.uid).to.equal(expectedUid);
      expect(record.definition).to.equal(definition);
      expect(record.authority).to.equal(authority1.address);
      expect(record.resolver).to.equal(resolver);
      expect(record.revocable).to.equal(revocable);
      expect(record.timestamp).to.be.greaterThan(0);
    });

    it("should register a schema with a valid resolver", async function () {
      const definition = "string credential";
      const resolverAddr = await mockResolver.getAddress();
      const revocable = true;

      const tx = await registry.connect(authority1).register(definition, resolverAddr, revocable);
      await tx.wait();

      const expectedUid = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "address", "bool"],
          [definition, resolverAddr, revocable]
        )
      );

      const record = await registry.getSchema(expectedUid);
      expect(record.resolver).to.equal(resolverAddr);
    });

    it("should reject duplicate schema registration", async function () {
      const definition = "string name, uint256 age";
      const resolver = ethers.ZeroAddress;
      const revocable = true;

      await registry.connect(authority1).register(definition, resolver, revocable);

      // Same definition, resolver, revocable → same UID → should revert
      await expect(
        registry.connect(authority2).register(definition, resolver, revocable)
      ).to.be.revertedWithCustomError(registry, "SchemaAlreadyExists");
    });

    it("should allow same definition with different resolver (different UID)", async function () {
      const definition = "string name";
      const revocable = true;

      await registry.connect(authority1).register(definition, ethers.ZeroAddress, revocable);

      const resolverAddr = await mockResolver.getAddress();
      await expect(
        registry.connect(authority1).register(definition, resolverAddr, revocable)
      ).to.not.be.reverted;
    });

    it("should allow same definition with different revocable flag", async function () {
      const definition = "string name";
      const resolver = ethers.ZeroAddress;

      await registry.connect(authority1).register(definition, resolver, true);
      await expect(
        registry.connect(authority1).register(definition, resolver, false)
      ).to.not.be.reverted;
    });

    it("should reject an invalid resolver (no supportsInterface)", async function () {
      const definition = "string name";
      const badAddr = await badResolver.getAddress();

      await expect(
        registry.connect(authority1).register(definition, badAddr, true)
      ).to.be.revertedWithCustomError(registry, "InvalidResolver");
    });

    it("should reject a resolver at an EOA address", async function () {
      const definition = "string name";
      // authority2 is an EOA, not a contract — should revert
      await expect(
        registry.connect(authority1).register(definition, authority2.address, true)
      ).to.be.reverted;
    });
  });

  describe("getSchema", function () {
    it("should revert for a non-existent schema UID", async function () {
      const fakeUid = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));
      await expect(
        registry.getSchema(fakeUid)
      ).to.be.revertedWithCustomError(registry, "SchemaNotFound");
    });
  });

  describe("Property Tests", function () {
    // Property 2: Schema UID determinism
    it("Property 2: UID should equal keccak256(abi.encode(definition, resolver, revocable))", async function () {
      const testCases = [
        { def: "string name", resolver: ethers.ZeroAddress, revocable: true },
        { def: "uint256 score, address wallet", resolver: ethers.ZeroAddress, revocable: false },
        { def: "bool active", resolver: await mockResolver.getAddress(), revocable: true },
        { def: "", resolver: ethers.ZeroAddress, revocable: true },
      ];

      for (const tc of testCases) {
        const tx = await registry.connect(authority1).register(tc.def, tc.resolver, tc.revocable);
        const receipt = await tx.wait();

        const expectedUid = ethers.keccak256(
          ethers.AbiCoder.defaultAbiCoder().encode(
            ["string", "address", "bool"],
            [tc.def, tc.resolver, tc.revocable]
          )
        );

        const event = receipt?.logs.find(
          (log) => registry.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "SchemaRegistered"
        );
        const parsed = registry.interface.parseLog({ topics: event!.topics as string[], data: event!.data });
        expect(parsed?.args.uid).to.equal(expectedUid);
      }
    });

    // Property 1: Schema registration round-trip
    it("Property 1: register then getSchema should return matching fields", async function () {
      const definitions = [
        "string name, uint256 age",
        "address wallet, bool verified, bytes32 hash",
        "uint8 level",
      ];

      for (const def of definitions) {
        const resolver = ethers.ZeroAddress;
        const revocable = true;

        const tx = await registry.connect(authority1).register(def, resolver, revocable);
        await tx.wait();

        const uid = ethers.keccak256(
          ethers.AbiCoder.defaultAbiCoder().encode(
            ["string", "address", "bool"],
            [def, resolver, revocable]
          )
        );

        const record = await registry.getSchema(uid);
        expect(record.definition).to.equal(def);
        expect(record.authority).to.equal(authority1.address);
        expect(record.resolver).to.equal(resolver);
        expect(record.revocable).to.equal(revocable);
      }
    });

    // Property 3: Duplicate schema rejection
    it("Property 3: re-registering same schema should revert", async function () {
      const def = "string credential, uint256 issuedAt";
      await registry.connect(authority1).register(def, ethers.ZeroAddress, true);

      // Same params from different caller → same UID → revert
      await expect(
        registry.connect(authority2).register(def, ethers.ZeroAddress, true)
      ).to.be.revertedWithCustomError(registry, "SchemaAlreadyExists");
    });

    // Property 4: Schema event correctness
    it("Property 4: SchemaRegistered event should contain correct data", async function () {
      const def = "string name";
      const resolver = ethers.ZeroAddress;
      const revocable = true;

      await expect(
        registry.connect(authority1).register(def, resolver, revocable)
      ).to.emit(registry, "SchemaRegistered").withArgs(
        ethers.keccak256(
          ethers.AbiCoder.defaultAbiCoder().encode(
            ["string", "address", "bool"],
            [def, resolver, revocable]
          )
        ),
        authority1.address,
        resolver
      );
    });
  });
});

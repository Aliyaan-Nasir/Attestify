import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import {
  AttestationService,
  SchemaRegistry,
  MockResolver,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("AttestationService", function () {
  let registry: SchemaRegistry;
  let service: AttestationService;
  let mockResolver: MockResolver;
  let owner: SignerWithAddress;
  let attester1: SignerWithAddress;
  let attester2: SignerWithAddress;
  let subject1: SignerWithAddress;

  // Common schema params
  const schemaDef = "string name, uint256 age";
  const noResolver = ethers.ZeroAddress;
  const revocable = true;

  // Helper to register a schema and return its UID
  async function registerSchema(
    def: string = schemaDef,
    resolver: string = noResolver,
    rev: boolean = revocable,
    signer: SignerWithAddress = attester1
  ): Promise<string> {
    await registry.connect(signer).register(def, resolver, rev);
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "address", "bool"],
        [def, resolver, rev]
      )
    );
  }

  // Helper to compute expected attestation UID
  function computeAttestationUid(
    schemaUid: string,
    subject: string,
    attester: string,
    data: string,
    nonce: number
  ): string {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "bytes", "uint256"],
        [schemaUid, subject, attester, data, nonce]
      )
    );
  }

  beforeEach(async function () {
    [owner, attester1, attester2, subject1] = await ethers.getSigners();

    const SchemaRegistryFactory =
      await ethers.getContractFactory("SchemaRegistry");
    registry = await SchemaRegistryFactory.deploy();
    await registry.waitForDeployment();

    const AttestationServiceFactory =
      await ethers.getContractFactory("AttestationService");
    service = await AttestationServiceFactory.deploy(
      await registry.getAddress()
    );
    await service.waitForDeployment();

    const MockResolverFactory =
      await ethers.getContractFactory("MockResolver");
    mockResolver = await MockResolverFactory.deploy(true);
    await mockResolver.waitForDeployment();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Unit Tests — Attestation Creation
  // ═══════════════════════════════════════════════════════════════════════════

  describe("attest", function () {
    it("should create an attestation and return a deterministic UID", async function () {
      const schemaUid = await registerSchema();
      const data = ethers.toUtf8Bytes("test data");
      const dataHex = ethers.hexlify(data);

      const tx = await service
        .connect(attester1)
        .attest(schemaUid, subject1.address, dataHex, 0);
      const receipt = await tx.wait();

      const expectedUid = computeAttestationUid(
        schemaUid,
        subject1.address,
        attester1.address,
        dataHex,
        0
      );

      // Check event
      const event = receipt?.logs.find(
        (log) =>
          service.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          })?.name === "AttestationCreated"
      );
      expect(event).to.not.be.undefined;
      const parsed = service.interface.parseLog({
        topics: event!.topics as string[],
        data: event!.data,
      });
      expect(parsed?.args.uid).to.equal(expectedUid);
    });

    it("should store and retrieve the full attestation record", async function () {
      const schemaUid = await registerSchema();
      const dataHex = ethers.hexlify(ethers.toUtf8Bytes("hello"));

      const tx = await service
        .connect(attester1)
        .attest(schemaUid, subject1.address, dataHex, 0);
      await tx.wait();

      const expectedUid = computeAttestationUid(
        schemaUid,
        subject1.address,
        attester1.address,
        dataHex,
        0
      );

      const record = await service.getAttestation(expectedUid);
      expect(record.uid).to.equal(expectedUid);
      expect(record.schemaUid).to.equal(schemaUid);
      expect(record.attester).to.equal(attester1.address);
      expect(record.subject).to.equal(subject1.address);
      expect(ethers.hexlify(record.data)).to.equal(dataHex);
      expect(record.expirationTime).to.equal(0);
      expect(record.revoked).to.equal(false);
      expect(record.revocationTime).to.equal(0);
      expect(record.nonce).to.equal(0);
      expect(record.timestamp).to.be.greaterThan(0);
    });

    it("should increment nonce for successive attestations by the same attester", async function () {
      const schemaUid = await registerSchema();
      const data1 = ethers.hexlify(ethers.toUtf8Bytes("first"));
      const data2 = ethers.hexlify(ethers.toUtf8Bytes("second"));

      await service
        .connect(attester1)
        .attest(schemaUid, subject1.address, data1, 0);
      await service
        .connect(attester1)
        .attest(schemaUid, subject1.address, data2, 0);

      const uid1 = computeAttestationUid(
        schemaUid,
        subject1.address,
        attester1.address,
        data1,
        0
      );
      const uid2 = computeAttestationUid(
        schemaUid,
        subject1.address,
        attester1.address,
        data2,
        1
      );

      const record1 = await service.getAttestation(uid1);
      const record2 = await service.getAttestation(uid2);
      expect(record1.nonce).to.equal(0);
      expect(record2.nonce).to.equal(1);
    });

    it("should store expiration time when provided", async function () {
      const schemaUid = await registerSchema();
      const dataHex = ethers.hexlify(ethers.toUtf8Bytes("expiring"));
      const futureTime = Math.floor(Date.now() / 1000) + 86400; // +1 day

      await service
        .connect(attester1)
        .attest(schemaUid, subject1.address, dataHex, futureTime);

      const uid = computeAttestationUid(
        schemaUid,
        subject1.address,
        attester1.address,
        dataHex,
        0
      );
      const record = await service.getAttestation(uid);
      expect(record.expirationTime).to.equal(futureTime);
    });

    it("should revert when schema does not exist", async function () {
      const fakeSchemaUid = ethers.keccak256(ethers.toUtf8Bytes("fake"));
      await expect(
        service
          .connect(attester1)
          .attest(fakeSchemaUid, subject1.address, "0x", 0)
      ).to.be.revertedWithCustomError(registry, "SchemaNotFound");
    });

    it("should revert when expiration time is in the past", async function () {
      const schemaUid = await registerSchema();
      const pastTime = 1; // way in the past

      await expect(
        service
          .connect(attester1)
          .attest(schemaUid, subject1.address, "0x", pastTime)
      ).to.be.revertedWithCustomError(service, "InvalidExpirationTime");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Unit Tests — Revocation
  // ═══════════════════════════════════════════════════════════════════════════

  describe("revoke", function () {
    let schemaUid: string;
    let attestationUid: string;
    const dataHex = ethers.hexlify(ethers.toUtf8Bytes("revoke-test"));

    beforeEach(async function () {
      schemaUid = await registerSchema();
      await service
        .connect(attester1)
        .attest(schemaUid, subject1.address, dataHex, 0);
      attestationUid = computeAttestationUid(
        schemaUid,
        subject1.address,
        attester1.address,
        dataHex,
        0
      );
    });

    it("should revoke an attestation successfully", async function () {
      await service.connect(attester1).revoke(attestationUid);

      const record = await service.getAttestation(attestationUid);
      expect(record.revoked).to.equal(true);
      expect(record.revocationTime).to.be.greaterThan(0);
    });

    it("should emit AttestationRevoked event", async function () {
      await expect(service.connect(attester1).revoke(attestationUid))
        .to.emit(service, "AttestationRevoked")
        .withArgs(attestationUid, attester1.address);
    });

    it("should revert when attestation does not exist", async function () {
      const fakeUid = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));
      await expect(
        service.connect(attester1).revoke(fakeUid)
      ).to.be.revertedWithCustomError(service, "AttestationNotFound");
    });

    it("should revert when caller is not the original attester", async function () {
      await expect(
        service.connect(attester2).revoke(attestationUid)
      ).to.be.revertedWithCustomError(service, "UnauthorizedRevoker");
    });

    it("should revert when attestation is already revoked", async function () {
      await service.connect(attester1).revoke(attestationUid);
      await expect(
        service.connect(attester1).revoke(attestationUid)
      ).to.be.revertedWithCustomError(service, "AttestationAlreadyRevoked");
    });

    it("should revert when schema is not revocable", async function () {
      // Register a non-revocable schema
      const nonRevSchemaUid = await registerSchema(
        "string nonrev",
        noResolver,
        false
      );
      const data = ethers.hexlify(ethers.toUtf8Bytes("nonrev-data"));
      await service
        .connect(attester1)
        .attest(nonRevSchemaUid, subject1.address, data, 0);
      const uid = computeAttestationUid(
        nonRevSchemaUid,
        subject1.address,
        attester1.address,
        data,
        1 // nonce is 1 because attester1 already attested once in beforeEach
      );

      await expect(
        service.connect(attester1).revoke(uid)
      ).to.be.revertedWithCustomError(service, "SchemaNotRevocable");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Unit Tests — Resolver Integration
  // ═══════════════════════════════════════════════════════════════════════════

  describe("resolver integration", function () {
    it("should call resolver onAttest and succeed when allowed", async function () {
      const resolverAddr = await mockResolver.getAddress();
      const schemaUid = await registerSchema(
        "string gated",
        resolverAddr,
        true
      );
      const dataHex = ethers.hexlify(ethers.toUtf8Bytes("resolver-ok"));

      await expect(
        service
          .connect(attester1)
          .attest(schemaUid, subject1.address, dataHex, 0)
      ).to.not.be.reverted;
    });

    it("should revert when resolver onAttest returns false", async function () {
      await mockResolver.setShouldAllow(false);
      const resolverAddr = await mockResolver.getAddress();
      const schemaUid = await registerSchema(
        "string rejected",
        resolverAddr,
        true
      );
      const dataHex = ethers.hexlify(ethers.toUtf8Bytes("resolver-reject"));

      await expect(
        service
          .connect(attester1)
          .attest(schemaUid, subject1.address, dataHex, 0)
      ).to.be.revertedWithCustomError(service, "ResolverRejected");
    });

    it("should call resolver onRevoke and succeed when allowed", async function () {
      const resolverAddr = await mockResolver.getAddress();
      const schemaUid = await registerSchema(
        "string revoke-gated",
        resolverAddr,
        true
      );
      const dataHex = ethers.hexlify(ethers.toUtf8Bytes("revoke-resolver"));

      await service
        .connect(attester1)
        .attest(schemaUid, subject1.address, dataHex, 0);
      const uid = computeAttestationUid(
        schemaUid,
        subject1.address,
        attester1.address,
        dataHex,
        0
      );

      await expect(service.connect(attester1).revoke(uid)).to.not.be.reverted;
    });

    it("should revert when resolver onRevoke returns false", async function () {
      const resolverAddr = await mockResolver.getAddress();
      const schemaUid = await registerSchema(
        "string revoke-reject",
        resolverAddr,
        true
      );
      const dataHex = ethers.hexlify(
        ethers.toUtf8Bytes("revoke-resolver-reject")
      );

      await service
        .connect(attester1)
        .attest(schemaUid, subject1.address, dataHex, 0);
      const uid = computeAttestationUid(
        schemaUid,
        subject1.address,
        attester1.address,
        dataHex,
        0
      );

      // Now set resolver to reject
      await mockResolver.setShouldAllow(false);

      await expect(
        service.connect(attester1).revoke(uid)
      ).to.be.revertedWithCustomError(service, "ResolverRejected");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Unit Tests — Authority Management
  // ═══════════════════════════════════════════════════════════════════════════

  describe("authority management", function () {
    it("should register an authority", async function () {
      await service
        .connect(attester1)
        .registerAuthority("Authority One");

      const record = await service.getAuthority(attester1.address);
      expect(record.addr).to.equal(attester1.address);
      expect(record.metadata).to.equal("Authority One");
      expect(record.isVerified).to.equal(false);
      expect(record.registeredAt).to.be.greaterThan(0);
    });

    it("should emit AuthorityRegistered event", async function () {
      await expect(
        service.connect(attester1).registerAuthority("Meta")
      )
        .to.emit(service, "AuthorityRegistered")
        .withArgs(attester1.address);
    });

    it("should revert getAuthority for unregistered address", async function () {
      await expect(
        service.getAuthority(attester2.address)
      ).to.be.revertedWithCustomError(service, "AuthorityNotFound");
    });

    it("should allow owner to verify an authority", async function () {
      await service.connect(attester1).registerAuthority("Meta");
      await service.connect(owner).setAuthorityVerification(attester1.address, true);

      const record = await service.getAuthority(attester1.address);
      expect(record.isVerified).to.equal(true);
    });

    it("should allow owner to unverify an authority", async function () {
      await service.connect(attester1).registerAuthority("Meta");
      await service.connect(owner).setAuthorityVerification(attester1.address, true);
      await service.connect(owner).setAuthorityVerification(attester1.address, false);

      const record = await service.getAuthority(attester1.address);
      expect(record.isVerified).to.equal(false);
    });

    it("should revert setAuthorityVerification from non-owner", async function () {
      await service.connect(attester1).registerAuthority("Meta");
      await expect(
        service
          .connect(attester2)
          .setAuthorityVerification(attester1.address, true)
      ).to.be.revertedWithCustomError(service, "Unauthorized");
    });

    it("should revert setAuthorityVerification for unregistered authority", async function () {
      await expect(
        service
          .connect(owner)
          .setAuthorityVerification(attester2.address, true)
      ).to.be.revertedWithCustomError(service, "AuthorityNotFound");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Property Tests — Attestation UID (Properties 5, 6, 7)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Property Tests — Attestation UID", function () {
    /**
     * Property 6: Attestation UID determinism
     * For any valid combination of schema UID, subject, attester, data, and nonce,
     * the UID returned by attest should equal keccak256(abi.encode(schemaUid, subject, attester, data, nonce)).
     *
     * **Validates: Requirements 23.1, 23.3**
     */
    it("Property 6: UID should equal keccak256(abi.encode(schemaUid, subject, attester, data, nonce))", async function () {
      const testCases = [
        { data: "0x", desc: "empty data" },
        { data: ethers.hexlify(ethers.toUtf8Bytes("hello")), desc: "simple string" },
        { data: ethers.hexlify(ethers.randomBytes(64)), desc: "random 64 bytes" },
        { data: ethers.hexlify(ethers.randomBytes(256)), desc: "random 256 bytes" },
      ];

      const schemaUid = await registerSchema();

      for (const tc of testCases) {
        const tx = await service
          .connect(attester1)
          .attest(schemaUid, subject1.address, tc.data, 0);
        const receipt = await tx.wait();

        const event = receipt?.logs.find(
          (log) =>
            service.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            })?.name === "AttestationCreated"
        );
        const parsed = service.interface.parseLog({
          topics: event!.topics as string[],
          data: event!.data,
        });

        // Get the nonce from the stored record
        const record = await service.getAttestation(parsed?.args.uid);
        const expectedUid = computeAttestationUid(
          schemaUid,
          subject1.address,
          attester1.address,
          tc.data,
          Number(record.nonce)
        );

        expect(parsed?.args.uid).to.equal(expectedUid);
      }
    });

    /**
     * Property 7: Attestation UID uniqueness
     * For any two distinct tuples of (schemaUid, subject, attester, data, nonce),
     * the computed UIDs should be different.
     *
     * **Validates: Requirements 23.2**
     */
    it("Property 7: different attestation parameters should produce different UIDs", async function () {
      const schemaUid = await registerSchema();
      const uids: Set<string> = new Set();

      // Same attester, same subject, different data → different UIDs (different nonces too)
      const dataValues = [
        ethers.hexlify(ethers.toUtf8Bytes("a")),
        ethers.hexlify(ethers.toUtf8Bytes("b")),
        ethers.hexlify(ethers.toUtf8Bytes("c")),
      ];

      for (const data of dataValues) {
        const tx = await service
          .connect(attester1)
          .attest(schemaUid, subject1.address, data, 0);
        const receipt = await tx.wait();
        const event = receipt?.logs.find(
          (log) =>
            service.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            })?.name === "AttestationCreated"
        );
        const parsed = service.interface.parseLog({
          topics: event!.topics as string[],
          data: event!.data,
        });
        uids.add(parsed?.args.uid);
      }

      // Different attester, same data
      const tx = await service
        .connect(attester2)
        .attest(schemaUid, subject1.address, dataValues[0], 0);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log) =>
          service.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          })?.name === "AttestationCreated"
      );
      const parsed = service.interface.parseLog({
        topics: event!.topics as string[],
        data: event!.data,
      });
      uids.add(parsed?.args.uid);

      // All UIDs should be unique
      expect(uids.size).to.equal(4);
    });

    /**
     * Property 5: Attestation creation round-trip
     * For any valid attestation parameters, creating then fetching should return matching fields.
     *
     * **Validates: Requirements 3.1, 3.2, 3.5, 5.1**
     */
    it("Property 5: create then fetch should return matching fields", async function () {
      const schemaUid = await registerSchema();
      const futureTime = Math.floor(Date.now() / 1000) + 86400;

      const testCases = [
        { data: "0x", expiration: 0, desc: "empty data, no expiration" },
        {
          data: ethers.hexlify(ethers.toUtf8Bytes("round-trip")),
          expiration: futureTime,
          desc: "with data and expiration",
        },
        {
          data: ethers.hexlify(ethers.randomBytes(128)),
          expiration: 0,
          desc: "random data, no expiration",
        },
      ];

      for (const tc of testCases) {
        const tx = await service
          .connect(attester1)
          .attest(schemaUid, subject1.address, tc.data, tc.expiration);
        const receipt = await tx.wait();

        const event = receipt?.logs.find(
          (log) =>
            service.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            })?.name === "AttestationCreated"
        );
        const parsed = service.interface.parseLog({
          topics: event!.topics as string[],
          data: event!.data,
        });
        const uid = parsed?.args.uid;

        const record = await service.getAttestation(uid);
        expect(record.schemaUid).to.equal(schemaUid);
        expect(record.attester).to.equal(attester1.address);
        expect(record.subject).to.equal(subject1.address);
        expect(ethers.hexlify(record.data)).to.equal(tc.data);
        expect(record.expirationTime).to.equal(tc.expiration);
        expect(record.revoked).to.equal(false);
        expect(record.revocationTime).to.equal(0);
        expect(record.timestamp).to.be.greaterThan(0);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Property Tests — Revocation Rules (Properties 11–15)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Property Tests — Revocation Rules", function () {
    /**
     * Property 11: Revocation state change
     * For any valid attestation on a revocable schema, when the original attester
     * revokes it, revoked=true and revocationTime is populated.
     *
     * **Validates: Requirements 4.1, 5.2**
     */
    it("Property 11: revocation should set revoked=true and populate revocationTime", async function () {
      const schemaUid = await registerSchema();
      const dataHex = ethers.hexlify(ethers.toUtf8Bytes("prop11"));

      await service
        .connect(attester1)
        .attest(schemaUid, subject1.address, dataHex, 0);
      const uid = computeAttestationUid(
        schemaUid,
        subject1.address,
        attester1.address,
        dataHex,
        0
      );

      // Before revocation
      const before = await service.getAttestation(uid);
      expect(before.revoked).to.equal(false);
      expect(before.revocationTime).to.equal(0);

      // Revoke
      await service.connect(attester1).revoke(uid);

      // After revocation
      const after = await service.getAttestation(uid);
      expect(after.revoked).to.equal(true);
      expect(after.revocationTime).to.be.greaterThan(0);
    });

    /**
     * Property 12: Non-revocable schema prevents revocation
     * For any attestation whose schema has revocable=false, revocation should revert.
     *
     * **Validates: Requirements 4.2**
     */
    it("Property 12: non-revocable schema should prevent revocation", async function () {
      const schemaUid = await registerSchema(
        "string nonrev-prop12",
        noResolver,
        false
      );
      const dataHex = ethers.hexlify(ethers.toUtf8Bytes("prop12"));

      await service
        .connect(attester1)
        .attest(schemaUid, subject1.address, dataHex, 0);
      const uid = computeAttestationUid(
        schemaUid,
        subject1.address,
        attester1.address,
        dataHex,
        0
      );

      await expect(
        service.connect(attester1).revoke(uid)
      ).to.be.revertedWithCustomError(service, "SchemaNotRevocable");
    });

    /**
     * Property 13: Revocation authorization
     * For any attestation, only the original attester can revoke it.
     *
     * **Validates: Requirements 4.3**
     */
    it("Property 13: only original attester can revoke", async function () {
      const schemaUid = await registerSchema();
      const dataHex = ethers.hexlify(ethers.toUtf8Bytes("prop13"));

      await service
        .connect(attester1)
        .attest(schemaUid, subject1.address, dataHex, 0);
      const uid = computeAttestationUid(
        schemaUid,
        subject1.address,
        attester1.address,
        dataHex,
        0
      );

      // attester2 tries to revoke attester1's attestation
      await expect(
        service.connect(attester2).revoke(uid)
      ).to.be.revertedWithCustomError(service, "UnauthorizedRevoker");

      // owner tries to revoke (also not the attester)
      await expect(
        service.connect(owner).revoke(uid)
      ).to.be.revertedWithCustomError(service, "UnauthorizedRevoker");

      // original attester succeeds
      await expect(service.connect(attester1).revoke(uid)).to.not.be.reverted;
    });

    /**
     * Property 14: Double revocation rejection
     * For any already-revoked attestation, revoking again should revert.
     *
     * **Validates: Requirements 4.4**
     */
    it("Property 14: double revocation should revert", async function () {
      const schemaUid = await registerSchema();
      const dataHex = ethers.hexlify(ethers.toUtf8Bytes("prop14"));

      await service
        .connect(attester1)
        .attest(schemaUid, subject1.address, dataHex, 0);
      const uid = computeAttestationUid(
        schemaUid,
        subject1.address,
        attester1.address,
        dataHex,
        0
      );

      await service.connect(attester1).revoke(uid);

      await expect(
        service.connect(attester1).revoke(uid)
      ).to.be.revertedWithCustomError(service, "AttestationAlreadyRevoked");
    });

    /**
     * Property 15: Revocation event correctness
     * For any successful revocation, the emitted event should contain the correct UID and revoker.
     *
     * **Validates: Requirements 4.6**
     */
    it("Property 15: AttestationRevoked event should contain correct data", async function () {
      const schemaUid = await registerSchema();
      const dataHex = ethers.hexlify(ethers.toUtf8Bytes("prop15"));

      await service
        .connect(attester1)
        .attest(schemaUid, subject1.address, dataHex, 0);
      const uid = computeAttestationUid(
        schemaUid,
        subject1.address,
        attester1.address,
        dataHex,
        0
      );

      await expect(service.connect(attester1).revoke(uid))
        .to.emit(service, "AttestationRevoked")
        .withArgs(uid, attester1.address);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Property Tests — Resolver Gating (Properties 9, 10)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Property Tests — Resolver Gating", function () {
    /**
     * Property 9: Resolver gates attestation creation
     * When resolver.onAttest returns false, attestation should revert.
     * When it returns true, attestation should succeed.
     *
     * **Validates: Requirements 3.3, 3.4**
     */
    it("Property 9: resolver should gate attestation creation", async function () {
      const resolverAddr = await mockResolver.getAddress();
      const schemaUid = await registerSchema(
        "string prop9",
        resolverAddr,
        true
      );
      const dataHex = ethers.hexlify(ethers.toUtf8Bytes("prop9"));

      // Resolver allows → should succeed
      await mockResolver.setShouldAllow(true);
      await expect(
        service
          .connect(attester1)
          .attest(schemaUid, subject1.address, dataHex, 0)
      ).to.not.be.reverted;

      // Resolver rejects → should revert
      await mockResolver.setShouldAllow(false);
      await expect(
        service
          .connect(attester1)
          .attest(schemaUid, subject1.address, dataHex, 0)
      ).to.be.revertedWithCustomError(service, "ResolverRejected");
    });

    /**
     * Property 10: Resolver gates revocation
     * When resolver.onRevoke returns false, revocation should revert.
     *
     * **Validates: Requirements 4.5**
     */
    it("Property 10: resolver should gate revocation", async function () {
      const resolverAddr = await mockResolver.getAddress();
      const schemaUid = await registerSchema(
        "string prop10",
        resolverAddr,
        true
      );
      const dataHex = ethers.hexlify(ethers.toUtf8Bytes("prop10"));

      // Create attestation (resolver allows)
      await mockResolver.setShouldAllow(true);
      await service
        .connect(attester1)
        .attest(schemaUid, subject1.address, dataHex, 0);
      const uid = computeAttestationUid(
        schemaUid,
        subject1.address,
        attester1.address,
        dataHex,
        0
      );

      // Resolver rejects revocation
      await mockResolver.setShouldAllow(false);
      await expect(
        service.connect(attester1).revoke(uid)
      ).to.be.revertedWithCustomError(service, "ResolverRejected");

      // Resolver allows revocation
      await mockResolver.setShouldAllow(true);
      await expect(service.connect(attester1).revoke(uid)).to.not.be.reverted;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Property Tests — Authority (Properties 20, 21)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Property Tests — Authority", function () {
    /**
     * Property 20: Authority registration round-trip
     * For any account that registers as an authority with a metadata string,
     * fetching by address should return matching fields with isVerified=false.
     *
     * **Validates: Requirements 7.1, 7.2**
     */
    it("Property 20: register then getAuthority should return matching fields", async function () {
      const testCases = [
        { signer: attester1, metadata: "Authority Alpha" },
        { signer: attester2, metadata: "Authority Beta with longer metadata string" },
        { signer: owner, metadata: "" },
      ];

      for (const tc of testCases) {
        await service.connect(tc.signer).registerAuthority(tc.metadata);

        const record = await service.getAuthority(tc.signer.address);
        expect(record.addr).to.equal(tc.signer.address);
        expect(record.metadata).to.equal(tc.metadata);
        expect(record.isVerified).to.equal(false);
        expect(record.registeredAt).to.be.greaterThan(0);
      }
    });

    /**
     * Property 21: Authority verification toggle
     * The contract admin should be able to set isVerified to true and back to false,
     * and each query should reflect the current state.
     *
     * **Validates: Requirements 7.3**
     */
    it("Property 21: verification toggle should reflect current state", async function () {
      await service.connect(attester1).registerAuthority("Toggle Test");

      // Initially not verified
      let record = await service.getAuthority(attester1.address);
      expect(record.isVerified).to.equal(false);

      // Verify
      await service
        .connect(owner)
        .setAuthorityVerification(attester1.address, true);
      record = await service.getAuthority(attester1.address);
      expect(record.isVerified).to.equal(true);

      // Unverify
      await service
        .connect(owner)
        .setAuthorityVerification(attester1.address, false);
      record = await service.getAuthority(attester1.address);
      expect(record.isVerified).to.equal(false);

      // Re-verify
      await service
        .connect(owner)
        .setAuthorityVerification(attester1.address, true);
      record = await service.getAuthority(attester1.address);
      expect(record.isVerified).to.equal(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Unit Tests — Expiration Check (Stellar parity)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("expiration check", function () {
    it("should revert getAttestation with AttestationExpired when past expiration", async function () {
      const schemaUid = await registerSchema();
      // Use a very near-future expiration so the next block will be past it
      const block = await ethers.provider.getBlock("latest");
      const nearFuture = block!.timestamp + 2;
      const dataHex = ethers.hexlify(ethers.toUtf8Bytes("expiring-soon"));

      await service
        .connect(attester1)
        .attest(schemaUid, subject1.address, dataHex, nearFuture);
      const uid = computeAttestationUid(
        schemaUid,
        subject1.address,
        attester1.address,
        dataHex,
        0
      );

      // Mine blocks to advance time past expiration
      await ethers.provider.send("evm_increaseTime", [10]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        service.getAttestation(uid)
      ).to.be.revertedWithCustomError(service, "AttestationExpired");
    });

    it("should return attestation normally when not expired", async function () {
      const schemaUid = await registerSchema();
      const farFuture = Math.floor(Date.now() / 1000) + 999999;
      const dataHex = ethers.hexlify(ethers.toUtf8Bytes("long-lived"));

      await service
        .connect(attester1)
        .attest(schemaUid, subject1.address, dataHex, farFuture);
      const uid = computeAttestationUid(
        schemaUid,
        subject1.address,
        attester1.address,
        dataHex,
        0
      );

      const record = await service.getAttestation(uid);
      expect(record.uid).to.equal(uid);
      expect(record.expirationTime).to.equal(farFuture);
    });

    it("should return attestation when expirationTime is 0 (no expiration)", async function () {
      const schemaUid = await registerSchema();
      const dataHex = ethers.hexlify(ethers.toUtf8Bytes("forever"));

      await service
        .connect(attester1)
        .attest(schemaUid, subject1.address, dataHex, 0);
      const uid = computeAttestationUid(
        schemaUid,
        subject1.address,
        attester1.address,
        dataHex,
        0
      );

      const record = await service.getAttestation(uid);
      expect(record.uid).to.equal(uid);
      expect(record.expirationTime).to.equal(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Unit Tests — onResolve Post-Hook (Stellar parity)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("onResolve post-hook", function () {
    it("should call onResolve after successful attestation without reverting", async function () {
      const resolverAddr = await mockResolver.getAddress();
      const schemaUid = await registerSchema(
        "string resolve-test",
        resolverAddr,
        true
      );
      const dataHex = ethers.hexlify(ethers.toUtf8Bytes("resolve-attest"));

      // Attestation should succeed and onResolve is called (no-op in mock)
      await expect(
        service
          .connect(attester1)
          .attest(schemaUid, subject1.address, dataHex, 0)
      ).to.not.be.reverted;
    });

    it("should call onResolve after successful revocation without reverting", async function () {
      const resolverAddr = await mockResolver.getAddress();
      const schemaUid = await registerSchema(
        "string resolve-revoke",
        resolverAddr,
        true
      );
      const dataHex = ethers.hexlify(ethers.toUtf8Bytes("resolve-revoke"));

      await service
        .connect(attester1)
        .attest(schemaUid, subject1.address, dataHex, 0);
      const uid = computeAttestationUid(
        schemaUid,
        subject1.address,
        attester1.address,
        dataHex,
        0
      );

      // Revocation should succeed and onResolve is called (no-op in mock)
      await expect(service.connect(attester1).revoke(uid)).to.not.be.reverted;
    });

    it("should not revert attestation if onResolve fails", async function () {
      // Deploy a resolver that reverts on onResolve but allows onAttest
      const RevertingResolverFactory = await ethers.getContractFactory("RevertingOnResolveResolver");
      const revertingResolver = await RevertingResolverFactory.deploy();
      await revertingResolver.waitForDeployment();

      const resolverAddr = await revertingResolver.getAddress();
      const schemaUid = await registerSchema(
        "string revert-resolve",
        resolverAddr,
        true
      );
      const dataHex = ethers.hexlify(ethers.toUtf8Bytes("should-still-work"));

      // Attestation should succeed even though onResolve reverts
      await expect(
        service
          .connect(attester1)
          .attest(schemaUid, subject1.address, dataHex, 0)
      ).to.not.be.reverted;
    });
  });
});

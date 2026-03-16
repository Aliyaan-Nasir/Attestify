import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import {
  AttestationService,
  SchemaRegistry,
  MockResolver,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * End-to-end integration test: full attestation lifecycle.
 *
 * Covers the complete flow:
 *   1. Register a schema on SchemaRegistry
 *   2. Create an attestation on AttestationService referencing that schema
 *   3. Verify the attestation data is correct
 *   4. Revoke the attestation
 *   5. Verify the attestation is now marked as revoked
 *
 * Mirrors the Stellar protocol_attestation_test.rs lifecycle pattern,
 * translated to Hardhat + ethers.js.
 */
describe("Integration: Full Attestation Lifecycle", function () {
  let registry: SchemaRegistry;
  let service: AttestationService;
  let mockResolver: MockResolver;
  let owner: SignerWithAddress;
  let authority: SignerWithAddress;
  let attester: SignerWithAddress;
  let subject: SignerWithAddress;

  beforeEach(async function () {
    [owner, authority, attester, subject] = await ethers.getSigners();

    // Deploy SchemaRegistry
    const SchemaRegistryFactory =
      await ethers.getContractFactory("SchemaRegistry");
    registry = (await SchemaRegistryFactory.deploy()) as unknown as SchemaRegistry;
    await registry.waitForDeployment();

    // Deploy AttestationService (depends on SchemaRegistry)
    const AttestationServiceFactory =
      await ethers.getContractFactory("AttestationService");
    service = (await AttestationServiceFactory.deploy(
      await registry.getAddress()
    )) as unknown as AttestationService;
    await service.waitForDeployment();

    // Deploy MockResolver (allows by default)
    const MockResolverFactory =
      await ethers.getContractFactory("MockResolver");
    mockResolver = (await MockResolverFactory.deploy(true)) as unknown as MockResolver;
    await mockResolver.waitForDeployment();
  });

  // Helper to compute expected schema UID off-chain
  function computeSchemaUid(
    definition: string,
    resolver: string,
    revocable: boolean
  ): string {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "address", "bool"],
        [definition, resolver, revocable]
      )
    );
  }

  // Helper to compute expected attestation UID off-chain
  function computeAttestationUid(
    schemaUid: string,
    subjectAddr: string,
    attesterAddr: string,
    data: string,
    nonce: number
  ): string {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "address", "bytes", "uint256"],
        [schemaUid, subjectAddr, attesterAddr, data, nonce]
      )
    );
  }

  it("should complete the full lifecycle: register → attest → verify → revoke → verify revoked", async function () {
    // ─── Step 1: Register a schema ───────────────────────────────────────
    const definition = "string name, uint256 score, bool active";
    const resolver = ethers.ZeroAddress;
    const revocable = true;

    const registerTx = await registry
      .connect(authority)
      .register(definition, resolver, revocable);
    const registerReceipt = await registerTx.wait();

    // Verify SchemaRegistered event
    const schemaEvent = registerReceipt?.logs.find(
      (log) =>
        registry.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        })?.name === "SchemaRegistered"
    );
    expect(schemaEvent).to.not.be.undefined;

    const schemaParsed = registry.interface.parseLog({
      topics: schemaEvent!.topics as string[],
      data: schemaEvent!.data,
    });
    const schemaUid = schemaParsed?.args.uid;

    // Verify UID matches off-chain computation
    const expectedSchemaUid = computeSchemaUid(definition, resolver, revocable);
    expect(schemaUid).to.equal(expectedSchemaUid);

    // Verify schema record is stored correctly
    const schemaRecord = await registry.getSchema(schemaUid);
    expect(schemaRecord.uid).to.equal(schemaUid);
    expect(schemaRecord.definition).to.equal(definition);
    expect(schemaRecord.authority).to.equal(authority.address);
    expect(schemaRecord.resolver).to.equal(resolver);
    expect(schemaRecord.revocable).to.equal(revocable);
    expect(schemaRecord.timestamp).to.be.greaterThan(0);

    // ─── Step 2: Create an attestation ───────────────────────────────────
    const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
      ["string", "uint256", "bool"],
      ["Alice", 95, true]
    );
    const expirationTime = 0; // no expiration

    const attestTx = await service
      .connect(attester)
      .attest(schemaUid, subject.address, attestationData, expirationTime);
    const attestReceipt = await attestTx.wait();

    // Verify AttestationCreated event
    const attestEvent = attestReceipt?.logs.find(
      (log) =>
        service.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        })?.name === "AttestationCreated"
    );
    expect(attestEvent).to.not.be.undefined;

    const attestParsed = service.interface.parseLog({
      topics: attestEvent!.topics as string[],
      data: attestEvent!.data,
    });
    const attestationUid = attestParsed?.args.uid;

    // Verify UID matches off-chain computation (nonce = 0 for first attestation)
    const expectedAttestationUid = computeAttestationUid(
      schemaUid,
      subject.address,
      attester.address,
      attestationData,
      0
    );
    expect(attestationUid).to.equal(expectedAttestationUid);

    // Verify event fields
    expect(attestParsed?.args.schemaUid).to.equal(schemaUid);
    expect(attestParsed?.args.attester).to.equal(attester.address);
    expect(attestParsed?.args.subject).to.equal(subject.address);

    // ─── Step 3: Verify the attestation data ─────────────────────────────
    const record = await service.getAttestation(attestationUid);
    expect(record.uid).to.equal(attestationUid);
    expect(record.schemaUid).to.equal(schemaUid);
    expect(record.attester).to.equal(attester.address);
    expect(record.subject).to.equal(subject.address);
    expect(ethers.hexlify(record.data)).to.equal(
      ethers.hexlify(attestationData)
    );
    expect(record.expirationTime).to.equal(0);
    expect(record.revoked).to.equal(false);
    expect(record.revocationTime).to.equal(0);
    expect(record.nonce).to.equal(0);
    expect(record.timestamp).to.be.greaterThan(0);

    // ─── Step 4: Revoke the attestation ──────────────────────────────────
    const revokeTx = await service.connect(attester).revoke(attestationUid);
    const revokeReceipt = await revokeTx.wait();

    // Verify AttestationRevoked event
    const revokeEvent = revokeReceipt?.logs.find(
      (log) =>
        service.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        })?.name === "AttestationRevoked"
    );
    expect(revokeEvent).to.not.be.undefined;

    const revokeParsed = service.interface.parseLog({
      topics: revokeEvent!.topics as string[],
      data: revokeEvent!.data,
    });
    expect(revokeParsed?.args.uid).to.equal(attestationUid);
    expect(revokeParsed?.args.revoker).to.equal(attester.address);

    // ─── Step 5: Verify the attestation is now revoked ───────────────────
    const revokedRecord = await service.getAttestation(attestationUid);
    expect(revokedRecord.uid).to.equal(attestationUid);
    expect(revokedRecord.revoked).to.equal(true);
    expect(revokedRecord.revocationTime).to.be.greaterThan(0);
    // Original fields should remain unchanged
    expect(revokedRecord.schemaUid).to.equal(schemaUid);
    expect(revokedRecord.attester).to.equal(attester.address);
    expect(revokedRecord.subject).to.equal(subject.address);
    expect(ethers.hexlify(revokedRecord.data)).to.equal(
      ethers.hexlify(attestationData)
    );
    expect(revokedRecord.nonce).to.equal(0);

    // Double revocation should fail
    await expect(
      service.connect(attester).revoke(attestationUid)
    ).to.be.revertedWithCustomError(service, "AttestationAlreadyRevoked");
  });

  it("should complete the lifecycle with a resolver attached", async function () {
    // ─── Step 1: Register schema with resolver ───────────────────────────
    const definition = "address wallet, bool kyc";
    const resolverAddr = await mockResolver.getAddress();
    const revocable = true;

    const registerTx = await registry
      .connect(authority)
      .register(definition, resolverAddr, revocable);
    await registerTx.wait();

    const schemaUid = computeSchemaUid(definition, resolverAddr, revocable);
    const schemaRecord = await registry.getSchema(schemaUid);
    expect(schemaRecord.resolver).to.equal(resolverAddr);

    // ─── Step 2: Create attestation (resolver allows) ────────────────────
    const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "bool"],
      [subject.address, true]
    );

    const attestTx = await service
      .connect(attester)
      .attest(schemaUid, subject.address, attestationData, 0);
    const attestReceipt = await attestTx.wait();

    const attestEvent = attestReceipt?.logs.find(
      (log) =>
        service.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        })?.name === "AttestationCreated"
    );
    const attestParsed = service.interface.parseLog({
      topics: attestEvent!.topics as string[],
      data: attestEvent!.data,
    });
    const attestationUid = attestParsed?.args.uid;

    // ─── Step 3: Verify attestation ──────────────────────────────────────
    const record = await service.getAttestation(attestationUid);
    expect(record.revoked).to.equal(false);
    expect(record.schemaUid).to.equal(schemaUid);

    // ─── Step 4: Revoke (resolver allows) ────────────────────────────────
    await service.connect(attester).revoke(attestationUid);

    // ─── Step 5: Verify revoked ──────────────────────────────────────────
    const revokedRecord = await service.getAttestation(attestationUid);
    expect(revokedRecord.revoked).to.equal(true);
    expect(revokedRecord.revocationTime).to.be.greaterThan(0);
  });

  it("should reject attestation when resolver denies it", async function () {
    // Register schema with resolver
    const definition = "string gated";
    const resolverAddr = await mockResolver.getAddress();
    await registry.connect(authority).register(definition, resolverAddr, true);
    const schemaUid = computeSchemaUid(definition, resolverAddr, true);

    // Set resolver to reject
    await mockResolver.setShouldAllow(false);

    // Attestation should be rejected
    await expect(
      service
        .connect(attester)
        .attest(schemaUid, subject.address, "0x", 0)
    ).to.be.revertedWithCustomError(service, "ResolverRejected");
  });

  it("should reject revocation when resolver denies it", async function () {
    // Register schema with resolver
    const definition = "string revoke-gated";
    const resolverAddr = await mockResolver.getAddress();
    await registry.connect(authority).register(definition, resolverAddr, true);
    const schemaUid = computeSchemaUid(definition, resolverAddr, true);

    // Create attestation (resolver allows)
    const dataHex = ethers.hexlify(ethers.toUtf8Bytes("data"));
    await service.connect(attester).attest(schemaUid, subject.address, dataHex, 0);
    const attestationUid = computeAttestationUid(
      schemaUid,
      subject.address,
      attester.address,
      dataHex,
      0
    );

    // Set resolver to reject revocation
    await mockResolver.setShouldAllow(false);

    await expect(
      service.connect(attester).revoke(attestationUid)
    ).to.be.revertedWithCustomError(service, "ResolverRejected");
  });

  it("should prevent revocation on non-revocable schema", async function () {
    // Register non-revocable schema
    const definition = "string permanent";
    await registry.connect(authority).register(definition, ethers.ZeroAddress, false);
    const schemaUid = computeSchemaUid(definition, ethers.ZeroAddress, false);

    // Create attestation
    const dataHex = ethers.hexlify(ethers.toUtf8Bytes("permanent-data"));
    await service.connect(attester).attest(schemaUid, subject.address, dataHex, 0);
    const attestationUid = computeAttestationUid(
      schemaUid,
      subject.address,
      attester.address,
      dataHex,
      0
    );

    // Verify attestation exists
    const record = await service.getAttestation(attestationUid);
    expect(record.revoked).to.equal(false);

    // Revocation should fail
    await expect(
      service.connect(attester).revoke(attestationUid)
    ).to.be.revertedWithCustomError(service, "SchemaNotRevocable");
  });

  it("should prevent unauthorized revocation", async function () {
    // Register schema and create attestation
    const definition = "string auth-test";
    await registry.connect(authority).register(definition, ethers.ZeroAddress, true);
    const schemaUid = computeSchemaUid(definition, ethers.ZeroAddress, true);

    const dataHex = ethers.hexlify(ethers.toUtf8Bytes("auth-data"));
    await service.connect(attester).attest(schemaUid, subject.address, dataHex, 0);
    const attestationUid = computeAttestationUid(
      schemaUid,
      subject.address,
      attester.address,
      dataHex,
      0
    );

    // Non-attester tries to revoke
    await expect(
      service.connect(subject).revoke(attestationUid)
    ).to.be.revertedWithCustomError(service, "UnauthorizedRevoker");

    // Original attester can revoke
    await expect(service.connect(attester).revoke(attestationUid)).to.not.be
      .reverted;
  });

  it("should handle multiple attestations under the same schema", async function () {
    // Register schema
    const definition = "string credential, uint256 level";
    await registry.connect(authority).register(definition, ethers.ZeroAddress, true);
    const schemaUid = computeSchemaUid(definition, ethers.ZeroAddress, true);

    // Create multiple attestations from the same attester
    const data1 = ethers.AbiCoder.defaultAbiCoder().encode(
      ["string", "uint256"],
      ["Gold", 3]
    );
    const data2 = ethers.AbiCoder.defaultAbiCoder().encode(
      ["string", "uint256"],
      ["Silver", 2]
    );

    await service.connect(attester).attest(schemaUid, subject.address, data1, 0);
    await service.connect(attester).attest(schemaUid, subject.address, data2, 0);

    const uid1 = computeAttestationUid(schemaUid, subject.address, attester.address, data1, 0);
    const uid2 = computeAttestationUid(schemaUid, subject.address, attester.address, data2, 1);

    // Both should exist and be distinct
    const record1 = await service.getAttestation(uid1);
    const record2 = await service.getAttestation(uid2);
    expect(record1.nonce).to.equal(0);
    expect(record2.nonce).to.equal(1);
    expect(uid1).to.not.equal(uid2);

    // Revoke only the first
    await service.connect(attester).revoke(uid1);

    const revoked1 = await service.getAttestation(uid1);
    const active2 = await service.getAttestation(uid2);
    expect(revoked1.revoked).to.equal(true);
    expect(active2.revoked).to.equal(false);
  });

  it("should integrate authority registration with the attestation lifecycle", async function () {
    // ─── Register as authority ────────────────────────────────────────────
    await service.connect(authority).registerAuthority("Trusted Issuer Inc.");
    const authorityRecord = await service.getAuthority(authority.address);
    expect(authorityRecord.metadata).to.equal("Trusted Issuer Inc.");
    expect(authorityRecord.isVerified).to.equal(false);

    // ─── Admin verifies the authority ────────────────────────────────────
    await service.connect(owner).setAuthorityVerification(authority.address, true);
    const verifiedRecord = await service.getAuthority(authority.address);
    expect(verifiedRecord.isVerified).to.equal(true);

    // ─── Authority registers a schema ────────────────────────────────────
    const definition = "string degree, string university";
    await registry.connect(authority).register(definition, ethers.ZeroAddress, true);
    const schemaUid = computeSchemaUid(definition, ethers.ZeroAddress, true);

    // ─── Authority creates an attestation ────────────────────────────────
    const attestationData = ethers.AbiCoder.defaultAbiCoder().encode(
      ["string", "string"],
      ["Computer Science", "MIT"]
    );
    await service.connect(authority).attest(schemaUid, subject.address, attestationData, 0);
    const attestationUid = computeAttestationUid(
      schemaUid,
      subject.address,
      authority.address,
      attestationData,
      0
    );

    // ─── Verify attestation ──────────────────────────────────────────────
    const record = await service.getAttestation(attestationUid);
    expect(record.attester).to.equal(authority.address);
    expect(record.revoked).to.equal(false);

    // ─── Revoke and verify ───────────────────────────────────────────────
    await service.connect(authority).revoke(attestationUid);
    const revokedRecord = await service.getAttestation(attestationUid);
    expect(revokedRecord.revoked).to.equal(true);
  });
});

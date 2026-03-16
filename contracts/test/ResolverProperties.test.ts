import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import {
  WhitelistResolver,
  TokenGatedResolver,
  FeeResolver,
  MockERC20,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// Shared constants
const DUMMY_SCHEMA_UID = ethers.keccak256(ethers.toUtf8Bytes("property-test-schema"));
const DUMMY_DATA = ethers.toUtf8Bytes("property-test-data");

// ═══════════════════════════════════════════════════════════════════════════
// Property 17: WhitelistResolver correctness
//
// For any attester address and a WhitelistResolver instance, onAttest should
// return true if and only if the attester is in the whitelist set.
//
// Validates: Requirements 6.4
// ═══════════════════════════════════════════════════════════════════════════
describe("Property 17: WhitelistResolver correctness", function () {
  let resolver: WhitelistResolver;
  let owner: SignerWithAddress;
  let signers: SignerWithAddress[];

  beforeEach(async function () {
    signers = await ethers.getSigners();
    owner = signers[0];
    const Factory = await ethers.getContractFactory("WhitelistResolver");
    resolver = await Factory.connect(owner).deploy();
    await resolver.waitForDeployment();
  });

  it("onAttest returns true iff attester is whitelisted — varied addresses", async function () {
    // Use signers[1..9] as test addresses
    const testAddresses = signers.slice(1, 10);
    const subject = signers[10] ?? signers[1];

    // Initially none are whitelisted — all should return false
    for (const addr of testAddresses) {
      const result = await resolver.onAttest(
        DUMMY_SCHEMA_UID, addr.address, subject.address, DUMMY_DATA
      );
      expect(result).to.be.false;
    }

    // Whitelist a subset (even-indexed)
    const whitelisted = testAddresses.filter((_, i) => i % 2 === 0);
    const notWhitelisted = testAddresses.filter((_, i) => i % 2 !== 0);

    for (const addr of whitelisted) {
      await resolver.connect(owner).addAddress(addr.address);
    }

    // Whitelisted addresses should return true
    for (const addr of whitelisted) {
      const result = await resolver.onAttest(
        DUMMY_SCHEMA_UID, addr.address, subject.address, DUMMY_DATA
      );
      expect(result).to.be.true;
    }

    // Non-whitelisted addresses should return false
    for (const addr of notWhitelisted) {
      const result = await resolver.onAttest(
        DUMMY_SCHEMA_UID, addr.address, subject.address, DUMMY_DATA
      );
      expect(result).to.be.false;
    }
  });

  it("onAttest reflects removal — add then remove should return false", async function () {
    const testAddresses = signers.slice(1, 6);
    const subject = signers[7];

    // Add all
    for (const addr of testAddresses) {
      await resolver.connect(owner).addAddress(addr.address);
    }

    // Remove a subset
    const removed = testAddresses.slice(0, 3);
    const kept = testAddresses.slice(3);

    for (const addr of removed) {
      await resolver.connect(owner).removeAddress(addr.address);
    }

    // Removed addresses should return false
    for (const addr of removed) {
      const result = await resolver.onAttest(
        DUMMY_SCHEMA_UID, addr.address, subject.address, DUMMY_DATA
      );
      expect(result).to.be.false;
    }

    // Kept addresses should return true
    for (const addr of kept) {
      const result = await resolver.onAttest(
        DUMMY_SCHEMA_UID, addr.address, subject.address, DUMMY_DATA
      );
      expect(result).to.be.true;
    }
  });

  it("onAttest result is independent of schemaUid, subject, and data parameters", async function () {
    const attester = signers[1];
    const subject = signers[2];

    // Not whitelisted — should be false regardless of other params
    const schemaUids = [
      ethers.keccak256(ethers.toUtf8Bytes("schema-a")),
      ethers.keccak256(ethers.toUtf8Bytes("schema-b")),
      ethers.ZeroHash,
    ];
    const subjects = [signers[2].address, signers[3].address, ethers.ZeroAddress];
    const dataInputs = [
      ethers.toUtf8Bytes(""),
      ethers.toUtf8Bytes("some-data"),
      ethers.randomBytes(128),
    ];

    for (const uid of schemaUids) {
      for (const sub of subjects) {
        for (const data of dataInputs) {
          const result = await resolver.onAttest(uid, attester.address, sub, data);
          expect(result).to.be.false;
        }
      }
    }

    // Whitelist the attester — should be true regardless of other params
    await resolver.connect(owner).addAddress(attester.address);

    for (const uid of schemaUids) {
      for (const sub of subjects) {
        for (const data of dataInputs) {
          const result = await resolver.onAttest(uid, attester.address, sub, data);
          expect(result).to.be.true;
        }
      }
    }
  });

  it("onAttest with randomly generated addresses — whitelist membership is the sole gate", async function () {
    const subject = signers[2].address;

    // Generate random addresses and whitelist half
    const randomAddresses: string[] = [];
    const whitelistedSet = new Set<string>();

    for (let i = 0; i < 20; i++) {
      const wallet = ethers.Wallet.createRandom();
      randomAddresses.push(wallet.address);
      if (i % 2 === 0) {
        whitelistedSet.add(wallet.address);
        await resolver.connect(owner).addAddress(wallet.address);
      }
    }

    // Verify each address
    for (const addr of randomAddresses) {
      const result = await resolver.onAttest(DUMMY_SCHEMA_UID, addr, subject, DUMMY_DATA);
      const expected = whitelistedSet.has(addr);
      expect(result).to.equal(expected);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Property 18: TokenGatedResolver correctness
//
// For any attester address and a TokenGatedResolver configured with a token
// address and minimum balance, onAttest should return true if and only if
// the attester's token balance >= minimum threshold.
//
// Validates: Requirements 6.5, 9.1, 9.2
// ═══════════════════════════════════════════════════════════════════════════
describe("Property 18: TokenGatedResolver correctness", function () {
  let resolver: TokenGatedResolver;
  let token: MockERC20;
  let owner: SignerWithAddress;
  let signers: SignerWithAddress[];

  const MIN_BALANCE = ethers.parseEther("100");

  beforeEach(async function () {
    signers = await ethers.getSigners();
    owner = signers[0];

    const TokenFactory = await ethers.getContractFactory("MockERC20");
    token = await TokenFactory.deploy();
    await token.waitForDeployment();

    const Factory = await ethers.getContractFactory("TokenGatedResolver");
    resolver = await Factory.connect(owner).deploy(
      await token.getAddress(),
      MIN_BALANCE
    );
    await resolver.waitForDeployment();
  });

  it("onAttest succeeds iff balance >= minimumBalance — varied balances", async function () {
    const subject = signers[2].address;

    // Test cases: [balance, shouldSucceed]
    const testCases: [bigint, boolean][] = [
      [0n, false],
      [ethers.parseEther("1"), false],
      [ethers.parseEther("50"), false],
      [ethers.parseEther("99"), false],
      [ethers.parseEther("99.999999999999999999"), false],
      [ethers.parseEther("100"), true],
      [ethers.parseEther("100.000000000000000001"), true],
      [ethers.parseEther("150"), true],
      [ethers.parseEther("1000"), true],
      [ethers.parseEther("999999"), true],
    ];

    for (const [balance, shouldSucceed] of testCases) {
      // Deploy fresh token and resolver for each case to avoid state leakage
      const freshToken = await (await ethers.getContractFactory("MockERC20")).deploy();
      await freshToken.waitForDeployment();

      const freshResolver = await (await ethers.getContractFactory("TokenGatedResolver"))
        .connect(owner)
        .deploy(await freshToken.getAddress(), MIN_BALANCE);
      await freshResolver.waitForDeployment();

      const attester = signers[1];
      if (balance > 0n) {
        await freshToken.mint(attester.address, balance);
      }

      if (shouldSucceed) {
        const result = await freshResolver.onAttest.staticCall(
          DUMMY_SCHEMA_UID, attester.address, subject, DUMMY_DATA
        );
        expect(result).to.be.true;
      } else {
        await expect(
          freshResolver.onAttest(DUMMY_SCHEMA_UID, attester.address, subject, DUMMY_DATA)
        ).to.be.revertedWithCustomError(freshResolver, "InsufficientTokenBalance");
      }
    }
  });

  it("onAttest reflects balance changes — mint above then burn below threshold", async function () {
    const attester = signers[1];
    const subject = signers[2].address;

    // Start with zero — should fail
    await expect(
      resolver.onAttest(DUMMY_SCHEMA_UID, attester.address, subject, DUMMY_DATA)
    ).to.be.revertedWithCustomError(resolver, "InsufficientTokenBalance");

    // Mint to exactly minimum — should succeed
    await token.mint(attester.address, MIN_BALANCE);
    const result1 = await resolver.onAttest.staticCall(
      DUMMY_SCHEMA_UID, attester.address, subject, DUMMY_DATA
    );
    expect(result1).to.be.true;

    // Burn below minimum — should fail again
    await token.burn(attester.address, ethers.parseEther("1"));
    await expect(
      resolver.onAttest(DUMMY_SCHEMA_UID, attester.address, subject, DUMMY_DATA)
    ).to.be.revertedWithCustomError(resolver, "InsufficientTokenBalance");

    // Mint back above — should succeed
    await token.mint(attester.address, ethers.parseEther("50"));
    const result2 = await resolver.onAttest.staticCall(
      DUMMY_SCHEMA_UID, attester.address, subject, DUMMY_DATA
    );
    expect(result2).to.be.true;
  });

  it("onAttest with multiple attesters — each checked independently", async function () {
    const subject = signers[5].address;
    const attesters = signers.slice(1, 5);

    // Give different balances to each attester
    const balances = [
      ethers.parseEther("50"),   // below
      ethers.parseEther("100"),  // exactly at
      ethers.parseEther("200"),  // above
      0n,                         // zero
    ];

    for (let i = 0; i < attesters.length; i++) {
      if (balances[i] > 0n) {
        await token.mint(attesters[i].address, balances[i]);
      }
    }

    const expectedResults = [false, true, true, false];

    for (let i = 0; i < attesters.length; i++) {
      if (expectedResults[i]) {
        const result = await resolver.onAttest.staticCall(
          DUMMY_SCHEMA_UID, attesters[i].address, subject, DUMMY_DATA
        );
        expect(result).to.be.true;
      } else {
        await expect(
          resolver.onAttest(DUMMY_SCHEMA_UID, attesters[i].address, subject, DUMMY_DATA)
        ).to.be.revertedWithCustomError(resolver, "InsufficientTokenBalance");
      }
    }
  });

  it("onAttest with varied minimumBalance thresholds", async function () {
    const attester = signers[1];
    const subject = signers[2].address;
    const fixedBalance = ethers.parseEther("500");

    const thresholds = [
      0n,
      1n,
      ethers.parseEther("499"),
      ethers.parseEther("500"),
      ethers.parseEther("500.000000000000000001"),
      ethers.parseEther("1000"),
    ];

    for (const threshold of thresholds) {
      const freshToken = await (await ethers.getContractFactory("MockERC20")).deploy();
      await freshToken.waitForDeployment();
      await freshToken.mint(attester.address, fixedBalance);

      const freshResolver = await (await ethers.getContractFactory("TokenGatedResolver"))
        .connect(owner)
        .deploy(await freshToken.getAddress(), threshold);
      await freshResolver.waitForDeployment();

      if (fixedBalance >= threshold) {
        const result = await freshResolver.onAttest.staticCall(
          DUMMY_SCHEMA_UID, attester.address, subject, DUMMY_DATA
        );
        expect(result).to.be.true;
      } else {
        await expect(
          freshResolver.onAttest(DUMMY_SCHEMA_UID, attester.address, subject, DUMMY_DATA)
        ).to.be.revertedWithCustomError(freshResolver, "InsufficientTokenBalance");
      }
    }
  });

  it("onAttest error includes correct balance and required values", async function () {
    const attester = signers[1];
    const subject = signers[2].address;
    const actualBalance = ethers.parseEther("42");

    await token.mint(attester.address, actualBalance);

    await expect(
      resolver.onAttest(DUMMY_SCHEMA_UID, attester.address, subject, DUMMY_DATA)
    ).to.be.revertedWithCustomError(resolver, "InsufficientTokenBalance")
      .withArgs(attester.address, actualBalance, MIN_BALANCE);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Property 19: FeeResolver correctness
//
// For any attestation attempt through a FeeResolver with a configured fee,
// onAttest should succeed if and only if the attester's deposited balance
// is >= the fee amount.
//
// Validates: Requirements 6.6
// ═══════════════════════════════════════════════════════════════════════════
describe("Property 19: FeeResolver correctness", function () {
  let resolver: FeeResolver;
  let owner: SignerWithAddress;
  let signers: SignerWithAddress[];

  const FEE = ethers.parseEther("1");

  beforeEach(async function () {
    signers = await ethers.getSigners();
    owner = signers[0];

    const Factory = await ethers.getContractFactory("FeeResolver");
    resolver = await Factory.connect(owner).deploy(FEE);
    await resolver.waitForDeployment();
  });

  it("onAttest succeeds iff deposited balance >= fee — varied deposits", async function () {
    const subject = signers[2].address;

    // Test cases: [depositAmount, shouldSucceed]
    const testCases: [bigint, boolean][] = [
      [0n, false],
      [1n, false],
      [ethers.parseEther("0.5"), false],
      [ethers.parseEther("0.999999999999999999"), false],
      [ethers.parseEther("1"), true],
      [ethers.parseEther("1.000000000000000001"), true],
      [ethers.parseEther("2"), true],
      [ethers.parseEther("100"), true],
    ];

    for (const [deposit, shouldSucceed] of testCases) {
      // Fresh resolver per case to avoid balance carryover
      const freshResolver = await (await ethers.getContractFactory("FeeResolver"))
        .connect(owner)
        .deploy(FEE);
      await freshResolver.waitForDeployment();

      const attester = signers[1];
      if (deposit > 0n) {
        await freshResolver.connect(attester).deposit({ value: deposit });
      }

      if (shouldSucceed) {
        const result = await freshResolver.onAttest.staticCall(
          DUMMY_SCHEMA_UID, attester.address, subject, DUMMY_DATA
        );
        expect(result).to.be.true;
      } else {
        await expect(
          freshResolver.onAttest(DUMMY_SCHEMA_UID, attester.address, subject, DUMMY_DATA)
        ).to.be.revertedWithCustomError(freshResolver, "InsufficientFee");
      }
    }
  });

  it("onAttest deducts fee — balance decreases by exactly fee per attestation", async function () {
    const attester = signers[1];
    const subject = signers[2].address;
    const numAttestations = 5;
    const totalDeposit = FEE * BigInt(numAttestations);

    await resolver.connect(attester).deposit({ value: totalDeposit });

    for (let i = 0; i < numAttestations; i++) {
      const balanceBefore = await resolver.balances(attester.address);
      await resolver.onAttest(DUMMY_SCHEMA_UID, attester.address, subject, DUMMY_DATA);
      const balanceAfter = await resolver.balances(attester.address);
      expect(balanceBefore - balanceAfter).to.equal(FEE);
    }

    // Balance should now be zero — next attempt should fail
    expect(await resolver.balances(attester.address)).to.equal(0n);
    await expect(
      resolver.onAttest(DUMMY_SCHEMA_UID, attester.address, subject, DUMMY_DATA)
    ).to.be.revertedWithCustomError(resolver, "InsufficientFee");
  });

  it("onAttest with multiple attesters — balances are independent", async function () {
    const subject = signers[5].address;
    const attesters = signers.slice(1, 5);

    // Deposit different amounts for each attester
    const deposits = [
      ethers.parseEther("0.5"),  // below fee
      ethers.parseEther("1"),    // exactly fee
      ethers.parseEther("3"),    // above fee (3 attestations)
      0n,                         // nothing
    ];

    for (let i = 0; i < attesters.length; i++) {
      if (deposits[i] > 0n) {
        await resolver.connect(attesters[i]).deposit({ value: deposits[i] });
      }
    }

    const expectedResults = [false, true, true, false];

    for (let i = 0; i < attesters.length; i++) {
      if (expectedResults[i]) {
        const result = await resolver.onAttest.staticCall(
          DUMMY_SCHEMA_UID, attesters[i].address, subject, DUMMY_DATA
        );
        expect(result).to.be.true;
      } else {
        await expect(
          resolver.onAttest(DUMMY_SCHEMA_UID, attesters[i].address, subject, DUMMY_DATA)
        ).to.be.revertedWithCustomError(resolver, "InsufficientFee");
      }
    }
  });

  it("onAttest with varied fee amounts — threshold is the sole gate", async function () {
    const attester = signers[1];
    const subject = signers[2].address;
    const fixedDeposit = ethers.parseEther("5");

    const fees = [
      0n,
      1n,
      ethers.parseEther("4.999999999999999999"),
      ethers.parseEther("5"),
      ethers.parseEther("5.000000000000000001"),
      ethers.parseEther("100"),
    ];

    for (const fee of fees) {
      const freshResolver = await (await ethers.getContractFactory("FeeResolver"))
        .connect(owner)
        .deploy(fee);
      await freshResolver.waitForDeployment();

      await freshResolver.connect(attester).deposit({ value: fixedDeposit });

      if (fixedDeposit >= fee) {
        const result = await freshResolver.onAttest.staticCall(
          DUMMY_SCHEMA_UID, attester.address, subject, DUMMY_DATA
        );
        expect(result).to.be.true;
      } else {
        await expect(
          freshResolver.onAttest(DUMMY_SCHEMA_UID, attester.address, subject, DUMMY_DATA)
        ).to.be.revertedWithCustomError(freshResolver, "InsufficientFee");
      }
    }
  });

  it("onAttest error includes correct available and required values", async function () {
    const attester = signers[1];
    const subject = signers[2].address;
    const partialDeposit = ethers.parseEther("0.3");

    await resolver.connect(attester).deposit({ value: partialDeposit });

    await expect(
      resolver.onAttest(DUMMY_SCHEMA_UID, attester.address, subject, DUMMY_DATA)
    ).to.be.revertedWithCustomError(resolver, "InsufficientFee")
      .withArgs(partialDeposit, FEE);
  });

  it("onAttest via direct transfer deposit — receive() credits balance correctly", async function () {
    const attester = signers[1];
    const subject = signers[2].address;

    // Deposit via direct transfer
    await attester.sendTransaction({
      to: await resolver.getAddress(),
      value: FEE,
    });

    const result = await resolver.onAttest.staticCall(
      DUMMY_SCHEMA_UID, attester.address, subject, DUMMY_DATA
    );
    expect(result).to.be.true;
  });

  it("onAttest with zero fee — always succeeds regardless of balance", async function () {
    const freeResolver = await (await ethers.getContractFactory("FeeResolver"))
      .connect(owner)
      .deploy(0);
    await freeResolver.waitForDeployment();

    const attesters = signers.slice(1, 6);
    const subject = signers[7].address;

    // No deposits — should all succeed because fee is 0
    for (const attester of attesters) {
      const result = await freeResolver.onAttest.staticCall(
        DUMMY_SCHEMA_UID, attester.address, subject, DUMMY_DATA
      );
      expect(result).to.be.true;
    }
  });
});

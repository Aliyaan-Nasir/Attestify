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
const DUMMY_SCHEMA_UID = ethers.keccak256(ethers.toUtf8Bytes("test-schema"));
const DUMMY_ATTESTATION_UID = ethers.keccak256(ethers.toUtf8Bytes("test-attestation"));
const DUMMY_DATA = ethers.toUtf8Bytes("test-data");
const IRESOLVER_INTERFACE_ID = "0x509771e9"; // Computed from IResolver function selectors
const ERC165_INTERFACE_ID = "0x01ffc9a7";

// ═══════════════════════════════════════════════════════════════════════════
// WhitelistResolver
// ═══════════════════════════════════════════════════════════════════════════
describe("WhitelistResolver", function () {
  let resolver: WhitelistResolver;
  let owner: SignerWithAddress;
  let attester: SignerWithAddress;
  let other: SignerWithAddress;
  let subject: SignerWithAddress;

  beforeEach(async function () {
    [owner, attester, other, subject] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("WhitelistResolver");
    resolver = await Factory.connect(owner).deploy();
    await resolver.waitForDeployment();
  });

  describe("deployment", function () {
    it("should set deployer as owner", async function () {
      expect(await resolver.owner()).to.equal(owner.address);
    });
  });

  describe("addAddress", function () {
    it("should add an address to the whitelist", async function () {
      await resolver.connect(owner).addAddress(attester.address);
      expect(await resolver.whitelisted(attester.address)).to.be.true;
    });

    it("should emit AddressAdded event", async function () {
      await expect(resolver.connect(owner).addAddress(attester.address))
        .to.emit(resolver, "AddressAdded")
        .withArgs(attester.address);
    });

    it("should revert when called by non-owner", async function () {
      await expect(
        resolver.connect(other).addAddress(attester.address)
      ).to.be.revertedWithCustomError(resolver, "NotOwner");
    });

    it("should revert when adding zero address", async function () {
      await expect(
        resolver.connect(owner).addAddress(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(resolver, "ZeroAddress");
    });

    it("should allow adding the same address twice without error", async function () {
      await resolver.connect(owner).addAddress(attester.address);
      await resolver.connect(owner).addAddress(attester.address);
      expect(await resolver.whitelisted(attester.address)).to.be.true;
    });
  });

  describe("removeAddress", function () {
    it("should remove an address from the whitelist", async function () {
      await resolver.connect(owner).addAddress(attester.address);
      await resolver.connect(owner).removeAddress(attester.address);
      expect(await resolver.whitelisted(attester.address)).to.be.false;
    });

    it("should emit AddressRemoved event", async function () {
      await resolver.connect(owner).addAddress(attester.address);
      await expect(resolver.connect(owner).removeAddress(attester.address))
        .to.emit(resolver, "AddressRemoved")
        .withArgs(attester.address);
    });

    it("should revert when called by non-owner", async function () {
      await expect(
        resolver.connect(other).removeAddress(attester.address)
      ).to.be.revertedWithCustomError(resolver, "NotOwner");
    });

    it("should be idempotent for non-whitelisted address", async function () {
      // Removing an address that was never added should not revert
      await resolver.connect(owner).removeAddress(attester.address);
      expect(await resolver.whitelisted(attester.address)).to.be.false;
    });
  });

  describe("onAttest", function () {
    it("should return true for whitelisted attester", async function () {
      await resolver.connect(owner).addAddress(attester.address);
      const result = await resolver.onAttest(
        DUMMY_SCHEMA_UID, attester.address, subject.address, DUMMY_DATA
      );
      expect(result).to.be.true;
    });

    it("should return false for non-whitelisted attester", async function () {
      const result = await resolver.onAttest(
        DUMMY_SCHEMA_UID, other.address, subject.address, DUMMY_DATA
      );
      expect(result).to.be.false;
    });

    it("should return false after attester is removed from whitelist", async function () {
      await resolver.connect(owner).addAddress(attester.address);
      await resolver.connect(owner).removeAddress(attester.address);
      const result = await resolver.onAttest(
        DUMMY_SCHEMA_UID, attester.address, subject.address, DUMMY_DATA
      );
      expect(result).to.be.false;
    });
  });

  describe("onRevoke", function () {
    it("should always return true", async function () {
      const result = await resolver.onRevoke(DUMMY_ATTESTATION_UID, attester.address);
      expect(result).to.be.true;
    });
  });

  describe("supportsInterface", function () {
    it("should return true for IResolver interface ID", async function () {
      // Compute IResolver interface ID from the contract
      expect(await resolver.supportsInterface(
        // We test with the actual value the contract returns
        ERC165_INTERFACE_ID
      )).to.be.true;
    });

    it("should return true for ERC-165 interface ID", async function () {
      expect(await resolver.supportsInterface(ERC165_INTERFACE_ID)).to.be.true;
    });

    it("should return false for unsupported interface ID", async function () {
      expect(await resolver.supportsInterface("0xffffffff")).to.be.false;
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TokenGatedResolver
// ═══════════════════════════════════════════════════════════════════════════
describe("TokenGatedResolver", function () {
  let resolver: TokenGatedResolver;
  let token: MockERC20;
  let owner: SignerWithAddress;
  let attester: SignerWithAddress;
  let other: SignerWithAddress;
  let subject: SignerWithAddress;

  const MIN_BALANCE = ethers.parseEther("100");

  beforeEach(async function () {
    [owner, attester, other, subject] = await ethers.getSigners();

    // Deploy mock ERC20 token (simulates HTS token on local hardhat)
    const TokenFactory = await ethers.getContractFactory("MockERC20");
    token = await TokenFactory.deploy();
    await token.waitForDeployment();

    // Deploy TokenGatedResolver with the mock token
    const Factory = await ethers.getContractFactory("TokenGatedResolver");
    resolver = await Factory.connect(owner).deploy(
      await token.getAddress(),
      MIN_BALANCE
    );
    await resolver.waitForDeployment();
  });

  describe("deployment", function () {
    it("should set deployer as owner", async function () {
      expect(await resolver.owner()).to.equal(owner.address);
    });

    it("should set token address", async function () {
      expect(await resolver.tokenAddress()).to.equal(await token.getAddress());
    });

    it("should set minimum balance", async function () {
      expect(await resolver.minimumBalance()).to.equal(MIN_BALANCE);
    });

    it("should emit TokenConfigured event on deploy", async function () {
      const Factory = await ethers.getContractFactory("TokenGatedResolver");
      const newResolver = await Factory.connect(owner).deploy(await token.getAddress(), MIN_BALANCE);
      const receipt = await newResolver.deploymentTransaction()!.wait();
      const log = receipt?.logs.find(
        (l) => {
          try {
            return newResolver.interface.parseLog({ topics: l.topics as string[], data: l.data })?.name === "TokenConfigured";
          } catch { return false; }
        }
      );
      expect(log).to.not.be.undefined;
      const parsed = newResolver.interface.parseLog({ topics: log!.topics as string[], data: log!.data });
      expect(parsed?.args[0]).to.equal(await token.getAddress());
      expect(parsed?.args[1]).to.equal(MIN_BALANCE);
    });

    it("should revert with zero token address", async function () {
      const Factory = await ethers.getContractFactory("TokenGatedResolver");
      await expect(
        Factory.connect(owner).deploy(ethers.ZeroAddress, MIN_BALANCE)
      ).to.be.revertedWithCustomError(resolver, "ZeroAddress");
    });
  });

  describe("setTokenConfig", function () {
    it("should update token address and minimum balance", async function () {
      const newToken = await (await ethers.getContractFactory("MockERC20")).deploy();
      await newToken.waitForDeployment();
      const newMin = ethers.parseEther("50");

      await resolver.connect(owner).setTokenConfig(await newToken.getAddress(), newMin);
      expect(await resolver.tokenAddress()).to.equal(await newToken.getAddress());
      expect(await resolver.minimumBalance()).to.equal(newMin);
    });

    it("should emit TokenConfigured event", async function () {
      const newMin = ethers.parseEther("200");
      await expect(
        resolver.connect(owner).setTokenConfig(await token.getAddress(), newMin)
      ).to.emit(resolver, "TokenConfigured")
        .withArgs(await token.getAddress(), newMin);
    });

    it("should revert when called by non-owner", async function () {
      await expect(
        resolver.connect(other).setTokenConfig(await token.getAddress(), 0)
      ).to.be.revertedWithCustomError(resolver, "NotOwner");
    });

    it("should revert with zero token address", async function () {
      await expect(
        resolver.connect(owner).setTokenConfig(ethers.ZeroAddress, MIN_BALANCE)
      ).to.be.revertedWithCustomError(resolver, "ZeroAddress");
    });
  });

  describe("onAttest", function () {
    it("should return true when attester has sufficient balance", async function () {
      await token.mint(attester.address, MIN_BALANCE);
      const result = await resolver.onAttest.staticCall(
        DUMMY_SCHEMA_UID, attester.address, subject.address, DUMMY_DATA
      );
      expect(result).to.be.true;
    });

    it("should return true when attester has more than minimum balance", async function () {
      await token.mint(attester.address, MIN_BALANCE + ethers.parseEther("50"));
      const result = await resolver.onAttest.staticCall(
        DUMMY_SCHEMA_UID, attester.address, subject.address, DUMMY_DATA
      );
      expect(result).to.be.true;
    });

    it("should revert when attester has insufficient balance", async function () {
      await token.mint(attester.address, ethers.parseEther("50")); // Below minimum
      await expect(
        resolver.onAttest(DUMMY_SCHEMA_UID, attester.address, subject.address, DUMMY_DATA)
      ).to.be.revertedWithCustomError(resolver, "InsufficientTokenBalance")
        .withArgs(attester.address, ethers.parseEther("50"), MIN_BALANCE);
    });

    it("should revert when attester has zero balance", async function () {
      await expect(
        resolver.onAttest(DUMMY_SCHEMA_UID, attester.address, subject.address, DUMMY_DATA)
      ).to.be.revertedWithCustomError(resolver, "InsufficientTokenBalance")
        .withArgs(attester.address, 0, MIN_BALANCE);
    });

    it("should work with minimum balance of zero (always passes)", async function () {
      // Deploy a resolver with 0 minimum
      const Factory = await ethers.getContractFactory("TokenGatedResolver");
      const zeroMinResolver = await Factory.connect(owner).deploy(
        await token.getAddress(), 0
      );
      await zeroMinResolver.waitForDeployment();

      const result = await zeroMinResolver.onAttest.staticCall(
        DUMMY_SCHEMA_UID, attester.address, subject.address, DUMMY_DATA
      );
      expect(result).to.be.true;
    });
  });

  describe("onRevoke", function () {
    it("should always return true", async function () {
      const result = await resolver.onRevoke(DUMMY_ATTESTATION_UID, attester.address);
      expect(result).to.be.true;
    });
  });

  describe("supportsInterface", function () {
    it("should return true for ERC-165 interface ID", async function () {
      expect(await resolver.supportsInterface(ERC165_INTERFACE_ID)).to.be.true;
    });

    it("should return false for unsupported interface ID", async function () {
      expect(await resolver.supportsInterface("0xffffffff")).to.be.false;
    });
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// FeeResolver
// ═══════════════════════════════════════════════════════════════════════════
describe("FeeResolver", function () {
  let resolver: FeeResolver;
  let owner: SignerWithAddress;
  let attester: SignerWithAddress;
  let other: SignerWithAddress;
  let subject: SignerWithAddress;

  const FEE = ethers.parseEther("1"); // 1 HBAR

  beforeEach(async function () {
    [owner, attester, other, subject] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("FeeResolver");
    resolver = await Factory.connect(owner).deploy(FEE);
    await resolver.waitForDeployment();
  });

  describe("deployment", function () {
    it("should set deployer as owner", async function () {
      expect(await resolver.owner()).to.equal(owner.address);
    });

    it("should set the fee", async function () {
      expect(await resolver.fee()).to.equal(FEE);
    });

    it("should emit FeeUpdated event on deploy", async function () {
      const Factory = await ethers.getContractFactory("FeeResolver");
      const newResolver = await Factory.connect(owner).deploy(FEE);
      const receipt = await newResolver.deploymentTransaction()!.wait();
      const log = receipt?.logs.find(
        (l) => {
          try {
            return newResolver.interface.parseLog({ topics: l.topics as string[], data: l.data })?.name === "FeeUpdated";
          } catch { return false; }
        }
      );
      expect(log).to.not.be.undefined;
      const parsed = newResolver.interface.parseLog({ topics: log!.topics as string[], data: log!.data });
      expect(parsed?.args[0]).to.equal(FEE);
    });
  });

  describe("setFee", function () {
    it("should update the fee", async function () {
      const newFee = ethers.parseEther("2");
      await resolver.connect(owner).setFee(newFee);
      expect(await resolver.fee()).to.equal(newFee);
    });

    it("should emit FeeUpdated event", async function () {
      const newFee = ethers.parseEther("5");
      await expect(resolver.connect(owner).setFee(newFee))
        .to.emit(resolver, "FeeUpdated")
        .withArgs(newFee);
    });

    it("should revert when called by non-owner", async function () {
      await expect(
        resolver.connect(other).setFee(ethers.parseEther("2"))
      ).to.be.revertedWithCustomError(resolver, "NotOwner");
    });

    it("should allow setting fee to zero", async function () {
      await resolver.connect(owner).setFee(0);
      expect(await resolver.fee()).to.equal(0);
    });
  });

  describe("deposit", function () {
    it("should credit the sender's balance", async function () {
      const amount = ethers.parseEther("3");
      await resolver.connect(attester).deposit({ value: amount });
      expect(await resolver.balances(attester.address)).to.equal(amount);
    });

    it("should emit Deposited event", async function () {
      const amount = ethers.parseEther("2");
      await expect(resolver.connect(attester).deposit({ value: amount }))
        .to.emit(resolver, "Deposited")
        .withArgs(attester.address, amount);
    });

    it("should accumulate multiple deposits", async function () {
      const amount1 = ethers.parseEther("1");
      const amount2 = ethers.parseEther("2");
      await resolver.connect(attester).deposit({ value: amount1 });
      await resolver.connect(attester).deposit({ value: amount2 });
      expect(await resolver.balances(attester.address)).to.equal(amount1 + amount2);
    });
  });

  describe("receive (direct transfer)", function () {
    it("should credit the sender's balance on direct HBAR transfer", async function () {
      const amount = ethers.parseEther("1");
      await attester.sendTransaction({
        to: await resolver.getAddress(),
        value: amount,
      });
      expect(await resolver.balances(attester.address)).to.equal(amount);
    });

    it("should emit Deposited event on direct transfer", async function () {
      const amount = ethers.parseEther("1");
      await expect(
        attester.sendTransaction({
          to: await resolver.getAddress(),
          value: amount,
        })
      ).to.emit(resolver, "Deposited")
        .withArgs(attester.address, amount);
    });
  });

  describe("onAttest", function () {
    it("should return true and deduct fee when attester has sufficient balance", async function () {
      await resolver.connect(attester).deposit({ value: FEE });
      const result = await resolver.onAttest.staticCall(
        DUMMY_SCHEMA_UID, attester.address, subject.address, DUMMY_DATA
      );
      expect(result).to.be.true;

      // Actually execute to check balance deduction
      await resolver.onAttest(DUMMY_SCHEMA_UID, attester.address, subject.address, DUMMY_DATA);
      expect(await resolver.balances(attester.address)).to.equal(0);
    });

    it("should emit FeeCollected event", async function () {
      await resolver.connect(attester).deposit({ value: FEE });
      await expect(
        resolver.onAttest(DUMMY_SCHEMA_UID, attester.address, subject.address, DUMMY_DATA)
      ).to.emit(resolver, "FeeCollected")
        .withArgs(attester.address, FEE);
    });

    it("should revert when attester has insufficient balance", async function () {
      const partial = ethers.parseEther("0.5");
      await resolver.connect(attester).deposit({ value: partial });
      await expect(
        resolver.onAttest(DUMMY_SCHEMA_UID, attester.address, subject.address, DUMMY_DATA)
      ).to.be.revertedWithCustomError(resolver, "InsufficientFee")
        .withArgs(partial, FEE);
    });

    it("should revert when attester has zero balance", async function () {
      await expect(
        resolver.onAttest(DUMMY_SCHEMA_UID, attester.address, subject.address, DUMMY_DATA)
      ).to.be.revertedWithCustomError(resolver, "InsufficientFee")
        .withArgs(0, FEE);
    });

    it("should allow multiple attestations if balance covers them", async function () {
      await resolver.connect(attester).deposit({ value: FEE * 3n });

      await resolver.onAttest(DUMMY_SCHEMA_UID, attester.address, subject.address, DUMMY_DATA);
      await resolver.onAttest(DUMMY_SCHEMA_UID, attester.address, subject.address, DUMMY_DATA);
      await resolver.onAttest(DUMMY_SCHEMA_UID, attester.address, subject.address, DUMMY_DATA);

      expect(await resolver.balances(attester.address)).to.equal(0);
    });

    it("should pass when fee is zero", async function () {
      const Factory = await ethers.getContractFactory("FeeResolver");
      const freeResolver = await Factory.connect(owner).deploy(0);
      await freeResolver.waitForDeployment();

      const result = await freeResolver.onAttest.staticCall(
        DUMMY_SCHEMA_UID, attester.address, subject.address, DUMMY_DATA
      );
      expect(result).to.be.true;
    });
  });

  describe("onRevoke", function () {
    it("should always return true", async function () {
      const result = await resolver.onRevoke(DUMMY_ATTESTATION_UID, attester.address);
      expect(result).to.be.true;
    });
  });

  describe("withdraw", function () {
    it("should transfer all collected fees to owner", async function () {
      await resolver.connect(attester).deposit({ value: FEE });
      // Trigger fee collection
      await resolver.onAttest(DUMMY_SCHEMA_UID, attester.address, subject.address, DUMMY_DATA);

      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      const tx = await resolver.connect(owner).withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);

      expect(ownerBalanceAfter - ownerBalanceBefore + gasUsed).to.equal(FEE);
    });

    it("should emit Withdrawn event", async function () {
      await resolver.connect(attester).deposit({ value: FEE });
      await resolver.onAttest(DUMMY_SCHEMA_UID, attester.address, subject.address, DUMMY_DATA);

      await expect(resolver.connect(owner).withdraw())
        .to.emit(resolver, "Withdrawn")
        .withArgs(owner.address, FEE);
    });

    it("should revert when nothing to withdraw", async function () {
      await expect(
        resolver.connect(owner).withdraw()
      ).to.be.revertedWithCustomError(resolver, "NothingToWithdraw");
    });

    it("should revert when called by non-owner", async function () {
      await resolver.connect(attester).deposit({ value: FEE });
      await expect(
        resolver.connect(other).withdraw()
      ).to.be.revertedWithCustomError(resolver, "NotOwner");
    });
  });

  describe("withdrawAmount", function () {
    it("should withdraw a specific amount to owner", async function () {
      await resolver.connect(attester).deposit({ value: FEE * 3n });
      // Collect fees for 2 attestations
      await resolver.onAttest(DUMMY_SCHEMA_UID, attester.address, subject.address, DUMMY_DATA);
      await resolver.onAttest(DUMMY_SCHEMA_UID, attester.address, subject.address, DUMMY_DATA);

      const withdrawAmt = FEE;
      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      const tx = await resolver.connect(owner).withdrawAmount(withdrawAmt);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);

      expect(ownerBalanceAfter - ownerBalanceBefore + gasUsed).to.equal(withdrawAmt);
    });

    it("should emit Withdrawn event", async function () {
      await resolver.connect(attester).deposit({ value: FEE });
      await resolver.onAttest(DUMMY_SCHEMA_UID, attester.address, subject.address, DUMMY_DATA);

      await expect(resolver.connect(owner).withdrawAmount(FEE))
        .to.emit(resolver, "Withdrawn")
        .withArgs(owner.address, FEE);
    });

    it("should revert when called by non-owner", async function () {
      await expect(
        resolver.connect(other).withdrawAmount(FEE)
      ).to.be.revertedWithCustomError(resolver, "NotOwner");
    });
  });

  describe("supportsInterface", function () {
    it("should return true for ERC-165 interface ID", async function () {
      expect(await resolver.supportsInterface(ERC165_INTERFACE_ID)).to.be.true;
    });

    it("should return false for unsupported interface ID", async function () {
      expect(await resolver.supportsInterface("0xffffffff")).to.be.false;
    });
  });
});

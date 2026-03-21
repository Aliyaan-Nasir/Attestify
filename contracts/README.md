# @attestify/contracts

Solidity smart contracts for the Attestify protocol, deployed to Hedera testnet via Hardhat.

## Contracts

| Contract | Description |
|----------|-------------|
| `SchemaRegistry.sol` | Schema registration and lookup with deterministic UIDs |
| `AttestationService.sol` | Attestation lifecycle (create, revoke, verify), authority management, and delegation |
| `IResolver.sol` | Resolver interface for custom attestation/revocation validation |
| `Errors.sol` | Shared custom error definitions |
| `resolvers/WhitelistResolver.sol` | Allows attestations only from whitelisted addresses |
| `resolvers/FeeResolver.sol` | Collects configurable HBAR fee before allowing attestation |
| `resolvers/TokenGatedResolver.sol` | Gates attestations behind HTS token balance (precompile at `0x167`) |
| `resolvers/TokenRewardResolver.sol` | Distributes HTS tokens to attestation subjects |
| `resolvers/CrossContractResolver.sol` | Chains multiple resolvers in a sequential pipeline |
| `libraries/UIDGenerator.sol` | Deterministic UID computation via `keccak256(abi.encode(...))` |

## Deployed Addresses (Hedera Testnet)

| Contract | Address | HashScan |
|----------|---------|----------|
| SchemaRegistry | `0x8320Ae819556C449825F8255e92E7e1bc06c2e80` | [View](https://hashscan.io/testnet/contract/0x8320Ae819556C449825F8255e92E7e1bc06c2e80) |
| AttestationService | `0xce573F82e73F49721255088C7b4D849ad0F64331` | [View](https://hashscan.io/testnet/contract/0xce573F82e73F49721255088C7b4D849ad0F64331) |
| WhitelistResolver | `0x461349A8aEfB220A48b61923095DfF237465c27A` | [View](https://hashscan.io/testnet/contract/0x461349A8aEfB220A48b61923095DfF237465c27A) |
| FeeResolver | `0x7460B74e14d17f0f852959D69Db3F1EAE72aF37C` | [View](https://hashscan.io/testnet/contract/0x7460B74e14d17f0f852959D69Db3F1EAE72aF37C) |
| TokenGatedResolver | `0x7d04a83cF73CD4853dB4E378DD127440d444718c` | [View](https://hashscan.io/testnet/contract/0x7d04a83cF73CD4853dB4E378DD127440d444718c) |

## Setup

```bash
# From hedera/ root
pnpm install
```

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `HEDERA_TESTNET_RPC` | JSON-RPC relay endpoint (default: `https://testnet.hashio.io/api`) |
| `HEDERA_ACCOUNT_ID` | Hedera operator account ID (e.g. `0.0.12345`) |
| `DEPLOYER_PRIVATE_KEY` | ECDSA private key (hex) for deployment |

## Usage

```bash
# Compile contracts
pnpm build

# Run tests (local Hardhat network)
pnpm test

# Deploy to Hedera testnet
pnpm deploy

# Verify all contracts on HashScan
pnpm verify:all
```

Deployed addresses are written to `deployed-addresses.json` after deployment.

## Architecture

- Solidity `0.8.24` with optimizer enabled (200 runs)
- Hedera testnet chain ID: `296`
- EVM version: `cancun`
- Uses Hedera-native HTS precompile (`0x167`) for token interactions in `TokenGatedResolver`
- Hardhat toolbox with TypeChain for type-safe contract bindings

## GitHub

[github.com/Aliyaan-Nasir/Attestify](https://github.com/Aliyaan-Nasir/Attestify)

## License

MIT

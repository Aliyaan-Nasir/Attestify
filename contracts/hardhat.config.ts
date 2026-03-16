import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import 'dotenv/config';

const HEDERA_TESTNET_RPC = process.env.HEDERA_TESTNET_RPC || 'https://testnet.hashio.io/api';
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || '';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: 'cancun',
    },
  },
  networks: {
    hedera_testnet: {
      url: HEDERA_TESTNET_RPC,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
      chainId: 296,
      timeout: 60000,
    },
    hardhat: {
      chainId: 31337,
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
  },
  etherscan: {
    apiKey: {
      hedera_testnet: 'no-api-key-needed',
    },
    customChains: [
      {
        network: 'hedera_testnet',
        chainId: 296,
        urls: {
          apiURL: 'https://server-verify.hashscan.io',
          browserURL: 'https://hashscan.io/testnet',
        },
      },
    ],
  },
  sourcify: {
    enabled: true,
    apiUrl: 'https://server-verify.hashscan.io',
    browserUrl: 'https://hashscan.io/testnet',
  },
};

export default config;

/**
 * Parses raw contract/wallet errors into user-friendly messages.
 * Used by all sandbox tool pages to show helpful error text instead of raw revert data.
 */

/** Known Solidity custom error selectors (first 4 bytes of keccak256) */
const ERROR_SELECTORS: Record<string, string> = {
  '0xb3118caa': 'SchemaAlreadyExists',
  '0x5e0b0c09': 'SchemaNotFound',
  '0x8baa579f': 'AttestationNotFound',
  '0x88a0f8c0': 'AuthorityNotFound',
  '0x44a0e3e0': 'AttestationAlreadyRevoked',
  '0x203d82d8': 'AttestationExpired',
  '0x6e648401': 'SchemaNotRevocable',
  '0x7e273289': 'InvalidResolver',
  '0x3e0a3e70': 'InvalidExpirationTime',
  '0xe5523a5e': 'InsufficientFee',
  '0xf4d678b8': 'InsufficientTokenBalance',
  '0x1a5e6f57': 'UnauthorizedRevoker',
  '0x82b42900': 'Unauthorized',
  '0xd7b78d1d': 'NotWhitelisted',
  '0x5cd83e93': 'NotDelegate',
  '0x1c3c9e84': 'DelegateAlreadyAdded',
  '0x37e7bcdd': 'DelegateNotFound',
  '0x5a5b4f7e': 'ResolverRejected',
};

/** User-friendly messages for each known error */
const FRIENDLY_MESSAGES: Record<string, string> = {
  SchemaAlreadyExists:
    'This schema definition already exists on-chain. You can use the existing schema UID to create attestations — no need to deploy it again.',
  SchemaNotFound:
    'No schema found with this UID. Double-check the UID and make sure the schema has been registered.',
  AttestationNotFound:
    'No attestation found with this UID. Verify the UID is correct.',
  AuthorityNotFound:
    'This address is not registered as an authority. Register first using the Register Authority tool.',
  AttestationAlreadyRevoked:
    'This attestation has already been revoked.',
  AttestationExpired:
    'This attestation has expired and can no longer be modified.',
  SchemaNotRevocable:
    'This schema was deployed as non-revocable. Attestations created under it cannot be revoked.',
  InvalidResolver:
    'The resolver address is invalid. Use a valid contract address or leave it empty for no resolver.',
  InvalidExpirationTime:
    'The expiration time must be a future Unix timestamp, or set to 0 for no expiration.',
  InsufficientFee:
    'Insufficient deposited balance in the Fee Resolver. Deposit more HBAR using the Fee Resolver tool before attesting.',
  InsufficientTokenBalance:
    'You don\'t hold enough tokens to attest against this token-gated schema. Check the minimum balance requirement in the Token Gated Resolver tool.',
  UnauthorizedRevoker:
    'Only the original attester can revoke this attestation. Make sure you\'re connected with the wallet that created it.',
  Unauthorized:
    'Only the contract owner (admin) can perform this action. Switch to the Admin wallet in MetaMask.',
  NotWhitelisted:
    'Your address is not on the whitelist for this schema. Ask the admin to add your address using the Whitelist Manager tool.',
  NotDelegate:
    'You are not a delegate for this authority. The authority owner must add you as a delegate first.',
  DelegateAlreadyAdded:
    'This address is already registered as a delegate for this authority.',
  DelegateNotFound:
    'This address is not a delegate for the specified authority.',
  ResolverRejected:
    'The schema\'s resolver contract rejected this operation. Check the resolver requirements (whitelist, fee, token balance, etc.).',
};

/**
 * Parse a raw error (from ethers.js / MetaMask / SDK) into a user-friendly string.
 */
export function parseContractError(err: unknown): string {
  if (!err) return 'An unknown error occurred.';

  const message = err instanceof Error ? err.message : String(err);

  // 1. User rejected the transaction in MetaMask / wallet
  if (
    message.includes('user rejected') ||
    message.includes('User denied') ||
    message.includes('ACTION_REJECTED') ||
    message.includes('user denied transaction')
  ) {
    return 'Transaction was rejected in your wallet.';
  }

  // 2. Network / connection errors
  if (
    message.includes('NETWORK_ERROR') ||
    message.includes('network changed') ||
    message.includes('could not detect network') ||
    message.includes('ECONNREFUSED') ||
    message.includes('Failed to fetch') ||
    message.includes('TIMEOUT') ||
    message.includes('timeout')
  ) {
    return 'Network error — check your internet connection and make sure you\'re on Hedera Testnet (Chain ID 296).';
  }

  // 3. Insufficient gas / funds
  if (
    message.includes('insufficient funds') ||
    message.includes('INSUFFICIENT_FUNDS') ||
    message.includes('UNPREDICTABLE_GAS_LIMIT') && message.includes('insufficient')
  ) {
    return 'Insufficient HBAR in your wallet to pay for gas. Get testnet HBAR from https://portal.hedera.com/faucet';
  }

  // 4. Nonce errors
  if (message.includes('nonce') && (message.includes('too low') || message.includes('already been used'))) {
    return 'Transaction nonce conflict. Try again — if the issue persists, reset your MetaMask account (Settings → Advanced → Clear activity tab data).';
  }

  // 5. Try to match known error names in the message string
  for (const [name, friendly] of Object.entries(FRIENDLY_MESSAGES)) {
    if (message.includes(name)) {
      return friendly;
    }
  }

  // 6. Try to match error selector from revert data
  const dataMatch = message.match(/data="(0x[a-fA-F0-9]+)"/);
  if (dataMatch) {
    const selector = dataMatch[1].slice(0, 10).toLowerCase();
    for (const [sel, name] of Object.entries(ERROR_SELECTORS)) {
      if (selector === sel && FRIENDLY_MESSAGES[name]) {
        return FRIENDLY_MESSAGES[name];
      }
    }
  }

  // 7. Also check if the raw data field starts with a known selector
  const rawDataMatch = message.match(/0x[a-fA-F0-9]{8}/);
  if (rawDataMatch) {
    const selector = rawDataMatch[0].toLowerCase();
    for (const [sel, name] of Object.entries(ERROR_SELECTORS)) {
      if (selector === sel && FRIENDLY_MESSAGES[name]) {
        return FRIENDLY_MESSAGES[name];
      }
    }
  }

  // 8. Generic "execution reverted" without a known error
  if (message.includes('execution reverted') || message.includes('CALL_EXCEPTION')) {
    return 'Transaction reverted by the smart contract. This may be a permissions issue — check that you\'re using the correct wallet and have the required access.';
  }

  // 9. Fallback — return a cleaned-up version of the raw message
  // Strip ethers.js noise like (action=..., code=..., version=...)
  const cleaned = message
    .replace(/\s*\(action="[^"]*".*?\)/g, '')
    .replace(/\s*\(code=[A-Z_]+,\s*version=[\d.]+\)/g, '')
    .trim();

  return cleaned || 'An unexpected error occurred. Please try again.';
}

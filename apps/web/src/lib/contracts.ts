export const DEPLOYED_ADDRESSES = {
  SchemaRegistry: '0x8320Ae819556C449825F8255e92E7e1bc06c2e80',
  AttestationService: '0xce573F82e73F49721255088C7b4D849ad0F64331',
  WhitelistResolver: '0x461349A8aEfB220A48b61923095DfF237465c27A',
  TokenGatedResolver: '0x7d04a83cF73CD4853dB4E378DD127440d444718c',
  FeeResolver: '0x7460B74e14d17f0f852959D69Db3F1EAE72aF37C',
} as const;

export const HCS_TOPICS = {
  schemas: '0.0.8221945',
  attestations: '0.0.8221946',
  authorities: '0.0.8221947',
} as const;

export const SCHEMA_REGISTRY_ABI = [
  'function register(string definition, address resolver, bool revocable) external returns (bytes32)',
  'function getSchema(bytes32 uid) external view returns (tuple(bytes32 uid, string definition, address authority, address resolver, bool revocable, uint64 timestamp))',
  'event SchemaRegistered(bytes32 indexed uid, address indexed authority, address resolver)',
] as const;

export const ATTESTATION_SERVICE_ABI = [
  'function attest(bytes32 schemaUid, address subject, bytes data, uint64 expirationTime) external returns (bytes32)',
  'function revoke(bytes32 attestationUid) external',
  'function getAttestation(bytes32 uid) external view returns (tuple(bytes32 uid, bytes32 schemaUid, address attester, address subject, bytes data, uint64 timestamp, uint64 expirationTime, bool revoked, uint64 revocationTime, uint256 nonce))',
  'function registerAuthority(string metadata) external',
  'function getAuthority(address addr) external view returns (tuple(address addr, string metadata, bool isVerified, uint64 registeredAt))',
  'function setAuthorityVerification(address addr, bool verified) external',
  'function addDelegate(address delegate) external',
  'function removeDelegate(address delegate) external',
  'function isDelegate(address authority, address delegate) external view returns (bool)',
  'function getDelegates(address authority) external view returns (address[])',
  'function attestOnBehalf(address authority, bytes32 schemaUid, address subject, bytes data, uint64 expirationTime) external returns (bytes32)',
  'function revokeOnBehalf(bytes32 attestationUid) external',
  'event AttestationCreated(bytes32 indexed uid, bytes32 indexed schemaUid, address indexed attester, address subject)',
  'event AttestationRevoked(bytes32 indexed uid, address indexed revoker)',
  'event AuthorityRegistered(address indexed authority)',
  'event DelegateAdded(address indexed authority, address indexed delegate)',
  'event DelegateRemoved(address indexed authority, address indexed delegate)',
] as const;

export const WHITELIST_RESOLVER_ABI = [
  'function addAddress(address account) external',
  'function removeAddress(address account) external',
  'function whitelisted(address) external view returns (bool)',
  'function owner() external view returns (address)',
] as const;

export const FEE_RESOLVER_ABI = [
  'function deposit() external payable',
  'function setFee(uint256 _fee) external',
  'function withdraw() external',
  'function fee() external view returns (uint256)',
  'function balances(address) external view returns (uint256)',
  'function owner() external view returns (address)',
] as const;

export const TOKEN_GATED_RESOLVER_ABI = [
  'function setTokenConfig(address _tokenAddress, uint256 _minimumBalance) external',
  'function tokenAddress() external view returns (address)',
  'function minimumBalance() external view returns (uint256)',
  'function owner() external view returns (address)',
] as const;

export const TOKEN_REWARD_RESOLVER_ABI = [
  'function setRewardConfig(address _rewardToken, uint256 _rewardAmount) external',
  'function rewardToken() external view returns (address)',
  'function rewardAmount() external view returns (uint256)',
  'function rewardsDistributed(address) external view returns (uint256)',
  'function owner() external view returns (address)',
] as const;

export const CROSS_CONTRACT_RESOLVER_ABI = [
  'function setPipeline(address[] _resolvers) external',
  'function getPipeline() external view returns (address[])',
  'function pipelineLength() external view returns (uint256)',
  'function owner() external view returns (address)',
] as const;

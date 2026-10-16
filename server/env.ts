export const env = {
  get databaseUrl() { return process.env.DATABASE_URL ?? ""; },
  get jwtSecret() { return process.env.JWT_SECRET ?? ""; },
  get rpcUrl() { return process.env.CHAIN_RPC_URL ?? ""; },
  get operatorKey() { return process.env.OPERATOR_PRIVATE_KEY ?? ""; },
  get contractAddress() { return process.env.CONTRACT_ADDRESS?.trim() || ""; },
  get chainId() { return Number(process.env.CHAIN_ID) || 11155111; },
  get explorerTxBase() { return process.env.EXPLORER_TX_BASE || "https://sepolia.etherscan.io/tx/"; },
  get waitSeconds() { return Number(process.env.CHAIN_WAIT_SECONDS) || 40; },
};

export const chainConfigured = () => Boolean(env.rpcUrl && env.operatorKey);

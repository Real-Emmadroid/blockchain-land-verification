import { createHash } from "node:crypto";
import { sql as dsql } from "drizzle-orm";
import { Contract, ContractFactory, JsonRpcProvider, Wallet, formatEther } from "ethers";
import { db, LOCK_CHAIN, type Tx } from "./db";
import { chainConfigured, env } from "./env";
import { CHAIN_UNAVAILABLE, HttpError } from "./errors";
import { ABI, BYTECODE, BYTECODE_SHA256 } from "./contract/registry";

type AnyContract = Contract & Record<string, (...args: any[]) => Promise<any>>;

let provider: JsonRpcProvider | null = null;
let wallet: Wallet | null = null;

export function requireConfigured() {
  if (!chainConfigured()) throw new HttpError(503, CHAIN_UNAVAILABLE);
}

export function checkBytecode() {
  const actual = createHash("sha256").update(BYTECODE).digest("hex");
  if (actual !== BYTECODE_SHA256) {
    throw new HttpError(500, "The contract bytecode file is corrupted. Copy the appendix again exactly.");
  }
}

export function getProvider() {
  requireConfigured();
  if (!provider) {
    provider = new JsonRpcProvider(env.rpcUrl, env.chainId, { staticNetwork: true, cacheTimeout: -1 });
  }
  return provider;
}

export function getWallet() {
  if (!wallet) {
    try {
      const key = env.operatorKey;
      wallet = new Wallet(key.startsWith("0x") ? key : `0x${key}`, getProvider());
    } catch {
      throw new HttpError(503, CHAIN_UNAVAILABLE);
    }
  }
  return wallet;
}

/** Turns an ethers or network failure into the API's 502 / 503 error. */
export function chainError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  const e = err as {
    code?: string;
    message?: string;
    shortMessage?: string;
    reason?: string;
    revert?: { args?: unknown[] };
    info?: { error?: { message?: string } };
  };
  const msg = String(e?.message ?? "");
  if (
    ["NETWORK_ERROR", "SERVER_ERROR", "TIMEOUT"].includes(e?.code ?? "") ||
    /ECONNREFUSED|ENOTFOUND|fetch failed|ETIMEDOUT|ECONNRESET|rate limit/i.test(msg)
  ) {
    return new HttpError(503, CHAIN_UNAVAILABLE);
  }
  if (e?.code === "INSUFFICIENT_FUNDS" || /insufficient funds/i.test(msg)) {
    return new HttpError(502, "Insufficient funds: the operator wallet needs test ETH. Request some from a Sepolia faucet.");
  }
  const revertArg = e?.revert?.args?.[0];
  const reason =
    (typeof e?.reason === "string" && e.reason) ||
    (typeof revertArg === "string" && revertArg) ||
    e?.info?.error?.message ||
    e?.shortMessage ||
    msg ||
    "The transaction was rejected.";
  return new HttpError(502, `The blockchain rejected the transaction: ${reason}`);
}

export type ContractRef = { address: string; source: "env" | "auto" };

/** Finds the contract without ever deploying one. */
export async function readContractAddress(): Promise<ContractRef | null> {
  if (env.contractAddress) return { address: env.contractAddress, source: "env" };
  const rows = await db().execute(dsql`select value from chain_settings where key = 'contract_address'`);
  const saved = (rows[0] as { value?: string } | undefined)?.value;
  if (!saved) return null;
  try {
    const code = await getProvider().getCode(saved);
    return code !== "0x" ? { address: saved, source: "auto" } : null;
  } catch (err) {
    throw chainError(err);
  }
}

export async function getReadContract(): Promise<AnyContract> {
  requireConfigured();
  checkBytecode();
  const ref = await readContractAddress();
  if (!ref) throw new HttpError(503, "The blockchain contract has not been set up yet.");
  return new Contract(ref.address, ABI, getProvider()) as AnyContract;
}

async function withTimeout<T>(p: Promise<T>, seconds: number): Promise<T | "timeout"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), seconds * 1000);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function nextNonce() {
  return getProvider().getTransactionCount(getWallet().address, "pending");
}

/** Returns the contract address, deploying the contract first when none exists yet. */
export async function ensureContract(): Promise<ContractRef> {
  requireConfigured();
  checkBytecode();
  try {
    const existing = await readContractAddress();
    if (existing) return existing;
    const w = getWallet();

    return await db().transaction(async (tx: Tx) => {
      await tx.execute(dsql`select pg_advisory_xact_lock(${LOCK_CHAIN})`);
      const get = async (key: string) =>
        ((await tx.execute(dsql`select value from chain_settings where key = ${key}`))[0] as { value?: string } | undefined)?.value;
      const set = (key: string, value: string) =>
        tx.execute(
          dsql`insert into chain_settings (key, value) values (${key}, ${value}) on conflict (key) do update set value = excluded.value`,
        );

      // Another request may have deployed while this one waited for the lock.
      for (const key of ["contract_address", "pending_contract_address"]) {
        const saved = await get(key);
        if (saved && (await getProvider().getCode(saved)) !== "0x") {
          await set("contract_address", saved);
          return { address: saved, source: "auto" as const };
        }
      }

      const factory = new ContractFactory(ABI, `0x${BYTECODE}`, w);
      const nonce = await nextNonce();
      const contract = await factory.deploy({ nonce });
      const address = await contract.getAddress();
      await set("pending_contract_address", address);
      const done = await withTimeout(contract.waitForDeployment(), env.waitSeconds);
      if (done === "timeout") {
        throw new HttpError(502, "The contract deployment was sent but is not confirmed yet. Wait a minute and try again.");
      }
      await set("contract_address", address);
      return { address, source: "auto" as const };
    });
  } catch (err) {
    throw chainError(err);
  }
}

/**
 * Sends one write transaction. The advisory lock covers "read the pending nonce, send"
 * so two requests cannot reuse a nonce. It is released after the send, not after confirmation.
 */
export async function sendTx(method: string, args: unknown[]): Promise<{ hash: string }> {
  const ref = await ensureContract();
  try {
    return await db().transaction(async (tx: Tx) => {
      await tx.execute(dsql`select pg_advisory_xact_lock(${LOCK_CHAIN})`);
      const contract = new Contract(ref.address, ABI, getWallet()) as AnyContract;
      const nonce = await nextNonce();
      const response = await contract[method](...args, { nonce });
      return { hash: response.hash as string };
    });
  } catch (err) {
    throw chainError(err);
  }
}

export type ReceiptState = "confirmed" | "failed" | "pending";

/** Waits up to `seconds` for one confirmation. Never throws. */
export async function waitForReceipt(hash: string, seconds = env.waitSeconds): Promise<ReceiptState> {
  try {
    const receipt = await getProvider().waitForTransaction(hash, 1, seconds * 1000);
    if (!receipt) return "pending";
    return receipt.status === 1 ? "confirmed" : "failed";
  } catch {
    return "pending";
  }
}

/** Looks up a receipt once, without waiting. */
export async function checkReceipt(hash: string): Promise<ReceiptState> {
  try {
    const receipt = await getProvider().getTransactionReceipt(hash);
    if (!receipt) return "pending";
    return receipt.status === 1 ? "confirmed" : "failed";
  } catch (err) {
    throw chainError(err);
  }
}

export const toBytes32 = (sha256: string) => `0x${sha256}`;
export const ownerRef = (userId: number) => `USR-${userId}`;

export async function chainStatus() {
  const base = {
    configured: chainConfigured(),
    connected: false,
    chainId: null as number | null,
    blockNumber: null as number | null,
    contractAddress: null as string | null,
    contractSource: null as "env" | "auto" | null,
    operatorAddress: null as string | null,
    operatorBalanceEth: null as string | null,
    contractOperatorMatches: null as boolean | null,
  };
  if (!base.configured) return base;
  try {
    const p = getProvider();
    const w = getWallet();
    base.operatorAddress = w.address;
    base.blockNumber = await p.getBlockNumber();
    base.connected = true;
    base.chainId = env.chainId;
    base.operatorBalanceEth = formatEther(await p.getBalance(w.address));
    const ref = await readContractAddress();
    if (ref) {
      base.contractAddress = ref.address;
      base.contractSource = ref.source;
      try {
        checkBytecode();
        const c = new Contract(ref.address, ABI, p) as AnyContract;
        base.contractOperatorMatches = String(await c.operator()).toLowerCase() === w.address.toLowerCase();
      } catch {
        base.contractOperatorMatches = null;
      }
    }
  } catch {
    base.connected = false;
  }
  return base;
}

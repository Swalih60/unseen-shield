// The scanner: finds which contracts can spend a wallet's tokens.
//
// It asks the chain directly (allowance, Permit2 allowance, balances, prices)
// and bundles everything into one Multicall, so a full scan is a handful of
// requests instead of hundreds. That matters when every request travels
// through a slow anonymizing network.

import { erc20Abi, formatUnits, isAddress, getAddress, type Address, type PublicClient } from "viem";
import { normalize } from "viem/ens";
import { PERMIT2, PRICE_FEEDS, SPENDERS, TOKENS, type Spender, type Token } from "./registry";

const permit2Abi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
    ],
    outputs: [],
  },
] as const;

const feedAbi = [
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

export { permit2Abi };

export type Severity = "critical" | "medium" | "low";

export type Approval = {
  id: string;
  token: Token;
  spender: Spender;
  amount: bigint;
  unlimited: boolean;
  viaPermit2: boolean;
  expiresAt?: number;
  balance: bigint;
  usdExposed: number | null;
  severity: Severity;
  reason: string;
};

// A second, independent provider answers the same questions at the same block.
// If both agree, one dishonest provider can't fake a "safe" result.
export type CrossCheck = { state: "agreed"; providers: string[] } | { state: "disagreed"; providers: string[] } | { state: "skipped"; reason: string };

export type WalletReport = {
  input: string;
  address: Address;
  ensName?: string;
  ethBalance: bigint;
  approvals: Approval[];
  exposedUsd: number;
  score: number;
  scannedAt: number;
  reads: number;
  crossCheck: CrossCheck;
};

// Anything at or above 2^96 base units is effectively "everything you'll ever hold".
const UNLIMITED = 2n ** 96n;

export async function resolveWallet(client: PublicClient, input: string): Promise<{ address: Address; ensName?: string }> {
  const value = input.trim();
  if (isAddress(value)) return { address: getAddress(value) };
  if (value.includes(".")) {
    const address = await client.getEnsAddress({ name: normalize(value) });
    if (!address) throw new Error(`${value} doesn't point to any wallet.`);
    return { address, ensName: value };
  }
  throw new Error(`"${value}" isn't a wallet address or an ENS name.`);
}

type CrossCheckOptions = {
  // The provider that answered a given private path most recently.
  providerOf: (isolationKey: string) => string | undefined;
  mainKey: string;
  // A second private client on its own path that avoids the given provider.
  makeClient: (avoid: string | undefined) => { client: PublicClient; key: string };
};

export async function scanWallet(
  client: PublicClient,
  input: string,
  readsBefore: () => number,
  verify?: CrossCheckOptions,
): Promise<WalletReport> {
  const start = readsBefore();
  const { address: owner, ensName } = await resolveWallet(client, input);

  const directPairs = TOKENS.flatMap((token) =>
    SPENDERS.filter((s) => !s.viaPermit2).map((spender) => ({ token, spender })),
  );
  const permit2Pairs = TOKENS.flatMap((token) =>
    SPENDERS.filter((s) => s.viaPermit2).map((spender) => ({ token, spender })),
  );

  const contracts = [
    ...directPairs.map(({ token, spender }) => ({
      address: token.address,
      abi: erc20Abi,
      functionName: "allowance" as const,
      args: [owner, spender.address] as const,
    })),
    ...permit2Pairs.map(({ token, spender }) => ({
      address: PERMIT2,
      abi: permit2Abi,
      functionName: "allowance" as const,
      args: [owner, token.address, spender.address] as const,
    })),
    ...TOKENS.map((token) => ({
      address: token.address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: [owner] as const,
    })),
    { address: PRICE_FEEDS.eth, abi: feedAbi, functionName: "latestRoundData" as const },
    { address: PRICE_FEEDS.btc, abi: feedAbi, functionName: "latestRoundData" as const },
  ];

  // Read at a fixed block, a couple behind the tip, so a second provider can answer the exact same question.
  const blockNumber = (await client.getBlockNumber()) - 2n;
  const [results, ethBalance] = await Promise.all([
    client.multicall({ contracts, allowFailure: true, blockNumber, batchSize: 64_000 }),
    client.getBalance({ address: owner, blockNumber }),
  ]);

  let crossCheck: CrossCheck = { state: "skipped", reason: "Not requested" };
  if (verify) {
    try {
      const first = verify.providerOf(verify.mainKey);
      const checker = verify.makeClient(first);
      const again = await checker.client.multicall({ contracts, allowFailure: true, blockNumber, batchSize: 64_000 });
      const { compared, mismatched } = compare(results, again);
      const providers = [first ?? "first provider", verify.providerOf(checker.key) ?? "second provider"];
      crossCheck =
        mismatched > 0
          ? { state: "disagreed", providers }
          : compared === 0
            ? { state: "skipped", reason: "The second provider couldn't answer" }
            : { state: "agreed", providers };
    } catch {
      crossCheck = { state: "skipped", reason: "No second provider answered in time" };
    }
  }

  let i = 0;
  const direct = directPairs.map((p) => ({ ...p, r: results[i++] }));
  const viaP2 = permit2Pairs.map((p) => ({ ...p, r: results[i++] }));
  const balances = new Map<string, bigint>();
  for (const token of TOKENS) {
    const r = results[i++];
    balances.set(token.address, r.status === "success" ? (r.result as bigint) : 0n);
  }
  const ethUsd = feedPrice(results[i++]);
  const btcUsd = feedPrice(results[i++]);
  const priceOf = (t: Token) => (t.price === "usd" ? 1 : t.price === "eth" ? ethUsd : t.price === "btc" ? btcUsd : null);

  const now = Math.floor(Date.now() / 1000);
  const approvals: Approval[] = [];

  for (const { token, spender, r } of direct) {
    if (r.status !== "success") continue;
    const amount = r.result as bigint;
    if (amount === 0n) continue;
    approvals.push(build(token, spender, amount, false, undefined));
  }
  for (const { token, spender, r } of viaP2) {
    if (r.status !== "success") continue;
    const [amount, expiration] = r.result as readonly [bigint, number, number];
    if (amount === 0n || Number(expiration) <= now) continue;
    approvals.push(build(token, spender, amount, true, Number(expiration)));
  }

  function build(token: Token, spender: Spender, amount: bigint, viaPermit2: boolean, expiresAt?: number): Approval {
    const balance = balances.get(token.address) ?? 0n;
    const unlimited = amount >= UNLIMITED;
    const reachable = amount < balance ? amount : balance;
    const price = priceOf(token);
    const usdExposed = price === null ? null : Number(formatUnits(reachable, token.decimals)) * price;
    const { severity, reason } = judge(token, spender, unlimited, balance);
    return {
      id: `${token.address}-${spender.address}-${viaPermit2 ? "p2" : "erc20"}`,
      token,
      spender,
      amount,
      unlimited,
      viaPermit2,
      expiresAt,
      balance,
      usdExposed,
      severity,
      reason,
    };
  }

  const order: Record<Severity, number> = { critical: 0, medium: 1, low: 2 };
  approvals.sort((a, b) => order[a.severity] - order[b.severity] || (b.usdExposed ?? 0) - (a.usdExposed ?? 0));

  // Exposure per token: the most any single approval can reach, not a double count.
  const perToken = new Map<string, number>();
  for (const a of approvals) {
    if (a.severity === "low" || a.usdExposed === null) continue;
    perToken.set(a.token.address, Math.max(perToken.get(a.token.address) ?? 0, a.usdExposed));
  }
  const exposedUsd = [...perToken.values()].reduce((s, v) => s + v, 0);

  return {
    input,
    address: owner,
    ensName,
    ethBalance,
    approvals,
    exposedUsd,
    score: scoreOf(approvals),
    scannedAt: Date.now(),
    reads: readsBefore() - start,
    crossCheck,
  };
}

function judge(token: Token, spender: Spender, unlimited: boolean, balance: bigint): { severity: Severity; reason: string } {
  if (spender.kind === "exploited") {
    return {
      severity: "critical",
      reason: `${spender.name} was hacked through approvals like this one. Revoke it now.`,
    };
  }
  if (unlimited && balance > 0n) {
    return {
      severity: "medium",
      reason: `Unlimited. If ${spender.name} is ever hacked, all of your ${token.symbol} can be taken without asking you.`,
    };
  }
  if (unlimited) {
    return {
      severity: "low",
      reason: `Unlimited, but you hold no ${token.symbol} right now. Anything you receive later would be exposed.`,
    };
  }
  return { severity: "low", reason: `Limited to a set amount. Low risk.` };
}

function scoreOf(approvals: Approval[]) {
  let score = 100;
  for (const a of approvals) score -= a.severity === "critical" ? 45 : a.severity === "medium" ? 12 : 3;
  return Math.max(0, score);
}

// Compare only answers both providers actually gave. A free provider refusing a
// call (rate or gas limits) is not a disagreement; a different number is.
function compare(a: readonly { status: string; result?: unknown }[], b: readonly { status: string; result?: unknown }[]) {
  const text = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x));
  let compared = 0;
  let mismatched = 0;
  a.forEach((r, i) => {
    const other = b[i];
    if (r.status !== "success" || other?.status !== "success") return;
    compared++;
    if (text(r.result) !== text(other.result)) mismatched++;
  });
  return { compared, mismatched };
}

function feedPrice(r: { status: string; result?: unknown }): number | null {
  if (r.status !== "success") return null;
  const [, answer] = r.result as readonly [bigint, bigint];
  return Number(answer) / 1e8;
}

export function formatAmount(amount: bigint, decimals: number): string {
  const n = Number(formatUnits(amount, decimals));
  if (n === 0) return "0";
  if (n < 0.0001) return "<0.0001";
  return n.toLocaleString("en-US", { maximumFractionDigits: n < 1 ? 4 : 2 });
}

export function formatUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 100 ? 2 : 0 });
}

export function shortAddress(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

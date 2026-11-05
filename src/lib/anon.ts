// The private connection.
//
// Every question this app asks Ethereum goes through an Anon-RPC worker: a
// hash-pinned client for an anonymizing network (Tor, Nym, Nox) that the
// Ethereum Foundation's harness runs in a sandbox. The RPC server answers,
// but it never sees the user's IP, and calls under different isolation keys
// can't be linked to each other.
//
// There is deliberately no silent fallback to a direct connection. If the
// private network fails, the scan stops and says so.

import { custom, createPublicClient, type PublicClient } from "viem";
import { mainnet } from "viem/chains";
import type { AnonRpcWorker as AnonRpcWorkerType } from "@anon-rpc/browser-harness";

export type NetworkId = "tor" | "nym" | "nox" | "passthrough";

export type AnonNetwork = {
  id: NetworkId;
  name: string;
  blurb: string;
  // The on-chain IWorkerSpecifier contract that pins the worker bundle by hash.
  specifier: `0x${string}`;
  // The chain the specifier lives on (the bootstrap read happens there).
  specifierChain: "mainnet" | "sepolia";
  config?: Record<string, unknown>;
  private: boolean;
};

// Specifier addresses come from the official adopters list:
// https://github.com/ethereum/anon-rpc/blob/main/adopters.json5
export const NETWORKS: Record<NetworkId, AnonNetwork> = {
  tor: {
    id: "tor",
    name: "Tor",
    blurb: "A full Tor client running inside your browser. Three relays between you and the server.",
    specifier: "0x700dA3193D35fA54Cd3fBf29B66f2a2A0385659e",
    specifierChain: "mainnet",
    config: { gateways: ["152.236.3.22:12298:uEiCH0VdbhryzJcMtCfB0vLA4sOvHdQ4hq5w7CopcwU59bQ"] },
    private: true,
  },
  nym: {
    id: "nym",
    name: "Nym",
    blurb: "A mixnet that also shuffles timing, so traffic patterns can't be matched. About 18 MB to start.",
    specifier: "0x3aCD9742C68F6d993066Ae25533e09b9e1f60eD0",
    specifierChain: "mainnet",
    private: true,
  },
  nox: {
    id: "nox",
    name: "Nox",
    blurb: "A Sphinx mixnet with entry, mix and exit nodes. Experimental.",
    specifier: "0x35133267A8F7EC35046a83DCA0f4Ca8A6e1b7A9A",
    specifierChain: "sepolia",
    private: true,
  },
  passthrough: {
    id: "passthrough",
    name: "Passthrough (not private)",
    blurb: "The reference worker. Same sandbox, plain connection. For testing only.",
    specifier: "0x4fd77be300f31c5fe6ab266d35d27750a3478d27",
    specifierChain: "mainnet",
    private: false,
  },
};

// Used once, to read the specifier contract. It only learns that someone is
// reading the Anon-RPC specifier, nothing about any wallet.
const BOOTSTRAP_RPCS: Record<AnonNetwork["specifierChain"], string[]> = {
  mainnet: ["https://ethereum-rpc.publicnode.com", "https://1rpc.io/eth", "https://eth.drpc.org"],
  sepolia: ["https://ethereum-sepolia-rpc.publicnode.com", "https://sepolia.drpc.org", "https://1rpc.io/sepolia"],
};

// Where the private network delivers our questions. Some providers refuse
// traffic from anonymizing networks, so we rotate on failure.
const MAINNET_RPCS = [
  "https://ethereum-rpc.publicnode.com",
  "https://rpc.mevblocker.io",
  "https://eth-mainnet.public.blastapi.io",
  "https://1rpc.io/eth",
  "https://eth.drpc.org",
];

// ---------------------------------------------------------------------------
// Live status, so the interface can show exactly what is leaving the device.

export type Phase = "idle" | "connecting" | "ready" | "failed";

export type OutgoingRead = {
  id: number;
  method: string;
  at: number;
  ms: number;
  ok: boolean;
  endpoint: string;
  isolationKey: string;
};

export type AnonStatus = {
  network: NetworkId;
  phase: Phase;
  error?: string;
  connectMs?: number;
  // What the private network is doing right now, while it connects.
  progress?: string;
  connectStarted?: number;
  reads: OutgoingRead[];
  // Every answered request since the page opened.
  sent: number;
};

let status: AnonStatus = { network: "nym", phase: "idle", reads: [], sent: 0 };
const listeners = new Set<() => void>();

function setStatus(patch: Partial<AnonStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}

export const anonStatus = {
  get: () => status,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

// ---------------------------------------------------------------------------

let worker: AnonRpcWorkerType | null = null;
let workerNetwork: NetworkId | null = null;
let endpointIndex = 0;
let readCounter = 0;

async function bootstrapRequest(chain: AnonNetwork["specifierChain"], method: string, params?: unknown[]) {
  let lastError: unknown;
  for (const url of BOOTSTRAP_RPCS[chain]) {
    try {
      const res = await withTimeout(
        fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params ?? [] }),
        }),
        10_000,
        "Bootstrap read timed out",
      );
      const json = await res.json();
      if (json.error) throw new Error(json.error.message ?? "Bootstrap read failed");
      return json.result;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

// Each connection attempt gets a number. When the user switches networks, older
// attempts are abandoned: they close their own worker and never touch the
// shared state, so a slow old attempt can't kill the new connection.
let generation = 0;
let inflight: { network: NetworkId; gen: number; promise: Promise<AnonRpcWorkerType> } | null = null;

let pendingWorker: AnonRpcWorkerType | null = null;

class Superseded extends Error {}

/** Start (or reuse) the private connection. Safe to call many times. */
export function connect(networkId: NetworkId): Promise<AnonRpcWorkerType> {
  if (worker && workerNetwork === networkId && status.phase === "ready") return Promise.resolve(worker);
  // Already connecting to this network: share that attempt (React dev mode calls effects twice).
  if (inflight && inflight.network === networkId) return inflight.promise;

  const gen = ++generation;
  worker?.close();
  worker = null;
  workerNetwork = null;
  // Stop any attempt still connecting, so networks don't compete for bandwidth.
  pendingWorker?.close();
  pendingWorker = null;

  const network = NETWORKS[networkId];
  setStatus({
    network: networkId,
    phase: "connecting",
    error: undefined,
    connectMs: undefined,
    progress: "Downloading the private network client",
    connectStarted: Date.now(),
  });

  const promise = (async () => {
    const started = performance.now();
    let w: AnonRpcWorkerType | null = null;
    // Slow or flaky internet often fails the first try, so try twice before giving up.
    for (let attempt = 1; ; attempt++) {
      try {
        // The harness touches window and WebRTC, so load it only in the browser.
        const { AnonRpcWorker } = await import("@anon-rpc/browser-harness");
        if (gen !== generation) throw new Superseded();
        w = pendingWorker = new AnonRpcWorker({
          address: network.specifier,
          config: network.config as never,
          preExisting: {
            rpcProvider: {
              request: ({ method, params }) => bootstrapRequest(network.specifierChain, method, params),
            },
          },
        });
        followProgress(w, gen);
        await withTimeout(w.ready, 120_000, `${network.name} took too long to connect`);
        if (gen !== generation) throw new Superseded();
        worker = w;
        workerNetwork = networkId;
        pendingWorker = null;
        setStatus({ phase: "ready", connectMs: Math.round(performance.now() - started), progress: undefined });
        if (inflight?.gen === gen) inflight = null;
        return w;
      } catch (err) {
        if (worker !== w) w?.close();
        if (pendingWorker === w) pendingWorker = null;
        w = null;
        if (gen === generation && !(err instanceof Superseded) && attempt < 2 && !isClosed(err)) {
          setStatus({ progress: "First try failed. Trying again" });
          continue;
        }
        if (inflight?.gen === gen) inflight = null;
        if (gen === generation && !(err instanceof Superseded)) {
          setStatus({ phase: "failed", error: describeError(err, network.name), progress: undefined });
        }
        throw err;
      }
    }
  })();

  inflight = { network: networkId, gen, promise };
  return promise;
}

function isClosed(err: unknown) {
  return err instanceof Error && /clos/i.test(err.message);
}

// Turn the worker's own log lines into plain progress messages.
const PROGRESS: [RegExp, string][] = [
  [/gateway/i, "Reaching the network gateway"],
  [/consensus|directory|dirmgr/i, "Downloading the network map"],
  [/bootstrap complete/i, "Network map ready. Building your route"],
  [/guard/i, "Choosing relays"],
  [/client ready|tor ready|ready/i, "Route built"],
  [/mixnet|sphinx|gateway|connect/i, "Connecting to the mixnet"],
];

async function followProgress(w: AnonRpcWorkerType, gen: number) {
  try {
    for (;;) {
      const { args } = await w.acceptLog();
      if (gen !== generation || status.phase !== "connecting") continue;
      const line = args.map((a) => (typeof a === "string" ? a : "")).join(" ");
      const match = PROGRESS.find(([re]) => re.test(line));
      if (match && match[1] !== status.progress) setStatus({ progress: match[1] });
    }
  } catch {
    // The worker closed; nothing more to report.
  }
}

/** Drop the current route and build a fresh one (a new exit) on the same network. */
export async function reconnect() {
  const network = status.network;
  disconnect();
  return connect(network);
}

export class NoProviderAnswered extends Error {}

export function disconnect() {
  generation++;
  inflight = null;
  pendingWorker?.close();
  pendingWorker = null;
  worker?.close();
  worker = null;
  workerNetwork = null;
  setStatus({ phase: "idle", connectMs: undefined });
}

export function clearReads() {
  setStatus({ reads: [] });
}

export const sentCount = () => status.sent;

/**
 * A viem client whose every request travels through the private network.
 * `isolationKey` keeps calls for different wallets unlinkable from each other
 * (on networks that support it).
 */
export function privateClient(isolationKey: string, opts: { avoid?: string } = {}): PublicClient {
  return createPublicClient({
    chain: mainnet,
    batch: { multicall: { batchSize: 4096, wait: 16 } },
    transport: custom(
      {
        async request({ method, params }) {
          const w = worker;
          if (!w || status.phase !== "ready") {
            throw new Error("The private connection isn't ready. Connect first.");
          }
          return sendWithRotation(w, method, params, isolationKey, opts.avoid);
        },
      },
      // We already rotate providers ourselves; viem's own retries would only stack delays.
      { retryCount: 0 },
    ),
  }) as PublicClient;
}

/** The provider that most recently answered requests on this private path. */
export function providerOf(isolationKey: string) {
  return status.reads.find((r) => r.ok && r.isolationKey === isolationKey)?.endpoint;
}

async function sendWithRotation(
  w: AnonRpcWorkerType,
  method: string,
  params: unknown,
  isolationKey: string,
  avoid?: string,
) {
  // A cross-check client skips the provider that gave the first answer.
  const candidates = MAINNET_RPCS.map((_, i) => MAINNET_RPCS[(endpointIndex + i) % MAINNET_RPCS.length]).filter(
    (url) => new URL(url).host !== avoid,
  );
  let lastError: unknown;
  // Two providers in a row with no answer usually means the exit itself is dead,
  // so give up quickly and let the caller build a fresh route instead.
  for (const endpoint of candidates.slice(0, avoid ? 3 : 2)) {
    const started = performance.now();
    try {
      const res = await withTimeout(
        w.fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: ++readCounter, method, params: params ?? [] }),
          anonOptions: { isolationKey },
        }),
        30_000,
        "The private network didn't answer in time",
      );
      if (!res.ok) throw new Error(`${new URL(endpoint).host} answered ${res.status}`);
      const json = await res.json();
      logRead(method, started, true, endpoint, isolationKey);
      if (json.error) throw new RpcAnswerError(json.error.message ?? "RPC error");
      return json.result;
    } catch (err) {
      // A JSON-RPC error is a real answer (e.g. a reverted call): don't rotate.
      if (err instanceof RpcAnswerError) throw err;
      logRead(method, started, false, endpoint, isolationKey);
      lastError = err;
      if (!avoid) endpointIndex++;
    }
  }
  const why = lastError instanceof Error ? lastError.message : String(lastError);
  throw new NoProviderAnswered(
    `No RPC provider answered through ${NETWORKS[status.network].name} (${why}). The private network may be busy. Scan again, or switch network.`,
  );
}

class RpcAnswerError extends Error {}

function logRead(method: string, started: number, ok: boolean, endpoint: string, isolationKey: string) {
  const entry: OutgoingRead = {
    id: readCounter,
    method,
    at: Date.now(),
    ms: Math.round(performance.now() - started),
    ok,
    endpoint: new URL(endpoint).host,
    isolationKey,
  };
  setStatus({ reads: [entry, ...status.reads].slice(0, 200), sent: status.sent + (ok ? 1 : 0) });
}

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function describeError(err: unknown, networkName: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  return `${networkName} couldn't connect: ${msg}. Try again, or pick another network.`;
}

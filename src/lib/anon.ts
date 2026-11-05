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
  "https://1rpc.io/eth",
  "https://eth.drpc.org",
  "https://rpc.flashbots.net",
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
  reads: OutgoingRead[];
  // Every answered request since the page opened.
  sent: number;
};

let status: AnonStatus = { network: "tor", phase: "idle", reads: [], sent: 0 };
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

/** Start (or reuse) the private connection. Safe to call many times. */
export async function connect(networkId: NetworkId): Promise<AnonRpcWorkerType> {
  if (worker && workerNetwork === networkId && status.phase === "ready") return worker;
  if (worker) {
    worker.close();
    worker = null;
  }

  const network = NETWORKS[networkId];
  const started = performance.now();
  setStatus({ network: networkId, phase: "connecting", error: undefined, connectMs: undefined });

  try {
    // The harness touches window and WebRTC, so load it only in the browser.
    const { AnonRpcWorker } = await import("@anon-rpc/browser-harness");
    const w = new AnonRpcWorker({
      address: network.specifier,
      config: network.config as never,
      preExisting: {
        rpcProvider: {
          request: ({ method, params }) => bootstrapRequest(network.specifierChain, method, params),
        },
      },
    });
    worker = w;
    workerNetwork = networkId;
    await withTimeout(w.ready, 90_000, `${network.name} took too long to connect`);
    setStatus({ phase: "ready", connectMs: Math.round(performance.now() - started) });
    return w;
  } catch (err) {
    worker?.close();
    worker = null;
    workerNetwork = null;
    setStatus({ phase: "failed", error: describeError(err, network.name) });
    throw err;
  }
}

export function disconnect() {
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
export function privateClient(isolationKey: string): PublicClient {
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
        return sendWithRotation(w, method, params, isolationKey);
      },
      },
      // We already rotate providers ourselves; viem's own retries would only stack delays.
      { retryCount: 0 },
    ),
  }) as PublicClient;
}

async function sendWithRotation(w: AnonRpcWorkerType, method: string, params: unknown, isolationKey: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAINNET_RPCS.length; attempt++) {
    const endpoint = MAINNET_RPCS[endpointIndex % MAINNET_RPCS.length];
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
      endpointIndex++;
    }
  }
  throw lastError;
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

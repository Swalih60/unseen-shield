// LEAK LAB ONLY: the "normal way". A plain HTTP connection to our pretend
// provider (/api/spy), which records everything a real provider could.

import { createPublicClient, http, type PublicClient } from "viem";
import { mainnet } from "viem/chains";

let reads = 0;

export function leakyClient(): PublicClient {
  return createPublicClient({
    chain: mainnet,
    batch: { multicall: { batchSize: 4096, wait: 16 } },
    transport: http(`${window.location.origin}/api/spy`, {
      onFetchRequest() {
        reads++;
      },
    }),
  }) as PublicClient;
}

export const leakyReads = () => reads;

export type SpyNote = { at: number; ip: string; device: string; method: string; wallets: string[] };

export async function readSpyNotebook(): Promise<SpyNote[]> {
  const res = await fetch("/api/spy", { cache: "no-store" });
  return res.json();
}

export async function clearSpyNotebook() {
  await fetch("/api/spy", { method: "DELETE" });
}

"use client";

import { NETWORKS } from "@/lib/anon";
import { useAnon } from "./useAnon";

const FRIENDLY: Record<string, string> = {
  eth_call: "Contract reads, bundled",
  eth_getBalance: "ETH balance",
  eth_chainId: "Network check",
  eth_blockNumber: "Latest block",
  eth_getTransactionReceipt: "Revoke status",
};

// A record of exactly what left this device, so nobody has to take our word for it.
export function Ledger() {
  const anon = useAnon();
  const network = NETWORKS[anon.network];
  const paths = new Map<string, string>();
  let walletPaths = 0;
  let checkPaths = 0;
  for (const r of [...anon.reads].reverse()) {
    if (paths.has(r.isolationKey)) continue;
    const isCheck = r.isolationKey.startsWith("check:");
    const n = isCheck ? ++checkPaths : ++walletPaths;
    paths.set(r.isolationKey, `${isCheck ? "Double-check" : "Wallet"} ${n}`);
  }

  return (
    <section aria-labelledby="ledger-heading" className="rounded-3xl border border-line bg-deep/60 p-6 md:p-8">
      <h2 id="ledger-heading" className="font-display text-2xl font-semibold">
        What left this device
      </h2>
      <p className="mt-2 max-w-[60ch] text-fog">
        Every request this page has made. Each wallet travels on its own path, so even the private network
        can&apos;t tell that your wallets belong together.
      </p>

      <dl className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
        <Fact term="Your IP shown to RPC providers" value={network.private ? "Never" : "Yes, test mode"} good={network.private} />
        <Fact term="Wallets stored on a server" value="None. There is no server database." good />
        <Fact term="Trackers and analytics" value="None" good />
      </dl>

      {anon.reads.length === 0 ? (
        <p className="mt-6 text-sm text-fog">Nothing has left yet. Run a scan to see each request appear here.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-fog">
              <tr className="border-b border-line">
                <th scope="col" className="py-2 pr-4 font-medium">Time</th>
                <th scope="col" className="py-2 pr-4 font-medium">Request</th>
                <th scope="col" className="py-2 pr-4 font-medium">Path</th>
                <th scope="col" className="py-2 pr-4 font-medium">Answered by</th>
                <th scope="col" className="py-2 font-medium text-right">Took</th>
              </tr>
            </thead>
            <tbody>
              {anon.reads.slice(0, 12).map((r) => (
                <tr key={`${r.id}-${r.at}`} className="border-b border-line/60">
                  <td className="py-2.5 pr-4 font-mono text-fog tabular-nums">{new Date(r.at).toLocaleTimeString()}</td>
                  <td className="py-2.5 pr-4">{FRIENDLY[r.method] ?? r.method}</td>
                  <td className="py-2.5 pr-4 text-fog">{paths.get(r.isolationKey)}</td>
                  <td className="py-2.5 pr-4 font-mono text-fog">
                    {r.ok ? r.endpoint : <span className="text-ember">{r.endpoint}: no answer, tried the next</span>}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-fog">{(r.ms / 1000).toFixed(1)}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Fact({ term, value, good }: { term: string; value: string; good: boolean }) {
  return (
    <div className="bg-deep p-4">
      <dt className="text-sm text-fog">{term}</dt>
      <dd className={`mt-1 font-display text-lg font-semibold ${good ? "text-veil" : "text-ember"}`}>{value}</dd>
    </div>
  );
}

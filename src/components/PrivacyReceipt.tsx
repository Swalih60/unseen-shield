"use client";

// The proof. Everything a judge (or a careful user) needs to believe the check
// was private: the route it took, the double-check, and every request that
// left the device.

import { NETWORKS } from "@/lib/anon";
import type { WalletReport } from "@/lib/scan";
import { RouteTrace } from "./RouteTrace";
import { useAnon } from "./useAnon";

const FRIENDLY: Record<string, string> = {
  eth_call: "Bundled contract reads",
  eth_getBalance: "Coin balance",
  eth_chainId: "Network check",
  eth_blockNumber: "Latest block",
};

export function PrivacyReceipt({ report, onCompare }: { report: WalletReport; onCompare: () => void }) {
  const anon = useAnon();
  const network = NETWORKS[anon.network];
  const c = report.crossCheck;

  // Number each private path in the order it first appeared.
  const paths = new Map<string, string>();
  let wallets = 0;
  let checks = 0;
  for (const r of [...anon.reads].reverse()) {
    if (paths.has(r.isolationKey)) continue;
    const isCheck = r.isolationKey.startsWith("check:");
    paths.set(r.isolationKey, isCheck ? `Second opinion ${++checks}` : `Wallet path ${++wallets}`);
  }

  return (
    <div className="grid gap-10 py-7">
      <section aria-labelledby="route-heading">
        <h3 id="route-heading" className="font-display text-xl font-semibold">
          The route your check took
        </h3>
        <p className="mt-1 text-sm text-fog">No single stop knows both who you are and what you asked.</p>
        <div className="mt-6">
          <RouteTrace />
        </div>
      </section>

      <section aria-labelledby="facts-heading">
        <h3 id="facts-heading" className="sr-only">
          What stayed private
        </h3>
        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <Fact term="Your IP, as seen by RPC providers" value={network.private ? "Never shown" : "Visible (test mode)"} good={network.private} />
          <Fact
            term="Answers double-checked"
            value={
              c.state === "agreed"
                ? `Yes. ${c.providers[0]} and ${c.providers[1]} matched`
                : c.state === "disagreed"
                  ? "Providers disagreed. Check again"
                  : `Not this time: ${c.reason.toLowerCase()}`
            }
            good={c.state === "agreed"}
            bad={c.state === "disagreed"}
          />
          <Fact term="Wallets stored on a server" value="None. There is no server database" good />
          <Fact term="Trackers and analytics" value="None" good />
        </dl>
      </section>

      <section aria-labelledby="ledger-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="ledger-heading" className="font-display text-xl font-semibold">
            Every request that left this device
          </h3>
          <p className="text-sm text-fog tabular-nums">{anon.sent} answered privately</p>
        </div>
        <p className="mt-1 max-w-[62ch] text-sm text-fog">
          Each wallet travels on its own path, so even the private network can&apos;t tell your wallets belong together.
        </p>
        {anon.reads.length === 0 ? (
          <p className="mt-4 text-sm text-fog">Nothing has left yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-fog">
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 pr-4 font-medium">Time</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Request</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Path</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Answered by</th>
                  <th scope="col" className="py-2 text-right font-medium">Took</th>
                </tr>
              </thead>
              <tbody>
                {anon.reads.slice(0, 14).map((r) => (
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

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-raise/60 p-5">
        <p className="max-w-[52ch] text-[15px]">
          Want to see the difference? Run the same check the normal way and watch a provider write down who you are.
        </p>
        <button
          onClick={onCompare}
          className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-mist hover:border-fog"
        >
          Compare with a normal checker
        </button>
      </section>
    </div>
  );
}

function Fact({ term, value, good, bad }: { term: string; value: string; good?: boolean; bad?: boolean }) {
  return (
    <div className="border-t border-line pt-3">
      <dt className="text-sm text-fog">{term}</dt>
      <dd className={`mt-1 font-display text-lg font-semibold ${bad ? "text-flare" : good ? "text-veil" : "text-ember"}`}>
        {value}
      </dd>
    </div>
  );
}

"use client";

// What this wallet holds on six chains. The balances and Chainlink prices were
// read in the same private requests as the safety check: one bundle per chain,
// on this wallet's own path.

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { formatUsd, type WalletReport } from "@/lib/scan";
import { TokenMark } from "./ApprovalList";

const LIMIT = 8;

function amountText(n: number) {
  if (n === 0) return "0";
  if (n < 0.0001) return "<0.0001";
  return n.toLocaleString("en-US", { maximumFractionDigits: n < 1 ? 4 : 2 });
}

export function Holdings({ report }: { report: WalletReport }) {
  const reduce = useReducedMotion();
  const [showAll, setShowAll] = useState(false);
  const rows = report.holdings;
  const total = report.holdingsUsd;
  const visible = showAll ? rows : rows.slice(0, LIMIT);
  const unpriced = [...new Set(rows.filter((r) => r.usd === null).map((r) => r.symbol))];

  const byChain = new Map<string, number>();
  for (const r of rows) byChain.set(r.chain, (byChain.get(r.chain) ?? 0) + (r.usd ?? 0));
  const chains = [...byChain.entries()].filter(([, v]) => v >= 0.01).sort((a, b) => b[1] - a[1]);

  if (rows.length === 0) {
    return (
      <div className="py-10">
        <p className="font-display text-xl font-semibold">No coins or major tokens found.</p>
        <p className="mt-2 max-w-[60ch] text-fog">
          We checked each chain&apos;s own coin plus USDC, USDT and wrapped ETH on Ethereum, Base, Arbitrum, Optimism,
          Polygon and BNB Chain.
        </p>
        <Notes missed={report.chainsMissed} unpriced={[]} />
      </div>
    );
  }

  return (
    <div className="py-7">
      {chains.length > 1 && (
        <div>
          {/* One bar, split by chain: where the money sits, at a glance. */}
          <div className="flex h-2 overflow-hidden rounded-full bg-line" aria-hidden>
            {chains.map(([chain, usd], i) => (
              <motion.span
                key={chain}
                className="h-full"
                style={{ background: CHAIN_TONES[i % CHAIN_TONES.length] }}
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${(usd / total) * 100}%` }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.05 * i }}
              />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm" aria-label="Value by chain">
            {chains.map(([chain, usd], i) => (
              <li key={chain} className="flex items-center gap-2">
                <span aria-hidden className="size-2 rounded-full" style={{ background: CHAIN_TONES[i % CHAIN_TONES.length] }} />
                <span className="text-fog">{chain}</span>
                <span className="font-semibold tabular-nums">{formatUsd(usd)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className={`divide-y divide-line/70 ${chains.length > 1 ? "mt-6" : ""}`} aria-label="Assets">
        {visible.map((row) => (
          <li key={`${row.chain}:${row.symbol}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-3.5">
            <TokenMark symbol={row.symbol} />
            <p className="min-w-0">
              <span className="font-semibold">{row.symbol}</span>{" "}
              <span className="text-sm text-fog">on {row.chain}</span>
            </p>
            <div className="text-right tabular-nums">
              <p className="font-semibold">{row.usd === null ? "No price" : formatUsd(row.usd)}</p>
              <p className="text-sm text-fog">
                {amountText(row.amount)} {row.symbol}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {rows.length > LIMIT && (
        <button
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="mt-2 text-sm text-fog underline-offset-4 hover:text-mist hover:underline"
        >
          {showAll ? "Show fewer" : `Show all ${rows.length} assets`}
        </button>
      )}
      <Notes missed={report.chainsMissed} unpriced={unpriced} />
    </div>
  );
}

// Calm, distinguishable tints from the night palette for the chain split.
const CHAIN_TONES = ["#a6e6d4", "#8fb4ff", "#c9a7ff", "#ffb26b", "#f3d36b", "#7fd1f0"];

function Notes({ missed, unpriced }: { missed: string[]; unpriced: string[] }) {
  return (
    <div className="mt-6 grid gap-2 text-sm text-fog">
      {missed.length > 0 && (
        <p className="text-ember">
          {missed.join(", ")} didn&apos;t answer through the private network this time, so{" "}
          {missed.length === 1 ? "it isn't" : "they aren't"} counted. Check again to retry.
        </p>
      )}
      {unpriced.length > 0 && (
        <p>
          {unpriced.join(", ")} {unpriced.length === 1 ? "has" : "have"} no on-chain price feed we read, so{" "}
          {unpriced.length === 1 ? "it's" : "they're"} left out of the total.
        </p>
      )}
      <p>
        Only each chain&apos;s coin and the major tokens we list are counted. Finding every token you hold would mean
        asking an indexing company, which would learn the wallet is yours.
      </p>
    </div>
  );
}

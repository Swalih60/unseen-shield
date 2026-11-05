"use client";

// Your holdings across every wallet you scanned. The balances and prices were
// read in the same private requests as the safety scan, so the portfolio costs
// no extra requests, and no provider can see these wallets side by side.

import { motion, useReducedMotion } from "motion/react";
import { formatUsd, shortAddress, type WalletReport } from "@/lib/scan";

type Row = { symbol: string; name: string; amount: number; usd: number | null };

function combine(reports: WalletReport[]): Row[] {
  const bySymbol = new Map<string, Row>();
  for (const r of reports) {
    for (const h of r.holdings) {
      const row = bySymbol.get(h.symbol) ?? { symbol: h.symbol, name: h.name, amount: 0, usd: h.usd === null ? null : 0 };
      row.amount += h.amount;
      if (row.usd !== null && h.usd !== null) row.usd += h.usd;
      bySymbol.set(h.symbol, row);
    }
  }
  return [...bySymbol.values()].sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1));
}

function amountText(n: number) {
  if (n === 0) return "0";
  if (n < 0.0001) return "<0.0001";
  return n.toLocaleString("en-US", { maximumFractionDigits: n < 1 ? 4 : 2 });
}

export function Portfolio({ reports }: { reports: WalletReport[] }) {
  const reduce = useReducedMotion();
  const rows = combine(reports);
  const total = reports.reduce((s, r) => s + r.holdingsUsd, 0);
  const unpriced = rows.filter((r) => r.usd === null);

  return (
    <motion.section
      aria-labelledby="portfolio-heading"
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
      className="rounded-3xl border border-line bg-deep/80 p-6 md:p-8"
    >
      <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h2 id="portfolio-heading" className="font-display text-2xl font-semibold">
            Your portfolio
          </h2>
          <p className="mt-2 max-w-[56ch] text-fog">
            {reports.length > 1 ? `Across ${reports.length} wallets. ` : ""}
            Read in the same private requests as your safety check, so no provider saw{" "}
            {reports.length > 1 ? "these wallets together, or " : ""}who was looking.
          </p>
        </div>
        <p className="font-display text-[clamp(36px,5vw,52px)] font-semibold leading-none tracking-[-0.02em] tabular-nums md:text-right">
          {formatUsd(total)}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-fog">No ETH or tracked tokens in {reports.length > 1 ? "these wallets" : "this wallet"}.</p>
      ) : (
        <ul className="mt-8 grid gap-1" aria-label="Assets">
          {rows.map((row) => {
            const share = row.usd !== null && total > 0 ? row.usd / total : 0;
            return (
              <li key={row.symbol} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl px-2 py-3 hover:bg-raise/50">
                <span
                  aria-hidden
                  className="grid size-10 place-items-center rounded-full bg-night font-display text-[11px] font-semibold ring-1 ring-line"
                >
                  {row.symbol.slice(0, 5)}
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold">{row.symbol}</span>
                    <span className="text-sm text-fog">{row.name}</span>
                  </p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-line" aria-hidden>
                    <motion.div
                      className="h-full rounded-full bg-veil"
                      initial={reduce ? false : { width: 0 }}
                      animate={{ width: `${Math.max(share * 100, row.usd ? 1 : 0)}%` }}
                      transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1], delay: 0.15 }}
                    />
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  <p className="font-semibold">{row.usd === null ? "Price not checked" : formatUsd(row.usd)}</p>
                  <p className="text-sm text-fog">
                    {amountText(row.amount)} {row.symbol}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {reports.length > 1 && (
        <dl
          className={`mt-6 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 ${
            reports.length % 3 === 0 ? "lg:grid-cols-3" : ""
          }`}
        >
          {reports.map((r) => (
            <div key={r.address} className="bg-deep p-4">
              <dt className="font-mono text-sm text-fog">{r.ensName ?? shortAddress(r.address)}</dt>
              <dd className="mt-1 font-display text-lg font-semibold tabular-nums">{formatUsd(r.holdingsUsd)}</dd>
            </div>
          ))}
        </dl>
      )}

      {unpriced.length > 0 && (
        <p className="mt-5 text-sm text-fog">
          {unpriced.map((r) => r.symbol).join(", ")} {unpriced.length === 1 ? "isn't" : "aren't"} in the total: we
          only read on-chain prices for ETH, BTC and dollar tokens.
        </p>
      )}
    </motion.section>
  );
}

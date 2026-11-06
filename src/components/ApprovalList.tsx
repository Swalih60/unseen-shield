"use client";

import { useState } from "react";
import { SPENDERS, TOKENS } from "@/lib/registry";
import { revoke } from "@/lib/revoke";
import { formatAmount, formatUsd, shortAddress, type Approval, type Severity, type WalletReport } from "@/lib/scan";

const GROUPS: { severity: Severity; title: string; hint: string }[] = [
  { severity: "critical", title: "Revoke now", hint: "These contracts were drained through approvals like yours." },
  {
    severity: "medium",
    title: "Worth reviewing",
    hint: "Trusted today, but each can take every token you hold if it's ever hacked.",
  },
  { severity: "low", title: "Fine for now", hint: "Limited amounts, or tokens you don't hold." },
];

export function ApprovalList({ report }: { report: WalletReport }) {
  const [showLow, setShowLow] = useState(false);

  if (report.approvals.length === 0) {
    return (
      <div className="py-10">
        <p className="font-display text-xl font-semibold">Nothing we check can spend this wallet&apos;s tokens.</p>
        <p className="mt-2 max-w-[60ch] text-fog">
          We looked at {TOKENS.length} popular tokens against {SPENDERS.length} commonly approved contracts on Ethereum.
          Approvals on other chains, or for other tokens, aren&apos;t covered yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      {GROUPS.map((g) => {
        const items = report.approvals.filter((a) => a.severity === g.severity);
        if (items.length === 0) return null;
        const collapsed = g.severity === "low" && !showLow;
        return (
          <section key={g.severity} className="border-b border-line py-7 last:border-b-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="font-display text-xl font-semibold">
                {g.title} <span className="font-sans text-base font-normal text-fog tabular-nums">{items.length}</span>
              </h3>
              {g.severity === "low" ? (
                <button
                  onClick={() => setShowLow((v) => !v)}
                  aria-expanded={!collapsed}
                  className="text-sm text-fog underline-offset-4 hover:text-mist hover:underline"
                >
                  {collapsed ? "Show them" : "Hide them"}
                </button>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-fog">{g.hint}</p>
            {!collapsed && (
              <ul className="mt-4 divide-y divide-line/70">
                {items.map((a) => (
                  <ApprovalRow key={a.id} approval={a} owner={report.address} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <p className="pt-5 text-sm text-fog">
        Revoking sends a transaction from your own wallet, and every transaction on Ethereum is public. Checking stays
        private; cancelling can&apos;t be.
      </p>
    </div>
  );
}

type RevokeState =
  | { kind: "idle" }
  | { kind: "waiting" }
  | { kind: "sent"; hash: string }
  | { kind: "error"; message: string };

function ApprovalRow({ approval: a, owner }: { approval: Approval; owner: `0x${string}` }) {
  const [state, setState] = useState<RevokeState>({ kind: "idle" });
  const critical = a.severity === "critical";

  const onRevoke = async () => {
    setState({ kind: "waiting" });
    try {
      setState({ kind: "sent", hash: await revoke(a, owner) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState({
        kind: "error",
        message: /reject|denied/i.test(msg) ? "You cancelled the revoke in your wallet." : msg.split("\n")[0],
      });
    }
  };

  return (
    <li
      className={`grid gap-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center ${critical ? "-mx-3 my-1.5 rounded-xl border-0 bg-flare/[0.07] px-3" : ""}`}
    >
      <div className="flex min-w-0 gap-4">
        <TokenMark symbol={a.token.symbol} />
        <div className="min-w-0">
          <p className="text-[15px] leading-snug">
            <span className="font-semibold">{a.spender.name}</span> can spend your{" "}
            <span className="font-semibold">{a.token.symbol}</span>
          </p>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-fog">
            <span className={a.unlimited ? "text-mist" : undefined}>
              {a.unlimited ? "Unlimited" : `Up to ${formatAmount(a.amount, a.token.decimals)} ${a.token.symbol}`}
            </span>
            <span aria-hidden>/</span>
            <span>
              You hold {formatAmount(a.balance, a.token.decimals)} {a.token.symbol}
              {a.usdExposed !== null && a.usdExposed >= 0.01 ? ` (${formatUsd(a.usdExposed)})` : ""}
            </span>
            {a.viaPermit2 && (
              <>
                <span aria-hidden>/</span>
                <span>through Permit2</span>
              </>
            )}
          </p>
          <p className={`mt-2 max-w-[64ch] text-sm leading-relaxed ${critical ? "text-mist" : "text-mist/80"}`}>
            {critical ? a.spender.note : a.reason}
          </p>
          <a
            href={`https://etherscan.io/address/${a.spender.address}`}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-1 inline-block font-mono text-xs text-fog/80 underline-offset-4 hover:text-mist hover:underline"
          >
            {shortAddress(a.spender.address)}
          </a>
        </div>
      </div>

      <div className="flex flex-col items-start gap-2 pl-14 sm:items-end sm:pl-0">
        {state.kind === "sent" ? (
          <a
            href={`https://etherscan.io/tx/${state.hash}`}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-xl border border-veil/50 px-4 py-2.5 text-sm text-veil hover:bg-veil/10"
          >
            Revoke sent. View it
          </a>
        ) : (
          <button
            onClick={onRevoke}
            disabled={state.kind === "waiting"}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50 ${
              critical ? "bg-flare text-night hover:opacity-90" : "border border-line text-mist hover:border-fog"
            }`}
          >
            {state.kind === "waiting" ? "Confirm in your wallet…" : "Revoke"}
          </button>
        )}
        {state.kind === "error" && <p className="max-w-[30ch] text-sm text-flare sm:text-right">{state.message}</p>}
      </div>
    </li>
  );
}

export function TokenMark({ symbol }: { symbol: string }) {
  return (
    <span
      aria-hidden
      className="grid size-10 shrink-0 place-items-center rounded-full bg-night font-display text-[11px] font-semibold text-mist ring-1 ring-line"
    >
      {symbol.slice(0, 5)}
    </span>
  );
}

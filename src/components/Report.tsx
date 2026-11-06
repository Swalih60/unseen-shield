"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { revoke } from "@/lib/revoke";
import { SPENDERS, TOKENS } from "@/lib/registry";
import { formatAmount, formatUsd, shortAddress, type Approval, type Severity, type WalletReport } from "@/lib/scan";

const GROUPS: { severity: Severity; title: string; hint: string }[] = [
  { severity: "critical", title: "Revoke now", hint: "These contracts were hacked through approvals." },
  { severity: "medium", title: "Worth reviewing", hint: "Safe contracts today, but they can take everything if they're ever hacked." },
  { severity: "low", title: "Fine for now", hint: "Limited amounts, or tokens you don't hold." },
];

function headline(r: WalletReport): string {
  const critical = r.approvals.filter((a) => a.severity === "critical");
  const medium = r.approvals.filter((a) => a.severity === "medium");
  if (critical.length > 0) {
    const names = [...new Set(critical.map((a) => a.spender.name))];
    return critical.length === 1
      ? `${critical[0].spender.name} can still spend your ${critical[0].token.symbol}. It was hacked.`
      : `${critical.length} approvals point at contracts that were hacked: ${names.join(" and ")}.`;
  }
  if (medium.length > 0) {
    const tokens = [...new Set(medium.map((a) => a.token.symbol))];
    return `${medium.length} ${medium.length === 1 ? "contract" : "contracts"} can spend all of your ${listOf(tokens)}.`;
  }
  if (r.approvals.length > 0) return "Nothing here can take your money right now.";
  return "No approvals found on the tokens we check.";
}

function listOf(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function scoreTone(r: WalletReport) {
  // Red is reserved for hacked contracts, so it always means "act now".
  if (r.approvals.some((a) => a.severity === "critical")) return "text-flare";
  return r.score >= 85 ? "text-veil" : "text-ember";
}

export function Report({ report }: { report: WalletReport }) {
  const reduce = useReducedMotion();
  const [showLow, setShowLow] = useState(false);
  const label = report.ensName ?? shortAddress(report.address);

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
      className="rounded-3xl border border-line bg-deep/80"
      aria-label={`Report for ${label}`}
    >
      <header className="grid gap-6 border-b border-line p-6 md:grid-cols-[1fr_auto] md:p-8">
        <div className="min-w-0">
          <p className="font-mono text-sm text-fog">
            {label}
            {report.ensName && <span className="ml-2 text-fog/70">{shortAddress(report.address)}</span>}
          </p>
          <h3 className="mt-3 max-w-[30ch] font-display text-[28px] font-semibold leading-[1.15] tracking-[-0.01em] text-balance md:text-[34px]">
            {headline(report)}
          </h3>
        </div>
        <dl className="flex gap-8 md:flex-col md:items-end md:gap-4 md:text-right">
          <div>
            <dt className="text-sm text-fog">Safety score</dt>
            <dd className={`font-display text-4xl font-semibold tabular-nums ${scoreTone(report)}`}>
              {report.score}
              <span className="text-lg text-fog">/100</span>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-fog">Money exposed</dt>
            <dd className="font-display text-2xl font-semibold tabular-nums">{formatUsd(report.exposedUsd)}</dd>
          </div>
        </dl>
      </header>

      <p className="flex items-center gap-2 border-b border-line px-6 py-3 text-sm text-fog md:px-8">
        <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-veil" aria-hidden>
          <path d="M8 1.5l5 2v4c0 3.2-2.2 5.8-5 7-2.8-1.2-5-3.8-5-7v-4l5-2z" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        Checked {TOKENS.length} tokens against {SPENDERS.length} contracts on Ethereum in {report.reads} private {report.reads === 1 ? "request" : "requests"}. No provider saw this wallet next to your IP.
      </p>

      <CrossCheckLine report={report} />

      <div className="divide-y divide-line border-b border-line">
        {GROUPS.map((g) => {
          const items = report.approvals.filter((a) => a.severity === g.severity);
          if (items.length === 0) return null;
          const collapsed = g.severity === "low" && !showLow;
          return (
            <section key={g.severity} className="px-6 py-6 md:px-8">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="font-display text-lg font-semibold">
                  {g.title} <span className="font-sans text-base font-normal text-fog">({items.length})</span>
                </h4>
                {g.severity === "low" && (
                  <button onClick={() => setShowLow((v) => !v)} className="text-sm text-fog underline-offset-4 hover:text-mist hover:underline" aria-expanded={!collapsed}>
                    {collapsed ? "Show" : "Hide"}
                  </button>
                )}
              </div>
              <p className="mt-1 text-sm text-fog">{g.hint}</p>
              {!collapsed && (
                <ul className="mt-4 grid gap-3">
                  {items.map((a) => (
                    <ApprovalRow key={a.id} approval={a} owner={report.address} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      {report.approvals.length > 0 && (
        <p className="px-6 py-4 text-sm text-fog md:px-8">
          Revoking sends a transaction from your own wallet (MetaMask, Rabby…), and every transaction on Ethereum is
          public. Checking stays private; cancelling can&apos;t be.
        </p>
      )}
    </motion.article>
  );
}

function CrossCheckLine({ report }: { report: WalletReport }) {
  const c = report.crossCheck;
  if (c.state === "agreed") {
    return (
      <p className="flex items-center gap-2 border-b border-line px-6 py-3 text-sm text-fog md:px-8">
        <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-veil" aria-hidden>
          <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>
          Double-checked: two independent providers ({c.providers.join(" and ")}) gave identical answers, so neither
          could fake this result.
        </span>
      </p>
    );
  }
  if (c.state === "disagreed") {
    return (
      <p role="alert" className="border-b border-line bg-flare/10 px-6 py-3 text-sm text-mist md:px-8">
        The two providers ({c.providers.join(" and ")}) gave different answers. One of them may be wrong or lying.
        Scan again before trusting this result.
      </p>
    );
  }
  return (
    <p className="border-b border-line px-6 py-3 text-sm text-fog md:px-8">
      Not double-checked: {c.reason.toLowerCase()}. The result comes from a single provider.
    </p>
  );
}

const tone: Record<Severity, string> = {
  critical: "border-flare/50 bg-flare/[0.07]",
  medium: "border-ember/35 bg-ember/[0.05]",
  low: "border-line bg-raise/50",
};

type RevokeState = { kind: "idle" } | { kind: "waiting" } | { kind: "sent"; hash: string } | { kind: "error"; message: string };

function ApprovalRow({ approval: a, owner }: { approval: Approval; owner: `0x${string}` }) {
  const [state, setState] = useState<RevokeState>({ kind: "idle" });

  const onRevoke = async () => {
    setState({ kind: "waiting" });
    try {
      const hash = await revoke(a, owner);
      setState({ kind: "sent", hash });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState({ kind: "error", message: /reject|denied/i.test(msg) ? "You cancelled the revoke in your wallet." : msg.split("\n")[0] });
    }
  };

  const amount = a.unlimited ? "Unlimited" : `Up to ${formatAmount(a.amount, a.token.decimals)} ${a.token.symbol}`;

  return (
    <li className={`grid gap-4 rounded-2xl border p-4 md:grid-cols-[1fr_auto] md:items-center md:p-5 ${tone[a.severity]}`}>
      <div className="flex min-w-0 gap-4">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-night font-display text-[13px] font-semibold text-mist ring-1 ring-line">
          {a.token.symbol.slice(0, 4)}
        </span>
        <div className="min-w-0">
          <p className="text-[15px] leading-snug">
            <span className="font-semibold">{a.spender.name}</span> can spend your <span className="font-semibold">{a.token.symbol}</span>
          </p>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fog">
            <span className={a.unlimited ? "text-mist" : undefined}>{amount}</span>
            <span>
              You hold {formatAmount(a.balance, a.token.decimals)} {a.token.symbol}
              {a.usdExposed !== null && a.usdExposed > 0 ? ` (${formatUsd(a.usdExposed)})` : ""}
            </span>
            {a.viaPermit2 && <span>Through Permit2</span>}
          </p>
          <p className="mt-2 max-w-[68ch] text-sm leading-relaxed text-mist/85">{a.severity === "critical" ? a.spender.note : a.reason}</p>
          <p className="mt-1 font-mono text-xs text-fog/80">{shortAddress(a.spender.address)}</p>
        </div>
      </div>

      <div className="flex flex-col items-start gap-2 md:items-end">
        {state.kind === "sent" ? (
          <a
            href={`https://etherscan.io/tx/${state.hash}`}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-xl border border-veil/50 px-4 py-2.5 text-sm text-veil hover:bg-veil/10"
          >
            Revoke sent. View on Etherscan
          </a>
        ) : (
          <button
            onClick={onRevoke}
            disabled={state.kind === "waiting"}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50 ${
              a.severity === "critical" ? "bg-flare text-night" : "border border-line text-mist hover:border-fog"
            }`}
          >
            {state.kind === "waiting" ? "Confirm in your wallet…" : "Revoke"}
          </button>
        )}
        {state.kind === "error" && <p className="max-w-[28ch] text-sm text-flare md:text-right">{state.message}</p>}
      </div>
    </li>
  );
}

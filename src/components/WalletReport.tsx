"use client";

// One wallet, one report. A plain-language headline first, three numbers that
// matter, then the detail in three sections: what can drain you, what you hold,
// and the proof that nobody saw you look.

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { formatUsd, shortAddress, type WalletReport as Report } from "@/lib/scan";
import { ApprovalList } from "./ApprovalList";
import { Holdings } from "./Holdings";
import { PrivacyReceipt } from "./PrivacyReceipt";

type Section = "approvals" | "holdings" | "privacy";

function headline(r: Report): string {
  const critical = r.approvals.filter((a) => a.severity === "critical");
  const medium = r.approvals.filter((a) => a.severity === "medium");
  if (critical.length > 0) {
    const names = [...new Set(critical.map((a) => a.spender.name))];
    return critical.length === 1
      ? `${critical[0].spender.name} can still spend your ${critical[0].token.symbol}. It was hacked.`
      : `${critical.length} approvals point at hacked contracts: ${listOf(names)}.`;
  }
  if (medium.length > 0) {
    const tokens = [...new Set(medium.map((a) => a.token.symbol))];
    return `${medium.length} ${medium.length === 1 ? "contract" : "contracts"} can spend all of your ${listOf(tokens)}.`;
  }
  return r.approvals.length > 0 ? "Nothing here can take your money right now." : "No risky approvals found.";
}

function listOf(items: string[]) {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function WalletReport({ report, onCompare }: { report: Report; onCompare: () => void }) {
  const reduce = useReducedMotion();
  const [section, setSection] = useState<Section>("approvals");
  const critical = report.approvals.some((a) => a.severity === "critical");
  const scoreTone = critical ? "text-flare" : report.score >= 85 ? "text-veil" : "text-ember";
  const risky = report.approvals.filter((a) => a.severity !== "low").length;

  const tabs: { id: Section; label: string; meta: string }[] = [
    { id: "approvals", label: "Approvals", meta: risky > 0 ? `${risky} to review` : "All clear" },
    { id: "holdings", label: "Holdings", meta: formatUsd(report.holdingsUsd) },
    { id: "privacy", label: "Privacy receipt", meta: `${report.reads} private requests` },
  ];

  return (
    <motion.article
      key={report.address}
      initial={reduce ? false : { opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      aria-label={`Report for ${report.ensName ?? report.address}`}
    >
      <header className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="min-w-0">
          <p className="font-mono text-sm text-fog">
            {report.ensName ?? shortAddress(report.address)}
            {report.ensName && <span className="ml-2 text-fog/70">{shortAddress(report.address)}</span>}
          </p>
          <h2 className="mt-3 max-w-[22ch] font-display text-[clamp(30px,4.2vw,48px)] font-semibold leading-[1.06] tracking-[-0.02em] text-balance">
            {headline(report)}
          </h2>
        </div>
        <dl className="flex flex-wrap gap-x-10 gap-y-4">
          <Figure term="Safety score" className={scoreTone}>
            {report.score}
            <span className="text-lg text-fog">/100</span>
          </Figure>
          <Figure term="Exposed to approvals">{formatUsd(report.exposedUsd)}</Figure>
          <Figure term="Held on 6 chains">{formatUsd(report.holdingsUsd)}</Figure>
        </dl>
      </header>

      <div role="tablist" aria-label="Report sections" className="mt-10 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => {
          const active = section === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              aria-controls={`panel-${t.id}`}
              id={`tab-${t.id}`}
              onClick={() => setSection(t.id)}
              className={`relative shrink-0 px-3 pb-3.5 pt-2 text-left transition-colors sm:px-4 ${active ? "text-mist" : "text-fog hover:text-mist"}`}
            >
              <span className="block font-display text-[17px] font-semibold">{t.label}</span>
              <span className="block text-sm tabular-nums text-fog">{t.meta}</span>
              {active && (
                <motion.span
                  layoutId="report-tab"
                  className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-veil"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`panel-${section}`} aria-labelledby={`tab-${section}`}>
        {section === "approvals" && <ApprovalList report={report} />}
        {section === "holdings" && <Holdings report={report} />}
        {section === "privacy" && <PrivacyReceipt report={report} onCompare={onCompare} />}
      </div>
    </motion.article>
  );
}

function Figure({ term, children, className = "" }: { term: string; children: React.ReactNode; className?: string }) {
  return (
    <div>
      <dt className="text-sm text-fog">{term}</dt>
      <dd className={`mt-0.5 font-display text-[32px] font-semibold leading-tight tabular-nums ${className}`}>{children}</dd>
    </div>
  );
}

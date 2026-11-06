"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { anonStatus, connect, NoProviderAnswered, privateClient, providerOf, reconnect } from "@/lib/anon";
import { scanWallet, shortAddress, type WalletReport as Report } from "@/lib/scan";
import { getRemember, loadWallets, saveWallets, setRemember } from "@/lib/storage";
import { LeakLab } from "./LeakLab";
import { PrivacyStatus } from "./PrivacyStatus";
import { RouteTrace } from "./RouteTrace";
import { useAnon } from "./useAnon";
import { WalletInput } from "./WalletInput";
import { WalletReport } from "./WalletReport";

type View = "check" | "compare";
type Failure = { input: string; message: string };

const EXAMPLES = ["vitalik.eth", "sassal.eth"];

export function Shield() {
  const anon = useAnon();
  const reduce = useReducedMotion();
  const [view, setView] = useState<View>("check");
  const [wallets, setWallets] = useState<string[]>([]);
  const [remember, setRememberState] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [scanning, setScanning] = useState(false);
  const [sentAtStart, setSentAtStart] = useState(0);

  // Restore the list saved on this device, and go private in the background
  // so the connection is ready by the time someone presses Check.
  useEffect(() => {
    // localStorage only exists in the browser, so read it after the first render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWallets(loadWallets());
    setRememberState(getRemember());
    connect("nym").catch(() => {});
  }, []);

  const updateWallets = (next: string[]) => {
    setWallets(next);
    saveWallets(next);
  };

  // One isolation key per wallet: its requests can't be linked to any other wallet's.
  const scanAll = (list: string[]) =>
    Promise.allSettled(
      list.map((w) => {
        const mainKey = `wallet:${crypto.randomUUID()}`;
        const checkKey = `check:${mainKey}`;
        const readsFor = () =>
          anonStatus.get().reads.filter((r) => r.ok && (r.isolationKey === mainKey || r.isolationKey === checkKey)).length;
        return scanWallet(privateClient(mainKey), w, readsFor, {
          mainKey,
          providerOf,
          makeClient: (avoid) => ({ client: privateClient(checkKey, { avoid }), key: checkKey }),
          chainClient: (chain) => privateClient(mainKey, { chain }),
        });
      }),
    );

  const scan = async (list: string[]) => {
    setScanning(true);
    setFailures([]);
    setSentAtStart(anonStatus.get().sent);
    let results = await scanAll(list);
    // If no provider answered at all, the exit is probably dead: build a new route and try once more.
    if (results.some((r) => r.status === "rejected" && hasCause(r.reason, NoProviderAnswered))) {
      try {
        await reconnect();
        results = await scanAll(list);
      } catch {
        // keep the first results; the failure message explains what happened
      }
    }
    const ok: Report[] = [];
    const bad: Failure[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") ok.push(r.value);
      else bad.push({ input: list[i], message: explain(r.reason) });
    });
    setReports(ok);
    setSelected(ok[0]?.address ?? null);
    setFailures(bad);
    setScanning(false);
  };

  const ready = anon.phase === "ready";
  const hint = scanning
    ? `Checking through ${anon.network === "nox" ? "Nox" : "Nym"}… ${anon.sent - sentAtStart} private requests answered so far.`
    : anon.phase === "connecting"
      ? "Going private first. This takes about 10 to 20 seconds the first time."
      : anon.phase === "failed"
        ? "The private network isn't connected, so nothing is sent. Open the status at the top right to try again."
        : undefined;

  const active = reports.find((r) => r.address === selected) ?? reports[0];
  const hasResults = reports.length > 0 || failures.length > 0;

  const input = (
    <WalletInput
      wallets={wallets}
      onChange={updateWallets}
      remember={remember}
      onRemember={(on) => {
        setRememberState(on);
        setRemember(on, wallets);
      }}
      onScan={scan}
      canScan={ready}
      scanning={scanning}
      hint={hint}
      examples={EXAMPLES}
      compact={hasResults}
    />
  );

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between gap-4 py-5">
        <div className="flex items-center gap-8">
          <Link href="/" onClick={() => setView("check")} className="flex items-center gap-2.5" aria-label="Unseen Shield home">
            <Mark />
            <span className="whitespace-nowrap font-display text-lg font-semibold tracking-[-0.01em]">Unseen Shield</span>
          </Link>
          <nav aria-label="Sections" className="hidden gap-6 text-sm sm:flex">
            {(
              [
                ["check", "Check a wallet"],
                ["compare", "Compare"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setView(id)}
                aria-current={view === id ? "page" : undefined}
                className={`py-1 transition-colors ${view === id ? "text-mist" : "text-fog hover:text-mist"}`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
        <PrivacyStatus />
      </header>

      <main className="flex-1">
        {view === "compare" ? (
          <div className="pb-20 pt-10 lg:pt-16">
            <button
              onClick={() => setView("check")}
              className="mb-8 text-sm text-fog underline-offset-4 hover:text-mist hover:underline"
            >
              Back to {reports.length ? "your report" : "checking a wallet"}
            </button>
            <LeakLab wallets={wallets} />
          </div>
        ) : !hasResults ? (
          <>
            <section className="grid gap-14 pb-20 pt-12 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-20 lg:pb-28 lg:pt-20">
              <div>
                <h1 className="max-w-[13ch] font-display text-[clamp(44px,7vw,88px)] font-semibold leading-[0.95] tracking-[-0.035em] text-balance">
                  Check your wallet without being seen.
                </h1>
                <p className="mt-7 max-w-[50ch] text-lg leading-relaxed text-fog">
                  Unseen Shield finds the approvals that could drain you and adds up what you hold on six chains.
                  Every check travels through Anon-RPC, so no one learns the wallet is yours.
                </p>
                <div className="mt-10 max-w-2xl">{input}</div>
              </div>

              <aside aria-labelledby="route-heading" className="lg:border-l lg:border-line lg:pl-12 lg:pt-3">
                <h2 id="route-heading" className="font-display text-xl font-semibold">
                  {scanning ? "Your check is on its way" : "How your check stays private"}
                </h2>
                <p className="mt-2 max-w-[40ch] text-sm leading-relaxed text-fog">
                  No single stop knows both who you are and what you asked.
                </p>
                <div className="mt-8">
                  <RouteTrace vertical />
                </div>
              </aside>
            </section>
          </>
        ) : (
          <div className="pb-20 pt-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="w-full max-w-2xl">{input}</div>
              <button
                onClick={() => {
                  setReports([]);
                  setFailures([]);
                }}
                className="rounded-xl px-3 py-3 text-sm text-fog underline-offset-4 hover:text-mist hover:underline"
              >
                Start a new check
              </button>
            </div>

            {reports.length > 1 && (
              <div role="tablist" aria-label="Wallets" className="mt-8 flex flex-wrap gap-2">
                {reports.map((r) => {
                  const on = r.address === active?.address;
                  const dot = r.approvals.some((a) => a.severity === "critical")
                    ? "bg-flare"
                    : r.score >= 85
                      ? "bg-veil"
                      : "bg-ember";
                  return (
                    <button
                      key={r.address}
                      role="tab"
                      aria-selected={on}
                      onClick={() => setSelected(r.address)}
                      className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-sm transition-colors ${
                        on ? "border-mist/60 bg-raise text-mist" : "border-line text-fog hover:text-mist"
                      }`}
                    >
                      <span aria-hidden className={`size-2 rounded-full ${dot}`} />
                      {r.ensName ?? shortAddress(r.address)}
                    </button>
                  );
                })}
              </div>
            )}

            {failures.map((f) => (
              <p key={f.input} role="alert" className="mt-8 rounded-xl bg-flare/10 p-4 text-sm">
                <span className="font-mono">{f.input}</span>: {f.message}
              </p>
            ))}

            <AnimatePresence mode="wait">
              {active && (
                <motion.div
                  key={active.address}
                  className="mt-12"
                  exit={reduce ? undefined : { opacity: 0, transition: { duration: 0.15 } }}
                >
                  <WalletReport report={active} onCompare={() => setView("compare")} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line py-6 text-sm text-fog">
        <p>Open source under MIT. No accounts, no database, no trackers. Reads go through Anon-RPC.</p>
        <div className="flex gap-5">
          <button onClick={() => setView("compare")} className="underline-offset-4 hover:text-mist hover:underline sm:hidden">
            Compare
          </button>
          <a href="https://github.com/Swalih60/unseen-shield" className="underline-offset-4 hover:text-mist hover:underline">
            Source code
          </a>
        </div>
      </footer>
    </div>
  );
}

function hasCause(err: unknown, type: new (...args: never[]) => Error): boolean {
  let e: unknown = err;
  while (e instanceof Error) {
    if (e instanceof type) return true;
    e = (e as Error & { cause?: unknown }).cause;
  }
  return false;
}

// viem wraps our errors ("An unknown RPC error occurred"); show the real reason underneath.
function explain(err: unknown): string {
  let e: unknown = err;
  let message = err instanceof Error ? err.message : String(err);
  while (e instanceof Error) {
    if (!/unknown RPC error|^\s*$/i.test(e.message)) message = e.message;
    e = (e as Error & { cause?: unknown }).cause;
  }
  return message.split("\n")[0];
}

function Mark() {
  // A shield drawn as a dashed outline: protection you can't quite see.
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <path
        d="M16 3l11 4.2v8.3c0 6.6-4.6 11.6-11 13.5C9.6 27.1 5 22.1 5 15.5V7.2L16 3z"
        fill="none"
        stroke="var(--veil)"
        strokeWidth="2"
        strokeDasharray="3.2 2.6"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="15" r="3" fill="var(--veil)" />
    </svg>
  );
}

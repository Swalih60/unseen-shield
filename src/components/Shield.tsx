"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { connect, NoProviderAnswered, privateClient, providerOf, reconnect, sentCount } from "@/lib/anon";
import { scanWallet, type WalletReport } from "@/lib/scan";
import { getRemember, loadWallets, saveWallets, setRemember } from "@/lib/storage";
import { LeakLab } from "./LeakLab";
import { Ledger } from "./Ledger";
import { NetworkBar, StatusPill } from "./NetworkBar";
import { Report } from "./Report";
import { RouteTrace } from "./RouteTrace";
import { useAnon } from "./useAnon";
import { WalletInput } from "./WalletInput";

type Tab = "scan" | "lab";
type Failure = { input: string; message: string };

export function Shield() {
  const anon = useAnon();
  const [tab, setTab] = useState<Tab>("scan");
  const [wallets, setWallets] = useState<string[]>([]);
  const [remember, setRememberState] = useState(true);
  const [reports, setReports] = useState<WalletReport[]>([]);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [scanning, setScanning] = useState(false);

  // Restore the list saved on this device, and start the private connection
  // in the background so it's ready by the time someone presses Scan.
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

  const scan = async () => {
    setScanning(true);
    setFailures([]);
    let results = await scanAll();
    // If no provider answered at all, the exit node is probably dead: build a new route and try once more.
    if (results.some((r) => r.status === "rejected" && hasCause(r.reason, NoProviderAnswered))) {
      try {
        await reconnect();
        results = await scanAll();
      } catch {
        // keep the first results; the failure message explains what happened
      }
    }
    const ok: WalletReport[] = [];
    const bad: Failure[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") ok.push(r.value);
      else bad.push({ input: wallets[i], message: explain(r.reason) });
    });
    setReports(ok);
    setFailures(bad);
    setScanning(false);
  };

  // One isolation key per wallet: their requests can't be linked to each other.
  const scanAll = () =>
    Promise.allSettled(
      wallets.map((w) => {
        const mainKey = `wallet:${crypto.randomUUID()}`;
        return scanWallet(privateClient(mainKey), w, sentCount, {
          mainKey,
          providerOf,
          makeClient: (avoid) => {
            const key = `check:${crypto.randomUUID()}`;
            return { client: privateClient(key, { avoid }), key };
          },
        });
      }),
    );

  const ready = anon.phase === "ready";
  const waitingFor =
    anon.phase === "connecting"
      ? "Building your private route. This takes a few seconds the first time."
      : anon.phase === "failed"
        ? "The private network isn't connected, so scanning is paused. Nothing is sent until it is."
        : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 py-6">
        <Link href="/" className="flex items-center gap-3" aria-label="Unseen Shield home">
          <Mark />
          <span className="font-display text-xl font-semibold tracking-[-0.01em]">Unseen Shield</span>
        </Link>
        <nav aria-label="Sections" className="flex items-center gap-1 rounded-full border border-line p-1">
          {(
            [
              ["scan", "Scan"],
              ["lab", "Leak lab"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${tab === id ? "bg-mist text-night" : "text-fog hover:text-mist"}`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="hidden md:block">
          <StatusPill />
        </div>
      </header>

      {tab === "scan" ? (
        <main>
          <section className="grid gap-10 pt-8 lg:grid-cols-[1.25fr_1fr] lg:items-start lg:gap-14 lg:pt-14">
            <div>
              <h1 className="max-w-[14ch] font-display text-[clamp(40px,6.4vw,76px)] font-semibold leading-[0.98] tracking-[-0.025em]">
                Find what can drain your wallet.
              </h1>
              <p className="mt-6 max-w-[48ch] text-lg leading-relaxed text-fog">
                Old approvals let apps spend your tokens forever. Unseen Shield finds them and lets you revoke
                them, and every check travels through Anon-RPC, so no one learns the wallet is yours.
              </p>
              <div className="mt-10">
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
                  waitingFor={waitingFor}
                />
              </div>
            </div>
            <NetworkBar />
          </section>

          <section aria-labelledby="route-heading" className="mt-16 rounded-3xl border border-line bg-deep/50 p-6 md:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="route-heading" className="font-display text-2xl font-semibold">
                How your scan travels
              </h2>
              <p className="text-sm text-fog">No single stop knows both who you are and what you asked.</p>
            </div>
            <div className="mt-8">
              <RouteTrace />
            </div>
          </section>

          {(reports.length > 0 || failures.length > 0) && (
            <section aria-labelledby="results-heading" className="mt-16">
              <h2 id="results-heading" className="sr-only">
                Results
              </h2>
              <div className="grid gap-6">
                {failures.map((f) => (
                  <p key={f.input} role="alert" className="rounded-2xl border border-flare/40 bg-flare/10 p-4 text-sm">
                    <span className="font-mono">{f.input}</span>: {f.message}
                  </p>
                ))}
                {reports.map((r) => (
                  <Report key={r.address} report={r} />
                ))}
              </div>
            </section>
          )}

          <div className="mt-16">
            <Ledger />
          </div>
        </main>
      ) : (
        <main className="pt-8 lg:pt-14">
          <LeakLab wallets={wallets} />
        </main>
      )}

      <footer className="mt-24 flex flex-wrap justify-between gap-4 border-t border-line pt-6 text-sm text-fog">
        <p>Open source under the MIT license. No accounts, no database, no trackers.</p>
        <a href="https://github.com/Swalih60/unseen-shield" className="underline-offset-4 hover:text-mist hover:underline">
          Source code on GitHub
        </a>
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
    <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
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

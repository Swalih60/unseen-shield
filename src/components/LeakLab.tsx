"use client";

// The Leak Lab: the same scan done two ways, side by side.
// Left: a normal connection to our pretend provider, which writes down
// everything it can. Right: Unseen Shield, whose requests never reach it.

import { useEffect, useState } from "react";
import { clearSpyNotebook, leakyClient, leakyReads, readSpyNotebook, type SpyNote } from "@/lib/leaky";
import { scanWallet, shortAddress } from "@/lib/scan";
import { useAnon } from "./useAnon";

export function LeakLab({ wallets }: { wallets: string[] }) {
  const anon = useAnon();
  const [notes, setNotes] = useState<SpyNote[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const n = await readSpyNotebook();
        if (alive) setNotes(n);
      } catch {
        // the lab server isn't reachable (static hosting); the panel says so below
      }
    };
    tick();
    const t = setInterval(tick, 1500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const runNormal = async () => {
    setRunning(true);
    setError(null);
    try {
      const client = leakyClient();
      for (const w of wallets) await scanWallet(client, w, leakyReads);
    } catch (err) {
      setError(err instanceof Error ? err.message.split("\n")[0] : String(err));
    } finally {
      setRunning(false);
    }
  };

  const linked = [...new Set(notes.flatMap((n) => n.wallets))];
  const latest = notes[0];

  return (
    <section aria-labelledby="lab-heading">
      <h2 id="lab-heading" className="font-display text-[clamp(28px,4vw,40px)] font-semibold leading-tight">
        See what a normal checker gives away
      </h2>
      <p className="mt-3 max-w-[62ch] text-fog">
        The same check, done two ways. The normal way goes through an ordinary connection to a pretend provider
        that writes down what any RPC provider can see. Next to it is what that provider learned from Unseen
        Shield.
      </p>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-flare/40 bg-flare/[0.05] p-6 md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-xl font-semibold">The normal way</h3>
            <div className="flex gap-2">
              <button
                onClick={runNormal}
                disabled={running || wallets.length === 0}
                className="rounded-xl bg-flare px-4 py-2.5 text-sm font-semibold text-night disabled:opacity-40"
              >
                {running ? "Scanning…" : "Scan the normal way"}
              </button>
              {notes.length > 0 && (
                <button onClick={() => clearSpyNotebook().then(() => setNotes([]))} className="rounded-xl border border-line px-3 py-2.5 text-sm text-fog hover:text-mist">
                  Clear
                </button>
              )}
            </div>
          </div>
          {wallets.length === 0 && <p className="mt-3 text-sm text-fog">Check a wallet first, then come back to compare.</p>}
          {error && <p className="mt-3 text-sm text-flare">{error}</p>}

          <dl className="mt-6 grid gap-4">
            <Seen term="Who asked" value={latest ? latest.ip : "Nothing yet"} bad={!!latest} />
            <Seen term="On what device" value={latest ? latest.device : "Nothing yet"} bad={!!latest} />
            <Seen
              term="Wallets it now links to that person"
              value={linked.length ? linked.map(shortAddress).join(", ") : "Nothing yet"}
              bad={linked.length > 0}
              mono
            />
            <Seen term="Requests written down" value={String(notes.length)} bad={notes.length > 0} />
          </dl>
          {linked.length > 1 && (
            <p className="mt-6 text-[15px] leading-relaxed text-mist">
              The provider now knows these {linked.length} wallets belong to one person, on a {latest?.device}. It
              didn&apos;t need to hack anything. The checker told it.
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-veil/40 bg-veil/[0.04] p-6 md:p-7">
          <h3 className="font-display text-xl font-semibold">Unseen Shield</h3>
          <dl className="mt-6 grid gap-4">
            <Seen term="Who asked" value="Unknown. It came out of a relay." />
            <Seen term="On what device" value="Unknown" />
            <Seen term="Wallets it can link together" value="None. Each wallet took its own path." />
            <Seen term="Private requests sent" value={String(anon.sent)} />
          </dl>
          <p className="mt-6 text-[15px] leading-relaxed text-mist">
            Your private scans never touched this provider. The RPC providers that did answer them only saw a
            relay&apos;s address, never yours.
          </p>
        </div>
      </div>
    </section>
  );
}

function Seen({ term, value, bad, mono }: { term: string; value: string; bad?: boolean; mono?: boolean }) {
  return (
    <div className="border-b border-line/70 pb-3">
      <dt className="text-sm text-fog">{term}</dt>
      <dd className={`mt-1 break-words text-[17px] ${mono ? "font-mono text-[15px]" : "font-display font-semibold"} ${bad ? "text-flare" : "text-mist"}`}>
        {value}
      </dd>
    </div>
  );
}

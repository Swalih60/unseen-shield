"use client";

import { connect, NETWORKS, type NetworkId, type OutgoingRead } from "@/lib/anon";
import { useAnon } from "./useAnon";

const ORDER: NetworkId[] = ["tor", "nym", "nox", "passthrough"];

export function NetworkBar() {
  const anon = useAnon();
  const network = NETWORKS[anon.network];

  const pick = (id: NetworkId) => {
    connect(id).catch(() => {
      /* the status carries the message */
    });
  };

  return (
    <section aria-labelledby="network-heading" className="rounded-2xl border border-line bg-deep/70 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="network-heading" className="font-display text-lg font-semibold">
            Private network
          </h2>
          <p className="mt-1 max-w-[52ch] text-sm text-fog">{network.blurb}</p>
        </div>
        <div className="md:hidden">
          <StatusPill />
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line text-sm">
        <Stat term="Route built in" value={anon.connectMs ? `${(anon.connectMs / 1000).toFixed(1)}s` : anon.phase === "connecting" ? "Building…" : "–"} />
        <Stat term="Private requests" value={String(anon.sent)} />
        <Stat term="Average trip" value={avgTrip(anon.reads)} />
      </dl>

      <div role="radiogroup" aria-label="Choose a private network" className="mt-5 flex flex-wrap gap-2">
        {ORDER.map((id) => {
          const n = NETWORKS[id];
          const active = anon.network === id;
          return (
            <button
              key={id}
              role="radio"
              aria-checked={active}
              onClick={() => pick(id)}
              disabled={anon.phase === "connecting" && active}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                active
                  ? n.private
                    ? "border-veil bg-veil/10 text-veil"
                    : "border-ember bg-ember/10 text-ember"
                  : "border-line text-fog hover:border-fog hover:text-mist"
              }`}
            >
              {n.name}
            </button>
          );
        })}
      </div>

      {anon.phase === "failed" && (
        <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-flare/40 bg-flare/10 px-4 py-3 text-sm text-mist">
          <span className="min-w-0 flex-1">{anon.error}</span>
          <button onClick={() => pick(anon.network)} className="rounded-full bg-mist px-3 py-1.5 font-medium text-night">
            Try again
          </button>
        </div>
      )}
      {!network.private && anon.phase !== "failed" && (
        <p className="mt-4 rounded-xl border border-ember/40 bg-ember/10 px-4 py-3 text-sm">
          This option is for testing. Requests are sandboxed but not hidden, so providers can see your IP.
        </p>
      )}
    </section>
  );
}

function avgTrip(reads: OutgoingRead[]) {
  const ok = reads.filter((r) => r.ok);
  if (ok.length === 0) return "–";
  return `${(ok.reduce((s, r) => s + r.ms, 0) / ok.length / 1000).toFixed(1)}s`;
}

function Stat({ term, value }: { term: string; value: string }) {
  return (
    <div className="bg-night/70 px-3 py-2.5">
      <dt className="text-fog">{term}</dt>
      <dd className="mt-0.5 font-display text-base font-semibold tabular-nums text-mist">{value}</dd>
    </div>
  );
}

export function StatusPill() {
  const anon = useAnon();
  const n = NETWORKS[anon.network];
  const tone =
    anon.phase === "ready"
      ? n.private
        ? "text-veil border-veil/40"
        : "text-ember border-ember/40"
      : anon.phase === "failed"
        ? "text-flare border-flare/40"
        : "text-fog border-line";
  const label =
    anon.phase === "ready"
      ? `${n.name} connected in ${((anon.connectMs ?? 0) / 1000).toFixed(1)}s`
      : anon.phase === "connecting"
        ? `Connecting to ${n.name}…`
        : anon.phase === "failed"
          ? `${n.name} unavailable`
          : "Not connected";
  return (
    <p role="status" aria-live="polite" className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${tone}`}>
      <span
        aria-hidden
        className={`size-2 rounded-full bg-current ${anon.phase === "connecting" ? "animate-pulse" : ""}`}
      />
      {label}
    </p>
  );
}

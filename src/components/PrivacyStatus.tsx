"use client";

// The one place the private connection shows up in the interface: a status
// pill in the header. Opening it explains what's happening and lets people
// switch network. Everyday users never need to touch it.

import { useEffect, useRef, useState } from "react";
import { connect, NETWORKS, type NetworkId } from "@/lib/anon";
import { useAnon } from "./useAnon";

// Tor stays out of the picker: its public demo gateway couldn't connect reliably.
// The unprivate reference worker only appears with ?dev in the URL.
const PUBLIC_NETWORKS: NetworkId[] = ["nym", "nox"];

export function PrivacyStatus() {
  const anon = useAnon();
  const [open, setOpen] = useState(false);
  const [dev, setDev] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const network = NETWORKS[anon.network];

  useEffect(() => {
    // Only the browser knows the URL; read it after the first render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDev(new URLSearchParams(window.location.search).has("dev"));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const tone =
    anon.phase === "ready"
      ? network.private
        ? "text-veil border-veil/40"
        : "text-ember border-ember/40"
      : anon.phase === "failed"
        ? "text-flare border-flare/50"
        : "text-fog border-line";

  const label =
    anon.phase === "ready"
      ? network.private
        ? `Private via ${network.name}`
        : "Test mode, not private"
      : anon.phase === "connecting"
        ? "Going private…"
        : anon.phase === "failed"
          ? "Not connected"
          : "Starting…";

  const short =
    anon.phase === "ready" ? (network.private ? "Private" : "Test mode") : anon.phase === "failed" ? "Offline" : "Connecting…";

  const options = dev ? [...PUBLIC_NETWORKS, "passthrough" as const] : PUBLIC_NETWORKS;

  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`inline-flex items-center gap-2 rounded-full border bg-night/60 px-3.5 py-2 text-sm transition-colors hover:bg-raise ${tone}`}
      >
        <span
          aria-hidden
          className={`size-2 rounded-full bg-current ${anon.phase === "connecting" ? "animate-pulse" : ""}`}
        />
        <span role="status" aria-live="polite">
          <span className="sm:hidden">{short}</span>
          <span className="hidden sm:inline">{label}</span>
        </span>
        <svg viewBox="0 0 12 12" aria-hidden className={`size-3 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Private connection"
          className="absolute right-0 top-[calc(100%+10px)] z-30 w-[min(360px,calc(100vw-32px))] rounded-2xl border border-line bg-deep p-5 shadow-[0_24px_60px_-12px_rgb(0_0_0/0.6)]"
        >
          <p className="font-display text-lg font-semibold">
            {anon.phase === "ready"
              ? `Connected through ${network.name}`
              : anon.phase === "failed"
                ? `${network.name} didn't connect`
                : `Connecting to ${network.name}`}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-fog">
            {network.private
              ? "Every check leaves through Anon-RPC and this network's relays. Providers answer, but never see your IP."
              : "Test mode: requests are sandboxed but not hidden. Providers can see your IP."}
          </p>

          {anon.phase === "connecting" && (
            <p className="mt-3 flex items-center gap-2.5 text-sm text-mist">
              <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-line border-t-veil" />
              {anon.progress ?? "Connecting"}… <Elapsed since={anon.connectStarted} />
            </p>
          )}
          {anon.phase === "ready" && anon.connectMs !== undefined && (
            <p className="mt-3 text-sm text-fog">
              Route built in {(anon.connectMs / 1000).toFixed(1)}s. {anon.sent} private{" "}
              {anon.sent === 1 ? "request" : "requests"} so far.
            </p>
          )}
          {anon.phase === "failed" && (
            <div className="mt-3 rounded-xl bg-flare/10 p-3 text-sm">
              <p>{anon.error}</p>
              <button
                onClick={() => connect(anon.network).catch(() => {})}
                className="mt-2 rounded-lg bg-mist px-3 py-1.5 font-medium text-night"
              >
                Try again
              </button>
            </div>
          )}

          <fieldset className="mt-5">
            <legend className="text-sm text-fog">Network</legend>
            <div className="mt-2 grid gap-1.5">
              {options.map((id) => {
                const n = NETWORKS[id];
                const active = anon.network === id;
                return (
                  <label
                    key={id}
                    className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors ${
                      active ? "border-veil/50 bg-veil/[0.06]" : "border-line hover:border-fog/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name="network"
                      checked={active}
                      onChange={() => connect(id).catch(() => {})}
                      className="mt-1 accent-[var(--veil)]"
                    />
                    <span>
                      <span className="block text-sm font-semibold">{n.name}</span>
                      <span className="block text-sm leading-snug text-fog">{n.blurb}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}

function Elapsed({ since }: { since?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!since) return null;
  return <span className="tabular-nums text-fog">{Math.max(0, Math.round((now - since) / 1000))}s</span>;
}

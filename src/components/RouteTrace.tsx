"use client";

// The route a question takes, and what each stop along the way can know.
// This is the one picture that explains Anon-RPC: nobody sees both who you
// are and what you asked.

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { NETWORKS } from "@/lib/anon";
import { useAnon } from "./useAnon";

type Stop = { title: string; knows: string; hidden?: boolean };

function stopsFor(networkId: keyof typeof NETWORKS): Stop[] {
  const relay = networkId === "nym" || networkId === "nox" ? "Mix node" : "Relay";
  if (networkId === "passthrough") {
    return [
      { title: "You", knows: "Your IP and your wallets" },
      { title: "Sandbox", knows: "Passes the request on unchanged" },
      { title: "RPC provider", knows: "Your IP and your wallets", hidden: false },
      { title: "Ethereum", knows: "Answers" },
    ];
  }
  return [
    { title: "You", knows: "Your IP and your wallets" },
    { title: `${relay} 1`, knows: "Your IP, but the question is locked", hidden: true },
    { title: `${relay} 2`, knows: "Neither who nor what", hidden: true },
    { title: `${relay} 3`, knows: "The question, not who sent it", hidden: true },
    { title: "Ethereum", knows: "Answers someone. Not you." },
  ];
}

export function RouteTrace({ vertical = false }: { vertical?: boolean }) {
  const anon = useAnon();
  const reduce = useReducedMotion();
  const stops = stopsFor(anon.network);
  const latest = anon.reads[0];
  // One dot travels the route each time a request goes out (keyed by request).
  const pulse = latest && !reduce ? `${latest.id}-${latest.at}` : null;

  const built = anon.phase === "ready";
  const building = anon.phase === "connecting";
  // Horizontal from md up, unless the caller wants the vertical layout everywhere.
  const h = (cls: string) => (vertical ? "" : cls);
  const track = `absolute left-[11px] top-3 bottom-3 w-px ${h("md:left-[var(--inset)] md:right-[var(--inset)] md:top-[11px] md:bottom-auto md:h-px md:w-auto")}`;

  return (
    <figure aria-label="How your request travels" className="relative">
      <div role="list" className={`relative grid gap-6 ${h("md:grid-cols-[repeat(var(--n),minmax(0,1fr))] md:gap-3")}`} style={{ ["--n" as string]: stops.length, ["--inset" as string]: `${50 / stops.length}%` }}>
        {/* The track */}
        <div aria-hidden className={`${track} bg-line`} />
        <motion.div
          aria-hidden
          className={`${track} bg-veil`}
          initial={false}
          animate={{ opacity: built ? 0.6 : 0 }}
          transition={{ duration: 0.6 }}
        />

        <AnimatePresence>
          {pulse !== null && (
            <motion.span
              key={pulse}
              aria-hidden
              className={`absolute z-10 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-veil shadow-[0_2px_14px_2px_rgb(166_230_212/0.5)] ${vertical ? "" : "hidden md:block"}`}
              style={vertical ? { left: 12 } : { top: 11.5 }}
              initial={vertical ? { top: 12, opacity: 0 } : { left: `${50 / stops.length}%`, opacity: 0 }}
              animate={
                vertical
                  ? { top: "calc(100% - 12px)", opacity: [0, 1, 1, 0] }
                  : { left: `${100 - 50 / stops.length}%`, opacity: [0, 1, 1, 0] }
              }
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
            />
          )}
        </AnimatePresence>

        {stops.map((stop, i) => {
          const lit = built || (building && i === 0);
          return (
            <div role="listitem" key={stop.title} className={`relative flex gap-4 ${h("md:flex-col md:items-center md:gap-3 md:text-center")}`}>
              <motion.span
                aria-hidden
                className="relative z-[1] grid size-6 shrink-0 place-items-center rounded-full border bg-night"
                initial={false}
                animate={{
                  borderColor: lit ? "var(--veil)" : "var(--line)",
                  scale: building && !reduce ? [1, 1.12, 1] : 1,
                }}
                transition={
                  building && !reduce
                    ? { duration: 1.4, repeat: Infinity, delay: i * 0.25 }
                    : { duration: 0.3 }
                }
              >
                <span className={`size-2 rounded-full ${lit ? "bg-veil" : "bg-line"}`} />
              </motion.span>
              <div className="min-w-0">
                <p className="font-display text-[15px] font-semibold leading-tight text-mist">{stop.title}</p>
                <p className={`mt-1 text-[13px] leading-snug text-fog ${h("md:mx-auto md:max-w-[15ch]")}`}>{stop.knows}</p>
              </div>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

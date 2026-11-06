"use client";

// One field, one button. Type a wallet and press Check; add more wallets to
// check them together, each on its own private path.

import { useState } from "react";
import { isAddress } from "viem";
import { shortAddress } from "@/lib/scan";

type Props = {
  wallets: string[];
  onChange: (next: string[]) => void;
  remember: boolean;
  onRemember: (on: boolean) => void;
  onScan: (wallets: string[]) => void;
  canScan: boolean;
  scanning: boolean;
  hint?: string;
  examples?: string[];
  compact?: boolean;
};

function valid(value: string) {
  return isAddress(value) || /^[^\s]+\.[a-z]{2,}$/i.test(value);
}

export function WalletInput({
  wallets,
  onChange,
  remember,
  onRemember,
  onScan,
  canScan,
  scanning,
  hint,
  examples = [],
  compact = false,
}: Props) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Folds whatever is typed into the list; returns the list, or null if the input is invalid.
  const commit = (): string[] | null => {
    const value = draft.trim();
    if (!value) return wallets;
    if (!valid(value)) {
      setError("That isn't a wallet address (0x…) or an ENS name like vitalik.eth.");
      return null;
    }
    setDraft("");
    setError(null);
    if (wallets.some((w) => w.toLowerCase() === value.toLowerCase())) return wallets;
    const next = [...wallets, value];
    onChange(next);
    return next;
  };

  const check = () => {
    const list = commit();
    if (list && list.length > 0) onScan(list);
  };

  const pending = wallets.length + (draft.trim() ? 1 : 0);
  const buttonLabel = scanning
    ? "Checking privately…"
    : pending > 1
      ? `Check ${pending} wallets privately`
      : compact && wallets.length === 1 && !draft.trim()
        ? "Check again"
        : "Check privately";

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          check();
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <div className="relative min-w-0 flex-1">
          <label htmlFor="wallet" className="sr-only">
            Wallet address or ENS name
          </label>
          <input
            id="wallet"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            placeholder={wallets.length ? "Add another wallet" : "0x… or name.eth"}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!error}
            aria-describedby={error ? "wallet-error" : hint ? "wallet-hint" : undefined}
            className={`w-full rounded-xl border border-line bg-night/80 pl-4 pr-20 font-mono text-[15px] text-mist placeholder:text-fog/70 focus:border-veil focus:outline-none ${
              compact ? "py-3" : "py-4"
            }`}
          />
          <button
            type="button"
            onClick={commit}
            disabled={!draft.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-3 py-1.5 text-sm text-fog transition-colors hover:bg-raise hover:text-mist disabled:pointer-events-none disabled:opacity-0"
          >
            Add
          </button>
        </div>
        <button
          type="submit"
          disabled={!canScan || scanning || pending === 0}
          className={`shrink-0 rounded-xl bg-veil px-6 font-display text-[17px] font-semibold text-night transition-[opacity,transform] hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
            compact ? "py-3" : "py-4"
          }`}
        >
          {buttonLabel}
        </button>
      </form>

      {error && (
        <p id="wallet-error" className="mt-2 text-sm text-flare">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id="wallet-hint" className="mt-2 text-sm text-fog">
          {hint}
        </p>
      )}

      {!compact && wallets.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Wallets to check">
          {wallets.map((w) => (
            <li key={w} className="flex items-center gap-1 rounded-full border border-line bg-raise/80 py-1 pl-3 pr-1 font-mono text-sm">
              {isAddress(w) ? shortAddress(w) : w}
              <button
                type="button"
                onClick={() => onChange(wallets.filter((x) => x !== w))}
                aria-label={`Remove ${w}`}
                className="grid size-7 place-items-center rounded-full text-fog hover:bg-line hover:text-mist"
              >
                <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={`mt-4 flex-wrap items-center gap-x-6 gap-y-2 text-sm text-fog ${compact ? "hidden" : "flex"}`}>
        {examples.length > 0 && wallets.length === 0 && (
          <p>
            No wallet handy? Try{" "}
            {examples.map((ex, i) => (
              <span key={ex}>
                {i > 0 && (i === examples.length - 1 ? " or " : ", ")}
                <button
                  type="button"
                  onClick={() => {
                    onChange([ex]);
                    if (canScan && !scanning) onScan([ex]);
                  }}
                  className="font-mono text-mist underline decoration-line underline-offset-4 hover:decoration-veil"
                >
                  {ex}
                </button>
              </span>
            ))}
            .
          </p>
        )}
        {wallets.length > 0 && (
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => onRemember(e.target.checked)}
              className="size-4 accent-[var(--veil)]"
            />
            Remember on this device only
          </label>
        )}
      </div>
    </div>
  );
}

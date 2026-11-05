"use client";

import { useState } from "react";
import { isAddress } from "viem";
import { shortAddress } from "@/lib/scan";

type Props = {
  wallets: string[];
  onChange: (next: string[]) => void;
  remember: boolean;
  onRemember: (on: boolean) => void;
  onScan: () => void;
  canScan: boolean;
  scanning: boolean;
  waitingFor?: string;
};

export function WalletInput({ wallets, onChange, remember, onRemember, onScan, canScan, scanning, waitingFor }: Props) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    if (!isAddress(value) && !/^[^\s]+\.[a-z]{2,}$/i.test(value)) {
      setError("Enter a wallet address (0x…) or an ENS name like vitalik.eth.");
      return;
    }
    if (wallets.some((w) => w.toLowerCase() === value.toLowerCase())) {
      setError("That wallet is already on your list.");
      return;
    }
    onChange([...wallets, value]);
    setDraft("");
    setError(null);
  };

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
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
          placeholder="0x… or name.eth"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby={error ? "wallet-error" : undefined}
          className="min-w-0 flex-1 rounded-xl border border-line bg-night px-4 py-3.5 font-mono text-[15px] text-mist placeholder:text-fog/70 focus:border-veil focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-xl border border-line px-5 py-3.5 font-medium text-mist transition-colors hover:border-fog"
        >
          Add wallet
        </button>
      </form>
      {error && (
        <p id="wallet-error" className="mt-2 text-sm text-flare">
          {error}
        </p>
      )}

      {wallets.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Wallets to check">
          {wallets.map((w) => (
            <li key={w} className="flex items-center gap-1 rounded-full border border-line bg-raise py-1 pl-3 pr-1 font-mono text-sm">
              {isAddress(w) ? shortAddress(w) : w}
              <button
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

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <button
          onClick={onScan}
          disabled={!canScan || scanning || wallets.length === 0}
          className="rounded-xl bg-veil px-6 py-3.5 font-display text-[17px] font-semibold text-night transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {scanning ? "Scanning privately…" : wallets.length > 1 ? `Scan ${wallets.length} wallets privately` : "Scan privately"}
        </button>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-fog">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => onRemember(e.target.checked)}
            className="size-4 accent-[var(--veil)]"
          />
          Remember these wallets on this device only
        </label>
      </div>
      {waitingFor && wallets.length > 0 && <p className="mt-3 text-sm text-fog">{waitingFor}</p>}
    </div>
  );
}

# Unseen Shield

**Find what can drain your wallet, and see everything you hold, without telling anyone the wallets are yours.**

Old token approvals let apps spend your tokens forever. If one of those contracts is hacked, attackers drain wallets through approvals people forgot about: LI.FI lost about $10M this way in July 2024, Socket about $3.3M in January 2024.

Checking your approvals today means pasting your wallet into a site whose servers and RPC provider see your wallet next to your IP address. You reveal exactly which wallet is yours, and that it might be vulnerable.

Unseen Shield scans approvals **entirely in your browser**, and **every request goes through [Anon-RPC](https://github.com/ethereum/anon-rpc)** (Tor, Nym or Nox), so no provider learns who is asking.

Built at ETHGlobal Mumbai for the Ethereum Foundation tracks *Best Use of Anon-RPC* and *Best CROPS App*.

## What it does

1. **Connects privately.** On page load it starts an Anon-RPC worker in the background (Nym by default, which connects in about 10 to 20 seconds). You can switch to Nox. While it connects, it shows what the network is doing. Tor support is built in but hidden from the picker for now, because the public tor-js demo gateway was too overloaded to connect reliably.
2. **Scans.** For each wallet you add (address or ENS name), it checks 11 popular tokens against 13 commonly approved contracts, including Permit2 sub-approvals. It also reads balances and Chainlink prices so it can show how much money is exposed.
3. **Judges.** Each approval is labeled:
   - **Revoke now:** the contract was drained through approvals (LI.FI Diamond, Socket Gateway)
   - **Worth reviewing:** unlimited approval on a token you hold
   - **Fine for now:** limited, or a token you don't hold
4. **Revokes.** One click sets an approval back to zero through your own wallet.
5. **Portfolio.** The same private requests also read your ETH and token balances plus Chainlink prices, so the Portfolio tab shows your total value, each asset and each wallet with no extra requests. Normal portfolio apps link all your wallets together for the provider; here each wallet takes its own path.
6. **Double-checks.** A second, independent provider, on its own private path, answers the same questions at the same block. If both agree, one dishonest provider can't fake a "safe" result. If they disagree, the report says so.
7. **Shows its work.** The *What left this device* panel lists every request, which private path it took and which provider answered.
8. **Leak lab.** Runs the same scan the ordinary way through a pretend provider, so you can watch it write down your IP, device and linked wallets. Unseen Shield's requests never reach it.

## How Anon-RPC is used

- `src/lib/anon.ts` wraps `@anon-rpc/browser-harness` in a viem `custom` transport. Every read, including ENS resolution, goes through `worker.fetch`.
- **100% of scan traffic is private.** There is no silent fallback to a direct connection. If the private network fails, scanning stops and says so.
- **Per-wallet isolation.** Each wallet's scan uses its own `anonOptions.isolationKey`, so its requests can't be linked to another wallet's (on networks that support it).
- **Few requests.** Everything is bundled into a single Multicall, so a full scan plus its double-check is about 5 requests, which matters on a slow anonymizing network.
- **Provider rotation.** Some RPC providers stall on traffic from Tor or Nym exits. Requests rotate through PublicNode, MEV Blocker, Blast API, 1RPC and dRPC, still over the private network.
- **Fresh route on failure.** If two providers in a row don't answer, the exit node is probably dead, so the app builds a new route and scans once more.
- **Clean switching.** Switching networks closes any connection still being built, so networks never compete for bandwidth.
- The bootstrap read of the worker's specifier contract is the only direct request. It reveals only that someone is reading the Anon-RPC specifier, nothing about any wallet.

## CROPS

- **Censorship resistance:** No accounts, no backend for scanning, and no dependency on a single RPC provider. Requests rotate across providers over Tor, Nym or Nox, and the scan works from any static host.
- **Open source:** MIT licensed. The scanning rules (tokens, contracts, risk labels) are plain data in `src/lib/registry.ts` that anyone can check.
- **Privacy (the reason it exists):** Wallets are checked through Anon-RPC, so no provider sees your IP next to your wallet. Wallets are kept unlinkable from each other with isolation keys. Your wallet list stays in this browser's localStorage, optional and never uploaded. No trackers, no analytics, and fonts are self-hosted.
- **Security:** Finds approvals that can drain you, flags contracts with a known exploit history, and revokes them. Nothing is signed except the revoke you choose. The Anon-RPC worker runs hash-pinned in a sandboxed iframe with no access to the page.

## Honest limits

- A **revoke is a public transaction.** Your wallet sends it, and every transaction on Ethereum is public. Only the checking is private.
- It checks a **curated list** of tokens and contracts rather than every approval you ever made. That avoids sending your address to an indexer like Etherscan, which would defeat the purpose.
- Answers are **double-checked by a second provider**, not cryptographically proven. Two providers would have to lie the same way to fool it. Light-client verification is the next step.
- The public Tor gateway is the Anon-RPC demo gateway, which has limited capacity and can be slow to connect. That's why Nym is the default. Production use should run its own gateway.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. The first private connection takes about 10 to 20 seconds on Nym, and longer on Tor.

The Leak lab needs the dev or Node server (it uses the `/api/spy` route). Its notes live in memory only and are cleared with the Clear button.

## Tech

Next.js, TypeScript, Tailwind CSS, viem, `@anon-rpc/browser-harness`, Motion.

## License

MIT

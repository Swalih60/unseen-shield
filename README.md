# Unseen Shield

**Find what can drain your wallet, without telling anyone the wallet is yours.**

Old token approvals let apps spend your tokens forever. If one of those contracts is hacked, attackers drain wallets through approvals people forgot about: LI.FI lost about $10M this way in July 2024, Socket about $3.3M in January 2024.

Checking your approvals today means pasting your wallet into a site whose servers and RPC provider see your wallet next to your IP address. You reveal exactly which wallet is yours, and that it might be vulnerable.

Unseen Shield scans approvals **entirely in your browser**, and **every request goes through [Anon-RPC](https://github.com/ethereum/anon-rpc)** (Tor, Nym or Nox), so no provider learns who is asking.

Built at ETHGlobal Mumbai for the Ethereum Foundation tracks *Best Use of Anon-RPC* and *Best CROPS App*.

## What it does

1. **Connects privately.** On page load it starts an Anon-RPC worker (Tor by default) in the background. You can switch to Nym or Nox.
2. **Scans.** For each wallet you add (address or ENS name), it checks 11 popular tokens against 13 commonly approved contracts, including Permit2 sub-approvals. It also reads balances and Chainlink prices so it can show how much money is exposed.
3. **Judges.** Each approval is labeled:
   - **Revoke now:** the contract was drained through approvals (LI.FI Diamond, Socket Gateway)
   - **Worth reviewing:** unlimited approval on a token you hold
   - **Fine for now:** limited, or a token you don't hold
4. **Revokes.** One click sets an approval back to zero through your own wallet.
5. **Shows its work.** The *What left this device* panel lists every request, which private path it took and which provider answered.
6. **Leak lab.** Runs the same scan the ordinary way through a pretend provider, so you can watch it write down your IP, device and linked wallets. Unseen Shield's requests never reach it.

## How Anon-RPC is used

- `src/lib/anon.ts` wraps `@anon-rpc/browser-harness` in a viem `custom` transport. Every read, including ENS resolution, goes through `worker.fetch`.
- **100% of scan traffic is private.** There is no silent fallback to a direct connection. If the private network fails, scanning stops and says so.
- **Per-wallet isolation.** Each wallet's scan uses its own `anonOptions.isolationKey`, so its requests can't be linked to another wallet's (on networks that support it).
- **Few requests.** Everything is bundled into Multicall, so a full scan is about 5 requests, which matters on a slow anonymizing network.
- **Provider rotation.** Some RPC providers refuse traffic from Tor exits. Requests rotate through PublicNode, 1RPC, dRPC and Flashbots, still over the private network.
- The bootstrap read of the worker's specifier contract is the only direct request. It reveals only that someone is reading the Anon-RPC specifier, nothing about any wallet.

## CROPS

- **Censorship resistance:** No accounts, no backend for scanning, and no dependency on a single RPC provider. Requests rotate across providers over Tor, Nym or Nox, and the scan works from any static host.
- **Open source:** MIT licensed. The scanning rules (tokens, contracts, risk labels) are plain data in `src/lib/registry.ts` that anyone can check.
- **Privacy (the reason it exists):** Wallets are checked through Anon-RPC, so no provider sees your IP next to your wallet. Wallets are kept unlinkable from each other with isolation keys. Your wallet list stays in this browser's localStorage, optional and never uploaded. No trackers, no analytics, and fonts are self-hosted.
- **Security:** Finds approvals that can drain you, flags contracts with a known exploit history, and revokes them. Nothing is signed except the revoke you choose. The Anon-RPC worker runs hash-pinned in a sandboxed iframe with no access to the page.

## Honest limits

- A **revoke is a public transaction.** Your wallet sends it, and every transaction on Ethereum is public. Only the checking is private.
- It checks a **curated list** of tokens and contracts rather than every approval you ever made. That avoids sending your address to an indexer like Etherscan, which would defeat the purpose.
- Answers from RPC providers are **not yet verified** with a light client. A dishonest provider could lie about an allowance. Light-client verification is the next step.
- The public Tor gateway is the Anon-RPC demo gateway, which has limited capacity. Production use should run its own.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. The first private connection takes 20 to 60 seconds while Tor builds its route.

The Leak lab needs the dev or Node server (it uses the `/api/spy` route). Its notes live in memory only and are cleared with the Clear button.

## Tech

Next.js, TypeScript, Tailwind CSS, viem, `@anon-rpc/browser-harness`, Motion.

## License

MIT

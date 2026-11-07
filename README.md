# Unseen Shield

**Check whether your wallet can be drained, and what it holds, without anyone learning the wallet is yours.**

- **Live app:** https://unseen-shield-two.vercel.app
- **Built at:** ETHGlobal Mumbai, for the Ethereum Foundation's **Best Use of Anon-RPC** and **Best CROPS App** tracks

---

## The problem

Every time you use a crypto app you give it an **approval** to spend your tokens, usually unlimited and forever. When one of those contracts is exploited, attackers drain every wallet that ever approved it: LI.FI (July 2024, about $11M), Socket (January 2024, about $3.3M), and [70 more](https://github.com/RevokeCash/allowance-exploit-list).

Checking your approvals today means asking someone's server. Approval checkers, indexers and RPC providers see **your wallet next to your IP address**. You end up telling a stranger *"this wallet is mine, and it might be vulnerable"*, which is exactly what an attacker wants to know.

**Security tools shouldn't make you less safe.**

## What Unseen Shield does

Type an address or ENS name and press **Check privately**. One report, three sections:

- **Approvals:** which contracts can still spend your tokens. 🔴 contracts that were drained through approvals, 🟠 unlimited approvals on tokens you hold, ⚪ everything else. **Revoke** sets an approval back to zero from your own wallet.
- **Holdings:** your coins and major tokens on Ethereum, Base, Arbitrum, Optimism, Polygon and BNB Chain, priced with Chainlink feeds read on-chain.
- **Privacy receipt:** the route your check took, proof that two independent providers gave identical answers, and every request that left your device.

A **Compare** page runs the same check the normal way, so you can watch a provider log your device and link your wallets, while Unseen Shield's requests never reach it.

---

## How Anon-RPC is used

**Every blockchain read the app makes goes through Anon-RPC, by default, with no direct fallback.**

| | |
|---|---|
| Library | `@anon-rpc/browser-harness` 0.4.0, wrapped in a viem `custom` transport (`src/lib/anon.ts`) |
| Networks | **Nym** (default) and **Nox**, both selectable. Tor (`tor-js`) is supported in code but hidden: its public demo gateway was too overloaded to connect reliably during the event. |
| Traffic through Anon-RPC | **100% of wallet reads**: approvals, balances, prices and ENS resolution, on all six chains, plus the double-check |
| Disclosed exception | The harness's bootstrap read of the network's specifier contract (`eth_call` to the specifier). It reveals only that someone loads that worker; it carries no wallet data. |
| Worker integrity | The harness verifies the worker bundle's keccak256 against the specifier before running it in a null-origin sandboxed iframe with no access to the page, storage or keys |

**What we built on top of the harness:**

- **Per-wallet isolation keys.** Each wallet's requests carry their own `anonOptions.isolationKey`, so checking several wallets doesn't link them, even for the mixnet. The second-opinion reads use a separate key again.
- **Few requests.** Each Ethereum scan is about 160 read-only calls (`allowance`, Permit2 `allowance`, `balanceOf`, Chainlink `latestRoundData`) bundled with Multicall3 into one request, plus one small bundle per other chain, which matters on a slow mixnet.
- **Fail closed.** If too many approval checks come back unanswered, the app retries with another provider and otherwise shows an error. **It never reports "safe" without the data.** It never falls back to a direct connection.
- **Self-healing routes.** Providers that stall on mixnet traffic are rotated (PublicNode, MEV Blocker, Blast API, 1RPC, dRPC). Two failures in a row rebuild the route (a fresh exit) and scan again. Switching networks shuts down the previous connection immediately.
- **Two-provider cross-check.** A second provider, on its own private path, answers the same bundle at the same block. Matching answers are shown as double-checked; a mismatch warns the user.
- **Fast first check.** The private connection starts in the background as soon as the page opens, retries once on its own, and shows what the network is doing while it connects.
- **Visible proof.** The privacy receipt lists every request (time, path, provider, latency). Nothing is hidden behind "trust us".

---

## CROPS

**Lead property: Privacy.** It is structural, not a setting: every read goes through Anon-RPC by default, and there is no direct path to fall back to.

- **C, Censorship resistance (control and dependencies):** No accounts, API keys or backend in the scanning path; providers are rotated when one refuses. We depend on the mixnets (Nym, Nox), public RPC providers, the CDN serving the mixnet client, and Vercel for hosting; the app also runs locally from this repo without any service of ours.
- **O, Open source (licensing and buildability):** MIT licensed; builds with `npm install && npm run build`. The scanning rules (tokens, contracts, risk labels) are plain data in `src/lib/registry.ts` that anyone can audit.
- **P, Privacy (what third parties learn):** RPC providers learn which wallet was queried, but not the IP and not that a user's wallets belong together (per-wallet isolation keys). The only direct request is Anon-RPC's bootstrap specifier read, which carries no wallet data; details below.
- **S, Security (keys and data):** No keys, signatures or approvals are requested, and there is no smart contract; Revoke sends `approve(spender, 0)` from the user's own wallet. The wallet list stays in the browser's localStorage only if the user opts in, and no trackers or analytics are included.

### What each third party learns

| Who | Learns | Doesn't learn |
|---|---|---|
| RPC providers | That some wallet was queried | Your IP, or that your wallets belong together |
| Mixnet nodes | Encrypted traffic; the entry node sees your IP | What you asked |
| Second-opinion provider | The same public reads | Who asked, or the link to the first path |
| Bootstrap RPC | That someone loaded the Anon-RPC worker | Any wallet |
| CDN (mixnet client) and Vercel (site) | That someone opened the app | Any wallet |
| Us | Nothing: no server sees scans | |

Fonts are bundled at build time.

---

## What gets checked

- **Approvals on Ethereum:** 11 tokens (USDC, USDT, DAI, WETH, stETH, WBTC, LINK, UNI, AAVE, SHIB, PEPE) against 13 contracts: 11 commonly approved ones (Permit2, Uniswap routers including the Universal Router via Permit2, 1inch, 0x, SushiSwap, Aave V3, OpenSea) and 2 that were drained through approvals (LI.FI Diamond, July 2024; Socket Gateway, January 2024), with addresses checked against public incident reports.
- **Balances on six chains:** Ethereum, Base, Arbitrum, Optimism, Polygon and BNB Chain, each chain's coin plus USDC/USDT/WETH, with every address verified on-chain.
- **Prices:** Chainlink feeds for ETH, BTC, LINK, UNI, AAVE, SHIB, BNB and POL, read on-chain inside the same private requests. No price API.

## Honest limits

- The approval check covers **Ethereum**; balances cover six chains.
- It checks listed tokens and contracts, not every approval ever made. Finding all approvals needs an indexer (which would see the wallet) or thousands of slow history queries through a mixnet.
- "Held on 6 chains" isn't a full net worth: other chains and tokens aren't counted, for the same reason.
- **Revoking is public**, like every transaction.
- It **can't detect a stolen recovery phrase.** A thief with your key doesn't need an approval.
- Answers are double-checked by two providers, not yet proven with a light client.
- Mixnets are slower than direct connections; a check usually takes 10 to 60 seconds.

## Run it

```bash
npm install
npm run dev   # http://localhost:3000
```

The Compare page needs the dev or Node server (it uses the `/api/spy` route, which keeps its notes in memory only). Add `?dev` to the URL to reveal a non-private test network for debugging.

## Tech

Next.js 16, TypeScript, Tailwind CSS, Motion, viem, `@anon-rpc/browser-harness`, Nym and Nox, Multicall3, Chainlink Data Feeds.

## AI use

We used Claude Code as a coding and research assistant: writing and refactoring code, verifying contract addresses on-chain, browser testing and interface design. We reviewed and can explain every part.

## Credits

Anon-RPC: the Ethereum Foundation's Access Layer team. Nym and Nox mixnets. Prices: Chainlink.

## License

MIT

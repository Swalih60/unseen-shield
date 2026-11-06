// What we check: popular tokens × the contracts people most often approve.
// Everything here is public data that ships with the app, so scanning never
// has to ask an indexer (Etherscan, an API) which approvals a wallet has.

import type { Address, Chain } from "viem";
import { arbitrum, base, bsc, optimism, polygon } from "viem/chains";

export type Token = {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  // How we price it, read on-chain from a Chainlink feed (also through Anon-RPC).
  price: PriceKind;
};

export type PriceKind = "usd" | "eth" | "btc" | "link" | "uni" | "aave" | "shib" | "bnb" | "pol" | "none";

export type SpenderKind = "trusted" | "exploited";

export type Spender = {
  name: string;
  address: Address;
  kind: SpenderKind;
  // Shown under the name. For exploited contracts: what happened.
  note: string;
  // Universal Router and friends spend through Permit2, so their real
  // allowance lives inside Permit2, not on the token.
  viaPermit2?: boolean;
};

export const PERMIT2: Address = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

export const TOKENS: Token[] = [
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    price: "usd",
  },
  { symbol: "USDT", name: "Tether", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, price: "usd" },
  { symbol: "DAI", name: "Dai", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18, price: "usd" },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    decimals: 18,
    price: "eth",
  },
  {
    symbol: "stETH",
    name: "Lido Staked Ether",
    address: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
    decimals: 18,
    price: "eth",
  },
  {
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    decimals: 8,
    price: "btc",
  },
  {
    symbol: "LINK",
    name: "Chainlink",
    address: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    decimals: 18,
    price: "link",
  },
  { symbol: "UNI", name: "Uniswap", address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", decimals: 18, price: "uni" },
  { symbol: "AAVE", name: "Aave", address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", decimals: 18, price: "aave" },
  {
    symbol: "SHIB",
    name: "Shiba Inu",
    address: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE",
    decimals: 18,
    price: "shib",
  },
  { symbol: "PEPE", name: "Pepe", address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933", decimals: 18, price: "none" },
];

export const SPENDERS: Spender[] = [
  // Contracts that were drained through users' existing approvals.
  {
    name: "LI.FI Diamond",
    address: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
    kind: "exploited",
    note: "Drained through unlimited approvals on 16 July 2024 (about $10M lost). LI.FI asked users to revoke.",
  },
  {
    name: "Socket Gateway",
    address: "0x3a23F943181408EAC424116Af7b7790c94Cb97a5",
    kind: "exploited",
    note: "Drained through existing approvals in January 2024 (about $3.3M lost). Revoking was advised.",
  },
  // Widely used contracts. Safe today, but an unlimited approval is still a standing risk.
  { name: "Permit2", address: PERMIT2, kind: "trusted", note: "Uniswap's shared approval contract" },
  {
    name: "Uniswap Universal Router",
    address: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD",
    kind: "trusted",
    note: "Uniswap swaps",
    viaPermit2: true,
  },
  {
    name: "Uniswap V3 Router",
    address: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    kind: "trusted",
    note: "Uniswap swaps (older)",
  },
  {
    name: "Uniswap Router 02",
    address: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    kind: "trusted",
    note: "Uniswap swaps (older)",
  },
  {
    name: "Uniswap V2 Router",
    address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    kind: "trusted",
    note: "Uniswap swaps (oldest)",
  },
  {
    name: "1inch Router v6",
    address: "0x111111125421cA6dc452d289314280a0f8842A65",
    kind: "trusted",
    note: "1inch swaps",
  },
  {
    name: "1inch Router v5",
    address: "0x1111111254EEB25477B68fb85Ed929f73A960582",
    kind: "trusted",
    note: "1inch swaps (older)",
  },
  {
    name: "0x Exchange Proxy",
    address: "0xDef1C0ded9bec7F1a1670819833240f027b25EfF",
    kind: "trusted",
    note: "0x / Matcha swaps",
  },
  {
    name: "SushiSwap Router",
    address: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
    kind: "trusted",
    note: "SushiSwap swaps",
  },
  {
    name: "Aave V3 Pool",
    address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    kind: "trusted",
    note: "Aave lending",
  },
  {
    name: "OpenSea Conduit",
    address: "0x1E0049783F008A0085193E00003D00cd54003c71",
    kind: "trusted",
    note: "OpenSea offers",
  },
];

// Chainlink price feeds on Ethereum mainnet, all checked on-chain with description().
// Every one is in USD with 8 decimals, except SHIB, which is priced in ETH with 18 decimals.
export const PRICE_FEEDS = {
  eth: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
  btc: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
  link: "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
  uni: "0x553303d460EE0afB37EdFf9bE42922D8FF63220e",
  aave: "0x547a514d5e3769680Ce22B2361c10Ea13619e8a9",
  shib: "0x8dD1CD88F43aF196ae478e91b9F5E4Ac69A97C61",
  bnb: "0x14e613AC84a31f709eadbdF89C6CC390fDc9540A",
  pol: "0x7bAC85A8a13A4BcD8abb3eB7d6b4d632c5a57676", // MATIC/USD; POL replaced MATIC one to one
} as const satisfies Record<string, Address>;

// Other chains we read balances on (the safety check covers Ethereum only).
// Token addresses were checked on-chain with symbol() and decimals().
export type OtherChain = {
  key: string;
  name: string;
  chain: Chain;
  rpcs: string[];
  native: { symbol: string; name: string; price: PriceKind };
  tokens: Token[];
};

export const OTHER_CHAINS: OtherChain[] = [
  {
    key: "base",
    name: "Base",
    chain: base,
    rpcs: ["https://base-rpc.publicnode.com", "https://mainnet.base.org", "https://1rpc.io/base"],
    native: { symbol: "ETH", name: "Ether", price: "eth" },
    tokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        decimals: 6,
        price: "usd",
      },
      {
        symbol: "WETH",
        name: "Wrapped Ether",
        address: "0x4200000000000000000000000000000000000006",
        decimals: 18,
        price: "eth",
      },
    ],
  },
  {
    key: "arbitrum",
    name: "Arbitrum",
    chain: arbitrum,
    rpcs: ["https://arbitrum-one-rpc.publicnode.com", "https://arb1.arbitrum.io/rpc", "https://1rpc.io/arb"],
    native: { symbol: "ETH", name: "Ether", price: "eth" },
    tokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        decimals: 6,
        price: "usd",
      },
      {
        symbol: "USDT",
        name: "Tether",
        address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        decimals: 6,
        price: "usd",
      },
      {
        symbol: "WETH",
        name: "Wrapped Ether",
        address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        decimals: 18,
        price: "eth",
      },
    ],
  },
  {
    key: "optimism",
    name: "Optimism",
    chain: optimism,
    rpcs: ["https://optimism-rpc.publicnode.com", "https://mainnet.optimism.io", "https://1rpc.io/op"],
    native: { symbol: "ETH", name: "Ether", price: "eth" },
    tokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
        decimals: 6,
        price: "usd",
      },
      {
        symbol: "USDT",
        name: "Tether",
        address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
        decimals: 6,
        price: "usd",
      },
      {
        symbol: "WETH",
        name: "Wrapped Ether",
        address: "0x4200000000000000000000000000000000000006",
        decimals: 18,
        price: "eth",
      },
    ],
  },
  {
    key: "polygon",
    name: "Polygon",
    chain: polygon,
    rpcs: ["https://polygon-bor-rpc.publicnode.com", "https://polygon-rpc.com", "https://1rpc.io/matic"],
    native: { symbol: "POL", name: "Polygon", price: "pol" },
    tokens: [
      {
        symbol: "USDC",
        name: "USD Coin",
        address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
        decimals: 6,
        price: "usd",
      },
      {
        symbol: "USDT",
        name: "Tether",
        address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
        decimals: 6,
        price: "usd",
      },
      {
        symbol: "WETH",
        name: "Wrapped Ether",
        address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
        decimals: 18,
        price: "eth",
      },
    ],
  },
  {
    key: "bnb",
    name: "BNB Chain",
    chain: bsc,
    rpcs: ["https://bsc-rpc.publicnode.com", "https://bsc-dataseed.bnbchain.org", "https://1rpc.io/bnb"],
    native: { symbol: "BNB", name: "BNB", price: "bnb" },
    tokens: [
      {
        symbol: "USDT",
        name: "Tether",
        address: "0x55d398326f99059fF775485246999027B3197955",
        decimals: 18,
        price: "usd",
      },
      {
        symbol: "USDC",
        name: "USD Coin",
        address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
        decimals: 18,
        price: "usd",
      },
      {
        symbol: "ETH",
        name: "Ether (bridged)",
        address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
        decimals: 18,
        price: "eth",
      },
    ],
  },
];

export function spenderByAddress(address: string): Spender | undefined {
  const a = address.toLowerCase();
  return SPENDERS.find((s) => s.address.toLowerCase() === a);
}

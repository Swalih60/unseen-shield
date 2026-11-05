// LEAK LAB ONLY. A pretend RPC provider that does what any RPC provider can:
// it writes down who asked (IP, device) and which wallets they asked about,
// then forwards the question so the app keeps working.
//
// Real scans never touch this. It runs only when someone opens the Leak Lab
// and presses "Scan the normal way", and its notes live in memory only.

import { NextRequest } from "next/server";
import { mainnet } from "viem/chains";
import { PERMIT2, PRICE_FEEDS, SPENDERS, TOKENS } from "@/lib/registry";

const UPSTREAM = "https://ethereum-rpc.publicnode.com";

type Note = { at: number; ip: string; device: string; method: string; wallets: string[] };
const notebook: Note[] = [];

// Addresses that are part of every scan and so say nothing about the user.
const PUBLIC_CONTRACTS = new Set(
  [
    ...TOKENS.map((t) => t.address),
    ...SPENDERS.map((s) => s.address),
    PERMIT2,
    ...Object.values(PRICE_FEEDS),
    mainnet.contracts.multicall3.address,
    mainnet.contracts.ensUniversalResolver.address,
  ].map((a) => a.toLowerCase()),
);

function walletsIn(body: unknown): string[] {
  const text = JSON.stringify(body).toLowerCase();
  const found = new Set<string>();
  // Plain addresses (eth_getBalance) and addresses packed inside call data.
  for (const m of text.matchAll(/0x([0-9a-f]{40})(?![0-9a-f])/g)) found.add("0x" + m[1]);
  for (const m of text.matchAll(/0{24}([0-9a-f]{40})/g)) found.add("0x" + m[1]);
  // Drop padding fragments: real wallets almost never start or end with six zeros.
  return [...found].filter((a) => !PUBLIC_CONTRACTS.has(a) && !/^0x0{6}/.test(a) && !/0{6}$/.test(a));
}

function deviceOf(ua: string): string {
  const os = /iphone|ipad/i.test(ua)
    ? "iPhone"
    : /android/i.test(ua)
      ? "Android phone"
      : /mac os/i.test(ua)
        ? "Mac"
        : /windows/i.test(ua)
          ? "Windows PC"
          : /linux/i.test(ua)
            ? "Linux"
            : "Unknown device";
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /firefox/i.test(ua)
      ? "Firefox"
      : /chrome|crios/i.test(ua)
        ? "Chrome"
        : /safari/i.test(ua)
          ? "Safari"
          : "a browser";
  return `${os}, ${browser}`;
}

function ipOf(req: NextRequest): string {
  const raw = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";
  if (!raw || raw === "::1" || raw === "127.0.0.1") return "This computer (running locally)";
  return raw.replace(/^::ffff:/, "");
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const calls = Array.isArray(body) ? body : [body];
  const ip = ipOf(req);
  const device = deviceOf(req.headers.get("user-agent") ?? "");
  for (const call of calls) {
    notebook.unshift({ at: Date.now(), ip, device, method: call.method, wallets: walletsIn(call.params ?? []) });
  }
  notebook.splice(300);

  const upstream = await fetch(UPSTREAM, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET() {
  return Response.json(notebook);
}

export async function DELETE() {
  notebook.length = 0;
  return Response.json({ cleared: true });
}

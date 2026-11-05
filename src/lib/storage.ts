// Your wallet list lives in this browser only (localStorage). Nothing is
// sent to a server, because there is no server that stores anything.

const KEY = "unseen-shield:wallets";
const REMEMBER = "unseen-shield:remember";

export function loadWallets(): string[] {
  try {
    if (localStorage.getItem(REMEMBER) === "no") return [];
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function saveWallets(list: string[]) {
  try {
    if (localStorage.getItem(REMEMBER) === "no") return;
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage blocked (private window). The app still works for this visit.
  }
}

export function getRemember(): boolean {
  try {
    return localStorage.getItem(REMEMBER) !== "no";
  } catch {
    return false;
  }
}

export function setRemember(on: boolean, current: string[]) {
  try {
    localStorage.setItem(REMEMBER, on ? "yes" : "no");
    if (on) localStorage.setItem(KEY, JSON.stringify(current));
    else localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

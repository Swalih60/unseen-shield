"use client";

import { useSyncExternalStore } from "react";
import { anonStatus } from "@/lib/anon";

export function useAnon() {
  return useSyncExternalStore(anonStatus.subscribe, anonStatus.get, anonStatus.get);
}

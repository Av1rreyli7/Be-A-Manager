"use client";
/** Per-browser appearance preference: light/dark/system mode and colourful/plain style. */
import { useSyncExternalStore } from "react";
import { APPEARANCE_KEY, DARK_QUERY } from "./appearanceBoot";

export { THEME_CACHE_KEY } from "./appearanceBoot";

export type Mode = "dark" | "light" | "system";
export type Style = "colorful" | "plain";
export interface Appearance {
  mode: Mode;
  style: Style;
}

const DEFAULT: Appearance = { mode: "dark", style: "colorful" };

const listeners = new Set<() => void>();
let current: Appearance | null = null;

function read(): Appearance {
  if (current) return current;
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY);
    current = raw ? { ...DEFAULT, ...(JSON.parse(raw) as Partial<Appearance>) } : DEFAULT;
  } catch {
    current = DEFAULT;
  }
  return current;
}

export function setAppearance(patch: Partial<Appearance>) {
  current = { ...read(), ...patch };
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(current));
  } catch {
    /* storage blocked: the choice still applies for this visit */
  }
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function useAppearance(): Appearance {
  return useSyncExternalStore(subscribe, read, () => DEFAULT);
}

const subscribeSystem = (cb: () => void) => {
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** Appearance with "system" resolved against the OS setting. */
export function useResolvedAppearance() {
  const a = useAppearance();
  const systemDark = useSyncExternalStore(subscribeSystem, () => window.matchMedia(DARK_QUERY).matches, () => true);
  const light = a.mode === "light" || (a.mode === "system" && !systemDark);
  return { light, plain: a.style === "plain" };
}

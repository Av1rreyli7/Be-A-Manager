/**
 * Player Career: talking to the Floodlights server. Every call carries the save code and the name, the same
 * way the Floodlights page does, and every change comes back with the fresh career state.
 */
import type { CareerState, CareerSummary, LifeEvent, Look, PersonForm, Post } from "./types";

const CODE_KEY = "fl_pc_code";
const NAME_KEY = "fl_pc_name";

export interface Saved {
  code: string;
  name: string;
}

export function readSaved(): Saved | null {
  try {
    const code = localStorage.getItem(CODE_KEY);
    const name = localStorage.getItem(NAME_KEY);
    return code && name ? { code, name } : null;
  } catch {
    return null;
  }
}
export function writeSaved(s: Saved | null) {
  try {
    if (s) {
      localStorage.setItem(CODE_KEY, s.code);
      localStorage.setItem(NAME_KEY, s.name);
    } else {
      localStorage.removeItem(CODE_KEY);
      localStorage.removeItem(NAME_KEY);
    }
  } catch {
    /* fine: the career just will not be remembered in this browser */
  }
}

export class ApiError extends Error {
  decision?: { id: string; kind: string; title: string };
  event?: LifeEvent;
  seasonOver?: boolean;
}

async function call<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const r = await fetch(
    path,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { cache: "no-store" },
  );
  let j: Record<string, unknown> = {};
  try {
    j = await r.json();
  } catch {
    /* an empty or broken reply is reported below */
  }
  if (!r.ok) {
    const e = new ApiError(String(j.error || "Something went wrong."));
    if (j.decision) e.decision = j.decision as ApiError["decision"];
    if (j.seasonOver) e.seasonOver = true;
    if (j.event) e.event = j.event as LifeEvent;
    throw e;
  }
  return j as T;
}

export interface StateReply {
  state: CareerState;
}
export interface WeekReply extends StateReply {
  reports: WeekReport[];
}
export interface WeekReport {
  week: string;
  rating: number;
  seasonOver?: boolean;
  training: {
    gains: Record<string, number>;
    fatigue: number;
    injured: unknown;
    cost: number;
  };
  match: MatchLine | null;
  tease?: string;
  intl?: (MatchLine & { level?: string }) | null;
}
export interface MatchLine {
  comp: string;
  opp: string;
  team?: string;
  gf?: number;
  ga?: number;
  role: string;
  mins: number;
  g?: number;
  a?: number;
  cs?: boolean;
  rating?: number;
  national?: boolean;
  pro?: boolean;
  live?: boolean;
  home?: boolean;
}

export const careerApi = {
  create: (name: string, player: PersonForm & { look: Look }) => call<StateReply & { code: string }>("/api/pc/create", { name, player }),
  state: (s: Saved) => call<StateReply>(`/api/pc/state?code=${encodeURIComponent(s.code)}&name=${encodeURIComponent(s.name)}`),
  options: <T>(s: Saved, kind: string) => call<{ options: T[] }>(`/api/pc/options?code=${encodeURIComponent(s.code)}&name=${encodeURIComponent(s.name)}&kind=${kind}`),
  decide: (s: Saved, id: string, choice: string) => call<StateReply>("/api/pc/decide", { ...s, id, choice }),
  plan: (s: Saved, slots: string[], intensity: string) => call<StateReply>("/api/pc/plan", { ...s, slots, intensity }),
  week: (s: Saved, weeks: number) => call<WeekReply>("/api/pc/week", { ...s, weeks }),
  season: (s: Saved) =>
    call<StateReply & { summary: Record<string, unknown> }>("/api/pc/season", {
      ...s,
    }),
  negotiate: (s: Saved, offer: string) =>
    call<StateReply & { withdrawn?: boolean }>("/api/pc/negotiate", {
      ...s,
      offer,
    }),
  sign: (s: Saved, offer: string) => call<StateReply>("/api/pc/sign", { ...s, offer }),
  read: (s: Saved, thread: string) => call<StateReply>("/api/pc/read", { ...s, thread }),
  moment: (s: Saved, key: string) => call<StateReply>("/api/pc/moment", { ...s, key }),
  request: (s: Saved) => call<StateReply>("/api/pc/request", { ...s }),
  act: (s: Saved, place: string, action: string, arg?: string) => call<StateReply & { text: string; gains?: Record<string, number> }>("/api/pc/act", { ...s, place, action, arg }),
  post: (s: Saved, kind: string) => call<StateReply & { post: Post }>("/api/pc/post", { ...s, kind }),
  sponsor: (s: Saved, id: string, yes: boolean) => call<StateReply>("/api/pc/sponsor", { ...s, id, yes }),
  bank: (s: Saved, op: "save" | "take", amount: number) => call<StateReply>("/api/pc/bank", { ...s, op, amount }),
  event: (s: Saved, id: string, choice: string) => call<StateReply & { note?: string }>("/api/pc/event", { ...s, id, choice }),
  agent: (s: Saved, action: "find" | "drop") => call<StateReply>("/api/pc/agent", { ...s, action }),
  retire: (s: Saved) => call<StateReply & { summary: CareerSummary }>("/api/pc/retire", { ...s }),
  manage: (s: Saved, club: string) => call<{ ok: boolean; club: string; code: string; name: string }>("/api/pc/manage", { ...s, club }),
};

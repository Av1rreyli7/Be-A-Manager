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
  /** the server answered; false when it could not be reached at all */
  answered = true;
}

/** fired once when the save is gone from the server (a restart cleared it); the career page shows its end screen */
export const ENDED_EVENT = "pc:ended";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/**
 * One request. The free server sleeps when nobody plays: while it wakes up (no answer, or 502 to 504) the page
 * asks again quietly for up to a minute. A change (POST) that never reached the server is not sent twice.
 */
export async function send(path: string, init: RequestInit, retryPost = false): Promise<Response> {
  const t0 = Date.now();
  for (let i = 0; ; i++) {
    let r: Response | null = null;
    try {
      r = await fetch(path, init);
    } catch {
      if (init.method === "POST" && !retryPost) {
        const e = new ApiError("Could not reach the server. Check your connection and try again.");
        e.answered = false;
        throw e;
      }
    }
    if (r && r.status !== 502 && r.status !== 503 && r.status !== 504) return r;
    if (Date.now() - t0 > 60000) {
      const e = new ApiError("The server is not answering. Try again in a minute.");
      e.answered = false;
      throw e;
    }
    await sleep(Math.min(4000, 500 * (i + 1)));
  }
}

let copyDirty = true;
async function call<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const r = await send(
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
    // the save is gone: the end screen takes over, and whatever asked never shows an error
    if (r.status === 404 && j.error === "Game not found." && typeof window !== "undefined") {
      window.dispatchEvent(new Event(ENDED_EVENT));
      return new Promise<T>(() => {});
    }
    const e = new ApiError(String(j.error || "Something went wrong."));
    if (j.decision) e.decision = j.decision as ApiError["decision"];
    if (j.seasonOver) e.seasonOver = true;
    if (j.event) e.event = j.event as LifeEvent;
    throw e;
  }
  if (body) copyDirty = true;
  return j as T;
}

// ---------- the careers saved on this device ----------
// Player Career is a game for one. Every career is saved on this device as well as on the server: a packed copy
// of the save, refreshed a moment after every change, so a career is never lost to a server restart and any of
// them can be picked up again from the title screen. A career can also be saved to a file and loaded from one
// (a backup, or the way to take it to another device). The copies sit in the same little store the Floodlights
// page keeps its manager games in (IndexedDB "floodlights", "copies"); a career's copy says kind "career".
export interface SaveCopy {
  code: string;
  name: string;
  at: number;
  data: ArrayBuffer;
  kind?: "career";
  /** how the list of careers shows it: the player's name, then age, position, team, season and week */
  label?: string;
  sub?: string;
}
function copyStore<T>(mode: IDBTransactionMode, fn: (st: IDBObjectStore) => IDBRequest | void): Promise<T | null> {
  return new Promise<T | null>((res) => {
    try {
      const q = indexedDB.open("floodlights", 1);
      q.onupgradeneeded = () => q.result.createObjectStore("copies");
      q.onerror = () => res(null);
      q.onsuccess = () => {
        const t = q.result.transaction("copies", mode);
        const rq = fn(t.objectStore("copies"));
        t.oncomplete = () => res(rq ? (rq.result as T) : null);
        t.onerror = () => res(null);
      };
    } catch {
      res(null);
    }
  });
}
const FILE_KIND = "floodlights-player-career";
function toBase64(buf: ArrayBuffer) {
  const b = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromBase64(t: string): ArrayBuffer {
  const s = atob(t);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b.buffer;
}
export const careerCopy = {
  get: async (code: string) => {
    const c = await copyStore<SaveCopy>("readonly", (st) => st.get(code));
    return c && c.kind === "career" ? c : c && !c.kind ? c : null;
  },
  /** every career on this device, the last one played first */
  async list(): Promise<SaveCopy[]> {
    const all = (await copyStore<SaveCopy[]>("readonly", (st) => st.getAll())) || [];
    return all.filter((c) => c && c.kind === "career").sort((a, b) => b.at - a.at);
  },
  remove: (code: string) => copyStore("readwrite", (st) => st.delete(code)),
  /** what the list shows for the career being played (set from its state as it changes) */
  about: null as null | { label: string; sub: string },
  busy: false,
  again: false,
  /** a fresh copy when something changed (or when asked to) */
  async take(s: Saved, force = false) {
    if (this.busy) {
      this.again = true;
      return;
    }
    if (!force && !copyDirty) return;
    this.busy = true;
    try {
      const r = await fetch(`/api/save/copy?code=${encodeURIComponent(s.code)}&name=${encodeURIComponent(s.name)}`, { cache: "no-store" });
      if (r.ok) {
        copyDirty = false;
        const rec: SaveCopy = { code: s.code, name: s.name, at: Date.now(), data: await r.arrayBuffer(), kind: "career", label: this.about?.label, sub: this.about?.sub };
        await copyStore("readwrite", (st) => st.put(rec, rec.code));
      }
    } catch {
      /* the next one will do */
    }
    this.busy = false;
    if (this.again) {
      this.again = false;
      setTimeout(() => void this.take(s), 500);
    }
  },
  /** hands the copy back to the server; the reply has the code it opened under (a new one if the old was taken) */
  async restore(copy: SaveCopy): Promise<Saved> {
    const r = await send(`/api/save/restore?name=${encodeURIComponent(copy.name)}`, { method: "POST", headers: { "Content-Type": "application/gzip" }, body: copy.data }, true);
    const j = (await r.json().catch(() => ({}))) as { code?: string; error?: string };
    if (!r.ok || !j.code) throw new ApiError(j.error || "Something went wrong.");
    return { code: j.code, name: copy.name };
  },
  /** the career as a file to keep */
  file(copy: SaveCopy): { name: string; blob: Blob } {
    const text = JSON.stringify({ kind: FILE_KIND, v: 1, code: copy.code, name: copy.name, at: copy.at, label: copy.label, sub: copy.sub, data: toBase64(copy.data) });
    const base = (copy.label || copy.name || "career").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "career";
    return { name: base + "-player-career.json", blob: new Blob([text], { type: "application/json" }) };
  },
  /** a career file back into a copy (not on the server yet: restore puts it there) */
  async read(f: File): Promise<SaveCopy> {
    let j: { kind?: string; code?: string; name?: string; at?: number; label?: string; sub?: string; data?: string } = {};
    try {
      j = JSON.parse(await f.text());
    } catch {
      /* reported below */
    }
    if (j.kind !== FILE_KIND || typeof j.data !== "string" || !j.name || !j.code) throw new ApiError("That file is not a Player Career save.");
    return { code: j.code, name: j.name, at: Number(j.at) || Date.now(), data: fromBase64(j.data), kind: "career", label: j.label, sub: j.sub };
  },
};

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

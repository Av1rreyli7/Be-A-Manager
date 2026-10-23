/**
 * PRIZE FIGHTER saves, kept on this device the way the site's other single player saves are: localStorage with
 * versioned keys, every read and write in try and catch (a private window or blocked storage just means nothing
 * is remembered), and every value cleaned on the way in so an old or hand edited save can never break a screen.
 *  - created fighters (the creator's output, at most 40)
 *  - records: wins, losses, draws and knockouts for every fighter you have fought as
 *  - settings: graphics, sound, the frame guard, the last fight setup
 *  - the fight in progress (a snapshot taken every few seconds), so a refresh can carry on
 */
import { sanitize, type Created } from "./engine/create";
import { restore, snapshot } from "./engine/fight";
import type { FightState, Tier } from "./engine/types";

export const KEYS = {
  fighters: "pf_fighters_v1",
  records: "pf_records_v1",
  settings: "pf_settings_v1",
  fight: "pf_fight_v1",
} as const;
export const MAX_FIGHTERS = 40;

/** a storage that can be swapped for a stand in (the headless battery) */
export interface Store {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}
let store: Store | null = null;
export function useStore(s: Store | null) {
  store = s;
}
function st(): Store | null {
  if (store) return store;
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
function read<T>(k: string): T | null {
  try {
    const raw = st()?.getItem(k);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(k: string, v: unknown): boolean {
  try {
    const s = st();
    if (!s) return false;
    s.setItem(k, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ created fighters

export function listFighters(): Created[] {
  const raw = read<unknown[]>(KEYS.fighters);
  if (!Array.isArray(raw)) return [];
  const out: Created[] = [];
  const ids = new Set<string>();
  for (const r of raw.slice(0, MAX_FIGHTERS)) {
    const c = sanitize(r);
    if (!c.id || ids.has(c.id)) continue;
    ids.add(c.id);
    out.push(c);
  }
  return out.sort((a, b) => b.made - a.made);
}

function newId() {
  return "f" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

/** saves a fighter (a new one gets an id), newest first; returns the saved fighter or null when storage failed */
export function saveFighter(c: Created): Created | null {
  const clean = sanitize(c);
  if (!clean.id) clean.id = newId();
  if (!clean.made) clean.made = Date.now();
  const list = listFighters().filter(f => f.id !== clean.id);
  list.unshift(clean);
  return write(KEYS.fighters, list.slice(0, MAX_FIGHTERS)) ? clean : null;
}

export function deleteFighter(id: string) {
  write(KEYS.fighters, listFighters().filter(f => f.id !== id));
  const r = readRecords();
  delete r["c:" + id];
  write(KEYS.records, r);
}

export function getFighter(id: string): Created | null {
  return listFighters().find(f => f.id === id) ?? null;
}

// ------------------------------------------------------------------ records

export interface Record { w: number; l: number; d: number; ko: number }
export function readRecords(): { [id: string]: Record } {
  const raw = read<{ [id: string]: Partial<Record> }>(KEYS.records);
  const out: { [id: string]: Record } = {};
  if (!raw || typeof raw !== "object") return out;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(99999, Math.floor(v)) : 0);
  for (const k of Object.keys(raw).slice(0, 200)) {
    if (!/^(c:)?[a-z0-9_-]{1,40}$/i.test(k) || k === "__proto__" || k === "constructor" || k === "prototype") continue;
    const r = raw[k] || {};
    out[k] = { w: n(r.w), l: n(r.l), d: n(r.d), ko: n(r.ko) };
  }
  return out;
}
export function recordOf(id: string): Record {
  return readRecords()[id] ?? { w: 0, l: 0, d: 0, ko: 0 };
}
/** a finished fight counts once for the fighter you fought as */
export function addResult(id: string, won: boolean | null, stoppage: boolean) {
  const all = readRecords();
  const r = all[id] ?? { w: 0, l: 0, d: 0, ko: 0 };
  if (won === null) r.d++;
  else if (won) {
    r.w++;
    if (stoppage) r.ko++;
  } else r.l++;
  all[id] = r;
  write(KEYS.records, all);
}
export function recordText(r: Record) {
  return `${r.w}-${r.l}-${r.d}` + (r.ko ? ` (${r.ko} KO)` : "");
}

// ------------------------------------------------------------------ settings

export interface Settings {
  /** graphics level: 0 low, 1 medium, 2 high, 3 ultra */
  gfx: number;
  /** the frame guard steps the level down when frames run long */
  auto: boolean;
  sound: boolean;
  volume: number;
  /** show the controls strip */
  strip: boolean;
  rounds: 3 | 6 | 12;
  roundSec: number;
  tier: Tier;
  /** mouse look sensitivity, 0.5 to 1.5 */
  look: number;
}
export function defaultSettings(cores = 4): Settings {
  return { gfx: cores >= 8 ? 2 : 1, auto: true, sound: true, volume: 0.8, strip: true, rounds: 3, roundSec: 120, tier: 1, look: 1 };
}
export function readSettings(): Settings {
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
  const d = defaultSettings(cores);
  const r = read<Partial<Settings>>(KEYS.settings);
  if (!r || typeof r !== "object") return d;
  const pick = <T,>(v: unknown, ok: (x: unknown) => boolean, def: T): T => (ok(v) ? (v as T) : def);
  return {
    gfx: pick(r.gfx, v => v === 0 || v === 1 || v === 2 || v === 3, d.gfx),
    auto: pick(r.auto, v => typeof v === "boolean", d.auto),
    sound: pick(r.sound, v => typeof v === "boolean", d.sound),
    volume: pick(r.volume, v => typeof v === "number" && v >= 0 && v <= 1, d.volume),
    strip: pick(r.strip, v => typeof v === "boolean", d.strip),
    rounds: pick(r.rounds, v => v === 3 || v === 6 || v === 12, d.rounds),
    roundSec: pick(r.roundSec, v => v === 60 || v === 120 || v === 180, d.roundSec),
    tier: pick(r.tier, v => v === 0 || v === 1 || v === 2 || v === 3 || v === 4, d.tier),
    look: pick(r.look, v => typeof v === "number" && v >= 0.5 && v <= 1.5, d.look),
  };
}
export function writeSettings(s: Settings) {
  return write(KEYS.settings, s);
}

// ------------------------------------------------------------------ the fight in progress

export interface SavedFight {
  /** who the person fights as: a roster id or c:<created id> */
  me: string;
  them: string;
  at: number;
  state: string;
}
export function saveFight(me: string, them: string, state: FightState) {
  if (state.phase === "over") return clearFight();
  return write(KEYS.fight, { me, them, at: Date.now(), state: snapshot(state) } satisfies SavedFight);
}
/** the fight to carry on, or null (a broken or finished one is thrown away) */
export function loadFight(): { me: string; them: string; at: number; state: FightState } | null {
  const raw = read<SavedFight>(KEYS.fight);
  if (!raw || typeof raw !== "object" || typeof raw.state !== "string" || typeof raw.me !== "string" || typeof raw.them !== "string") return null;
  const state = restore(raw.state);
  if (!state || state.phase === "over") {
    clearFight();
    return null;
  }
  return { me: raw.me, them: raw.them, at: typeof raw.at === "number" ? raw.at : 0, state };
}
export function clearFight() {
  try {
    st()?.removeItem(KEYS.fight);
  } catch {
    /* nothing to clear */
  }
  return true;
}

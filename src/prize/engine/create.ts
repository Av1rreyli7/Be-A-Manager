/**
 * Created fighters: what the creator saves, how it becomes a boxer the engine can fight with, and the clean up
 * that makes any saved or typed input safe (long names, odd characters, attributes over the budget, missing
 * fields from an older save).
 */
import { ATTR_BUDGET, ATTR_KEYS, ATTR_MAX, ATTR_MIN } from "./rules";
import { weightClass } from "./roster";
import type { Attrs, FighterDef, Guard, Look, Stance, Style } from "./types";

export type BodyType = "lean" | "athletic" | "muscular" | "heavy";
export const BODY_TYPES: { id: BodyType; name: string; note: string }[] = [
  { id: "lean", name: "Lean", note: "Long and light, quick on the feet" },
  { id: "athletic", name: "Athletic", note: "Balanced build" },
  { id: "muscular", name: "Muscular", note: "Thick through the chest and shoulders" },
  { id: "heavy", name: "Heavy", note: "Big frame, carries weight" },
];

export const HAIR_STYLES = ["Buzz cut", "Short crop", "Curly top", "Afro", "Long with a bun", "Mohawk", "Bald", "Long and loose", "Side part", "Skin fade", "Cornrows", "Dreadlocks", "Quiff", "Undercut bun", "Twists", "Mullet"];
export const HAIR_COLOURS = ["#151110", "#2a1d15", "#4a3222", "#6e4a2c", "#a87a46", "#d2b07a", "#8b8b8b", "#e9e1c8", "#a4512c", "#5a1f1a", "#c9cbd3", "#2f4fa8", "#d9d9d9"];
export const BEARDS = ["Clean", "Full beard", "Beard and tache", "Stubble", "Goatee", "Chin strap"];
export const KIT_COLOURS = ["#f4f4f4", "#111111", "#c8102e", "#b31b1b", "#ff4630", "#ff8a1f", "#f2c200", "#d4af37", "#2e7d32", "#0f7a3d", "#00a3dd", "#1b3fa0", "#1f2a44", "#4b2a8c", "#c2185b", "#8c5a2b", "#7a1d1d", "#9aa3ad"];
export const COUNTRIES = [
  "United States", "Mexico", "United Kingdom", "Ireland", "Philippines", "Japan", "Ukraine", "Kazakhstan", "Cuba", "Puerto Rico", "Panama",
  "Argentina", "Brazil", "Canada", "Australia", "New Zealand", "Nigeria", "Ghana", "South Africa", "Cameroon", "France", "Germany", "Italy",
  "Spain", "Russia", "Poland", "Uzbekistan", "India", "Pakistan", "China", "South Korea", "Thailand", "Venezuela", "Colombia", "Dominican Republic",
  "Jamaica", "Sweden", "Netherlands", "Turkey", "Egypt", "Morocco", "Somewhere else",
];
export const NAME_MAX = 24;
export const NICK_MAX = 18;

export interface Created {
  id: string;
  name: string;
  nick: string;
  country: string;
  stance: Stance;
  body: BodyType;
  heightCm: number;
  skin: number;
  hair: number;
  hairCol: number;
  beard: number;
  moustache: 0 | 1;
  gloves: string;
  gloveTrim: string;
  trunks: [string, string, string];
  boots: string;
  attrs: Attrs;
  made: number;
}

export function defaultCreated(): Created {
  return {
    id: "",
    name: "",
    nick: "",
    country: "United States",
    stance: "orthodox",
    body: "athletic",
    heightCm: 180,
    skin: 0.45,
    hair: 1,
    hairCol: 0,
    beard: 0,
    moustache: 0,
    gloves: "#c8102e",
    gloveTrim: "#f4f4f4",
    trunks: ["#111111", "#ff4630", "#ff4630"],
    boots: "#111111",
    attrs: { power: 72, speed: 72, chin: 72, stamina: 72, defense: 72 },
    made: 0,
  };
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const colour = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v) ? v.toLowerCase() : d);
const int = (v: unknown, lo: number, hi: number, d: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : d;
};
const num = (v: unknown, lo: number, hi: number, d: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};

/** a typed name made safe to show: no control characters, no long dashes, spaces tidied, cut to the limit */
export function cleanName(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  const s = v.replace(INVISIBLE, "").replace(LONG_DASH, "-").replace(/\s+/g, " ").trim();
  return Array.from(s).slice(0, max).join("").trim();
}
/** the same cleaning while someone types: no trimming, so a space can still go between two words */
export function cleanTyping(v: string, max: number): string {
  return Array.from(v.replace(INVISIBLE, "").replace(LONG_DASH, "-")).slice(0, max).join("");
}
// control characters, zero width and direction marks; and every long dash or minus sign (written as escapes on purpose)
const INVISIBLE = new RegExp("[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u206f\\ufeff]", "g");
const LONG_DASH = new RegExp("[\\u2010-\\u2015\\u2212]", "g");

/** attributes inside their range and the budget: anything over is taken back from the highest first */
export function fitAttrs(a: Partial<Attrs> | undefined): Attrs {
  const out = {} as Attrs;
  for (const k of ATTR_KEYS) out[k] = int(a?.[k], ATTR_MIN, ATTR_MAX, ATTR_MIN);
  let over = ATTR_KEYS.reduce((s, k) => s + out[k], 0) - ATTR_BUDGET;
  while (over > 0) {
    let top: (typeof ATTR_KEYS)[number] = ATTR_KEYS[0];
    for (const k of ATTR_KEYS) if (out[k] > out[top]) top = k;
    if (out[top] <= ATTR_MIN) break;
    out[top]--;
    over--;
  }
  return out;
}

export function attrsUsed(a: Attrs): number {
  return ATTR_KEYS.reduce((s, k) => s + a[k], 0);
}

/** any stored or typed fighter turned into a valid one (missing fields take the defaults) */
export function sanitize(raw: unknown): Created {
  const d = defaultCreated();
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Created>;
  const trunks = Array.isArray(r.trunks) ? r.trunks : [];
  return {
    id: typeof r.id === "string" && /^[a-z0-9_-]{1,40}$/i.test(r.id) ? r.id : "",
    name: cleanName(r.name, NAME_MAX) || "Unnamed Fighter",
    nick: cleanName(r.nick, NICK_MAX),
    country: typeof r.country === "string" && COUNTRIES.includes(r.country) ? r.country : d.country,
    stance: r.stance === "southpaw" ? "southpaw" : "orthodox",
    body: BODY_TYPES.some(b => b.id === r.body) ? (r.body as BodyType) : d.body,
    heightCm: int(r.heightCm, 160, 206, d.heightCm),
    skin: num(r.skin, 0, 1, d.skin),
    hair: int(r.hair, 0, HAIR_STYLES.length - 1, d.hair),
    hairCol: int(r.hairCol, 0, HAIR_COLOURS.length - 1, d.hairCol),
    beard: int(r.beard, 0, BEARDS.length - 1, d.beard),
    moustache: r.moustache === 1 ? 1 : 0,
    gloves: colour(r.gloves, d.gloves),
    gloveTrim: colour(r.gloveTrim, d.gloveTrim),
    trunks: [colour(trunks[0], d.trunks[0]), colour(trunks[1], d.trunks[1]), colour(trunks[2], d.trunks[2])],
    boots: colour(r.boots, d.boots),
    attrs: fitAttrs(r.attrs),
    made: num(r.made, 0, 1e15, 0),
  };
}

const BMI: Record<BodyType, number> = { lean: 21.5, athletic: 24, muscular: 26.5, heavy: 30 };

/** how the computer fights with a created boxer: from where the points went */
export function styleOf(a: Attrs): { style: Style; guard: Guard } {
  const top = Math.max(a.power, a.speed, a.defense);
  if (a.defense === top && a.defense >= a.power + 4) return { style: "counter", guard: a.speed >= 80 ? "philly" : "normal" };
  if (a.speed === top && a.speed > a.power) return { style: "outboxer", guard: "normal" };
  if (a.power === top && a.chin >= 70) return { style: "pressure", guard: "high" };
  return { style: "body", guard: "normal" };
}

/** a created fighter as a boxer the engine fights with */
export function toDef(c: Created): FighterDef {
  const h = c.heightCm / 100;
  const kg = Math.round(BMI[c.body] * h * h);
  const reachIn = Math.round((c.heightCm / 2.54) * (c.body === "lean" ? 1.04 : 1.02) * 2) / 2;
  const { style, guard } = styleOf(c.attrs);
  const look: Look = {
    skin: c.skin,
    hair: c.hair,
    hairCol: c.hairCol,
    beard: c.beard,
    moustache: c.moustache,
    trunks: c.trunks,
    gloves: c.gloves,
    gloveTrim: c.gloveTrim,
    boots: c.boots,
    muscle: c.body === "muscular" ? 0.9 : c.body === "lean" ? 0.35 : c.body === "heavy" ? 0.5 : 0.6,
    shoulders: c.body === "muscular" ? 0.85 : c.body === "lean" ? 0.45 : 0.6,
    belly: c.body === "heavy" ? 0.7 : 0,
  };
  return {
    id: "c:" + (c.id || "new"),
    name: c.name || "Unnamed Fighter",
    nick: c.nick,
    country: c.country,
    real: false,
    era: "Created fighter",
    stance: c.stance,
    style,
    guard,
    attrs: { ...c.attrs },
    heightCm: c.heightCm,
    reachIn,
    weightKg: kg,
    weightClass: weightClass(kg),
    traits: [],
    look,
    blurb: "Your own fighter, built your way.",
  };
}

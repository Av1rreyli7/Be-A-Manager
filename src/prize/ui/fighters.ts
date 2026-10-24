/**
 * Every boxer the person can pick: the real ones and the ones they built. A fighter is referred to by a short id:
 * a roster id ("ali") or "c:" and a created fighter's id. Records are kept under the same id.
 */
import { ROSTER, rosterById } from "../engine/roster";
import { toDef, type Created } from "../engine/create";
import type { FighterDef } from "../engine/types";
import { listFighters } from "../save";

export function createdRef(c: Created) {
  return "c:" + c.id;
}

/** the boxer for an id, or null when it no longer exists (a deleted created fighter) */
export function resolve(ref: string, created: Created[] = listFighters()): FighterDef | null {
  if (ref.startsWith("c:")) {
    const c = created.find(x => x.id === ref.slice(2));
    return c ? { ...toDef(c), id: ref } : null;
  }
  return rosterById(ref) ?? null;
}

export function allFighters(created: Created[] = listFighters()): FighterDef[] {
  return [...created.map(c => ({ ...toDef(c), id: createdRef(c) })), ...ROSTER];
}

export const STYLE_NAME = { pressure: "Pressure fighter", counter: "Counter puncher", outboxer: "Outboxer", body: "Body puncher" } as const;
export const GUARD_NAME = { high: "High guard", philly: "Philly shell", normal: "Normal block" } as const;

export function inches(cm: number) {
  const inch = Math.round(cm / 2.54);
  return `${Math.floor(inch / 12)} ft ${inch % 12} in`;
}

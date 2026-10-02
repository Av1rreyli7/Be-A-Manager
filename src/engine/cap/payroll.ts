/**
 * Team salary, cap holds, apron status and luxury tax. All thresholds come from `league.cba`
 * (or the projected CBA for future seasons).
 */
import type { Cba } from "../config/cba";
import { projectCba } from "../config/cba";
import type { Contract, League, Phase, Team, TeamId } from "../types/game";
import { nextSeason, seasonStartYear } from "../util/dates";

export interface CapItem {
  label: string;
  playerId: string | null;
  amount: number;
  kind: "contract" | "dead" | "hold" | "rookie-hold" | "roster-charge" | "two-way" | "camp";
  option?: string | null;
  guaranteed?: number;
}

const projectedMemo = new Map<string, Cba>();

/** CBA for any season: stored, current, or projected forward from the latest known. */
export function cbaFor(l: League, season: string): Cba {
  if (l.cbaBySeason[season]) return l.cbaBySeason[season];
  const mk = `${l.id}|${l.season}|${season}|${l.cba.salaryCap.value}|${l.cba.capGrowthProjection.value}`;
  const hit = projectedMemo.get(mk);
  if (hit) return hit;
  const out = projectForward(l, season);
  if (projectedMemo.size > 500) projectedMemo.clear();
  projectedMemo.set(mk, out);
  return out;
}

function projectForward(l: League, season: string): Cba {
  let s = l.season;
  let c = l.cba;
  const growth = l.cba.capGrowthProjection.value;
  while (seasonStartYear(s) < seasonStartYear(season)) {
    s = nextSeason(s);
    c = l.cbaBySeason[s] ?? projectCba(c, growth, s);
  }
  return c;
}

/** The league year rolls over (l.season increments) when free agency opens on July 1. */
const OFFSEASON_HOLD_PHASES: Phase[] = ["free-agency", "summer-league"];

/** Cap holds apply from July 1 until the player signs or is renounced. */
export function holdsApply(l: League): boolean {
  return OFFSEASON_HOLD_PHASES.includes(l.phase);
}

/** The current league year for cap purposes. */
export function capSeason(l: League): string {
  return l.season;
}

export function capItems(l: League, teamId: TeamId, season = capSeason(l), includeHolds = holdsApply(l)): CapItem[] {
  const items: CapItem[] = [];
  for (const id in l.contracts) {
    const c = l.contracts[id];
    if (c.teamId !== teamId) continue;
    const y = c.years.find((x) => x.season === season);
    if (!y) continue;
    const p = c.playerId ? l.players[c.playerId] : null;
    if (!c.deadMoney && p && (p.teamId !== teamId || p.status !== "active")) continue;
    const kind: CapItem["kind"] = c.deadMoney ? "dead" : c.type === "two-way" ? "two-way" : c.type === "exhibit-10" ? "camp" : "contract";
    items.push({ label: c.playerName, playerId: c.playerId, amount: y.salary, kind, option: y.option, guaranteed: y.guaranteed });
  }
  if (includeHolds) {
    const t = l.teams[teamId];
    for (const r of t.rights) {
      if (r.renounced) continue;
      const p = l.players[r.playerId];
      if (!p || p.status !== "fa") continue;
      items.push({ label: `${p.name} (cap hold)`, playerId: p.id, amount: r.capHold, kind: "hold" });
    }
    for (const d of t.draftRights) {
      const p = l.players[d.playerId];
      if (!p || p.contractId) continue;
      const pick = p.draft?.pick ?? 60;
      if (pick <= 30) {
        const cba = cbaFor(l, season);
        items.push({ label: `${p.name} (rookie scale hold)`, playerId: p.id, amount: cba.rookieScale.pct100[pick - 1][0], kind: "rookie-hold" });
      }
    }
    // incomplete roster charge: each open slot below 12 counts as a rookie minimum
    const counted = items.filter((i) => i.kind === "contract" || i.kind === "hold" || i.kind === "rookie-hold" || i.kind === "camp").length;
    const cba = cbaFor(l, season);
    for (let i = counted; i < 12; i++) items.push({ label: "Incomplete roster charge", playerId: null, amount: cba.minimumSalary.byService[0], kind: "roster-charge" });
  }
  return items;
}

/**
 * Memo for team salary. Keyed on the league's mutation counter (nextId - bumped by every signing,
 * trade, waiver, news item) plus contract count, so it can't serve stale values after a transaction.
 */
const salaryMemos = new WeakMap<object, { n: number; map: Map<string, number> }>();
function memoFor(l: League) {
  let m = salaryMemos.get(l.contracts);
  if (!m || m.n !== l.nextId) {
    m = { n: l.nextId, map: new Map() };
    salaryMemos.set(l.contracts, m);
  }
  return m.map;
}

/** Team salary for cap purposes (two-way contracts excluded). */
export function teamSalary(l: League, teamId: TeamId, season = capSeason(l), includeHolds = holdsApply(l)): number {
  const memo = memoFor(l);
  const key = `${l.phase}|${teamId}|${season}|${includeHolds}`;
  const hit = memo.get(key);
  if (hit != null) return hit;
  let s = 0;
  for (const i of capItems(l, teamId, season, includeHolds)) if (i.kind !== "two-way") s += i.amount;
  memo.set(key, s);
  return s;
}

/** Salary for tax/apron purposes excludes cap holds and roster charges. */
export function taxSalary(l: League, teamId: TeamId, season = capSeason(l)): number {
  return teamSalary(l, teamId, season, false);
}

export function isRepeater(t: Team, season: string): boolean {
  const y = seasonStartYear(season);
  const prev = [1, 2, 3, 4].map((k) => `${y - k}-${String((y - k + 1) % 100).padStart(2, "0")}`);
  return t.taxHistory.filter((h) => prev.includes(h.season) && h.paid > 0).length >= 3;
}

export function taxBill(salary: number, cba: Cba, repeater: boolean): number {
  const over = salary - cba.luxuryTax.value;
  if (over <= 0) return 0;
  const rates = repeater ? cba.tax.repeaterRates : cba.tax.standardRates;
  const size = cba.tax.bracketSize;
  let bill = 0;
  let remaining = over;
  let i = 0;
  while (remaining > 0) {
    const rate = i < rates.length ? rates[i] : rates[rates.length - 1] + cba.tax.incrementPerBracket * (i - rates.length + 1);
    const chunk = Math.min(size, remaining);
    bill += chunk * rate;
    remaining -= chunk;
    i++;
  }
  return Math.round(bill);
}

export type ApronStatus = "under-cap" | "over-cap" | "over-tax" | "over-first" | "over-second";

export interface CapStatus {
  season: string;
  salary: number; // cap salary (incl holds when applicable)
  taxSalary: number;
  cap: number;
  tax: number;
  firstApron: number;
  secondApron: number;
  room: number;
  status: ApronStatus;
  taxBill: number;
  repeater: boolean;
  hardCap: Team["hardCap"];
  hardCapRoom: number | null;
  minimumTeamSalary: number;
}

export function statusFor(salary: number, cba: Cba): ApronStatus {
  if (salary > cba.secondApron.value) return "over-second";
  if (salary > cba.firstApron.value) return "over-first";
  if (salary > cba.luxuryTax.value) return "over-tax";
  if (salary > cba.salaryCap.value) return "over-cap";
  return "under-cap";
}

export function capStatus(l: League, teamId: TeamId, season = capSeason(l)): CapStatus {
  const cba = cbaFor(l, season);
  const t = l.teams[teamId];
  const salary = teamSalary(l, teamId, season);
  const tSal = taxSalary(l, teamId, season);
  const repeater = isRepeater(t, season);
  const hardLimit = t.hardCap === "first" ? cba.firstApron.value : t.hardCap === "second" ? cba.secondApron.value : null;
  return {
    season,
    salary,
    taxSalary: tSal,
    cap: cba.salaryCap.value,
    tax: cba.luxuryTax.value,
    firstApron: cba.firstApron.value,
    secondApron: cba.secondApron.value,
    room: Math.max(0, cba.salaryCap.value - salary),
    status: statusFor(Math.max(salary, tSal), cba),
    taxBill: taxBill(tSal, cba, repeater),
    repeater,
    hardCap: season === l.season ? t.hardCap : null,
    hardCapRoom: hardLimit != null && season === l.season ? hardLimit - tSal : null,
    minimumTeamSalary: cba.minimumTeamSalary.value,
  };
}

export function contractCapHit(c: Contract, season: string): number {
  return c.years.find((y) => y.season === season)?.salary ?? 0;
}

/** Multi-season projection for the cap sheet. */
export function projection(l: League, teamId: TeamId, seasons = 5) {
  const out: { season: string; salary: number; committed: number; cap: number; tax: number; firstApron: number; secondApron: number; status: ApronStatus; taxBill: number }[] = [];
  let s = capSeason(l);
  for (let i = 0; i < seasons; i++) {
    const cba = cbaFor(l, s);
    const committed = teamSalary(l, teamId, s, false);
    const t = l.teams[teamId];
    out.push({
      season: s,
      salary: committed,
      committed,
      cap: cba.salaryCap.value,
      tax: cba.luxuryTax.value,
      firstApron: cba.firstApron.value,
      secondApron: cba.secondApron.value,
      status: statusFor(committed, cba),
      taxBill: taxBill(committed, cba, isRepeater(t, s)),
    });
    s = nextSeason(s);
  }
  return out;
}

/**
 * Trade valuation.
 *
 * PLAYER VALUE (points, ~0-140) seen by team T:
 *   talent = max(0, effOvr − 55)^2.3 / 45, effOvr = OVR + (POT − OVR) × youthWeight(age) × strategyFactor
 *   × control factor (good players on multi-year deals are worth more: +12% per extra year, max 4)
 *   + contract surplus: Σ (market salary − salary) over remaining years / $2.5M, discounted 10%/yr
 *   × strategy age curve (rebuilders discount players 29+, contenders discount prospects)
 *   − tax cost if T is a taxpayer (for incoming salary)
 * PICK VALUE: projected slot from the original team's strength (regressed toward the middle for later
 *   drafts) → slot value curve (#1 ≈ 56, #10 ≈ 19, #30 ≈ 6; 2nd-rounders ≈ 0.4-2.4), × P(conveys) for
 *   protected picks, × 0.92^yearsOut, × draft-class strength, × strategy (rebuild 1.35 / contend 0.75).
 */
import type { Cba } from "../config/cba";
import type { League, PickAsset, Player, TeamId } from "../types/game";
import { contractOf, projectedWinPct, seasonAge } from "../league/helpers";
import { cbaFor, capStatus } from "../cap/payroll";
import { seasonStartYear } from "../util/dates";
import { clamp } from "../util/rng";

export function youthWeight(age: number): number {
  if (age <= 19) return 0.65;
  if (age >= 27) return 0;
  return 0.65 - (age - 19) * 0.08;
}

/** First-year market salary for a player of this quality (used by FA demands and contract surplus). */
export function marketSalary(ovr: number, age: number, pot: number, cba: Cba, yos = 5): number {
  const eff = ovr + (pot - ovr) * youthWeight(age) * 0.55 - Math.max(0, age - 31) * 1.6;
  const pct = 0.008 + 0.342 * Math.pow(clamp((eff - 55) / 40, 0, 1.05), 2.4);
  const band = cba.maxSalary.byService.find((b) => yos >= b.minYears && yos <= b.maxYears) ?? cba.maxSalary.byService[0];
  const minS = cba.minimumSalary.byService[Math.min(yos, cba.minimumSalary.byService.length - 1)];
  return Math.round(clamp(cba.salaryCap.value * pct, minS, band.value));
}

/** Expected OVR in a future season (simple aging curve used for valuation). */
export function projectOvr(ovr: number, pot: number, age: number, yearsAhead: number): number {
  let o = ovr;
  let a = age;
  for (let i = 0; i < yearsAhead; i++) {
    if (a <= 26) o += Math.max(0, (pot - o) * 0.35);
    else if (a >= 30) o -= (a - 29) * 0.9;
    a++;
  }
  return Math.min(99, o);
}

export function talentValue(effOvr: number): number {
  // replacement level ≈ 55 OVR on the current rating scale
  return Math.pow(Math.max(0, effOvr - 55), 2.3) / 45;
}

export type Strategy = "contending" | "retooling" | "rebuilding";

export function strategyOf(l: League, t: TeamId): Strategy {
  return l.teams[t]?.strategy.mode ?? "retooling";
}

export function playerValue(l: League, p: Player, perspective: TeamId | null, opts: { incoming?: boolean } = {}): number {
  const strat: Strategy = perspective ? strategyOf(l, perspective) : "retooling";
  const age = seasonAge(p, l.season);
  const c = contractOf(l, p);
  const cba = cbaFor(l, l.season);
  const potW = youthWeight(age) * (strat === "rebuilding" ? 1.3 : strat === "contending" ? 0.55 : 1);
  const eff = p.ovr + Math.max(0, p.pot - p.ovr) * potW;
  let v = talentValue(eff);

  // contract: years of control and surplus value
  const years = (c?.years ?? []).filter((y) => seasonStartYear(y.season) >= seasonStartYear(l.season));
  let surplus = 0;
  years.forEach((y, i) => {
    const proj = projectOvr(p.ovr, p.pot, age, i);
    const market = marketSalary(proj, age + i, p.pot, cbaFor(l, y.season), p.experience + i);
    const optionAdj = y.option === "player" ? (market < y.salary ? 1 : 0.5) : y.option === "team" ? (market > y.salary ? 1 : 0) : 1;
    surplus += ((market - y.salary) * optionAdj * Math.pow(0.9, i)) / 2_500_000;
  });
  const control = Math.min(4, years.length);
  if (v > 10 && control > 1) v *= 1 + 0.12 * (control - 1);
  v += clamp(surplus, -45, 60);

  if (c?.type === "two-way" || c?.type === "exhibit-10") v = Math.max(0.2, talentValue(eff) * 0.6);

  // strategy age curve
  if (strat === "rebuilding" && age >= 29) v *= Math.max(0.35, 1 - (age - 28) * 0.12);
  if (strat === "contending" && p.ovr < 70 && age <= 22) v *= 0.8;
  if (strat === "contending" && p.ovr >= 80) v *= 1.12;

  // injuries
  if (p.injury) {
    const d = p.injury.daysOut;
    if (d > 150) v *= strat === "contending" ? 0.5 : 0.75;
    else if (d > 40) v *= 0.88;
  }
  // (tax cost is applied on the *net* salary a team adds in evaluateFor, not per incoming player)
  void opts;
  return Math.round(v * 10) / 10;
}

/** Expected draft slot (1 = best) for a pick of the original team in a given draft year. */
export function projectedSlot(l: League, k: PickAsset): number {
  if (k.resolvedPick) return k.round === 1 ? k.resolvedPick : k.resolvedPick;
  const nextDraft = seasonStartYear(l.season) + 1;
  const yearsOut = Math.max(0, k.year - nextDraft);
  const wp = blendedWinPct(l, k.originalTeam);
  // win% .20 -> slot ~2, .80 -> slot ~29
  let slot = clamp(1 + (wp - 0.18) / 0.64 * 29, 1, 30);
  slot = 15.5 + (slot - 15.5) * Math.pow(0.6, yearsOut);
  return k.round === 2 ? slot + 30 : slot;
}

function blendedWinPct(l: League, t: TeamId): number {
  const rec = l.standings[t];
  const gp = rec ? rec.w + rec.l : 0;
  const proj = projectedWinPct(l, t);
  if (!gp) return proj;
  const real = rec!.w / gp;
  const w = Math.min(1, gp / 60);
  return real * w + proj * (1 - w);
}

export function slotValue(slot: number): number {
  if (slot <= 30) return 50 * Math.exp(-(slot - 1) / 7) + 6;
  return 2 * Math.exp(-(slot - 31) / 15) + 0.4;
}

function normCdf(x: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

/** Probability a protected pick conveys (lands outside the protected range). */
export function conveyProbability(l: League, k: PickAsset): number {
  if (k.protection.kind === "none") return 1;
  const keep = k.protection.keepTop;
  if (!keep) return k.protection.kind === "complex" ? 0.6 : 1;
  const slot = projectedSlot(l, k);
  const nextDraft = seasonStartYear(l.season) + 1;
  const sd = 4 + 2.5 * Math.max(0, k.year - nextDraft);
  return clamp(1 - normCdf((keep + 0.5 - slot) / sd), 0, 1);
}

export function pickValue(l: League, k: PickAsset, perspective: TeamId | null): number {
  if (k.forfeited) return 0;
  const strat: Strategy = perspective ? strategyOf(l, perspective) : "retooling";
  const slot = projectedSlot(l, k);
  let v = slotValue(slot);
  const pConvey = conveyProbability(l, k);
  if (k.protection.kind !== "none" && k.owner !== k.originalTeam) {
    // the holder only gets it when it conveys (and then it's a worse pick)
    v = slotValue(Math.max(slot, (k.protection.keepTop ?? 0) + 1)) * pConvey;
  }
  if (k.swap || k.conditional) v *= 0.55;
  const nextDraft = seasonStartYear(l.season) + 1;
  v *= Math.pow(0.92, Math.max(0, k.year - nextDraft));
  if (l.draft && l.draft.year === k.year) v *= l.draft.classStrength;
  v *= strat === "rebuilding" ? 1.35 : strat === "contending" ? 0.75 : 1;
  return Math.round(v * 10) / 10;
}

/** Positional need: 1.0 normal, up to 1.25 when the team is thin at the player's position. */
export function positionalNeed(l: League, teamId: TeamId, p: Player): number {
  const ps = Object.values(l.players).filter((x) => x.teamId === teamId && x.status === "active" && x.ovr >= 65);
  const group = (pos: string) => (pos === "PG" || pos === "SG" ? "G" : pos === "SF" ? "W" : "B");
  const same = ps.filter((x) => group(x.pos) === group(p.pos)).length;
  return same <= 1 ? 1.25 : same === 2 ? 1.1 : same >= 5 ? 0.9 : 1;
}

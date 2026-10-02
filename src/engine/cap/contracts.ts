/**
 * Contract rules: max/min salaries, raises, signing methods (cap room, Bird, MLEs, BAE, minimum),
 * cap holds, rookie scale, extension & designated-player eligibility.
 */
import type { Cba } from "../config/cba";
import type { Contract, League, Player, Team, TeamId } from "../types/game";
import { contractOf, standardPlayers, twoWayPlayers } from "../league/helpers";
import { nextSeason, seasonStartYear } from "../util/dates";
import { capStatus, cbaFor, teamSalary, taxSalary } from "./payroll";

export type BirdLevel = "bird" | "early-bird" | "non-bird" | null;

export function maxSalary(cba: Cba, yearsOfService: number, designated = false): number {
  if (designated) return Math.round(cba.salaryCap.value * cba.maxSalary.designatedVeteranPct);
  const b = cba.maxSalary.byService.find((x) => yearsOfService >= x.minYears && yearsOfService <= x.maxYears) ?? cba.maxSalary.byService[0];
  return b.value;
}

export function minSalary(cba: Cba, yearsOfService: number): number {
  const t = cba.minimumSalary.byService;
  return t[Math.min(Math.max(0, yearsOfService), t.length - 1)];
}

/** Bird level a team holds on a player (from explicit rights in FA, else from tenure). */
export function birdLevel(l: League, team: TeamId, p: Player): BirdLevel {
  const r = l.teams[team].rights.find((x) => x.playerId === p.id && !x.renounced);
  if (r) return r.type;
  if (p.teamId !== team) return null;
  const n = p.seasonsWithTeam + (l.phase === "free-agency" || l.phase === "summer-league" ? 0 : 1);
  return n >= 3 ? "bird" : n === 2 ? "early-bird" : "non-bird";
}

/** Cap hold for a free agent from the previous salary (capped at the player's max). */
export function capHoldFor(cba: Cba, p: Player, prevSalary: number, level: BirdLevel, wasRookieScale: boolean): number {
  const avg = cba.averageSalaryEstimate.value;
  const h = cba.capHolds;
  let pct = h.nonBird;
  if (wasRookieScale) pct = prevSalary < avg ? h.rookieScaleBelowAvg : h.rookieScaleAboveAvg;
  else if (level === "bird") pct = prevSalary < avg ? h.birdBelowAvg : h.birdAboveAvg;
  else if (level === "early-bird") pct = h.earlyBird;
  const hold = Math.round(prevSalary * pct);
  return Math.max(minSalary(cba, p.experience), Math.min(hold, maxSalary(cba, p.experience)));
}

export function buildYears(first: number, years: number, raisePct: number, startSeason: string, option: "player" | "team" | null, guaranteed = true): Contract["years"] {
  const out: Contract["years"] = [];
  let s = startSeason;
  for (let i = 0; i < years; i++) {
    const salary = Math.round(first * (1 + raisePct * i));
    out.push({ season: s, salary, guaranteed: guaranteed ? salary : 0, option: option && i === years - 1 && years > 1 ? option : null });
    s = nextSeason(s);
  }
  return out;
}

export interface SigningMethod {
  id: NonNullable<Contract["signedWith"]>;
  label: string;
  maxFirstYear: number;
  maxYears: number;
  maxRaise: number;
  /** hard cap this method triggers */
  hardCap: Team["hardCap"];
  available: boolean;
  reason?: string;
}

/** Every way `team` could sign `p` right now, with limits. */
export function signingMethods(l: League, teamId: TeamId, p: Player): SigningMethod[] {
  const season = l.season;
  const cba = cbaFor(l, season);
  const t = l.teams[teamId];
  const st = capStatus(l, teamId, season);
  const maxS = maxSalary(cba, p.experience);
  const minS = minSalary(cba, p.experience);
  const bird = birdLevel(l, teamId, p);
  const tSal = taxSalary(l, teamId, season);
  const out: SigningMethod[] = [];
  // salary cap switched off: any team can pay anyone up to the max
  if (!l.settings.salaryCap) return [{ id: "room", label: "No salary cap", maxFirstYear: maxS, maxYears: 5, maxRaise: cba.raises.birdPct, hardCap: null, available: true }];
  const hard = t.hardCap === "first" ? cba.firstApron.value : t.hardCap === "second" ? cba.secondApron.value : Infinity;
  const hardRoom = hard - tSal;

  // Cap room (holds included in team salary during the offseason)
  const room = cba.salaryCap.value - teamSalary(l, teamId, season);
  out.push({ id: "room", label: "Cap space", maxFirstYear: Math.min(maxS, Math.max(0, room)), maxYears: cba.maxContractYears.other, maxRaise: cba.raises.nonBirdPct, hardCap: null, available: room >= minS, reason: room >= minS ? undefined : "No cap room" });

  // Bird rights (exceeding the cap)
  if (bird && p.status === "fa") {
    const prev = p.lastSeasonSalary ?? 0;
    if (bird === "bird") out.push({ id: "bird", label: "Bird rights", maxFirstYear: Math.min(maxS, hardRoom), maxYears: cba.maxContractYears.bird, maxRaise: cba.raises.birdPct, hardCap: null, available: hardRoom >= minS });
    if (bird === "early-bird") {
      const lim = Math.min(maxS, Math.max(Math.round(prev * 1.75), cba.exceptions.earlyBirdMaxStart.value));
      out.push({ id: "early-bird", label: "Early Bird rights", maxFirstYear: Math.min(lim, hardRoom), maxYears: cba.maxContractYears.other, maxRaise: cba.raises.birdPct, hardCap: null, available: hardRoom >= minS, reason: "min 2 years" });
    }
    if (bird === "non-bird") {
      const lim = Math.min(maxS, Math.max(Math.round(prev * 1.2), Math.round(minS * 1.2)));
      out.push({ id: "non-bird", label: "Non-Bird rights", maxFirstYear: Math.min(lim, hardRoom), maxYears: cba.maxContractYears.other, maxRaise: cba.raises.nonBirdPct, hardCap: null, available: hardRoom >= minS });
    }
  }

  // Mid-level exceptions
  const ex = t.exceptions;
  const under = st.status === "under-cap";
  const ntLeft = cba.exceptions.nonTaxpayerMLE.value - (ex.mleType === "nt" || ex.mleType === null ? ex.mleUsed : Infinity);
  const tpLeft = cba.exceptions.taxpayerMLE.value - (ex.mleType === "tp" || ex.mleType === null ? ex.mleUsed : Infinity);
  const roomLeft = cba.exceptions.roomMLE.value - (ex.mleType === "room" || ex.mleType === null ? ex.mleUsed : Infinity);
  const firstApronRoom = cba.firstApron.value - tSal;
  const secondApronRoom = cba.secondApron.value - tSal;
  if (!under) {
    const ntAvail = ntLeft >= minS && t.hardCap !== "second" && firstApronRoom >= minS;
    out.push({
      id: "nt-mle",
      label: "Non-taxpayer MLE",
      maxFirstYear: Math.max(0, Math.min(ntLeft, maxS, firstApronRoom, hardRoom)),
      maxYears: cba.exceptions.nonTaxpayerMLE.maxYears,
      maxRaise: cba.exceptions.nonTaxpayerMLE.raisePct,
      hardCap: "first",
      available: ntAvail,
      reason: ntAvail ? undefined : t.hardCap === "second" ? "Hard-capped at 2nd apron" : firstApronRoom < minS ? "Signing would exceed the 1st apron (hard cap)" : "MLE used",
    });
    const tpAvail = tpLeft >= minS && secondApronRoom >= minS;
    out.push({
      id: "tp-mle",
      label: "Taxpayer MLE",
      maxFirstYear: Math.max(0, Math.min(tpLeft, maxS, secondApronRoom, hardRoom)),
      maxYears: cba.exceptions.taxpayerMLE.maxYears,
      maxRaise: cba.exceptions.taxpayerMLE.raisePct,
      hardCap: "second",
      available: tpAvail,
      reason: tpAvail ? undefined : secondApronRoom < minS ? "Over the 2nd apron" : "MLE used",
    });
  } else {
    out.push({ id: "room-mle", label: "Room MLE", maxFirstYear: Math.max(0, Math.min(roomLeft, maxS)), maxYears: cba.exceptions.roomMLE.maxYears, maxRaise: cba.exceptions.roomMLE.raisePct, hardCap: null, available: roomLeft >= minS && ex.roomUsed === 0 });
  }
  // Bi-annual
  const baeUsedRecently = ex.baeLastUsedSeason != null && seasonStartYear(ex.baeLastUsedSeason) >= seasonStartYear(season) - 1 && ex.baeLastUsedSeason !== season;
  const baeLeft = cba.exceptions.biAnnual.value - (ex.baeLastUsedSeason === season ? ex.baeUsed : 0);
  const baeAvail = !under && !baeUsedRecently && baeLeft >= minS && firstApronRoom >= minS && t.hardCap !== "second";
  out.push({ id: "bae", label: "Bi-annual exception", maxFirstYear: Math.max(0, Math.min(baeLeft, firstApronRoom, hardRoom)), maxYears: cba.exceptions.biAnnual.maxYears, maxRaise: cba.exceptions.biAnnual.raisePct, hardCap: "first", available: baeAvail, reason: baeAvail ? undefined : under ? "Team is under the cap" : baeUsedRecently ? "Used last season" : "Unavailable" });
  // Minimum
  out.push({ id: "minimum", label: "Minimum exception", maxFirstYear: minS, maxYears: 2, maxRaise: cba.raises.nonBirdPct, hardCap: null, available: hardRoom >= minS || t.hardCap == null });
  return out;
}

export interface OfferTerms {
  salary: number;
  years: number;
  raisePct: number;
  option: "player" | "team" | null;
  method: NonNullable<Contract["signedWith"]>;
}

export function validateOffer(l: League, teamId: TeamId, p: Player, o: OfferTerms, opts: { ignoreRoster?: boolean } = {}): string[] {
  const errors: string[] = [];
  if (!l.settings.salaryCap) return errors;
  const cba = cbaFor(l, l.season);
  const minS = minSalary(cba, p.experience);
  const maxS = maxSalary(cba, p.experience, isSupermaxEligible(l, p, teamId));
  if (o.salary < minS) errors.push(`Salary below the minimum for ${p.experience} years of service ($${fmtM(minS)})`);
  if (o.salary > maxS) errors.push(`Salary exceeds the max for ${p.experience} years of service ($${fmtM(maxS)})`);
  const m = signingMethods(l, teamId, p).find((x) => x.id === o.method);
  if (!m) errors.push("That signing method isn't available");
  else {
    if (!m.available) errors.push(`${m.label}: ${m.reason ?? "unavailable"}`);
    if (o.salary > m.maxFirstYear && o.method !== "minimum") errors.push(`${m.label} allows a first-year salary up to $${fmtM(m.maxFirstYear)}`);
    if (o.years > m.maxYears) errors.push(`${m.label} allows at most ${m.maxYears} years`);
    if (o.raisePct > m.maxRaise + 1e-9) errors.push(`Annual raises are limited to ${(m.maxRaise * 100).toFixed(0)}% with ${m.label}`);
    if (o.method === "early-bird" && o.years < 2) errors.push("Early Bird contracts must be at least 2 years");
  }
  if (o.years < 1 || o.years > 5) errors.push("Contracts run 1-5 years");
  if (!opts.ignoreRoster) {
    const count = standardPlayers(l, teamId).length;
    const max = l.phase === "regular" || l.phase === "play-in" || l.phase === "playoffs" ? cba.roster.maxStandard : cba.roster.offseasonMax - twoWayPlayers(l, teamId).length;
    if (count >= max) errors.push(`Roster is full (${count}/${max})`);
  }
  return errors;
}

export const fmtM = (v: number) => (v / 1e6).toFixed(2) + "M";

// ---------- designated player / extensions ----------
export function isSupermaxEligible(l: League, p: Player, teamId: TeamId): boolean {
  // Designated veteran (35%): 7-9 YOS, with the drafting team (or traded during rookie deal),
  // and All-NBA last season or 2 of last 3, or MVP in 1 of last 3, or DPOY last season / 2 of 3.
  if (p.experience < 7 || p.experience > 9) return false;
  if (p.draft?.teamId !== teamId && p.seasonsWithTeam < p.experience) return false;
  const y = seasonStartYear(l.season);
  const last3 = [1, 2, 3].map((k) => `${y - k}-${String((y - k + 1) % 100).padStart(2, "0")}`);
  const allNba = p.awards.filter((a) => a.award.startsWith("All-NBA") && last3.includes(a.season));
  const lastAllNba = p.awards.some((a) => a.award.startsWith("All-NBA") && a.season === last3[0]);
  const mvp = p.awards.some((a) => a.award === "MVP" && last3.includes(a.season));
  const dpoy = p.awards.filter((a) => a.award === "DPOY" && last3.includes(a.season));
  return lastAllNba || allNba.length >= 2 || mvp || dpoy.some((a) => a.season === last3[0]) || dpoy.length >= 2;
}

export function isDesignatedRookieEligible(p: Player): boolean {
  // Rookie-scale extension at 30% if All-NBA/MVP/DPOY criteria met (same award tests, rookie deal).
  return p.awards.some((a) => a.award.startsWith("All-NBA") || a.award === "MVP" || a.award === "DPOY");
}

export interface ExtensionInfo {
  eligible: boolean;
  kind: "rookie-scale" | "veteran" | null;
  maxFirstYear: number;
  maxYears: number;
  reason: string;
}

export function extensionEligibility(l: League, p: Player): ExtensionInfo {
  const c = contractOf(l, p);
  const none = (reason: string): ExtensionInfo => ({ eligible: false, kind: null, maxFirstYear: 0, maxYears: 0, reason });
  if (!c || !p.teamId) return none("No contract");
  if (c.type === "two-way" || c.type === "exhibit-10") return none("Not eligible on this contract type");
  if (c.isExtension) return none("Already extended");
  const cba = cbaFor(l, l.season);
  const remaining = c.years.filter((y) => seasonStartYear(y.season) >= seasonStartYear(l.season));
  const startNext = remaining.length ? nextSeason(remaining[remaining.length - 1].season) : nextSeason(l.season);
  const extCba = cbaFor(l, startNext);
  if (c.type === "rookie-scale") {
    // after 3rd season, before 4th regular season starts
    const year = p.draft ? seasonStartYear(l.season) - p.draft.year + 1 : 0;
    const window = year === 4 && (l.phase === "preseason" || l.phase === "training-camp") || (year === 3 && ["free-agency", "summer-league", "training-camp"].includes(l.phase));
    if (!window) return none("Rookie-scale extensions open the offseason after year 3");
    const pct = isDesignatedRookieEligible(p) ? cba.maxSalary.designatedRookiePct : cba.maxSalary.byService[0].pct;
    return { eligible: true, kind: "rookie-scale", maxFirstYear: Math.round(extCba.salaryCap.value * pct), maxYears: 5, reason: "Rookie-scale extension window" };
  }
  const signedYearsAgo = seasonStartYear(l.season) - seasonStartYear(c.years[0].season);
  if (signedYearsAgo < 2) return none("Veteran extensions require 2 years since signing");
  if (remaining.length > 3) return none("Too many years left on the current deal");
  const cur = remaining[0]?.salary ?? 0;
  const est = cba.averageSalaryEstimate.value;
  const limit = Math.max(Math.round(cur * cba.extensions.veteranFirstYearPctOfCurrent), Math.round(est * cba.extensions.veteranFirstYearPctOfCurrent));
  const maxS = maxSalary(extCba, p.experience + remaining.length, isSupermaxEligible(l, p, p.teamId));
  return { eligible: true, kind: "veteran", maxFirstYear: Math.min(maxS, limit), maxYears: Math.max(1, 5 - remaining.length), reason: "Veteran extension" };
}

export function rookieScaleContract(l: League, pick: number, season: string): Contract["years"] {
  const cba = cbaFor(l, season);
  const row = cba.rookieScale.pct120[Math.min(29, Math.max(0, pick - 1))];
  let s = season;
  return row.map((salary, i) => {
    const y = { season: s, salary, guaranteed: i < 2 ? salary : 0, option: (i >= 2 ? "team" : null) as "team" | null };
    s = nextSeason(s);
    return y;
  });
}

export function secondRoundContract(l: League, season: string, years = 2): Contract["years"] {
  const cba = cbaFor(l, season);
  let s = season;
  const out: Contract["years"] = [];
  for (let i = 0; i < years; i++) {
    const c = cbaFor(l, s);
    const sal = c.minimumSalary.byService[i];
    out.push({ season: s, salary: sal, guaranteed: i === 0 ? sal : 0, option: i === years - 1 && years > 1 ? "team" : null });
    s = nextSeason(s);
  }
  void cba;
  return out;
}

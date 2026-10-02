/** Contract extensions (rookie-scale & veteran) for user negotiation and AI teams. */
import type { League, PlayerId } from "../types/game";
import { contractOf, newId, seasonAge, teamPlayers } from "../league/helpers";
import { extensionEligibility, maxSalary, type ExtensionInfo } from "../cap/contracts";
import { cbaFor } from "../cap/payroll";
import { marketSalary, playerValue } from "../trade/value";
import { nextSeason, seasonStartYear } from "../util/dates";
import { clamp, Rng } from "../util/rng";

export interface ExtensionResponse {
  accepted: boolean;
  message: string;
  ask?: { salary: number; years: number };
}

/**
 * Extension rules for the user's own teams: anyone under contract can be re-signed at any time
 * (no CBA windows, "already extended" or years-left limits). Only the player's max salary applies.
 */
export function userExtensionInfo(l: League, playerId: PlayerId): ExtensionInfo {
  const p = l.players[playerId];
  const c = contractOf(l, p);
  const none = (reason: string): ExtensionInfo => ({ eligible: false, kind: null, maxFirstYear: 0, maxYears: 0, reason });
  if (!c || !p.teamId) return none("No contract");
  if (c.type === "exhibit-10" || c.type === "10-day") return none("Sign him to a standard deal first");
  const remaining = c.years.filter((y) => seasonStartYear(y.season) >= seasonStartYear(l.season));
  const start = nextSeason(remaining.length ? remaining[remaining.length - 1].season : l.season);
  const cba = cbaFor(l, start);
  const max = l.settings.salaryCap ? maxSalary(cba, p.experience + remaining.length, true) : Math.round(cba.salaryCap.value * 0.5);
  return { eligible: true, kind: "veteran", maxFirstYear: max, maxYears: 5, reason: remaining.length <= 1 ? "Expiring - re-sign before he hits free agency" : "Extension" };
}

export function extensionInfoFor(l: League, playerId: PlayerId): ExtensionInfo {
  const p = l.players[playerId];
  return p?.teamId && l.userTeams.includes(p.teamId) ? userExtensionInfo(l, playerId) : extensionEligibility(l, p);
}

/** Salary the player needs for a given length: every year away from his preferred length costs ~4%. */
export function requiredSalary(l: League, playerId: PlayerId, years: number): number {
  const ask = extensionAsk(l, playerId);
  const info = extensionInfoFor(l, playerId);
  return Math.min(info.maxFirstYear || Infinity, Math.round(ask.salary * (1 + 0.04 * Math.abs(years - ask.years))));
}

/** What the player wants to extend (first-year salary of the new years). */
export function extensionAsk(l: League, playerId: PlayerId): { salary: number; years: number } {
  const p = l.players[playerId];
  const c = contractOf(l, p);
  const remaining = (c?.years ?? []).filter((y) => seasonStartYear(y.season) >= seasonStartYear(l.season));
  const start = nextSeason(remaining.length ? remaining[remaining.length - 1].season : l.season);
  const cba = cbaFor(l, start);
  const age = seasonAge(p, start);
  const info = extensionInfoFor(l, playerId);
  const market = marketSalary(p.ovr, age, p.pot, cba, p.experience + remaining.length);
  const loyaltyDiscount = 1 - (p.personality.loyalty - 50) / 500 - (p.morale - 60) / 600;
  return { salary: Math.round(Math.min(info.maxFirstYear || market, market * loyaltyDiscount)), years: Math.min(info.maxYears || 4, age <= 26 ? 5 : age <= 30 ? 4 : 2) };
}

export function offerExtension(l: League, playerId: PlayerId, salary: number, years: number): ExtensionResponse {
  const p = l.players[playerId];
  const info = extensionInfoFor(l, playerId);
  if (!info.eligible) return { accepted: false, message: info.reason };
  if (salary > info.maxFirstYear) return { accepted: false, message: `The CBA caps this extension at $${(info.maxFirstYear / 1e6).toFixed(2)}M in year one` };
  if (years < 1 || years > info.maxYears) return { accepted: false, message: `Extension length must be 1-${info.maxYears} years` };
  const ask = extensionAsk(l, playerId);
  const need = requiredSalary(l, playerId, years);
  if (salary < need * 0.97) {
    const alt = years !== ask.years ? ` (or about ${(ask.salary / 1e6).toFixed(1)}M over ${ask.years} years, his preferred length)` : "";
    return { accepted: false, message: `${p.name} wants about ${(need / 1e6).toFixed(1)}M per year for ${years} year${years === 1 ? "" : "s"}${alt}.`, ask };
  }
  applyExtension(l, playerId, salary, years);
  return { accepted: true, message: `${p.name} agrees to a ${years}-year extension.` };
}

export function applyExtension(l: League, playerId: PlayerId, salary: number, years: number) {
  const p = l.players[playerId];
  const c = contractOf(l, p)!;
  const remaining = c.years.filter((y) => seasonStartYear(y.season) >= seasonStartYear(l.season));
  // unexercised options on remaining years are guaranteed when extending
  for (const y of remaining) if (y.option === "team") {
    y.option = null;
    y.guaranteed = y.salary;
  }
  let s = nextSeason(remaining.length ? remaining[remaining.length - 1].season : l.season);
  const raise = cbaFor(l, s).raises.birdPct;
  for (let i = 0; i < years; i++) {
    const sal = Math.round(salary * (1 + raise * i));
    c.years.push({ season: s, salary: sal, guaranteed: sal, option: null });
    s = nextSeason(s);
  }
  c.isExtension = true;
  if (c.type === "two-way") c.type = "standard";
  c.notes.push(`Extended ${l.date}: ${years} yrs from ${c.years[c.years.length - years].season}`);
  const total = c.years.slice(-years).reduce((a, y) => a + y.salary, 0);
  l.news.unshift({ id: newId(l, "n"), date: l.date, type: "extension", text: `${p.name} signs a ${years}-year, $${(total / 1e6).toFixed(1)}M extension with the ${l.teams[p.teamId!].name}.`, teams: [p.teamId!], players: [p.id], important: total > 100e6 });
  l.transactions.unshift({ date: l.date, text: `${p.teamId} extend ${p.name} (${years} yrs / $${(total / 1e6).toFixed(1)}M)`, teams: [p.teamId!] });
}

/** AI teams extend valuable eligible players. */
export function aiExtensions(l: League, rng: Rng) {
  for (const t of Object.keys(l.teams)) {
    if (l.userTeams.includes(t)) continue;
    for (const p of teamPlayers(l, t)) {
      const info = extensionEligibility(l, p);
      if (!info.eligible) continue;
      if (playerValue(l, p, t) < 25 || p.ovr < 74) continue;
      if (!rng.chance(0.6)) continue;
      const ask = extensionAsk(l, p.id);
      const salary = clamp(ask.salary, 0, info.maxFirstYear);
      if (salary > 0) applyExtension(l, p.id, salary, Math.min(ask.years, info.maxYears));
    }
  }
}

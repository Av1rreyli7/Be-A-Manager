/**
 * Options, qualifying offers, the July 1 league-year rollover and free agency.
 *
 * Player decisions weigh: money (vs. asking price) × money focus, role (projected minutes) × play-time
 * demand, contender status × winning desire, market size, and loyalty to the team holding the player's rights.
 * Asking prices fall as free agency drags on. RFA offer sheets give the original team 2 days to match.
 */
import type { Contract, FreeAgencyOffer, League, Player, PlayerId, TeamId } from "../types/game";
import { contractOf, newId, seasonAge, standardPlayers, teamPlayers, teamStrength } from "../league/helpers";
import { capHoldFor, maxSalary, minSalary, signingMethods, validateOffer, type OfferTerms, birdLevel } from "../cap/contracts";
import { cbaFor, capStatus } from "../cap/payroll";
import { projectCba } from "../config/cba";
import { signPlayer, refreshDepth, waivePlayer } from "../league/transactions";
import { marketSalary, playerValue, positionalNeed, strategyOf } from "../trade/value";
import { addDays, nextSeason, seasonCalendar, seasonStartYear } from "../util/dates";
import { clamp, Rng } from "../util/rng";
import { emptyRecord } from "../season/standings";

// ---------------- options & qualifying offers ----------------
export interface PendingDecision {
  playerId: PlayerId;
  teamId: TeamId;
  kind: "team-option" | "qualifying-offer";
  amount: number;
}

/** Decisions the user must make for next season (team options, QOs). */
export function pendingDecisions(l: League, teamId: TeamId): PendingDecision[] {
  const next = nextSeason(l.season);
  const out: PendingDecision[] = [];
  for (const p of teamPlayers(l, teamId)) {
    const c = contractOf(l, p);
    if (!c) continue;
    const y = c.years.find((x) => x.season === next);
    if (y?.option === "team" && !c.notes.includes(`TO ${next} decided`)) out.push({ playerId: p.id, teamId, kind: "team-option", amount: y.salary });
    if (!y && rfaEligible(l, p, c) && p.qualifyingOffer == null) out.push({ playerId: p.id, teamId, kind: "qualifying-offer", amount: qualifyingOfferAmount(l, p, c) });
  }
  return out;
}

export function rfaEligible(l: League, p: Player, c: Contract): boolean {
  const cba = cbaFor(l, l.season);
  return c.type === "rookie-scale" || c.type === "second-round" || c.type === "two-way" || p.experience <= cba.qualifyingOffer.maxYearsOfServiceForRfa;
}

export function qualifyingOfferAmount(l: League, p: Player, c: Contract): number {
  const cba = cbaFor(l, nextSeason(l.season));
  const last = c.years.find((y) => y.season === l.season)?.salary ?? 0;
  const pct = c.type === "rookie-scale" ? cba.qualifyingOffer.rookieScalePctOfLastSalary : cba.qualifyingOffer.veteranPctOfLastSalary;
  return Math.round(Math.max(minSalary(cba, p.experience + 1) + cba.qualifyingOffer.minimumPlus, last * pct));
}

export function decideTeamOption(l: League, playerId: PlayerId, exercise: boolean) {
  const p = l.players[playerId];
  const c = contractOf(l, p);
  const next = nextSeason(l.season);
  if (!c) return;
  const idx = c.years.findIndex((y) => y.season === next);
  if (idx < 0) return;
  c.notes.push(`TO ${next} decided`);
  if (exercise) {
    c.years[idx].option = null;
    c.years[idx].guaranteed = c.years[idx].salary;
    l.transactions.unshift({ date: l.date, text: `${p.teamId} exercise ${next} team option on ${p.name}`, teams: [p.teamId!] });
  } else {
    c.years = c.years.slice(0, idx);
    l.transactions.unshift({ date: l.date, text: `${p.teamId} decline ${next} team option on ${p.name}`, teams: [p.teamId!] });
    l.news.unshift({ id: newId(l, "n"), date: l.date, type: "release", text: `${l.teams[p.teamId!].name} decline their option on ${p.name}.`, teams: [p.teamId!], players: [p.id] });
  }
}

export function extendQualifyingOffer(l: League, playerId: PlayerId, extend: boolean) {
  const p = l.players[playerId];
  const c = contractOf(l, p);
  if (!c) return;
  p.qualifyingOffer = extend ? qualifyingOfferAmount(l, p, c) : 0;
}

/** AI + player-side decisions when entering the options phase. */
export function processOptions(l: League) {
  const next = nextSeason(l.season);
  const cbaNext = cbaFor(l, next);
  for (const p of Object.values(l.players)) {
    if (p.status !== "active" || !p.teamId) continue;
    const c = contractOf(l, p);
    if (!c) continue;
    const idx = c.years.findIndex((y) => y.season === next);
    const y = idx >= 0 ? c.years[idx] : null;
    const age = seasonAge(p, next);
    const market = marketSalary(p.ovr, age, p.pot, cbaNext, p.experience + 1);
    // player options / ETO: the player decides
    if (y && (y.option === "player" || y.option === "eto")) {
      const optIn = market < y.salary * 0.97 || (age >= 33 && market < y.salary * 1.15);
      if (optIn) {
        y.option = null;
        y.guaranteed = y.salary;
      } else {
        c.years = c.years.slice(0, idx);
        l.news.unshift({ id: newId(l, "n"), date: l.date, type: "signing", text: `${p.name} declines the ${next} player option and will enter free agency.`, teams: [p.teamId], players: [p.id], important: p.ovr >= 80 });
      }
    }
    if (l.userTeams.includes(p.teamId)) continue;
    // AI team options
    if (y && y.option === "team" && !c.notes.includes(`TO ${next} decided`)) {
      const keep = market >= y.salary * 0.85 || (p.pot >= 75 && age <= 24);
      decideTeamOption(l, p.id, keep);
    }
    // AI qualifying offers
    if (!y && rfaEligible(l, p, c) && p.qualifyingOffer == null) {
      const qo = qualifyingOfferAmount(l, p, c);
      p.qualifyingOffer = market >= qo * 0.9 || p.pot >= 72 ? qo : 0;
    }
  }
}

// ---------------- rollover ----------------
/** July 1: the league year turns over. Expiring contracts → free agents with cap holds. */
export function startFreeAgency(l: League, rng: Rng) {
  const prevSeason = l.season;
  const season = nextSeason(prevSeason);
  if (!l.cbaBySeason[season]) l.cbaBySeason[season] = projectCba(l.cbaBySeason[prevSeason] ?? l.cba, l.cba.capGrowthProjection.value, season);
  l.cba = l.cbaBySeason[season];
  l.season = season;
  l.phase = "free-agency";
  l.phaseDay = 0;
  l.date = seasonCalendar(seasonStartYear(season)).freeAgencyStart;
  l.freeAgency = { offers: [], day: 0, log: [] };
  const cba = l.cba;

  // user's un-actioned team options default to declined? no - exercise if the player is worth it
  for (const t of l.userTeams) for (const d of pendingDecisions(l, t)) {
    if (d.kind === "team-option") decideTeamOption(l, d.playerId, playerValue(l, l.players[d.playerId], t) > 6);
  }

  for (const t of Object.values(l.teams)) {
    t.exceptions = { ...t.exceptions, mleUsed: 0, mleType: null, roomUsed: 0, baeUsed: 0, tpes: t.exceptions.tpes.filter((x) => x.expires >= l.date), dpe: null };
    t.hardCap = null;
    t.cashSent = 0;
    t.cashReceived = 0;
    t.rights = [];
    t.finances.revenue = 0;
    t.finances.expenses = 0;
    t.finances.attendance = [];
  }

  for (const p of Object.values(l.players)) {
    if (p.status === "active" && p.teamId) {
      p.seasonsWithTeam += 1;
      p.experience += 1;
      p.tradeRequest = false;
      p.tenDays = undefined;
      p.gLeague = false;
    }
    const c = contractOf(l, p);
    if (p.status !== "active" || !p.teamId || !c) continue;
    const hasYear = c.years.some((y) => y.season === season);
    if (hasYear) {
      if (c.type === "two-way") c.twoWayGames = 0;
      continue;
    }
    // contract expired → free agent; team keeps rights & a cap hold
    const team = p.teamId;
    const prev = c.years.find((y) => y.season === prevSeason)?.salary ?? 0;
    const level = birdLevel(l, team, p) ?? "non-bird";
    const hold = capHoldFor(cba, p, prev, level, c.type === "rookie-scale");
    p.lastSeasonSalary = prev;
    const rfa = (p.qualifyingOffer ?? 0) > 0;
    p.rfaTeam = rfa ? team : null;
    if (c.type !== "two-way" && c.type !== "exhibit-10" && c.type !== "10-day") l.teams[team].rights.push({ playerId: p.id, type: level, capHold: rfa ? Math.max(hold, p.qualifyingOffer!) : hold, renounced: false });
    delete l.contracts[c.id];
    p.contractId = null;
    p.status = "fa";
    p.teamId = null;
    l.nextId += 1;
    p.demand = askingPrice(l, p, rng);
  }
  // clean up dead money & expired contracts with no current/future years
  for (const [id, c] of Object.entries(l.contracts)) if (!c.years.some((y) => seasonStartYear(y.season) >= seasonStartYear(season))) delete l.contracts[id];
  for (const p of Object.values(l.players)) if (p.status === "fa" && !p.demand) p.demand = askingPrice(l, p, rng);
  for (const t of Object.keys(l.teams)) refreshDepth(l, t);
  l.news.unshift({ id: newId(l, "n"), date: l.date, type: "league", text: `Free agency opens. The ${season} salary cap is $${(cba.salaryCap.value / 1e6).toFixed(1)}M${cba.status === "projected" ? " (projected)" : ""}. Deals can be agreed during the moratorium and become official on ${seasonCalendar(seasonStartYear(season)).moratoriumEnd}.`, teams: [], players: [], important: true });
}

export function askingPrice(l: League, p: Player, rng: Rng): { salary: number; years: number; updated: string } {
  const cba = l.cba;
  const age = seasonAge(p, l.season);
  const market = marketSalary(p.ovr, age, p.pot, cba, p.experience);
  const greed = 0.9 + (p.personality.money / 100) * 0.25 + rng.normal(0, 0.05);
  const salary = clamp(Math.round(market * greed), minSalary(cba, p.experience), maxSalary(cba, p.experience));
  const years = age <= 25 ? rng.int(3, 5) : age <= 29 ? rng.int(3, 4) : age <= 32 ? rng.int(2, 3) : 1;
  return { salary, years: p.ovr < 62 ? Math.min(years, 2) : years, updated: l.date };
}

// ---------------- offers & decisions ----------------
export function interestScore(l: League, p: Player, o: { teamId: TeamId; salary: number; years: number }): { score: number; parts: Record<string, number> } {
  const demand = p.demand?.salary ?? minSalary(l.cba, p.experience);
  const pers = p.personality;
  const money = clamp((o.salary / Math.max(1, demand) - 0.7) / 0.4, 0, 1.4); // 1.0 = meets ask
  const yearsFit = 1 - Math.min(1, Math.abs((p.demand?.years ?? o.years) - o.years) * 0.15);
  const strength = teamStrength(l, o.teamId);
  const ranks = Object.keys(l.teams).map((t) => teamStrength(l, t)).sort((a, b) => b - a);
  const contender = 1 - ranks.indexOf(strength) / 29;
  const better = teamPlayers(l, o.teamId).filter((x) => x.ovr > p.ovr && (x.pos === p.pos || Math.abs(x.heightIn - p.heightIn) <= 2)).length;
  const role = clamp(1 - better * 0.28, 0, 1);
  const market = l.teams[o.teamId].market / 5;
  const loyalty = l.teams[o.teamId].rights.some((r) => r.playerId === p.id) ? 1 : 0;
  const parts = {
    money: money * (0.9 + pers.money / 100) * 45,
    years: yearsFit * 6,
    contender: contender * (pers.winning / 100) * 22,
    role: role * (pers.playTime / 100) * 18,
    market: market * 6,
    loyalty: loyalty * (pers.loyalty / 100) * 14,
  };
  return { score: Object.values(parts).reduce((a, b) => a + b, 0), parts };
}

export function makeOffer(l: League, teamId: TeamId, playerId: PlayerId, terms: OfferTerms): { ok: boolean; errors: string[]; response?: string } {
  const p = l.players[playerId];
  if (!p || p.status !== "fa") return { ok: false, errors: ["Not a free agent"] };
  const errors = validateOffer(l, teamId, p, terms);
  if (errors.length) return { ok: false, errors };
  l.freeAgency.offers = l.freeAgency.offers.filter((o) => !(o.teamId === teamId && o.playerId === playerId && o.status === "pending"));
  const offer: FreeAgencyOffer = {
    id: newId(l, "fo"),
    teamId,
    playerId,
    salary: terms.salary,
    years: terms.years,
    raisePct: terms.raisePct,
    option: terms.option,
    exception: terms.method,
    created: l.date,
    status: "pending",
    offerSheet: !!p.rfaTeam && p.rfaTeam !== teamId,
  };
  l.freeAgency.offers.push(offer);
  const demand = p.demand?.salary ?? 0;
  const ratio = terms.salary / Math.max(1, demand);
  const response = ratio >= 1 ? "Likes the offer - a decision is coming soon." : ratio >= 0.85 ? `The player's camp is looking for about ${(demand / 1e6).toFixed(1)}M per year.` : "The player's camp calls the offer well short of market value.";
  return { ok: true, errors: [], response };
}

function aiTargets(l: League, teamId: TeamId, fas: Player[]): Player[] {
  const strat = strategyOf(l, teamId);
  const count = standardPlayers(l, teamId).length;
  if (count >= 15) return [];
  return fas
    .filter((p) => !l.freeAgency.offers.some((o) => o.teamId === teamId && o.playerId === p.id && o.status === "pending"))
    .map((p) => ({ p, v: (playerValue(l, p, teamId) * positionalNeed(l, teamId, p)) / Math.max(1, (p.demand?.salary ?? 1e6) / 5e6) + (strat === "rebuilding" && seasonAge(p, l.season) <= 25 ? 3 : 0) }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 6)
    .map((x) => x.p);
}

/** One day of free agency: AI offers, player decisions, RFA matching, demand decay. */
export function freeAgencyDay(l: League, rng: Rng) {
  const fa = l.freeAgency;
  fa.day += 1;
  l.phaseDay = fa.day;
  l.date = addDays(l.date, 1);
  const moratoriumEnd = seasonCalendar(seasonStartYear(l.season)).moratoriumEnd;
  const fas = Object.values(l.players).filter((p) => p.status === "fa" && p.ovr >= 45);

  // demand decay after the first week
  for (const p of fas) {
    if (p.demand && fa.day > 5) p.demand = { ...p.demand, salary: Math.max(minSalary(l.cba, p.experience), Math.round(p.demand.salary * (fa.day > 20 ? 0.95 : 0.975))), updated: l.date };
  }

  // AI teams first try to re-sign their own free agents with Bird rights (cap hold already counts)
  for (const t of Object.keys(l.teams)) {
    if (l.userTeams.includes(t)) continue;
    for (const r of l.teams[t].rights) {
      const p = l.players[r.playerId];
      if (r.renounced || !p || p.status !== "fa") continue;
      if (fa.offers.some((o) => o.teamId === t && o.playerId === p.id && o.status === "pending")) continue;
      const worth = playerValue(l, p, t);
      if (worth < 6 && p.ovr < 72) {
        if (fa.day === 1) r.renounced = true; // free the cap hold
        continue;
      }
      const m = signingMethods(l, t, p).find((x) => x.id === (r.type === "bird" ? "bird" : r.type) && x.available);
      if (!m) continue;
      const salary = Math.min(m.maxFirstYear, Math.round((p.demand?.salary ?? 0) * rng.range(0.95, 1.06)));
      if (salary < minSalary(l.cba, p.experience)) continue;
      makeOffer(l, t, p.id, { salary, years: Math.min(p.demand?.years ?? 3, m.maxYears), raisePct: Math.min(0.05, m.maxRaise), option: null, method: m.id });
    }
  }

  // AI teams make offers
  for (const t of Object.keys(l.teams)) {
    if (l.userTeams.includes(t)) continue;
    const pending = fa.offers.filter((o) => o.teamId === t && o.status === "pending").length;
    const st = capStatus(l, t);
    const belowFloor = st.salary < st.minimumTeamSalary;
    const maxPending = st.room > 10_000_000 || belowFloor ? 4 : 2;
    if (pending >= maxPending) continue;
    let made = 0;
    for (const p of aiTargets(l, t, fas)) {
      if (pending + made >= maxPending) break;
      const methods = signingMethods(l, t, p).filter((m) => m.available).sort((a, b) => b.maxFirstYear - a.maxFirstYear);
      if (!methods.length) continue;
      const want = Math.round((p.demand?.salary ?? 0) * rng.range(0.88, 1.06) * (belowFloor ? 1.1 : 1));
      const m = methods.find((x) => x.maxFirstYear >= want) ?? methods[0];
      const salary = Math.min(want, m.maxFirstYear);
      if (salary < minSalary(l.cba, p.experience)) continue;
      const years = Math.min(p.demand?.years ?? 2, m.maxYears);
      const r = makeOffer(l, t, p.id, { salary, years, raisePct: Math.min(0.05, m.maxRaise), option: null, method: m.id });
      if (r.ok) made++;
    }
  }

  // RFA matching deadlines
  for (const o of fa.offers.filter((x) => x.status === "accepted" && x.offerSheet && x.matchDeadline)) {
    if (l.date < o.matchDeadline!) continue;
    const p = l.players[o.playerId];
    const rfaTeam = p.rfaTeam;
    if (rfaTeam && !l.userTeams.includes(rfaTeam)) {
      const worth = playerValue(l, p, rfaTeam) > 6 && capStatus(l, rfaTeam).status !== "over-second";
      if (worth) matchOfferSheet(l, o.id);
      else finalizeOffer(l, o);
    } else finalizeOffer(l, o); // user didn't match in time
  }

  // player decisions
  const byPlayer = new Map<PlayerId, FreeAgencyOffer[]>();
  for (const o of fa.offers) if (o.status === "pending") byPlayer.set(o.playerId, [...(byPlayer.get(o.playerId) ?? []), o]);
  for (const [pid, offers] of byPlayer) {
    const p = l.players[pid];
    if (p.status !== "fa") continue;
    const scored = offers.map((o) => ({ o, s: interestScore(l, p, o).score })).sort((a, b) => b.s - a.s);
    const best = scored[0];
    const threshold = 50 - fa.day * 1.1 - (p.ovr < 65 ? 10 : 0);
    const decide = best.s >= threshold && (fa.day >= 2 || best.s > 62) && rng.chance(0.55 + fa.day * 0.03);
    if (!decide) continue;
    const errs = validateOffer(l, best.o.teamId, p, { salary: best.o.salary, years: best.o.years, raisePct: best.o.raisePct, option: best.o.option, method: best.o.exception! });
    if (errs.length) {
      best.o.status = "rejected";
      continue;
    }
    for (const x of offers) if (x !== best.o) x.status = "rejected";
    best.o.status = "accepted";
    if (best.o.offerSheet && p.rfaTeam) {
      best.o.matchDeadline = addDays(l.date, l.cba.qualifyingOffer.rfaMatchDays);
      l.news.unshift({ id: newId(l, "n"), date: l.date, type: "signing", text: `${p.name} signs an offer sheet with the ${l.teams[best.o.teamId].name}; the ${l.teams[p.rfaTeam].name} have ${l.cba.qualifyingOffer.rfaMatchDays} days to match.`, teams: [best.o.teamId, p.rfaTeam], players: [p.id], important: true });
    } else finalizeOffer(l, best.o, l.date < moratoriumEnd ? moratoriumEnd : undefined);
  }

  // late in free agency, remaining quality FAs take minimum deals from teams with open spots
  if (fa.day >= 25) {
    for (const p of fas.filter((x) => x.status === "fa" && x.ovr >= 60 && x.ovr < 75).slice(0, 5)) {
      const team = Object.keys(l.teams).filter((t) => !l.userTeams.includes(t) && standardPlayers(l, t).length < 15).sort(() => rng.next() - 0.5)[0];
      if (team) signPlayer(l, team, p, { salary: minSalary(l.cba, p.experience), years: 1, raisePct: 0, option: null, method: "minimum" });
    }
  }
}

function finalizeOffer(l: League, o: FreeAgencyOffer, officialDate?: string) {
  const p = l.players[o.playerId];
  if (p.status !== "fa") return;
  o.status = "accepted";
  const res = signPlayer(l, o.teamId, p, { salary: o.salary, years: o.years, raisePct: o.raisePct, option: o.option, method: o.exception! }, { skipValidation: true });
  if (res.contract && officialDate) res.contract.signedDate = officialDate;
  l.freeAgency.log.unshift(`${l.date}: ${p.name} → ${o.teamId}`);
}

export function matchOfferSheet(l: League, offerId: string) {
  const o = l.freeAgency.offers.find((x) => x.id === offerId);
  if (!o) return;
  const p = l.players[o.playerId];
  const team = p.rfaTeam;
  if (!team) return;
  o.status = "matched";
  const res = signPlayer(l, team, p, { salary: o.salary, years: o.years, raisePct: o.raisePct, option: o.option, method: "bird" }, { skipValidation: true, note: "Matched offer sheet" });
  // matched offer sheets carry a one-year implicit no-trade clause
  if (res.contract) res.contract.noTradeClause = true;
  l.news.unshift({ id: newId(l, "n"), date: l.date, type: "signing", text: `The ${l.teams[team].name} match the offer sheet for ${p.name}.`, teams: [team, o.teamId], players: [p.id], important: true });
}

export function renounceRights(l: League, teamId: TeamId, playerId: PlayerId) {
  const r = l.teams[teamId].rights.find((x) => x.playerId === playerId);
  if (r) r.renounced = true;
  const p = l.players[playerId];
  if (p?.rfaTeam === teamId) p.rfaTeam = null;
}

/** End of free agency: AI teams fill rosters; guarantee-date cuts of non-guaranteed deals. */
export function finishFreeAgency(l: League, rng: Rng) {
  for (let i = 0; i < 3; i++) freeAgencyDay(l, rng);
  for (const t of Object.keys(l.teams)) {
    if (l.userTeams.includes(t)) continue;
    // cut low-value non-guaranteed deals if the roster is crowded
    const ps = standardPlayers(l, t);
    if (ps.length > 17) {
      for (const p of ps.sort((a, b) => a.ovr - b.ovr).slice(0, ps.length - 17)) {
        const c = contractOf(l, p);
        if (c && (c.years[0]?.guaranteed ?? 0) === 0) waivePlayer(l, p.id);
      }
    }
  }
  void emptyRecord;
}

/** Signings, releases, 10-day deals, two-way conversions, G League moves and AI roster maintenance. */
import type { Contract, League, Player, PlayerId, TeamId } from "../types/game";
import { contractOf, newId, standardPlayers, teamPlayers, twoWayPlayers } from "./helpers";
import { autoDepth } from "./depth";
import { buildYears, minSalary, signingMethods, validateOffer, type OfferTerms } from "../cap/contracts";
import { cbaFor } from "../cap/payroll";
import { addDays, nextSeason, seasonStartYear } from "../util/dates";
import { playerValue } from "../trade/value";

export function refreshDepth(l: League, t: TeamId) {
  const team = l.teams[t];
  if (team.depth.auto || !l.userTeams.includes(t)) {
    team.depth = autoDepth(l, t, l.phase === "playoffs");
    return;
  }
  const here = new Set(teamPlayers(l, t).map((p) => p.id));
  team.depth.starters = team.depth.starters.filter((id) => here.has(id));
  team.depth.rotation = [...team.depth.rotation.filter((id) => here.has(id)), ...[...here].filter((id) => !team.depth.starters.includes(id) && !team.depth.rotation.includes(id))];
  if (team.depth.starters.length < 5) team.depth = autoDepth(l, t);
}

export interface SignResult {
  ok: boolean;
  errors: string[];
  contract?: Contract;
}

export function signPlayer(l: League, teamId: TeamId, p: Player, o: OfferTerms, opts: { skipValidation?: boolean; type?: Contract["type"]; note?: string } = {}): SignResult {
  const errors = opts.skipValidation ? [] : validateOffer(l, teamId, p, o);
  if (errors.length) return { ok: false, errors };
  const season = l.season;
  const cba = cbaFor(l, season);
  const years = buildYears(o.salary, o.years, o.raisePct, season, o.option);
  const method = signingMethods(l, teamId, p).find((m) => m.id === o.method);
  const t = l.teams[teamId];
  // exception bookkeeping & hard caps
  if (o.method === "nt-mle" || o.method === "tp-mle" || o.method === "room-mle") {
    t.exceptions.mleUsed += o.salary;
    t.exceptions.mleType = o.method === "nt-mle" ? "nt" : o.method === "tp-mle" ? "tp" : "room";
  }
  if (o.method === "bae") {
    t.exceptions.baeUsed += o.salary;
    t.exceptions.baeLastUsedSeason = season;
  }
  if (o.method === "room") t.exceptions.roomUsed += o.salary;
  if (method?.hardCap && l.settings.salaryCap && (!t.hardCap || (t.hardCap === "second" && method.hardCap === "first"))) t.hardCap = method.hardCap;
  // release previous team's rights
  for (const team of Object.values(l.teams)) team.rights = team.rights.filter((r) => r.playerId !== p.id);
  const type: Contract["type"] = opts.type ?? (o.salary <= minSalary(cba, p.experience) * 1.01 ? "minimum" : "standard");
  const c: Contract = {
    id: newId(l, "c"),
    playerId: p.id,
    playerName: p.name,
    teamId,
    type,
    years,
    tradeKicker: null,
    noTradeClause: false,
    signedDate: l.date,
    signedWith: o.method,
    deadMoney: false,
    twoWayGames: type === "two-way" ? 0 : undefined,
    notes: opts.note ? [opts.note] : [],
  };
  // Bird-rights one-year deals carry an implicit no-trade clause (CBA)
  if (o.years === 1 && (o.method === "bird" || o.method === "early-bird")) c.noTradeClause = true;
  l.contracts[c.id] = c;
  const prevTeam = p.teamId;
  if (p.contractId && l.contracts[p.contractId] && !l.contracts[p.contractId].deadMoney) delete l.contracts[p.contractId];
  p.contractId = c.id;
  if (prevTeam !== teamId) {
    p.seasonsWithTeam = 0;
    p.acquiredDate = undefined;
  }
  p.teamId = teamId;
  p.status = "active";
  p.demand = undefined;
  p.rfaTeam = null;
  p.qualifyingOffer = undefined;
  refreshDepth(l, teamId);
  const total = years.reduce((s, y) => s + y.salary, 0);
  const txt = `${t.fullName} sign ${p.name} - ${o.years} yr / $${(total / 1e6).toFixed(1)}M${o.method ? ` (${method?.label ?? o.method})` : ""}`;
  l.transactions.unshift({ date: l.date, text: txt, teams: [teamId] });
  l.news.unshift({ id: newId(l, "n"), date: l.date, type: "signing", text: txt, teams: [teamId], players: [p.id], important: total > 60e6 });
  return { ok: true, errors: [], contract: c };
}

/** Waive a player: guaranteed money stays on the books (optionally stretched: 2 × years + 1). */
export function waivePlayer(l: League, playerId: PlayerId, opts: { stretch?: boolean } = {}): string {
  const p = l.players[playerId];
  const c = contractOf(l, p);
  const teamId = p.teamId;
  if (!teamId) return "Not on a team";
  if (c) {
    const remaining = c.years.filter((y) => seasonStartYear(y.season) >= seasonStartYear(l.season));
    // in-season: only the unpaid portion of this season counts (approximate by fraction of season left)
    const g = remaining.map((y) => y.guaranteed).filter((v) => v > 0);
    if (g.length) {
      let years = remaining.filter((y) => y.guaranteed > 0).map((y) => ({ season: y.season, salary: y.guaranteed, guaranteed: y.guaranteed, option: null }));
      if (opts.stretch && years.length) {
        const total = years.reduce((s, y) => s + y.salary, 0);
        const n = years.length * 2 + 1;
        years = [];
        let s = l.season;
        for (let i = 0; i < n; i++) {
          years.push({ season: s, salary: Math.round(total / n), guaranteed: Math.round(total / n), option: null });
          s = nextSeason(s);
        }
      }
      const dead: Contract = { ...c, id: newId(l, "c"), playerId: p.id, deadMoney: true, years, notes: [`Waived ${l.date}${opts.stretch ? " (stretched)" : ""}`] };
      l.contracts[dead.id] = dead;
    }
    delete l.contracts[c.id];
  }
  p.contractId = null;
  p.teamId = null;
  p.status = "fa";
  p.gLeague = false;
  p.seasonsWithTeam = 0;
  refreshDepth(l, teamId);
  l.tradeBlock = l.tradeBlock.filter((x) => x !== playerId);
  l.transactions.unshift({ date: l.date, text: `${l.teams[teamId].fullName} waive ${p.name}`, teams: [teamId] });
  l.news.unshift({ id: newId(l, "n"), date: l.date, type: "release", text: `${l.teams[teamId].name} waive ${p.name}.`, teams: [teamId], players: [p.id] });
  return "ok";
}

export function signTenDay(l: League, teamId: TeamId, p: Player): SignResult {
  const cba = cbaFor(l, l.season);
  const used = p.tenDays?.[teamId] ?? 0;
  if (used >= cba.roster.tenDayContractsPerPlayerPerTeam) return { ok: false, errors: ["Already signed two 10-day contracts with this team"] };
  if (l.phase !== "regular") return { ok: false, errors: ["10-day contracts are only available during the regular season"] };
  const sal = Math.round((minSalary(cba, p.experience) / 174) * 10);
  const res = signPlayer(l, teamId, p, { salary: minSalary(cba, p.experience), years: 1, raisePct: 0, option: null, method: "minimum" }, { type: "10-day", note: "10-day contract" });
  if (res.ok && res.contract) {
    res.contract.years[0].salary = sal;
    res.contract.years[0].guaranteed = sal;
    res.contract.expires = addDays(l.date, 10);
    p.tenDays = { ...(p.tenDays ?? {}), [teamId]: used + 1 };
  }
  return res;
}

export function signTwoWay(l: League, teamId: TeamId, p: Player): SignResult {
  const cba = cbaFor(l, l.season);
  if (twoWayPlayers(l, teamId).length >= cba.roster.maxTwoWay) return { ok: false, errors: ["All three two-way slots are full"] };
  if (p.experience > 3) return { ok: false, errors: ["Two-way contracts are for players with 3 or fewer years of service"] };
  const res = signPlayer(l, teamId, p, { salary: cba.exceptions.twoWaySalary.value, years: 1, raisePct: 0, option: null, method: "two-way" }, { skipValidation: true, type: "two-way", note: "Two-way contract" });
  if (res.contract) {
    res.contract.years[0].guaranteed = 0;
    res.contract.twoWayGames = 0;
  }
  return res;
}

export function convertTwoWay(l: League, playerId: PlayerId): SignResult {
  const p = l.players[playerId];
  const c = contractOf(l, p);
  if (!p.teamId || c?.type !== "two-way") return { ok: false, errors: ["Not on a two-way contract"] };
  const cba = cbaFor(l, l.season);
  if (standardPlayers(l, p.teamId).length >= cba.roster.maxStandard && l.phase === "regular") return { ok: false, errors: ["No open standard roster spot"] };
  const teamId = p.teamId;
  delete l.contracts[c.id];
  p.contractId = null;
  return signPlayer(l, teamId, p, { salary: minSalary(cba, p.experience), years: 2, raisePct: 0.05, option: null, method: "minimum" }, { skipValidation: true, type: "minimum", note: "Converted from two-way" });
}

export function setGLeague(l: League, playerId: PlayerId, assigned: boolean): string {
  const p = l.players[playerId];
  if (!p.teamId) return "Not on a team";
  if (assigned && p.experience > 3 && contractOf(l, p)?.type !== "two-way") return "Only players with ≤3 years of service (or two-way players) can be assigned";
  p.gLeague = assigned;
  l.nextId += 1;
  refreshDepth(l, p.teamId);
  return "ok";
}

export function freeAgents(l: League): Player[] {
  return Object.values(l.players).filter((p) => p.status === "fa");
}

/** AI: keep 14-15 standard players in season (13+ in offseason), waiving the least valuable, cheapest-to-cut. */
/** Coach-made roster fix for a user team: cut to 15 + 3, or sign cheap free agents up to 14. */
export function autoTrimRoster(l: League, teamId: TeamId): { waived: string[]; signed: string[] } {
  const before = new Set(teamPlayers(l, teamId).map((p) => p.id));
  aiRosterMaintenance(l, teamId, { preseasonCut: true, force: true });
  const after = new Set(teamPlayers(l, teamId).map((p) => p.id));
  return {
    waived: [...before].filter((id) => !after.has(id)).map((id) => l.players[id].name),
    signed: [...after].filter((id) => !before.has(id)).map((id) => l.players[id].name),
  };
}

export function aiRosterMaintenance(l: League, teamId: TeamId, opts: { preseasonCut?: boolean; force?: boolean } = {}) {
  if (l.userTeams.includes(teamId) && !opts.force) return; // user decides; alerts prompt them
  const cba = cbaFor(l, l.season);
  const inSeason = opts.preseasonCut || l.phase === "regular" || l.phase === "playoffs" || l.phase === "play-in";
  const maxStd = inSeason ? cba.roster.maxStandard : cba.roster.offseasonMax - twoWayPlayers(l, teamId).length;
  // too many two-ways
  let tw = twoWayPlayers(l, teamId).sort((a, b) => a.ovr - b.ovr);
  while (tw.length > cba.roster.maxTwoWay) {
    waivePlayer(l, tw[0].id);
    tw = tw.slice(1);
  }
  let std = standardPlayers(l, teamId);
  if (std.length > maxStd) {
    const cutScore = (p: Player) => {
      const c = contractOf(l, p);
      const g = c?.years.filter((y) => seasonStartYear(y.season) >= seasonStartYear(l.season)).reduce((s, y) => s + y.guaranteed, 0) ?? 0;
      return playerValue(l, p, teamId) + g / 3e6;
    };
    std = std.sort((a, b) => cutScore(a) - cutScore(b));
    while (std.length > maxStd) {
      const p = std.shift()!;
      waivePlayer(l, p.id);
    }
  }
  // fill to 14 in season (13 offseason) with the best cheap free agents
  const minStd = inSeason ? cba.roster.minStandard : 13;
  let count = standardPlayers(l, teamId).length;
  if (count < minStd) {
    const pool = freeAgents(l).filter((p) => !p.rfaTeam).sort((a, b) => b.ovr - a.ovr);
    for (const p of pool) {
      if (count >= minStd) break;
      const r = signPlayer(l, teamId, p, { salary: minSalary(cba, p.experience), years: 1, raisePct: 0, option: null, method: "minimum" }, { skipValidation: !l.settings.salaryCap });
      if (r.ok) count++;
    }
  }
}

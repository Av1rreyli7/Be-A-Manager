/**
 * Draft: prospect generation (hidden true ratings), scouting, combine, lottery, draft order with pick
 * ownership & protections, AI selections (board + need), rookie contracts.
 *
 * LOTTERY: 14 non-playoff teams, 1000 combinations split 140/140/140/125/105/90/75/60/45/30/20/15/10/5
 * (ties split combinations evenly), four picks drawn; the rest follow in reverse record order.
 */
import type { DraftState, League, Player, PlayerId, Position, TeamId } from "../types/game";
import { POSITIONS } from "../types/game";
import { generateAttributes, randomBody } from "../ratings/generate";
import { hashString, ovrFromAttributes, personalityFor, tendenciesFromRatings, traitsFor } from "../ratings/ratings";
import { randomName, randomOrigin } from "../util/names";
import { clamp, Rng } from "../util/rng";
import { leagueOrderWorstFirst, emptyRecord, winPct } from "../season/standings";
import { newId, standardPlayers, teamPlayers } from "../league/helpers";
import { rookieScaleContract, secondRoundContract } from "../cap/contracts";
import { refreshDepth } from "../league/transactions";
import { seasonStartYear } from "../util/dates";

const DRAFT_SIZE = 100;

/** Generate the class for `year` (the June draft ending the current season). */
export function generateDraftClass(l: League, year: number, rng: Rng): DraftState {
  const strength = clamp(rng.normal(1, 0.1), 0.8, 1.22);
  const existing = new Set(Object.values(l.players).map((p) => p.name));
  const prospects: PlayerId[] = [];
  for (let i = 0; i < DRAFT_SIZE; i++) {
    // talent curve by expected slot, scaled by class strength
    const slotQ = Math.exp(-i / 22);
    const pot = Math.round(clamp(58 + 36 * slotQ * strength + rng.normal(0, 4), 50, 97));
    const age = rng.chance(0.55) ? 19 : rng.chance(0.5) ? 20 : rng.chance(0.6) ? 21 : 22;
    const ovr = Math.round(clamp(pot - (12 + (22 - age) * 3) + rng.normal(0, 3.5), 38, 79));
    const pos: Position = rng.pick(POSITIONS);
    const body = randomBody(rng, pos);
    let nm = randomName(rng);
    while (existing.has(`${nm.first} ${nm.last}`)) nm = randomName(rng);
    existing.add(`${nm.first} ${nm.last}`);
    const origin = randomOrigin(rng);
    const attrs = generateAttributes(rng, pos, body.heightIn, body.weightLb, ovr);
    const trueOvr = ovrFromAttributes(attrs, pos);
    const id = newId(l, "dp");
    const p: Player = {
      id,
      name: `${nm.first} ${nm.last}`,
      firstName: nm.first,
      lastName: nm.last,
      teamId: null,
      status: "prospect",
      dob: `${year - age - 1}-${String(rng.int(1, 12)).padStart(2, "0")}-${String(rng.int(1, 28)).padStart(2, "0")}`,
      born: { place: null, country: origin.country },
      college: origin.college,
      heightIn: body.heightIn,
      weightLb: body.weightLb,
      pos,
      positions: [pos],
      jersey: null,
      experience: 0,
      draft: null,
      ratings: attrs,
      ovr: trueOvr,
      pot: Math.max(pot, trueOvr),
      tendencies: tendenciesFromRatings(attrs, pos, trueOvr),
      traits: traitsFor(attrs, trueOvr, age),
      personality: personalityFor(id, age, trueOvr),
      morale: 70,
      tradeRequest: false,
      injury: null,
      contractId: null,
      seasonsWithTeam: 0,
      gLeague: false,
      realStats: [],
      stats: [],
      awards: [],
      ratingHistory: [],
      scouting: { revealed: 10 },
      hiddenOvr: trueOvr,
      hiddenPot: Math.max(pot, trueOvr),
    };
    l.players[id] = p;
    prospects.push(id);
  }
  return { year, order: [], current: 0, prospects, classStrength: strength, scoutingPoints: 40 };
}

/** What the user sees: true rating blurred by (1 − revealed%) with a fixed per-prospect error. */
export function scoutedRatings(p: Player): { ovr: number; pot: number; ovrRange: [number, number]; potRange: [number, number] } {
  if (p.hiddenOvr == null || !p.scouting) return { ovr: p.ovr, pot: p.pot, ovrRange: [p.ovr, p.ovr], potRange: [p.pot, p.pot] };
  const unc = 1 - p.scouting.revealed / 100;
  const e1 = ((hashString(p.id + "o") % 2001) / 1000 - 1) * 9 * unc;
  const e2 = ((hashString(p.id + "p") % 2001) / 1000 - 1) * 12 * unc;
  const cap = (v: number) => Math.round(clamp(v, 25, 99));
  const ovr = cap(p.hiddenOvr + e1);
  const pot = Math.max(ovr, cap(p.hiddenPot! + e2));
  const w1 = Math.round(8 * unc);
  const w2 = Math.round(11 * unc);
  return { ovr, pot, ovrRange: [cap(ovr - w1), cap(ovr + w1)], potRange: [cap(pot - w2), cap(pot + w2)] };
}

export function scoutProspect(l: League, id: PlayerId, points = 5): string {
  const d = l.draft;
  const p = l.players[id];
  if (!d || !p?.scouting) return "No draft class";
  if (d.scoutingPoints < points) return "Not enough scouting points";
  d.scoutingPoints -= points;
  p.scouting.revealed = Math.min(100, p.scouting.revealed + points * 3);
  return "ok";
}

export function runCombine(l: League, rng: Rng) {
  for (const id of l.draft?.prospects ?? []) {
    const p = l.players[id];
    if (!p?.scouting) continue;
    p.scouting.combine = {
      heightNoShoes: p.heightIn - 1.25 + rng.range(-0.25, 0.25),
      wingspan: p.heightIn + rng.normal(3.5, 2),
      standingReach: Math.round((p.heightIn * 1.33 + rng.normal(0, 1.5)) * 10) / 10,
      vertical: Math.round((22 + p.ratings.vertical * 0.2 + rng.normal(0, 2)) * 10) / 10,
      laneAgility: Math.round((12.4 - p.ratings.acceleration * 0.02 + rng.normal(0, 0.25)) * 100) / 100,
      sprint: Math.round((3.55 - p.ratings.speed * 0.004 + rng.normal(0, 0.05)) * 100) / 100,
    };
    p.scouting.revealed = Math.min(100, p.scouting.revealed + 10);
  }
}

export function workout(l: League, id: PlayerId): string {
  const p = l.players[id];
  if (!p?.scouting) return "Not a prospect";
  if (p.scouting.workedOut) return "Already worked out";
  const used = (l.draft?.prospects ?? []).filter((x) => l.players[x]?.scouting?.workedOut).length;
  if (used >= 12) return "Workout slots used (12)";
  p.scouting.workedOut = true;
  p.scouting.revealed = Math.min(100, p.scouting.revealed + 25);
  return "ok";
}

/** AI team board: true value + scouting noise (better development staff = less noise) + need. */
export function teamBoard(l: League, teamId: TeamId): PlayerId[] {
  const d = l.draft!;
  const staff = Object.values(l.coaches).filter((c) => c.teamId === teamId);
  const scout = staff.reduce((s, c) => s + c.development, 0) / Math.max(1, staff.length);
  const noise = (8 * (100 - scout)) / 50;
  const rebuild = l.teams[teamId].strategy.mode === "rebuilding";
  const have = teamPlayers(l, teamId);
  return d.prospects
    .filter((id) => l.players[id]?.status === "prospect")
    .map((id) => {
      const p = l.players[id];
      const e = ((hashString(teamId + id) % 2001) / 1000 - 1) * noise;
      const need = have.filter((x) => x.pos === p.pos && x.ovr >= 70).length === 0 ? 2 : 0;
      const val = (p.hiddenPot ?? p.pot) * (rebuild ? 0.7 : 0.55) + (p.hiddenOvr ?? p.ovr) * (rebuild ? 0.3 : 0.45) + e + need;
      return { id, val };
    })
    .sort((a, b) => b.val - a.val)
    .map((x) => x.id);
}

/** Consensus big board / mock draft. */
export function consensusBoard(l: League): PlayerId[] {
  const d = l.draft;
  if (!d) return [];
  return d.prospects
    .filter((id) => l.players[id]?.status === "prospect")
    .map((id) => {
      const p = l.players[id];
      const e = ((hashString("mock" + id) % 2001) / 1000 - 1) * 4;
      return { id, v: (p.hiddenPot ?? p.pot) * 0.6 + (p.hiddenOvr ?? p.ovr) * 0.4 + e };
    })
    .sort((a, b) => b.v - a.v)
    .map((x) => x.id);
}

export interface LotteryEntry {
  teamId: TeamId;
  preLottery: number;
  combos: number;
}

export function lotteryEntries(l: League): LotteryEntry[] {
  const playoffTeams = new Set(l.playoffs.filter((s) => s.round === 1).flatMap((s) => [s.high, s.low]));
  const order = leagueOrderWorstFirst(l).filter((t) => !playoffTeams.has(t)).slice(0, 14);
  const combos = l.cba.draftLottery.combinations;
  const entries = order.map((t, i) => ({ teamId: t, preLottery: i + 1, combos: combos[i] ?? 0 }));
  // ties split combinations evenly
  for (let i = 0; i < entries.length; i++) {
    let j = i;
    const wp = winPct(l.standings[entries[i].teamId] ?? emptyRecord(entries[i].teamId));
    while (j + 1 < entries.length && Math.abs(winPct(l.standings[entries[j + 1].teamId] ?? emptyRecord(entries[j + 1].teamId)) - wp) < 1e-9) j++;
    if (j > i) {
      const tot = entries.slice(i, j + 1).reduce((s, e) => s + e.combos, 0);
      for (let k = i; k <= j; k++) entries[k].combos = tot / (j - i + 1);
    }
    i = j;
  }
  return entries;
}

export function runLottery(l: League, rng: Rng): { teamId: TeamId; preLottery: number; pick: number }[] {
  const entries = lotteryEntries(l);
  const drawn: TeamId[] = [];
  const pool = [...entries];
  for (let k = 0; k < l.cba.draftLottery.picksDrawn && pool.length; k++) {
    const idx = rng.weighted(pool.map((e) => e.combos));
    drawn.push(pool[idx].teamId);
    pool.splice(idx, 1);
  }
  const rest = entries.filter((e) => !drawn.includes(e.teamId)).sort((a, b) => a.preLottery - b.preLottery);
  const final = [...drawn, ...rest.map((e) => e.teamId)];
  return final.map((t, i) => ({ teamId: t, preLottery: entries.find((e) => e.teamId === t)!.preLottery, pick: i + 1 }));
}

/** Build the 2-round order after the lottery, resolving who owns each pick (protections applied). */
export function buildDraftOrder(l: League, lottery: { teamId: TeamId; pick: number }[]) {
  const d = l.draft!;
  const year = d.year;
  const playoffTeams = leagueOrderWorstFirst(l).filter((t) => !lottery.some((x) => x.teamId === t));
  const round1 = [...lottery.map((x) => x.teamId), ...playoffTeams];
  const round2 = leagueOrderWorstFirst(l);
  d.order = [];
  const add = (round: 1 | 2, slot: number, orig: TeamId) => {
    const pickId = `${year}-${round}-${orig}`;
    const k = l.picks[pickId];
    if (k?.forfeited) return;
    let owner = k?.owner ?? orig;
    if (k && k.protection.keepTop && slot <= k.protection.keepTop && owner !== orig) {
      owner = orig; // protected: stays with the original team
      l.news.unshift({ id: newId(l, "n"), date: l.date, type: "draft", text: `${orig}'s ${year} ${round === 1 ? "1st" : "2nd"} (#${slot}) was protected and stays with ${orig}.`, teams: [orig], players: [] });
    }
    if (k) k.resolvedPick = slot;
    d.order.push({ pick: d.order.length + 1, round, pickId, owner, originalTeam: orig });
  };
  round1.forEach((t, i) => add(1, i + 1, t));
  round2.forEach((t, i) => add(2, i + 31, t));
  // custom swap rights created in trades: the holder takes the better of the two picks
  for (const sw of Object.values(l.picks).filter((k) => k.custom && k.swap && k.year === year && k.id.startsWith("swap-"))) {
    const mine = d.order.find((o) => o.round === sw.round && o.originalTeam === sw.owner && o.owner === sw.owner);
    const theirs = d.order.find((o) => o.round === sw.round && o.originalTeam === sw.originalTeam);
    if (mine && theirs && theirs.pick < mine.pick) {
      const tmp = theirs.owner;
      theirs.owner = mine.owner;
      mine.owner = tmp;
      l.news.unshift({ id: newId(l, "n"), date: l.date, type: "draft", text: `${sw.owner} exercise their swap right: #${theirs.pick} for #${mine.pick} with ${sw.originalTeam}.`, teams: [sw.owner, sw.originalTeam], players: [] });
    }
    delete l.picks[sw.id];
  }
  d.current = 0;
}

export function currentPick(l: League) {
  const d = l.draft;
  if (!d || d.current >= d.order.length) return null;
  return d.order[d.current];
}

export function draftPlayer(l: League, playerId: PlayerId): string {
  const d = l.draft;
  const slot = currentPick(l);
  if (!d || !slot) return "Draft is over";
  const p = l.players[playerId];
  if (!p || p.status !== "prospect") return "Player not available";
  const team = slot.owner;
  p.status = "active";
  p.teamId = team;
  p.draft = { year: d.year, round: slot.round, pick: slot.pick, teamId: team };
  p.scouting = p.scouting ? { ...p.scouting, revealed: 100 } : undefined;
  p.ovr = p.hiddenOvr ?? p.ovr;
  p.pot = p.hiddenPot ?? p.pot;
  p.ratingHistory.push({ season: l.season, ovr: p.ovr, pot: p.pot });
  slot.playerId = playerId;
  // rookie contract (AI & default user: 120% of scale for 1st round; 2-year deal for 2nd round)
  const startSeason = `${d.year}-${String((d.year + 1) % 100).padStart(2, "0")}`;
  const years = slot.round === 1 ? rookieScaleContract(l, slot.pick, startSeason) : secondRoundContract(l, startSeason, 2);
  const cid = newId(l, "c");
  l.contracts[cid] = {
    id: cid,
    playerId,
    playerName: p.name,
    teamId: team,
    type: slot.round === 1 ? "rookie-scale" : "second-round",
    years,
    tradeKicker: null,
    noTradeClause: false,
    signedDate: l.date,
    signedWith: slot.round === 1 ? "rookie" : "second-round",
    deadMoney: false,
    notes: [`Drafted #${slot.pick} (${d.year})`],
  };
  p.contractId = cid;
  const k = l.picks[slot.pickId];
  if (k) delete l.picks[slot.pickId];
  l.news.unshift({ id: newId(l, "n"), date: l.date, type: "draft", text: `With pick #${slot.pick}, the ${l.teams[team].fullName} select ${p.name} (${p.pos}, ${p.college ?? p.born.country}).`, teams: [team], players: [playerId], important: slot.pick <= 5 || l.userTeams.includes(team) });
  d.current++;
  refreshDepth(l, team);
  return "ok";
}

export function aiDraftPick(l: League): PlayerId | null {
  const slot = currentPick(l);
  if (!slot) return null;
  const board = teamBoard(l, slot.owner);
  // teams with full rosters take draft-and-stash / upside in round 2 - still pick best on board
  const pickId = board[0];
  if (!pickId) return null;
  draftPlayer(l, pickId);
  return pickId;
}

/** Finish the draft: undrafted prospects become free agents; deep 2nd-rounders may go two-way. */
export function finishDraft(l: League) {
  const d = l.draft;
  if (!d) return;
  for (const id of d.prospects) {
    const p = l.players[id];
    if (p?.status === "prospect") {
      l.nextId += 1;
      p.status = "fa";
      p.ovr = p.hiddenOvr ?? p.ovr;
      p.pot = p.hiddenPot ?? p.pot;
      p.scouting = undefined;
    }
  }
  const hist = l.history.find((h) => h.season === l.season);
  if (hist) hist.draftTop = d.order.filter((o) => o.playerId).slice(0, 10).map((o) => ({ pick: o.pick, playerId: o.playerId!, name: l.players[o.playerId!].name, teamId: o.owner }));
  void standardPlayers;
  void seasonStartYear;
}

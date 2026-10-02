/**
 * All-Star weekend: voting (fans 50% / players 25% / media 25% - modelled from production, team record
 * and popularity), rosters (2 backcourt + 3 frontcourt starters and 7 reserves per conference, with
 * injury replacements), the game (East vs West), 3-point contest and dunk contest.
 */
import type { AllStarState, League, Player, PlayerId, TeamId } from "../types/game";
import { perGame, seasonTotal } from "./stats";
import { emptyRecord, winPct } from "./standings";
import { ageOn } from "../util/dates";
import { Rng, clamp } from "../util/rng";

function allStarScore(l: League, p: Player): { fan: number; merit: number } {
  const s = seasonTotal(l, p.id);
  const pg = perGame(s);
  const t = p.teamId ? l.teams[p.teamId] : null;
  const wp = p.teamId ? winPct(l.standings[p.teamId] ?? emptyRecord(p.teamId)) : 0.4;
  const merit = pg.pts + 0.5 * pg.reb + 0.8 * pg.ast + pg.stl + pg.blk + wp * 12 + (p.ovr - 70) * 0.4;
  const pastAS = p.awards.filter((a) => a.award === "All-Star").length;
  const fan = merit * (1 + (t?.market ?? 3) * 0.06) + pastAS * 1.5 + (s.gp >= 10 ? 0 : -30);
  return { fan, merit };
}

export function updateVotes(l: League) {
  const votes: Record<PlayerId, number> = {};
  for (const p of Object.values(l.players)) {
    if (p.status !== "active" || !p.teamId) continue;
    const { fan } = allStarScore(l, p);
    if (fan > 15) votes[p.id] = Math.round(fan * fan * 900);
  }
  l.allStar = { ...(l.allStar ?? { season: l.season, votes: {} }), season: l.season, votes };
}

const backcourt = (p: Player) => p.pos === "PG" || p.pos === "SG";

export function selectAllStars(l: League) {
  updateVotes(l);
  const as = l.allStar!;
  const rosters: { East: PlayerId[]; West: PlayerId[] } = { East: [], West: [] };
  for (const conf of ["East", "West"] as const) {
    const pool = Object.values(l.players).filter((p) => p.status === "active" && p.teamId && l.teams[p.teamId].conference === conf && seasonTotal(l, p.id).gp >= 8);
    const byVote = [...pool].sort((a, b) => (as.votes[b.id] ?? 0) - (as.votes[a.id] ?? 0));
    const starters = [...byVote.filter(backcourt).slice(0, 2), ...byVote.filter((p) => !backcourt(p)).slice(0, 3)];
    const rest = pool.filter((p) => !starters.includes(p)).sort((a, b) => allStarScore(l, b).merit - allStarScore(l, a).merit);
    const reserves = rest.slice(0, 7);
    // injury replacements
    const roster = [...starters, ...reserves].map((p) => (p.injury && p.injury.daysOut > 7 ? rest.find((r) => !reserves.includes(r) && !r.injury) ?? p : p));
    rosters[conf] = roster.map((p) => p.id);
  }
  as.rosters = rosters;
  for (const conf of ["East", "West"] as const) for (const id of rosters[conf]) l.players[id].awards.push({ season: l.season, award: "All-Star", teamId: l.players[id].teamId ?? undefined });
  l.news.unshift({ id: `as-rosters-${l.season}`, date: l.date, type: "award", text: `All-Star rosters announced. East starters: ${rosters.East.slice(0, 5).map((id) => l.players[id].name).join(", ")}. West starters: ${rosters.West.slice(0, 5).map((id) => l.players[id].name).join(", ")}.`, teams: [], players: [...rosters.East, ...rosters.West], important: true });
}

export function threePointContest(l: League, rng: Rng): AllStarState["threePoint"] {
  const shooters = Object.values(l.players)
    .filter((p) => p.status === "active" && !p.injury && seasonTotal(l, p.id).fg3a >= 60)
    .sort((a, b) => b.ratings.threePoint + seasonTotal(l, b.id).fg3m / 20 - (a.ratings.threePoint + seasonTotal(l, a.id).fg3m / 20))
    .slice(0, 8);
  const round = (p: Player) => {
    const pMake = clamp(0.3 + (p.ratings.threePoint - 70) * 0.012, 0.2, 0.72);
    let score = 0;
    // 5 racks of 5 (last ball of each rack = 2), one all-money rack (2 each), 2 deep shots (3 each)
    for (let rack = 0; rack < 5; rack++) for (let b = 0; b < 5; b++) if (rng.chance(pMake)) score += rack === 4 || b === 4 ? 2 : 1;
    for (let d = 0; d < 2; d++) if (rng.chance(pMake * 0.7)) score += 3;
    return score;
  };
  const r1 = shooters.map((p) => ({ playerId: p.id, scores: [round(p)] }));
  const finalists = [...r1].sort((a, b) => b.scores[0] - a.scores[0]).slice(0, 3);
  for (const f of finalists) f.scores.push(round(l.players[f.playerId]));
  return r1;
}

export function dunkContest(l: League, rng: Rng): AllStarState["dunk"] {
  const dunkers = Object.values(l.players)
    .filter((p) => p.status === "active" && !p.injury && ageOn(p.dob, l.date) <= 27)
    .sort((a, b) => b.ratings.vertical + b.ratings.drivingDunk + rng.range(0, 20) - (a.ratings.vertical + a.ratings.drivingDunk))
    .slice(0, 4);
  const dunk = (p: Player) => Math.round(clamp(38 + (p.ratings.vertical + p.ratings.drivingDunk - 150) * 0.12 + rng.normal(0, 4), 30, 50));
  const r1 = dunkers.map((p) => ({ playerId: p.id, scores: [dunk(p) + dunk(p)] }));
  const finalists = [...r1].sort((a, b) => b.scores[0] - a.scores[0]).slice(0, 2);
  for (const f of finalists) f.scores.push(dunk(l.players[f.playerId]) + dunk(l.players[f.playerId]));
  return r1;
}

export function contestWinner(entries: { playerId: PlayerId; scores: number[] }[] | undefined): PlayerId | undefined {
  if (!entries?.length) return undefined;
  const fin = entries.filter((e) => e.scores.length > 1);
  return [...(fin.length ? fin : entries)].sort((a, b) => b.scores[b.scores.length - 1] - a.scores[a.scores.length - 1])[0].playerId;
}

export function allStarTeams(l: League): Record<"East" | "West", Player[]> {
  const r = l.allStar?.rosters;
  return { East: (r?.East ?? []).map((id) => l.players[id]), West: (r?.West ?? []).map((id) => l.players[id]) };
}

export type { TeamId };

/**
 * End-of-season awards. Games-played eligibility follows the 65-game rule (scaled to season length)
 * for MVP, DPOY, MIP, Clutch, 6MOY, All-NBA and All-Defensive; ROY / All-Rookie are exempt.
 */
import type { League, PlayerId, SeasonHistory, TeamId } from "../types/game";
import { seasonTotal, perGame } from "./stats";
import { advancedFor, leagueBaselines } from "../stats/advanced";
import { emptyRecord, winPct } from "./standings";
import { seasonStartYear } from "../util/dates";

export interface AwardResult {
  award: string;
  playerId?: PlayerId;
  teamId?: TeamId;
  coachId?: string;
  name: string;
  score?: number;
}

export function minGames(l: League): number {
  return Math.ceil((l.cba.awards.minGamesForEligibility * l.settings.seasonLength) / 82);
}

function mainTeam(l: League, id: PlayerId): TeamId | undefined {
  const rows = l.players[id].stats.filter((s) => s.season === l.season);
  return rows.sort((a, b) => b.regular.gp - a.regular.gp)[0]?.teamId;
}

export function awardScores(l: League) {
  const base = leagueBaselines(l);
  const rows: { id: PlayerId; gp: number; score: number; def: number; clutch: number; rookie: boolean; bench: boolean; teamId?: TeamId; mip: number }[] = [];
  const startYear = seasonStartYear(l.season);
  for (const id in l.players) {
    const p = l.players[id];
    const s = seasonTotal(l, id);
    if (s.gp < 5) continue;
    const pg = perGame(s);
    const adv = advancedFor(s, base);
    const teamId = mainTeam(l, id);
    const wp = teamId ? winPct(l.standings[teamId] ?? emptyRecord(teamId)) : 0.5;
    const prod = pg.pts + 0.45 * pg.reb + 0.8 * pg.ast + 1.4 * pg.stl + 1.2 * pg.blk - 0.9 * pg.tov;
    const score = prod * (0.8 + adv.ts) + adv.bpm * 1.5 + wp * 18 + (p.ovr - 70) * 0.25;
    const def = 2.2 * pg.stl + 2.6 * pg.blk + 0.35 * pg.reb + ((p.ratings.perimeterD + p.ratings.interiorD) / 2 - 60) * 0.12 + wp * 4 + (pg.min / 36) * 2;
    const clutch = s.clutchPts * 0.6 + s.clutchPm * 0.4 + wp * 10;
    const prev = p.ratingHistory.find((h) => h.season !== l.season && seasonStartYear(h.season) === startYear - 1);
    const prevLine = seasonTotal(l, id, `${startYear - 1}-${String(startYear % 100).padStart(2, "0")}`);
    const prevReal = p.realStats.find((r) => r.season === `${startYear - 1}-${String(startYear % 100).padStart(2, "0")}`);
    const prevPpg = prevLine.gp ? prevLine.pts / prevLine.gp : prevReal ? prevReal.pts / Math.max(1, prevReal.gp) : pg.pts;
    const mip = (pg.pts - prevPpg) * 1.2 + (prev ? (p.ovr - prev.ovr) * 1.5 : 0) + pg.pts * 0.15;
    const rookie = p.draft?.year === startYear || (p.experience === 0 && !p.realStats.length);
    rows.push({ id, gp: s.gp, score, def, clutch, rookie, bench: s.gs < s.gp / 2, teamId, mip });
  }
  return rows;
}

export function computeAwards(l: League): AwardResult[] {
  const rows = awardScores(l);
  const minG = minGames(l);
  const eligible = rows.filter((r) => r.gp >= minG);
  const name = (id: PlayerId) => l.players[id].name;
  const out: AwardResult[] = [];
  const top = (list: typeof rows, key: "score" | "def" | "clutch" | "mip") => [...list].sort((a, b) => b[key] - a[key]);
  const give = (award: string, r?: (typeof rows)[number], key: "score" | "def" | "clutch" | "mip" = "score") => {
    if (r) out.push({ award, playerId: r.id, teamId: r.teamId, name: name(r.id), score: Math.round(r[key] * 10) / 10 });
  };
  give("MVP", top(eligible, "score")[0]);
  give("DPOY", top(eligible, "def")[0], "def");
  give("ROY", top(rows.filter((r) => r.rookie), "score")[0]);
  give("6MOY", top(eligible.filter((r) => r.bench), "score")[0]);
  give("MIP", top(eligible.filter((r) => l.players[r.id].experience >= 1 && !l.players[r.id].awards.some((a) => a.award === "MIP")), "mip")[0], "mip");
  give("Clutch POY", top(eligible, "clutch")[0], "clutch");
  const allNba = top(eligible, "score").slice(0, 15);
  allNba.forEach((r, i) => give(`All-NBA ${i < 5 ? "1st" : i < 10 ? "2nd" : "3rd"} Team`, r));
  top(eligible, "def").slice(0, 10).forEach((r, i) => give(`All-Defensive ${i < 5 ? "1st" : "2nd"} Team`, r, "def"));
  top(rows.filter((r) => r.rookie), "score").slice(0, 10).forEach((r, i) => give(`All-Rookie ${i < 5 ? "1st" : "2nd"} Team`, r));
  // Coach of the Year: biggest improvement over preseason expectation
  let best: { team: TeamId; delta: number } | null = null;
  for (const t of Object.values(l.teams)) {
    const rec = l.standings[t.id];
    if (!rec) continue;
    const delta = rec.w - (t.preseasonExpectation ?? 41) * (l.settings.seasonLength / 82);
    if (!best || delta > best.delta) best = { team: t.id, delta };
  }
  if (best) {
    const hc = Object.values(l.coaches).find((c) => c.teamId === best!.team && c.role === "HC");
    out.push({ award: "COY", teamId: best.team, coachId: hc?.id, name: hc ? `${hc.name} (${best.team})` : best.team });
  }
  return out;
}

export function applyAwards(l: League, awards: AwardResult[], hist: SeasonHistory) {
  for (const a of awards) {
    if (a.playerId) l.players[a.playerId].awards.push({ season: l.season, award: a.award, teamId: a.teamId });
    hist.awards.push({ award: a.award, playerId: a.playerId, teamId: a.teamId, name: a.name, coachId: a.coachId });
  }
}

/** Finals MVP: best Finals performer on the champion. */
export function finalsMvp(l: League, champ: TeamId): PlayerId | null {
  const fin = l.playoffs.find((s) => s.conference === "Finals");
  if (!fin) return null;
  const agg = new Map<PlayerId, number>();
  for (const gid of fin.games) {
    const b = l.boxScores[gid];
    if (!b) continue;
    const lines = b.home === champ ? b.lines.home : b.lines.away;
    for (const x of lines) agg.set(x.playerId, (agg.get(x.playerId) ?? 0) + x.pts + 0.5 * (x.oreb + x.dreb) + 0.7 * x.ast + x.stl + x.blk - x.tov);
  }
  return [...agg.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

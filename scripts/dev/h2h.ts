/** Dev harness: head-to-head win rates between teams of different strength (no injuries). */
import teams from "../../data/teams.json";
import players from "../../data/players.json";
import contracts from "../../data/contracts.json";
import picks from "../../data/draftPicks.json";
import ov from "../../data/ratingOverrides.json";
import { createLeague } from "../../src/engine/league/init";
import { simulateGame, type SimTeam } from "../../src/engine/sim/game";
import { teamPlayers, teamStrength } from "../../src/engine/league/helpers";
import { calibrate, ovrFromAttributes } from "../../src/engine/ratings/ratings";
import { autoDepth, eligibleForGame } from "../../src/engine/league/depth";
import { Rng } from "../../src/engine/util/rng";

const l = createLeague({ teams, players, contracts, picks, ratingOverrides: ov } as never, { userTeams: [], name: "h", rngSeed: 3 });
for (const p of teamPlayers(l, "LAL").sort((a, b) => b.ovr - a.ovr).slice(0, 2)) { p.ratings = calibrate(p.ratings, p.pos, 99); p.ovr = ovrFromAttributes(p.ratings, p.pos); }
for (const p of Object.values(l.players)) p.injury = null;
for (const t of Object.keys(l.teams)) l.teams[t].depth = autoDepth(l, t);
const mk = (id: string): SimTeam => ({ id, name: id, players: teamPlayers(l, id).filter((p) => eligibleForGame(l, p, false)), depth: l.teams[id].depth, coach: { offense: 60, defense: 60 }, chemistry: 60 });
const ranked = Object.keys(l.teams).sort((a, b) => teamStrength(l, b) - teamStrength(l, a));
const rng = new Rng(11);
const series = (a: string, b: string, n = 200) => {
  let w = 0, margin = 0;
  for (let i = 0; i < n; i++) {
    const home = i % 2 === 0;
    const r = simulateGame(mk(home ? a : b), mk(home ? b : a), { rng, type: "regular", date: "2026-11-01", gameId: "x" + i, quarterMinutes: 12, pbp: false, injuryRate: 0, homeCourt: true });
    const s = r.box.summary; const aScore = home ? s.homeScore : s.awayScore; const bScore = home ? s.awayScore : s.homeScore;
    if (aScore > bScore) w++; margin += aScore - bScore;
  }
  return `${a}(${teamStrength(l, a).toFixed(1)}) vs ${b}(${teamStrength(l, b).toFixed(1)}): ${(w / n * 100).toFixed(0)}% wins, avg margin ${(margin / n).toFixed(1)}`;
};
console.log(series("LAL", ranked[29]));
console.log(series("LAL", ranked[15]));
console.log(series(ranked[0], ranked[29]));
console.log(series(ranked[0], ranked[15]));
console.log(series(ranked[5], ranked[20]));

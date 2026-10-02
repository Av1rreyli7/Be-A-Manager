/** Dev harness: simulate N games from the real seed and print league averages vs NBA norms. */
import teams from "../../data/teams.json";
import players from "../../data/players.json";
import contracts from "../../data/contracts.json";
import picks from "../../data/draftPicks.json";
import { createLeague } from "../../src/engine/league/init";
import { simulateGame, type SimTeam } from "../../src/engine/sim/game";
import { teamPlayers } from "../../src/engine/league/helpers";
import { eligibleForGame } from "../../src/engine/league/depth";
import { Rng } from "../../src/engine/util/rng";

const t0 = Date.now();
const l = createLeague({ teams, players, contracts, picks } as never, { userTeams: ["LAL"], name: "check", rngSeed: 42 });
console.log("league built in", Date.now() - t0, "ms; games scheduled", l.schedule.length);
const perTeam: Record<string, number> = {};
for (const g of l.schedule) { perTeam[g.home] = (perTeam[g.home] ?? 0) + 1; perTeam[g.away] = (perTeam[g.away] ?? 0) + 1; }
console.log("games/team min-max", Math.min(...Object.values(perTeam)), Math.max(...Object.values(perTeam)), "cup games", l.schedule.filter((g) => g.type === "cup-group").length);
const home: Record<string, number> = {};
for (const g of l.schedule) home[g.home] = (home[g.home] ?? 0) + 1;
console.log("home games min-max", Math.min(...Object.values(home)), Math.max(...Object.values(home)), "first", l.schedule[0].date, "last", l.schedule[l.schedule.length - 1].date);

const rng = new Rng(7);
const N = Number(process.argv[2] ?? 300);
const tot: Record<string, number> = {};
let homeWins = 0, ot = 0; const margins: number[] = [];
const t1 = Date.now();
const mk = (id: string): SimTeam => ({ id, name: id, players: teamPlayers(l, id).filter((p) => eligibleForGame(l, p, false)), depth: l.teams[id].depth, coach: { offense: 60, defense: 60 }, chemistry: 60 });
const indiv: Record<string, { g: number; pts: number; min: number; reb: number; ast: number; fg3a: number }> = {};
for (let i = 0; i < N; i++) {
  const g = l.schedule[i];
  const r = simulateGame(mk(g.home), mk(g.away), { rng, type: "regular", date: g.date, gameId: g.id, quarterMinutes: 12, pbp: i === 0, injuryRate: 1, homeCourt: true });
  const b = r.box;
  if (b.summary.homeScore > b.summary.awayScore) homeWins++;
  if (b.summary.ot) ot++;
  margins.push(b.summary.homeScore - b.summary.awayScore);
  for (const side of ["home", "away"] as const) {
    for (const [k, v] of Object.entries(b.teamStats[side])) tot[k] = (tot[k] ?? 0) + v;
    for (const ln of b.lines[side]) {
      const x = (indiv[ln.playerId] ??= { g: 0, pts: 0, min: 0, reb: 0, ast: 0, fg3a: 0 });
      if (ln.min > 0) { x.g++; x.pts += ln.pts; x.min += ln.min; x.reb += ln.oreb + ln.dreb; x.ast += ln.ast; x.fg3a += ln.fg3a; }
    }
  }
  if (i === 0) { console.log(b.pbp!.slice(0, 12).map((e) => `Q${e.q} ${e.clock} ${e.text} [${e.score}]`).join("\n")); console.log("injuries", b.injuries); }
}
const T = N * 2;
const f = (k: string) => (tot[k] / T).toFixed(1);
console.log(`\n${N} games in ${Date.now() - t1}ms`);
console.log(`PTS ${f("pts")} (NBA ~114) | FG ${f("fgm")}/${f("fga")} ${(tot.fgm / tot.fga * 100).toFixed(1)}% (~47.5) | 3P ${f("fg3m")}/${f("fg3a")} ${(tot.fg3m / tot.fg3a * 100).toFixed(1)}% (~36, 37 att) | FT ${f("ftm")}/${f("fta")} (~17/22)`);
console.log(`REB ${f("reb")} (~44) OREB ${f("oreb")} (~11) | AST ${f("ast")} (~27) | STL ${f("stl")} (~8) | BLK ${f("blk")} (~5) | TOV ${f("tov")} (~14) | PF ${f("pf")} (~19)`);
const mm = margins.reduce((a, b) => a + b, 0) / margins.length; console.log(`margin sd ${Math.sqrt(margins.reduce((a, b) => a + (b - mm) ** 2, 0) / margins.length).toFixed(1)} (~14)`);
console.log(`home win% ${(homeWins / N * 100).toFixed(1)} (~54) | OT ${(ot / N * 100).toFixed(1)}% (~6)`);
const names = Object.fromEntries(Object.values(l.players).map((p) => [p.id, p]));
const top = Object.entries(indiv).filter(([, x]) => x.g >= 5).sort((a, b) => b[1].pts / b[1].g - a[1].pts / a[1].g).slice(0, 12);
for (const [id, x] of top) console.log(names[id].name.padEnd(24), names[id].ovr, `${(x.pts / x.g).toFixed(1)} pts ${(x.reb / x.g).toFixed(1)} reb ${(x.ast / x.g).toFixed(1)} ast ${(x.min / x.g).toFixed(1)} min ${(x.fg3a / x.g).toFixed(1)} 3pa`);

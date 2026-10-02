/** Dev harness: do simulated records track last season's real records? (rosters barely changed) */
import teams from "../../data/teams.json";
import players from "../../data/players.json";
import contracts from "../../data/contracts.json";
import picks from "../../data/draftPicks.json";
import ov from "../../data/ratingOverrides.json";
import { createLeague } from "../../src/engine/league/init";
import { simTo } from "../../src/engine/league/advance";
import { teamPlayers, teamStrength } from "../../src/engine/league/helpers";

const seeds = (process.argv[2] ?? "1,2,3").split(",").map(Number);
const prev = Object.fromEntries((teams as { id: string; prevRecord: { w: number } }[]).map((t) => [t.id, t.prevRecord.w]));
const wins: Record<string, number[]> = {};
let str: Record<string, number> = {};
let top: Record<string, string> = {};
for (const seed of seeds) {
  const l = createLeague({ teams, players, contracts, picks, ratingOverrides: ov } as never, { userTeams: ["LAL"], name: "r", rngSeed: seed, settings: { autoRosterAI: true } });
  l.userTeams = [];
  str = Object.fromEntries(Object.keys(l.teams).map((t) => [t, teamStrength(l, t)]));
  top = Object.fromEntries(Object.keys(l.teams).map((t) => [t, teamPlayers(l, t).sort((a, b) => b.ovr - a.ovr).slice(0, 8).map((p) => p.ovr).join(",")]));
  let g = 0;
  while (l.phase !== "play-in" && l.phase !== "playoffs" && g++ < 14) simTo(l, "month");
  for (const t of Object.keys(l.teams)) (wins[t] ??= []).push(l.standings[t].w);
}
const rows = Object.keys(wins).map((t) => ({ t, w: wins[t].reduce((a, b) => a + b, 0) / wins[t].length, p: prev[t], s: str[t] })).sort((a, b) => b.w - a.w);
for (const r of rows) console.log(`${r.t.padEnd(4)} sim ${r.w.toFixed(1).padStart(5)}  real ${r.p}  diff ${(r.w - r.p).toFixed(0).padStart(4)}  str ${r.s.toFixed(1)}  top8 ${top[r.t]}`);
const corr = (xs: number[], ys: number[]) => { const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length; let c = 0, vx = 0, vy = 0; xs.forEach((x, i) => { c += (x - mx) * (ys[i] - my); vx += (x - mx) ** 2; vy += (ys[i] - my) ** 2; }); return c / Math.sqrt(vx * vy); };
console.log("corr(str, sim)", corr(rows.map((r) => r.s), rows.map((r) => r.w)).toFixed(2), " sim wins SD", Math.sqrt(rows.reduce((a, r) => a + (r.w - 41) ** 2, 0) / rows.length).toFixed(1), "(real 14.5)");
console.log("corr(sim, real)", corr(rows.map((r) => r.w), rows.map((r) => r.p)).toFixed(2), " corr(str, real)", corr(rows.map((r) => r.s), rows.map((r) => r.p)).toFixed(2), " MAE", (rows.reduce((a, r) => a + Math.abs(r.w - r.p), 0) / rows.length).toFixed(1));

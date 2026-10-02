/** Dev harness: distribution of one offseason's rating changes by age and OVR band. */
import teams from "../../data/teams.json";
import players from "../../data/players.json";
import contracts from "../../data/contracts.json";
import picks from "../../data/draftPicks.json";
import ov from "../../data/ratingOverrides.json";
import { createLeague } from "../../src/engine/league/init";
import { progressAll } from "../../src/engine/offseason/progression";
import { seasonAge } from "../../src/engine/league/helpers";
import { Rng } from "../../src/engine/util/rng";

const l = createLeague({ teams, players, contracts, picks, ratingOverrides: ov } as never, { userTeams: [], name: "p", rngSeed: 4 });
const before = new Map(Object.values(l.players).map((p) => [p.id, p.ovr]));
const potBefore = new Map(Object.values(l.players).map((p) => [p.id, p.pot]));
l.season = "2027-28";
const changes = progressAll(l, new Rng(9), "2026-27");
const bands: Record<string, number[]> = {};
for (const c of changes) {
  const p = l.players[c.id];
  const age = seasonAge(p, l.season);
  const b0 = before.get(c.id)!;
  const key = `${age <= 22 ? "≤22" : age <= 26 ? "23-26" : age <= 30 ? "27-30" : "31+"} ${b0 >= 85 ? "85+" : b0 >= 75 ? "75-84" : "<75"}`;
  (bands[key] ??= []).push(c.change);
}
for (const k of Object.keys(bands).sort()) {
  const v = bands[k].sort((a, b) => a - b);
  const avg = v.reduce((a, b) => a + b, 0) / v.length;
  console.log(k.padEnd(12), "n", String(v.length).padStart(3), "avg", avg.toFixed(1).padStart(5), "min", v[0], "max", v[v.length - 1], "p90", v[Math.floor(v.length * 0.9)]);
}

const gapBands: Record<string, number[]> = {};
for (const c of changes) {
  const p = l.players[c.id];
  if (seasonAge(p, l.season) > 24) continue;
  const gap = potBefore.get(c.id)! - before.get(c.id)!;
  const key = gap >= 14 ? "gap 14+" : gap >= 8 ? "gap 8-13" : gap >= 3 ? "gap 3-7" : "gap 0-2";
  (gapBands[key] ??= []).push(c.change);
}
console.log("\nPlayers 24 and under, by gap to potential:");
for (const k of ["gap 14+", "gap 8-13", "gap 3-7", "gap 0-2"]) { const v = gapBands[k] ?? []; if (v.length) console.log(k.padEnd(9), "n", v.length, "avg", (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1), "max", Math.max(...v)); }
const ex = changes.map((c) => ({ p: l.players[c.id], c: c.change, b: before.get(c.id)!, pot: potBefore.get(c.id)! })).filter((x) => x.b >= 76 && x.b <= 84 && x.pot - x.b >= 12 && seasonAge(x.p, l.season) <= 23).slice(0, 8);
console.log("examples (76-84, big potential):", ex.map((x) => `${x.p.name} ${x.b}/${x.pot} → ${x.b + x.c} (+${x.c})`).join(" | "));
const over = changes.filter((c) => l.players[c.id].ovr > potBefore.get(c.id)! + 2).length;
console.log("grew past potential (+2 breakout allowance):", over);

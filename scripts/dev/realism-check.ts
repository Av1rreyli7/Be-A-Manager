/** Dev harness: does team quality turn into wins? Two 99s on the Lakers, one full regular season. */
import teams from "../../data/teams.json";
import players from "../../data/players.json";
import contracts from "../../data/contracts.json";
import picks from "../../data/draftPicks.json";
import ov from "../../data/ratingOverrides.json";
import { createLeague } from "../../src/engine/league/init";
import { simTo } from "../../src/engine/league/advance";
import { teamPlayers, teamStrength } from "../../src/engine/league/helpers";
import { calibrate, ovrFromAttributes } from "../../src/engine/ratings/ratings";
import { autoDepth } from "../../src/engine/league/depth";
import { autoTrimRoster } from "../../src/engine/league/transactions";
import { seasonTotal } from "../../src/engine/season/stats";

const seed = Number(process.argv[2] ?? 5);
const l = createLeague({ teams, players, contracts, picks, ratingOverrides: ov } as never, { userTeams: ["LAL"], name: "r", rngSeed: seed });
// make the Lakers' top two players 99s
for (const p of teamPlayers(l, "LAL").sort((a, b) => b.ovr - a.ovr).slice(0, 2)) {
  p.ratings = calibrate(p.ratings, p.pos, 99);
  p.ovr = ovrFromAttributes(p.ratings, p.pos);
}
l.teams.LAL.depth = autoDepth(l, "LAL");
const stars = teamPlayers(l, "LAL").sort((a, b) => b.ovr - a.ovr).slice(0, 2);
simTo(l, "month");
autoTrimRoster(l, "LAL");
const str = Object.fromEntries(Object.keys(l.teams).map((t) => [t, teamStrength(l, t)]));
let guard = 0;
while (l.phase !== "play-in" && guard++ < 12) simTo(l, "month");
const rows = Object.keys(l.teams).map((t) => ({ t, s: str[t], w: l.standings[t].w, l: l.standings[t].l })).sort((a, b) => b.w - a.w);
console.log(rows.map((r, i) => `${i + 1}. ${r.t} ${r.w}-${r.l} (str ${r.s.toFixed(1)})`).join("\n"));
const n = rows.length, ms = rows.reduce((a, r) => a + r.s, 0) / n, mw = rows.reduce((a, r) => a + r.w, 0) / n;
const cov = rows.reduce((a, r) => a + (r.s - ms) * (r.w - mw), 0), vs = rows.reduce((a, r) => a + (r.s - ms) ** 2, 0), vw = rows.reduce((a, r) => a + (r.w - mw) ** 2, 0);
console.log(`corr(strength, wins) ${(cov / Math.sqrt(vs * vw)).toFixed(2)}  wins SD ${Math.sqrt(vw / n).toFixed(1)} (NBA ~12-13)  best ${rows[0].w}  worst ${rows[n - 1].w}`);
for (const p of stars) { const t = seasonTotal(l, p.id); console.log(p.name, p.ovr, "GP", t.gp, "MPG", (t.min / Math.max(1, t.gp)).toFixed(1), "PPG", (t.pts / Math.max(1, t.gp)).toFixed(1), "team now", p.teamId); }
const injuries = Object.values(l.players).filter((p) => p.teamId === "LAL").length;
const inj = l.news.filter((n) => n.type === "injury" && n.teams.includes("LAL")).length;
console.log("LAL injury news items", inj, "roster", injuries);
console.log("LAL rank:", rows.findIndex((r) => r.t === "LAL") + 1);

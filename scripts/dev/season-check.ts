/** Dev harness: headless full season + offseason on real seed data. */
import teams from "../../data/teams.json";
import players from "../../data/players.json";
import contracts from "../../data/contracts.json";
import picks from "../../data/draftPicks.json";
import { createLeague } from "../../src/engine/league/init";
import { advancePhase, simTo } from "../../src/engine/league/advance";
import { conferenceStandings } from "../../src/engine/season/standings";
import { seasonTotal } from "../../src/engine/season/stats";
import { capStatus } from "../../src/engine/cap/payroll";

const seasons = Number(process.argv[2] ?? 1);
const t0 = Date.now();
const l = createLeague({ teams, players, contracts, picks } as never, { userTeams: ["LAL"], name: "check", rngSeed: 1234, settings: { autoRosterAI: true } });
// let the user team be auto-managed for this headless run
l.userTeams = [];
for (let s = 0; s < seasons; s++) {
  let guard = 0;
  while (["preseason", "regular", "play-in", "playoffs"].includes(l.phase) && guard++ < 30) {
    const r = simTo(l, "month");
    const last = r[r.length - 1];
    if (last?.stop && l.phase !== "season-end") { console.log("STOP:", last.stop); break; }
  }
  console.log(`\n=== ${l.season} done in ${((Date.now() - t0) / 1000).toFixed(1)}s - phase ${l.phase}, date ${l.date}`);
  for (const c of ["East", "West"] as const) console.log(c, conferenceStandings(l, c).slice(0, 10).map((t) => `${t} ${l.standings[t].w}-${l.standings[t].l}`).join(", "));
  const h = l.history.find((x) => x.season === l.season)!;
  console.log("Champion:", h.champion, "Finals MVP:", h.finalsMvp && l.players[h.finalsMvp].name, "| Cup:", h.cupChampion ?? l.cup?.champion);
  console.log(h.awards.filter((a) => !a.award.startsWith("All-")).map((a) => `${a.award}: ${a.name}`).join(" | "));
  const lead = Object.values(l.players).map((p) => ({ p, s: seasonTotal(l, p.id) })).filter((x) => x.s.gp >= 50).sort((a, b) => b.s.pts / b.s.gp - a.s.pts / a.s.gp).slice(0, 5);
  console.log("Scoring:", lead.map((x) => `${x.p.name} ${(x.s.pts / x.s.gp).toFixed(1)}`).join(", "));
  console.log("All-Star MVP:", l.allStar?.mvp && l.players[l.allStar.mvp].name, "| 3PT:", l.allStar?.threeWinner && l.players[l.allStar.threeWinner].name);
  console.log("news items:", l.news.length, "trades:", l.news.filter((n) => n.type === "trade").length, "injuries:", l.news.filter((n) => n.type === "injury").length);
  // offseason
  for (const want of ["draft-lottery", "pre-draft", "draft", "options", "free-agency"]) {
    const m = advancePhase(l);
    console.log(" ->", l.phase, "|", m);
    if (l.phase !== want) console.log("  (expected", want, ")");
  }
  for (let d = 0; d < 20; d++) simTo(l, "day");
  for (const want of ["summer-league", "training-camp", "preseason"]) {
    const m = advancePhase(l);
    console.log(" ->", l.phase, "|", m);
  }
  const fa = Object.values(l.players).filter((p) => p.status === "fa").length;
  const rosters = Object.keys(l.teams).map((t) => Object.values(l.players).filter((p) => p.teamId === t && p.status === "active").length);
  console.log(`season ${l.season} preseason: FAs ${fa}, roster sizes ${Math.min(...rosters)}-${Math.max(...rosters)}, retired total ${Object.values(l.players).filter((p) => p.status === "retired").length}`);
  const caps = Object.keys(l.teams).map((t) => capStatus(l, t)).map((c) => c.salary / 1e6);
  console.log(`payrolls $${Math.min(...caps).toFixed(0)}M - $${Math.max(...caps).toFixed(0)}M, cap $${(l.cba.salaryCap.value / 1e6).toFixed(1)}M`);
  console.log("top draft:", l.history.find((x) => x.draftTop?.length)?.draftTop?.slice(0, 3).map((d) => `#${d.pick} ${d.name} (${d.teamId})`).join(", "));
}
console.log("JSON size MB", (JSON.stringify(l).length / 1e6).toFixed(1));

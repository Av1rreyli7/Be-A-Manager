/** Dev harness: after a real simulated season, are the worst teams getting the best picks? */
import teams from "../../data/teams.json";
import players from "../../data/players.json";
import contracts from "../../data/contracts.json";
import picks from "../../data/draftPicks.json";
import { createLeague } from "../../src/engine/league/init";
import { simTo, advancePhase } from "../../src/engine/league/advance";
import { lotteryEntries, runLottery } from "../../src/engine/offseason/draft";
import { leagueOrderWorstFirst } from "../../src/engine/season/standings";
import { Rng } from "../../src/engine/util/rng";

const l = createLeague({ teams, players, contracts, picks } as never, { userTeams: [], name: "lot", rngSeed: 21 });
let g = 0;
while (l.phase !== "season-end" && g++ < 20) simTo(l, "month");
const entries = lotteryEntries(l);
console.log("Pre-lottery order (worst first):");
console.log(entries.map((e) => `${e.preLottery}. ${e.teamId} ${l.standings[e.teamId].w}-${l.standings[e.teamId].l} (${e.combos / 10}%)`).join(" | "));
const playoffTeams = new Set(l.playoffs.filter((s) => s.round === 1).flatMap((s) => [s.high, s.low]));
console.log("any playoff team in lottery?", entries.some((e) => playoffTeams.has(e.teamId)));
const worstOverall = leagueOrderWorstFirst(l).slice(0, 3);
console.log("3 worst records:", worstOverall.join(", "), "=> lottery slots", worstOverall.map((t) => entries.find((e) => e.teamId === t)?.preLottery).join(", "));
const rng = new Rng(3);
const avg: Record<string, number> = {};
const first: Record<string, number> = {};
const N = 2000;
for (let i = 0; i < N; i++) for (const r of runLottery(l, rng)) { avg[r.teamId] = (avg[r.teamId] ?? 0) + r.pick / N; if (r.pick === 1) first[r.teamId] = (first[r.teamId] ?? 0) + 1; }
console.log("Average pick by pre-lottery slot:");
console.log(entries.map((e) => `${e.preLottery}:${e.teamId} avg #${avg[e.teamId].toFixed(1)} (#1 ${(100 * (first[e.teamId] ?? 0) / N).toFixed(1)}%)`).join(" | "));
advancePhase(l);
console.log("Actual draft order top 14:", l.draft!.order.slice(0, 14).map((o) => `${o.pick}.${o.originalTeam}${o.owner !== o.originalTeam ? "→" + o.owner : ""}`).join(" "));
console.log("Picks 15-30 by record (worst first):", l.draft!.order.slice(14, 30).map((o) => `${o.originalTeam} ${l.standings[o.originalTeam].w}`).join(", "));

/** Dev harness: two seasons with a user team, exercising user-only code paths. */
import teams from "../../data/teams.json";
import players from "../../data/players.json";
import contracts from "../../data/contracts.json";
import picks from "../../data/draftPicks.json";
import ov from "../../data/ratingOverrides.json";
import { createLeague } from "../../src/engine/league/init";
import { advancePhase, simTo } from "../../src/engine/league/advance";
import { autoTrimRoster, waivePlayer, signPlayer } from "../../src/engine/league/transactions";
import { findOffers } from "../../src/engine/trade/ai";
import { executeTrade } from "../../src/engine/trade/execute";
import { teamPlayers, contractOf, standardPlayers } from "../../src/engine/league/helpers";
import { currentPick, consensusBoard, draftPlayer } from "../../src/engine/offseason/draft";
import { pendingDecisions, decideTeamOption, extendQualifyingOffer, makeOffer } from "../../src/engine/offseason/freeAgency";
import { signingMethods } from "../../src/engine/cap/contracts";
import { capStatus } from "../../src/engine/cap/payroll";
import { migrateLeague } from "../../src/engine/league/migrate";

const T = "LAL";
const l = createLeague({ teams, players, contracts, picks, ratingOverrides: ov } as never, { userTeams: [T], name: "u", rngSeed: 77 });
migrateLeague(l, ov as never);
const problems: string[] = [];
const check = (label: string) => {
  // integrity checks after every step
  for (const p of Object.values(l.players)) {
    if (p.status === "active" && !p.teamId) problems.push(`${label}: active player without team ${p.name}`);
    if (p.contractId && !l.contracts[p.contractId]) problems.push(`${label}: dangling contract ${p.name}`);
    if (p.contractId && l.contracts[p.contractId].playerId !== p.id) problems.push(`${label}: contract belongs to someone else ${p.name}`);
  }
  for (const t of Object.keys(l.teams)) {
    const d = l.teams[t].depth;
    if (d.starters.length !== 5 && l.phase !== "draft") problems.push(`${label}: ${t} has ${d.starters.length} starters`);
  }
};
console.log("draft class at start:", !!l.draft, l.draft?.prospects.length);
for (let season = 0; season < 2; season++) {
  // preseason: user cuts via auto-cut
  let r = simTo(l, "month");
  if (r[r.length - 1]?.stop) {
    console.log("stop:", r[r.length - 1].stop?.slice(0, 80));
    console.log("auto-fix:", JSON.stringify(autoTrimRoster(l, T)));
  }
  check("preseason");
  // manual lineup with someone out of position
  const ps = teamPlayers(l, T).sort((a, b) => b.ovr - a.ovr);
  l.teams[T].depth = { ...l.teams[T].depth, auto: false, starters: [ps[4].id, ps[0].id, ps[1].id, ps[2].id, ps[3].id] };
  // sim to deadline, make a trade from the finder
  r = simTo(l, "deadline");
  check("deadline");
  const shop = teamPlayers(l, T).sort((a, b) => b.ovr - a.ovr)[3];
  const offers = findOffers(l, [shop.id], T, 5);
  console.log(`deadline ${l.date}: offers for ${shop.name}:`, offers.length);
  if (offers[0]) { const v = executeTrade(l, offers[0].assets); console.log("  executed:", v.valid, offers[0].teamId); }
  check("after trade");
  // re-trade someone just acquired
  const acquired = teamPlayers(l, T).find((p) => p.acquiredDate === l.date);
  if (acquired) console.log("  re-trade offers for", acquired.name, findOffers(l, [acquired.id], T, 3).length);
  let guard = 0;
  while (["regular", "play-in", "playoffs", "preseason"].includes(l.phase) && guard++ < 20) {
    r = simTo(l, "month");
    if (r[r.length - 1]?.stop && l.phase !== "season-end") { console.log("unexpected stop:", r[r.length - 1].stop); break; }
  }
  check("season end");
  const rec = l.standings[T];
  console.log(`${l.season}: LAL ${rec.w}-${rec.l}, champion ${l.history.find((h) => h.season === l.season)?.champion}, phase ${l.phase}`);
  // offseason as the user
  advancePhase(l); advancePhase(l); advancePhase(l); // lottery, pre-draft, draft
  check("draft open");
  let picksMade = 0;
  while (currentPick(l)) {
    const cp = currentPick(l)!;
    if (l.userTeams.includes(cp.owner)) { draftPlayer(l, consensusBoard(l)[0]); picksMade++; }
    else advancePhase(l); // AI picks happen in advancePhase for the rest
    if (l.phase !== "draft") break;
  }
  if (l.phase === "draft") advancePhase(l);
  console.log("  user picks made:", picksMade, "phase:", l.phase);
  check("options");
  for (const d of pendingDecisions(l, T)) {
    if (d.kind === "team-option") decideTeamOption(l, d.playerId, true);
    else extendQualifyingOffer(l, d.playerId, true);
  }
  advancePhase(l); // free agency
  check("FA start");
  const st = capStatus(l, T);
  console.log(`  FA: salary ${(st.salary / 1e6).toFixed(1)}M room ${(st.room / 1e6).toFixed(1)}M, rights ${l.teams[T].rights.length}`);
  // user makes an offer to the best FA with an available method
  const fa = Object.values(l.players).filter((p) => p.status === "fa").sort((a, b) => b.ovr - a.ovr)[0];
  const m = signingMethods(l, T, fa).find((x) => x.available);
  if (m) console.log("  offer to", fa.name, JSON.stringify(makeOffer(l, T, fa.id, { salary: Math.min(m.maxFirstYear, fa.demand?.salary ?? m.maxFirstYear), years: 2, raisePct: 0.05, option: null, method: m.id })).slice(0, 120));
  for (let d = 0; d < 10; d++) simTo(l, "day");
  check("FA day 10");
  advancePhase(l); advancePhase(l); // summer league, camp
  check("camp");
  advancePhase(l); // preseason
  check("new preseason");
  console.log(`  -> ${l.season} ${l.phase}; LAL roster ${standardPlayers(l, T).length} std; draft class ${l.draft?.prospects.length}`);
}
console.log("problems:", problems.length ? [...new Set(problems)].slice(0, 20) : "none");

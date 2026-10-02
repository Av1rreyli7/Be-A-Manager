/** Dev harness: what does the Trade Finder offer for a few players? (counts offers with picks) */
import teams from "../../data/teams.json";
import players from "../../data/players.json";
import contracts from "../../data/contracts.json";
import picks from "../../data/draftPicks.json";
import ov from "../../data/ratingOverrides.json";
import { createLeague } from "../../src/engine/league/init";
import { findOffers } from "../../src/engine/trade/ai";
import { autoTrimRoster } from "../../src/engine/league/transactions";

for (const [team, name] of [["LAL", "Austin Reaves"], ["DAL", "Kyrie Irving"], ["LAL", "Deandre Ayton"], ["MIA", "Tyler Herro"]] as const) {
  const l = createLeague({ teams, players, contracts, picks, ratingOverrides: ov } as never, { userTeams: [team], name: "f", rngSeed: 1 });
  for (const t of Object.keys(l.teams)) autoTrimRoster(l, t);
  l.phase = "regular";
  l.date = "2026-11-20";
  const p = Object.values(l.players).find((x) => x.name === name && x.teamId === team);
  if (!p) { console.log("missing", name); continue; }
  const offers = findOffers(l, [p.id], team, 12);
  const withPicks = offers.filter((o) => o.assets.sides.find((s) => s.teamId === o.teamId)!.picks.length).length;
  console.log(`\n${name} (${p.ovr}): ${offers.length} offers, ${withPicks} include picks`);
  for (const o of offers) {
    const s = o.assets.sides.find((x) => x.teamId === o.teamId)!;
    console.log(`  ${o.teamId}: ${s.players.map((id) => `${l.players[id].name} ${l.players[id].ovr}`).join(", ")}${s.picks.length ? " + " + s.picks.map((id) => `${l.picks[id].year} R${l.picks[id].round} (${l.picks[id].originalTeam})`).join(", ") : ""}`);
  }
}

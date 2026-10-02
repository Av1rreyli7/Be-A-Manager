/** Upgrade older saves to the current league format. */
import type { League } from "../types/game";
import type { SeedPlayer } from "../types/seed";
import { assignPositions } from "./positions";
import { autoDepth } from "./depth";
import { seasonAge } from "./helpers";
import { rateSeedPlayers } from "../ratings/fromStats";
import { generateDraftClass } from "../offseason/draft";
import { seasonStartYear } from "../util/dates";
import { Rng } from "../util/rng";

export const LEAGUE_VERSION = 5;

export function migrateLeague(l: League, ratingOverrides: Record<string, number> = {}, teamWinPct: Record<string, number> = {}): boolean {
  let changed = false;
  if ((l.version ?? 1) < 2) {
    // v2: strict positions - rebalance G/F splits and rebuild every depth chart
    const pos = assignPositions(Object.values(l.players).filter((p) => p.status !== "prospect"));
    for (const [id, p] of pos) l.players[id].pos = p;
    l.version = 2;
    changed = true;
  }
  if ((l.version ?? 1) < 5) {
    // v3/v4: rescaled ratings; v5: ratings include winning impact. Only re-rate real players while the save is still in the opening preseason,
    // so no in-save development is overwritten.
    if (l.season === "2026-27" && l.phase === "preseason") {
      const real = Object.values(l.players).filter((p) => p.realStats.length > 0 || /^\d+$/.test(p.id));
      const seed: SeedPlayer[] = real.map((p) => ({
        id: p.id,
        name: p.name,
        firstName: p.firstName,
        lastName: p.lastName,
        teamId: p.teamId,
        jersey: p.jersey,
        positions: p.positions,
        heightIn: p.heightIn,
        weightLb: p.weightLb,
        age: seasonAge(p, l.season),
        dob: p.dob,
        birthPlace: p.born.place,
        country: p.born.country,
        college: p.college,
        experienceYears: p.experience,
        draft: p.draft ? { year: p.draft.year, round: p.draft.round, pick: p.draft.pick, teamEspnId: null } : null,
        injury: null,
        stats: p.realStats,
        seasonsWithTeam: p.seasonsWithTeam,
        rosterSlot: "standard",
      }));
      const rated = rateSeedPlayers(seed, ratingOverrides, teamWinPct);
      for (const [id, r] of rated) {
        const p = l.players[id];
        p.ratings = r.ratings;
        p.ovr = r.ovr;
        p.pot = r.pot;
        p.tendencies = r.tendencies;
        p.traits = r.traits;
        p.pos = r.pos;
        p.ratingHistory = [{ season: l.season, ovr: r.ovr, pot: r.pot }];
      }
    }
    l.version = 5;
    changed = true;
  }
  // saves created before the draft class existed at league start
  if (!l.draft && ["preseason", "regular", "play-in", "playoffs"].includes(l.phase)) {
    l.draft = generateDraftClass(l, seasonStartYear(l.season) + 1, new Rng(l.rngState));
    changed = true;
  }
  if (changed) {
    for (const t of Object.keys(l.teams)) l.teams[t].depth = autoDepth(l, t, l.phase === "playoffs");
    l.nextId += 1;
  }
  return changed;
}

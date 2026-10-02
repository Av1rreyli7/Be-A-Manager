/** Team strategy: contending / retooling / rebuilding, from strength rank, core age and record. */
import type { League } from "../types/game";
import { seasonAge, teamPlayers, teamStrength } from "../league/helpers";

export function updateStrategies(l: League) {
  const ids = Object.keys(l.teams);
  const strength = new Map(ids.map((t) => [t, teamStrength(l, t, true)]));
  const ranked = [...ids].sort((a, b) => strength.get(b)! - strength.get(a)!);
  for (const t of ids) {
    const team = l.teams[t];
    if (l.userTeams.includes(t)) {
      // user teams: strategy only used for AI valuation of user's side - infer the same way
    }
    const rank = ranked.indexOf(t) + 1;
    const core = teamPlayers(l, t)
      .sort((a, b) => b.ovr - a.ovr)
      .slice(0, 6);
    const coreAge = core.reduce((s, p) => s + seasonAge(p, l.season), 0) / Math.max(1, core.length);
    const rec = l.standings[t];
    const gp = rec ? rec.w + rec.l : 0;
    const wp = gp >= 20 ? rec!.w / gp : null;
    let mode: "contending" | "retooling" | "rebuilding" = "retooling";
    if (rank <= 9 || (wp != null && wp >= 0.6)) mode = "contending";
    else if (rank >= 21 || (wp != null && wp <= 0.35)) mode = "rebuilding";
    if (mode === "rebuilding" && coreAge >= 29 && rank <= 18) mode = "retooling";
    if (mode === "contending" && coreAge <= 23.5 && rank > 6) mode = "retooling";
    team.strategy = { mode, updated: l.date };
  }
}

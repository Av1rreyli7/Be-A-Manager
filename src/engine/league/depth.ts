/** Automatic rotation / depth chart and minutes distribution. */
import type { DepthChart, League, Player, TeamId } from "../types/game";
import { isTwoWay, teamPlayers } from "./helpers";
import { bestLineup, SLOTS } from "./positions";


export function eligibleForGame(l: League, p: Player, playoffs: boolean): boolean {
  if (p.injury) return false;
  if (p.gLeague && !isTwoWay(l, p)) return false;
  if (isTwoWay(l, p)) {
    if (playoffs) return false;
    const c = p.contractId ? l.contracts[p.contractId] : null;
    if ((c?.twoWayGames ?? 0) >= l.cba.roster.twoWayGameLimit) return false;
  }
  return true;
}

/**
 * Starters: the best PG, SG, SF, PF and C (strict positions). The bench is ordered by quality with a
 * backup at every position in the first rotation spots.
 */
export function autoDepth(l: League, teamId: TeamId, playoffs = false): DepthChart {
  const ps = teamPlayers(l, teamId)
    .filter((p) => eligibleForGame(l, p, playoffs))
    .sort((a, b) => b.ovr - a.ovr || b.pot - a.pot);
  const starters = ps.length >= 5 ? bestLineup(ps) : ps;
  const rest = ps.filter((p) => !starters.includes(p));
  // top of the bench: the best backup at each position (so every slot has a sub), then everyone else
  const bench: Player[] = [];
  for (const pos of SLOTS) {
    const best = rest.find((p) => p.pos === pos && !bench.includes(p));
    if (best) bench.push(best);
  }
  bench.sort((x, y) => y.ovr - x.ovr);
  for (const p of rest) if (!bench.includes(p)) bench.push(p);
  const minutes = distributeMinutes(starters, bench, playoffs);
  return { starters: starters.map((p) => p.id), rotation: bench.map((p) => p.id), minutes, auto: true };
}

/** 240 minutes: starters 28-37 by OVR, bench tapering; playoffs tighten the rotation. */
export function distributeMinutes(starters: Player[], bench: Player[], playoffs = false): Record<string, number> {
  const m: Record<string, number> = {};
  const top = Math.max(...starters.map((p) => p.ovr), 60);
  // stars play star minutes (35-38), weaker starters ~28-31
  for (const p of starters) m[p.id] = Math.round(Math.min(38, (playoffs ? 32 : 29) + (p.ovr - top + 10) * 0.6 + (p.ovr >= 90 ? 3 : p.ovr >= 85 ? 2 : 0)));
  const benchMins = playoffs ? [22, 18, 13, 6, 0] : [24, 20, 16, 12, 8, 4];
  bench.forEach((p, i) => (m[p.id] = benchMins[i] ?? 0));
  const all = [...starters, ...bench];
  let total = all.reduce((a, p) => a + m[p.id], 0);
  // normalise to 240 by nudging the rotation
  let guard = 0;
  while (total !== 240 && guard++ < 500) {
    const dir = total > 240 ? -1 : 1;
    const pool = all.filter((p) => m[p.id] > 0 && (dir < 0 ? m[p.id] > 4 : m[p.id] < 40));
    if (!pool.length) break;
    const p = pool[guard % pool.length];
    m[p.id] += dir;
    total += dir;
  }
  return m;
}

/** Validate a user depth chart: returns an error string or null. */
export function validateDepth(d: DepthChart): string | null {
  if (d.starters.length !== 5) return "Pick exactly five starters";
  const total = Object.values(d.minutes).reduce((a, b) => a + b, 0);
  if (Math.abs(total - 240) > 1) return `Minutes must total 240 (currently ${total})`;
  if (Object.values(d.minutes).some((v) => v > 48)) return "No player can exceed 48 minutes";
  return null;
}

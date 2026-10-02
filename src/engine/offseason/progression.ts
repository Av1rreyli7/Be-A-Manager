/**
 * Offseason development.
 *   delta = ageCurve(age) + (POT − OVR) × growth(age) + (workEthic − 50)/25 + minutes bonus
 *           + (dev coach − 60)/20 + summer-league boost + noise(σ = 1.8 × variance)
 *   5% breakout (+2..+4) for players ≤ 25, 4% sharp decline (−2..−4) for players ≥ 30.
 *   Yearly change is capped: +4 (OVR 85+), +5 (75-84), +7 (under 75); drops at most −6 (−8 at 34+).
 * Skills move with delta; athleticism (speed/accel/vertical/stamina) declines from 29+.
 */
import type { League, Player } from "../types/game";
import { ATTRIBUTE_KEYS } from "../types/game";
import { calibrate, ovrFromAttributes, PHYSICAL_KEYS, traitsFor } from "../ratings/ratings";
import { newId, seasonAge, teamPlayers } from "../league/helpers";
import { seasonTotal } from "../season/stats";
import { clamp, Rng } from "../util/rng";

export function ageCurve(age: number): number {
  if (age <= 20) return 1.6;
  if (age <= 22) return 1.2;
  if (age <= 24) return 0.8;
  if (age <= 26) return 0.3;
  if (age <= 28) return 0;
  if (age <= 30) return -0.6;
  if (age <= 32) return -1.3;
  if (age <= 34) return -2.1;
  return -3;
}

export function progressPlayer(l: League, p: Player, rng: Rng, prevSeason: string): number {
  const age = seasonAge(p, l.season);
  // young players close a share of the gap to their potential each year (80 → 96 at 21 ≈ +5)
  const gapShare = age <= 21 ? 0.32 : age <= 23 ? 0.27 : age <= 25 ? 0.2 : age <= 26 ? 0.1 : 0;
  const gap = Math.max(0, p.pot - p.ovr);
  const s = seasonTotal(l, p.id, prevSeason);
  const mpg = s.gp ? s.min / s.gp : 0;
  const coach = p.teamId ? Object.values(l.coaches).filter((c) => c.teamId === p.teamId && (c.role === "Player Development" || c.role === "HC")) : [];
  const dev = coach.length ? coach.reduce((a, c) => a + c.development, 0) / coach.length : 55;
  const variance = l.settings.progressionVariance;
  let delta =
    (gapShare > 0 ? gap * gapShare + ageCurve(age) * 0.3 : ageCurve(age)) +
    (p.personality.workEthic - 50) / 40 +
    (age <= 25 ? Math.min(0.8, mpg / 40) : 0) +
    (age <= 27 ? (dev - 60) / 40 : 0) +
    (p.summerLeague?.season === prevSeason ? p.summerLeague.boost * 0.5 : 0) +
    (p.gLeague ? 0.4 : 0) +
    rng.normal(0, 0.9 * variance);
  let event: string | null = null;
  if (age <= 25 && rng.chance(0.05 * variance)) {
    delta += rng.range(2, 4);
    event = "breakout";
  } else if (age >= 30 && rng.chance(0.04 * variance)) {
    delta -= rng.range(2, 4);
    event = "decline";
  }
  // realistic yearly limits: stars +4 at most, good players +5, low-rated/young up to +7; drops capped too
  // (high-potential players get one extra point of headroom)
  const maxGain = (p.ovr >= 85 ? 4 : p.ovr >= 75 ? 5 : 7) + (gap >= 12 ? 1 : 0);
  const maxLoss = age >= 34 ? 8 : 6;
  let target = Math.round(clamp(p.ovr + clamp(delta, -maxLoss, maxGain), 30, 99));
  // nobody grows past their potential, except a breakout (which also raises the ceiling a little)
  const ceiling = Math.max(p.ovr, p.pot + (event === "breakout" ? 2 : 0));
  if (target > ceiling) target = ceiling;
  const a = { ...p.ratings };
  // athletic decline
  if (age >= 29) {
    const drop = (age - 28) * 0.9 + rng.normal(0, 0.8);
    for (const k of ["speed", "acceleration", "vertical", "stamina"] as const) a[k] = Math.round(clamp(a[k] - drop, 25, 99));
  } else if (age <= 23) {
    for (const k of ["strength", "stamina"] as const) a[k] = Math.round(clamp(a[k] + rng.range(0, 2), 25, 99));
  }
  // uneven skill growth: a few attributes jump more
  for (const k of ATTRIBUTE_KEYS) if (!PHYSICAL_KEYS.includes(k) && rng.chance(0.15)) a[k] = Math.round(clamp(a[k] + Math.sign(delta) * rng.range(1, 4), 25, 99));
  const cal = calibrate(a, p.pos, target);
  const before = p.ovr;
  p.ratings = cal;
  p.ovr = ovrFromAttributes(cal, p.pos);
  if (age <= 26) p.pot = Math.round(clamp(Math.max(p.ovr, p.pot + rng.normal(event === "breakout" ? 3 : 0, 2)), 30, 99));
  else p.pot = Math.max(p.ovr, Math.min(p.pot, p.ovr + 2));
  p.traits = traitsFor(p.ratings, p.ovr, age, p.tendencies);
  p.ratingHistory.push({ season: l.season, ovr: p.ovr, pot: p.pot });
  const change = p.ovr - before;
  if ((event && Math.abs(change) >= 4 && (p.ovr >= 70 || (p.teamId && l.userTeams.includes(p.teamId)))) || (p.teamId && l.userTeams.includes(p.teamId) && Math.abs(change) >= 4))
    l.news.unshift({ id: newId(l, "n"), date: l.date, type: "league", text: `${p.name} ${change > 0 ? `made a leap this summer (+${change} OVR, now ${p.ovr})` : `showed signs of decline (${change} OVR, now ${p.ovr})`}.`, teams: p.teamId ? [p.teamId] : [], players: [p.id] });
  return change;
}

export function progressAll(l: League, rng: Rng, prevSeason: string) {
  const changes: { id: string; change: number }[] = [];
  for (const p of Object.values(l.players)) {
    if (p.status !== "active" && p.status !== "fa") continue;
    changes.push({ id: p.id, change: progressPlayer(l, p, rng, prevSeason) });
  }
  return changes;
}

/** Summer League: young players get reps; strong showings add a small development boost. */
export function runSummerLeague(l: League, rng: Rng, prevSeason: string) {
  const results: { teamId: string; w: number }[] = [];
  for (const t of Object.keys(l.teams)) {
    const young = teamPlayers(l, t).filter((p) => seasonAge(p, l.season) <= 23 || p.experience <= 2);
    let teamScore = 0;
    for (const p of young) {
      const ppg = Math.round(clamp(rng.normal(6 + (p.ovr - 55) * 0.45 + (p.pot - p.ovr) * 0.15, 3), 0, 32) * 10) / 10;
      const boost = clamp((ppg - 10) / 10, -0.5, 1.5);
      p.summerLeague = { season: prevSeason, ppg, boost };
      teamScore += p.ovr + p.pot * 0.3;
    }
    results.push({ teamId: t, w: teamScore / Math.max(1, young.length) + rng.normal(0, 6) });
  }
  const champ = results.sort((a, b) => b.w - a.w)[0];
  const mvp = Object.values(l.players).filter((p) => p.summerLeague?.season === prevSeason && p.teamId === champ.teamId).sort((a, b) => (b.summerLeague!.ppg ?? 0) - (a.summerLeague!.ppg ?? 0))[0];
  l.news.unshift({ id: newId(l, "n"), date: l.date, type: "league", text: `The ${l.teams[champ.teamId].fullName} win Summer League${mvp ? `; ${mvp.name} (${mvp.summerLeague!.ppg} ppg) named MVP` : ""}.`, teams: [champ.teamId], players: mvp ? [mvp.id] : [] });
  return champ.teamId;
}

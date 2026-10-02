/** Read-only selectors over league state used across the engine and UI. */
import type { Contract, League, Player, PlayerId, Team, TeamId } from "../types/game";
import { ageOn, seasonStartYear } from "../util/dates";

/**
 * Roster index memoised on the league's mutation counter. Every function that moves a player between
 * teams bumps `l.nextId` (via newId / touch), which invalidates the index.
 */
// keyed by object identity (a structured clone gets a fresh index) plus the mutation counter
const rosterMemo = new WeakMap<object, { key: string; byTeam: Map<TeamId, Player[]> }>();
const rosterKey = (l: League) => `${l.nextId}|${l.phase}|${l.season}`;

export function touch(l: League) {
  l.nextId += 1;
}

export function teamPlayers(l: League, teamId: TeamId): Player[] {
  const key = rosterKey(l);
  let memo = rosterMemo.get(l.players);
  if (!memo || memo.key !== key) {
    const byTeam = new Map<TeamId, Player[]>();
    for (const id in l.players) {
      const p = l.players[id];
      if (p.teamId && p.status === "active") {
        const arr = byTeam.get(p.teamId);
        if (arr) arr.push(p);
        else byTeam.set(p.teamId, [p]);
      }
    }
    memo = { key, byTeam };
    rosterMemo.set(l.players, memo);
  }
  return [...(memo.byTeam.get(teamId) ?? [])];
}

export function contractOf(l: League, p: Player | undefined | null): Contract | null {
  return p?.contractId ? l.contracts[p.contractId] ?? null : null;
}

export function salaryIn(c: Contract | null | undefined, season: string): number {
  return c?.years.find((y) => y.season === season)?.salary ?? 0;
}

export function isTwoWay(l: League, p: Player): boolean {
  return contractOf(l, p)?.type === "two-way";
}

export function standardPlayers(l: League, teamId: TeamId): Player[] {
  return teamPlayers(l, teamId).filter((p) => !isTwoWay(l, p));
}

export function twoWayPlayers(l: League, teamId: TeamId): Player[] {
  return teamPlayers(l, teamId).filter((p) => isTwoWay(l, p));
}

export function ageOf(l: League, p: Player): number {
  return ageOn(p.dob, l.date);
}

/** Age during a season (as of Feb 1) - used for awards/progression. */
export function seasonAge(p: Player, season: string): number {
  return ageOn(p.dob, `${seasonStartYear(season) + 1}-02-01`);
}

export function isUserTeam(l: League, t: TeamId | null | undefined): boolean {
  return !!t && l.userTeams.includes(t);
}

export function teamList(l: League): Team[] {
  return Object.values(l.teams).sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export function playerName(l: League, id: PlayerId): string {
  return l.players[id]?.name ?? "Unknown";
}

let idSalt = "";
/** Online guests add a suffix so ids they create never collide with the host's. */
export function setIdSalt(s: string) {
  idSalt = s;
}

export function newId(l: League, prefix: string): string {
  l.nextId += 1;
  return `${prefix}-${l.nextId.toString(36)}${idSalt}`; // "-" keeps generated ids disjoint from seed ids (c1, co1…)
}

/** Team strength: average OVR of the top-8 weighted by expected minutes. */
export function teamStrength(l: League, teamId: TeamId, includeInjured = false): number {
  const ps = teamPlayers(l, teamId)
    .filter((p) => includeInjured || !p.injury)
    .filter((p) => !isTwoWay(l, p) || includeInjured)
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, 10);
  const w = [1.3, 1.25, 1.2, 1.15, 1.1, 0.85, 0.7, 0.55, 0.35, 0.2];
  let s = 0;
  let tw = 0;
  ps.forEach((p, i) => {
    s += p.ovr * w[i];
    tw += w[i];
  });
  return tw ? s / tw : 40;
}

const strengthMemo = new WeakMap<object, { key: string; byTeam: Map<TeamId, number>; avg: number }>();
function strengths(l: League) {
  const key = rosterKey(l) + "|" + l.date;
  let memo = strengthMemo.get(l.players);
  if (!memo || memo.key !== key) {
    const byTeam = new Map(Object.keys(l.teams).map((t) => [t, teamStrength(l, t)]));
    const vals = [...byTeam.values()];
    memo = { key, byTeam, avg: vals.reduce((a, b) => a + b, 0) / vals.length };
    strengthMemo.set(l.players, memo);
  }
  return memo;
}

/** Projected win % from strength differential vs league average (logistic). */
export function projectedWinPct(l: League, teamId: TeamId): number {
  const s = strengths(l);
  const d = (s.byTeam.get(teamId) ?? s.avg) - s.avg;
  return 1 / (1 + Math.exp(-d / 3.2));
}

export function strengthRank(l: League, teamId: TeamId): number {
  const s = strengths(l);
  const mine = s.byTeam.get(teamId) ?? 0;
  return [...s.byTeam.values()].filter((v) => v > mine).length + 1;
}

/**
 * Standings & NBA tiebreakers.
 *
 * Two-team ties:  (1) division winner  (2) head-to-head  (3) division record (same division)
 *                 (4) conference record  (5) W% vs playoff-eligible teams, own conference
 *                 (6) W% vs playoff-eligible teams, other conference  (7) point differential  (8) coin flip
 * Multi-team ties: (1) division winner  (2) combined head-to-head  (3) division record (all same division)
 *                 (4) conference record  (5) W% vs playoff-eligible own conference  (6) point differential
 *                 (7) coin flip. Once a criterion separates any team the remaining group restarts at step 1
 *                 (using the two-team list if two remain).
 */
import type { BoxScore, League, ScheduledGame, Team, TeamId, TeamSeasonRecord } from "../types/game";
import { hashString } from "../ratings/ratings";

export function emptyRecord(teamId: TeamId): TeamSeasonRecord {
  return { teamId, w: 0, l: 0, homeW: 0, homeL: 0, awayW: 0, awayL: 0, confW: 0, confL: 0, divW: 0, divL: 0, pf: 0, pa: 0, streak: 0, last10: [], vs: {}, cupW: 0, cupL: 0, cupPd: 0, cupPf: 0 };
}

export function countsInStandings(g: ScheduledGame): boolean {
  return g.type === "regular" || g.type === "cup-group" || g.type === "cup-knockout";
}

export function applyResult(l: League, g: ScheduledGame, box: BoxScore) {
  const hs = box.summary.homeScore;
  const as = box.summary.awayScore;
  const homeWon = hs > as;
  const H = (l.standings[g.home] ??= emptyRecord(g.home));
  const A = (l.standings[g.away] ??= emptyRecord(g.away));
  if (g.type === "cup-group") {
    H.cupW += homeWon ? 1 : 0;
    H.cupL += homeWon ? 0 : 1;
    A.cupW += homeWon ? 0 : 1;
    A.cupL += homeWon ? 1 : 0;
    H.cupPd += hs - as;
    A.cupPd += as - hs;
    H.cupPf += hs;
    A.cupPf += as;
  }
  if (!countsInStandings(g)) return;
  const th = l.teams[g.home];
  const ta = l.teams[g.away];
  const upd = (R: TeamSeasonRecord, won: boolean, home: boolean, opp: Team, me: Team, pf: number, pa: number) => {
    if (won) R.w++;
    else R.l++;
    if (home) won ? R.homeW++ : R.homeL++;
    else won ? R.awayW++ : R.awayL++;
    if (opp.conference === me.conference) won ? R.confW++ : R.confL++;
    if (opp.division === me.division) won ? R.divW++ : R.divL++;
    R.pf += pf;
    R.pa += pa;
    R.streak = won ? (R.streak > 0 ? R.streak + 1 : 1) : R.streak < 0 ? R.streak - 1 : -1;
    R.last10 = [...R.last10, won ? "W" : "L"].slice(-10) as ("W" | "L")[];
    const v = (R.vs[opp.id] ??= { w: 0, l: 0 });
    won ? v.w++ : v.l++;
  };
  upd(H, homeWon, true, ta, th, hs, as);
  upd(A, !homeWon, false, th, ta, as, hs);
}

const pct = (w: number, l: number) => (w + l === 0 ? 0 : w / (w + l));
export const winPct = (r: TeamSeasonRecord) => pct(r.w, r.l);

function h2h(l: League, a: TeamId, group: TeamId[]): number {
  let w = 0;
  let ls = 0;
  for (const b of group) {
    if (b === a) continue;
    const v = l.standings[a]?.vs[b];
    if (v) {
      w += v.w;
      ls += v.l;
    }
  }
  return pct(w, ls);
}

function recordVs(l: League, a: TeamId, opps: TeamId[]): number {
  let w = 0;
  let ls = 0;
  for (const b of opps) {
    const v = l.standings[a]?.vs[b];
    if (v) {
      w += v.w;
      ls += v.l;
    }
  }
  return pct(w, ls);
}

function divisionLeaders(l: League): Set<TeamId> {
  const byDiv = new Map<string, TeamId[]>();
  for (const t of Object.values(l.teams)) byDiv.set(t.division, [...(byDiv.get(t.division) ?? []), t.id]);
  const leaders = new Set<TeamId>();
  for (const ids of byDiv.values()) {
    const sorted = [...ids].sort((a, b) => {
      const d = winPct(l.standings[b] ?? emptyRecord(b)) - winPct(l.standings[a] ?? emptyRecord(a));
      if (d) return d;
      const hh = h2h(l, b, [a]) - h2h(l, a, [b]);
      if (hh) return hh;
      const ra = l.standings[a] ?? emptyRecord(a);
      const rb = l.standings[b] ?? emptyRecord(b);
      return pct(rb.confW, rb.confL) - pct(ra.confW, ra.confL) || rb.pf - rb.pa - (ra.pf - ra.pa);
    });
    leaders.add(sorted[0]);
  }
  return leaders;
}

function breakTie(l: League, group: TeamId[], ctx: { leaders: Set<TeamId>; eligibleOwn: TeamId[]; eligibleOther: Record<string, TeamId[]> }): TeamId[] {
  if (group.length <= 1) return group;
  const two = group.length === 2;
  const rec = (t: TeamId) => l.standings[t] ?? emptyRecord(t);
  const sameDiv = new Set(group.map((t) => l.teams[t].division)).size === 1;
  const conf = l.teams[group[0]].conference;
  const other = conf === "East" ? "West" : "East";
  const criteria: ((t: TeamId) => number)[] = [
    (t) => (ctx.leaders.has(t) ? 1 : 0),
    (t) => h2h(l, t, group),
    ...(sameDiv ? [(t: TeamId) => pct(rec(t).divW, rec(t).divL)] : []),
    (t) => pct(rec(t).confW, rec(t).confL),
    (t) => recordVs(l, t, ctx.eligibleOwn.filter((x) => x !== t)),
    ...(two ? [(t: TeamId) => recordVs(l, t, ctx.eligibleOther[other] ?? [])] : []),
    (t) => rec(t).pf - rec(t).pa,
    (t) => hashString(l.season + t) / 2 ** 32,
  ];
  for (const c of criteria) {
    const vals = group.map((t) => [t, c(t)] as const);
    const distinct = new Set(vals.map((v) => v[1].toFixed(6)));
    if (distinct.size === 1) continue;
    // split into sub-groups by this criterion; resolve each recursively from the top
    const sorted = [...vals].sort((a, b) => b[1] - a[1]);
    const out: TeamId[] = [];
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (j + 1 < sorted.length && Math.abs(sorted[j + 1][1] - sorted[i][1]) < 1e-9) j++;
      const sub = sorted.slice(i, j + 1).map((x) => x[0]);
      out.push(...(sub.length > 1 ? breakTie(l, sub, ctx) : sub));
      i = j + 1;
    }
    return out;
  }
  return group;
}

/** Conference standings in seed order with tiebreakers applied. */
export function conferenceStandings(l: League, conf: "East" | "West"): TeamId[] {
  const ids = Object.values(l.teams).filter((t) => t.conference === conf).map((t) => t.id);
  const rough = [...ids].sort((a, b) => winPct(l.standings[b] ?? emptyRecord(b)) - winPct(l.standings[a] ?? emptyRecord(a)));
  const leaders = divisionLeaders(l);
  const eligibleOther: Record<string, TeamId[]> = {};
  for (const c of ["East", "West"] as const) {
    eligibleOther[c] = Object.values(l.teams)
      .filter((t) => t.conference === c)
      .map((t) => t.id)
      .sort((a, b) => winPct(l.standings[b] ?? emptyRecord(b)) - winPct(l.standings[a] ?? emptyRecord(a)))
      .slice(0, 10);
  }
  const ctx = { leaders, eligibleOwn: rough.slice(0, 10), eligibleOther };
  const out: TeamId[] = [];
  let i = 0;
  while (i < rough.length) {
    let j = i;
    const wp = winPct(l.standings[rough[i]] ?? emptyRecord(rough[i]));
    while (j + 1 < rough.length && Math.abs(winPct(l.standings[rough[j + 1]] ?? emptyRecord(rough[j + 1])) - wp) < 1e-9) j++;
    const group = rough.slice(i, j + 1);
    out.push(...breakTie(l, group, ctx));
    i = j + 1;
  }
  return out;
}

export function divisionStandings(l: League, division: string): TeamId[] {
  const conf = Object.values(l.teams).find((t) => t.division === division)!.conference;
  return conferenceStandings(l, conf).filter((t) => l.teams[t].division === division);
}

/** League-wide order worst → best (draft order); ties broken by coin flip seeded by season. */
export function leagueOrderWorstFirst(l: League): TeamId[] {
  return Object.keys(l.teams).sort((a, b) => {
    const d = winPct(l.standings[a] ?? emptyRecord(a)) - winPct(l.standings[b] ?? emptyRecord(b));
    if (Math.abs(d) > 1e-9) return d;
    return hashString(l.season + "lot" + a) - hashString(l.season + "lot" + b);
  });
}

export function gamesBack(leader: TeamSeasonRecord, r: TeamSeasonRecord): number {
  return (leader.w - r.w + (r.l - leader.l)) / 2;
}

/**
 * Bridge between Front Office and Hardwood Legends (public/games/hardwood-legends.html).
 * FO sends both real rosters (ratings mapped to HL's attribute set); HL plays the game
 * and sends back a box score, which is scaled to a 48-minute game (capped at a realistic total) and recorded by the engine.
 */
import type { BoxLine, BoxScore, League, Player, ScheduledGame, TeamId } from "@/engine/types/game";
import { autoDepth, eligibleForGame } from "@/engine/league/depth";
import { teamPlayers } from "@/engine/league/helpers";

/** HL attribute → FO rating(s). Averages where HL has one rating for several FO ones. */
const ATTR_MAP: Record<string, (r: Player["ratings"]) => number> = {
  three: (r) => r.threePoint,
  mid: (r) => r.midRange,
  close: (r) => r.closeShot,
  dunk: (r) => Math.max(r.drivingDunk, r.standingDunk),
  layup: (r) => r.layup,
  ft: (r) => r.freeThrow,
  pass: (r) => (r.passAccuracy + r.passVision) / 2,
  handle: (r) => r.ballHandle,
  speed: (r) => r.speed,
  accel: (r) => r.acceleration,
  str: (r) => r.strength,
  vert: (r) => r.vertical,
  stam: (r) => r.stamina,
  perD: (r) => r.perimeterD,
  intD: (r) => r.interiorD,
  steal: (r) => r.steal,
  block: (r) => r.block,
  oreb: (r) => r.offRebound,
  dreb: (r) => r.defRebound,
  iq: (r) => (r.shotIQ + r.passIQ + r.helpDefIQ) / 3,
};

/** One team in HL's LEAGUE.teams format: players are [name, #, pos, height, ovr, archetype, overrides, foId]. */
export interface HLTeam {
  abbr: string;
  city: string;
  name: string;
  conf: string;
  div: string;
  c1: string;
  c2: string;
  players: [string, string, string, number, number, string, Record<string, number>, string][];
  starters: number[];
}

export interface HLStart {
  gameId: string;
  user: HLTeam;
  opp: HLTeam;
  userHome: boolean;
  label: string;
  qLen: number;
  diff: number;
}

export interface HLResult {
  gameId: string;
  qLen: number;
  userHome: boolean;
  teams: {
    abbr: string;
    score: number;
    qpts: number[];
    players: { foId: string; starter: boolean; stats: { pts: number; reb: number; oreb: number; ast: number; stl: number; blk: number; fgm: number; fga: number; tpm: number; tpa: number; ftm: number; fta: number; to: number; pf: number; sec: number } }[];
  }[];
}

const isPlayoffGame = (g: ScheduledGame) => g.type === "playoffs" || g.type === "play-in";

/** Eligible players with the team's real lineup first (manual depth for user teams, coach's otherwise). */
function lineup(l: League, t: TeamId, playoffs: boolean): Player[] {
  const players = teamPlayers(l, t).filter((p) => eligibleForGame(l, p, playoffs));
  const ok = new Set(players.map((p) => p.id));
  const team = l.teams[t];
  let depth = team.depth.auto || !l.userTeams.includes(t) ? autoDepth(l, t, playoffs) : team.depth;
  if (depth.starters.filter((id) => ok.has(id)).length < 5) depth = autoDepth(l, t, playoffs);
  const order = [...depth.starters, ...depth.rotation].filter((id) => ok.has(id));
  const rest = players.filter((p) => !order.includes(p.id)).sort((a, b) => b.ovr - a.ovr);
  return [...order.map((id) => l.players[id]), ...rest];
}

function hlTeam(l: League, t: TeamId, playoffs: boolean): HLTeam {
  const team = l.teams[t];
  const ps = lineup(l, t, playoffs);
  return {
    abbr: team.id,
    city: team.city,
    name: team.name,
    conf: team.conference,
    div: team.division,
    c1: team.colors.primary,
    c2: team.colors.secondary,
    players: ps.map((p) => {
      const o: Record<string, number> = {};
      for (const [k, f] of Object.entries(ATTR_MAP)) o[k] = Math.max(25, Math.min(99, Math.round(f(p.ratings))));
      return [p.name, p.jersey ?? "0", p.pos, p.heightIn, p.ovr, "forward", o, p.id];
    }),
    starters: [0, 1, 2, 3, 4].filter((i) => i < ps.length),
  };
}

/** The user's next unplayed game, if it tips off today. */
export function playableGame(l: League, team: TeamId): ScheduledGame | null {
  const g = l.schedule.filter((x) => !x.played && (x.home === team || x.away === team)).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  return g && g.date <= l.date ? g : null;
}

export function buildStart(l: League, g: ScheduledGame, me: TeamId, opts: { qLen: number; diff: number }): HLStart {
  const playoffs = isPlayoffGame(g);
  const userHome = g.home === me;
  return {
    gameId: g.id,
    user: hlTeam(l, me, playoffs),
    opp: hlTeam(l, userHome ? g.away : g.home, playoffs),
    userHome,
    label: (g.round ?? (g.type === "regular" ? "Regular season" : g.type)).toUpperCase(),
    qLen: opts.qLen,
    diff: opts.diff,
  };
}

/** Turn HL's result into a Front Office box score, scaled to a full 48-minute game. */
export function toBoxScore(l: League, g: ScheduledGame, r: HLResult): BoxScore {
  // scale to 48 minutes, but short quarters run hot: cap so a game lands near a real NBA total (~235)
  const hlTotal = r.teams[0].score + r.teams[1].score;
  const k = Math.max(1, Math.min(12 / Math.max(1, r.qLen), 235 / Math.max(1, hlTotal)));
  const sc = (v: number) => Math.round(v * k);
  const userSide: "home" | "away" = r.userHome ? "home" : "away";
  const oppSide: "home" | "away" = r.userHome ? "away" : "home";
  const bySide = { [userSide]: r.teams[0], [oppSide]: r.teams[1] } as Record<"home" | "away", HLResult["teams"][number]>;

  const lines = (side: "home" | "away"): BoxLine[] => {
    const t = bySide[side];
    return t.players
      .filter((x) => l.players[x.foId])
      .map((x) => {
        const s = x.stats;
        const min = sc(s.sec / 60);
        const oreb = sc(s.oreb);
        const reb = Math.max(oreb, sc(s.reb));
        return {
          playerId: x.foId,
          name: l.players[x.foId].name,
          starter: x.starter,
          gs: x.starter && min > 0 ? 1 : 0,
          min,
          pts: sc(s.pts),
          fgm: sc(s.fgm),
          fga: sc(s.fga),
          fg3m: sc(s.tpm),
          fg3a: sc(s.tpa),
          ftm: sc(s.ftm),
          fta: sc(s.fta),
          oreb,
          dreb: reb - oreb,
          ast: sc(s.ast),
          stl: sc(s.stl),
          blk: sc(s.blk),
          tov: sc(s.to),
          pf: Math.min(6, sc(s.pf)),
          pm: 0,
          ...(min === 0 ? { dnp: "Coach's decision" } : {}),
        };
      });
  };
  const L = { home: lines("home"), away: lines("away") };
  const total = (side: "home" | "away") => L[side].reduce((a, b) => a + b.pts, 0);
  // scaled player points decide the score; keep HL's winner (rounding can't be allowed to flip it)
  const hlHomeWon = bySide.home.score > bySide.away.score;
  let hs = total("home");
  let as = total("away");
  if (hlHomeWon !== hs > as || hs === as) {
    const side = hlHomeWon ? "home" : "away";
    const top = [...L[side]].sort((a, b) => b.pts - a.pts)[0];
    const need = Math.abs(hs - as) + 1;
    if (top) {
      top.pts += need;
      top.fgm += Math.ceil(need / 2);
      top.fga += Math.ceil(need / 2);
    }
    hs = total("home");
    as = total("away");
  }
  const quarters = (side: "home" | "away", final: number) => {
    const q = bySide[side].qpts.map((v) => sc(v ?? 0));
    while (q.length < 4) q.push(0);
    const diff = final - q.reduce((a, b) => a + b, 0);
    q[q.length - 1] = Math.max(0, q[q.length - 1] + diff);
    return q;
  };
  const qh = quarters("home", hs);
  const qa = quarters("away", as);
  const n = Math.max(qh.length, qa.length);
  while (qh.length < n) qh.push(0);
  while (qa.length < n) qa.push(0);
  const top = (side: "home" | "away") => {
    const b = [...L[side]].sort((x, y) => y.pts - x.pts)[0];
    return b ? { playerId: b.playerId, name: b.name, pts: b.pts, reb: b.oreb + b.dreb, ast: b.ast } : { playerId: "", name: "", pts: 0, reb: 0, ast: 0 };
  };
  const bench = (side: "home" | "away") => L[side].filter((b) => !b.starter).reduce((a, b) => a + b.pts, 0);
  return {
    gameId: g.id,
    date: g.date,
    type: g.type,
    home: g.home,
    away: g.away,
    summary: { homeScore: hs, awayScore: as, ot: Math.max(0, n - 4), quarters: { home: qh, away: qa }, topHome: top("home"), topAway: top("away") },
    lines: L,
    teamStats: {
      home: { fastBreak: 0, paint: 0, secondChance: 0, bench: bench("home"), largestLead: 0 },
      away: { fastBreak: 0, paint: 0, secondChance: 0, bench: bench("away"), largestLead: 0 },
    },
    injuries: [],
  };
}

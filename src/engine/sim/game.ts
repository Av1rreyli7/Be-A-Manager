/**
 * Possession-level game simulation.
 *
 * Each possession: (turnover? → steal?) → (non-shooting foul / bonus FTs?) → shot selection by usage &
 * tendencies → shooting foul / make / block / assist → rebound. Players carry energy (drains on court,
 * recovers on the bench, scaled by stamina); the coach logic substitutes toward target minutes, benches
 * players in foul trouble, closes tight games with the best five and empties the bench in blowouts.
 */
import type { BoxLine, BoxScore, DepthChart, GameType, Player, PlayByPlay, TeamId } from "../types/game";
import { clamp, Rng } from "../util/rng";
import { ageOn } from "../util/dates";
import { rollInjury } from "./injuries";
import { bestLineup, slotPenalty } from "../league/positions";

export interface SimTeam {
  id: TeamId;
  name: string;
  players: Player[]; // all rostered players eligible for this game (healthy)
  depth: DepthChart;
  coach: { offense: number; defense: number }; // 0-100
  chemistry: number; // 0-100 (morale/continuity)
}

export interface SimOptions {
  rng: Rng;
  type: GameType;
  date: string;
  gameId: string;
  quarterMinutes: number;
  pbp: boolean;
  injuryRate: number; // multiplier
  homeCourt: boolean; // false for neutral site (Cup final, All-Star)
  allStar?: boolean;
}

interface SP {
  p: Player;
  side: 0 | 1;
  starter: boolean;
  target: number; // seconds
  secs: number;
  energy: number;
  onCourt: boolean;
  fouledOut: boolean;
  injured: boolean;
  // derived skills
  finish: number;
  mid: number;
  three: number;
  ftPct: number;
  pass: number;
  handle: number;
  perD: number;
  intD: number;
  orebW: number;
  drebW: number;
  stlW: number;
  blkW: number;
  usageW: number;
  clutchR: number;
  // box
  line: Omit<BoxLine, "playerId" | "name" | "starter">;
  clutchPts: number;
  clutchSecs: number;
  clutchPm: number;
}

// shot-quality model: skill vs contest, both around league-average pivots
const SK_SLOPE3 = Number(process.env.FO_SK3 ?? 0.0036);
const SK_SLOPE2 = Number(process.env.FO_SK2 ?? 0.0042);
const DEF_SLOPE = Number(process.env.FO_DEF ?? 0.003);
const FLOW = Number(process.env.FO_FLOW ?? 0.002); // leading teams ease off a little
const SK_PIVOT3 = Number(process.env.FO_P3 ?? 68);
const SK_PIVOT2 = Number(process.env.FO_P2 ?? 66);
const DEF_PIVOT = Number(process.env.FO_PD ?? 62);
const SHOT_BASE = { rim: 0.618, mid: 0.405, three: 0.33 };
// overall quality of the five on the floor (creation, spacing, decisions, rotations that attributes don't capture)
const IMPACT = Number(process.env.FO_IMP ?? 0.0035);
// stars bend games more than their raw number suggests
const STAR = Number(process.env.FO_STAR ?? 0.8);
const impactOvr = (ovr: number) => ovr + STAR * Math.max(0, ovr - 85);

function prep(p: Player, side: 0 | 1, starter: boolean, targetMin: number): SP {
  const r = p.ratings;
  const t = p.tendencies;
  return {
    p,
    side,
    starter,
    target: targetMin * 60,
    secs: 0,
    energy: 100,
    onCourt: false,
    fouledOut: false,
    injured: false,
    finish: (r.layup * 0.4 + r.closeShot * 0.3 + Math.max(r.drivingDunk, r.standingDunk) * 0.3),
    mid: r.midRange * 0.7 + r.postFade * 0.15 + r.shotIQ * 0.15,
    three: r.threePoint,
    ftPct: clamp(0.45 + (r.freeThrow - 25) / 150, 0.35, 0.95),
    pass: (r.passAccuracy + r.passVision + r.passIQ) / 3,
    handle: r.ballHandle,
    perD: r.perimeterD * 0.7 + r.defConsistency * 0.15 + r.helpDefIQ * 0.15,
    intD: r.interiorD * 0.6 + r.block * 0.2 + r.helpDefIQ * 0.2,
    orebW: t.orebRate * (0.6 + r.offRebound / 250),
    drebW: t.drebRate * (0.6 + r.defRebound / 250),
    stlW: t.stlRate * (0.6 + r.steal / 250),
    blkW: t.blkRate * (0.6 + r.block / 250),
    usageW: t.usage * (0.55 + p.ovr / 220), // better players take a bigger share of shots
    clutchR: r.clutch + (p.traits.includes("ice") ? 6 : 0),
    line: { gs: 0, min: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, pts: 0, pm: 0 } as never,
    clutchPts: 0,
    clutchSecs: 0,
    clutchPm: 0,
  };
}

function initLine() {
  return { gs: 0, min: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, pts: 0, pm: 0 };
}

const abbr = (p: Player) => `${p.firstName.charAt(0)}. ${p.lastName}`;
const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export interface SimResult {
  box: BoxScore;
  playerSecs: Record<string, number>;
  clutch: Record<string, { pts: number; secs: number; pm: number }>;
}

export function simulateGame(home: SimTeam, away: SimTeam, o: SimOptions): SimResult {
  const rng = o.rng;
  const sides = [home, away];
  const roster: SP[][] = sides.map((t, side) => {
    const ids = [...t.depth.starters, ...t.depth.rotation];
    const byId = new Map(t.players.map((p) => [p.id, p]));
    const ordered = ids.map((id) => byId.get(id)).filter((p): p is Player => !!p);
    for (const p of t.players) if (!ordered.includes(p)) ordered.push(p);
    return ordered.map((p, i) => {
      const sp = prep(p, side as 0 | 1, t.depth.starters.includes(p.id) && i < 5, t.depth.minutes[p.id] ?? 0);
      sp.line = initLine();
      return sp;
    });
  });
  // guarantee five starters
  for (const r of roster) {
    let n = r.filter((s) => s.starter).length;
    for (const s of r) {
      if (n >= 5) break;
      if (!s.starter) {
        s.starter = true;
        n++;
      }
    }
    // no target minutes set -> fall back to a standard spread
    const totalTarget = r.reduce((a, s) => a + s.target, 0);
    if (totalTarget < 60 * 100) {
      const spread = [34, 33, 32, 31, 30, 24, 20, 17, 12, 7];
      r.forEach((s, i) => (s.target = (spread[i] ?? 0) * 60));
    }
  }
  const qLen = o.quarterMinutes * 60;
  const regTime = qLen * 4;
  const onCourt: SP[][] = roster.map((r) => r.filter((s) => s.starter).slice(0, 5));
  onCourt.forEach((lineup) => lineup.forEach((s) => ((s.onCourt = true), (s.line.gs = 1))));

  const score = [0, 0];
  const qScores: number[][] = [[], []];
  const teamFouls = [0, 0];
  const pbp: PlayByPlay[] = [];
  const injuries: BoxScore["injuries"] = [];
  const extra = [{ fast: 0, paint: 0, second: 0, bench: 0, lead: 0 }, { fast: 0, paint: 0, second: 0, bench: 0, lead: 0 }];

  const log = (q: number, clock: number, side: number | null, text: string) => {
    if (o.pbp) pbp.push({ q, clock: fmtClock(clock), team: side == null ? null : sides[side].id, text, score: [score[0], score[1]] });
  };

  const addPoints = (side: number, pts: number, scorer: SP, clutchNow: boolean) => {
    score[side] += pts;
    scorer.line.pts += pts;
    if (clutchNow) scorer.clutchPts += pts;
    for (const s of onCourt[side]) {
      s.line.pm += pts;
      if (clutchNow) s.clutchPm += pts;
    }
    for (const s of onCourt[1 - side]) {
      s.line.pm -= pts;
      if (clutchNow) s.clutchPm -= pts;
    }
    if (!scorer.starter) extra[side].bench += pts;
    extra[side].lead = Math.max(extra[side].lead, score[side] - score[1 - side]);
  };

  const teamDef = (side: number) => {
    const l = onCourt[side];
    return l.reduce((a, s) => a + (s.perD + s.intD) / 2, 0) / l.length + (sides[side].coach.defense - 50) * 0.02;
  };

  const pickWeighted = (list: SP[], w: (s: SP) => number) => list[rng.weighted(list.map(w))];

  // ---------- substitution ----------
  const available = (side: number) => roster[side].filter((s) => !s.onCourt && !s.fouledOut && !s.injured);
  const posGroup = (s: SP) => (s.p.pos === "PG" || s.p.pos === "SG" ? 0 : s.p.pos === "SF" ? 1 : 2);
  // positional fit: the lineup array index is the slot (0 PG … 4 C)
  const fit = (x: SP, slot: number) => slotPenalty(x.p, slot);

  const substitute = (side: number, elapsed: number, period: number, clock: number) => {
    const total = Math.max(regTime, elapsed + 1);
    const frac = elapsed / regTime;
    const margin = score[side] - score[1 - side];
    const late = period >= 4 && clock <= 300;
    const closeGame = Math.abs(margin) <= 10;
    const blowout = period >= 4 && clock <= 420 && Math.abs(margin) >= 20;
    const lineup = onCourt[side];
    const bench = available(side);
    if (!bench.length) return;
    const foulLimit = period === 1 ? 2 : period === 2 ? 3 : period === 3 ? 4 : clock > 360 ? 5 : 6;

    if (late && closeGame && !o.allStar) {
      // closing lineup: best positionally-sound five (energy-adjusted), one player per slot
      const pool = [...lineup, ...bench].filter((s) => !s.fouledOut && !s.injured);
      if (pool.length < 5) return;
      const eff = (p: Player) => {
        const sp = pool.find((x) => x.p === p)!;
        return p.ovr * (0.7 + sp.energy / 330);
      };
      const target = bestLineup(pool.map((x) => x.p), eff).map((p) => pool.find((x) => x.p === p)!);
      const outs = lineup.filter((x) => !target.includes(x));
      const ins = target.filter((x) => !x.onCourt);
      outs.forEach((x) => (x.onCourt = false));
      ins.forEach((x, k) => {
        x.onCourt = true;
        log(period, clock, side, `Substitution: ${abbr(x.p)} in${outs[k] ? ` for ${abbr(outs[k].p)}` : ""}`);
      });
      onCourt[side] = target;
      return;
    }
    for (let i = 0; i < lineup.length; i++) {
      const s = lineup[i];
      const expected = s.target * frac;
      const tired = s.energy < 62;
      const over = s.secs > expected + (s.p.ovr >= 88 ? 300 : 150) && s.energy < 85;
      const foulTrouble = s.line.pf >= foulLimit;
      const garbage = blowout && s.starter;
      if (!(tired || over || foulTrouble || garbage)) continue;
      let candidates = available(side).filter((b) => b.energy > 70 && (garbage || b.target > 0 || tired || foulTrouble) && (b.line.pf < foulLimit || foulTrouble));
      if (!candidates.length) continue;
      // only players who can actually play this slot, unless nobody on the bench can
      const inPosition = candidates.filter((x) => fit(x, i) === 0);
      if (inPosition.length) candidates = inPosition;
      candidates.sort((a, b) => {
        const need = (x: SP) => (x.target * frac - x.secs) / 60 - fit(x, i) * 0.7 + (garbage ? (x.starter ? -20 : 5) : 0) + x.energy / 50;
        return need(b) - need(a);
      });
      const inn = candidates[0];
      if (!garbage && !tired && !foulTrouble && inn.target * frac - inn.secs < -120) continue;
      swap(side, i, inn, period, clock);
    }
    void total;
  };

  const swap = (side: number, idx: number, inn: SP, period: number, clock: number) => {
    const out = onCourt[side][idx];
    out.onCourt = false;
    inn.onCourt = true;
    onCourt[side][idx] = inn;
    log(period, clock, side, `Substitution: ${abbr(inn.p)} in for ${abbr(out.p)}`);
  };

  const forceOut = (s: SP, period: number, clock: number) => {
    const side = s.side;
    const idx = onCourt[side].indexOf(s);
    if (idx < 0) return;
    const bench = available(side).sort((a, b) => b.p.ovr + b.energy / 5 - fit(b, idx) - (a.p.ovr + a.energy / 5 - fit(a, idx)));
    if (bench.length) swap(side, idx, bench[0], period, clock);
    else {
      // play short-handed is not allowed: bring back a fouled-out player (NBA rule: stays in, technical)
      onCourt[side].splice(idx, 1);
      s.onCourt = false;
    }
  };

  // ---------- one possession ----------
  let possSide = rng.chance(0.5) ? 0 : 1;
  let elapsedTotal = 0;
  let period = 1;
  let fastBreak = false;
  let secondChance = false;

  const runPeriod = (len: number) => {
    let clock = len;
    teamFouls[0] = teamFouls[1] = 0;
    const startScore = [score[0], score[1]];
    let sinceSub = 0;
    while (clock > 0) {
      const off = possSide;
      const def = 1 - off;
      const clutchNow = period >= 4 && clock <= 300 && Math.abs(score[0] - score[1]) <= 5;
      let dur = clamp(rng.normal(fastBreak ? 7 : secondChance ? 9 : 13.9, 4), 3, 24);
      if (dur > clock) dur = clock;
      clock -= dur;
      elapsedTotal += dur;
      sinceSub += dur;
      for (const side of [0, 1]) {
        for (const s of onCourt[side]) {
          s.secs += dur;
          if (clutchNow) s.clutchSecs += dur;
          const stamina = s.p.ratings.stamina;
          s.energy = clamp(s.energy - dur * 0.052 * (1.45 - stamina / 110) * (o.allStar ? 0.6 : 1), 20, 100);
        }
        for (const s of roster[side]) if (!s.onCourt) s.energy = clamp(s.energy + dur * 0.09, 0, 100);
      }
      const O = onCourt[off];
      const D = onCourt[def];
      if (O.length === 0 || D.length === 0) break;
      const offMod = (sides[off].coach.offense - 50) * 0.00015 + (sides[off].chemistry - 50) * 0.0001 + (o.homeCourt && off === 0 ? 0.013 : 0);
      const dTeam = teamDef(def);
      const quality = (O.reduce((a, s) => a + impactOvr(s.p.ovr), 0) / O.length - D.reduce((a, s) => a + impactOvr(s.p.ovr), 0) / D.length) * IMPACT;

      // turnover
      const handler = pickWeighted(O, (s) => s.usageW * (0.5 + s.handle / 100));
      const tovP = clamp(0.126 * (handler.p.tendencies.tovRate / 0.12) ** 0.6 * (1 + (dTeam - 62) * 0.006) * (o.allStar ? 0.7 : 1), 0.05, 0.22);
      if (rng.chance(tovP)) {
        handler.line.tov++;
        const stealP = 0.64 * (D.reduce((a, s) => a + s.stlW, 0) / 0.08);
        if (rng.chance(clamp(stealP, 0.3, 0.7))) {
          const st = pickWeighted(D, (s) => s.stlW);
          st.line.stl++;
          log(period, clock, def, `${abbr(st.p)} steals the ball from ${abbr(handler.p)}`);
          fastBreak = true;
        } else {
          log(period, clock, off, `${abbr(handler.p)} turnover`);
          fastBreak = false;
        }
        secondChance = false;
        possSide = def;
        maybeInjury(O, D, dur, period, clock);
        if (sinceSub > 110) {
          substitute(0, elapsedTotal, period, clock);
          substitute(1, elapsedTotal, period, clock);
          sinceSub = 0;
        }
        continue;
      }

      // non-shooting foul -> bonus free throws
      if (rng.chance(0.105)) {
        const fouler = pickWeighted(D, (s) => s.p.tendencies.foulRate);
        commitFoul(fouler, period, clock);
        teamFouls[def]++;
        if (teamFouls[def] > 4 || (clock < 120 && teamFouls[def] > 1)) {
          const fouled = pickWeighted(O, (s) => s.usageW * (0.4 + s.p.tendencies.ftRate));
          shootFTs(fouled, 2, off, period, clock, clutchNow);
          fastBreak = secondChance = false;
          possSide = def;
          continue;
        }
        // side-out: possession continues with a reset clock (cheap approximation)
      }

      // shot
      const shooter = pickWeighted(O, (s) => s.usageW * (0.55 + s.energy / 220));
      const t = shooter.p.tendencies;
      const r3 = Math.min(0.9, t.threeRate * 1.12) * (fastBreak ? 0.6 : 1);
      const kind: "rim" | "mid" | "three" = rng.chance(r3) ? "three" : rng.chance(fastBreak ? 0.85 : t.rimRate) ? "rim" : "mid";
      const defender = pickWeighted(D, (s) => (posGroup(s) === posGroup(shooter) ? 3 : 1));
      const contest = kind === "rim" ? defender.intD * 0.6 + dTeam * 0.4 : defender.perD * 0.7 + dTeam * 0.3;
      const skill = kind === "rim" ? shooter.finish : kind === "mid" ? shooter.mid : shooter.three;
      let pMake = SHOT_BASE[kind] + (skill - (kind === "three" ? SK_PIVOT3 : SK_PIVOT2)) * (kind === "three" ? SK_SLOPE3 : SK_SLOPE2) - (contest - DEF_PIVOT) * DEF_SLOPE;
      pMake += offMod + quality;
      // game flow: leading teams ease off, trailing teams press (compresses margins like real games)
      pMake -= clamp(score[off] - score[def], -24, 24) * FLOW;
      pMake -= Math.max(0, 70 - shooter.energy) * 0.0022;
      if (fastBreak && kind === "rim") pMake += 0.08;
      if (secondChance && kind === "rim") pMake += 0.03;
      if (clutchNow) pMake += (shooter.clutchR - 70) * 0.0012;
      if (o.allStar) pMake += kind === "three" ? 0.02 : 0.1;
      pMake = clamp(pMake, 0.12, 0.88);

      const foulP = clamp(t.ftRate * (kind === "rim" ? 0.64 : kind === "mid" ? 0.21 : 0.05) * (o.allStar ? 0.2 : 1), 0, 0.45);
      const fouled = rng.chance(foulP);
      const made = rng.chance(fouled ? pMake * 0.32 : pMake);
      const pts = kind === "three" ? 3 : 2;
      const desc = kind === "three" ? `${rng.int(24, 29)}-foot three` : kind === "mid" ? `${rng.int(10, 21)}-foot jumper` : rng.chance(0.3 + (shooter.p.ratings.drivingDunk - 50) / 200) ? "dunk" : "layup";

      if (fouled) {
        const fouler = kind === "rim" ? pickWeighted(D, (s) => s.p.tendencies.foulRate * (1 + s.intD / 100)) : defender;
        commitFoul(fouler, period, clock);
        teamFouls[def]++;
      }
      if (made) {
        shooter.line.fga++;
        shooter.line.fgm++;
        if (kind === "three") {
          shooter.line.fg3a++;
          shooter.line.fg3m++;
        }
        const astP = kind === "three" ? 0.85 : kind === "mid" ? 0.55 : 0.57;
        let assister: SP | null = null;
        if (O.length > 1 && rng.chance(astP * (o.allStar ? 1.1 : 1))) {
          assister = pickWeighted(O.filter((s) => s !== shooter), (s) => s.p.tendencies.astRate * (0.6 + s.pass / 150));
          assister.line.ast++;
        }
        addPoints(off, pts, shooter, clutchNow);
        if (kind === "rim") extra[off].paint += 2;
        if (fastBreak) extra[off].fast += pts;
        if (secondChance) extra[off].second += pts;
        log(period, clock, off, `${abbr(shooter.p)} makes ${desc}${assister ? ` (${abbr(assister.p)} assists)` : ""}${fouled ? " and one" : ""}`);
        if (fouled) shootFTs(shooter, 1, off, period, clock, clutchNow);
        possSide = def;
        fastBreak = secondChance = false;
      } else if (fouled) {
        log(period, clock, def, `Shooting foul on ${abbr(shooter.p)}'s ${desc}`);
        const last = shootFTs(shooter, kind === "three" ? 3 : 2, off, period, clock, clutchNow);
        fastBreak = secondChance = false;
        if (!last) rebound(off, def, period, clock);
        else possSide = def;
      } else {
        shooter.line.fga++;
        if (kind === "three") shooter.line.fg3a++;
        let blocked = false;
        if (kind !== "three") {
          const blkP = clamp(D.reduce((a, s) => a + s.blkW, 0) * (kind === "rim" ? 4.2 : 1.5), 0, 0.3);
          if (rng.chance(blkP)) {
            const b = pickWeighted(D, (s) => s.blkW);
            b.line.blk++;
            blocked = true;
            log(period, clock, def, `${abbr(b.p)} blocks ${abbr(shooter.p)}'s ${desc}`);
          }
        }
        if (!blocked) log(period, clock, off, `${abbr(shooter.p)} misses ${desc}`);
        fastBreak = false;
        rebound(off, def, period, clock);
      }
      maybeInjury(O, D, dur, period, clock);
      if (sinceSub > 110) {
        substitute(0, elapsedTotal, period, clock);
        substitute(1, elapsedTotal, period, clock);
        sinceSub = 0;
      }
    }
    qScores[0].push(score[0] - startScore[0]);
    qScores[1].push(score[1] - startScore[1]);
  };

  function commitFoul(f: SP, per: number, clock: number) {
    f.line.pf++;
    if (f.line.pf >= 6 && !o.allStar) {
      f.fouledOut = true;
      log(per, clock, f.side, `${abbr(f.p)} fouls out`);
      forceOut(f, per, clock);
    }
  }

  /** returns true if the last free throw was made */
  function shootFTs(s: SP, n: number, side: number, per: number, clock: number, clutchNow: boolean): boolean {
    let last = false;
    let made = 0;
    for (let i = 0; i < n; i++) {
      s.line.fta++;
      const pressure = clutchNow ? (s.clutchR - 70) * 0.001 : 0;
      last = rng.chance(clamp(s.ftPct + pressure - Math.max(0, 60 - s.energy) * 0.001, 0.3, 0.97));
      if (last) {
        s.line.ftm++;
        made++;
        addPoints(side, 1, s, clutchNow);
      }
    }
    log(per, clock, side, `${abbr(s.p)} ${made}/${n} free throws`);
    return last;
  }

  function rebound(off: number, def: number, per: number, clock: number) {
    const O = onCourt[off];
    const D = onCourt[def];
    const oStr = O.reduce((a, s) => a + s.orebW, 0);
    const dStr = D.reduce((a, s) => a + s.drebW, 0);
    const pOff = clamp(0.216 * (oStr / 0.2) / Math.max(0.3, dStr / 0.72), 0.12, 0.42);
    if (rng.chance(0.06)) {
      // team rebound
      possSide = rng.chance(pOff) ? off : def;
      secondChance = possSide === off;
      return;
    }
    if (rng.chance(pOff)) {
      const r = pickWeighted(O, (s) => s.orebW);
      r.line.oreb++;
      log(per, clock, off, `${abbr(r.p)} offensive rebound`);
      possSide = off;
      secondChance = true;
    } else {
      const r = pickWeighted(D, (s) => s.drebW);
      r.line.dreb++;
      possSide = def;
      secondChance = false;
    }
  }

  function maybeInjury(O: SP[], D: SP[], dur: number, per: number, clock: number) {
    if (o.injuryRate <= 0 || o.allStar) return;
    for (const s of [...O, ...D]) {
      const p = 0.0000125 * dur * o.injuryRate * (1.6 - s.p.ratings.durability / 100) * (ageOn(s.p.dob, o.date) >= 33 ? 1.3 : 1);
      if (rng.chance(p)) {
        const inj = rollInjury(rng);
        s.injured = true;
        injuries.push({ playerId: s.p.id, type: inj.type, daysOut: inj.daysOut });
        log(per, clock, s.side, `${abbr(s.p)} leaves the game with a ${inj.type.toLowerCase()}`);
        forceOut(s, per, clock);
      }
    }
  }

  // ---------- play the game ----------
  for (period = 1; period <= 4; period++) {
    runPeriod(qLen);
    if (period < 4) {
      substitute(0, elapsedTotal, period + 1, qLen);
      substitute(1, elapsedTotal, period + 1, qLen);
      // quarter break rest
      for (const r of roster) for (const s of r) s.energy = clamp(s.energy + (period === 2 ? 25 : 8), 0, 100);
    }
  }
  while (score[0] === score[1]) {
    for (const r of roster) for (const s of r) s.energy = clamp(s.energy + 6, 0, 100);
    runPeriod(300);
    period++;
    if (period > 12) {
      // pathological safety valve
      score[rng.chance(0.5) ? 0 : 1]++;
    }
  }

  // ---------- assemble box ----------
  const toLines = (side: number): BoxLine[] =>
    roster[side].map((s) => ({
      playerId: s.p.id,
      name: s.p.name,
      starter: s.line.gs === 1,
      ...s.line,
      min: Math.round((s.secs / 60) * 10) / 10,
      dnp: s.secs === 0 ? "Coach's decision" : undefined,
    }));
  const lines = { home: toLines(0), away: toLines(1) };
  const sumT = (ls: BoxLine[]) => {
    const t: Record<string, number> = { fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, pts: 0 };
    for (const l of ls) for (const k of Object.keys(t)) t[k] += (l as unknown as Record<string, number>)[k];
    t.reb = t.oreb + t.dreb;
    return t;
  };
  const teamStats = { home: { ...sumT(lines.home), fastBreak: extra[0].fast, paint: extra[0].paint, secondChance: extra[0].second, bench: extra[0].bench, largestLead: extra[0].lead }, away: { ...sumT(lines.away), fastBreak: extra[1].fast, paint: extra[1].paint, secondChance: extra[1].second, bench: extra[1].bench, largestLead: extra[1].lead } };
  const top = (ls: BoxLine[]) => {
    const b = [...ls].sort((a, c) => c.pts + (c.oreb + c.dreb) * 0.5 + c.ast * 0.7 - (a.pts + (a.oreb + a.dreb) * 0.5 + a.ast * 0.7))[0];
    return { playerId: b.playerId, name: b.name, pts: b.pts, reb: b.oreb + b.dreb, ast: b.ast };
  };
  const box: BoxScore = {
    gameId: o.gameId,
    date: o.date,
    type: o.type,
    home: home.id,
    away: away.id,
    summary: {
      homeScore: score[0],
      awayScore: score[1],
      ot: Math.max(0, qScores[0].length - 4),
      quarters: { home: qScores[0], away: qScores[1] },
      topHome: top(lines.home),
      topAway: top(lines.away),
    },
    lines,
    teamStats,
    pbp: o.pbp ? pbp : undefined,
    injuries,
  };
  const playerSecs: Record<string, number> = {};
  const clutch: SimResult["clutch"] = {};
  for (const r of roster)
    for (const s of r) {
      playerSecs[s.p.id] = s.secs;
      if (s.clutchSecs > 0) clutch[s.p.id] = { pts: s.clutchPts, secs: s.clutchSecs, pm: s.clutchPm };
    }
  return { box, playerSecs, clutch };
}

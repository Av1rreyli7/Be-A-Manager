/**
 * The fight itself: one fixed step at 60 a second. Both corners send the same Input (the page writes the person's
 * from the keys, the AI writes the computer's), and the step moves the boxers, runs punches, slips, guards and
 * clinches, judges every punch at its moment of contact, keeps stamina, health, stun and cuts, runs knockdowns
 * and the count, stops fights, rings the bell and scores rounds. Everything lives in plain data (FightState).
 */
import { next } from "./rng";
import {
  BODY_K, BODY_R, COUNTER_BONUS, HEAD_K, STUN_K, COVER, DT, EVADE, HIGH_BODY_BONUS, HZ, LEAN, MIN_GAP, OPEN_BONUS, OPEN_FRAMES, PUNCH,
  RECOVER_BONUS, RING, ROLL_LEAN, TIER, handOf, rangeOf,
} from "./rules";
import { addStats, decisionResult, emptyStats, makeJudges, scoreRound } from "./scoring";
import { freshAI } from "./ai";
import type { Action, Evade, FState, FightConfig, FightEvent, FightState, FighterDef, GetUp, Input, PunchKind, Result, Side } from "./types";

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const fin = (v: number, d = 0) => (Number.isFinite(v) ? v : d);
const has = (d: FighterDef, t: string) => (d.traits as string[]).includes(t);

export function blankInput(): Input {
  return { mf: 0, ms: 0, sprint: false, punch: null, body: false, evade: null, guard: null, stance: false, clinch: false, tap: false, aimX: 0, aimY: 0 };
}

function freshFighter(def: FighterDef, x: number, z: number): FState {
  return {
    x, z, vx: 0, vz: 0,
    stance: def.stance, wantStance: false, guard: def.guard,
    headHP: 100, bodyHP: 100, stamina: 100, maxStam: 100, stun: 0, rocked: 0,
    action: null, buf: null, evBuf: null, last: null, combo: 0, spam: 0, evGap: 99,
    sprint: 0, sprintCd: 0, open: 0, overext: 0,
    cut: [0, 0], swell: [0, 0],
    kdRound: 0, kdFight: 0, clinchRound: 0, warnings: 0,
    lastLanded: -9999, hurtAt: -9999, unanswered: 0, idle: 0,
    hx: 0, hy: 0, hz: 0, tell: null, react: null, getup: null,
    rs: emptyStats(), fs: emptyStats(),
  };
}

/** where each corner stands when a round starts: red (0) toward its corner, blue (1) toward the other */
const START: [number, number][] = [[-0.8, -0.8], [0.8, 0.8]];

export function createFight(defs: [FighterDef, FighterDef], cfg: FightConfig, seed: number): FightState {
  const st: FightState = {
    v: 1, seed: seed >>> 0, rng: (seed >>> 0) || 1, frame: 0, cfg: { ...cfg }, defs: [defs[0], defs[1]],
    f: [freshFighter(defs[0], START[0][0], START[0][1]), freshFighter(defs[1], START[1][0], START[1][1])],
    ai: [freshAI(), freshAI()],
    phase: "pre", round: 1, clock: cfg.roundSec, pt: 0, kd: null,
    ref: { x: 0.9, z: -0.9, act: "watch", t: 0 },
    clinch: null, judges: [], cards: [[], [], []], rounds: [], result: null, ev: [], slow: 0, recover: null,
  };
  st.judges = makeJudges(st);
  return st;
}

function emit(st: FightState, e: FightEvent) {
  if (st.ev.length < 64) st.ev.push(e);
}

/** the bell: the round starts */
export function begin(st: FightState) {
  if (st.phase !== "pre") return;
  st.phase = "fight";
  st.pt = 0;
  emit(st, { type: "bell", who: 0, n: st.round, text: "start" });
}

/** out of the corner: the next round is set up (the page shows its card, then calls begin) */
export function nextRound(st: FightState) {
  if (st.phase !== "corner") return;
  st.round++;
  st.clock = st.cfg.roundSec;
  st.phase = "pre";
  st.pt = 0;
  for (let i = 0; i < 2; i++) {
    const f = st.f[i];
    f.x = START[i][0];
    f.z = START[i][1];
    f.vx = f.vz = 0;
    f.action = null;
    f.react = null;
    f.buf = null;
    f.evBuf = null;
    f.hx = f.hy = f.hz = 0;
  }
  st.ref = { x: 0.9, z: -0.9, act: "watch", t: 0 };
}

// ------------------------------------------------------------------ geometry

function dist(st: FightState) {
  const a = st.f[0], b = st.f[1];
  return Math.hypot(b.x - a.x, b.z - a.z);
}
/** the unit vector from boxer i toward the other one */
function toward(st: FightState, i: number): [number, number] {
  const a = st.f[i], b = st.f[1 - i];
  const dx = b.x - a.x, dz = b.z - a.z;
  const d = Math.hypot(dx, dz) || 1;
  return [dx / d, dz / d];
}
/** a boxer's lead side */
const leadOf = (f: FState): Side => (f.stance === "orthodox" ? "L" : "R");

// ------------------------------------------------------------------ derived numbers

function speedMul(def: FighterDef) {
  return 1 + (70 - def.attrs.speed) / 100 * 0.9;
}
function powerMul(def: FighterDef) {
  return 0.55 + def.attrs.power / 100 * 0.9;
}

// ------------------------------------------------------------------ starting things

function canAct(f: FState) {
  return !f.action || f.action.type === "punch" || f.action.type === "evade";
}

/** can a punch with this hand start now: free, or flowing out of the other hand's recovery */
function punchReady(st: FightState, i: number, kind: PunchKind): "go" | "flow" | "wait" | "no" {
  const f = st.f[i];
  const a = f.action;
  if (!a) return "go";
  // slip and counter: a punch can come out of the second half of a slip, duck or roll
  if (a.type === "evade" && a.t >= (a.w0! + a.w1!) / 2) return "go";
  if (a.type !== "punch") return a.type === "evade" || a.type === "stance" || a.type === "hitstun" ? "wait" : "no";
  const end = a.startup! + a.active!;
  if (a.t < end) return "wait";
  const hand = handOf(kind, f.stance), was = handOf(a.kind!, f.stance);
  if (hand !== was && a.t >= end + a.cancelAt!) return "flow";
  // a double jab comes back a little early
  if (kind === "jab" && a.kind === "jab" && a.t >= end + Math.round(a.recovery! * 0.7)) return "flow";
  return "wait";
}

function startPunch(st: FightState, i: number, kind: PunchKind, body: boolean, flow: boolean) {
  const f = st.f[i], def = st.defs[i], spec = PUNCH[kind];
  const hand = handOf(kind, f.stance);
  // combinations: a punch with the other hand straight after the last one keeps the combination going
  const recent = f.last && st.frame - f.last.end <= 21;
  if (flow || (recent && f.last!.hand !== hand) || (recent && kind === "jab" && f.last!.kind === "jab")) f.combo = Math.min(4, f.combo + 1);
  else f.combo = 0;
  // spamming: every punch adds a little, the same punch again adds more
  const same = (f.action?.type === "punch" && f.action.kind === kind) || (recent && f.last!.kind === kind);
  f.spam = clamp(f.spam + 0.1 + (same ? 0.09 : 0), 0, 1);
  let mul = speedMul(def) * (1 + f.spam * 0.5);
  if (f.stamina < 30) mul *= 1 + (30 - f.stamina) / 30 * 0.35;
  const weary = f.stamina < spec.cost;
  if (weary) mul *= 1.4;
  if (f.rocked > 0) mul *= 1.2;
  let startup = spec.startup * mul * (flow ? 0.85 : 1) * (has(def, "hands") ? 0.92 : 1);
  if (kind === "jab" && has(def, "jab")) startup -= 1;
  const recovery = spec.recovery * mul + f.overext;
  f.overext = 0;
  const cost = spec.cost * (1.25 - def.attrs.stamina / 100 * 0.5) * (has(def, "engine") ? 0.82 : 1) * (1 + f.spam * 0.3);
  f.stamina = Math.max(0, f.stamina - cost);
  const pw = (0.6 + 0.4 * Math.pow(clamp(f.stamina, 0, 100) / 100, 0.7)) * (1 - 0.35 * f.spam) * (weary ? 0.6 : 1);
  const act: Action = {
    type: "punch", t: 0, dur: 0, kind, target: body ? "body" : "head",
    startup: Math.max(3, Math.round(startup)), active: spec.active, recovery: Math.max(4, Math.round(recovery)),
    done: false, size: pw,
  };
  act.cancelAt = Math.round(act.recovery! * (has(def, "hands") ? 0.3 : 0.4));
  f.action = act;
  f.idle = 0;
  f.rs.thrown++;
  if (kind === "jab") f.rs.jabsThrown++;
  else f.rs.powerThrown++;
  emit(st, { type: "punch", who: i as 0 | 1, kind, target: act.target, n: f.combo });
}

function startEvade(st: FightState, i: number, ev: Evade) {
  const f = st.f[i], def = st.defs[i];
  if (ev === "back" && f.guard === "philly") ev = "roll";
  if (ev === "roll" && f.guard !== "philly") ev = "back";
  const spec = EVADE[ev];
  const quick = f.evGap < 8; // a second slip straight after the first is weaker
  const durK = 1.1 - def.attrs.speed / 100 * 0.2;
  let span = (spec.w1 - spec.w0) * (has(def, "peek") && ev !== "back" && ev !== "roll" ? 1.35 : 1) * (has(def, "shell") && ev === "roll" ? 1.5 : 1);
  span += def.attrs.defense / 100 * 4;
  span *= 0.7 + 0.3 * Math.min(1, f.stamina / 40);
  if (quick) span *= 0.6;
  if (f.rocked > 0) span *= 0.7;
  const w0 = spec.w0, w1 = Math.round(w0 + span);
  const dur = Math.max(w1 + 5, Math.round(spec.dur * durK));
  f.action = { type: "evade", t: 0, dur, ev, w0, w1, wp: Math.min(w1, Math.round(spec.wp + (has(def, "peek") ? 2 : 0))) };
  f.stamina = Math.max(0, f.stamina - spec.cost);
  f.idle = 0;
}

function tryClinch(st: FightState, i: number) {
  const f = st.f[i], o = st.f[1 - i];
  if (st.clinch || dist(st) > 0.95 || (f.action && f.action.type !== "evade") || o.action?.type === "down") return;
  // easy against a boxer who is throwing, harder against one who is set
  let p = o.action?.type === "punch" ? 0.88 : 0.55 + (st.defs[i].attrs.power - st.defs[1 - i].attrs.power) / 300;
  if (o.rocked > 0) p += 0.15;
  if (next(st) < p) {
    st.clinch = { t: 0, breakAt: Math.round(HZ * (2 + next(st) * 1.2)), sep: 0 };
    f.action = { type: "clinch", t: 0, dur: 0 };
    o.action = { type: "clinch", t: 0, dur: 0 };
    f.buf = o.buf = null;
    f.rs.clinches++;
    f.clinchRound++;
    emit(st, { type: "clinch", who: i as 0 | 1 });
    // holding: a warning on the fourth clinch in a round, a point from the sixth
    if (f.clinchRound === 4) {
      f.warnings++;
      emit(st, { type: "warn", who: i as 0 | 1, text: "holding" });
    } else if (f.clinchRound >= 6) {
      f.rs.deducted++;
      emit(st, { type: "deduct", who: i as 0 | 1, text: "holding" });
    }
  } else {
    // a missed grab leaves him open for a moment
    f.action = { type: "hitstun", t: 0, dur: 12, dir: 0, size: 0 };
    f.stamina = Math.max(0, f.stamina - 2);
    emit(st, { type: "clinch", who: i as 0 | 1, tag: "fail" });
  }
}

// ------------------------------------------------------------------ the moment of contact

function evadeState(f: FState): "full" | "part" | "none" {
  const a = f.action;
  if (!a || a.type !== "evade") return "none";
  if (a.t >= a.w0! && a.t < a.w1!) return "full";
  if (a.t < a.w0! || a.t < a.w1! + 4) return "part";
  return "none";
}

function resolve(st: FightState, ai: number) {
  const di = 1 - ai;
  const A = st.f[ai], D = st.f[di], dA = st.defs[ai], dD = st.defs[di];
  const act = A.action!;
  const kind = act.kind!, spec = PUNCH[kind];
  const body = act.target === "body";
  act.done = true;
  if (D.action?.type === "down" || D.action?.type === "getup" || st.phase !== "fight") return;
  // ---- range: the boxer's own reach, the punch's share of it, the other boxer's head pulled back
  const R = rangeOf(dA.reachIn) * spec.reach * (body ? 0.95 : 1) + (spec.path === "straight" ? 0.06 : 0.03);
  const dEff = dist(st) + (body ? D.hz * 0.4 : D.hz);
  if (dEff > R + 0.1) {
    emit(st, { type: "miss", who: ai as 0 | 1, kind, target: act.target, tag: dEff > R + 0.3 ? "short" : "lean" });
    // a big miss is tiring
    A.stamina = Math.max(0, A.stamina - spec.cost * 0.5);
    if (D.action?.type === "evade") D.rs.evaded++;
    return;
  }
  let q: number;
  let tag = "clean";
  if (dEff > R) {
    q = 0.35;
    tag = "glance";
  } else if (dEff < spec.jam * R) {
    q = 0.5;
    tag = "smothered";
  } else if (dEff < spec.sweet * R) q = 0.65 + 0.35 * (dEff - spec.jam * R) / ((spec.sweet - spec.jam) * R);
  else q = 1 - Math.max(0, (dEff - 0.9 * R) / (0.1 * R)) * 0.12;

  // ---- which side it lands on: a punch from the left hand lands on the other boxer's right
  const arrival: Side = handOf(kind, A.stance) === "L" ? "R" : "L";
  const zone = spec.path === "upper" ? "center" : arrival === leadOf(D) ? "lead" : "rear";
  let mul = 1;

  // ---- head movement
  const ev = D.action?.type === "evade" ? D.action.ev! : null;
  const es = evadeState(D);
  if (ev && es !== "none" && !body) {
    let evaded = false;
    let caught = 1;
    if (ev === "slipL" || ev === "slipR") {
      const toR = ev === "slipR";
      if (spec.path === "straight") evaded = true;
      else if (spec.path === "hook") {
        // slipping away from a hook works; slipping into it is worse than standing still
        const away = (arrival === "R" && !toR) || (arrival === "L" && toR);
        if (away) evaded = true;
        else caught = 1.25;
      } else mul *= es === "full" ? 0.5 : 0.75;
    } else if (ev === "duck") {
      if (spec.path === "upper") caught = 1.3;
      else evaded = true;
    } else if (ev === "roll") {
      if (zone === "lead") evaded = true;
    }
    if (evaded && es === "full") {
      const perfect = spec.power && D.action!.t < D.action!.wp!;
      emit(st, { type: "evade", who: di as 0 | 1, kind, tag: ev });
      D.rs.evaded++;
      if (perfect) {
        D.open = OPEN_FRAMES;
        A.overext = 10;
        emit(st, { type: "perfect", who: di as 0 | 1, kind, tag: ev });
        if (st.cfg.human && di === 0) st.slow = 1;
      }
      A.stamina = Math.max(0, A.stamina - spec.cost * 0.4);
      return;
    }
    if (evaded) {
      mul *= 0.5;
      tag = "glance";
    }
    mul *= caught;
    if (caught > 1) tag = "caught";
  }

  // ---- the guard
  let cover = 0;
  const da = D.action;
  const guarding = !da || da.type === "punch" || da.type === "evade" || da.type === "hitstun" || da.type === "stance";
  if (guarding) {
    cover = COVER[D.guard][body ? "body" : "head"][zone];
    if (D.guard === "philly" && zone === "lead" && !body && has(dD, "shell")) cover += 0.08;
    if (da?.type === "punch") {
      // the punching hand has left the guard: its side is open
      const out = handOf(da.kind!, D.stance);
      cover *= out === arrival || zone === "center" ? 0.15 : 0.85;
    }
    if (da?.type === "evade") cover *= 0.7;
    if (da?.type === "hitstun") cover *= 0.75;
    if (D.rocked > 0) cover *= 0.85;
    if (D.overext > 0) cover *= 0.6;
    if (D.stamina < 20) cover *= 0.75 + D.stamina / 80;
    // reflexes: a good defender parries or rides some punches without being told to
    if (da?.type !== "punch" && next(st) < dD.attrs.defense / 100 * 0.22) cover = Math.min(0.95, cover + 0.3);
    if (has(dD, "awkward")) cover += 0.05;
  }
  // a boxer moving across the punch is harder to hit square: straights slide off, hooks less so
  {
    const [ux, uz] = toward(st, ai);
    const lat = Math.abs(D.vx * -uz + D.vz * ux) + Math.max(0, D.vx * ux + D.vz * uz) * 0.5;
    if (next(st) < clamp(lat * (spec.path === "straight" ? 0.22 : 0.12), 0, 0.35)) {
      mul *= 0.5;
      if (tag === "clean") tag = "glance";
    }
  }
  // the computer's accuracy by tier, and the person's aim (looking well off to the side makes punches glance)
  if (st.cfg.human && ai === 1) cover += (1 - TIER[st.cfg.tier].accuracy) * 0.5;
  // the guard is a chance, not a wall: a punch either meets the gloves and arms or finds a gap
  if (st.cfg.human && ai === 0 && Math.abs(st.f[0].hx) < 1 && next(st) < Math.max(0, Math.abs(aimCache.x) - 0.55) * 0.6) {
    mul *= 0.5;
    tag = "glance";
  }
  const blockedRoll = cover > 0 && next(st) < clamp(cover, 0, 0.95);
  const absorb = blockedRoll ? (D.guard === "high" ? 0.9 : D.guard === "philly" && zone === "lead" ? 0.88 : 0.82) : next(st) < 0.3 ? 0.35 : 0;
  if (!blockedRoll && absorb > 0 && tag === "clean") tag = "glance";

  // ---- how hard
  let dmg = spec.dmg * powerMul(dA) * q * (act.size ?? 1) * mul;
  if (body && has(dA, "body")) dmg *= 1.22;
  if (spec.hand === "rear" && has(dA, "bomb")) dmg *= 1.18;
  if (kind === "lhook" && has(dA, "hook")) dmg *= 1.2;
  if (spec.path === "upper" && has(dA, "upper")) dmg *= 1.2;
  if (kind === "jab" && has(dA, "jab")) dmg *= 1.25;
  if (body && D.guard === "high") dmg *= HIGH_BODY_BONUS;
  let cmul = 1;
  if (da?.type === "punch" && da.t <= da.startup! + da.active!) {
    cmul = COUNTER_BONUS + (has(dA, "counter") ? 0.2 : 0);
    tag = "counter";
  } else if (da?.type === "punch") cmul = RECOVER_BONUS;
  if (A.open > 0) {
    cmul *= OPEN_BONUS;
    tag = "counter";
  }
  dmg *= Math.min(1.9, cmul);
  dmg *= 1 + 0.06 * Math.min(3, A.combo);
  dmg *= clamp(Math.pow(dA.weightKg / dD.weightKg, 0.3), 0.8, 1.3);
  dmg *= 0.88 + next(st) * 0.24;
  dmg = fin(dmg);
  const through = dmg * (1 - absorb);
  const blocked = blockedRoll;

  // ---- what it does
  const chin = dD.attrs.chin, cond = dD.attrs.stamina;
  if (body) {
    D.bodyHP = Math.max(0, D.bodyHP - through * BODY_K * (1.15 - cond / 100 * 0.3));
    D.stamina = Math.max(0, D.stamina - through * 0.9 * (has(dA, "body") ? 1.25 : 1));
    D.maxStam = Math.max(35, D.maxStam - through * 0.22);
    D.stun += through * 0.2 * (blocked ? 0.35 : 1);
  } else {
    D.headHP = Math.max(0, D.headHP - through * HEAD_K * (1.15 - chin / 100 * 0.3));
    const stunK = (1.55 - chin / 100) * (1 + (100 - D.headHP) / 100 * 0.7) * (has(dD, "iron") ? 0.75 : 1);
    D.stun += through * stunK * STUN_K * (blocked ? 0.35 : 1);
    D.stamina = Math.max(0, D.stamina - through * 0.25);
  }
  // holding the guard against a big shot costs stamina, a lot behind a high guard
  if (blocked) D.stamina = Math.max(0, D.stamina - spec.dmg * powerMul(dA) * COVER[D.guard].drain * absorb * 0.6);
  D.stun = fin(clamp(D.stun, 0, 120));

  if (blocked) {
    D.rs.blocked++;
    emit(st, { type: "block", who: ai as 0 | 1, kind, target: act.target, dmg: through, tag: D.guard });
    // a heavy blocked shot pushes the guard back for a moment
    if (!D.action && spec.dmg * powerMul(dA) >= 4.5) D.action = { type: "hitstun", t: 0, dur: 4, dir: 0, size: 0 };
  } else {
    A.rs.landed++;
    if (kind === "jab") A.rs.jabsLanded++;
    else A.rs.powerLanded++;
    if (body) A.rs.bodyLanded++;
    else A.rs.headLanded++;
    A.rs.damage += through;
    A.lastLanded = st.frame;
    A.unanswered = 0;
    if (!body) {
      D.unanswered++;
      D.hurtAt = st.frame;
    }
    emit(st, { type: "hit", who: ai as 0 | 1, kind, target: act.target, dmg: through, tag });
    // the head snaps away from the punch, the body folds
    const dir = body ? 2 : spec.path === "upper" ? 3 : spec.path === "straight" ? 0 : arrival === "R" ? -1 : 1;
    if (through >= 1) D.react = { t: 18, dir, size: Math.min(1.5, through / 6.5), body };
    // a real shot knocks him out of what he was doing
    if (through >= 2.5 && D.action?.type !== "clinch" && (!D.action || D.action.type === "evade" || (D.action.type === "punch" && D.action.t < D.action.startup!))) {
      D.action = { type: "hitstun", t: 0, dur: Math.round(Math.min(22, 5 + through * 1.3) * (has(dD, "iron") ? 0.7 : 1)), dir, size: through };
      D.tell = null;
    }
    if (!body) {
      // swelling under the eye on that side (jabs swell eyes), cuts over it from the big shots
      const sIdx = arrival === "L" ? 0 : 1;
      D.swell[sIdx] = clamp(D.swell[sIdx] + through * (kind === "jab" ? 0.9 : 0.55), 0, 100);
      if (D.cut[sIdx] > 0) D.cut[sIdx] = clamp(D.cut[sIdx] + through * (through > 4.5 ? 0.4 : 0.15), 0, 100);
      else if (spec.path !== "upper" && kind !== "jab" && through > 4.5) {
        if (next(st) < (through - 4.5) * 0.016 * (1.2 - chin / 200)) {
          D.cut[sIdx] = 10 + through * 1.1;
          emit(st, { type: "cut", who: di as 0 | 1, n: sIdx });
        }
      }
    }
  }
  // rocked
  if (D.stun > 34 && D.rocked <= 0) {
    D.rocked = 1.8 + D.stun / 40;
    emit(st, { type: "rocked", who: di as 0 | 1 });
  }
  // ---- knockdowns
  if (!blocked) {
    let down = false;
    if (!body) {
      // a big clean shot on a hurt boxer: the lower his health and the more rocked he is, the less it takes
      let thr = 4 + chin * 0.06 + D.headHP * 0.07 - (D.rocked > 0 ? 2.5 : 0);
      if (tag === "counter") thr -= 1.5;
      if (has(dD, "iron")) thr += 2;
      if (D.headHP <= 0 || D.stun >= 72) down = true;
      else if (next(st) < clamp((through - thr + 2) / 6, 0, 0.8)) down = true;
    } else if (D.bodyHP < 25 && through > 5 && next(st) < (25 - D.bodyHP) / 100 * through / 10) down = true;
    if (down) knockDown(st, di, body ? "body" : "head");
  }
}

// a small cache of the person's aim, set from the input each step (kept off the saved state on purpose)
const aimCache = { x: 0, y: 0 };

// ------------------------------------------------------------------ knockdowns

function makeGetUp(st: FightState, f: FState, def: FighterDef): GetUp {
  const hurt = clamp((100 - f.headHP) / 100 + f.kdFight * 0.12 + f.stun / 200, 0, 1.2);
  const need = clamp(Math.round(3 + (f.kdFight - 1) + hurt * 2.5 - (has(def, "heart") ? 1 : 0)), 3, 8);
  return {
    need, hits: 0, misses: 0, beat: 0.6, win: Math.max(0.07, 0.15 - hurt * 0.05), first: 1.3, lastBeat: -1,
    balance: f.headHP < 35 || f.kdRound >= 2, needle: 0, needleV: 0, held: 0, stage: "rhythm", rose: -1,
  };
}

function endFight(st: FightState, r: Result) {
  st.result = r;
  st.phase = "over";
  st.kd = null;
  st.clinch = null;
  // the round in progress counts toward the fight totals
  for (const f of st.f) addStats(f.fs, f.rs);
  for (const f of st.f) if (f.action?.type !== "down") f.action = null;
  st.ref.act = "raise";
  emit(st, { type: "end", who: (r.winner ?? 0) as 0 | 1, text: r.method });
}

function elapsed(st: FightState) {
  return Math.max(0, Math.round(st.cfg.roundSec - st.clock));
}

function stoppage(st: FightState, winner: 0 | 1, how: string, method: "KO" | "TKO" = "TKO") {
  endFight(st, { winner, method, detail: how, how: method + ", " + how, round: st.round, time: elapsed(st), totals: [] });
}

function knockDown(st: FightState, di: number, cause: string) {
  const D = st.f[di], A = st.f[1 - di];
  D.kdRound++;
  D.kdFight++;
  D.rs.kd++;
  emit(st, { type: "kd", who: di as 0 | 1, tag: cause, n: D.kdFight });
  if (D.kdRound >= 3) {
    D.action = { type: "down", t: 0, dur: 0 };
    stoppage(st, (1 - di) as 0 | 1, "three knockdowns in the round");
    return;
  }
  st.phase = "kd";
  st.kd = { who: di as 0 | 1, t: 0, count: 0, stage: "count", rise: 0 };
  st.clinch = null;
  D.action = { type: "down", t: 0, dur: 0, dir: D.react?.dir ?? 0 };
  D.react = null;
  D.tell = A.tell = null;
  D.buf = D.evBuf = null;
  A.action = null;
  A.buf = A.evBuf = null;
  D.hx = D.hy = D.hz = 0;
  D.getup = st.cfg.human && di === 0 ? makeGetUp(st, D, st.defs[di]) : null;
  st.ai[di].riseAt = aiRise(st, di);
}

/** when the computer's boxer gets up (seconds after the fall), or -1 to stay down */
function aiRise(st: FightState, di: number): number {
  const f = st.f[di], def = st.defs[di];
  const tierBonus = st.cfg.human && di === 1 ? TIER[st.cfg.tier].getup : 8;
  const will = f.headHP * 0.6 + def.attrs.chin * 0.2 + (has(def, "heart") ? 12 : 0) - (f.kdFight - 1) * 12 - f.stun * 0.15 + tierBonus;
  if (will < 6 + next(st) * 18) return -1;
  return clamp(3.2 + (70 - will) / 9 + next(st) * 2, 2.2, 9.2);
}

const NEUTRAL: [number, number][] = [[-RING + 0.6, RING - 0.6], [RING - 0.6, -RING + 0.6]];

function stepKD(st: FightState, inputs: [Input, Input]) {
  const kd = st.kd!;
  const D = st.f[kd.who], A = st.f[1 - kd.who];
  kd.t += DT;
  st.clock = Math.max(0, st.clock - DT);
  // the count: one a second, starting a second after the fall
  const count = kd.stage === "count" ? Math.min(10, Math.floor(kd.t)) : kd.count;
  if (count > kd.count) {
    kd.count = count;
    emit(st, { type: "count", who: kd.who, n: count });
  }
  if (D.action) D.action.t++;
  // the standing boxer walks to the farther neutral corner
  const nc = NEUTRAL[Math.hypot(NEUTRAL[0][0] - D.x, NEUTRAL[0][1] - D.z) > Math.hypot(NEUTRAL[1][0] - D.x, NEUTRAL[1][1] - D.z) ? 0 : 1];
  const dx = nc[0] - A.x, dz = nc[1] - A.z, dd = Math.hypot(dx, dz);
  const sp = Math.min(1.5, dd * 2);
  A.vx = dd > 0.05 ? (dx / dd) * sp : 0;
  A.vz = dd > 0.05 ? (dz / dd) * sp : 0;
  A.x += A.vx * DT;
  A.z += A.vz * DT;
  A.stamina = Math.min(A.maxStam, A.stamina + 4 * DT);
  // the referee stands over the boxer who is down, a long step away, between him and the middle of the ring
  {
    const cl = Math.hypot(D.x, D.z);
    const ux = cl > 0.3 ? -D.x / cl : -(A.x - D.x) / (Math.hypot(A.x - D.x, A.z - D.z) || 1), uz = cl > 0.3 ? -D.z / cl : -(A.z - D.z) / (Math.hypot(A.x - D.x, A.z - D.z) || 1);
    moveRef(st, clamp(D.x + ux * 1.15, -RING + 0.4, RING - 0.4), clamp(D.z + uz * 1.15, -RING + 0.4, RING - 0.4), "count");
  }

  if (kd.stage === "count") {
    if (D.getup) stepGetUp(st, D, inputs[kd.who]);
    else if (st.ai[kd.who].riseAt >= 0 && kd.t >= st.ai[kd.who].riseAt) startRise(st, kd.who);
    if (kd.stage === "count" && kd.count >= 10) {
      stoppage(st, (1 - kd.who) as 0 | 1, "counted out", "KO");
      return;
    }
  } else if (kd.stage === "rising") {
    kd.rise += DT;
    if (kd.rise >= 1.2) {
      kd.stage = "check";
      kd.rise = 0;
      D.action = null;
      if (D.getup && D.getup.balance) D.getup.stage = "balance";
      else if (D.getup) D.getup.stage = "done";
      emit(st, { type: "rise", who: kd.who });
    }
  } else if (kd.stage === "check") {
    kd.rise += DT;
    st.ref.act = "check";
    const g = D.getup;
    if (g && g.stage === "balance") stepBalance(st, g, inputs[kd.who]);
    const checkLen = g && g.balance ? 2.8 : 1.0;
    const balanceDone = !g || g.stage === "done" || g.stage === "failed";
    if ((kd.rise >= checkLen || (g?.balance && balanceDone && kd.rise >= 0.6)) && kd.t >= 8) {
      // the referee looks him in the eyes: still out on his feet and he waves it off
      const wave = D.headHP < 14 && next(st) < 0.25 + (14 - D.headHP) / 14 * 0.6;
      if (wave || (g && g.stage !== "done")) {
        stoppage(st, (1 - kd.who) as 0 | 1, "the referee waved it off");
        return;
      }
      resume(st);
    }
  }
}

function startRise(st: FightState, who: number) {
  const kd = st.kd!;
  // too late: he cannot be up before ten
  if (kd.t > 9.4) return;
  kd.stage = "rising";
  kd.rise = 0;
  st.f[who].action = { type: "getup", t: 0, dur: 72 };
  if (st.f[who].getup) {
    st.f[who].getup!.stage = "rising";
    st.f[who].getup!.rose = kd.t;
  }
}

function stepGetUp(st: FightState, D: FState, inp: Input) {
  const g = D.getup!;
  const kd = st.kd!;
  if (g.stage !== "rhythm") return;
  if (inp.tap) {
    const t = kd.t;
    const k = Math.round((t - g.first) / g.beat);
    const on = k >= 0 && Math.abs(t - (g.first + k * g.beat)) <= g.win && k !== g.lastBeat;
    if (on) {
      g.hits++;
      g.lastBeat = k;
      emit(st, { type: "tap", who: kd.who, tag: "hit", n: g.hits });
    } else {
      g.misses++;
      g.hits = Math.max(0, g.hits - 1);
      emit(st, { type: "tap", who: kd.who, tag: "miss", n: g.hits });
    }
    if (g.hits >= g.need) startRise(st, kd.who);
  }
}

function stepBalance(st: FightState, g: GetUp, inp: Input) {
  const hurt = clamp(g.need / 8, 0.3, 1);
  g.needleV += (next(st) - 0.5) * 9 * hurt * DT + g.needle * 1.4 * DT;
  g.needleV *= 0.985;
  g.needle += (g.needleV + clamp(inp.ms, -1, 1) * 1.5) * DT;
  if (Math.abs(g.needle) >= 1) {
    g.needle = Math.sign(g.needle) * 0.98;
    g.needleV *= -0.3;
    g.held = Math.max(0, g.held - 0.3);
  }
  if (Math.abs(g.needle) < 0.28) g.held += DT;
  if (g.held >= 1) g.stage = "done";
}

function resume(st: FightState) {
  const kd = st.kd!;
  const D = st.f[kd.who], A = st.f[1 - kd.who], def = st.defs[kd.who];
  st.kd = null;
  st.phase = "fight";
  D.action = null;
  D.getup = null;
  D.stun = 12;
  D.rocked = 1.2;
  D.headHP = Math.min(100, D.headHP + 3 + def.attrs.chin * 0.05);
  D.stamina = Math.min(D.maxStam, D.stamina + 12);
  A.stamina = Math.min(A.maxStam, A.stamina + 6);
  // the boxer who was down comes back toward the middle; the other one comes out of the corner to meet him
  const cx = D.x * 0.5, cz = D.z * 0.5;
  D.x = cx;
  D.z = cz;
  const ang = Math.atan2(-cz, -cx);
  A.x = clamp(cx + Math.cos(ang) * 2, -RING + BODY_R, RING - BODY_R);
  A.z = clamp(cz + Math.sin(ang) * 2, -RING + BODY_R, RING - BODY_R);
  A.vx = A.vz = D.vx = D.vz = 0;
  st.ref.act = "watch";
  emit(st, { type: "resume", who: kd.who });
  if (st.clock <= 0) ringBell(st);
}

// ------------------------------------------------------------------ the referee

function moveRef(st: FightState, tx: number, tz: number, act: string) {
  const r = st.ref;
  const k = Math.min(1, DT * 2.2);
  r.x += (tx - r.x) * k;
  r.z += (tz - r.z) * k;
  r.act = act;
  r.t += DT;
}

function refWatch(st: FightState) {
  const a = st.f[0], b = st.f[1];
  const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
  const [ux, uz] = toward(st, 0);
  // off to the side of the fight, on the side with more room
  const px = -uz, pz = ux;
  const roomA = RING - Math.max(Math.abs(mx + px * 1.4), Math.abs(mz + pz * 1.4));
  const roomB = RING - Math.max(Math.abs(mx - px * 1.4), Math.abs(mz - pz * 1.4));
  const s = roomA >= roomB ? 1 : -1;
  // off to the side of the fight and a little toward corner 1, so he is in the picture, not in your face
  const [bx, bz] = toward(st, 0);
  const off = st.clinch ? 0.9 : 2.1;
  moveRef(st, clamp(mx + px * off * s + bx * 0.35, -RING + 0.4, RING - 0.4), clamp(mz + pz * off * s + bz * 0.35, -RING + 0.4, RING - 0.4), st.clinch ? "break" : "watch");
}

// ------------------------------------------------------------------ rounds

function ringBell(st: FightState) {
  st.phase = "bell";
  st.pt = 0;
  st.clinch = null;
  for (const f of st.f) {
    if (f.action && f.action.type !== "down") f.action = null;
    f.buf = f.evBuf = null;
  }
  emit(st, { type: "bell", who: 0, n: st.round, text: "end" });
}

function endRound(st: FightState) {
  const [a, b] = st.f;
  // the judges score the round
  for (let j = 0; j < st.judges.length; j++) st.cards[j].push(scoreRound(st.judges[j], a.rs, b.rs, st));
  st.rounds.push([{ ...a.rs }, { ...b.rs }]);
  emit(st, { type: "round", who: 0, n: st.round });
  const kdr = [a.kdRound, b.kdRound];
  for (const f of st.f) {
    addStats(f.fs, f.rs);
    f.rs = emptyStats();
    f.kdRound = 0;
    f.clinchRound = 0;
  }
  if (st.round >= st.cfg.rounds) {
    const r = decisionResult(st.cards, st.cfg.rounds, st.cfg.roundSec);
    st.result = r;
    st.phase = "over";
    st.ref.act = "raise";
    emit(st, { type: "end", who: (r.winner ?? 0) as 0 | 1, text: r.method });
    return;
  }
  // the doctor looks at a bad cut before the next round
  for (let i = 0; i < 2; i++) {
    if (Math.max(...st.f[i].cut) >= 90) {
      st.result = { winner: (1 - i) as 0 | 1, method: "TKO", detail: "the doctor stopped it on a cut", how: "TKO, the doctor stopped it on a cut", round: st.round, time: st.cfg.roundSec, totals: [] };
      st.phase = "over";
      st.ref.act = "raise";
      emit(st, { type: "end", who: (1 - i) as 0 | 1, text: "TKO" });
      return;
    }
  }
  // the corner: health and stamina partly back, by chin and condition; the cutman works on the cuts
  st.recover = [];
  for (let i = 0; i < 2; i++) {
    const f = st.f[i], d = st.defs[i].attrs;
    const before = { head: f.headHP, body: f.bodyHP, stam: f.stamina, cut: Math.max(...f.cut) };
    f.headHP = Math.min(100, f.headHP + (100 - f.headHP) * (0.25 + d.chin / 100 * 0.3) * (1 - 0.12 * kdr[i]));
    f.bodyHP = Math.min(100, f.bodyHP + (100 - f.bodyHP) * (0.22 + d.stamina / 100 * 0.28));
    f.maxStam = Math.min(100, f.maxStam + (100 - f.maxStam) * 0.18);
    f.stamina = Math.min(f.maxStam, f.stamina + (f.maxStam - f.stamina) * (0.55 + d.stamina / 100 * 0.35));
    f.cut = f.cut.map(c => (c > 0 ? Math.max(6, Math.min(c * 0.7, c - 12 - next(st) * 8)) : 0)) as [number, number];
    f.swell = f.swell.map(s => s * 0.82) as [number, number];
    f.stun = 0;
    f.rocked = 0;
    f.spam = 0;
    f.combo = 0;
    f.open = 0;
    f.overext = 0;
    f.unanswered = 0;
    f.action = null;
    f.react = null;
    st.recover.push({ head: [before.head, f.headHP], body: [before.body, f.bodyHP], stam: [before.stam, f.stamina], cut: [before.cut, Math.max(...f.cut)] });
  }
  st.phase = "corner";
  st.pt = 0;
}

// ------------------------------------------------------------------ one step

const FWD = 1.55, BACK = 1.4, SIDE = 1.35;

function stepFighter(st: FightState, i: number, inp: Input) {
  const f = st.f[i], def = st.defs[i];
  if (st.clinch) return;
  // ---- new actions
  if (inp.punch) f.buf = { kind: inp.punch, body: inp.body || (i === 0 && st.cfg.human && inp.aimY < -0.55), f: 9 };
  if (inp.evade) f.evBuf = { ev: inp.evade, f: 6 };
  if (inp.clinch) tryClinch(st, i);
  if (f.evBuf && (!f.action || (f.action.type === "punch" && f.action.t >= f.action.startup! + f.action.active! + f.action.cancelAt!))) {
    // an evade wins over a waiting punch: defence first
    startEvade(st, i, f.evBuf.ev);
    f.evBuf = null;
    f.buf = null;
  } else if (f.wantStance && (!f.action || (f.action.type === "punch" && f.action.t >= f.action.startup! + f.action.active! + f.action.cancelAt!) || (f.action.type === "evade" && f.action.t >= f.action.w1!))) {
    // a stance switch asked for goes before the next punch
    f.action = { type: "stance", t: 0, dur: 18 };
    f.wantStance = false;
  } else if (f.buf) {
    const r = punchReady(st, i, f.buf.kind);
    if (r === "go" || r === "flow") {
      startPunch(st, i, f.buf.kind, f.buf.body, r === "flow");
      f.buf = null;
    } else if (r === "no") f.buf = null;
  }
  if (inp.sprint && f.sprintCd <= 0 && f.stamina > 6 && (!f.action || f.action.type === "evade")) {
    f.sprint = 0.35;
    f.sprintCd = 1.2;
    f.stamina -= 6;
  }
  // ---- the action clock
  const a = f.action;
  if (a) {
    a.t++;
    if (a.type === "punch") {
      if (a.t === a.startup && !a.done) resolve(st, i);
      if (f.action === a && a.t >= a.startup! + a.active! + a.recovery!) {
        f.last = { kind: a.kind!, hand: handOf(a.kind!, f.stance), end: st.frame };
        f.action = null;
      }
    } else if (a.type === "evade") {
      if (a.t >= a.dur) {
        f.action = null;
        f.evGap = 0;
      }
    } else if (a.type === "stance") {
      if (a.t >= a.dur) {
        f.stance = f.stance === "orthodox" ? "southpaw" : "orthodox";
        f.action = null;
        emit(st, { type: "stance", who: i as 0 | 1, tag: f.stance });
      }
    } else if (a.type === "hitstun") {
      if (a.t >= a.dur) f.action = null;
    }
  }
  f.evGap = Math.min(99, f.evGap + 1);
  if (f.buf && --f.buf.f <= 0) f.buf = null;
  if (f.evBuf && --f.evBuf.f <= 0) f.evBuf = null;

  // ---- head offset from evading
  const ac = f.action;
  let hx = 0, hy = 0, hz = 0;
  if (ac?.type === "evade") {
    const t = ac.t, up = ac.w0! + 2;
    const e = t < up ? t / up : t < ac.w1! ? 1 : Math.max(0, 1 - (t - ac.w1!) / Math.max(1, ac.dur - ac.w1!));
    if (ac.ev === "slipL") { hx = -0.22 * e; hy = -0.07 * e; }
    else if (ac.ev === "slipR") { hx = 0.22 * e; hy = -0.07 * e; }
    else if (ac.ev === "duck") { hy = -0.3 * e; hz = -0.04 * e; }
    else if (ac.ev === "back") { hz = LEAN * e; hy = -0.02 * e; }
    else if (ac.ev === "roll") { hz = ROLL_LEAN * e; hx = (leadOf(f) === "L" ? 0.08 : -0.08) * e; hy = -0.04 * e; }
  }
  f.hx = hx;
  f.hy = hy;
  f.hz = hz;

  // ---- feet
  const [ux, uz] = toward(st, i);
  const rx = -uz, rz = ux;
  let mf = clamp(fin(inp.mf), -1, 1), ms = clamp(fin(inp.ms), -1, 1);
  const mag = Math.hypot(mf, ms);
  if (mag > 1) { mf /= mag; ms /= mag; }
  let sp = (0.78 + def.attrs.speed / 100 * 0.42) * (0.65 + 0.35 * Math.min(1, f.stamina / 100)) * (has(def, "dancer") ? 1.14 : 1);
  if (f.rocked > 0) sp *= 0.6;
  if (f.bodyHP < 40) sp *= 0.8 + f.bodyHP / 200;
  if (ac?.type === "punch") sp *= 0.35;
  else if (ac?.type === "evade") sp *= 0.25;
  else if (ac?.type === "stance" || ac?.type === "hitstun") sp *= 0.3;
  if (f.sprint > 0) {
    sp *= 2.1;
    if (mag < 0.1) mf = 1;
  }
  let lf = mf * (mf >= 0 ? FWD : BACK) * sp, ls = ms * SIDE * sp;
  // rocked legs wander
  if (f.rocked > 0) {
    lf += (next(st) - 0.5) * 0.9;
    ls += (next(st) - 0.5) * 0.9;
  }
  const tvx = ux * lf + rx * ls, tvz = uz * lf + rz * ls;
  const k = Math.min(1, 14 * DT);
  f.vx += (tvx - f.vx) * k;
  f.vz += (tvz - f.vz) * k;
  f.x += f.vx * DT;
  f.z += f.vz * DT;
  const lim = RING - BODY_R;
  if (Math.abs(f.x) > lim) { f.x = Math.sign(f.x) * lim; f.vx = 0; }
  if (Math.abs(f.z) > lim) { f.z = Math.sign(f.z) * lim; f.vz = 0; }
  f.sprint = Math.max(0, f.sprint - DT);
  f.sprintCd = Math.max(0, f.sprintCd - DT);

  // ---- stamina, stun and the rest of the clocks
  const moving = Math.hypot(f.vx, f.vz);
  f.idle += DT;
  let regen = 3.4 * (0.6 + def.attrs.stamina / 100 * 0.8) * (has(def, "engine") ? 1.15 : 1) * (0.5 + 0.5 * f.bodyHP / 100);
  if (ac?.type === "punch" || f.idle < 0.5) regen = 0;
  else if (moving > 1) regen *= has(def, "dancer") ? 0.85 : 0.55;
  if (f.sprint > 0) regen = 0;
  f.stamina = clamp(fin(f.stamina + regen * DT, 50), 0, f.maxStam);
  f.maxStam = Math.max(35, f.maxStam - (1 - def.attrs.stamina / 200) / 60 * DT);
  const away = mf < -0.3 ? 1.3 : 1;
  f.stun = Math.max(0, f.stun - 5.5 * away * DT);
  if (f.rocked > 0 && f.stun < 25) f.rocked = Math.max(0, f.rocked - DT);
  f.spam = Math.max(0, f.spam - (ac?.type === "punch" ? 0.12 : 0.3) * DT);
  if (f.combo > 0 && !ac && f.last && st.frame - f.last.end > 21) f.combo = 0;
  if (f.open > 0) f.open--;
  if (f.react && --f.react.t <= 0) f.react = null;
  if (st.frame - f.hurtAt > 300) f.unanswered = 0;
}

export function step(st: FightState, inputs: [Input, Input]) {
  st.ev.length = 0;
  st.frame++;
  if (inputs[0]) {
    aimCache.x = fin(inputs[0].aimX);
    aimCache.y = fin(inputs[0].aimY);
  }
  // guard and stance keys land in every phase, so a key never sticks: a guard at once, a stance switch as soon
  // as the boxer is free (straight away between rounds)
  for (let i = 0; i < 2; i++) {
    const f = st.f[i];
    const g = inputs[i]?.guard;
    if (g && g !== f.guard) {
      f.guard = g;
      emit(st, { type: "guard", who: i as 0 | 1, tag: g });
    }
    if (inputs[i]?.stance) f.wantStance = !f.wantStance;
    if (f.wantStance && (st.phase === "pre" || st.phase === "corner" || st.phase === "bell")) {
      f.wantStance = false;
      f.stance = f.stance === "orthodox" ? "southpaw" : "orthodox";
      emit(st, { type: "stance", who: i as 0 | 1, tag: f.stance });
    }
  }
  if (st.phase === "pre" || st.phase === "corner" || st.phase === "over") {
    st.pt += DT;
    return;
  }
  if (st.phase === "bell") {
    st.pt += DT;
    moveRef(st, 0, 0, "break");
    if (st.pt >= 1.4) endRound(st);
    return;
  }
  if (st.phase === "kd") {
    stepKD(st, inputs);
    return;
  }
  // ---- the fight
  if (st.clinch) {
    const c = st.clinch;
    c.t++;
    const a = st.f[0], b = st.f[1];
    for (const f of st.f) {
      f.stamina = Math.min(f.maxStam, f.stamina + 5 * DT);
      f.stun = Math.max(0, f.stun - 9 * DT);
      if (f.rocked > 0 && f.stun < 25) f.rocked = Math.max(0, f.rocked - DT);
      f.hx = f.hy = f.hz = 0;
    }
    for (let i = 0; i < 2; i++) stepFighter(st, i, inputs[i]);
    const [ux, uz] = toward(st, 0);
    const d = dist(st);
    if (c.t < c.breakAt) {
      // locked together
      const want = 0.5;
      const fix = (d - want) / 2;
      a.x += ux * fix; a.z += uz * fix;
      b.x -= ux * fix; b.z -= uz * fix;
    } else {
      // the referee pulls them apart
      c.sep++;
      const want = 1.15;
      const fix = Math.min(0.03, Math.max(0, (want - d) / 2));
      a.x -= ux * fix; a.z -= uz * fix;
      b.x += ux * fix; b.z += uz * fix;
      if (d >= want - 0.02 || c.sep > 40) {
        st.clinch = null;
        for (const f of st.f) if (f.action?.type === "clinch") f.action = null;
        emit(st, { type: "break", who: 0 });
      }
    }
    const lim = RING - BODY_R;
    for (const f of st.f) {
      f.x = clamp(f.x, -lim, lim);
      f.z = clamp(f.z, -lim, lim);
      f.vx = f.vz = 0;
    }
  } else {
    // contacts this frame are judged from the same moment, so two punches can cross
    for (let i = 0; i < 2; i++) {
      if (st.phase !== "fight") break;
      stepFighter(st, i, inputs[i]);
    }
    if (st.phase !== "fight") return;
    // two bodies never overlap
    const a = st.f[0], b = st.f[1];
    const d = dist(st);
    if (d < MIN_GAP) {
      const [ux, uz] = toward(st, 0);
      const push = (MIN_GAP - d) / 2;
      a.x -= ux * push; a.z -= uz * push;
      b.x += ux * push; b.z += uz * push;
      const lim = RING - BODY_R;
      for (const f of st.f) {
        f.x = clamp(f.x, -lim, lim);
        f.z = clamp(f.z, -lim, lim);
      }
    }
    // judges see who comes forward and who is on the ropes
    for (let i = 0; i < 2; i++) {
      const f = st.f[i];
      const [ux, uz] = toward(st, i);
      if (f.vx * ux + f.vz * uz > 0.35 && d < 1.6) f.rs.forward += DT;
      const lim = RING - BODY_R - 0.25;
      if (Math.abs(f.x) > lim || Math.abs(f.z) > lim) f.rs.ropes += DT;
    }
    // the referee stops a beating: rocked, hurt and taking shot after shot without an answer
    if (st.frame % 30 === 0) {
      for (let i = 0; i < 2; i++) {
        const f = st.f[i];
        const beaten = (f.rocked > 0 && f.unanswered >= 5 && f.headHP < 50) || ((f.rocked > 0 || f.stun > 25) && f.headHP < 35 && f.unanswered >= 4);
        if (beaten && next(st) < 0.3) {
          stoppage(st, (1 - i) as 0 | 1, "the referee stopped it");
          return;
        }
        if (Math.max(...f.cut) >= 100) {
          stoppage(st, (1 - i) as 0 | 1, "the doctor stopped it on a cut");
          return;
        }
      }
    }
  }
  refWatch(st);
  st.clock -= DT;
  if (st.clock <= 0) {
    st.clock = 0;
    ringBell(st);
  }
}

// ------------------------------------------------------------------ saving

/** the fight as a string (the transient event list is left out) */
export function snapshot(st: FightState): string {
  const ev = st.ev;
  st.ev = [];
  try {
    return JSON.stringify(st);
  } finally {
    st.ev = ev;
  }
}

/** a saved fight back, or null when it is not a fight this version can carry on */
export function restore(json: string): FightState | null {
  try {
    const st = JSON.parse(json) as FightState;
    if (!st || st.v !== 1 || !Array.isArray(st.f) || st.f.length !== 2 || !Array.isArray(st.defs) || !st.cfg) return null;
    if (!validState(st)) return null;
    st.ev = [];
    st.slow = 0;
    return st;
  } catch {
    return null;
  }
}

/** every number a fight depends on is a real number in its range */
export function validState(st: FightState): boolean {
  const nums: number[] = [st.clock, st.round, st.frame, st.rng];
  for (const f of st.f) nums.push(f.x, f.z, f.vx, f.vz, f.headHP, f.bodyHP, f.stamina, f.maxStam, f.stun, f.rocked, f.spam, f.cut[0], f.cut[1], f.swell[0], f.swell[1]);
  if (!nums.every(Number.isFinite)) return false;
  for (const f of st.f) {
    if (f.headHP < 0 || f.headHP > 100 || f.bodyHP < 0 || f.bodyHP > 100 || f.stamina < 0 || f.stamina > 100.0001 || f.maxStam < 0 || f.maxStam > 100) return false;
    if (Math.abs(f.x) > RING || Math.abs(f.z) > RING) return false;
  }
  return st.round >= 1 && st.round <= st.cfg.rounds && ["pre", "fight", "kd", "bell", "corner", "over"].includes(st.phase);
}

export { dist as distance, toward };

/** for the headless battery: knock a boxer down as if by a punch, so the count and the get up can be checked */
export function testKnockDown(st: FightState, who: 0 | 1) {
  if (st.phase !== "fight") return;
  knockDown(st, who, "head");
}

/** for the headless battery and the screenshots: tie the two boxers up */
export function testClinch(st: FightState) {
  if (st.phase !== "fight" || st.clinch) return;
  const [a, b] = st.f;
  const [ux, uz] = toward(st, 0);
  b.x = a.x + ux * 0.7;
  b.z = a.z + uz * 0.7;
  a.action = b.action = null;
  st.clinch = { t: 0, breakAt: 150, sep: 0 };
  a.action = { type: "clinch", t: 0, dur: 0 };
  b.action = { type: "clinch", t: 0, dur: 0 };
  emit(st, { type: "clinch", who: 0 });
}

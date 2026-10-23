/**
 * The computer's corner. It writes the same Input a person does, so it can only do what a person can: walk, throw,
 * slip, switch guards, clinch. Each style wants its own distance and throws its own combinations; the tier sets
 * how fast it reacts, how often it defends, how well it times counters and how quickly it learns. Before the first
 * punch of a combination its shoulder loads (the tell), shorter at higher tiers, so a person can read it and slip.
 * It watches the other corner: a punch thrown over and over gets read, then timed and countered; a high guard gets
 * the body worked; a Philly shell gets lead hooks and uppercuts.
 */
import { next } from "./rng";
import { EVADE, PUNCH, RING, TIER, handOf, rangeOf } from "./rules";
import type { AIState, Evade, FightState, Input, PunchKind, Style, Target } from "./types";

type Combo = { k: PunchKind; b?: boolean }[];

const COMBOS: Record<Style, { long: Combo[]; close: Combo[] }> = {
  outboxer: {
    long: [[{ k: "jab" }], [{ k: "jab" }, { k: "jab" }], [{ k: "jab" }, { k: "cross" }], [{ k: "jab" }, { k: "cross" }, { k: "lhook" }], [{ k: "jab", b: true }], [{ k: "jab" }, { k: "jab" }, { k: "cross" }], [{ k: "jab" }]],
    close: [[{ k: "lhook" }, { k: "cross" }], [{ k: "lupper" }, { k: "cross" }], [{ k: "jab" }, { k: "lhook" }]],
  },
  pressure: {
    long: [[{ k: "jab" }, { k: "cross" }], [{ k: "jab" }, { k: "cross" }, { k: "lhook" }, { k: "rhook" }], [{ k: "cross" }, { k: "lhook" }]],
    close: [[{ k: "lhook" }, { k: "rhook" }], [{ k: "cross" }, { k: "lhook" }], [{ k: "lhook", b: true }, { k: "lhook" }], [{ k: "rupper" }, { k: "lhook" }], [{ k: "lupper" }, { k: "cross" }], [{ k: "lhook" }, { k: "rupper" }, { k: "lhook" }]],
  },
  counter: {
    long: [[{ k: "jab" }], [{ k: "jab", b: true }], [{ k: "cross" }]],
    close: [[{ k: "rupper" }, { k: "lhook" }], [{ k: "lhook" }], [{ k: "cross" }, { k: "lhook" }]],
  },
  body: {
    long: [[{ k: "jab", b: true }, { k: "cross", b: true }], [{ k: "jab" }, { k: "cross", b: true }], [{ k: "jab" }, { k: "jab", b: true }]],
    close: [[{ k: "lhook", b: true }, { k: "rhook", b: true }], [{ k: "rupper", b: true }, { k: "lhook" }], [{ k: "cross", b: true }, { k: "lhook" }], [{ k: "lhook", b: true }, { k: "lhook" }], [{ k: "lupper", b: true }, { k: "rhook" }]],
  },
};

/** the distance each style likes, as a share of its own range */
const WANT: Record<Style, number> = { outboxer: 1.06, pressure: 0.74, counter: 0.95, body: 0.78 };
/** the chance, at each look (about nine a second), that a boxer in range starts a combination */
const BUSY: Record<Style, number> = { outboxer: 0.024, pressure: 0.028, counter: 0.013, body: 0.026 };
const CIRCLE: Record<Style, number> = { outboxer: 0.75, pressure: 0.25, counter: 0.5, body: 0.3 };

export function freshAI(): AIState {
  return { plan: [], think: 20, seen: [], read: null, guardTime: { high: 0, philly: 0, normal: 0 }, slips: { L: 0, R: 0 }, seenPunch: -1, seenTell: -1, starts: [], lastSu: 8, react: null, circle: 1, riseAt: -1, moveF: 0, moveS: 0, moveT: 0 };
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** the tier this corner fights at: the chosen tier against a person, Champion for both in a computer fight */
function tierOf(st: FightState, i: number) {
  return (st.cfg.human ? (i === 1 ? st.cfg.tier : 2) : st.cfg.tier) as 0 | 1 | 2 | 3 | 4;
}

/** a punch it has seen coming (a tell or the punch itself): slip, duck, roll, lean or cover, then maybe counter */
function perceive(st: FightState, i: number, kind: PunchKind, target: Target, impact: number, out: Input) {
  const me = st.f[i], op = st.f[1 - i], def = st.defs[i], ai = st.ai[i];
  const T = TIER[tierOf(st, i)];
  const read = ai.read === kind;
  const awkward = (st.defs[1 - i].traits as string[]).includes("awkward");
  // a punch it has read is expected: it moves the moment it sees it start
  const reactF = read ? 0 : Math.round(T.react * 60 * (awkward ? 1.25 : 1));
  const busy = me.action && (me.action.type !== "punch" || me.action.t < me.action.startup!);
  let p = T.defend * (0.6 + def.attrs.defense / 100 * 0.6) + (read ? 0.3 : 0);
  if (me.rocked > 0) p *= 0.5;
  const spec = PUNCH[kind];
  const d = Math.hypot(op.x - me.x, op.z - me.z);
  const R0 = rangeOf(def.reachIn);
  if (busy || st.frame + reactF >= impact - 2) return;
  if (target === "head" && next(st) < p) {
    const arrival = handOf(kind, op.stance) === "L" ? "R" : "L";
    const myLead = me.stance === "orthodox" ? "L" : "R";
    let ev: Evade;
    if (me.guard === "philly" && arrival === myLead && spec.path !== "upper") ev = "back";
    else if (spec.path === "straight") ev = d > R0 * 0.95 && next(st) < 0.4 ? "back" : next(st) < 0.5 ? "slipL" : "slipR";
    else if (spec.path === "hook") ev = next(st) < 0.5 ? "duck" : arrival === "R" ? "slipL" : "slipR";
    else ev = next(st) < 0.6 ? "back" : next(st) < 0.5 ? "slipL" : "slipR";
    const w = EVADE[ev === "back" && me.guard === "philly" ? "roll" : ev];
    // press so the punch lands inside the full window: right at the start of it is the perfect read
    const lead = w.w0 + 1 + Math.floor(next(st) * Math.max(1, (w.wp - w.w0) * (0.6 + (1 - T.adapt))));
    const at = Math.max(st.frame + reactF, impact - lead);
    const cp = (def.style === "counter" ? 0.85 : 0.45 * T.aggression) * (0.5 + T.adapt * 0.5);
    let counter: PunchKind | null = null;
    // the counter that fits: over a straight with a cross, under a hook with an uppercut, off the roll with the right
    if (next(st) < cp) counter = ev === "duck" ? (next(st) < 0.5 ? "rupper" : "lhook") : spec.path === "straight" ? (next(st) < 0.7 ? "cross" : "lhook") : ev === "slipL" ? "rhook" : ev === "slipR" ? "lhook" : "cross";
    ai.react = { at, ev, counter, counterBody: def.style === "body" && next(st) < 0.5 };
  } else if (target === "body" && me.guard === "high" && next(st) < p) {
    out.guard = "normal";
  } else if (read && !me.action && next(st) < T.adapt * 0.6) {
    // a read punch can also be beaten to the punch: something straight down the middle as it comes
    ai.plan = [{ kind: kind === "jab" ? "cross" : "jab", body: false }];
    me.tell = null;
  }
}

export function aiInput(st: FightState, i: number, out: Input): Input {
  out.mf = 0; out.ms = 0; out.sprint = false; out.punch = null; out.body = false; out.evade = null; out.guard = null; out.stance = false; out.clinch = false; out.tap = false; out.aimX = 0; out.aimY = 0;
  const me = st.f[i], op = st.f[1 - i], def = st.defs[i], ai = st.ai[i];
  const T = TIER[tierOf(st, i)];

  // ---- the get up mini game, when the computer plays the person's corner (the page's autopilot)
  if (st.phase === "kd" && st.kd && st.kd.who === i && me.getup) {
    const g = me.getup;
    if (g.stage === "rhythm") {
      const t = st.kd.t;
      const k = Math.round((t - g.first) / g.beat);
      if (k >= 0 && k !== g.lastBeat && Math.abs(t - (g.first + k * g.beat)) < 0.02 && next(st) < 0.75 + T.adapt * 0.2) out.tap = true;
    } else if (g.stage === "balance") out.ms = clamp(-g.needle * 2.2 - g.needleV * 0.4, -1, 1);
    return out;
  }
  if (st.phase !== "fight" || st.clinch || me.action?.type === "down" || me.action?.type === "getup") {
    me.tell = null;
    ai.plan = [];
    ai.react = null;
    return out;
  }

  const R0 = rangeOf(def.reachIn);
  const dx = op.x - me.x, dz = op.z - me.z;
  const d = Math.hypot(dx, dz);
  const style = def.style;

  // ---- watching the other corner: its guard, its slips, its tells and its punches
  ai.guardTime.high *= 0.999;
  ai.guardTime.philly *= 0.999;
  ai.guardTime.normal *= 0.999;
  ai.guardTime[op.guard] += 1 / 60;
  if (op.action?.type === "evade" && op.action.t === 1) {
    if (op.action.ev === "slipL") ai.slips.L++;
    if (op.action.ev === "slipR") ai.slips.R++;
  }
  if (op.tell) {
    const start = st.frame - op.tell.t;
    if (start !== ai.seenTell) {
      ai.seenTell = start;
      const est = Math.round(PUNCH[op.tell.kind].startup * (1 + (70 - st.defs[1 - i].attrs.speed) / 100 * 0.9));
      perceive(st, i, op.tell.kind, op.tell.body ? "body" : "head", start + op.tell.dur + est, out);
    }
  }
  const oa = op.action;
  if (oa?.type === "punch") {
    const startF = st.frame - oa.t;
    if (startF !== ai.seenPunch) {
      ai.seenPunch = startF;
      ai.starts.push(startF);
      ai.lastSu = oa.startup!;
      if (ai.starts.length > 6) ai.starts.shift();
      ai.seen.push(oa.kind!);
      if (ai.seen.length > T.window) ai.seen.shift();
      // a punch thrown over and over gets read
      const counts: Partial<Record<PunchKind, number>> = {};
      for (const k of ai.seen) counts[k] = (counts[k] || 0) + 1;
      let best: PunchKind | null = null, n = 0;
      for (const k of Object.keys(counts) as PunchKind[]) if (counts[k]! > n) { n = counts[k]!; best = k; }
      if (best && n >= 5 && n / ai.seen.length >= 0.45 && next(st) < T.adapt) ai.read = best;
      else if (ai.read && (counts[ai.read] || 0) / ai.seen.length < 0.3) ai.read = null;
      // this punch came after a tell it already saw: it has reacted already
      if (ai.seenTell < 0 || startF - ai.seenTell > 30) perceive(st, i, oa.kind!, oa.target!, startF + oa.startup!, out);
    }
  }
  // a habit with a rhythm: once a punch is read and comes like clockwork, it slips the next one before it starts
  const meFree = !me.action || (me.action.type === "punch" && me.action.t > me.action.startup!) || (me.action.type === "evade" && me.action.t >= me.action.w1!);
  const opBetween = !oa || oa.type !== "punch" || oa.t > oa.startup!;
  if (ai.read && !ai.react && meFree && ai.starts.length >= 5 && opBetween) {
    const gaps = ai.starts.slice(1).map((s, k) => s - ai.starts[k]);
    const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const sd = Math.sqrt(gaps.reduce((s, g) => s + (g - mean) * (g - mean), 0) / gaps.length);
    const nextStart = ai.starts[ai.starts.length - 1] + mean;
    if (mean < 90 && sd / mean < 0.35 && nextStart > st.frame && next(st) < T.adapt * 0.9) {
      const impact = Math.round(nextStart + ai.lastSu);
      const spec = PUNCH[ai.read];
      const ev: Evade = spec.path === "hook" ? "duck" : spec.path === "upper" ? "back" : next(st) < 0.5 ? "slipL" : "slipR";
      const at = impact - (EVADE[ev].w0 + 3);
      if (at > st.frame) ai.react = { at, ev, counter: spec.path === "straight" ? "cross" : spec.path === "hook" ? "rupper" : "lhook", counterBody: false };
    }
  }
  if (ai.react && st.frame >= ai.react.at) {
    out.evade = ai.react.ev;
    if (ai.react.counter) ai.plan = [{ kind: ai.react.counter, body: ai.react.counterBody }];
    ai.react = null;
    me.tell = null;
    return out;
  }

  // ---- guard: its own guard, a high guard when hurt
  const wantGuard = me.rocked > 0 || me.headHP < 25 ? "high" : def.guard;
  if (me.guard !== wantGuard && next(st) < 0.05) out.guard = wantGuard;

  // ---- feet
  if (--ai.moveT <= 0) {
    ai.moveT = 6 + Math.floor(next(st) * 8);
    let want = WANT[style] * R0;
    // in and out: step in behind the punches, and a boxer who cannot reach steps in after a while
    if (ai.plan.length || me.tell || me.action?.type === "punch") want = Math.min(want, R0 * 0.92);
    if (me.last && st.frame - me.last.end > 150) want = Math.min(want, R0 * 0.9);
    if (me.stamina < 30 && style !== "pressure") want += 0.25;
    if (op.rocked > 0) want = R0 * 0.75;
    if (me.rocked > 0) want = R0 * 1.4;
    ai.moveF = clamp((d - want) / 0.25, -1, 1);
    if (Math.abs(d - want) < 0.08) ai.moveF = 0;
    if (next(st) < 0.03) ai.circle *= -1;
    const nearRopes = Math.max(Math.abs(me.x), Math.abs(me.z)) > RING - 0.85;
    ai.moveS = ai.circle * CIRCLE[style] * (0.6 + next(st) * 0.6);
    if (nearRopes) {
      // off the ropes: step out along them toward the middle
      const ux = dx / (d || 1), uz = dz / (d || 1);
      const rx = -uz, rz = ux;
      const side = Math.sign(-(me.x * rx + me.z * rz)) || ai.circle;
      ai.moveS = side * (style === "pressure" ? 0.4 : 0.95);
      if (style !== "pressure" && d < R0 * 0.9) ai.moveF = Math.min(ai.moveF, 0);
    }
    // pressure fighters cut the ring off instead of following
    if (style === "pressure" && Math.max(Math.abs(op.x), Math.abs(op.z)) > RING - 1) ai.moveS *= 0.3;
    if (style === "pressure" && d > want + 0.7 && me.stamina > 40 && next(st) < 0.3) out.sprint = true;
    if (style !== "pressure" && nearRopes && d < R0 * 0.8 && me.stamina > 30 && next(st) < 0.25) out.sprint = true;
  }
  out.mf = ai.moveF;
  out.ms = ai.moveS;

  // ---- hands: the tell first, then the punches of the plan as each one can flow
  if (me.tell) {
    if (me.action && me.action.type !== "punch") {
      me.tell = null;
      ai.plan = [];
    } else if (++me.tell.t >= me.tell.dur) me.tell = null;
    else return out;
  }
  const a = me.action;
  const free = !a || (a.type === "punch" && a.t >= a.startup! + a.active! + a.cancelAt!);
  if (ai.plan.length && free) {
    const p0 = ai.plan[0];
    if (!a || handOf(p0.kind, me.stance) !== handOf(a.kind!, me.stance) || (p0.kind === "jab" && a.kind === "jab")) {
      out.punch = p0.kind;
      out.body = p0.body;
      ai.plan.shift();
    }
  }
  if (--ai.think <= 0) {
    ai.think = 5 + Math.floor(next(st) * 4);
    // hurt and tired, or rocked and close: tie him up
    if ((me.rocked > 0 || me.stamina < 14) && d < 0.9 && !me.action && next(st) < 0.12 + T.adapt * 0.1) {
      out.clinch = true;
      return out;
    }
    // where he will be when the punch arrives: no throwing at a man already out of reach
    const ux = dx / (d || 1), uz = dz / (d || 1);
    const closing = (op.vx - me.vx) * ux + (op.vz - me.vz) * uz;
    const dAt = d + closing * 0.3;
    if (!ai.plan.length && !me.action && dAt < R0 * 1.02) {
      let p = BUSY[style] * T.aggression * Math.sqrt(Math.max(0.05, me.stamina / 100));
      // a boxer who has read a habit waits for it to come so he can counter it
      if (ai.read) p *= style === "counter" ? 0.4 : 0.85;
      if (me.rocked > 0) p *= 0.4;
      if (op.rocked > 0) p *= 1.7;
      if (op.action?.type === "punch" && op.action.t > op.action.startup!) p *= 1.6; // in his recovery
      if (next(st) < p) {
        const close = dAt < R0 * 0.8;
        const lib = close ? COMBOS[style].close : COMBOS[style].long;
        let combo = lib[Math.floor(next(st) * lib.length)];
        // against a Philly shell: lead hooks and uppercuts; against a high guard: the body
        const g = ai.guardTime, tot = g.high + g.philly + g.normal || 1;
        if (g.philly / tot > 0.55 && close && next(st) < T.adapt) combo = [{ k: "lhook" }, { k: "lupper" }];
        const toBody = g.high / tot > 0.6 && next(st) < 0.55 * T.adapt;
        ai.plan = combo.map(c => ({ kind: c.k, body: !!c.b || (toBody && c.k !== "jab") }));
        // a hook to the side he keeps slipping to
        if (ai.slips.L + ai.slips.R > 6 && next(st) < T.adapt * 0.3) {
          const toL = ai.slips.L > ai.slips.R;
          const hand = toL ? "R" : "L";
          const kind: PunchKind = handOf("lhook", me.stance) === hand ? "lhook" : "rhook";
          ai.plan.push({ kind, body: false });
        }
        // the shoulder loads before the first punch: the tell a person can read
        const first = ai.plan[0];
        const dur = Math.max(2, Math.round(T.tell * (first.kind === "jab" ? 0.5 : 1)));
        me.tell = { kind: first.kind, body: first.body, t: 0, dur };
      }
    }
  }
  return out;
}

// Headers and volleys: meeting a ball in the air. The meeting point comes from the ball's predicted flight, the
// jump is timed so the head arrives with the ball, and the contact is judged where the head (or the foot)
// actually is. Standing, jumping, running and diving headers; normal, side, half, scissor and overhead volleys.
import { BALL_R, HALF_L, GOAL_HALF, GRAVITY } from "./consts.mjs";
import { clamp, hyp, angDiff, gauss, lerp } from "./util.mjs";
import { n01 } from "./attrs.mjs";
import { predict } from "./ball.mjs";
import { startKick, planShot } from "./kick.mjs";
import { canPlay } from "./control.mjs";

const TR = [];
const jumpMax = p => 0.32 + n01(p.a.jmp) * 0.5; // how high the head can rise, metres

// find when and where this player can meet the ball with his head (or foot for a volley)
export function meetPlan(m, p, part) {
  const b = m.ball;
  predict(b, 2.2, 1 / 30, TR, m.wet);
  const h = p.prof.h;
  for (let i = 2; i < TR.length; i++) {
    const s = TR[i];
    const t = s[0], z = s[3];
    if (part === "head") {
      if (z < h - 0.35 || z > h + jumpMax(p) + 0.12) continue;
    } else if (z < 0.3 || z > 1.75) continue;
    const d = hyp(s[1] - p.x, s[2] - p.y);
    const run = Math.max(0, d - (part === "head" ? 0.4 : 0.55));
    const can = run / (p.prof.vmax * 0.9) + p.prof.reactT * 0.5;
    if (can <= t) return { t, x: s[1], y: s[2], z, d, dive: part === "head" && z < h - 0.2 };
  }
  // a diving header for a ball at waist height a stride or two away
  if (part === "head") for (let i = 2; i < TR.length; i++) {
    const s = TR[i];
    if (s[3] < 0.35 || s[3] > 1.15) continue;
    const d = hyp(s[1] - p.x, s[2] - p.y);
    if (d > 1.4 && d < 3.2 && d / 5.5 <= s[0]) return { t: s[0], x: s[1], y: s[2], z: s[3], d, dive: true };
  }
  return null;
}

// intent: "shot" (at goal), "pass" (to a team mate, to), "clear" (high and away)
export function startHeader(m, p, intent, to) {
  if (!canPlay(p) || p.act) return false;
  const plan = meetPlan(m, p, "head");
  if (!plan) return false;
  const rise = Math.max(0, plan.z - (p.prof.h - 0.08));
  const vz = rise > 0.05 ? Math.sqrt(2 * GRAVITY * Math.min(rise, jumpMax(p))) : 0;
  const tUp = vz / GRAVITY;
  p.act = { k: "header", t: 0, T: plan.t + 0.6, tMeet: plan.t, jumpAt: Math.max(0, plan.t - tUp), vz, plan, intent, to: to || null, busy: true, lock: 0, turnK: 1.2, dive: plan.dive, done: false };
  m.events.push({ type: "header_go", by: p.id, dive: plan.dive });
  return true;
}

export function updateHeader(m, p, dt) {
  const A = p.act, b = m.ball;
  A.t += dt;
  if (!A.done) {
    // get under it
    const ex = A.plan.x - p.x, ey = A.plan.y - p.y, e = hyp(ex, ey);
    p.want.dx = ex; p.want.dy = ey;
    p.want.spd = e < 0.25 ? 0 : Math.min(p.prof.vmax, e / Math.max(0.12, A.tMeet - A.t) + 0.5);
    p.want.face = Math.atan2(b.y - p.y, b.x - p.x);
    if (A.t >= A.jumpAt && !A.jumped && A.vz > 0) { A.jumped = true; p.vz = A.vz; p.z = 0.001; }
    if (A.dive && A.t >= A.tMeet - 0.22 && !A.dived) {
      // a diving header: the body launches flat at the ball
      A.dived = true;
      const a = Math.atan2(A.plan.y - p.y, A.plan.x - p.x);
      p.vx = Math.cos(a) * 6; p.vy = Math.sin(a) * 6;
      p.headerDive = { t: m.t, dir: a };
    }
    // contact: the ball at the head
    const hz = (p.z || 0) + p.prof.h - 0.1 - (A.dive ? p.prof.h - 0.55 : 0);
    const d = hyp(b.x - p.x, b.y - p.y, b.z - hz);
    if (d < 0.42 && A.t > 0.04) { A.done = true; headBall(m, p, A); }
    else if (A.t > A.tMeet + 0.25) { A.done = true; m.events.push({ type: "whiff", by: p.id, header: true }); }
  }
  if (A.dive && A.done && !A.landed && A.t > A.tMeet + 0.15) {
    A.landed = true; p.act = null;
    p.mode = "fall"; p.modeT = 0.3; p.downDir = p.headerDive ? p.headerDive.dir : p.face; p.fallKind = "dive"; p.downT = 0.5;
    return;
  }
  if (A.t >= A.T) p.act = null;
}

function headBall(m, p, A) {
  const b = m.ball;
  const hea = n01(p.a.hea);
  // a rival going up with him: the higher, stronger, better timed man wins it
  let rival = null;
  for (const o of m.teams[1 - p.team].players) {
    if (o.off || o.gk) continue;
    if (hyp(o.x - p.x, o.y - p.y) < 1.1 && o.act && o.act.k === "header") rival = o;
  }
  let q = 0.45 + hea * 0.45 - (rival ? 0.18 : 0) + gauss(m.rng) * 0.1;
  if (rival) {
    const mine = (p.z || 0) + p.prof.h + n01(p.a.str) * 0.2 + n01(p.a.jmp) * 0.25 + m.rng() * 0.25;
    const his = (rival.z || 0) + rival.prof.h + n01(rival.a.str) * 0.2 + n01(rival.a.jmp) * 0.25 + m.rng() * 0.25;
    if (his > mine) { m.events.push({ type: "aerial", by: rival.id, beat: p.id }); rival.bal -= 0.05; p.bal -= 0.15; return; }
    rival.bal -= 0.2;
  }
  const dir = m.teams[p.team].dir;
  let tx, ty, tz, v;
  const inc = hyp(b.vx, b.vy, b.vz);
  if (A.intent === "shot") {
    const gx = dir * HALF_L;
    const k = m.teams[1 - p.team].gk;
    ty = (k && k.y > 0 ? -1 : 1) * (GOAL_HALF - 0.6) * (0.6 + m.rng() * 0.4);
    tx = gx; tz = 0.35 + m.rng() * 0.6; // head it down
    v = 9 + hea * 7 + inc * 0.22 + (A.dive ? 3 : 0);
  } else if (A.intent === "pass" && A.to) {
    tx = A.to.x + A.to.vx * 0.5; ty = A.to.y + A.to.vy * 0.5; tz = 1.0;
    v = clamp(hyp(tx - b.x, ty - b.y) * 0.9 + 3, 5, 16);
  } else {
    // a clearance: high and wide, away from goal
    const a = Math.atan2(Math.sign(b.y || 1) * 0.5, dir);
    tx = b.x + Math.cos(a) * 25; ty = b.y + Math.sin(a) * 25; tz = 6;
    v = 11 + hea * 6;
  }
  const D = hyp(tx - b.x, ty - b.y) || 1;
  const err = (1.25 - q) * 0.14;
  const a = Math.atan2(ty - b.y, tx - b.x) + gauss(m.rng) * err;
  const el = Math.atan2(tz - b.z, D) + (A.intent === "clear" ? 0.45 : 0.08) + gauss(m.rng) * err * 0.7;
  b.vx = Math.cos(a) * Math.cos(el) * v; b.vy = Math.sin(a) * Math.cos(el) * v; b.vz = Math.sin(el) * v;
  b.wx = b.wy = b.wz = 0;
  b.ctrl = null; b.last = p; b.lastTeam = p.team; b.touchT = 0; b.immune = p; b.immuneT = 0.2;
  b.flight = { kind: "header", by: p, to: A.to, tx, ty, t: m.t, shot: A.intent === "shot" };
  p.touch = { t: m.t, kind: "head" };
  m.events.push({ type: "header", by: p.id, intent: A.intent, dive: !!A.dive, q });
  m.onKick(p, { kind: "header", shot: A.intent === "shot", to: A.to, tx, ty }, q);
}

// a volley: strike a ball in the air with the foot. Style from the height and where the ball comes from.
export function startVolley(m, p, spec) {
  if (!canPlay(p) || p.act) return false;
  const plan = meetPlan(m, p, "foot");
  if (!plan) return false;
  const b = m.ball;
  const fromSide = Math.abs(angDiff(p.face, Math.atan2(-b.vy, -b.vx))) > 1.0;
  const style = plan.z > 1.3 ? (n01(p.a.agi) > 0.7 && p.prof.stars >= 4 && !fromSide ? "bicycle" : "scissor") : plan.z > 0.85 && fromSide ? "side" : b.vz > 0 && plan.z < 0.6 ? "half" : "volley";
  spec.kind = spec.shot ? "volley" : spec.kind;
  spec.firstTime = true;
  spec.style = style;
  startKick(m, p, spec);
  p.act.tc = Math.max(0.08, plan.t);
  p.act.volley = style;
  p.act.plan = plan;
  m.events.push({ type: "volley_go", by: p.id, style });
  return true;
}

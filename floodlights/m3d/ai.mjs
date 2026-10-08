// The AI for everyone the person is not controlling, on both teams.
// Team level (about 5 times a second): who has the ball, the shape of the block, how high the line sits, who
// presses, who covers, where the offside line is. Player level (about 10 times a second, staggered): support
// positions with an open lane, runs of every kind (in behind, diagonal, overlap, underlap, checking to and away,
// dummy, near post, far post, cutback), marking goal side, covering, cutting lanes, recovering, blocking shots,
// and the ball carrier's choice between shooting, passing, crossing, dribbling, a skill move, shielding or a
// clearance. It all goes through the same body, touch, kick, tackle and skill code the person uses.
import { HALF_L, HALF_W, GOAL_HALF, BOX_D, BOX_HALF, REACH } from "./consts.mjs";
import { clamp, hyp, lerp, angDiff, wrapAng, segDist } from "./util.mjs";
import { n01 } from "./attrs.mjs";
import { pressureOn, canPlay } from "./control.mjs";
import { planPass, planThrough, planLob, planCross, planShot, startKick, timeToReach, laneRisk, isOffside, passSpeed } from "./kick.mjs";
import { startTackle, startSlide, shoulder } from "./defend.mjs";
import { pickSkill, startSkill } from "./skills.mjs";
import { predict } from "./ball.mjs";
import { calling } from "./lock.mjs";

// base slots in the team frame: x 0 is the back line, 1 the front line; y is across (+ is the left side)
const SLOT = {
  GK: { d: -0.35, y: 0 }, CB: { d: 0, y: 0.2 }, LB: { d: 0.05, y: 0.62 }, RB: { d: 0.05, y: -0.62 },
  CDM: { d: 0.28, y: 0 }, CM: { d: 0.46, y: 0.24 }, CAM: { d: 0.7, y: 0 }, LW: { d: 0.8, y: 0.66 }, RW: { d: 0.8, y: -0.66 }, ST: { d: 1, y: 0 }
};

export function setupShape(T) {
  // spread players who share a role across the pitch (two centre backs, two holding midfielders...)
  const by = {};
  for (const p of T.players) (by[p.role] = by[p.role] || []).push(p);
  for (const [role, list] of Object.entries(by)) {
    const s = SLOT[role] || SLOT.CM;
    list.forEach((p, i) => {
      let y = s.y;
      if (list.length > 1) y = lerp(Math.max(s.y, 0.18) * (role === "LB" || role === "RB" || role === "LW" || role === "RW" ? 1 : 1), -Math.max(s.y, 0.18), i / (list.length - 1));
      if (role === "LB" || role === "RB" || role === "LW" || role === "RW") y = s.y * (1 - i * 0.35);
      p.slot = { d: s.d, y: list.length > 1 && (role === "CB" || role === "CM" || role === "CDM" || role === "ST") ? lerp(0.22, -0.22, i / (list.length - 1)) * (role === "CM" ? 1.3 : 1) : y };
    });
  }
}

// ---------- team brain ----------
export function teamThink(m, T) {
  const b = m.ball, O = m.teams[1 - T.idx];
  const dir = T.dir;
  // possession
  const owner = b.ctrl || b.held;
  let have;
  if (owner) have = owner.team === T.idx;
  else if (b.flight && b.flight.by && m.t - b.flight.t < 2.5) have = b.flight.by.team === T.idx;
  else have = b.lastTeam === T.idx && b.touchT < 1.2;
  if (have !== T.have) { T.have = have; T.switchT = m.t; }
  T.trans = m.t - (T.switchT || 0) < 2.2;
  // ball in the team frame
  const bx = (b.held ? b.held.x : b.x) * dir, by = (b.held ? b.held.y : b.y) * dir;
  T.bx = bx; T.by = by;
  // the offside line we must stay behind (their second last man) and our own back line
  const oppX = O.players.filter(o => !o.off).map(o => o.x * dir).sort((a, c) => c - a);
  T.offLine = Math.max(oppX[1] !== undefined ? oppX[1] : 0, bx, 0);
  // block: back line height and length
  if (have) {
    T.lineX = clamp(bx - 30, -38, 8);
    T.len = 42; T.wid = 62;
  } else {
    T.lineX = clamp(bx - 24, -41, -6) - (T.trans ? 4 : 0);
    T.len = 30; T.wid = 40;
  }
  T.shiftY = clamp(by * 0.4, -12, 12);
  // pressers: the quickest to the ball carrier, a second to cover
  if (!have) {
    const tgt = owner || b;
    const cand = T.players.filter(p => !p.gk && !p.off && p.mode !== "down").map(p => ({ p, t: timeToReach(p, tgt.x, tgt.y) })).sort((a, c) => a.t - c.t);
    T.press1 = cand[0] ? cand[0].p : null;
    T.press2 = cand[1] && (Math.abs(bx) > 15 || m.rng() < 0.6) ? cand[1].p : null;
    // a ball nobody owns: send the quickest
    T.chaser = !owner ? T.press1 : null;
  } else {
    T.press1 = T.press2 = null;
    T.chaser = null;
    if (!owner) {
      const cand = T.players.filter(p => !p.off && p.mode !== "down" && !p.gk).map(p => ({ p, t: timeToReach(p, b.x, b.y) })).sort((a, c) => a.t - c.t);
      T.chaser = cand[0] ? cand[0].p : null;
    }
  }
  // the wide area the ball is in, for crossing runs
  T.wideFinal = have && bx > HALF_L - 30 && Math.abs(by) > 12;
}

// where a player's slot puts him right now (world coordinates)
export function shapeTarget(m, p) {
  const T = m.teams[p.team], dir = T.dir;
  const s = p.slot || SLOT.CM;
  let X = T.lineX + s.d * T.len;
  let Y = T.shiftY + s.y * T.wid / 2;
  if (T.have) {
    // full backs push on, wingers hold the width, the striker leans on the last line
    if (p.role === "LB" || p.role === "RB") X += 12 * clamp((T.bx + 10) / 40, 0, 1);
    if (p.role === "LW" || p.role === "RW") Y = Math.sign(s.y) * Math.max(Math.abs(Y), 24);
    if (p.role === "ST") X = Math.max(X, Math.min(T.offLine - 1.2, T.bx + 22));
    X = Math.min(X, T.offLine - 0.8);
  } else {
    // stay goal side of the ball, the front men screen
    if (s.d > 0.6) X = Math.min(X, T.bx + 2);
  }
  X = clamp(X, -HALF_L + 3, HALF_L - 3);
  Y = clamp(Y, -HALF_W + 2.5, HALF_W - 2.5);
  return { x: X * dir, y: Y * dir };
}

// ---------- every player who is not under the person's control ----------
export function playerThink(m, p, dt) {
  if (p.off || p.gk) return;
  const T = m.teams[p.team], b = m.ball;
  const W = p.want;
  const ai = p.ai;
  ai.think -= dt;
  if (p.act && (p.act.k === "kick" || p.act.k === "slide" || p.act.k === "skill" || p.act.k === "tackle" || p.act.k === "poke")) return;
  if (p.mode === "fall" || p.mode === "down" || p.mode === "getup") return;
  // the ball carrier decides on a slower beat, everyone else keeps moving every step
  if (b.ctrl === p) { carrier(m, p, dt); return; }
  // a ball coming to him: meet it
  if (b.flight && b.flight.to === p && !b.ctrl && b.flight.by && b.flight.by.team === p.team) { receive(m, p); return; }
  if (!b.ctrl && !b.held && (T.chaser === p || b.flight && b.flight.to === p)) { chase(m, p); return; }
  if (T.have) attackOff(m, p, dt); else defendOff(m, p, dt);
}

// meet a pass: run to where the ball will be when he can get there, and face where he wants to play
const TR = [];
export function receive(m, p) {
  const b = m.ball, W = p.want;
  predict(b, 2.6, 1 / 20, TR, m.wet);
  let best = null;
  for (let i = 0; i < TR.length; i++) {
    const s = TR[i];
    if (s[3] > (p.prof.h + 0.3)) continue;
    const tp = timeToReach(p, s[1], s[2]) - p.prof.reactT * 0.5;
    if (tp <= s[0] + 0.05) { best = s; break; }
  }
  if (!best && TR.length) best = TR[TR.length - 1];
  if (!best) return;
  const ex = best[1] - p.x, ey = best[2] - p.y, e = hyp(ex, ey);
  W.dx = ex; W.dy = ey;
  W.spd = e < 0.3 ? 0 : Math.min(p.prof.vmax, e / Math.max(0.15, best[0]) + 1.5);
  // face the ball as it comes, slightly open toward goal
  W.face = Math.atan2(b.y - p.y, b.x - p.x);
  p.ai.mode = "receive";
}

// a loose ball: go and get it, the shortest way to where it will be
export function chase(m, p) {
  const b = m.ball, W = p.want;
  predict(b, 2, 1 / 20, TR, m.wet);
  let tgt = TR[TR.length - 1];
  for (const s of TR) { if (s[3] > 1.6) continue; if (timeToReach(p, s[1], s[2]) <= s[0] + 0.1) { tgt = s; break; } }
  if (!tgt) return;
  W.dx = tgt[1] - p.x; W.dy = tgt[2] - p.y; W.spd = p.prof.vmax; W.face = null;
  p.ai.mode = "chase";
}

// ---------- attacking without the ball ----------
function attackOff(m, p, dt) {
  const T = m.teams[p.team], b = m.ball, W = p.want, ai = p.ai, dir = T.dir;
  const carrierP = b.ctrl && b.ctrl.team === p.team ? b.ctrl : null;
  const home = shapeTarget(m, p);
  // keep a run going until it ends
  if (ai.run && (m.t > ai.run.until || !carrierP && !b.flight)) ai.run = null;
  if (ai.think <= 0) {
    ai.think = 0.1 + m.rng() * 0.08;
    if (!ai.run && carrierP) maybeRun(m, p, carrierP, home);
    if (!ai.run) ai.spot = supportSpot(m, p, carrierP, home);
    // scanning: a look over the shoulder now and then, a raised arm when open
    if (m.rng() < 0.12) p.look = { t: m.t, at: m.rng() < 0.5 ? "shoulder" : "ball" };
    const free = !p.gest || m.t - p.gest.t > p.gest.T + 1.5; // one gesture at a time, then a pause
    if (free && carrierP && ai.open > 0.65 && m.rng() < 0.2 && hyp(carrierP.x - p.x, carrierP.y - p.y) < 30) p.gest = { k: "call", t: m.t, T: 1.1 };
  }
  let tx, ty, spd;
  if (ai.run) {
    // runs curve along the line until the ball is played: stay onside at the line, then go
    const r = ai.run;
    tx = r.x; ty = r.y;
    if (r.hold && carrierP) {
      // stay on the line until the pass; a poorer reader of the game sometimes goes a stride too early
      const early = r.early === undefined ? (r.early = m.rng() < 0.22 * (1.2 - n01(p.a.apos)) ? 1.2 + m.rng() * 1.5 : 0) : r.early;
      const lineX = (T.offLine - 0.6 + early) * dir;
      if ((tx - lineX) * dir > 0) tx = lineX;
    }
    spd = r.sprint ? p.prof.vmax : p.prof.vmax * 0.75;
    if (r.gest && !r.pointed && (!p.gest || m.t - p.gest.t > p.gest.T + 1)) { r.pointed = true; p.gest = { k: "point", t: m.t, T: 0.8, x: r.x, y: r.y }; }
  } else {
    const s = ai.spot || home;
    tx = s.x; ty = s.y;
    const d = hyp(tx - p.x, ty - p.y);
    spd = d > 8 ? p.prof.vmax * 0.82 : d > 2.5 ? 3.6 + d * 0.25 : d > 0.6 ? 1.6 : 0;
  }
  W.dx = tx - p.x; W.dy = ty - p.y; W.spd = hyp(W.dx, W.dy) < 0.35 ? 0 : spd;
  W.face = hyp(W.dx, W.dy) < 1.2 ? Math.atan2(b.y - p.y, b.x - p.x) : null;
  W.jockey = 0; W.shield = 0;
}

// a supporting spot near the shape position with a clear lane from the ball and some space
function supportSpot(m, p, c, home) {
  const T = m.teams[p.team], dir = T.dir;
  if (!c) return home;
  const dc = hyp(home.x - c.x, home.y - c.y);
  if (dc > 32) { p.ai.open = 0; return home; }
  let best = home, bestS = -1e9;
  for (let i = 0; i < 9; i++) {
    const a = i === 8 ? 0 : i / 8 * Math.PI * 2, r = i === 8 ? 0 : 4.5;
    const x = clamp(home.x + Math.cos(a) * r, -HALF_L + 2, HALF_L - 2), y = clamp(home.y + Math.sin(a) * r, -HALF_W + 1.5, HALF_W - 1.5);
    const D = hyp(x - c.x, y - c.y);
    const v = passSpeed(D, 5);
    const risk = laneRisk(m, p.team, c.x, c.y, x, y, D / Math.max(6, v * 0.7), null);
    let space = 9;
    for (const o of m.teams[1 - p.team].players) if (!o.off) space = Math.min(space, hyp(o.x - x, o.y - y));
    let mate = 9;
    for (const q of T.players) if (q !== p && !q.off) mate = Math.min(mate, hyp(q.x - x, q.y - y));
    const off = (x * dir) > T.offLine - 0.5 ? 3 : 0;
    const s = -risk * 3 + Math.min(space, 7) * 0.35 - Math.max(0, 6 - mate) * 0.4 + (x - c.x) * dir * 0.04 - hyp(x - home.x, y - home.y) * 0.12 - off - Math.abs(D - 15) * 0.03;
    if (s > bestS) { bestS = s; best = { x, y, risk }; }
  }
  p.ai.open = clamp(1 - (best.risk || 0), 0, 1);
  return best;
}

// runs: chosen from the situation, the player's role, vision and a little chance
function maybeRun(m, p, c, home) {
  const T = m.teams[p.team], dir = T.dir;
  const X = p.x * dir, Y = p.y * dir, cX = c.x * dir, cY = c.y * dir;
  const pr = pressureOn(m, c);
  const facingFwd = Math.cos(c.face) * dir > 0.2;
  const apos = n01(p.a.apos), vis = n01(p.a.vis);
  const r = m.rng();
  const run = (type, x, y, until, sprint, hold, gest) => { p.ai.run = { type, x: x * dir, y: y * dir, until: m.t + until, sprint, hold, gest }; m.events.push({ type: "run", by: p.id, run: type }); };
  // crossing runs when the ball is wide in the final third
  if (T.wideFinal && Math.abs(cY) > 12 && cX > HALF_L - 30 && X > HALF_L - 35) {
    const side = Math.sign(cY);
    if (p.role === "ST" && r < 0.7) return run("near_post", HALF_L - 5, side * 2.5, 2.2, true, false, true);
    if ((p.role === "LW" || p.role === "RW") && Math.sign(Y) !== side && r < 0.7) return run("far_post", HALF_L - 6, -side * 4, 2.4, true, false, false);
    if ((p.role === "CAM" || p.role === "CM") && r < 0.5) return run("cutback", HALF_L - 12, side * 2, 2.4, false, false, false);
  }
  if (r > 0.04 + apos * 0.05) return;
  // in behind: the front men go when the carrier is facing forward with time on the ball
  if ((p.role === "ST" || p.role === "LW" || p.role === "RW" || p.role === "CAM" && r < 0.3) && facingFwd && pr < 0.55 && cX > -20 && X > cX - 5) {
    const diag = p.role === "ST" ? (m.rng() < 0.5 ? 1 : -1) * 6 : -Math.sign(Y) * 5;
    const tx = Math.min(HALF_L - 6, T.offLine + 12 + vis * 6), ty = clamp(Y + diag, -HALF_W + 4, HALF_W - 4);
    return run(Math.abs(diag) > 5 ? "diagonal" : "forward", tx, ty, 2.6, true, true, true);
  }
  // overlap: the full back runs outside the winger who has the ball
  if ((p.role === "LB" || p.role === "RB") && (c.role === "LW" || c.role === "RW") && Math.sign(cY) === Math.sign(Y) && cX > X - 4) {
    return run("overlap", Math.min(HALF_L - 8, cX + 14), Math.sign(Y) * (HALF_W - 3), 2.8, true, true, true);
  }
  // underlap: a midfielder into the half space inside a wide carrier
  if ((p.role === "CM" || p.role === "CAM") && Math.abs(cY) > 16 && cX > -10) {
    return run("underlap", Math.min(HALF_L - 10, cX + 12), Math.sign(cY) * 10, 2.2, true, true, false);
  }
  // check to the ball when tight marked, then away
  let marked = false;
  for (const o of m.teams[1 - p.team].players) if (!o.off && hyp(o.x - p.x, o.y - p.y) < 2.2) marked = true;
  if (marked && hyp(cX - X, cY - Y) > 10) {
    if (m.rng() < 0.5) return run("check_in", X + (cX - X) * 0.35, Y + (cY - Y) * 0.35, 1.0, true, false, false);
    return run("check_away", X + 6, Y + (Y > 0 ? 4 : -4), 1.2, true, true, false);
  }
  // a dummy run drags a man away to open space for someone else
  if ((p.role === "ST" || p.role === "CAM") && m.rng() < 0.3) return run("dummy", X + 8, Y + (m.rng() < 0.5 ? 8 : -8), 1.6, true, true, false);
}

// ---------- defending without the ball ----------
function defendOff(m, p, dt) {
  const T = m.teams[p.team], O = m.teams[1 - p.team], b = m.ball, W = p.want, ai = p.ai, dir = T.dir;
  const owner = b.ctrl && b.ctrl.team !== p.team ? b.ctrl : null;
  W.shield = 0;
  // pressing: close down, then jockey and pick the moment
  if (T.press1 === p && owner) { press(m, p, owner, dt); return; }
  if (T.press2 === p && owner) {
    // cover behind the presser, between the ball and goal
    const gx = -dir * HALF_L;
    const tx = owner.x + (gx - owner.x) * 0.22, ty = owner.y * 0.75;
    W.dx = tx - p.x; W.dy = ty - p.y; W.spd = Math.min(p.prof.vmax, hyp(W.dx, W.dy) * 1.5 + 1); W.face = Math.atan2(owner.y - p.y, owner.x - p.x); W.jockey = 0;
    return;
  }
  if (ai.think <= 0) {
    ai.think = 0.12 + m.rng() * 0.08;
    ai.mark = pickMark(m, p);
    if (m.rng() < 0.1) p.look = { t: m.t, at: "shoulder" };
  }
  const home = shapeTarget(m, p);
  let tx = home.x, ty = home.y, urgent = false;
  // marking: goal side of the man, a little toward the ball, closer near our box
  const mk = ai.mark;
  if (mk && !mk.off) {
    const gx = -dir * HALF_L;
    const dGoal = hyp(mk.x - gx, mk.y);
    const tight = dGoal < 28 ? 1.2 : 2.6;
    const ux = (gx - mk.x), uy = -mk.y, ul = hyp(ux, uy) || 1;
    tx = mk.x + ux / ul * tight + (b.x - mk.x) * 0.08;
    ty = mk.y + uy / ul * tight + (b.y - mk.y) * 0.08;
    // track runners: if he is sprinting past, sprint with him
    if (hyp(mk.vx, mk.vy) > 5) urgent = true;
  } else if (owner) {
    // cut the most dangerous lane from the carrier
    let best = null, bs = 0;
    for (const q of O.players) {
      if (q === owner || q.off || q.gk) continue;
      const d = segDist(p.x, p.y, owner.x, owner.y, q.x, q.y);
      const danger = clamp(1 - d / 8, 0, 1) * (q.x * dir < 0 ? 1.3 : 0.7);
      if (danger > bs) { bs = danger; best = q; }
    }
    if (best && bs > 0.3) { tx = (owner.x + best.x) / 2 * 0.4 + tx * 0.6; ty = (owner.y + best.y) / 2 * 0.4 + ty * 0.6; }
  }
  // the ball is past us: recover goal side quickly
  const behind = (b.x - p.x) * dir < -2 && hyp(b.x - p.x, b.y - p.y) < 30;
  if (behind) urgent = true;
  // a fooled defender lags
  if (p.feinted && m.t < p.feinted.until && p.feinted.dir !== null) { tx += Math.cos(p.feinted.dir) * 1.2; ty += Math.sin(p.feinted.dir) * 1.2; }
  const d = hyp(tx - p.x, ty - p.y);
  W.dx = tx - p.x; W.dy = ty - p.y;
  W.spd = d < 0.4 ? 0 : urgent || d > 9 ? p.prof.vmax * (0.85 + n01(p.a.awa) * 0.15) : Math.min(p.prof.vmax * 0.7, 2 + d * 0.6);
  W.face = d < 3 ? Math.atan2(b.y - p.y, b.x - p.x) : null;
  W.jockey = 0;
  // a shot coming from close: get in the way
  if (owner && owner.act && owner.act.k === "kick" && owner.act.spec.shot && hyp(owner.x - p.x, owner.y - p.y) < 9 && !p.act) {
    const gx = -dir * HALF_L;
    if (segDist(p.x, p.y, owner.x, owner.y, gx, 0) < 2.5) { p.act = { k: "block", t: 0, T: 0.5, lock: 0.7, turnK: 0.5 }; m.events.push({ type: "block", by: p.id }); }
  }
}

// who to mark: the nearest attacker in his area who is not already marked by someone closer
function pickMark(m, p) {
  const T = m.teams[p.team], O = m.teams[1 - p.team], dir = T.dir;
  if (p.role === "ST" || p.role === "LW" || p.role === "RW") return null;
  const home = shapeTarget(m, p);
  let best = null, bd = p.role === "CB" || p.role === "LB" || p.role === "RB" ? 16 : 11;
  for (const o of O.players) {
    if (o.off || o.gk) continue;
    if (o.x * dir > -5 && p.role !== "CB") continue; // only in our half
    const d = hyp(o.x - home.x, o.y - home.y);
    if (d >= bd) continue;
    // someone else closer to him already
    let taken = false;
    for (const q of T.players) if (q !== p && !q.gk && q.ai.mark === o && hyp(q.x - o.x, q.y - o.y) < d) taken = true;
    if (taken) continue;
    bd = d; best = o;
  }
  return best;
}

// close down a carrier: fast, then a controlled approach, then jockey and choose the moment to tackle
function press(m, p, c, dt) {
  const W = p.want, T = m.teams[p.team], dir = T.dir, b = m.ball;
  const gx = -dir * HALF_L;
  const d = hyp(c.x - p.x, c.y - p.y);
  // approach from the goal side, showing him wide
  const ux = gx - c.x, uy = -c.y * 0.6, ul = hyp(ux, uy) || 1;
  const tx = c.x + ux / ul * 1.4, ty = c.y + uy / ul * 1.4;
  W.dx = tx - p.x; W.dy = ty - p.y;
  if (d > 5) { W.spd = p.prof.vmax * (0.85 + n01(p.a.agg) * 0.15); W.face = null; W.jockey = 0; }
  else { W.spd = Math.min(5.5, d * 1.4 + c.spd * 0.8); W.face = Math.atan2(c.y - p.y, c.x - p.x); W.jockey = 1; }
  // a fooled defender loses a beat
  if (p.feinted && m.t < p.feinted.until) { W.spd *= 1 - p.feinted.k * 0.6; return; }
  if (p.act || p.ai.tackleCd > m.t) return;
  const bd = hyp(b.x - p.x, b.y - p.y);
  const away = hyp(b.x - c.x, b.y - c.y);
  const tck = n01(p.a.tck), agg = n01(p.a.agg), awa = n01(p.a.awa);
  const inBox = Math.abs(c.x - gx) < BOX_D && Math.abs(c.y) < BOX_HALF;
  // the moment: the ball exposed (nearer to me than to him) after a touch, or a patient defender's guess
  const exposed = bd < away && away > 0.55;
  if (bd < 1.7 && (exposed || m.rng() < 0.012 + agg * 0.02)) {
    if (m.rng() < (exposed ? 0.45 : 0.15) + tck * 0.3 + awa * 0.1) { startTackle(m, p, bd > 1.25); p.ai.tackleCd = m.t + 1.1; }
    else p.ai.tackleCd = m.t + 0.45;
    return;
  }
  // beaten and chasing from the side: a slide, rarely inside the box
  const fromBehind = Math.abs(angDiff(c.face, Math.atan2(c.y - p.y, c.x - p.x))) < 1.2;
  if (bd < 3.2 && bd > 1.5 && p.spd > 5 && !fromBehind && (!inBox || m.rng() < 0.1) && m.rng() < 0.01 + agg * 0.018) {
    startSlide(m, p, Math.atan2(b.y + b.vy * 0.25 - p.y, b.x + b.vx * 0.25 - p.x)); p.ai.tackleCd = m.t + 2;
    return;
  }
  // running alongside: lean in with the shoulder
  if (d < 1.05 && p.spd > 4 && c.spd > 4 && Math.abs(angDiff(p.face, c.face)) < 0.6 && m.t - (p.shoulderT || 0) > 1.2 && m.rng() < 0.3 + n01(p.a.str) * 0.3) shoulder(m, p, c);
}

// ---------- the ball carrier ----------
function carrier(m, p, dt) {
  const T = m.teams[p.team], b = m.ball, W = p.want, ai = p.ai, dir = T.dir;
  const gx = dir * HALF_L;
  const pr = pressureOn(m, p);
  // player lock: a call from the person's footballer gets a quick look up
  if (m.lock && p.team === m.lock.team && calling(m) && ai.callSeen !== m.call.t) { ai.callSeen = m.call.t; ai.think = Math.min(ai.think, 0.06); }
  // keep dribbling toward the chosen way between decisions
  if (ai.think > 0) { dribbleOn(m, p); return; }
  // near goal or pressed, decisions come quicker
  const nearGoal = hyp(T.dir * HALF_L - p.x, p.y) < 30;
  ai.think = (0.18 + (1 - n01(p.a.vis)) * 0.2) * (pr > 0.6 ? 0.6 : 1) * (nearGoal ? 0.6 : 1);
  if (p.act) return;
  if (b.touchT < 0.12 && m.rng() < 0.6) { dribbleOn(m, p); return; }
  const X = p.x * dir;
  const dGoal = hyp(gx - p.x, p.y);
  const ang = Math.abs(Math.atan2(p.y, gx - p.x)) * 0; // placeholder for symmetry
  // ----- shoot? -----
  const xg = xG(m, p);
  const inBox = Math.abs(gx - p.x) < BOX_D && Math.abs(p.y) < BOX_HALF;
  const shootWill = 0.022 + (1 - n01(p.a.fin)) * 0.018 - (inBox ? 0.012 : 0);
  const longShot = dGoal < 30 && dGoal > 18 && pr < 0.45 && n01(p.a.pow) > 0.5 && xg > 0.01 && m.rng() < 0.3;
  // facing the goal around the edge of the box with a sight of it: have a go
  const facing = Math.abs(angDiff(p.face, Math.atan2(-p.y, gx - p.x))) < 1.0;
  const edge = dGoal < 24 && facing && xg > 0.015 && m.rng() < 0.55;
  if (xg > shootWill && dGoal < 28 || longShot || edge) {
    const kind = chooseShot(m, p, dGoal);
    const aim = (m.rng() < 0.5 ? 1 : -1) * (0.6 + m.rng() * 0.4);
    startKick(m, p, planShot(m, p, aim, clamp(0.55 + m.rng() * 0.3 - (kind === "finesse" ? 0.1 : 0), 0.3, 0.92), kind));
    return;
  }
  // ----- take the man on? a skilled dribbler with a defender square in front -----
  const front0 = defenderAhead(m, p);
  if (front0 && front0.d < 3.3 && front0.d > 1.2 && p.prof.stars >= 2 && X > -20 && m.rng() < 0.1 + p.prof.stars * 0.06 + n01(p.a.dri) * 0.12) {
    const rel = (m.rng() < 0.5 ? 1 : -1) * (0.5 + m.rng() * 0.7);
    const set = p.prof.stars >= 4 && m.rng() < 0.45 ? (m.rng() < 0.5 ? "V" : "FF") : p.spd > 5 && m.rng() < 0.3 ? "SF" : "F";
    const pick = pickSkill(p, set, p.spd > 2 ? rel : rel * 1.6, p.spd > 2);
    startSkill(m, p, pick.id, pick.side);
    return;
  }
  // ----- cross? -----
  if (Math.abs(p.y) > 11 && X > HALF_L - 30 && m.rng() < 0.8) {
    const inBox = T.players.filter(q => q !== p && !q.off && Math.abs(q.x - gx) < 18 && Math.abs(q.y) < 15).length;
    if (inBox >= 1) {
      const back = X > HALF_L - 6 && m.rng() < 0.4;
      const dirC = back ? Math.atan2(-p.y * 0.2, -dir) : Math.atan2(-p.y, gx - p.x);
      const low = m.rng() < 0.3;
      startKick(m, p, planCross(m, p, dirC, 0.45 + m.rng() * 0.4, low));
      return;
    }
  }
  // ----- pass? the best option by value and safety -----
  const opt = bestPass(m, p, pr);
  const keep = keepValue(m, p, pr);
  if (opt && opt.score > keep) {
    startKick(m, p, opt.spec);
    m.passIntent(p, opt.spec);
    return;
  }
  // ----- clear it under pressure deep in our half -----
  if (pr > 0.7 && X < -HALF_L + 22 && (!opt || opt.score < 0.2)) {
    const a = Math.atan2(Math.sign(p.y || 1) * 0.8, dir);
    startKick(m, p, { kind: "clear", tx: p.x + Math.cos(a) * 45, ty: clamp(p.y + Math.sin(a) * 45, -HALF_W + 3, HALF_W - 3), T: 2.3, power: 0.9 });
    return;
  }
  // ----- shield when there is nothing on and he is pressed -----
  ai.shield = pr > 0.75 && (!opt || opt.score < 0.1) && n01(p.a.str) > 0.45;
  dribbleOn(m, p);
}

// keep running with it: toward goal through the gaps, away from pressure
function dribbleOn(m, p) {
  const T = m.teams[p.team], W = p.want, dir = T.dir;
  const gx = dir * HALF_L;
  let ax = gx - p.x, ay = -p.y * 0.6;
  // steer away from defenders ahead
  for (const o of m.teams[1 - p.team].players) {
    if (o.off) continue;
    const dx = o.x - p.x, dy = o.y - p.y, d = hyp(dx, dy);
    if (d > 7 || d < 0.01) continue;
    const ahead = (dx * Math.cos(p.face) + dy * Math.sin(p.face)) / d;
    if (ahead < 0) continue;
    const w = (7 - d) / 7 * (0.8 + ahead);
    ax -= dx / d * w * 12; ay -= dy / d * w * 12;
  }
  // the touchlines push back in
  if (Math.abs(p.y) > HALF_W - 6) ay -= Math.sign(p.y) * 18;
  const l = hyp(ax, ay) || 1;
  W.dx = ax / l; W.dy = ay / l;
  const pr = pressureOn(m, p);
  const space = !defenderAhead(m, p) || defenderAhead(m, p).d > 9;
  W.spd = p.ai.shield ? 1.6 : space ? p.prof.vmax * (0.85 + m.rng() * 0.1) : p.prof.vmax * 0.6;
  W.shield = p.ai.shield ? 1 : 0;
  W.face = null; W.jockey = 0;
  W.knock = space && p.prof.vmax > 8.6 && m.rng() < 0.01;
  if (W.shield) {
    // keep the body between the man and the ball
    let near = null, nd = 9;
    for (const o of m.teams[1 - p.team].players) { const d = hyp(o.x - p.x, o.y - p.y); if (!o.off && d < nd) { nd = d; near = o; } }
    if (near) W.face = Math.atan2(p.y - near.y, p.x - near.x);
  }
}

function defenderAhead(m, p) {
  let best = null;
  const c = Math.cos(p.face), s = Math.sin(p.face);
  for (const o of m.teams[1 - p.team].players) {
    if (o.off || o.gk) continue;
    const dx = o.x - p.x, dy = o.y - p.y, d = hyp(dx, dy);
    if (d > 12) continue;
    const fwd = dx * c + dy * s, lat = Math.abs(-dx * s + dy * c);
    if (fwd > 0 && lat < 2.2 + fwd * 0.15 && (!best || d < best.d)) best = { o, d };
  }
  return best;
}

// a simple expected goals estimate from distance, angle, blockers, the keeper and pressure
export function xG(m, p) {
  const T = m.teams[p.team], dir = T.dir;
  const gx = dir * HALF_L;
  const dx = Math.abs(gx - p.x), dy = Math.abs(p.y);
  const d = hyp(dx, dy);
  if (d > 36) return 0;
  // the angle the goal mouth subtends
  const a1 = Math.atan2(GOAL_HALF - p.y, dx), a2 = Math.atan2(-GOAL_HALF - p.y, dx);
  const view = Math.abs(a1 - a2);
  let xg = clamp(view * 0.9 * Math.exp(-d / 17), 0, 0.85);
  // blockers between him and goal
  for (const o of m.teams[1 - p.team].players) {
    if (o.off || o.gk) continue;
    if (segDist(o.x, o.y, p.x, p.y, gx, p.y * 0.3) < 0.9) xg *= 0.55;
  }
  const k = m.teams[1 - p.team].gk;
  if (k && segDist(k.x, k.y, p.x, p.y, gx, 0) < 0.5 && hyp(k.x - p.x, k.y - p.y) > 4) xg *= 0.8;
  xg *= 1 - pressureOn(m, p) * 0.35;
  return xg * (0.75 + n01(p.a.fin) * 0.5);
}

function chooseShot(m, p, d) {
  const k = m.teams[1 - p.team].gk;
  const kOut = k ? Math.abs(k.x - m.teams[p.team].dir * HALF_L) : 0;
  if (k && kOut > 6 && d < 22 && d > 9 && m.rng() < 0.6) return "chip";
  if (d > 20 && n01(p.a.pow) > 0.6 && pressureOn(m, p) < 0.4 && m.rng() < 0.35) return "power";
  if (Math.abs(p.y) > 4 && n01(p.a.cur) > 0.55 && m.rng() < 0.45) return "finesse";
  if (d < 12 && m.rng() < 0.4) return "low";
  return "shot";
}

// how good is it to keep the ball: space ahead and how close to goal
function keepValue(m, p, pr) {
  const T = m.teams[p.team], dir = T.dir;
  const fa = defenderAhead(m, p);
  const room = fa ? clamp(fa.d / 10, 0, 1) : 1;
  const prog = (p.x * dir + HALF_L) / (2 * HALF_L);
  // in the final third a pressed man moves it on rather than dribble into the crowd
  const crowd = p.x * dir > 17 && pr > 0.45 ? 0.15 : 0;
  return 0.18 + room * 0.35 * (0.6 + n01(p.a.dri) * 0.6) - pr * 0.45 + prog * 0.1 - crowd;
}

// the best pass: every team mate and the through ball, valued by progress, safety and the receiver's space
function bestPass(m, p, pr) {
  const T = m.teams[p.team], dir = T.dir;
  let best = null;
  const vis = n01(p.a.vis);
  for (const q of T.players) {
    if (q === p || q.off) continue;
    const d = hyp(q.x - p.x, q.y - p.y);
    if (d < 4 || d > 48) continue;
    if (isOffside(m, q)) continue;
    const a = Math.atan2(q.y - p.y, q.x - p.x);
    const long = d > 28;
    let spec = long ? planLob(m, p, a, 0.5) : planPass(m, p, a, null, { to: q });
    if (!spec || spec.to !== q && !long) continue;
    const v = spec.v || 14, t = d / Math.max(6, v * 0.75);
    // a long ball is a gamble unless the man is free with room around him
    let risk = long ? 0.38 + (1 - n01(p.a.lpa)) * 0.3 : laneRisk(m, p.team, p.x, p.y, spec.tx, spec.ty, t, null);
    let space = 9;
    for (const o of m.teams[1 - p.team].players) if (!o.off) space = Math.min(space, hyp(o.x - q.x, o.y - q.y));
    const prog = (q.x - p.x) * dir;
    const backPass = prog < -2 ? 0.08 : 0;
    if (long && space < 5) risk += 0.25;
    // player lock: he called for it and the ground lane is shut, so chip it over to him instead
    if (q === m.lock && calling(m) && !long && risk >= 0.5 && d > 10) {
      const ls = planLob(m, p, a, 0.5);
      const lr = 0.3 + (1 - n01(p.a.lpa)) * 0.3 + (space < 3 ? 0.25 : 0);
      if (ls && ls.to === q && lr < risk) { spec = ls; risk = lr; }
    }
    // a man in the box or making a run is worth more
    const qX = q.x * dir, inArea = qX > HALF_L - BOX_D - 2 && Math.abs(q.y) < BOX_HALF;
    let score = (1 - risk) * (0.25 + clamp(prog / 30, -0.3, 0.6) + clamp(space / 12, 0, 0.35) - backPass + (inArea ? 0.2 : 0) + (q.ai.run ? 0.1 : 0)) - (q.gk ? 0.3 : 0) + (pr > 0.5 ? 0.15 : 0) + vis * 0.05 + (m.rng() - 0.5) * 0.1;
    // player lock: he called for it, so he is the first look; only a lane that is all but closed still says no
    if (q === m.lock && calling(m) && risk < 0.85) score += 0.3 + 0.25 * (1 - risk);
    if (!best || score > best.score) best = { spec, score, q };
  }
  // a through ball for a runner
  for (const q of T.players) {
    if (q === p || q.off || q.gk || !q.ai.run) continue;
    const spec = planThrough(m, p, Math.atan2(q.y - p.y, q.x - p.x), 0.5, m.rng() < 0.25);
    if (!spec.to || !(spec.margin > 0.25)) continue;
    // only when the runner clearly wins the race; a vision player sees more of them
    const score = 0.22 + vis * 0.25 + clamp(spec.margin, 0, 1.5) * 0.3 + (m.rng() - 0.5) * 0.12 + (q === m.lock ? 0.2 : 0);
    if (!best || score > best.score) best = { spec, score, q };
  }
  return best;
}

export { SLOT };

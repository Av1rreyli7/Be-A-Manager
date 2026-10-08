// The person's player. Keys become intentions (move, sprint, shield, jockey) and actions (pass, through ball,
// cross, shots of every kind, skills, tackles, slides), never direct moves of the body: the body answers the
// intention with its own limits, the actions go through the same code the AI uses.
//
// Keys (WASD or arrows move; Shift sprints):
//   With the ball: Q pass, T through ball, C cross or lofted ball (low power a driven ball, high power a whipped
//   one), E shoot, R finesse shot, G chip (or a lofted through ball far from goal), F skill, V flair skill (tap
//   F or V again quickly for the bigger move, Shift with F for the cut and flick moves), Z shield, Space knock it
//   on. E then Q before the strike is a fake shot. Hold a key for power, let go to play it.
//   Without it: Q switch player, Space close down and tackle, X slide, Z jockey (Shift with Z to sprint jockey),
//   C bring a team mate to press. A ball coming in the air: E heads or volleys at goal, Q heads to a mate.
import { HALF_L, HALF_W, GOAL_HALF, REACH } from "./consts.mjs";
import { clamp, hyp, angDiff, wrapAng } from "./util.mjs";
import { n01 } from "./attrs.mjs";
import { planPass, planThrough, planLob, planCross, planShot, startKick } from "./kick.mjs";
import { startTackle, startSlide, shoulder } from "./defend.mjs";
import { pickSkill, startSkill } from "./skills.mjs";
import { startHeader, startVolley } from "./aerial.mjs";
import { receive, chase } from "./ai.mjs";
import { canPlay } from "./control.mjs";
import { lockCall, lockRunStart } from "./lock.mjs";

const POWER_T = 0.95; // seconds of holding for full power

// turn whatever the controller sends into { mx, my, sprint, held, down, up }
export function normInput(inp, prev) {
  inp = inp || {};
  if (inp.held) return inp;
  // the old shape: shoot (held), pass, through, slide, skill, cross (pressed), tackle (held)
  const held = { E: !!inp.shoot, Q: false, T: false, C: false, R: false, G: false, F: false, V: false, Z: !!inp.shield, X: false, S: !!inp.tackle };
  const down = { Q: !!inp.pass, T: !!inp.through, X: !!inp.slide, F: !!inp.skill, C: !!inp.cross, E: !!inp.shoot && !(prev && prev.E), S: !!inp.tackle && !(prev && prev.S) };
  const up = {};
  if (inp.pass) up.Q = 0.08;
  if (inp.through) up.T = 0.3;
  if (inp.cross) up.C = 0.5;
  if (prev && prev.E && !inp.shoot) up.E = prev.Et || 0.5;
  return { mx: inp.mx || 0, my: inp.my || 0, sprint: !!inp.sprint, held, down, up, legacy: true };
}

export function createUser(m) {
  return { holdT: {}, prevHeld: {}, lastF: -9, lastV: -9, queue: null, switchT: -9, fakeArmed: false, eT: 0 };
}

// the best player to take over on defence: close to the ball, goal side, not on the floor
export function bestSwitch(m, team, not) {
  const T = m.teams[team], b = m.ball, dir = T.dir;
  let best = null, bs = 1e9;
  for (const p of T.players) {
    if (p.off || p.gk || p === not) continue;
    const d = hyp(p.x - b.x, p.y - b.y);
    const goalSide = (b.x - p.x) * dir > 0 ? 0 : 3;
    const s = d + goalSide + (p.mode === "down" || p.mode === "fall" ? 20 : 0);
    if (s < bs) { bs = s; best = p; }
  }
  return best;
}

export function userStep(m, U, inp, dt) {
  const team = m.userTeam;
  const T = m.teams[team];
  const b = m.ball;
  // hold timers for power
  for (const k of ["E", "Q", "T", "C", "R", "G"]) {
    if (inp.held[k]) U.holdT[k] = (U.holdT[k] || 0) + dt;
    else if (!inp.up || inp.up[k] === undefined) U.holdT[k] = 0;
  }
  // ---------- who is under control ----------
  let p = m.ctrl;
  if (m.lock) p = m.ctrl = m.lock; // player lock: always his own footballer, never a switch
  else {
    if (!p || p.off || p.team !== team) p = m.ctrl = bestSwitch(m, team) || T.players[1];
    if (b.ctrl && b.ctrl.team === team && b.ctrl !== p && !b.ctrl.gk) p = m.ctrl = b.ctrl;
    if (!b.ctrl && b.flight && b.flight.to && b.flight.to.team === team && b.flight.by && b.flight.by.team === team && b.flight.to !== p && !b.flight.to.gk && m.t - b.flight.t > 0.05) p = m.ctrl = b.flight.to;
  }
  const haveIt = b.ctrl === p;
  const ours = b.ctrl ? b.ctrl.team === team : b.held ? b.held.team === team : false;
  // switch on defence
  if (!m.lock && !haveIt && !ours && inp.down.Q && !airborneNear(m, p)) {
    const nb = bestSwitch(m, team, m.t - U.switchT < 0.6 ? p : null);
    if (nb) { p = m.ctrl = nb; U.switchT = m.t; m.events.push({ type: "switch", to: p.id }); }
  }
  // auto switch: far from a loose ball that a team mate is right next to
  if (!m.lock && !haveIt && !b.ctrl && !b.held) {
    const nb = bestSwitch(m, team);
    if (nb && nb !== p && hyp(p.x - b.x, p.y - b.y) > 14 && hyp(nb.x - b.x, nb.y - b.y) < 6 && m.t - U.switchT > 1) { p = m.ctrl = nb; U.switchT = m.t; }
  }
  m.ctrl = p;
  const W = p.want;
  // ---------- movement intention ----------
  const ml = hyp(inp.mx, inp.my);
  const vmax = p.prof.vmax;
  W.dx = ml > 0 ? inp.mx / ml : 0; W.dy = ml > 0 ? inp.my / ml : 0;
  W.spd = ml > 0 ? (inp.sprint ? vmax : vmax * (haveIt ? 0.6 : 0.66)) : 0;
  W.face = null; W.jockey = 0; W.shield = 0; W.close = 0; W.sprint = !!inp.sprint;
  if (p.act && (p.act.k === "slide" || p.act.k === "dive")) return;
  m.hud.power = null;
  // ---------- with the ball ----------
  if (haveIt) {
    W.shield = inp.held.Z ? 1 : 0;
    if (W.shield) {
      // body between the nearest man and the ball, slow and strong
      let near = null, nd = 6;
      for (const o of m.teams[1 - team].players) { const d = hyp(o.x - p.x, o.y - p.y); if (!o.off && d < nd) { nd = d; near = o; } }
      if (near) W.face = Math.atan2(p.y - near.y, p.x - near.x);
      W.spd = Math.min(W.spd, 2.2);
      W.close = 1;
    }
    if (inp.down.S) W.knock = true;
    // fake shot: E charging, then Q
    if (inp.held.E && inp.down.Q && !p.act) {
      const rel = ml > 0 ? angDiff(p.face, Math.atan2(W.dy, W.dx)) : 1;
      startSkill(m, p, "fake_shot", rel >= 0 ? 1 : -1, "shot");
      U.holdT.E = 0; U.cancelE = true;
      return;
    }
    if (!inp.held.E) U.cancelE = false;
    // skills: F, V; a second quick tap upgrades the move that just started
    const rel = ml > 0 ? angDiff(p.face, Math.atan2(W.dy, W.dx)) : null;
    if (inp.down.F || inp.down.V) {
      const key = inp.down.F ? "F" : "V";
      const last = key === "F" ? U.lastF : U.lastV;
      const A = p.act;
      if (A && A.k === "skill" && m.t - last < 0.22 && A.t < A.T * 0.3 && A.done === 0) {
        const up = pickSkill(p, key + key, rel, p.spd > 1.5);
        p.act = null;
        startSkill(m, p, up.id, up.side);
      } else if (!A || A.k !== "kick") {
        const set = key === "F" && inp.sprint ? "SF" : key;
        const pk = pickSkill(p, set, rel, p.spd > 1.5);
        if (A) p.act = null;
        startSkill(m, p, pk.id, pk.side);
      }
      if (key === "F") U.lastF = m.t; else U.lastV = m.t;
      return;
    }
    // power meter while a kick key is held
    for (const k of ["E", "R", "G", "Q", "T", "C"]) if (inp.held[k] && !(k === "E" && U.cancelE)) m.hud.power = { key: k, v: clamp(U.holdT[k] / POWER_T, 0, 1) };
    // kicks on release
    const rel2 = inp.up || {};
    for (const k of ["E", "R", "G", "Q", "T", "C"]) {
      if (rel2[k] === undefined) continue;
      if (k === "E" && U.cancelE) { U.cancelE = false; continue; }
      const power = clamp(rel2[k] / POWER_T, 0, 1);
      const dir = ml > 0 ? Math.atan2(W.dy, W.dx) : p.face;
      const spec = userSpec(m, p, k, power, dir, inp);
      if (spec && !p.act) { startKick(m, p, spec); if (spec.to) m.passIntent(p, spec); }
      return;
    }
    return;
  }
  // ---------- the ball is coming to him, or loose nearby: first time actions and headers ----------
  const coming = b.flight && b.flight.to === p || !b.ctrl && !b.held && hyp(b.x - p.x, b.y - p.y) < 9;
  if (coming && ml === 0 && b.flight && b.flight.to === p) receive(m, p);
  if (coming) {
    const keyDown = ["E", "Q", "T", "C", "R"].find(k => inp.down[k]);
    if (keyDown) U.queue = { key: keyDown, t: m.t };
    if (U.queue && m.t - U.queue.t < 1.6 && canPlay(p) && !p.act) {
      const k = U.queue.key;
      const air = b.z > 1.0 || b.vz > 1;
      if (air && b.z > 1.2) {
        const intent = k === "E" ? (inAttackZone(m, p) ? "shot" : "clear") : "pass";
        const to = intent === "pass" ? pickMate(m, p, ml > 0 ? Math.atan2(W.dy, W.dx) : p.face) : null;
        if (startHeader(m, p, intent, to)) { U.queue = null; return; }
      } else if (air && (k === "E" || k === "R")) {
        const spec = planShot(m, p, aimFrom(m, p, inp), 0.7, "volley");
        if (startVolley(m, p, spec)) { U.queue = null; return; }
      } else if (hyp(b.x - p.x, b.y - p.y) < REACH * 1.1 && b.z < 0.8) {
        // one touch: hit it as it arrives
        const dir = ml > 0 ? Math.atan2(W.dy, W.dx) : p.face;
        const spec = userSpec(m, p, k, k === "E" || k === "R" ? 0.7 : 0.45, dir, inp);
        if (spec) { spec.firstTime = true; startKick(m, p, spec); if (spec.to) m.passIntent(p, spec); U.queue = null; return; }
      }
    }
  } else U.queue = null;
  // ---------- player lock: a team mate has it, so call for it (Q) or make a run in behind (T) ----------
  if (m.lock && ours && !coming) {
    if (inp.down.Q) lockCall(m);
    if (inp.down.T) lockRunStart(m);
  }
  // ---------- defending ----------
  const carrier = b.ctrl && b.ctrl.team !== team ? b.ctrl : null;
  if (inp.held.Z) {
    // jockey: face the ball, low and patient; Shift makes it a sprint jockey
    W.jockey = 1;
    W.face = Math.atan2(b.y - p.y, b.x - p.x);
    W.spd = ml > 0 ? (inp.sprint ? vmax * 0.82 : vmax * 0.5) : 0;
    // no direction held: hold a spot goal side of the man
    if (ml === 0 && carrier) {
      const gx = -T.dir * HALF_L;
      const ux = gx - carrier.x, uy = -carrier.y, ul = hyp(ux, uy) || 1;
      const tx = carrier.x + ux / ul * 1.7, ty = carrier.y + uy / ul * 1.7;
      W.dx = tx - p.x; W.dy = ty - p.y; W.spd = Math.min(vmax * 0.6, hyp(W.dx, W.dy) * 3);
    }
  }
  if (inp.held.C && carrier) m.teamPress = { team, t: m.t };
  if (inp.down.X && !p.act) {
    const dir = ml > 0 ? Math.atan2(W.dy, W.dx) : Math.atan2(b.y - p.y, b.x - p.x);
    startSlide(m, p, dir);
    return;
  }
  if (inp.held.S || inp.down.S) {
    if (carrier) {
      const d = hyp(carrier.x - p.x, carrier.y - p.y);
      const bd = hyp(b.x - p.x, b.y - p.y);
      if (inp.down.S && !p.act) {
        if (d < 1.05 && p.spd > 3.5 && Math.abs(angDiff(p.face, carrier.face)) < 0.7) { shoulder(m, p, carrier); return; }
        if (bd < 2.3) { startTackle(m, p, bd > 1.55); return; }
      }
      // hold Space: close him down, then a contained approach
      if (ml === 0 || inp.held.S) {
        const gx = -T.dir * HALF_L;
        const ux = gx - carrier.x, uy = -carrier.y, ul = hyp(ux, uy) || 1;
        let tx = carrier.x + ux / ul * 1.2, ty = carrier.y + uy / ul * 1.2;
        // coming from behind him: go round his side to get goal side, never through his back
        const ax = tx - p.x, ay = ty - p.y, al = hyp(ax, ay) || 1;
        const along = ((carrier.x - p.x) * ax + (carrier.y - p.y) * ay) / al;
        const off = (-(carrier.x - p.x) * ay + (carrier.y - p.y) * ax) / al;
        if (along > 0 && along < al && Math.abs(off) < 1.1) {
          const s = off >= 0 ? -1 : 1; // pass on the side he is already on
          tx = carrier.x - ay / al * s * 1.4; ty = carrier.y + ax / al * s * 1.4;
        }
        W.dx = tx - p.x; W.dy = ty - p.y;
        W.spd = d > 4 ? vmax * (inp.sprint ? 1 : 0.85) : Math.min(5, d * 1.6);
        if (d < 3.5) { W.face = Math.atan2(carrier.y - p.y, carrier.x - p.x); W.jockey = 1; }
      }
    } else if (!b.held) {
      // a loose ball: go and win it
      chase(m, p);
    }
  }
}

function airborneNear(m, p) { const b = m.ball; return b.z > 1.2 && hyp(b.x - p.x, b.y - p.y) < 6; }
function inAttackZone(m, p) { const T = m.teams[p.team]; return hyp(T.dir * HALF_L - p.x, p.y) < 24; }
function pickMate(m, p, dir) {
  let best = null, bs = 1e9;
  for (const q of m.teams[p.team].players) {
    if (q === p || q.off || q.gk) continue;
    const a = Math.abs(angDiff(dir, Math.atan2(q.y - p.y, q.x - p.x)));
    const d = hyp(q.x - p.x, q.y - p.y);
    const s = a * 8 + d * 0.15;
    if (a < 1 && d < 30 && s < bs) { bs = s; best = q; }
  }
  return best;
}
// the stick picks the corner: up or down the screen (across the goal) from where the player stands
function aimFrom(m, p, inp) {
  const T = m.teams[p.team];
  if (Math.abs(inp.my) < 0.2) return null;
  // W (up the screen, minus y) aims at the minus y post
  return clamp(inp.my, -1, 1);
}

// the kick a key asks for, in the situation the player is in
export function userSpec(m, p, k, power, dir, inp) {
  const T = m.teams[p.team], gx = T.dir * HALF_L;
  const dGoal = hyp(gx - p.x, p.y);
  // a pass behind him from a standstill: a backheel
  if (k === "Q" && Math.abs(angDiff(p.face, dir)) > 2.4 && p.spd < 3.5) { const sp = planPass(m, p, dir, power, {}); sp.kind = "backheel"; return sp; }
  if (k === "Q") return planPass(m, p, dir, power, {});
  if (k === "T") return planThrough(m, p, dir, power, false);
  if (k === "C") {
    const wide = Math.abs(p.y) > 12 && (p.x * T.dir) > HALF_L - 34;
    if (wide) return planCross(m, p, dir, power, power < 0.3);
    return planLob(m, p, dir, power);
  }
  if (k === "G") {
    if (dGoal < 30) return planShot(m, p, aimFrom(m, p, inp), power, "chip");
    return planThrough(m, p, dir, power, true);
  }
  if (k === "R") return planShot(m, p, aimFrom(m, p, inp), power, "finesse");
  if (k === "E") {
    // a power shot when charged right up with room to swing, a low drive with a light touch near goal
    let near = 9;
    for (const o of m.teams[1 - p.team].players) if (!o.off) near = Math.min(near, hyp(o.x - p.x, o.y - p.y));
    // across the body to the strong side with the outside of the boot (a trivela), for those who can
    const toGoal = Math.atan2(-p.y * 0.6, gx - p.x);
    const across = angDiff(p.face, toGoal) * (p.prof.foot > 0 ? 1 : -1); // the strong side is the body's +y side for a right footer
    const kind = power > 0.9 && near > 2.6 ? "power" : power < 0.22 && dGoal < 20 ? "low" : across > 0.7 && p.prof.stars >= 4 && n01(p.a.cur) > 0.7 ? "outside" : "shot";
    return planShot(m, p, aimFrom(m, p, inp), Math.max(power, kind === "low" ? 0.5 : 0.25), kind);
  }
  return null;
}

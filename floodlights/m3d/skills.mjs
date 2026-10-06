// Skill moves. Each move is a short program in the player's own frame: preparation, execution, the ball
// contacts at set moments (where the ball goes relative to the body, how high, which foot), body rotation,
// the exit burst and the recovery. It runs from whatever the player is doing (speed, facing, balance,
// stamina), can be cut short when someone takes the ball, and its feints work on the defenders' reading of the
// play (an AI defender leans the wrong way and reacts late), not on a dice roll.
// The view reads p.act (k "skill", id, t, T, side) and plays the matching body program.
import { BALL_R, REACH } from "./consts.mjs";
import { clamp, hyp, gauss, wrapAng, angDiff, lerp } from "./util.mjs";
import { n01 } from "./attrs.mjs";
import { rollSpeedFor, pressureOn } from "./control.mjs";

// fwd and side are metres in the body frame at the moment of the touch (side +1 is toward the move's side),
// T is how long the ball takes to get there, vz lifts it. feint: [time, strength, side sign]. turn: total body
// rotation in radians toward the side over the move. exit: [time, burst, direction offset in the body frame].
// spd: body speed during the move as a share of the entry speed (floor in m/s).
export const SKILLS = {
  ball_roll:       { name: "Ball roll", stars: 2, dur: 0.6, spd: [0.45, 1.2], lat: 1, touches: [{ at: 0.3, fwd: 0.15, side: 0.75, T: 0.35, kind: "sole" }], exit: [0.62, 0.9, 1.25] },
  body_feint:      { name: "Body feint", stars: 1, dur: 0.5, spd: [0.7, 2], feint: [0.15, 0.6, -1], touches: [{ at: 0.4, fwd: 1.3, side: 0.9, T: 0.45, kind: "outside" }], exit: [0.42, 1, 0.6] },
  stepover:        { name: "Stepover", stars: 2, dur: 0.62, spd: [0.65, 2], feint: [0.22, 0.75, -1], touches: [{ at: 0.5, fwd: 1.4, side: 1.0, T: 0.45, kind: "outside" }], exit: [0.52, 1.05, 0.65] },
  double_stepover: { name: "Double stepover", stars: 3, dur: 0.88, spd: [0.55, 1.8], feint: [0.2, 0.55, 1], feint2: [0.45, 0.7, -1], touches: [{ at: 0.72, fwd: 1.4, side: 1.0, T: 0.45, kind: "outside" }], exit: [0.74, 1.05, 0.65] },
  reverse_stepover:{ name: "Reverse stepover", stars: 2, dur: 0.62, spd: [0.65, 2], feint: [0.22, 0.7, -1], touches: [{ at: 0.5, fwd: 1.3, side: 1.0, T: 0.45, kind: "inside" }], exit: [0.52, 1, 0.65] },
  roulette:        { name: "Roulette", stars: 3, dur: 0.82, spd: [0.35, 1.2], turn: 2 * Math.PI, shield: 1, touches: [{ at: 0.25, fwd: -0.15, side: 0.1, T: 0.3, kind: "sole" }, { at: 0.55, fwd: 0.35, side: 0.9, T: 0.4, kind: "sole", world: true }], exit: [0.78, 0.95, 1.2] },
  drag_back:       { name: "Drag back", stars: 2, dur: 0.58, spd: [0.2, 0.6], turn: Math.PI, touches: [{ at: 0.24, fwd: -1.1, side: 0, T: 0.45, kind: "sole" }], exit: [0.6, 0.9, Math.PI] },
  drag_turn:       { name: "Drag back turn", stars: 2, dur: 0.62, spd: [0.25, 0.8], turn: Math.PI / 2, touches: [{ at: 0.22, fwd: -0.5, side: 0, T: 0.3, kind: "sole" }, { at: 0.45, fwd: -0.2, side: 1.4, T: 0.4, kind: "inside" }], exit: [0.55, 0.95, Math.PI / 2] },
  heel_to_heel:    { name: "Heel to heel", stars: 4, dur: 0.5, spd: [0.7, 2.5], touches: [{ at: 0.18, fwd: 0.1, side: 0.35, T: 0.18, kind: "heel" }, { at: 0.34, fwd: 1.5, side: 0.9, T: 0.4, kind: "heel" }], exit: [0.36, 1.1, 0.55] },
  heel_flick:      { name: "Heel flick", stars: 3, dur: 0.55, spd: [0.75, 2.5], feint: [0.12, 0.45, 1], touches: [{ at: 0.3, fwd: 2.6, side: 0, T: 0.5, kind: "heel" }], exit: [0.32, 1.15, 0] },
  fake_shot:       { name: "Fake shot", stars: 1, dur: 0.58, spd: [0.35, 1], fake: "shot", feint: [0.28, 0.95, 0], touches: [{ at: 0.38, fwd: 0.6, side: 1.25, T: 0.4, kind: "inside" }], exit: [0.42, 1, 1.0] },
  fake_pass:       { name: "Fake pass", stars: 1, dur: 0.52, spd: [0.4, 1.2], fake: "pass", feint: [0.25, 0.7, 0], touches: [{ at: 0.34, fwd: 0.7, side: 1.15, T: 0.4, kind: "inside" }], exit: [0.38, 1, 0.95] },
  elastico:        { name: "Elastico", stars: 5, dur: 0.44, spd: [0.6, 1.8], feint: [0.08, 0.85, -1], touches: [{ at: 0.1, fwd: 0.3, side: -0.4, T: 0.12, kind: "outside" }, { at: 0.23, fwd: 1.2, side: 1.2, T: 0.38, kind: "inside" }], exit: [0.26, 1.25, 0.8] },
  reverse_elastico:{ name: "Reverse elastico", stars: 5, dur: 0.44, spd: [0.6, 1.8], feint: [0.08, 0.8, -1], touches: [{ at: 0.1, fwd: 0.3, side: -0.4, T: 0.12, kind: "inside" }, { at: 0.23, fwd: 1.2, side: 1.2, T: 0.38, kind: "outside" }], exit: [0.26, 1.2, 0.8] },
  croqueta:        { name: "La croqueta", stars: 3, dur: 0.46, spd: [0.55, 1.5], lat: 0.7, shield: 0.6, touches: [{ at: 0.14, fwd: 0.2, side: 0.6, T: 0.15, kind: "inside" }, { at: 0.3, fwd: 1.3, side: 1.1, T: 0.4, kind: "inside" }], exit: [0.32, 1.1, 0.7] },
  rainbow:         { name: "Rainbow flick", stars: 4, dur: 0.92, spd: [0.7, 3], touches: [{ at: 0.28, fwd: 4.6, side: 0, T: 1.1, vz: 6.2, kind: "scoop" }], exit: [0.4, 1.15, 0] },
  sombrero:        { name: "Sombrero flick", stars: 4, dur: 0.78, spd: [0.3, 0.8], touches: [{ at: 0.3, fwd: 2.2, side: 0.25, T: 0.8, vz: 4.2, kind: "flick" }], exit: [0.42, 1.1, 0.15] },
  ball_hop:        { name: "Ball hop", stars: 2, dur: 0.46, spd: [0.85, 2.5], hop: 1, touches: [{ at: 0.16, fwd: 1.5, side: 0, T: 0.45, vz: 1.6, kind: "hop" }], exit: [0.3, 1, 0] },
  mcgeady:         { name: "Spin flick", stars: 4, dur: 0.66, spd: [0.45, 1.5], turn: -Math.PI * 0.9, touches: [{ at: 0.38, fwd: 1.9, side: 1.3, T: 0.45, vz: 0.6, kind: "flick", world: true }], exit: [0.5, 1.15, 0.6] },
  heel_chop:       { name: "Heel chop", stars: 3, dur: 0.56, spd: [0.35, 1.2], turn: Math.PI / 2, feint: [0.12, 0.5, 0], touches: [{ at: 0.26, fwd: -0.1, side: 1.5, T: 0.38, kind: "heel" }], exit: [0.4, 1, Math.PI / 2] },
  v_drag:          { name: "V drag", stars: 3, dur: 0.6, spd: [0.35, 1], touches: [{ at: 0.18, fwd: -0.55, side: 0.1, T: 0.25, kind: "sole" }, { at: 0.42, fwd: 0.9, side: 1.2, T: 0.38, kind: "inside" }], exit: [0.46, 1.05, 0.9] },
  reverse_drag:    { name: "Reverse drag", stars: 3, dur: 0.62, spd: [0.25, 0.8], turn: Math.PI, touches: [{ at: 0.2, fwd: -0.5, side: 0, T: 0.25, kind: "sole" }, { at: 0.45, fwd: -1.4, side: -0.6, T: 0.4, kind: "outside" }], exit: [0.55, 0.95, Math.PI * 0.85] },
  sole_roll:       { name: "Sole roll", stars: 2, dur: 0.62, spd: [0.25, 0.8], lat: 0.9, touches: [{ at: 0.3, fwd: 0.05, side: 0.9, T: 0.35, kind: "sole" }], exit: [0.62, 0.85, Math.PI / 2] },
  toe_taps:        { name: "Toe taps", stars: 1, dur: 0.95, spd: [0, 0], hold: 1, touches: [{ at: 0.15, fwd: 0.35, side: 0.12, T: 0.15, kind: "tap" }, { at: 0.38, fwd: 0.35, side: -0.12, T: 0.15, kind: "tap" }, { at: 0.6, fwd: 0.35, side: 0.12, T: 0.15, kind: "tap" }, { at: 0.82, fwd: 0.38, side: 0, T: 0.15, kind: "tap" }] },
  stop_and_go:     { name: "Stop and go", stars: 2, dur: 0.72, spd: [0.05, 0.3], feint: [0.18, 0.6, 0], touches: [{ at: 0.14, fwd: 0.3, side: 0, T: 0.2, kind: "stop" }, { at: 0.52, fwd: 2.2, side: 0, T: 0.5, kind: "inside" }], exit: [0.54, 1.25, 0] },
  inside_out:      { name: "Inside out", stars: 3, dur: 0.46, spd: [0.8, 3], feint: [0.1, 0.55, -1], touches: [{ at: 0.12, fwd: 0.9, side: -0.45, T: 0.2, kind: "inside" }, { at: 0.3, fwd: 1.6, side: 1.0, T: 0.4, kind: "outside" }], exit: [0.33, 1.15, 0.5] },
  outside_in:      { name: "Outside in", stars: 3, dur: 0.46, spd: [0.8, 3], feint: [0.1, 0.55, -1], touches: [{ at: 0.12, fwd: 0.9, side: -0.45, T: 0.2, kind: "outside" }, { at: 0.3, fwd: 1.6, side: 1.0, T: 0.4, kind: "inside" }], exit: [0.33, 1.15, 0.5] },
  lateral_heel:    { name: "Lateral heel flick", stars: 3, dur: 0.52, spd: [0.4, 1.3], touches: [{ at: 0.24, fwd: 0.05, side: 1.4, T: 0.35, kind: "heel" }], exit: [0.4, 1, Math.PI / 2] },
  spin_turn:       { name: "Spin turn", stars: 3, dur: 0.62, spd: [0.2, 0.6], turn: Math.PI, shield: 1, touches: [{ at: 0.32, fwd: -1.3, side: 0.2, T: 0.4, kind: "sole" }], exit: [0.6, 1, Math.PI] },
  adv_flick:       { name: "Directional flick", stars: 4, dur: 0.42, spd: [0.9, 3], feint: [0.06, 0.4, -1], touches: [{ at: 0.14, fwd: 2.6, side: 1.2, T: 0.5, vz: 0.4, kind: "flick" }], exit: [0.18, 1.3, 0.45] }
};

// a simpler stand in when a player lacks the skill level for the move he asked for
const DOWNGRADE = { elastico: "body_feint", reverse_elastico: "body_feint", rainbow: "ball_hop", sombrero: "ball_hop", heel_to_heel: "ball_roll", mcgeady: "stepover", adv_flick: "body_feint", double_stepover: "stepover", roulette: "drag_turn", croqueta: "ball_roll", heel_flick: "body_feint", heel_chop: "drag_turn", v_drag: "drag_back", reverse_drag: "drag_back", inside_out: "body_feint", outside_in: "body_feint", lateral_heel: "ball_roll", spin_turn: "drag_back", stepover: "body_feint", reverse_stepover: "body_feint", ball_roll: "body_feint", drag_back: "body_feint", drag_turn: "body_feint", sole_roll: "body_feint", ball_hop: "body_feint", stop_and_go: "body_feint" };

// which move a key and a direction ask for. rel is the input angle relative to the body (0 = straight on),
// null when no direction is held. set: "F", "FF" (F twice), "V", "VV", "SF" (Shift with F).
export function pickSkill(p, set, rel, moving) {
  const a = rel === null ? null : Math.abs(rel);
  const side = rel === null ? 1 : rel >= 0 ? 1 : -1;
  const sector = a === null ? "none" : a < 0.4 ? "fwd" : a < 1.2 ? "diag" : a < 1.95 ? "side" : a < 2.75 ? "bdiag" : "back";
  const strong = p.prof.foot > 0 ? 1 : -1; // a right footer's strong side is the body's +y side (his right on screen)
  let id;
  const T = {
    F: { none: moving ? "stop_and_go" : "toe_taps", fwd: "stepover", diag: "body_feint", side: "ball_roll", bdiag: "drag_turn", back: "drag_back" },
    FF: { none: "sole_roll", fwd: "double_stepover", diag: "reverse_stepover", side: "croqueta", bdiag: "v_drag", back: "reverse_drag" },
    V: { none: "fake_shot", fwd: "ball_hop", diag: "elastico", side: "roulette", bdiag: "heel_chop", back: "spin_turn" },
    VV: { none: "sombrero", fwd: "rainbow", diag: "mcgeady", side: "lateral_heel", bdiag: "heel_to_heel", back: "heel_flick" },
    SF: { none: "adv_flick", fwd: "adv_flick", diag: "inside_out", side: "adv_flick", bdiag: "inside_out", back: "drag_back" }
  };
  id = (T[set] || T.F)[sector];
  // the elastico goes toward the weak side; toward the strong side it is the reverse elastico
  if (id === "elastico" && side === strong) id = "reverse_elastico";
  if (id === "inside_out" && side === strong) id = "outside_in";
  return { id, side };
}

// start a move: chosen from the input, dropped to a simpler one if the player is not good enough
export function startSkill(m, p, id, side, fake) {
  let def = SKILLS[id];
  if (!def) return false;
  if (p.prof.stars < def.stars) { id = DOWNGRADE[id] || "body_feint"; def = SKILLS[id]; if (p.prof.stars < def.stars) { id = "body_feint"; def = SKILLS.body_feint; } }
  const tech = n01((p.a.dri * 0.5 + p.a.agi * 0.25 + p.a.bal * 0.25));
  const pr = pressureOn(m, p);
  // execution quality: technique, balance, pressure and fatigue, with a little luck
  const q = clamp(0.45 + tech * 0.5 - pr * 0.12 * (1.2 - n01(p.a.com)) - (1 - p.bal) * 0.3 - (1 - p.stam) * 0.12 + gauss(m.rng) * 0.08, 0.05, 1);
  const speed = 1.28 - tech * 0.36 + (1 - p.stam) * 0.1; // the elite do it quicker
  p.act = {
    k: "skill", id, def, side, t: 0, T: def.dur * speed, q, busy: true, turnK: 0.25, lock: 0,
    face0: p.face, sp0: Math.max(p.spd, 0.5), done: 0, feinted: 0, exitDir: null, fake: fake || null
  };
  m.events.push({ type: "skill", by: p.id, id, name: def.name, q });
  m.stats.skills[p.team]++;
  return true;
}

// the defenders near the dribbler read the feint: they lean that way and react late to the real move
function feint(m, p, strength, sideSign, A) {
  const fdir = wrapAng(A.face0 + sideSign * A.side * Math.PI / 2);
  for (const d of m.teams[1 - p.team].players) {
    if (d.off || d.gk && !A.fake) continue;
    const dist = hyp(d.x - p.x, d.y - p.y);
    if (dist > 4.5) continue;
    // a defender facing the ball reads it, a smart one is fooled less
    const facing = Math.cos(angDiff(d.face, Math.atan2(p.y - d.y, p.x - d.x)));
    if (facing < 0.2) continue;
    const fooled = strength * A.q * (1.25 - n01(d.a.awa) * 0.55 - n01(d.a.rea) * 0.2) * facing;
    if (fooled <= 0.05) continue;
    d.feinted = { dir: sideSign === 0 ? null : fdir, until: m.t + 0.25 + fooled * 0.45, k: fooled, block: A.fake === "shot" };
    // a fooled defender also shifts his weight: a small step the wrong way
    if (sideSign !== 0 && d !== m.ctrl) { d.vx += Math.cos(fdir) * fooled * 1.6; d.vy += Math.sin(fdir) * fooled * 1.6; }
    if (A.fake === "shot" && d.gk) d.feinted.keeper = true;
  }
  m.events.push({ type: "feint", by: p.id, k: strength * A.q });
}

export function updateSkill(m, p, dt) {
  const A = p.act, def = A.def, b = m.ball;
  A.t += dt;
  const f = A.t / A.T;
  // cut short: the ball is gone or the body is
  if (b.ctrl !== p && A.done > 0 && hyp(b.x - p.x, b.y - p.y) > 3) { p.act = null; return; }
  if (p.mode === "stumble" || p.mode === "fall") { p.act = null; return; }
  const c0 = Math.cos(A.face0), s0 = Math.sin(A.face0);
  // body: slow to the move's speed, drift with lateral moves, rotate for spins
  const W = p.want;
  const base = Math.max(def.spd[1], A.sp0 * def.spd[0]);
  let dirAng = A.face0;
  if (def.lat) dirAng = wrapAng(A.face0 + A.side * Math.PI / 2 * def.lat * clamp(f * 2, 0, 1));
  if (def.turn) {
    const turnNow = def.turn * clamp((f - 0.1) / 0.75, 0, 1);
    W.face = wrapAng(A.face0 + A.side * turnNow);
    A.turnK = 3;
  } else W.face = def.lat ? A.face0 : null;
  W.dx = Math.cos(dirAng); W.dy = Math.sin(dirAng); W.spd = def.hold ? 0 : base;
  // feints
  if (def.feint && A.feinted < 1 && f >= def.feint[0]) { A.feinted = 1; feint(m, p, def.feint[1], def.feint[2], A); }
  if (def.feint2 && A.feinted < 2 && f >= def.feint2[0]) { A.feinted = 2; feint(m, p, def.feint2[1], def.feint2[2], A); }
  // ball contacts
  const tc = def.touches[A.done];
  if (tc && f >= tc.at) {
    A.done++;
    const bd = hyp(b.x - p.x, b.y - p.y);
    if (bd > REACH * 1.25 || b.z > 0.9) {
      // the ball is not where the move needs it: the move breaks down
      m.events.push({ type: "skill_fail", by: p.id, id: A.id });
      p.act = null; return;
    }
    // in the body frame of the start, or of the current facing for spins (world)
    const fa = tc.world ? p.face : A.face0;
    const cf = Math.cos(fa), sf = Math.sin(fa);
    const lx = tc.fwd, ly = tc.side * A.side;
    const err = (1 - A.q) * 0.45 + 0.04;
    const tx = p.x + cf * lx - sf * ly + p.vx * tc.T * 0.6 + gauss(m.rng) * err;
    const ty = p.y + sf * lx + cf * ly + p.vy * tc.T * 0.6 + gauss(m.rng) * err;
    const D = hyp(tx - b.x, ty - b.y), ang = Math.atan2(ty - b.y, tx - b.x);
    if (tc.vz) {
      // a lift: solve a simple ballistic hop to land near the target
      const T = tc.T * (1 + gauss(m.rng) * 0.08 * (1.2 - A.q));
      const vh = D / Math.max(0.2, T);
      b.vx = Math.cos(ang) * vh; b.vy = Math.sin(ang) * vh; b.vz = tc.vz * (0.92 + A.q * 0.12);
      b.wx = b.wy = b.wz = 0;
      if (b.z < BALL_R) b.z = BALL_R;
    } else {
      const v = tc.kind === "stop" ? 0 : rollSpeedFor(D, tc.T);
      b.vx = Math.cos(ang) * v; b.vy = Math.sin(ang) * v; b.vz = 0;
      b.wx = -b.vy / BALL_R; b.wy = b.vx / BALL_R; b.wz = 0;
    }
    b.ctrl = p; b.last = p; b.lastTeam = p.team; b.touchT = 0; b.immune = p; b.immuneT = 0.15; b.flight = null;
    p.touch = { t: m.t, foot: tc.kind === "outside" ? (p.prof.foot > 0 ? 0 : 1) : (A.side > 0 ? 0 : 1), kind: tc.kind, x: b.x, y: b.y };
    m.events.push({ type: "touch", by: p.id, kind: tc.kind, skill: A.id });
    p.drib.lastT = m.t; p.drib.since = 0;
    if (def.hop) p.vz = Math.max(p.vz, 1.6);
  }
  // the exit: an explosive burst in the new direction
  if (def.exit && f >= def.exit[0] && !A.exitDir) {
    A.exitDir = wrapAng(A.face0 + A.side * def.exit[2]);
    p.boostT = m.t + 0.35; p.boost = def.exit[1] * (0.85 + A.q * 0.3);
  }
  if (A.exitDir !== null) {
    W.dx = Math.cos(A.exitDir); W.dy = Math.sin(A.exitDir); W.face = null;
    W.spd = Math.max(base, p.prof.vmax * 0.8);
    A.turnK = 1.4;
  }
  if (A.t >= A.T) {
    p.act = null;
    p.bal -= 0.08 * (1.2 - A.q);
  }
}

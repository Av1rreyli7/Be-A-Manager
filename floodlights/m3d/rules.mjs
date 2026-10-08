// The referee and the laws: the clock and the halves, goals, the ball going out, offside, fouls with advantage,
// cards, knocks, and every restart (kick off, throw in, goal kick, corner, free kick with a wall, penalty).
// At a restart nobody is moved by magic: players walk or jog to their places and the restart goes when the
// taker is on the ball and the others are set (or after a sensible wait).
import { HALF_L, HALF_W, GOAL_HALF, BAR_H, BALL_R, BOX_D, BOX_HALF, SIX_D, SIX_HALF, SPOT_D, CIRCLE_R, MATCH_SECONDS, HALF_SECONDS, MAX_GOALS } from "./consts.mjs";
import { clamp, hyp, lerp, angDiff, shortName } from "./util.mjs";
import { n01 } from "./attrs.mjs";
import { startKick, planPass, planLob, planCross, planShot, planThrough, isOffside } from "./kick.mjs";
import { shapeTarget } from "./ai.mjs";
import { fallDown } from "./body.mjs";

export function say(m, text, kind) { m.events.push({ type: "say", text, kind: kind || "info" }); }

// ---------- the clock ----------
export function minuteOf(m) {
  const half = m.half === 1 ? 0 : 45;
  const into = m.half === 1 ? m.clock : m.clock - HALF_SECONDS;
  return Math.min(half + 45 + 5, half + Math.floor(into / HALF_SECONDS * 45) + 1);
}

// ---------- offside: judged when the ball is played forward to a team mate ----------
export function markOffside(m, p, kind) {
  if (kind === "throw" || kind === "goalkick" || kind === "corner") { m.offside = null; return; }
  const T = m.teams[p.team];
  const off = new Set();
  for (const q of T.players) if (q !== p && !q.off && isOffside(m, q)) off.add(q.id);
  m.offside = off.size ? { team: p.team, ids: off, t: m.t, x: m.ball.x } : null;
}
// call it when a flagged player is the next to play the ball
export function touched(m, p) {
  const O = m.offside;
  if (!O) return false;
  if (p.team !== O.team) { m.offside = null; return false; }
  if (!O.ids.has(p.id)) { m.offside = null; return false; }
  m.offside = null;
  m.stats.offsides[p.team]++;
  m.events.push({ type: "offside", by: p.id, team: p.team, banner: "OFFSIDE" });
  say(m, "The flag is up. " + p.short + " was caught offside.", "off");
  startRestart(m, "freekick", 1 - p.team, p.x, p.y, { indirect: true });
  return true;
}

// ---------- goals and the ball going out ----------
export function checkBall(m) {
  if (m.phase !== "play") return;
  const b = m.ball;
  if (b.held) return;
  const ax = Math.abs(b.x);
  // a goal: the whole ball over the line, between the posts and under the bar
  if (ax > HALF_L + BALL_R && Math.abs(b.y) < GOAL_HALF - 0.02 && b.z < BAR_H - 0.02) {
    const side = Math.sign(b.x);
    // the team attacking that end scores
    const scorer = m.teams[0].dir === side ? 0 : 1;
    goal(m, scorer);
    return;
  }
  if (Math.abs(b.y) > HALF_W + BALL_R) {
    // throw in to the team that did not touch it last
    const team = 1 - (b.lastTeam < 0 ? 0 : b.lastTeam);
    startRestart(m, "throwin", team, clamp(b.x, -HALF_L + 1, HALF_L - 1), Math.sign(b.y) * (HALF_W + 0.25));
    return;
  }
  if (ax > HALF_L + BALL_R) {
    const side = Math.sign(b.x);
    const defending = m.teams[0].dir === side ? 1 : 0; // the team whose goal is at this end
    if (b.lastTeam === defending) startRestart(m, "corner", 1 - defending, side * (HALF_L - 0.3), Math.sign(b.y || 1) * (HALF_W - 0.3));
    else startRestart(m, "goalkick", defending, side * (HALF_L - SIX_D + 0.5), Math.sign(b.y || 1) * (SIX_HALF - 2));
  }
}

function goal(m, team) {
  const b = m.ball;
  if (m.score[team] >= MAX_GOALS) { startRestart(m, "kickoff", 1 - team, 0, 0); return; }
  m.score[team]++;
  // a shot that was on target stays the shooter's goal after a keeper's touch or a deflection; it is only an own
  // goal when the defender's touch turned a ball that was going wide into the net
  const S = m.lastShot;
  const shooter = b.lastTeam !== team && S && S.on && S.by.team === team && m.t - S.t < 4 ? S.by : null;
  const own = b.lastTeam !== team && !shooter;
  const by = shooter || (own ? b.last : (b.last && b.last.team === team ? b.last : null));
  // the assist: the last team mate who passed to the scorer
  const assist = !own && m.lastPass && m.lastPass.to === by && m.lastPass.by.team === team && m.t - m.lastPass.t < 8 ? m.lastPass.by : null;
  const min = minuteOf(m);
  m.goals.push({ team, by: by ? by.name : "", own, min, assist: assist ? assist.name : null });
  m.events.push({ type: "goal", team, by: by ? by.id : -1, own, min, assist: assist ? assist.id : -1, x: b.x, y: b.y, z: b.z, banner: "GOAL" });
  if (by) by.celebrate = { t: m.t, style: Math.floor(by.prof.style * 6) };
  for (const p of m.teams[team].players) if (p !== by && !p.off) p.mood = { k: "joy", t: m.t };
  for (const p of m.teams[1 - team].players) if (!p.off) p.mood = { k: "down", t: m.t };
  say(m, own ? "Own goal! " + (by ? by.short : "A defender") + " turns it into his own net." : (by ? by.short : m.teams[team].name) + " scores! " + m.teams[team].name + " " + m.score[team] + ", " + m.teams[1 - team].name + " " + m.score[1 - team] + ".", "goal");
  m.phase = "goal"; m.phaseT = 0; m.dead = true;
  m.restart = null;
  m.nextKick = 1 - team;
}

// ---------- fouls ----------
export function foul(m, by, on, kind, sev) {
  if (m.phase !== "play" || m.dead) return;
  if (!by || !on || by.team === on.team) return;
  if (m.t - (m.lastFoulT || -9) < 0.6) return;
  m.lastFoulT = m.t;
  m.stats.fouls[by.team]++;
  const dirBy = m.teams[by.team].dir;
  const ownGoalX = -dirBy * HALF_L;
  const x = on.x, y = on.y;
  const inBox = Math.abs(x - ownGoalX) < BOX_D && Math.abs(y) < BOX_HALF && Math.sign(x - ownGoalX) === dirBy;
  // denying an obvious goal scoring chance: central, heading for goal, nobody covering
  const toGoal = hyp(x - ownGoalX, y);
  let cover = 0;
  for (const d of m.teams[by.team].players) if (d !== by && !d.off && !d.gk && Math.abs(d.x - ownGoalX) < Math.abs(x - ownGoalX) - 1) cover++;
  const headingIn = (on.vx * (ownGoalX - on.x) + on.vy * (0 - on.y)) / (toGoal || 1) > 3;
  const dogso = toGoal < 28 && Math.abs(y) < 14 && cover === 0 && m.ball.ctrl === on && headingIn;
  let card = null;
  // the referee: a red for denying a clear chance or a dangerous tackle, a yellow for a reckless one
  if (dogso && !inBox || sev > 0.97) card = "red";
  else if (sev > 0.8 || dogso && inBox || kind === "slide" && sev > 0.7 && m.rng() < 0.6) card = "yellow";
  else if (sev > 0.6 && m.rng() < 0.25) card = "yellow";
  // advantage: the fouled side still has it going forward in their attacking half, play on
  const onTeam = m.teams[on.team];
  const keeps = m.ball.ctrl && m.ball.ctrl.team === on.team && m.ball.ctrl !== on;
  const advantage = !inBox && keeps && x * onTeam.dir > 5 && !card;
  m.events.push({ type: "foul", by: by.id, on: on.id, kind, card, x, y, banner: advantage ? "ADVANTAGE" : null });
  if (card) giveCard(m, by, card);
  // a knock: a bad one can leave him carrying it for the rest of the game
  if (sev > 0.72 && m.rng() < 0.3) { on.knock = Math.min(0.6, on.knock + 0.2 + m.rng() * 0.25); m.events.push({ type: "injury", by: on.id }); say(m, on.short + " is down and in pain. He will try to carry on.", "info"); }
  // reactions: the fouled player complains, team mates gather
  on.mood = { k: "angry", t: m.t };
  by.gest = { k: "appeal", t: m.t, T: 1.4 };
  if (advantage) { say(m, "Foul by " + by.short + ", but the referee plays the advantage.", "foul"); return; }
  say(m, (kind === "slide" ? "A late slide from " : kind === "push" ? "A push in the back from " : "Foul by ") + by.short + (inBox ? ". Penalty!" : "."), "foul");
  if (inBox) startRestart(m, "penalty", on.team, ownGoalX + dirBy * SPOT_D, 0);
  else startRestart(m, "freekick", on.team, x, y);
}

function giveCard(m, p, color) {
  if (color === "yellow" && p.card === 1) color = "red2";
  if (color === "yellow") { p.card = 1; m.stats.yellow[p.team]++; }
  else {
    p.card = 2; m.stats.red[p.team]++;
    p.sentOff = m.t;
  }
  m.events.push({ type: "card", by: p.id, color: color === "red2" ? "red" : color, second: color === "red2", banner: color === "yellow" ? "YELLOW CARD" : "RED CARD" });
  say(m, color === "yellow" ? "Yellow card for " + p.short + "." : color === "red2" ? "A second yellow. " + p.short + " is off!" : "Straight red! " + p.short + " is sent off.", "card");
}

// ---------- restarts ----------
export function startRestart(m, kind, team, x, y, opts) {
  opts = opts || {};
  const b = m.ball;
  m.phase = "restart"; m.phaseT = 0; m.dead = true;
  b.ctrl = null; b.held = null; b.flight = null;
  // the ball is dead: whatever anyone was doing (a dive, a slide, a kick) ends here
  for (const p of m.players) { if (p.act) p.act = null; p.dive = null; p.hands = null; p.headerDive = null; if (p.gk) p.gkState = "pos"; }
  // the ball rolls on a moment before it is brought back; the view shows it gathered
  m.clearSetPieceAt = 0;
  m.restart = { kind, team, x, y, t: 0, ready: false, taker: null, indirect: !!opts.indirect, wall: [], placed: false, aim: null, userAim: { dx: 0, dy: 0 } };
  m.offside = null;
  if (kind !== "kickoff") m.stats[kind === "corner" ? "corners" : kind === "freekick" ? "freekicks" : kind === "penalty" ? "pens" : "restarts"][team]++;
  const T = m.teams[team];
  m.restart.taker = pickTaker(m, kind, T, x, y);
  m.setPiece = { kind, team, x, y, phase: "setup" };
  const banner = { throwin: null, goalkick: "GOAL KICK", corner: "CORNER", freekick: opts.indirect ? "FREE KICK" : "FREE KICK", penalty: "PENALTY", kickoff: null }[kind];
  m.events.push({ type: kind, team, x, y, banner });
  if (kind === "corner") say(m, "Corner to " + T.name + ".", "info");
  if (kind === "goalkick") say(m, "Goal kick.", "info");
  if (kind === "throwin" && m.rng() < 0.3) say(m, "Throw in, " + T.name + ".", "info");
  // walls for direct free kicks near goal
  if (kind === "freekick" && !opts.indirect) {
    const O = m.teams[1 - team];
    const gx = T.dir * HALF_L;
    const d = hyp(gx - x, y);
    if (d < 32) {
      const n = d < 20 ? 5 : d < 26 ? 4 : 3;
      const ux = (gx - x) / d, uy = (0 - y) / d;
      const wx = x + ux * 9.15, wy = y + uy * 9.15;
      const cand = O.players.filter(p => !p.gk && !p.off).sort((a, c) => hyp(a.x - wx, a.y - wy) - hyp(c.x - wx, c.y - wy)).slice(0, n);
      // the wall lines up across the line to the near post
      cand.forEach((p, i) => { const off = (i - (n - 1) / 2) * 0.62 + Math.sign(y || 1) * 0.6; m.restart.wall.push({ p, x: wx - uy * off, y: wy + ux * off }); });
    }
  }
}

function pickTaker(m, kind, T, x, y) {
  const av = T.players.filter(p => !p.off && p.mode !== "down");
  if (kind === "goalkick") return T.gk || av[0];
  if (kind === "kickoff") return av.filter(p => p.role === "ST" || p.role === "CAM").sort((a, c) => c.r - a.r)[0] || av[av.length - 1];
  if (kind === "penalty") return av.filter(p => !p.gk).sort((a, c) => (c.a.fin + c.a.com) - (a.a.fin + a.a.com))[0];
  if (kind === "corner" || kind === "freekick" && hyp(T.dir * HALF_L - x, y) < 35) {
    // the specialists: the best three over a dead ball, and of those the one nearest the ball
    const best = av.filter(p => !p.gk).sort((a, c) => (c.a.cro + c.a.cur + (kind === "freekick" ? c.a.fin : 0)) - (a.a.cro + a.a.cur + (kind === "freekick" ? a.a.fin : 0))).slice(0, 3);
    return best.sort((a, c) => hyp(a.x - x, a.y - y) - hyp(c.x - x, c.y - y))[0];
  }
  // throw ins and other free kicks: the nearest outfield player
  return av.filter(p => !p.gk || kind === "freekick" && Math.abs(x - (-T.dir * HALF_L)) < 20).sort((a, c) => hyp(a.x - x, a.y - y) - hyp(c.x - x, c.y - y))[0];
}

// where everyone stands for this restart
function restartSpot(m, p, R) {
  const T = m.teams[p.team], dir = T.dir, att = p.team === R.team;
  if (p === R.taker) {
    if (R.kind === "throwin") return { x: R.x, y: R.y };
    if (R.kind === "penalty") return { x: R.x - dir * 1.6, y: dir * 0.3 };
    const ux = R.kind === "corner" ? -Math.sign(R.x) * 0.5 : -dir * 0.8;
    return { x: R.x + ux, y: R.y + (R.kind === "corner" ? -Math.sign(R.y) * 0.7 : 0) };
  }
  const w = R.wall.find(q => q.p === p);
  if (w) return { x: w.x, y: w.y };
  const goalAtt = T.dir * HALF_L;
  if (R.kind === "kickoff") {
    const s = shapeTarget(m, p);
    // everyone in their own half, out of the circle unless they are taking it
    let x = Math.min(s.x * dir, -1.2) * dir, y = s.y;
    if (hyp(x, y) < CIRCLE_R + 0.5 && p.team !== R.team) { const a = Math.atan2(y, x); x = Math.cos(a) * (CIRCLE_R + 0.8); y = Math.sin(a) * (CIRCLE_R + 0.8); }
    if (p.team === R.team && p.role === "ST" && p !== R.taker) return { x: -dir * 0.5, y: dir * 2 };
    return { x, y };
  }
  if (R.kind === "penalty") {
    if (p.gk && !att) return { x: -dir * HALF_L * -1 * 0 + (m.teams[R.team].dir * HALF_L), y: 0 };
    if (p.gk) return { x: -dir * (HALF_L - 6), y: 0 };
    const gx = m.teams[R.team].dir * HALF_L;
    const i = p.slotI;
    return { x: gx - m.teams[R.team].dir * (BOX_D + 2 + (i % 3)), y: m.teams[R.team].dir * (i - 5) * 2.4 };
  }
  if (R.kind === "corner" || R.kind === "freekick" && hyp(m.teams[R.team].dir * HALF_L - R.x, R.y) < 40) {
    const aDir = m.teams[R.team].dir, gx = aDir * HALF_L;
    if (p.gk) return att ? { x: -aDir * (HALF_L - 25), y: 0 } : { x: gx - aDir * 0.6, y: R.kind === "corner" ? Math.sign(R.y) * 0.8 : clamp(R.y * 0.1, -1.5, 1.5) };
    if (att) {
      // attackers attack the spaces: near post, six yard box, penalty spot, far post, edge of the box, two stay back
      const spots = [[5.5, 2.5], [6, -1], [10, 0.5], [7, -4.5], [16.5, 2], [14, -6], [9, 4], [-40, 10], [-40, -10], [-30, 0]];
      const s = spots[p.slotI % spots.length];
      const side = R.kind === "corner" ? Math.sign(R.y) : Math.sign(R.y || 1);
      if (s[0] < 0) return { x: aDir * (s[0] * -1 > 35 ? -10 : 0) + (-aDir * 10), y: aDir * s[1] };
      return { x: gx - aDir * s[0], y: side * s[1] };
    }
    // defenders: zonal across the six yard box, the rest pick up the attackers
    const zonal = [[1.5, 3.5], [3.5, 0], [5.5, 4.5], [5.5, -2.5], [10, 3], [10, -3], [14, 0]];
    const z = zonal[p.slotI % zonal.length];
    const side = Math.sign(R.y || 1);
    return { x: gx - aDir * z[0], y: side * z[1] };
  }
  // throw ins, goal kicks, deep free kicks: the shape around the ball
  const s = shapeTarget(m, p);
  if (R.kind === "goalkick" && !att) {
    // the other side waits outside the box
    const gk = m.teams[R.team].dir * -1 * HALF_L;
    if (Math.abs(s.x - gk) < BOX_D + 1 && Math.abs(s.y) < BOX_HALF + 1) return { x: gk + m.teams[R.team].dir * (BOX_D + 2), y: s.y };
  }
  if (!att && hyp(s.x - R.x, s.y - R.y) < 9.5 && R.kind === "freekick") { const a = Math.atan2(s.y - R.y, s.x - R.x); return { x: R.x + Math.cos(a) * 9.6, y: R.y + Math.sin(a) * 9.6 }; }
  return s;
}

// every step of a restart: walk into place, then go
export function updateRestart(m, dt, userTeam, input, aiTakes) {
  const R = m.restart;
  if (!R) return;
  R.t += dt;
  const b = m.ball;
  // bring the ball to the spot (it is dead: no physics until it is played)
  b.x += (R.x - b.x) * Math.min(1, dt * 8); b.y += (R.y - b.y) * Math.min(1, dt * 8);
  b.z = R.kind === "throwin" && R.placed ? 2 : 0.11; b.vx = b.vy = b.vz = 0; b.wx = b.wy = b.wz = 0;
  let farthest = 0, farNear = 0;
  for (const p of m.players) {
    if (p.off) continue;
    const s = restartSpot(m, p, R);
    const d = hyp(s.x - p.x, s.y - p.y);
    if (p !== R.taker) farthest = Math.max(farthest, d);
    // the players whose spot is around the ball (the box at a corner), not the two left back at halfway
    if (p !== R.taker && hyp(s.x - R.x, s.y - R.y) < 35) farNear = Math.max(farNear, d);
    const W = p.want;
    W.dx = s.x - p.x; W.dy = s.y - p.y;
    // the taker hurries to the ball, the others get into position at a brisk run
    W.spd = d < 0.25 ? 0 : p === R.taker ? Math.min(p.prof.vmax, d * 2.5 + 1) : d > 6 ? p.prof.vmax * 0.85 : Math.min(5, d * 1.5);
    W.face = d < 1 ? Math.atan2(b.y - p.y, b.x - p.x) : null;
    W.jockey = 0; W.shield = 0;
    // tired players catch their breath at a stoppage
    if (p.stam < 0.55 && d < 0.5 && !p.gest && m.rng() < 0.01) p.gest = { k: "hips", t: m.t, T: 2.5 };
  }
  let tk = R.taker;
  if (!tk) { m.phase = "play"; m.restart = null; m.dead = false; return; }
  // a taker who cannot get there (down, sent off, miles away): the nearest team mate takes it instead
  if (!R.placed && (R.t > 5 && !R.swapped || tk.off)) {
    R.swapped = true;
    const T = m.teams[R.team];
    const alt = T.players.filter(q => !q.off && q.mode === "free" && (!q.gk || R.kind === "goalkick" || R.kind === "freekick")).sort((a, c) => hyp(a.x - R.x, a.y - R.y) - hyp(c.x - R.x, c.y - R.y))[0];
    if (alt) tk = R.taker = alt;
  }
  // a hard limit: no restart ever hangs
  if (R.t > 12) { aiRestart(m, R, tk); return; }
  const atBall = hyp(tk.x - (restartSpot(m, tk, R).x), tk.y - restartSpot(m, tk, R).y) < 0.5;
  if (atBall && !R.placed) { R.placed = true; R.placedT = R.t; if (m.setPiece) m.setPiece.phase = "aim"; }
  // how long each restart really needs: a throw in is quick, a corner or a wall takes a little longer
  const wait = R.kind === "kickoff" ? 0.6 : R.kind === "throwin" ? 0.35 : R.kind === "goalkick" ? 0.7 : R.kind === "penalty" ? 1.2 : 1.0;
  const settle = R.kind === "kickoff" ? 3.5 : R.kind === "corner" || R.kind === "penalty" || R.kind === "freekick" && R.wall.length ? 2.6 : 0.4;
  // a corner or a free kick in range waits for the box to fill (up to 7 seconds); the rest go once settled
  const boxed = R.kind === "corner" || R.kind === "freekick" && R.wall.length;
  R.ready = R.placed && (farthest < 1.5 || R.t > settle && (!boxed || farNear < 2.5 || R.t > 7)) && R.t - R.placedT > 0.25;
  if (!R.ready) return;
  // player lock: a set piece someone else takes is the AI's, and a penalty against him is the keeper's own call
  const userTakes = R.team === userTeam && !m.auto && !aiTakes;
  if (userTakes) {
    m.ctrl = tk;
    // a kick off goes as soon as the person touches a key or the stick
    if (R.kind === "kickoff") {
      if (input.release || input.power > 0 || Math.hypot(input.mx || 0, input.my || 0) > 0 || R.t - R.placedT > 3) aiRestart(m, R, tk);
      return;
    }
    userRestart(m, R, tk, input, dt);
    // nobody waits for ever
    if (R.t - R.placedT > 10) aiRestart(m, R, tk);
    return;
  }
  // the AI goalkeeper faces a penalty taken by the person: the keeper side is the person's to choose
  if (R.kind === "penalty" && userTeam !== R.team && !m.auto && !m.lock) m.ctrl = m.teams[userTeam].gk;
  if (R.t - R.placedT > wait + m.rng() * 0.5) aiRestart(m, R, tk);
}

// the person takes the restart: aim with the direction keys, then the matching button
function userRestart(m, R, tk, inp, dt) {
  const A = R.userAim;
  const dir = m.teams[R.team].dir;
  // the aim: a target the direction keys move around the area
  if (!R.aim) R.aim = defaultAim(m, R, tk);
  const sp = R.kind === "penalty" || R.kind === "freekick" && R.direct ? 2.5 : 9;
  R.aim.x = clamp(R.aim.x + (inp.mx || 0) * sp * dt, -HALF_L, HALF_L);
  R.aim.y = clamp(R.aim.y + (inp.my || 0) * sp * dt, -HALF_W, HALF_W);
  const shotKind = R.kind === "penalty" || R.kind === "freekick" && hyp(dir * HALF_L - R.x, R.y) < 35;
  m.aim = { x: R.aim.x, y: R.aim.y, z: shotKind ? 1.2 : 3, power: inp.power || 0, curve: R.kind === "freekick" ? (inp.curve || 0) : 0 };
  if (inp.release) {
    const k = inp.release.key, power = inp.release.power;
    const tgtDir = Math.atan2(R.aim.y - tk.y, R.aim.x - tk.x);
    let spec = null;
    if (R.kind === "throwin") spec = k === "C" ? { kind: "throw", tx: R.aim.x, ty: R.aim.y, T: 1.2, power, long: true } : { kind: "throw", tx: R.aim.x, ty: R.aim.y, T: 0.7, power };
    else if ((k === "E" || k === "R") && shotKind) {
      const aim = clamp((R.aim.y - 0) / GOAL_HALF, -1, 1) * dir * dir;
      spec = planShot(m, tk, R.aim.y / (GOAL_HALF - 0.5), power, k === "R" ? "finesse" : R.kind === "penalty" ? "shot" : "shot");
      spec.ty = clamp(R.aim.y, -GOAL_HALF + 0.3, GOAL_HALF - 0.3);
      if (R.kind === "penalty") spec.tz = 0.3 + power * 1.8;
    } else if (k === "C" || k === "G") spec = R.kind === "corner" ? Object.assign(planCross(m, tk, tgtDir, power, false), { tx: R.aim.x, ty: R.aim.y }) : Object.assign(planLob(m, tk, tgtDir, power), { tx: R.aim.x, ty: R.aim.y });
    else if (k === "T") spec = planThrough(m, tk, tgtDir, power, false);
    else spec = planPass(m, tk, tgtDir, power, {});
    if (spec) takeRestart(m, R, tk, spec);
  }
}

function defaultAim(m, R, tk) {
  const dir = m.teams[R.team].dir, gx = dir * HALF_L;
  if (R.kind === "penalty") return { x: gx, y: (m.rng() < 0.5 ? -1 : 1) * 2.4 };
  if (R.kind === "corner") return { x: gx - dir * 9, y: 0 };
  if (R.kind === "freekick" && hyp(gx - R.x, R.y) < 35) return { x: gx, y: -Math.sign(R.y || 1) * 2.2 };
  if (R.kind === "throwin") return { x: R.x + dir * 8, y: R.y - Math.sign(R.y) * 8 };
  return { x: R.x + dir * 22, y: R.y * 0.5 };
}

// the AI takes it: the right choice for the restart and the taker
export function aiRestart(m, R, tk) {
  const T = m.teams[R.team], dir = T.dir, gx = dir * HALF_L;
  let spec;
  const d = hyp(gx - R.x, R.y);
  if (R.kind === "penalty") {
    const side = m.rng() < 0.5 ? -1 : 1;
    spec = planShot(m, tk, side * (0.5 + m.rng() * 0.45), 0.55 + m.rng() * 0.3, m.rng() < 0.15 ? "chip" : "shot");
    spec.tz = 0.25 + m.rng() * 1.5;
  } else if (R.kind === "corner") {
    spec = m.rng() < 0.12 ? planPass(m, tk, Math.atan2(-Math.sign(R.y) * 0.6, -dir), 0.4, {}) : planCross(m, tk, Math.atan2(-R.y, -dir * 0.3) + (m.rng() - 0.5) * 1.2, 0.5 + m.rng() * 0.4, false);
  } else if (R.kind === "freekick" && !R.indirect && d < 30 && Math.abs(R.y) < 22 && m.rng() < 0.75) {
    spec = planShot(m, tk, (m.rng() < 0.5 ? -1 : 1) * 0.8, 0.6 + m.rng() * 0.2, n01(tk.a.cur) > 0.55 ? "finesse" : "shot");
  } else if (R.kind === "freekick" && d < 45 && m.rng() < 0.6) {
    spec = planCross(m, tk, Math.atan2(-R.y, gx - R.x), 0.55, false);
  } else if (R.kind === "goalkick") {
    const cbs = T.players.filter(q => q.role === "CB" && !q.off);
    spec = cbs.length && m.rng() < 0.55 ? planPass(m, tk, Math.atan2(cbs[0].y - tk.y, cbs[0].x - tk.x), 0.4, { to: cbs[0] }) : planLob(m, tk, Math.atan2(-tk.y * 0.3, dir), 0.8);
  } else if (R.kind === "throwin") {
    const opts = T.players.filter(q => q !== tk && !q.off && !q.gk && hyp(q.x - tk.x, q.y - tk.y) < 22).sort((a, c) => hyp(a.x - tk.x, a.y - tk.y) - hyp(c.x - tk.x, c.y - tk.y));
    const q = opts[Math.floor(m.rng() * Math.min(3, opts.length))];
    spec = q ? { kind: "throw", tx: q.x, ty: q.y, T: 0.8, to: q, power: 0.5 } : { kind: "throw", tx: tk.x + dir * 10, ty: tk.y * 0.7, T: 0.9, power: 0.5 };
  } else if (R.kind === "kickoff") {
    const q = T.players.filter(p => p !== tk && !p.off && !p.gk).sort((a, c) => hyp(a.x - tk.x, a.y - tk.y) - hyp(c.x - tk.x, c.y - tk.y))[1] || T.players[5];
    spec = planPass(m, tk, Math.atan2(q.y - tk.y, q.x - tk.x), 0.35, { to: q });
  } else {
    spec = planPass(m, tk, Math.atan2(-R.y * 0.2, dir), 0.5, {});
  }
  takeRestart(m, R, tk, spec);
}

// the restart is taken: the ball comes alive with the kick (or the throw)
export function takeRestart(m, R, tk, spec) {
  m.phase = "play"; m.dead = false;
  m.restart = null;
  m.setPiece = Object.assign({}, m.setPiece || {}, { phase: "taken" });
  m.aim = null;
  const b = m.ball;
  b.x = R.x; b.y = R.y; b.z = 0.11;
  b.last = tk; b.lastTeam = tk.team; b.touchT = 9; b.ctrl = null;
  if (spec.kind === "throw") {
    // a two handed throw from above the head
    b.z = 2.1;
    const D = hyp(spec.tx - b.x, spec.ty - b.y), T = spec.long ? 1.25 : clamp(D / 13, 0.45, 1.1);
    const vh = Math.min(D / T, spec.long ? 19 : 14), a = Math.atan2(spec.ty - b.y, spec.tx - b.x);
    b.vx = Math.cos(a) * vh; b.vy = Math.sin(a) * vh; b.vz = (0.11 - 2.1 + 0.5 * 9.81 * T * T) / T * 0.95;
    b.last = tk; b.lastTeam = tk.team; b.touchT = 0; b.immune = tk; b.immuneT = 0.3;
    b.flight = { kind: "throw", by: tk, to: spec.to || null, t: m.t, tx: spec.tx, ty: spec.ty };
    tk.act = { k: "throw", t: 0, T: 0.6, lock: 0.8, busy: true };
    m.events.push({ type: "throw", by: tk.id });
    m.offside = null;
    m.setPiece = null;
    return;
  }
  // the taker is stood behind the ball: a step or two onto it and the strike (he is never moved by magic)
  startKick(m, tk, spec);
  m.restartKick = { kind: R.kind, by: tk, t: m.t };
  setTimeoutClear(m);
}
function setTimeoutClear(m) { m.clearSetPieceAt = m.t + 1.2; }

// ---------- halves and full time ----------
export function updateClock(m, dt) {
  // the clock runs in play and, slower, while a restart is set up, so dead balls do not eat the match
  if (m.phase === "play") m.clock += dt;
  else if (m.phase === "restart") m.clock += dt * 0.35;
  if (m.phase === "goal") {
    m.phaseT += dt;
    if (m.phaseT > 4.2) startRestart(m, "kickoff", m.nextKick, 0, 0);
    return;
  }
  if (m.phase === "halftime") {
    m.phaseT += dt;
    if (m.phaseT > 2.6) {
      // change ends, a breather, then the second half kicks off
      for (const T of m.teams) T.dir *= -1;
      for (const p of m.players) {
        p.stam = Math.min(1, p.stam + 0.18); p.burstE = 1;
        const s = shapeTarget(m, p);
        p.x = s.x * 0.6; p.y = s.y; p.vx = p.vy = 0; p.face = Math.atan2(0, m.teams[p.team].dir);
        p.act = null; p.mode = "free";
      }
      m.half = 2;
      m.events.push({ type: "half2" });
      startRestart(m, "kickoff", 1 - m.firstKick, 0, 0);
    }
    return;
  }
  if (m.phase === "full") return;
  const end = m.half === 1 ? HALF_SECONDS : MATCH_SECONDS;
  if (m.clock >= end) {
    // a little added time: let a live attack finish
    const b = m.ball;
    const danger = Math.abs(b.x) > HALF_L - 25 && m.phase === "play" && m.clock < end + 8;
    if (danger) return;
    if (m.half === 1) {
      m.phase = "halftime"; m.phaseT = 0; m.dead = true; m.restart = null;
      m.events.push({ type: "half", banner: "HALF TIME" });
      say(m, "Half time. " + m.teams[0].name + " " + m.score[0] + ", " + m.teams[1].name + " " + m.score[1] + ".", "info");
    } else {
      m.phase = "full"; m.dead = true; m.restart = null;
      m.events.push({ type: "full", banner: "FULL TIME" });
      say(m, "Full time.", "info");
      for (const p of m.players) p.mood = { k: m.score[p.team] > m.score[1 - p.team] ? "joy" : m.score[p.team] < m.score[1 - p.team] ? "down" : "flat", t: m.t };
    }
  }
}

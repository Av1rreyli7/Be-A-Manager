// The 3D match engine: one fixed step loop that runs the whole game.
// Order inside a step: the clock and restarts, the team brains, the person's input, the AI, the actions
// (kicks, tackles, slides, skills, headers, keepers), dribbling touches, the bodies, player collisions, the ball
// physics (sub stepped), who meets a free ball, then the laws (goals, out of play, offside).
// The controller in match.js calls step(input) 60 times a second and reads m.events, m.stats and result(),
// exactly as it did for the old engines. Nothing here touches the page, so it runs in node for the tests.
import { STEP, MATCH_SECONDS, HALF_SECONDS, MAX_GOALS, DIMS, HALF_L, HALF_W, GOAL_HALF, BAR_H, BOX_D, BOX_HALF, REACH, BALL_R } from "./consts.mjs";
import { clamp, hyp, angDiff, seeded, shortName, finite } from "./util.mjs";
import { deriveAttrs, deriveProfile, assignNumbers, roleOf, n01 } from "./attrs.mjs";
import { createBall, stepBall, predict } from "./ball.mjs";
import { stepBody, stepCollisions, emptyWant, newGait } from "./body.mjs";
import { dribble, firstTouch, canMeet, canPlay, contest, pressureOn, userChallenge, isUser } from "./control.mjs";
import { updateKick, startKick, planPass, planLob, SHOT_KINDS } from "./kick.mjs";
import { updateTackle, updateSlide, tryIntercept, startSlide } from "./defend.mjs";
import { updateKeeper, inOwnBox } from "./keeper.mjs";
import { updateSkill } from "./skills.mjs";
import { updateHeader, startHeader, meetPlan } from "./aerial.mjs";
import { setupShape, teamThink, playerThink, receive } from "./ai.mjs";
import { foul as refFoul, markOffside, touched, checkBall, startRestart, updateRestart, updateClock, minuteOf, say } from "./rules.mjs";
import { createUser, userStep, normInput } from "./user.mjs";
import { lockSetup, lockScan, lockTick, lockShotOn, lockPassOk, lockLine } from "./lock.mjs";

export { STEP, MATCH_SECONDS, HALF_SECONDS, MAX_GOALS, DIMS, deriveAttrs, deriveProfile, assignNumbers };

function makePlayer(m, row, team, idx) {
  const a = deriveAttrs(row);
  const prof = deriveProfile(row, a);
  // player lock: the footballer the person created wears his own face, hair, build and boots
  if (row.pc && row.look && typeof row.look === "object") Object.assign(prof, row.look);
  const role = roleOf(row);
  prof.reactT = clamp(0.3 - n01(a.rea) * 0.16 + (role === "GK" ? 0.05 - n01(a.gkr) * 0.12 : 0), 0.1, 0.36);
  const name = String(row.n || "Player");
  return {
    id: team * 11 + idx, team, idx, slotI: idx, name, short: shortName(name), num: row.num || 0,
    pos: row.pos || "MF", role, r: Number(row.r) || 70, base: Number(row.base) || Number(row.r) || 70, age: Number(row.age) || 26,
    a, prof, gk: role === "GK",
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ax: 0, ay: 0, face: 0, faceV: 0, spd: 0,
    gait: newGait(), mode: "free", modeT: 0, bal: 1, stam: 1, burstE: 1, knock: 0,
    want: emptyWant(), act: null, drib: { since: 0, lastT: -9 },
    ai: { think: 0, mode: null, run: null, spot: null, mark: null, tackleCd: 0, open: 0 },
    touch: null, recv: null, look: null, gest: null, mood: null, card: 0, off: false, stepped: -1, feinted: null,
    pc: !!row.pc
  };
}

export function createSim3D(setup, opts) {
  opts = opts || {};
  const rng = opts.rng || Math.random;
  const side = setup.side === "away" ? "away" : "home";
  const mineXI = (side === "away" ? setup.awayXI : setup.homeXI) || [];
  const theirXI = (side === "away" ? setup.homeXI : setup.awayXI) || [];
  const m = {
    deep: true, side, t: 0, clock: 0, half: 1, phase: "restart", phaseT: 0, dead: true,
    teams: [], players: [], ball: createBall(), events: [], rng, auto: !!opts.auto,
    score: [0, 0], goals: [], ctrl: null, lock: null, userTeam: 0, restart: null, setPiece: null, aim: null, offside: null,
    contacts: {}, hud: {}, wet: !!setup.wet, lastPass: null, teamThinkT: 0, firstKick: 0,
    stats: { poss: [0, 0], shots: [0, 0], onTarget: [0, 0], passes: [0, 0], passOk: [0, 0], tackles: [0, 0], fouls: [0, 0], corners: [0, 0], freekicks: [0, 0], pens: [0, 0], restarts: [0, 0], saves: [0, 0], skills: [0, 0], offsides: [0, 0], yellow: [0, 0], red: [0, 0] }
  };
  const names = [side === "away" ? setup.away : setup.home, side === "away" ? setup.home : setup.away];
  [mineXI, theirXI].forEach((xi, ti) => {
    const rows = assignNumbers(xi.slice(0, 11).map(r => Object.assign({}, r)));
    while (rows.length < 11) rows.push({ n: "Player " + (rows.length + 1), pos: rows.length ? "MF" : "GK", role: rows.length ? "CM" : "GK", r: 60, num: 0 });
    assignNumbers(rows);
    // the keeper goes first
    rows.sort((a, b) => (roleOf(a) === "GK" ? -1 : 0) - (roleOf(b) === "GK" ? -1 : 0));
    const T = { idx: ti, name: names[ti] || (ti ? "Away" : "Home"), dir: ti === 0 ? 1 : -1, players: [], have: false };
    rows.forEach((r, i) => T.players.push(makePlayer(m, r, ti, i)));
    T.gk = T.players.find(p => p.gk) || T.players[0];
    T.gk.gk = true;
    setupShape(T);
    m.teams.push(T);
    m.players.push(...T.players);
  });
  // kick off positions: in the shape, own half
  for (const T of m.teams) for (const p of T.players) {
    const s = shapeStart(p, T);
    p.x = s.x; p.y = s.y; p.face = T.dir > 0 ? 0 : Math.PI;
    p.gait.feet[0].x = p.x; p.gait.feet[0].y = p.y + 0.1; p.gait.feet[1].x = p.x; p.gait.feet[1].y = p.y - 0.1;
  }
  // player lock: a row marked pc (Player Career) is the only player the person controls
  lockSetup(m, setup);
  const U = createUser(m);
  m.firstKick = rng() < 0.5 ? 0 : 1;
  m.foul = (by, on, kind, sev) => refFoul(m, by, on, kind, sev);
  m.onKick = (p, spec, cq) => onKick(m, p, spec, cq);
  m.passIntent = (p, spec) => { if (spec.to) m.lastPass = { by: p, to: spec.to, t: m.t }; };
  m.distribute = k => distribute(m, k);
  startRestart(m, "kickoff", m.firstKick, 0, 0);
  m.events.push({ type: "kickoff", team: m.firstKick });
  say(m, "We are under way. " + m.teams[0].name + " against " + m.teams[1].name + ".", "info");

  let prevHeld = {};
  function step(inp) {
    const dt = STEP;
    const I = normInput(inp, prevHeld);
    prevHeld = Object.assign({}, I.held, { Et: (prevHeld.Et || 0) + (I.held.E ? dt : 0) });
    if (!I.held.E) prevHeld.Et = 0;
    if (m.phase === "full") return;
    m.userIn = I; // the keeper facing a penalty reads the person's stick
    const ev0 = m.events.length;
    m.t += dt;
    updateClock(m, dt);
    if (m.phase === "full") return;
    const b = m.ball;
    // ---------- brains ----------
    if (m.t >= m.teamThinkT) { teamThink(m, m.teams[0]); teamThink(m, m.teams[1]); m.teamThinkT = m.t + 0.2; }
    // in player lock the person only takes a set piece when it is his own footballer's to take
    const notHis = m.lock && m.restart && m.restart.team === m.userTeam && m.restart.taker !== m.lock;
    if (m.phase === "restart") updateRestart(m, dt, m.auto ? -1 : m.userTeam, setPieceInput(I, U, dt), notHis);
    else if (m.phase === "goal" || m.phase === "halftime") celebrate(m, dt);
    else {
      if (!m.auto) userStep(m, U, I, dt);
      for (const p of m.players) {
        if (p.off) continue;
        if (p.gk) updateKeeper(m, p, dt);
        else if (m.auto || p !== m.ctrl) playerThink(m, p, dt);
      }
    }
    // ---------- actions ----------
    for (const p of m.players) {
      if (p.off || !p.act) continue;
      const k = p.act.k;
      if (k === "kick") updateKick(m, p, dt);
      else if (k === "tackle" || k === "poke") updateTackle(m, p, dt);
      else if (k === "slide") updateSlide(m, p, dt);
      else if (k === "skill") updateSkill(m, p, dt);
      else if (k === "header") updateHeader(m, p, dt);
      else if (k === "block" || k === "throw") { p.act.t += dt; if (p.act.t > p.act.T) p.act = null; }
    }
    // ---------- touches on the ball ----------
    if (b.ctrl && !b.ctrl.off && m.phase === "play" && !(b.ctrl.act && (b.ctrl.act.k === "skill" || b.ctrl.act.k === "kick"))) dribble(m, b.ctrl, dt);
    // the person runs into the man on the ball: a real challenge, decided before the bodies meet
    if (m.phase === "play") userChallenge(m);
    // ---------- bodies ----------
    for (const p of m.players) {
      if (p.off) { offPitch(m, p, dt); continue; }
      if (p.act && p.act.own) continue;
      boostRun(m, p);
      stepBody(m, p, dt);
      // keep everyone on the grass
      p.x = clamp(p.x, -HALF_L - 4, HALF_L + 4); p.y = clamp(p.y, -HALF_W - 4, HALF_W + 4);
    }
    stepCollisions(m, dt);
    // ---------- the ball ----------
    if (m.phase === "restart") { /* the restart code holds the ball */ }
    else stepBall(m, dt);
    if (m.phase === "play") {
      claims(m);
      checkBall(m);
    }
    // ---------- bookkeeping ----------
    const owner = b.ctrl || b.held;
    if (owner) m.stats.poss[owner.team] += dt; else if (b.lastTeam >= 0) m.stats.poss[b.lastTeam] += dt * 0.5;
    if (m.clearSetPieceAt && m.t > m.clearSetPieceAt) { m.setPiece = null; m.clearSetPieceAt = 0; }
    for (const p of m.players) if (p.sentOff && !p.off && m.t - p.sentOff > 1.2) sendOff(m, p);
    sanity(m);
    if (m.lock) { lockTick(m); lockScan(m, ev0); }
  }

  function result() {
    const mine = Math.min(MAX_GOALS, m.score[0]), theirs = Math.min(MAX_GOALS, m.score[1]);
    return side === "away" ? { home: theirs, away: mine } : { home: mine, away: theirs };
  }

  return {
    m, step, result, deep: true, engine: "m3d",
    // player lock: his own match, for the career
    lockLine: () => lockLine(m),
    // helpers the tests and the view use
    minute: () => minuteOf(m),
    startSlide: (p, dir) => startSlide(m, p, dir === undefined ? p.face : dir)
  };
}

function shapeStart(p, T) {
  const s = p.slot || { d: 0.5, y: 0 };
  const x = p.gk ? -T.dir * (HALF_L - 1.5) : -T.dir * clamp(42 - s.d * 34, 4, 46);
  return { x, y: s.y * 26 * T.dir };
}

// the person's keys while a set piece is his to take
function setPieceInput(I, U, dt) {
  const out = { mx: I.mx, my: I.my, power: 0, release: null, curve: 0 };
  for (const k of ["E", "R", "Q", "T", "C", "G"]) {
    if (I.held[k]) { U.holdT[k] = (U.holdT[k] || 0) + dt; out.power = clamp(U.holdT[k] / 0.95, 0, 1); }
    if (I.up && I.up[k] !== undefined) { out.release = { key: k, power: clamp(I.up[k] / 0.95, 0, 1) }; U.holdT[k] = 0; }
  }
  if (I.held.F) out.curve = -1; if (I.held.V) out.curve = 1;
  return out;
}

// a short burst after a skill move's exit
function boostRun(m, p) {
  if (p.boostT && m.t < p.boostT) {
    const sp = hyp(p.vx, p.vy);
    if (sp > 0.5) { const k = 1 + (p.boost - 1) * 0.06; p.vx *= k; p.vy *= k; }
  }
}

// ---------- the free ball: who meets it and how ----------
function claims(m) {
  const b = m.ball;
  if (b.held) return;
  if (b.ctrl) {
    // the dribbler lost it: too far, or an opponent got a foot to it
    if (hyp(b.x - b.ctrl.x, b.y - b.ctrl.y) > 2.8) b.ctrl = null;
    else {
      for (const o of m.teams[1 - b.ctrl.team].players) {
        if (o.off || o.act || o.gk || o.ballLockT > m.t) continue;
        // an opponent standing right on the ball between touches nicks it
        const dO = hyp(b.x - o.x, b.y - o.y), dC = hyp(b.x - b.ctrl.x, b.y - b.ctrl.y);
        if (dO < 0.5 && dC > 0.75 && dO < dC * 0.6 && b.z < 0.5 && b.touchT > 0.12 && canMeet(m, o) && m.rng() < 0.35 + n01(o.a.rea) * 0.3) { take(m, o); return; }
      }
      return;
    }
  }
  // keepers pick up a free ball in their box (not a pass from a team mate)
  for (const T of m.teams) {
    const k = T.gk;
    if (!k || k.off || k.act || k.mode !== "free" && k.mode !== "stumble") continue;
    if (!inOwnBox(m, k, b.x, b.y)) continue;
    if (b.last && b.last.team === k.team && b.flight && b.flight.kind !== "parry" && b.touchT < 3) continue;
    if (hyp(b.x - k.x, b.y - k.y) < 0.85 && b.z < k.prof.h + 0.3 && hyp(b.vx, b.vy) < 14) {
      b.held = k; b.ctrl = null; b.vx = b.vy = b.vz = 0; b.last = k; b.lastTeam = k.team; b.flight = null; k.holdT = 0; k.gkState = "hold";
      m.events.push({ type: "gather", by: k.id });
      return;
    }
  }
  // everyone who could meet it this step
  const cand = [];
  for (const p of m.players) {
    if (p.off || p.gk || p.act) continue;
    if (p.ballLockT > m.t) continue;
    const you = isUser(m, p);
    if (b.immune === p && b.immuneT > 0) continue;
    if (you) {
      if (b.last === p && b.flight && b.touchT < 0.6) continue; // not his own pass or shot as it leaves
      // the person's player: any ball he runs onto at foot or chest height is his, from a touch further away
      const bd = hyp(b.x - p.x, b.y - p.y), bsp = hyp(b.vx, b.vy, b.vz);
      const near = bd < REACH * 1.3 && b.z < Math.min(1.3, p.prof.h * 0.75) && bsp < 22;
      const front = Math.abs(angDiff(p.face, Math.atan2(b.y - p.y, b.x - p.x))) < 2.3 || bd < 0.5;
      if (!(canPlay(p) && near && front) && !canMeet(m, p, p.prof.h * 0.95)) continue;
      // a hard pass between two of theirs still has to be read in time; a loose or slow ball is simply his
      const theirPass = b.flight && b.flight.by && b.flight.by.team !== p.team && b.touchT < 2.5 && bsp > 12;
      if (theirPass && !tryIntercept(m, p)) continue;
      // a ball the man on the other side has just lost at his own feet is a 50 50 with him, decided once
      const lt = b.last;
      if (lt && lt.team !== p.team && !lt.off && !lt.gk && b.touchT < 0.6 && canPlay(lt)) {
        const dl = hyp(b.x - lt.x, b.y - lt.y);
        if (dl < REACH * 1.6 && dl < bd + 0.6) {
          if (contest(m, p, lt) !== p) { p.bal -= 0.08; p.ballLockT = m.t + 0.4; m.events.push({ type: "duel", won: lt.id, lost: p.id }); continue; }
          lt.bal -= 0.1;
          m.events.push({ type: "duel", won: p.id, lost: lt.id });
        }
      }
      cand.push(p);
      continue;
    }
    if (!canMeet(m, p, p.prof.h * 0.95)) continue;
    const meant = b.flight && b.flight.to === p;
    const mate = b.last && b.last.team === p.team && b.touchT < 2.5;
    // opponents cut it out only if they read it in time; a team mate (or the receiver) takes it
    if (!meant && !mate && !tryIntercept(m, p)) continue;
    cand.push(p);
  }
  if (!cand.length) return;
  let who = cand.sort((a, c) => hyp(b.x - a.x, b.y - a.y) - hyp(b.x - c.x, b.y - c.y))[0];
  const rival = cand.find(c => c.team !== who.team && hyp(b.x - c.x, b.y - c.y) < hyp(b.x - who.x, b.y - who.y) + 0.35);
  // the person's player and a man from the other side meet it together: his if he is clearly first, otherwise a
  // real 50 50 (strength, touch, balance) that he can lose
  const you = cand.find(c => isUser(m, c));
  if (you && rival && (who === you || rival === you)) {
    const other = who === you ? rival : who;
    if (hyp(b.x - you.x, b.y - you.y) < hyp(b.x - other.x, b.y - other.y) - 0.3 || contest(m, you, other) === you) {
      other.bal -= 0.1;
      m.events.push({ type: "duel", won: you.id, lost: other.id });
      take(m, you);
      return;
    }
    you.bal -= 0.1; you.ballLockT = m.t + 0.35;
    m.events.push({ type: "duel", won: other.id, lost: you.id });
    take(m, other);
    return;
  }
  if (rival) {
    who = contest(m, who, rival);
    const loser = who === rival ? cand[0] : rival;
    loser.bal -= 0.15;
    m.events.push({ type: "duel", won: who.id, lost: loser.id });
  }
  take(m, who);
}

// meet the ball: the AI may play it first time, otherwise a first touch toward where he wants to go
function take(m, p) {
  const b = m.ball;
  if (touched(m, p)) return;
  const T = m.teams[p.team];
  // where to take it: the person's stick, or for the AI forward and away from pressure
  let dir = null;
  if (p === m.ctrl && !m.auto) {
    const W = p.want;
    if (hyp(W.dx, W.dy) > 0) dir = Math.atan2(W.dy, W.dx);
  } else {
    const gx = T.dir * HALF_L;
    dir = Math.atan2(-p.y * 0.4, gx - p.x);
    // an opponent right there: turn the other way
    let near = null, nd = 3.5;
    for (const o of m.teams[1 - p.team].players) { const d = hyp(o.x - p.x, o.y - p.y); if (!o.off && d < nd) { nd = d; near = o; } }
    // halfway between the two directions (as vectors: averaging the angles breaks where they wrap at +-180 degrees)
    if (near) { const aw = Math.atan2(p.y - near.y, p.x - near.x); dir = Math.atan2(Math.sin(aw) + Math.sin(dir), Math.cos(aw) + Math.cos(dir)); }
  }
  if (m.lastShot) m.lastShot.on = false; // a controlled ball is a new phase of play
  const grade = firstTouch(m, p, dir);
  // pass completed?
  // a pass is complete when a team mate is the next to control it
  if (m.lastPass && !m.lastPass.counted && m.t - m.lastPass.t < 6) { m.lastPass.counted = true; if (m.lastPass.by.team === p.team && m.lastPass.by !== p) { m.stats.passOk[p.team]++; lockPassOk(m, m.lastPass.by); } }
  if (b.ctrl === p) { p.ai.think = 0.1 + m.rng() * 0.15; }
}

// stats and offside bookkeeping on every kick
function onKick(m, p, spec, cq) {
  const kind = spec.kind;
  if (spec.shot || SHOT_KINDS.has(kind)) {
    m.stats.shots[p.team]++;
    // will it be on target (between the posts, under the bar) if nobody touches it?
    const tr = predict(m.ball, 2.5, 1 / 60, [], m.wet);
    const gx = m.teams[p.team].dir * HALF_L;
    let on = false;
    for (const s of tr) if (Math.abs(s[1]) >= HALF_L) { if (Math.abs(s[2]) < GOAL_HALF && s[3] < BAR_H && Math.sign(s[1]) === Math.sign(gx)) { m.stats.onTarget[p.team]++; on = true; } break; }
    m.lastShot = { by: p, t: m.t, kind, on };
    lockShotOn(m, p, on);
    p.mood = { k: "focus", t: m.t };
  } else if (spec.to) {
    if (m.lastShot) m.lastShot.on = false; // a new pass or clearance ends the shot's claim on a goal
    m.stats.passes[p.team]++;
    m.lastPass = { by: p, to: spec.to, t: m.t };
  } else {
    if (m.lastShot) m.lastShot.on = false;
    if (kind !== "clear") m.stats.passes[p.team]++;
  }
  markOffside(m, p, m.restartKick && m.t - m.restartKick.t < 0.3 ? m.restartKick.kind : kind);
}

// the keeper lets go: a throw to a free team mate close by, or a long kick
function distribute(m, k) {
  const b = m.ball, T = m.teams[k.team], dir = T.dir;
  b.held = null;
  k.gkState = "pos";
  let best = null, bs = -1;
  for (const q of T.players) {
    if (q === k || q.off) continue;
    const d = hyp(q.x - k.x, q.y - k.y);
    if (d < 8 || d > 34) continue;
    let space = 9;
    for (const o of m.teams[1 - k.team].players) if (!o.off) space = Math.min(space, hyp(o.x - q.x, o.y - q.y));
    if (space > bs) { bs = space; best = q; }
  }
  b.z = 1.0;
  if (best && bs > 5 && m.rng() < 0.7) {
    // a throw: underarm along the ground or overarm for longer ones
    const D = hyp(best.x - k.x, best.y - k.y), T2 = clamp(D / 16, 0.5, 1.5), a = Math.atan2(best.y - k.y, best.x - k.x);
    b.vx = Math.cos(a) * D / T2; b.vy = Math.sin(a) * D / T2; b.vz = (0.11 - 1.0 + 0.5 * 9.81 * T2 * T2) / T2 * 0.7;
    b.last = k; b.lastTeam = k.team; b.touchT = 0; b.immune = k; b.immuneT = 0.3;
    b.flight = { kind: "throw", by: k, to: best, t: m.t, tx: best.x, ty: best.y };
    k.act = { k: "throw", t: 0, T: 0.6, lock: 0.8, gkThrow: true };
    m.events.push({ type: "gk_throw", by: k.id });
    m.lastPass = { by: k, to: best, t: m.t };
  } else {
    // a drop kick downfield
    b.x = k.x + Math.cos(k.face) * 0.5; b.y = k.y + Math.sin(k.face) * 0.5; b.z = 0.5;
    const spec = planLob(m, k, Math.atan2(-k.y * 0.2 + (m.rng() - 0.5) * 30, dir * 50), 0.85);
    spec.T = 2.6;
    k.act = null;
    startKick(m, k, spec);
    k.act.tc = 0.05;
  }
}

// after a goal or at half time: the scorer wheels away, the rest walk back
function celebrate(m, dt) {
  for (const p of m.players) {
    if (p.off) continue;
    const W = p.want;
    W.face = null; W.jockey = 0; W.shield = 0;
    if (p.celebrate && m.t - p.celebrate.t < 4) {
      // run to the corner flag nearest the stand
      const T = m.teams[p.team];
      const tx = T.dir * (HALF_L - 2), ty = HALF_W - 2;
      W.dx = tx - p.x; W.dy = ty - p.y; W.spd = hyp(W.dx, W.dy) > 2 ? p.prof.vmax * 0.8 : 0;
      continue;
    }
    if (p.mood && p.mood.k === "joy" && m.phase === "goal") {
      const sc = m.players.find(q => q.celebrate && m.t - q.celebrate.t < 4);
      if (sc) { W.dx = sc.x - p.x; W.dy = sc.y - p.y; W.spd = hyp(W.dx, W.dy) > 2 ? p.prof.vmax * 0.6 : 0; continue; }
    }
    W.spd = p.spd > 1 ? Math.max(0, p.spd - 2) : 0;
    W.dx = -p.x; W.dy = 0;
    if (m.phase === "goal" && p.mood && p.mood.k === "down") { W.spd = 1.2; W.dx = -m.teams[p.team].dir; }
  }
}

function sendOff(m, p) {
  p.off = true;
  if (m.ball.ctrl === p) m.ball.ctrl = null;
  if (m.ctrl === p) m.ctrl = null;
  // the team plays on with ten: the shape closes up
  setupShape(m.teams[p.team]);
  m.teams[p.team].players.forEach(q => q.ai.mark = null);
}
function offPitch(m, p, dt) {
  // walk off toward the tunnel side and out of the way
  p.x += (0 - p.x) * dt * 0.2; p.y = Math.min(HALF_W + 6, p.y + dt * 1.5);
}

// guard rails: nothing in the match can ever go NaN or fly away; if it does, it is put right and counted
function sanity(m) {
  const b = m.ball;
  if (!finite(b.x) || !finite(b.y) || !finite(b.z) || !finite(b.vx) || !finite(b.vy) || !finite(b.vz) || Math.abs(b.x) > 200 || Math.abs(b.y) > 200 || b.z > 80) {
    m.repairs = (m.repairs || 0) + 1;
    b.x = 0; b.y = 0; b.z = BALL_R; b.vx = b.vy = b.vz = 0; b.wx = b.wy = b.wz = 0; b.ctrl = null; b.held = null;
  }
  for (const p of m.players) {
    if (!finite(p.x) || !finite(p.y) || !finite(p.vx) || !finite(p.vy) || !finite(p.face)) {
      m.repairs = (m.repairs || 0) + 1;
      p.x = 0; p.y = 0; p.vx = p.vy = 0; p.face = 0; p.act = null; p.mode = "free";
    }
  }
}

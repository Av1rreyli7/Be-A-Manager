// Floodlights playable match engine. Plain JS, no build step, no libraries.
// The sim part (FLMatch.createSim) never touches the page, so it also runs in node for tests.
// Two looks share this one engine: the Classic top down canvas drawn in this file, and the
// 3D broadcast view in match3d.mjs, which the page loads only when a manager picks 3D.
(function (root) {
"use strict";

// pitch in metres, origin at the centre spot, x runs goal to goal
const HALF_L = 52.5, HALF_W = 34, GOAL_HALF = 3.66, BAR_H = 2.44, GOAL_DEPTH = 2.4;
const BOX_D = 16.5, BOX_HALF = 20.16, SIX_D = 5.5, SIX_HALF = 9.16, SPOT_D = 11, CIRCLE_R = 9.15;
const STEP = 1 / 60, MATCH_SECONDS = 360, HALF_SECONDS = 180, MAX_GOALS = 12;
const GROUND_K = 0.6, AIR_K = 0.15, ROLL_DECEL = 1.2, GRAVITY = 9.8;
const LINE_X = { DF: -30, MF: -10, FW: 12 };
const SWEET_POWER = 0.86;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hyp = Math.hypot;
function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}
function shortName(n) {
  const parts = String(n || "").trim().split(" ");
  const s = parts[parts.length - 1] || "Player";
  return s.length > 11 ? s.slice(0, 10) + "." : s;
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
  return hyp(px - (ax + dx * t), py - (ay + dy * t));
}

// =====================================================================
// SIM
// =====================================================================
// setup: { home, away, side: "home" or "away", homeXI, awayXI }, XI rows are { n, pos, role, r }
// Team 0 is always the person playing and always attacks to the right.
function createSim(setup, opts) {
  opts = opts || {};
  const rng = opts.rng || Math.random;
  const gauss = () => {
    let u = 0;
    while (u === 0) u = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  };
  const pick = arr => arr[Math.floor(rng() * arr.length)];
  const userHome = setup.side !== "away";
  const xis = userHome ? [setup.homeXI, setup.awayXI] : [setup.awayXI, setup.homeXI];
  const names = userHome ? [setup.home, setup.away] : [setup.away, setup.home];

  const m = {
    t: 0, half: 1, phase: "kickoff", phaseT: 2.2, score: [0, 0],
    players: [], teams: [], ctrl: null, auto: !!opts.auto, events: [],
    stats: { shots: [0, 0], onTarget: [0, 0], poss: [0, 0] },
    charge: 0, charging: false, sprinting: false, tired: false, switchCd: 0, hands: 0, assist: false,
    restart: null, nextKick: 0, done: false, userHome, lateCall: false, overT: 0,
    ball: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, owner: null, lastTeam: -1, lastPlayer: null, passTo: null, shot: null, protect: 0, kickId: 0, roll: 0 }
  };
  const b = m.ball;

  function buildTeam(ti, xi, name) {
    const dir = ti === 0 ? 1 : -1;
    const list = (xi || []).slice(0, 11).map(p => ({
      n: String(p.n || "Player"), pos: p.pos, role: String(p.role || p.pos || "CM"), r: clamp(Number(p.r) || 60, 40, 99)
    }));
    while (list.length < 11) list.push({ n: "Youth player", pos: "MF", role: "CM", r: 55 });
    let gkI = list.findIndex(p => p.pos === "GK");
    if (gkI < 0) { gkI = 0; list.forEach((p, i) => { if (p.r < list[gkI].r) gkI = i; }); }
    list.forEach((p, i) => {
      p.line = i === gkI ? "GK" : (p.pos === "DF" || p.pos === "MF" || p.pos === "FW") ? p.pos : (p.pos === "GK" ? "DF" : "MF");
    });
    const avg = list.reduce((s, p) => s + p.r, 0) / list.length;
    const T = { idx: ti, name, dir, players: [], gk: null, avg, thinkGap: clamp(0.5 - (avg - 60) * 0.008, 0.16, 0.5), pressN: 1, pressMs: 0.9, tackleAdj: 0 };
    const lat = r => (r[0] === "L" ? -1 : r[0] === "R" ? 1 : 0);
    for (const line of ["GK", "DF", "MF", "FW"]) {
      const grp = list.filter(p => p.line === line).sort((a, c) => lat(a.role) - lat(c.role));
      const n = grp.length, gap = n > 1 ? Math.min(16, 54 / (n - 1)) : 0;
      grp.forEach((src, i) => {
        let bx = line === "GK" ? -48.5 : LINE_X[line];
        const by = (i - (n - 1) / 2) * gap;
        if (src.role === "CDM") bx -= 6;
        if (src.role === "CAM") bx += 6;
        if (line === "FW" && lat(src.role) !== 0 && n > 1) bx -= 3;
        if (line === "DF" && lat(src.role) !== 0) bx += 2;
        const p = {
          id: m.players.length, team: ti, name: src.n, label: shortName(src.n), line, rating: src.r, gk: line === "GK",
          bx, by, x: bx * dir, y: by * dir, vx: 0, vy: 0, face: dir > 0 ? 0 : Math.PI,
          sp: 5.7 + (src.r - 60) * 0.05, stamina: 1, stun: 0, tackleCd: 0, kickCd: 0,
          think: rng() * 0.3, drib: dir > 0 ? 0 : Math.PI, tx: bx * dir, ty: by * dir, ms: 0.7, manual: false, mvx: 0, mvy: 0,
          jx: 0, jy: 0, jT: rng() * 2, diving: false, react: 0, shotId: -1, misread: 0, hold: 0,
          reactTime: clamp(0.43 - (src.r - 60) * 0.005, 0.22, 0.48), dive: 4.2 + (src.r - 60) * 0.05, catchLimit: 14 + (src.r - 60) * 0.2
        };
        m.players.push(p);
        T.players.push(p);
        if (p.gk) T.gk = p;
      });
    }
    return T;
  }
  m.teams.push(buildTeam(0, xis[0], names[0]));
  m.teams.push(buildTeam(1, xis[1], names[1]));

  // difficulty: how much stronger the other side is, from the real squad ratings
  m.edge = clamp((m.teams[1].avg - m.teams[0].avg) / 10, -1, 1);
  m.teams[0].pressN = m.edge < -0.4 ? 2 : 1;
  // against a real person the other side closes down with two unless they are clearly the weaker team
  m.teams[1].pressN = m.edge > 0.4 || (!m.auto && m.edge > -0.4) ? 2 : 1;
  m.teams[0].pressMs = 0.9 - 0.05 * m.edge;
  m.teams[1].pressMs = 0.9 + 0.05 * m.edge;
  m.teams[0].tackleAdj = -0.05 * m.edge;
  m.teams[1].tackleAdj = 0.05 * m.edge;

  // true while the person playing is really steering this player. When their hands are off
  // the keys the player carries on by himself, so nobody is left standing like a statue.
  function steered(p) { return !m.auto && p === m.ctrl && !m.assist; }
  function emit(ev) { m.events.push(ev); }
  function say(text) { emit({ type: "say", text }); }
  function minute() {
    if (m.half === 1) return Math.min(45, Math.floor(m.t / HALF_SECONDS * 45));
    return Math.min(90, 45 + Math.floor((m.t - HALF_SECONDS) / HALF_SECONDS * 45));
  }
  function result() {
    return userHome ? { home: m.score[0], away: m.score[1] } : { home: m.score[1], away: m.score[0] };
  }
  function scoreText() {
    const r = result();
    return r.home + "-" + r.away;
  }

  // ---------- ball helpers ----------
  function ballAt(t) {
    const k = (b.z > 0.05 || b.vz > 0) ? AIR_K * 2 : GROUND_K;
    const f = (1 - Math.exp(-k * t)) / k;
    return [b.x + b.vx * f, b.y + b.vy * f];
  }
  function intercept(p) {
    for (let t = 0; t <= 3; t += 0.1) {
      const q = ballAt(t);
      if (hyp(q[0] - p.x, q[1] - p.y) <= p.sp * 0.9 * t + 0.8) return q;
    }
    return ballAt(3);
  }
  function kick(p, ang, speed, vz) {
    b.owner = null;
    b.vx = Math.cos(ang) * speed;
    b.vy = Math.sin(ang) * speed;
    b.vz = vz;
    b.lastTeam = p.team;
    b.lastPlayer = p;
    b.passTo = null;
    b.shot = null;
    b.protect = 0;
    b.kickId++;
    p.kickCd = 0.4;
    p.hold = 0;
  }
  function passBall(p, mate) {
    const ax = mate.x + mate.vx * 0.35, ay = mate.y + mate.vy * 0.35;
    const d = hyp(ax - p.x, ay - p.y);
    const ang = Math.atan2(ay - b.y, ax - b.x) + gauss() * (0.8 + (95 - p.rating) * 0.07) * Math.PI / 180;
    if (d > 26) {
      const vz = clamp(3 + d * 0.12, 5, 9), T = 2 * vz / GRAVITY;
      kick(p, ang, d / T * 1.08, vz);
    } else {
      kick(p, ang, clamp(8 + d * 0.62, 10, 23), 0);
    }
    b.passTo = mate;
  }
  function shootBall(p, ang, speed, vz) {
    kick(p, ang, speed, vz);
    b.shot = { team: p.team, by: p, t: 0, speed };
    m.stats.shots[p.team]++;
  }
  function take(p, protect) {
    b.owner = p;
    b.passTo = null;
    b.shot = null;
    b.lastTeam = p.team;
    b.lastPlayer = p;
    b.z = 0;
    b.vz = 0;
    b.protect = protect;
    p.hold = 0;
    p.think = Math.min(p.think, 0.15 + rng() * 0.15);
  }

  // ---------- team AI ----------
  function shape(p, T, has, oppHas, dt) {
    const dir = T.dir;
    const bax = b.x * dir, bay = b.y * dir;
    p.jT -= dt;
    if (p.jT <= 0) {
      p.jT = 1.5 + rng() * 2;
      p.jx = rng() * 9 - 3;
      p.jy = (rng() - 0.5) * 10;
    }
    const f = p.line === "DF" ? 0.6 : p.line === "MF" ? 0.72 : 0.78;
    let ax = p.bx + bax * f + (has ? 7 + p.jx : oppHas ? -3 : 1);
    if (p.line === "DF") ax = clamp(ax, -45, 6);
    else if (p.line === "MF") ax = clamp(ax, -38, 36);
    else ax = clamp(ax, -20, 47);
    const ay = clamp(p.by * (has ? 1.05 : 0.8) + bay * 0.3 + (has ? p.jy : 0), -31, 31);
    p.tx = ax * dir;
    p.ty = ay * dir;
    p.ms = hyp(p.tx - p.x, p.ty - p.y) > 12 ? 0.9 : 0.72;
  }

  function nearestOpp(x, y, opp) {
    let best = 1e9;
    for (const q of opp.players) {
      const d = hyp(q.x - x, q.y - y);
      if (d < best) best = d;
    }
    return best;
  }

  function bestPass(p, T, opp) {
    const dir = T.dir, goalX = HALF_L * dir;
    let best = null;
    for (const mate of T.players) {
      if (mate === p || mate.stun > 0) continue;
      if (mate.gk && p.x * dir > -25) continue;
      const d = hyp(mate.x - p.x, mate.y - p.y);
      if (d < 5 || d > 42) continue;
      let open = 9;
      let lane = 1e9;
      for (const q of opp.players) {
        const dq = hyp(q.x - mate.x, q.y - mate.y);
        if (dq < open) open = dq;
        const sd = segDist(q.x, q.y, p.x, p.y, mate.x, mate.y);
        if (sd < lane) lane = sd;
      }
      if (d <= 26) { if (lane < 1.8 + d * 0.05) continue; }
      else if (open < 4) continue;
      let val = (mate.x - p.x) * dir * 0.9 + open * 1.4 - d * 0.08;
      if (hyp(goalX - mate.x, mate.y) < 22) val += 6;
      if (!best || val > best.val) best = { mate, val };
    }
    return best;
  }

  function aiShoot(p, T, press) {
    const goalX = HALF_L * T.dir;
    const g = m.teams[1 - T.idx].gk;
    let side = g.y >= 0 ? -1 : 1;
    if (rng() < 0.2) side = -side;
    const aimY = side * (GOAL_HALF - 0.9);
    const sigma = (2.2 + (95 - p.rating) * 0.25) * (press < 2.5 ? 1.3 : 1);
    const ang = Math.atan2(aimY - b.y, goalX - b.x) + gauss() * sigma * Math.PI / 180;
    shootBall(p, ang, 21 + rng() * 6 + (p.rating - 70) * 0.08, 1.5 + rng() * 3.5);
  }

  function carrierAI(p, T, dt) {
    const dir = T.dir, goalX = HALF_L * dir;
    const opp = m.teams[1 - T.idx];
    p.think -= dt;
    if (p.think <= 0) {
      p.think = T.thinkGap * (0.7 + rng() * 0.6);
      const gdx = goalX - p.x, gdy = -p.y, dGoal = hyp(gdx, gdy);
      let press = 1e9;
      for (const q of opp.players) {
        if (q.stun > 0) continue;
        const d = hyp(q.x - p.x, q.y - p.y);
        if (d < press) press = d;
      }
      if (dGoal < 27 && Math.abs(gdx) > 2.5 && Math.abs(p.y) < 19) {
        let pr = dGoal < 11 ? 1 : clamp((27 - dGoal) / 15, 0, 1);
        pr *= pr;
        let blocked = false;
        for (const q of opp.players) {
          if (q.gk) continue;
          if (hyp(q.x - p.x, q.y - p.y) < 7 && segDist(q.x, q.y, p.x, p.y, goalX, 0) < 1.4 && (q.x - p.x) * dir > 0) blocked = true;
        }
        if (blocked) pr *= 0.35;
        if (rng() < pr) { aiShoot(p, T, press); return; }
      }
      const opt = bestPass(p, T, opp);
      if (opt && ((press < 3.2 && rng() < 0.8) || (opt.val > 9 && rng() < 0.45))) { passBall(p, opt.mate); return; }
      if (!opt && press < 2.2 && p.x * dir < -20 && rng() < 0.5) {
        kick(p, Math.atan2(-p.y * 0.3, dir) + gauss() * 0.2, 22, 7.5);
        return;
      }
      let ax = gdx, ay = dGoal < 32 ? gdy : gdy * 0.25;
      const al = hyp(ax, ay) || 1;
      ax /= al; ay /= al;
      let sx = ax, sy = ay;
      for (const q of opp.players) {
        const dx = q.x - p.x, dy = q.y - p.y, d = hyp(dx, dy);
        if (d > 6.5 || d < 0.01 || dx * ax + dy * ay <= 0) continue;
        const cross = ax * dy - ay * dx;
        const s = cross > 0 ? -1 : cross < 0 ? 1 : (rng() < 0.5 ? -1 : 1);
        const w = 1.6 * (6.5 - d) / 6.5;
        sx += -ay * s * w;
        sy += ax * s * w;
      }
      if (Math.abs(p.y) > 29) sy += p.y > 0 ? -1.2 : 1.2;
      p.drib = Math.atan2(sy, sx);
    }
    p.tx = p.x + Math.cos(p.drib) * 5;
    p.ty = p.y + Math.sin(p.drib) * 5;
    p.ms = 0.85;
  }

  function gkAI(g, T, dt, live) {
    const dir = T.dir, goalX = -HALF_L * dir;
    const opp = m.teams[1 - T.idx];
    g.diving = false;
    if (live && b.owner === g) {
      g.hold += dt;
      g.tx = g.x; g.ty = g.y; g.ms = 0.3;
      g.face = dir > 0 ? 0 : Math.PI;
      if (g.hold > 0.9) {
        const opt = bestPass(g, T, opp);
        if (opt) passBall(g, opt.mate);
        else kick(g, Math.atan2(-g.y * 0.2, dir) + gauss() * 0.25, 24, 8.5);
      }
      return;
    }
    // a ball flying at this goal
    if (live && !b.owner && b.vx * -dir > 5) {
      const tg = (goalX - b.x) / b.vx;
      if (tg > 0 && tg < 2.2 && Math.abs(b.y + b.vy * tg) < GOAL_HALF + 2) {
        if (g.shotId !== b.kickId) {
          g.shotId = b.kickId;
          g.react = g.reactTime * (0.8 + rng() * 0.5);
          g.misread = gauss() * (0.25 + (90 - g.rating) * 0.012);
        }
        g.react -= dt;
        if (g.react <= 0) {
          const tk = Math.max(0, (g.x - b.x) / b.vx);
          g.tx = g.x;
          g.ty = clamp(b.y + b.vy * tk + g.misread, -GOAL_HALF - 1.5, GOAL_HALF + 1.5);
          g.diving = true;
        } else {
          g.tx = g.x; g.ty = g.y; g.ms = 0.3;
        }
        return;
      }
    }
    const inBox = Math.abs(b.x - goalX) < BOX_D && Math.abs(b.y) < BOX_HALF;
    if (live && inBox) {
      const dg = hyp(g.x - b.x, g.y - b.y);
      if (!b.owner && hyp(b.vx, b.vy) < 9 && dg < nearestOpp(b.x, b.y, opp) + 1) {
        g.tx = b.x; g.ty = b.y; g.ms = 0.95;
        return;
      }
      if (b.owner && b.owner.team !== g.team && dg < 9) {
        g.tx = b.x; g.ty = b.y; g.ms = 0.88;
        return;
      }
    }
    let ux = b.x - goalX, uy = b.y;
    const ul = hyp(ux, uy) || 1;
    const out = clamp(ul * 0.1, 1, 5);
    ux /= ul; uy /= ul;
    g.tx = goalX + ux * out;
    g.ty = clamp(uy * out, -GOAL_HALF - 1, GOAL_HALF + 1);
    if ((g.tx - goalX) * dir < 0.6) g.tx = goalX + 0.6 * dir;
    g.ms = 0.8;
  }

  function press(T, o) {
    const gx = -HALF_L * T.dir;
    let ux = gx - o.x, uy = -o.y;
    const ul = hyp(ux, uy) || 1;
    ux /= ul; uy /= ul;
    const sx = o.x + o.vx * 0.25 + ux * 0.7, sy = o.y + o.vy * 0.25 + uy * 0.7;
    const cands = T.players
      .filter(p => !p.gk && p.stun <= 0 && !steered(p))
      .sort((p, q) => hyp(p.x - sx, p.y - sy) - hyp(q.x - sx, q.y - sy));
    for (let i = 0; i < Math.min(T.pressN, cands.length); i++) {
      const p = cands[i];
      if (i === 0) {
        if (hyp(p.x - b.x, p.y - b.y) < 2.5) { p.tx = b.x; p.ty = b.y; }
        else { p.tx = sx; p.ty = sy; }
      } else {
        p.tx = o.x + ux * 4; p.ty = o.y + uy * 4;
      }
      p.ms = T.pressMs;
    }
  }

  function chase(T) {
    let ch = null;
    if (b.passTo && b.passTo.team === T.idx) ch = b.passTo;
    else {
      let bt = 1e9;
      for (const p of T.players) {
        if (p.gk || p.stun > 0 || steered(p)) continue;
        const q = intercept(p);
        const t = hyp(q[0] - p.x, q[1] - p.y) / p.sp;
        if (t < bt) { bt = t; ch = p; }
      }
    }
    if (ch && !steered(ch)) {
      const q = intercept(ch);
      ch.tx = q[0]; ch.ty = q[1]; ch.ms = 0.96;
    }
  }

  function teamAI(T, dt, live, hasOverride) {
    const own = b.owner;
    const has = hasOverride !== undefined ? hasOverride : !!(own && own.team === T.idx);
    const oppHas = hasOverride !== undefined ? !hasOverride : !!(own && own.team !== T.idx);
    for (const p of T.players) if (!p.gk) shape(p, T, has, oppHas, dt);
    gkAI(T.gk, T, dt, live);
    if (!live) return;
    if (own && own.team === T.idx) {
      if (!own.gk && !steered(own)) carrierAI(own, T, dt);
    } else if (own) press(T, own);
    else chase(T);
  }

  // ---------- the person playing ----------
  function updateCtrl(dt) {
    const T = m.teams[0], o = b.owner;
    m.switchCd -= dt;
    if (o && o.team === 0 && !o.gk) { m.ctrl = o; return; }
    if (!o && b.passTo && b.passTo.team === 0 && !b.passTo.gk) { m.ctrl = b.passTo; return; }
    const f = ballAt(0.35);
    let best = null, bd = 1e9;
    for (const p of T.players) {
      if (p.gk) continue;
      const d = hyp(p.x - f[0], p.y - f[1]);
      if (d < bd) { bd = d; best = p; }
    }
    const cd = m.ctrl ? hyp(m.ctrl.x - f[0], m.ctrl.y - f[1]) : 1e9;
    if (best && best !== m.ctrl && cd - bd > 3 && m.switchCd <= 0) { m.ctrl = best; m.switchCd = 0.7; }
  }
  function manualSwitch() {
    let best = null, bd = 1e9;
    for (const p of m.teams[0].players) {
      if (p.gk || p === m.ctrl) continue;
      const d = hyp(p.x - b.x, p.y - b.y);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) { m.ctrl = best; m.switchCd = 1.5; }
  }
  function userPass(c) {
    let best = null, bs = 1e9;
    for (const wide of [1.0, 1.75]) {
      for (const mate of m.teams[0].players) {
        if (mate === c) continue;
        const d = hyp(mate.x - c.x, mate.y - c.y);
        if (d < 3 || d > 45) continue;
        const a = Math.abs(angDiff(Math.atan2(mate.y - c.y, mate.x - c.x), c.face));
        if (a > wide) continue;
        const s = a + d * 0.004;
        if (s < bs) { bs = s; best = mate; }
      }
      if (best) break;
    }
    if (best) passBall(c, best);
    else kick(c, c.face, 14, 0);
  }
  function userShoot(c, power, iy) {
    const goalX = HALF_L;
    let ang = c.face;
    const atGoal = Math.cos(c.face) > 0.2 && c.x < goalX - 0.5;
    if (atGoal) {
      const g = m.teams[1].gk;
      const side = iy < -0.3 ? -1 : iy > 0.3 ? 1 : (g.y >= 0 ? -1 : 1);
      ang = Math.atan2(side * (GOAL_HALF - 0.8) - b.y, goalX - b.x);
    }
    ang += gauss() * (1.5 + (95 - c.rating) * 0.2 + power * 2) * Math.PI / 180;
    const speed = 15 + 15 * power, vz = 1.2 + power * power * 7.3;
    if (atGoal) shootBall(c, ang, speed, vz);
    else kick(c, ang, speed, vz);
  }
  function userControl(inp, dt) {
    const c = m.ctrl;
    if (!c) return;
    const ix = inp.mx || 0, iy = inp.my || 0, mag = hyp(ix, iy);
    const has = b.owner === c;
    if (m.tired && c.stamina > 0.25) m.tired = false;
    const sprint = !!inp.sprint && mag > 0 && c.stamina > 0.02 && !m.tired;
    m.sprinting = sprint;
    if (m.assist) { m.charge = 0; m.charging = false; return; }
    if (sprint) {
      c.stamina = Math.max(0, c.stamina - 0.3 * dt);
      if (c.stamina <= 0.02) m.tired = true;
    }
    if (c.stun <= 0) {
      if (mag === 0 && !has && b.passTo === c) {
        const q = intercept(c);
        c.tx = q[0]; c.ty = q[1]; c.ms = 0.95;
      } else {
        c.manual = true;
        const sp = c.sp * (sprint ? 1.12 : 0.82) * (has ? 0.93 : 1) * (m.charging ? 0.85 : 1);
        c.mvx = mag > 0 ? ix / mag * sp : 0;
        c.mvy = mag > 0 ? iy / mag * sp : 0;
      }
    }
    if (has) {
      if (inp.shoot) {
        m.charge = Math.min(1, m.charge + dt / 0.85);
        m.charging = true;
      } else if (m.charging) {
        userShoot(c, Math.max(0.25, m.charge), iy);
        m.charge = 0; m.charging = false;
      }
      if (inp.pass && b.owner === c) { userPass(c); m.charge = 0; m.charging = false; }
    } else {
      m.charge = 0; m.charging = false;
      if (inp.pass) manualSwitch();
    }
  }

  // ---------- movement ----------
  function movePlayers(dt) {
    for (const p of m.players) {
      if (p.stun > 0) p.stun -= dt;
      if (p.tackleCd > 0) p.tackleCd -= dt;
      if (p.kickCd > 0) p.kickCd -= dt;
      if (p.team === 0 && !(p === m.ctrl && m.sprinting)) p.stamina = Math.min(1, p.stamina + 0.14 * dt);
      let dvx = 0, dvy = 0;
      if (p.stun > 0) { /* beaten, standing still */ }
      else if (p.manual) { dvx = p.mvx; dvy = p.mvy; }
      else {
        const dx = p.tx - p.x, dy = p.ty - p.y, d = hyp(dx, dy);
        if (d > 0.05) {
          const sp = Math.min(p.diving ? p.dive : p.sp * p.ms, d * (p.diving ? 9 : 3.2));
          dvx = dx / d * sp; dvy = dy / d * sp;
        }
      }
      const k = Math.min(1, dt * (p.diving ? 16 : 9));
      p.vx += (dvx - p.vx) * k;
      p.vy += (dvy - p.vy) * k;
      p.x = clamp(p.x + p.vx * dt, -HALF_L - 2, HALF_L + 2);
      p.y = clamp(p.y + p.vy * dt, -HALF_W - 2, HALF_W + 2);
      if (hyp(p.vx, p.vy) > 0.6 && !p.diving) {
        const want = Math.atan2(p.vy, p.vx);
        p.face += clamp(angDiff(want, p.face), -dt * 14, dt * 14);
      }
    }
    // keep bodies from stacking on one spot
    const ps = m.players;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], c = ps[j];
      const dx = c.x - a.x, dy = c.y - a.y, d = hyp(dx, dy);
      if (d < 1 && d > 0.001) {
        const push = (1 - d) * 0.25;
        a.x -= dx / d * push; a.y -= dy / d * push;
        c.x += dx / d * push; c.y += dy / d * push;
      }
    }
  }

  function moveBall(dt) {
    const px = b.x, py = b.y;
    if (b.owner) {
      const o = b.owner;
      const tx = o.x + Math.cos(o.face) * 0.85, ty = o.y + Math.sin(o.face) * 0.85;
      const k = Math.min(1, dt * 18);
      b.x += (tx - b.x) * k; b.y += (ty - b.y) * k;
      b.vx = o.vx; b.vy = o.vy; b.z = 0; b.vz = 0;
    } else {
      if (b.z > 0.02 || b.vz > 0) {
        b.vz -= GRAVITY * dt;
        b.z += b.vz * dt;
        const f = Math.exp(-AIR_K * dt);
        b.vx *= f; b.vy *= f;
        if (b.z <= 0) {
          b.z = 0;
          if (b.vz < -2.5) { b.vz = -b.vz * 0.45; b.vx *= 0.8; b.vy *= 0.8; }
          else b.vz = 0;
        }
      } else {
        const s = hyp(b.vx, b.vy);
        if (s > 0) {
          const ns = Math.max(0, s * Math.exp(-GROUND_K * dt) - ROLL_DECEL * dt);
          b.vx *= ns / s; b.vy *= ns / s;
        }
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
    }
    b.roll += hyp(b.x - px, b.y - py);
    return [px, py];
  }

  // ---------- rules ----------
  function startRestart(type, team, x, y) {
    m.phase = "restart";
    m.phaseT = 1.1;
    b.owner = null; b.x = x; b.y = y; b.z = 0; b.vx = 0; b.vy = 0; b.vz = 0;
    b.passTo = null; b.shot = null;
    const T = m.teams[team];
    let taker = T.gk;
    if (type !== "goalkick") {
      let bd = 1e9;
      for (const p of T.players) {
        if (p.gk) continue;
        const d = hyp(p.x - x, p.y - y);
        if (d < bd) { bd = d; taker = p; }
      }
    }
    m.restart = { type, team, x, y, taker };
    m.charge = 0; m.charging = false;
  }

  function goal(att) {
    m.score[att] = Math.min(MAX_GOALS, m.score[att] + 1);
    const own = b.lastTeam !== att;
    const scorer = b.lastPlayer;
    if (b.shot && b.shot.team === att) m.stats.onTarget[att]++;
    if (b.owner) { b.vx = b.owner.vx; b.vy = b.owner.vy; b.owner = null; }
    b.shot = null; b.passTo = null;
    m.phase = "goal";
    m.phaseT = 3.2;
    m.nextKick = 1 - att;
    m.charge = 0; m.charging = false;
    const nm = scorer ? scorer.name : m.teams[att].name;
    emit({ type: "goal", team: att, name: nm, own, min: Math.max(1, minute()) });
    if (own) say("Own goal! " + m.teams[att].name + " get a gift. It is " + scoreText() + ".");
    else say(pick([
      "GOAL! " + nm + " finds the net! It is " + scoreText() + ".",
      nm + " scores! What a finish! " + scoreText() + ".",
      "It is in! " + nm + " makes it " + scoreText() + "."
    ]));
  }

  function checkBounds(px, py) {
    if (Math.abs(b.x) > HALF_L) {
      const side = b.x > 0 ? 1 : -1;
      const den = Math.abs(b.x) - Math.abs(px);
      const s = den > 1e-6 ? clamp((HALF_L - Math.abs(px)) / den, 0, 1) : 1;
      const yc = py + (b.y - py) * s, ay = Math.abs(yc);
      const att = side > 0 ? 0 : 1, def = 1 - att;
      if (ay < GOAL_HALF - 0.1 && b.z < BAR_H) { goal(att); return; }
      const wood = !b.owner && ((Math.abs(ay - GOAL_HALF) <= 0.22 && b.z < BAR_H + 0.2) || (ay < GOAL_HALF && b.z < BAR_H + 0.28));
      if (wood) {
        b.x = side * (HALF_L - 0.3);
        b.vx = -b.vx * 0.55;
        b.vy += gauss() * 2;
        b.kickId++;
        emit({ type: "post" });
        if (b.shot) say(ay < GOAL_HALF - 0.1 ? "Off the bar! So close!" : "Off the post! So close!");
        b.shot = null;
        return;
      }
      if (b.shot && b.shot.team === att) say(b.z >= BAR_H && ay < GOAL_HALF + 1 ? "Over the bar." : "Just wide.");
      const ys = yc >= 0 ? 1 : -1;
      if (b.lastTeam === def) startRestart("corner", att, side * (HALF_L - 0.6), ys * (HALF_W - 0.6));
      else startRestart("goalkick", def, side * (HALF_L - SIX_D), ys * 5);
      return;
    }
    if (Math.abs(b.y) > HALF_W) {
      const to = b.lastTeam === 0 ? 1 : 0;
      startRestart("throw", to, clamp(b.x, -HALF_L + 2, HALF_L - 2), (b.y > 0 ? 1 : -1) * (HALF_W - 0.4));
    }
  }

  function pickups() {
    if (b.owner) return;
    let best = null, bd = 1e9;
    for (const p of m.players) {
      if (p.stun > 0 || p.kickCd > 0) continue;
      if (b.z > (p.gk ? 2.6 : 1.5)) continue;
      const d = hyp(p.x - b.x, p.y - b.y);
      if (d < (p.gk ? (p.diving ? 1.4 : 1.2) : 1.15) && d < bd) { bd = d; best = p; }
    }
    if (!best) return;
    const rel = hyp(b.vx - best.vx, b.vy - best.vy);
    const shot = b.shot && b.shot.team !== best.team ? b.shot : null;
    if (best.gk) {
      const T = m.teams[best.team];
      if (shot) m.stats.onTarget[shot.team]++;
      if (rel > best.catchLimit) {
        const ys = Math.abs(b.vy) > 1 ? Math.sign(b.vy) : (b.y >= best.y ? 1 : -1);
        b.vx = T.dir * (6 + rng() * 5);
        b.vy = ys * (5 + rng() * 7);
        b.vz = 2 + rng() * 3;
        b.lastTeam = best.team;
        b.passTo = null; b.shot = null;
        b.kickId++;
        best.kickCd = 0.5;
        if (shot) {
          emit({ type: "save", big: true });
          say(pick(["What a save by " + best.name + "!", best.name + " keeps it out!", "Huge stop from " + best.name + "!"]));
        }
      } else {
        take(best, 2.5);
        if (shot) {
          emit({ type: "save", big: rel > 13 });
          if (rel > 13) say(pick([best.name + " holds on to it.", "Good hands from " + best.name + "."]));
        }
      }
      return;
    }
    if (rel > 15 + (best.rating - 60) * 0.15) {
      if (bd > 0.8) return;
      b.vx = -b.vx * 0.3 + gauss() * 2;
      b.vy = b.vy * 0.3 + gauss() * 3;
      b.vz = 1 + rng() * 2;
      b.lastTeam = best.team;
      if (!b.shot) b.lastPlayer = best;
      b.passTo = null; b.shot = null;
      b.kickId++;
      best.kickCd = 0.3;
      return;
    }
    take(best, 0.25);
  }

  function tackles() {
    const o = b.owner;
    if (!o || o.gk || b.protect > 0) return;
    for (const q of m.players) {
      if (q.team === o.team || q.stun > 0 || q.tackleCd > 0) continue;
      if (hyp(q.x - b.x, q.y - b.y) > (q.gk ? 1.5 : 1.25)) continue;
      let pr = 0.42 + (q.rating - o.rating) * 0.012 + m.teams[q.team].tackleAdj;
      if (!m.auto) {
        if (q === m.ctrl) pr += 0.08;
        if (o === m.ctrl && m.sprinting) pr += 0.08;
      }
      if (q.gk) pr += 0.15;
      if (rng() < clamp(pr, 0.12, 0.85)) {
        o.stun = 0.45; o.tackleCd = 0.9; q.tackleCd = 0.5;
        take(q, q.gk ? 2.5 : 0.5);
        emit({ type: "tackle", team: q.team });
        return;
      }
      q.stun = 0.55; q.tackleCd = 1.1;
    }
  }

  function setupKickoff(ti) {
    m.phase = "kickoff";
    m.phaseT = 1.5;
    for (const T of m.teams) for (const p of T.players) {
      const ax = p.gk ? -48.5 : Math.min(p.bx * 0.85 - 4, -2);
      p.x = ax * T.dir; p.y = p.by * T.dir;
      p.vx = 0; p.vy = 0; p.stun = 0; p.tackleCd = 0; p.kickCd = 0; p.diving = false; p.manual = false;
      p.face = T.dir > 0 ? 0 : Math.PI;
      p.tx = p.x; p.ty = p.y;
    }
    for (const p of m.teams[1 - ti].players) {
      const d = hyp(p.x, p.y);
      if (d < 10.5 && d > 0.01) { p.x *= 10.5 / d; p.y *= 10.5 / d; }
      else if (d <= 0.01) p.x = -10.5 * m.teams[1 - ti].dir;
    }
    const K = m.teams[ti];
    const kicker = K.players.filter(p => !p.gk).sort((p, q) => (q.bx - Math.abs(q.by) * 0.5) - (p.bx - Math.abs(p.by) * 0.5))[0];
    kicker.x = -0.9 * K.dir; kicker.y = 0;
    kicker.think = 0.25;
    b.x = 0; b.y = 0; b.z = 0; b.vx = 0; b.vy = 0; b.vz = 0;
    b.passTo = null; b.shot = null;
    take(kicker, 1.2);
    kicker.think = 0.25;
    m.charge = 0; m.charging = false;
    if (!m.auto) {
      if (ti === 0) m.ctrl = kicker;
      else m.ctrl = m.teams[0].players.filter(p => !p.gk).sort((p, q) => hyp(p.x, p.y) - hyp(q.x, q.y))[0];
    }
  }

  function danger() {
    if (b.shot) return true;
    const o = b.owner;
    return !!(o && !o.gk && hyp(HALF_L * m.teams[o.team].dir - o.x, o.y) < 20);
  }

  // ---------- one fixed step ----------
  function step(inp) {
    const dt = STEP;
    inp = inp || {};
    if (m.phase === "full") return;
    for (const p of m.players) p.manual = false;

    if (m.phase === "kickoff") {
      m.phaseT -= dt;
      moveBall(dt);
      if (m.phaseT <= 0) m.phase = "play";
      return;
    }
    if (m.phase === "goal") {
      m.phaseT -= dt;
      for (const p of m.players) { p.tx = p.x; p.ty = p.y; p.ms = 0.3; p.diving = false; }
      movePlayers(dt);
      moveBall(dt);
      if (Math.abs(b.x) > HALF_L) {
        const lim = HALF_L + GOAL_DEPTH - 0.4;
        if (Math.abs(b.x) > lim) { b.x = Math.sign(b.x) * lim; b.vx *= -0.15; }
        if (Math.abs(b.y) > GOAL_HALF - 0.3) { b.y = Math.sign(b.y) * (GOAL_HALF - 0.3); b.vy *= -0.2; }
        b.vx *= 0.93; b.vy *= 0.93;
      }
      if (m.phaseT <= 0) setupKickoff(m.nextKick);
      return;
    }
    if (m.phase === "halftime") {
      m.phaseT -= dt;
      if (m.phaseT <= 0) {
        m.half = 2;
        m.t = HALF_SECONDS;
        setupKickoff(userHome ? 1 : 0);
        say("Second half is go!");
      }
      return;
    }
    if (m.phase === "restart") {
      const R = m.restart;
      m.phaseT -= dt;
      for (const T of m.teams) teamAI(T, dt, false, T.idx === R.team);
      for (const p of m.teams[1 - R.team].players) {
        const dx = p.tx - R.x, dy = p.ty - R.y, d = hyp(dx, dy);
        if (d < 8) {
          const ux = d > 0.01 ? dx / d : -Math.sign(R.x || 1), uy = d > 0.01 ? dy / d : 0;
          p.tx = clamp(R.x + ux * 8, -HALF_L, HALF_L); p.ty = clamp(R.y + uy * 8, -HALF_W, HALF_W);
        }
      }
      R.taker.tx = R.x; R.taker.ty = R.y; R.taker.ms = 1.5;
      movePlayers(dt);
      if (m.phaseT <= 0 && (hyp(R.taker.x - R.x, R.taker.y - R.y) < 1.2 || m.phaseT < -2.5)) {
        const T = m.teams[R.team];
        const face = R.type === "goalkick" ? (T.dir > 0 ? 0 : Math.PI) : Math.atan2(-R.y, HALF_L * T.dir * 0.4 - R.x);
        R.taker.face = face;
        R.taker.x = R.x - Math.cos(face) * 0.85;
        R.taker.y = R.y - Math.sin(face) * 0.85;
        R.taker.vx = 0; R.taker.vy = 0;
        R.taker.drib = face;
        take(R.taker, 1.4);
        R.taker.think = 0.3;
        if (!m.auto && R.team === 0 && !R.taker.gk) m.ctrl = R.taker;
        m.phase = "play";
        m.restart = null;
      }
      return;
    }

    // live play
    m.t += dt;
    if (b.protect > 0) b.protect -= dt;
    if (b.shot) { b.shot.t += dt; if (b.shot.t > 3) b.shot = null; }
    if (b.owner) m.stats.poss[b.owner.team] += dt;
    if (!m.lateCall && m.half === 2 && minute() >= 85) { m.lateCall = true; say("Into the last few minutes!"); }

    const limit = m.half === 1 ? HALF_SECONDS : MATCH_SECONDS;
    if (m.t >= limit) {
      m.overT += dt;
      if (!danger() || m.overT > 5) {
        m.overT = 0;
        if (m.half === 1) {
          m.phase = "halftime"; m.phaseT = 4;
          emit({ type: "half" });
          say("Half time. It is " + scoreText() + ".");
        } else {
          m.phase = "full"; m.done = true;
          emit({ type: "full" });
          say("Full time! It ends " + scoreText() + ".");
        }
        return;
      }
    }

    if (!m.auto) {
      updateCtrl(dt);
      m.hands = (inp.mx || inp.my || inp.shoot || inp.pass) ? 0 : m.hands + dt;
      m.assist = m.hands > (b.owner === m.ctrl ? 2 : 0.3);
    }
    for (const T of m.teams) teamAI(T, dt, true);
    if (!m.auto) userControl(inp, dt);
    movePlayers(dt);
    const prev = moveBall(dt);
    checkBounds(prev[0], prev[1]);
    if (m.phase !== "play") return;
    pickups();
    tackles();
  }

  setupKickoff(userHome ? 0 : 1);
  m.phaseT = 2.2;
  say("We are under way!");

  return { m, step, minute, result };
}

// =====================================================================
// LOOK
// =====================================================================
const KITS = {
  "Arsenal": ["#e3202b", "#ffffff"], "Aston Villa": ["#7b1642", "#95bfe5"], "Bournemouth": ["#c8102e", "#111111"],
  "Brentford": ["#e30613", "#ffffff"], "Brighton": ["#0057b8", "#ffffff"], "Burnley": ["#6c1d45", "#99d6ea"],
  "Chelsea": ["#1e4fd6", "#ffffff"], "Crystal Palace": ["#1b458f", "#c4122e"], "Everton": ["#1f4aa8", "#ffffff"],
  "Fulham": ["#f5f5f5", "#111111"], "Leeds United": ["#f7f7f2", "#1d428a"], "Liverpool": ["#c8102e", "#f6eb61"],
  "Man City": ["#6cabdd", "#1c2c5b"], "Man United": ["#da291c", "#111111"], "Newcastle": ["#2a2a2a", "#ffffff"],
  "Nottingham Forest": ["#dd0000", "#ffffff"], "Sunderland": ["#eb172b", "#ffffff"], "Tottenham": ["#f4f6fa", "#132257"],
  "West Ham": ["#7a263a", "#1bb1e7"], "Wolves": ["#fdb913", "#231f20"],
  "Real Madrid": ["#fbfbfb", "#c9a227"], "Barcelona": ["#a50044", "#004d98"], "Atletico Madrid": ["#cb3524", "#ffffff"],
  "Athletic Bilbao": ["#ee2523", "#ffffff"], "Real Sociedad": ["#1763b5", "#ffffff"], "Villarreal": ["#ffe667", "#005187"],
  "Real Betis": ["#0bb363", "#ffffff"], "Sevilla": ["#f8f8f8", "#d81e05"], "Valencia": ["#f5f5f5", "#111111"],
  "Inter Milan": ["#1a4fb0", "#111111"], "AC Milan": ["#e2001a", "#111111"], "Juventus": ["#f5f5f5", "#111111"],
  "Napoli": ["#12a0d7", "#ffffff"], "Roma": ["#8e1f2f", "#f0bc42"], "Lazio": ["#87d8f7", "#ffffff"],
  "Atalanta": ["#1e71b8", "#111111"], "Fiorentina": ["#592c82", "#ffffff"],
  "Bayern Munich": ["#dc052d", "#ffffff"], "Borussia Dortmund": ["#fde100", "#111111"], "Bayer Leverkusen": ["#e32221", "#111111"],
  "RB Leipzig": ["#f4f4f4", "#dd0741"],
  "PSG": ["#1a2b5c", "#e30613"], "Marseille": ["#f6f8fb", "#2faee0"], "Monaco": ["#e63027", "#ffffff"], "Lyon": ["#f5f5f7", "#14387f"],
  "Galatasaray": ["#e88a00", "#a90432"], "Fenerbahce": ["#f6dd00", "#163962"], "Besiktas": ["#f4f4f4", "#111111"], "Trabzonspor": ["#7a1630", "#56a7df"],
  "Ajax": ["#f6f6f6", "#d2122e"], "PSV": ["#ed1c24", "#ffffff"], "Feyenoord": ["#e4002b", "#f4f4f4"],
  "Benfica": ["#e83030", "#ffffff"], "Porto": ["#1d4f9c", "#ffffff"], "Sporting CP": ["#0a8f55", "#ffffff"],
  "Celtic": ["#0e9a4e", "#ffffff"], "Rangers": ["#1b458f", "#ffffff"],
  "Al-Hilal": ["#1857a8", "#ffffff"], "Al-Nassr": ["#f7d117", "#1b3f8b"], "Al-Ittihad": ["#f2c200", "#111111"], "Al-Ahli": ["#0d7a4a", "#ffffff"],
  "Inter Miami": ["#f5b5c8", "#111111"], "LAFC": ["#1a1a1a", "#c39e6d"], "LA Galaxy": ["#f5f5f5", "#00245d"]
};
function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hslHex(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return "#" + f(0) + f(8) + f(4);
}
function kitFor(name) {
  if (KITS[name]) return KITS[name];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  if (h > 85 && h < 150) h = (h + 110) % 360; // keep made up kits away from grass green
  return [hslHex(h, 0.7, 0.45), "#ffffff"];
}
function colDist(a, c) {
  const x = hexRgb(a), y = hexRgb(c);
  return hyp(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}
function lum(h) {
  const c = hexRgb(h);
  return (c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114) / 255;
}
// the person playing keeps their real colours, the other side changes if the two clash
function pickKits(mine, theirs) {
  const a = kitFor(mine);
  let c = kitFor(theirs);
  if (colDist(a[0], c[0]) < 120) {
    if (colDist(a[0], c[1]) >= 120 && colDist(c[1], "#2e9b4c") > 90) c = [c[1], c[0]];
    else c = lum(a[0]) > 0.6 ? ["#1b2430", "#ffffff"] : ["#f4f6fa", "#1b2430"];
  }
  return [a, c];
}

function makeView(canvas) {
  const ctx = canvas.getContext("2d");
  const fx = { camX: 0, camY: 0, snap: true, shake: 0, flash: 0, goalT: 0, goalText: "", goalSub: "", toast: "", toastT: 0, time: 0, net: [0, 0], savePop: 0 };
  let kits = null, kitKey = "";
  const FONT = '"Chakra Petch", "Inter", "Arial Narrow", Arial, sans-serif';

  function onEvent(ev, sim) {
    if (ev.type === "goal") {
      fx.flash = 1; fx.shake = 1; fx.goalT = 2.8;
      fx.goalText = ev.own ? "OWN GOAL!" : "GOAL!";
      fx.goalSub = ev.name + " " + ev.min + "'";
      fx.net[ev.team === 0 ? 1 : 0] = 1;
    } else if (ev.type === "save" && ev.big) { fx.shake = Math.max(fx.shake, 0.35); fx.savePop = 0.5; }
    else if (ev.type === "post") fx.shake = Math.max(fx.shake, 0.45);
    else if (ev.type === "say") { fx.toast = ev.text; fx.toastT = 3.4; }
  }

  function pill(x, y, w, h, r, fill) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function drawPitch() {
    ctx.fillStyle = "#1c6332";
    ctx.fillRect(-HALF_L - 9, -HALF_W - 8, HALF_L * 2 + 18, HALF_W * 2 + 16);
    const bands = 14, bw = HALF_L * 2 / bands;
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = i % 2 ? "#2e9b4c" : "#2a9046";
      ctx.fillRect(-HALF_L + i * bw, -HALF_W, bw + 0.02, HALF_W * 2);
    }
    // advertising boards
    const cols = ["#103c36", "#16324f", "#3a1826", "#3d3413"];
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = cols[i % cols.length];
      const x = -HALF_L - 3 + i * ((HALF_L * 2 + 6) / 12);
      ctx.fillRect(x + 0.15, -HALF_W - 6.2, (HALF_L * 2 + 6) / 12 - 0.3, 1.3);
      ctx.fillRect(x + 0.15, HALF_W + 4.9, (HALF_L * 2 + 6) / 12 - 0.3, 1.3);
    }
    ctx.strokeStyle = "rgba(255,255,255,.86)";
    ctx.lineWidth = 0.16;
    ctx.lineJoin = "miter";
    ctx.strokeRect(-HALF_L, -HALF_W, HALF_L * 2, HALF_W * 2);
    ctx.beginPath();
    ctx.moveTo(0, -HALF_W); ctx.lineTo(0, HALF_W);
    ctx.moveTo(CIRCLE_R, 0); ctx.arc(0, 0, CIRCLE_R, 0, Math.PI * 2);
    ctx.stroke();
    const da = Math.acos((BOX_D - SPOT_D) / CIRCLE_R);
    for (const s of [-1, 1]) {
      const gx = s * HALF_L;
      ctx.strokeRect(s > 0 ? gx - BOX_D : gx, -BOX_HALF, BOX_D, BOX_HALF * 2);
      ctx.strokeRect(s > 0 ? gx - SIX_D : gx, -SIX_HALF, SIX_D, SIX_HALF * 2);
      ctx.beginPath();
      const sx = gx - s * SPOT_D;
      if (s > 0) ctx.arc(sx, 0, CIRCLE_R, Math.PI - da, Math.PI + da);
      else ctx.arc(sx, 0, CIRCLE_R, -da, da);
      ctx.stroke();
      for (const c of [-1, 1]) {
        ctx.beginPath();
        const a0 = s > 0 ? (c > 0 ? Math.PI : Math.PI / 2) : (c > 0 ? -Math.PI / 2 : 0);
        ctx.arc(gx, c * HALF_W, 1, a0, a0 + Math.PI / 2);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,.86)";
      ctx.beginPath(); ctx.arc(sx, 0, 0.22, 0, Math.PI * 2); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0, 0, 0.26, 0, Math.PI * 2); ctx.fill();
  }

  function drawGoal(s, bulge) {
    const gx = s * HALF_L, depth = GOAL_DEPTH + bulge * 0.7;
    const x0 = s > 0 ? gx : gx - depth;
    ctx.fillStyle = "rgba(255,255,255,.10)";
    ctx.fillRect(x0, -GOAL_HALF, depth, GOAL_HALF * 2);
    ctx.strokeStyle = "rgba(255,255,255,.34)";
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    for (let y = -GOAL_HALF + 0.45; y < GOAL_HALF; y += 0.45) { ctx.moveTo(x0, y); ctx.lineTo(x0 + depth, y); }
    for (let x = 0.4; x < depth; x += 0.4) { ctx.moveTo(x0 + x, -GOAL_HALF); ctx.lineTo(x0 + x, GOAL_HALF); }
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.14;
    ctx.beginPath();
    ctx.moveTo(gx, -GOAL_HALF); ctx.lineTo(gx + s * depth, -GOAL_HALF); ctx.lineTo(gx + s * depth, GOAL_HALF); ctx.lineTo(gx, GOAL_HALF);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    for (const c of [-1, 1]) { ctx.beginPath(); ctx.arc(gx, c * GOAL_HALF, 0.2, 0, Math.PI * 2); ctx.fill(); }
  }

  function draw(sim, dt, extra) {
    extra = extra || {};
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    const w = canvas.clientWidth || 960, h = canvas.clientHeight || 540;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    fx.time += dt;
    fx.shake = Math.max(0, fx.shake - dt * 1.7);
    fx.flash = Math.max(0, fx.flash - dt * 1.5);
    fx.goalT = Math.max(0, fx.goalT - dt);
    fx.toastT = Math.max(0, fx.toastT - dt);
    fx.savePop = Math.max(0, fx.savePop - dt);
    fx.net[0] = Math.max(0, fx.net[0] - dt * 0.9);
    fx.net[1] = Math.max(0, fx.net[1] - dt * 0.9);

    let S = clamp(w / 74, 9, 26);
    if (h / S > 80) S = h / 80;
    const m = sim ? sim.m : null, b = m ? m.ball : null;
    let tx = 0, ty = 0;
    if (b) { tx = b.x + clamp(b.vx * 0.3, -6, 6); ty = b.y + clamp(b.vy * 0.3, -5, 5); }
    const maxX = HALF_L + 7 - w / S / 2, maxY = HALF_W + 7 - h / S / 2;
    tx = maxX > 0 ? clamp(tx, -maxX, maxX) : 0;
    ty = maxY > 0 ? clamp(ty, -maxY, maxY) : 0;
    if (fx.snap) { fx.camX = tx; fx.camY = ty; fx.snap = false; }
    else {
      const k = 1 - Math.exp(-dt * 5);
      fx.camX += (tx - fx.camX) * k; fx.camY += (ty - fx.camY) * k;
    }
    const shx = fx.shake > 0 ? (Math.random() - 0.5) * 16 * fx.shake : 0;
    const shy = fx.shake > 0 ? (Math.random() - 0.5) * 16 * fx.shake : 0;
    const ox = w / 2 + shx - fx.camX * S, oy = h / 2 + shy - fx.camY * S;

    // In 3D the scene is drawn by match3d.mjs on its own canvas underneath. This canvas then
    // only carries the labels and the scoreboard, so it is cleared instead of painted.
    const ov = extra.overlay || null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (ov) ctx.clearRect(0, 0, w, h);
    else {
      ctx.fillStyle = "#0a1410";
      ctx.fillRect(0, 0, w, h);
      ctx.setTransform(dpr * S, 0, 0, dpr * S, dpr * ox, dpr * oy);
      drawPitch();
      drawGoal(-1, fx.net[0]);
      drawGoal(1, fx.net[1]);
    }

    if (m) {
      const key = m.teams[0].name + "|" + m.teams[1].name;
      if (key !== kitKey) { kitKey = key; kits = pickKits(m.teams[0].name, m.teams[1].name); }
      const sorted = m.players.slice().sort((p, q) => p.y - q.y);
      const c = m.auto ? null : m.ctrl;
      if (!ov) {
      ctx.fillStyle = "rgba(0,0,0,.28)";
      for (const p of sorted) {
        ctx.beginPath(); ctx.ellipse(p.x + 0.25, p.y + 0.4, 0.92, 0.64, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.beginPath(); ctx.ellipse(b.x + b.z * 0.35, b.y + b.z * 0.25 + 0.12, 0.42, 0.3, 0, 0, Math.PI * 2); ctx.fill();
      if (c && m.phase !== "full") {
        ctx.strokeStyle = "rgba(255,225,90," + (0.7 + 0.3 * Math.sin(fx.time * 6)) + ")";
        ctx.lineWidth = 0.18;
        ctx.beginPath(); ctx.arc(c.x, c.y, 1.45, 0, Math.PI * 2); ctx.stroke();
      }
      for (const p of sorted) {
        const kit = p.gk ? (p.team === 0 ? ["#f2c230", "#111111"] : ["#ff7a1a", "#111111"]) : kits[p.team];
        ctx.globalAlpha = p.stun > 0 ? 0.6 : 1;
        ctx.fillStyle = kit[0];
        ctx.strokeStyle = kit[1];
        ctx.lineWidth = 0.2;
        ctx.beginPath(); ctx.arc(p.x, p.y, 0.84, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = kit[1];
        ctx.beginPath(); ctx.arc(p.x + Math.cos(p.face) * 0.46, p.y + Math.sin(p.face) * 0.46, 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      // ball
      const by = b.y - b.z * 0.55, br = 0.4 * (1 + b.z * 0.07);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 0.07;
      ctx.beginPath(); ctx.arc(b.x, by, br, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath(); ctx.arc(b.x + Math.cos(b.roll * 2.2) * br * 0.45, by + Math.sin(b.roll * 2.2) * br * 0.45, br * 0.3, 0, Math.PI * 2); ctx.fill();
      }

      // labels and markers in screen space so the text stays sharp
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fs = ov ? 12.5 : clamp(S * 0.66, 10, 15);
      ctx.font = "600 " + fs + "px " + FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      for (const p of sorted) {
        let sx, sy;
        if (ov) { const q = ov.project(p.x, p.y, 0); if (!q.visible) continue; sx = q.x; sy = q.y + 7; }
        else { sx = p.x * S + ox; sy = p.y * S + oy + S * 1.25; }
        if (sx < -40 || sx > w + 40 || sy < -20 || sy > h + 20) continue;
        const mine = p.team === 0;
        ctx.strokeStyle = "rgba(6,14,10,.75)";
        ctx.strokeText(p.label, sx, sy);
        ctx.fillStyle = p === c ? "#ffe15a" : mine ? "#ffffff" : "rgba(235,240,245,.8)";
        ctx.fillText(p.label, sx, sy);
      }
      if (c && m.phase !== "full") {
        let sx, sy;
        if (ov) { const q = ov.project(c.x, c.y, 3.1); sx = q.x; sy = q.y + Math.sin(fx.time * 5) * 2; }
        else { sx = c.x * S + ox; sy = c.y * S + oy - S * 1.9 + Math.sin(fx.time * 5) * 2; }
        ctx.fillStyle = "#ffe15a";
        ctx.beginPath(); ctx.moveTo(sx - 7, sy - 9); ctx.lineTo(sx + 7, sy - 9); ctx.lineTo(sx, sy); ctx.closePath(); ctx.fill();
        if (m.charging) {
          const bw = 64, bx = sx - bw / 2, byy = sy - 26;
          pill(bx - 2, byy - 2, bw + 4, 12, 5, "rgba(6,14,10,.8)");
          pill(bx, byy, Math.max(4, bw * m.charge), 8, 4, m.charge > SWEET_POWER ? "#ff4d5e" : m.charge > 0.5 ? "#4ade80" : "#e8c052");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(bx + bw * SWEET_POWER, byy - 2, 2, 12);
        }
      }
      drawHud(m, sim, w, h, extra);
    } else {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    // soft dark edges
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,.38)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
    if (fx.flash > 0) {
      ctx.fillStyle = "rgba(255,255,255," + (fx.flash * 0.55) + ")";
      ctx.fillRect(0, 0, w, h);
    }
    if (fx.goalT > 0) {
      const a = Math.min(1, fx.goalT / 0.4), pop = 1 + Math.max(0, fx.goalT - 2.4) * 1.4;
      ctx.globalAlpha = a;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "italic 800 " + Math.round(Math.min(w * 0.17, 150) * pop) + "px " + FONT;
      ctx.lineWidth = 10;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(6,14,10,.85)";
      ctx.strokeText(fx.goalText, w / 2, h * 0.4);
      ctx.fillStyle = "#ffe15a";
      ctx.fillText(fx.goalText, w / 2, h * 0.4);
      ctx.font = "700 " + Math.round(Math.min(w * 0.045, 34)) + "px " + FONT;
      ctx.lineWidth = 6;
      ctx.strokeText(fx.goalSub.toUpperCase(), w / 2, h * 0.4 + Math.min(w * 0.11, 96));
      ctx.fillStyle = "#ffffff";
      ctx.fillText(fx.goalSub.toUpperCase(), w / 2, h * 0.4 + Math.min(w * 0.11, 96));
      ctx.globalAlpha = 1;
    }
  }

  function drawHud(m, sim, w, h, extra) {
    const r = sim.result();
    const homeT = m.userHome ? m.teams[0] : m.teams[1], awayT = m.userHome ? m.teams[1] : m.teams[0];
    const homeKit = kits[homeT.idx][0], awayKit = kits[awayT.idx][0];
    const cut = s => (s.length > 17 ? s.slice(0, 16) + "." : s).toUpperCase();
    const hn = cut(homeT.name), an = cut(awayT.name);
    ctx.textBaseline = "middle";
    ctx.font = "700 19px " + FONT;
    const nw = Math.max(ctx.measureText(hn).width, ctx.measureText(an).width);
    const mid = 92, bw = nw * 2 + mid + 64, bx = w / 2 - bw / 2, by = 12, bh = 40;
    pill(bx, by, bw, bh, 10, "rgba(8,14,20,.86)");
    pill(w / 2 - mid / 2, by, mid, bh, 0, "rgba(53,224,194,.16)");
    ctx.fillStyle = homeKit; ctx.fillRect(bx + 10, by + 10, 7, bh - 20);
    ctx.fillStyle = awayKit; ctx.fillRect(bx + bw - 17, by + 10, 7, bh - 20);
    ctx.fillStyle = "#e8f0f4";
    ctx.textAlign = "right"; ctx.fillText(hn, w / 2 - mid / 2 - 12, by + bh / 2 + 1);
    ctx.textAlign = "left"; ctx.fillText(an, w / 2 + mid / 2 + 12, by + bh / 2 + 1);
    ctx.textAlign = "center";
    ctx.font = "800 26px " + FONT;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(r.home + "  " + r.away, w / 2, by + bh / 2 + 1);
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.fillRect(w / 2 - 4, by + bh / 2, 8, 2);
    // clock
    const min = sim.minute();
    const ctxt = m.phase === "halftime" ? "HALF TIME" : m.phase === "full" ? "FULL TIME" : min + "'";
    ctx.font = "700 17px " + FONT;
    const cw = Math.max(58, ctx.measureText(ctxt).width + 24);
    pill(w / 2 - cw / 2, by + bh + 5, cw, 24, 8, "rgba(8,14,20,.86)");
    ctx.fillStyle = "#35e0c2";
    ctx.fillText(ctxt, w / 2, by + bh + 18);

    // stamina
    const c = m.ctrl;
    if (c && !m.auto) {
      const sx = 18, sy = h - 44, sw = 190;
      pill(sx - 8, sy - 26, sw + 16, 54, 10, "rgba(8,14,20,.8)");
      ctx.textAlign = "left";
      ctx.font = "700 16px " + FONT;
      ctx.fillStyle = "#ffe15a";
      ctx.fillText(c.label.toUpperCase(), sx, sy - 10);
      ctx.textAlign = "right";
      ctx.font = "600 12px " + FONT;
      ctx.fillStyle = "#8ba3b4";
      ctx.fillText("STAMINA", sx + sw, sy - 10);
      pill(sx, sy + 6, sw, 10, 5, "#1c2a38");
      pill(sx, sy + 6, Math.max(6, sw * c.stamina), 10, 5, m.tired ? "#ff4d5e" : c.stamina > 0.35 ? "#35e0c2" : "#e8c052");
    }

    // radar
    const rw = Math.min(170, w * 0.26), rh = rw * HALF_W / HALF_L, rx = w - rw - 18, ry = h - rh - 18;
    pill(rx - 6, ry - 6, rw + 12, rh + 12, 8, "rgba(8,14,20,.72)");
    ctx.strokeStyle = "rgba(255,255,255,.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.beginPath(); ctx.moveTo(rx + rw / 2, ry); ctx.lineTo(rx + rw / 2, ry + rh); ctx.stroke();
    for (const p of m.players) {
      ctx.fillStyle = p === c && !m.auto ? "#ffe15a" : p.gk ? (p.team === 0 ? "#f2c230" : "#ff7a1a") : kits[p.team][0];
      ctx.beginPath();
      ctx.arc(rx + (p.x + HALF_L) / (HALF_L * 2) * rw, ry + (p.y + HALF_W) / (HALF_W * 2) * rh, p === c && !m.auto ? 3.4 : 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.6)";
      ctx.stroke();
    }
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(rx + (clamp(m.ball.x, -HALF_L, HALF_L) + HALF_L) / (HALF_L * 2) * rw, ry + (clamp(m.ball.y, -HALF_W, HALF_W) + HALF_W) / (HALF_W * 2) * rh, 2, 0, Math.PI * 2);
    ctx.fill();

    // early help
    ctx.textAlign = "center";
    if (!m.auto && m.half === 1 && m.t < 14 && m.phase !== "goal") {
      const a = m.t < 11 ? 1 : (14 - m.t) / 3;
      ctx.globalAlpha = a;
      ctx.font = "700 18px " + FONT;
      const t1 = "YOU ATTACK TO THE RIGHT";
      const tw = ctx.measureText(t1).width;
      pill(w / 2 - tw / 2 - 40, by + bh + 38, tw + 80, 30, 9, "rgba(8,14,20,.8)");
      ctx.fillStyle = "#ffe15a";
      ctx.fillText(t1, w / 2 - 12, by + bh + 54);
      const axx = w / 2 + tw / 2 - 2, ayy = by + bh + 53;
      ctx.beginPath(); ctx.moveTo(axx, ayy - 7); ctx.lineTo(axx + 12, ayy); ctx.lineTo(axx, ayy + 7); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // commentary
    if (fx.toastT > 0 && fx.toast) {
      const a = Math.min(1, fx.toastT / 0.4, (3.4 - fx.toastT) / 0.2 + 0.2);
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.font = "700 " + (w < 700 ? 17 : 22) + "px " + FONT;
      const tw = ctx.measureText(fx.toast).width;
      const tyy = h - (h > 520 ? 96 : 70);
      pill(w / 2 - tw / 2 - 18, tyy - 19, tw + 36, 38, 10, "rgba(8,14,20,.88)");
      ctx.fillStyle = "#35e0c2";
      ctx.fillRect(w / 2 - tw / 2 - 18, tyy - 19, 4, 38);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(fx.toast, w / 2, tyy + 1);
      ctx.globalAlpha = 1;
    }
  }

  return { draw, onEvent, fx };
}

// =====================================================================
// CONTROLLER
// =====================================================================
let active = null;
const KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "KeyE", "KeyQ", "KeyT", "KeyX", "KeyF", "KeyC", "KeyR", "KeyG", "KeyV", "KeyZ", "Space", "ShiftLeft", "ShiftRight", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
// the action keys the 3D match reads as held, pressed and released (with how long they were held)
const ACT_KEYS = { KeyE: "E", KeyQ: "Q", KeyT: "T", KeyC: "C", KeyR: "R", KeyG: "G", KeyF: "F", KeyV: "V", KeyZ: "Z", KeyX: "X", Space: "S" };
const esc = s => String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function diffLine(mine, theirs) {
  const d = theirs - mine;
  if (d >= 5) return "Very hard. They are a lot stronger than you.";
  if (d >= 2) return "Hard. They are the stronger side.";
  if (d > -2) return "Even. This one could go either way.";
  if (d > -5) return "You are the stronger side.";
  return "Easy. You are a lot stronger than them.";
}

// 3D needs two things: the page must have given the engine a loader (FLMatch.load3D) and the
// browser must have WebGL. Anything else plays in Classic.
function webglOk(doc) {
  try {
    const c = doc.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (e) { return false; }
}
function readLook() {
  try { return root.localStorage.getItem("fl_match_look") === "classic" ? "classic" : "3d"; } catch (e) { return "3d"; }
}
function saveLook(v) {
  try { root.localStorage.setItem("fl_match_look", v); } catch (e) { /* the choice just will not be remembered */ }
}

// ---------- the controls strip: small key chips at the top right, in the site kit look (kit.css tokens) ----------
// Full while the match settles in, then it fades right down so it never fights the play, and comes back to
// full on pause. 3D shows every key, Classic only the keys it uses.
const STRIP_KEYS = [["WASD", "Move"], ["Shift", "Sprint"], ["Q", "Pass"], ["T", "Through"], ["C", "Cross"], ["E", "Shoot"], ["R", "Finesse"], ["G", "Chip"], ["F", "Skill"], ["V", "Flair"], ["Z", "Shield"], ["Space", "Tackle"], ["X", "Slide"]];
const STRIP_KEYS_CLASSIC = [["WASD", "Move"], ["E", "Shoot"], ["Q", "Pass"], ["Shift", "Sprint"]];
const STRIP_FADE = 4;
const STRIP_CSS = ".mx-keys{position:absolute;top:26px;right:18px;z-index:6;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:4px;max-width:calc(100% - 380px);pointer-events:none;opacity:1;transition:opacity .7s ease}" +
  ".mx-keys.classic{max-width:calc(50% - 240px)}" +
  ".mx-keys.dim{opacity:.3}.mx-keys.off{display:none}" +
  ".mx-keys .mx-k{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 9px 0 3px;border-radius:999px;background:rgba(4,6,10,.72);box-shadow:inset 0 0 0 1px var(--k-line,rgba(255,255,255,.12));font:700 10px/1 var(--k-f-lbl,'Chakra Petch',sans-serif);letter-spacing:.08em;text-transform:uppercase;color:var(--k-soft,#dbe1ea);white-space:nowrap}" +
  ".mx-keys kbd{display:inline-grid;place-items:center;min-width:17px;height:16px;padding:0 5px;border-radius:999px;background:color-mix(in srgb,var(--k-accent,#d0e85c) 15%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--k-accent,#d0e85c) 42%,transparent);color:var(--k-accent,#d0e85c);font:600 10px/1 var(--k-f-num,'Geist Mono',ui-monospace,monospace);letter-spacing:0;text-transform:none}" +
  ".mx-keys b{font-weight:700}" +
  "@media (max-width:1180px){.mx-keys{gap:3px}.mx-keys .mx-k{gap:4px;padding:0 7px 0 3px;letter-spacing:.06em}.mx-keys.classic b{display:none}.mx-keys.classic .mx-k{padding:0 3px}}" +
  "@media (max-width:940px){.mx-keys b{display:none}.mx-keys .mx-k{padding:0 3px}.mx-keys{top:18px;max-width:calc(100% - 370px)}}" +
  "@media (prefers-reduced-motion:reduce){.mx-keys{transition:none}}";
function keyStrip(doc, wrap, classic) {
  if (!doc.getElementById("mxKeysStyle")) {
    const st = doc.createElement("style");
    st.id = "mxKeysStyle";
    st.textContent = STRIP_CSS;
    (doc.head || doc.body).appendChild(st);
  }
  const old = doc.getElementById("mxKeys");
  if (old && old.parentNode) old.parentNode.removeChild(old);
  const el = doc.createElement("div");
  el.id = "mxKeys";
  el.className = "mx-keys" + (classic ? " classic" : "");
  el.setAttribute("aria-label", "Controls");
  el.innerHTML = (classic ? STRIP_KEYS_CLASSIC : STRIP_KEYS).map(k => '<span class="mx-k"><kbd>' + k[0] + "</kbd><b>" + k[1] + "</b></span>").join("");
  wrap.appendChild(el);
  return el;
}

function open(cfg) {
  if (active) return false;
  const doc = root.document;
  const wrap = doc.getElementById("matchWrap"), canvas = doc.getElementById("matchCanvas"), panel = doc.getElementById("matchPanel");
  if (!wrap || !canvas || !panel) return false;
  const A = active = { cfg, wrap, canvas, panel, mode: "pre", sim: null, view: null, keys: {}, down: {}, up: {}, holdAt: {}, passQ: false, throughQ: false, slideQ: false, skillQ: false, crossQ: false, shootLatch: false, acc: 0, last: 0, raf: 0, checkT: 0, saving: false, saved: false, view3d: null, want3d: false, load3d: null, strip: null, stripT: 0, stripDim: false, stripOff: false };
  wrap.classList.remove("hidden");
  wrap.classList.remove("m3d");
  A.view = makeView(canvas);
  const can3d = typeof FLMatch.load3D === "function" && webglOk(doc);
  A.want3d = can3d && readLook() === "3d";
  // start fetching the 3D code as soon as it is wanted, so kick off does not wait for it
  const warm3d = () => {
    if (!A.load3d) A.load3d = Promise.resolve().then(() => FLMatch.load3D()).catch(() => null);
    return A.load3d;
  };
  if (A.want3d) warm3d();

  const show = html => { panel.innerHTML = '<div class="mcard">' + html + "</div>"; panel.classList.remove("hidden"); };
  const hide = () => { panel.classList.add("hidden"); panel.classList.remove("msolid"); panel.innerHTML = ""; };
  const on = (id, fn) => { const el = doc.getElementById(id); if (el) el.onclick = fn; };
  const info = cfg.info || {};
  const mineName = info.side === "away" ? info.away : info.home;
  const myR = info.side === "away" ? info.awayRating : info.homeRating;
  const opR = info.side === "away" ? info.homeRating : info.awayRating;

  function showPre(err) {
    A.mode = "pre";
    show(
      '<div class="mk">' + esc(info.label || "Match day") + "</div>" +
      "<h2>" + esc(info.home) + " <span>v</span> " + esc(info.away) + "</h2>" +
      '<div class="mrow"><div><b>' + esc(Math.round(myR)) + "</b><small>YOUR TEAM</small></div><div><b>" + esc(Math.round(opR)) + "</b><small>THEIR TEAM</small></div></div>" +
      '<p class="mdiff">' + esc(diffLine(myR, opR)) + "</p>" +
      '<div class="mkeys">' +
      "<span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move. <kbd>Shift</kbd> Sprint, fit players last longer.</span>" +
      "<span><kbd>Q</kbd> Pass to the team mate you face, or switch player without the ball</span>" +
      "<span><kbd>T</kbd> Through ball into the space ahead of a runner</span>" +
      "<span><kbd>E</kbd> Hold to power a shot, let go to shoot. W or S picks the corner. Too much power flies over.</span>" +
      "<span><kbd>F</kbd> Skill move. Good dribblers beat their man, poor ones lose the ball.</span>" +
      "<span><kbd>Space</kbd> Hold when defending to close down and make a standing tackle</span>" +
      "<span><kbd>X</kbd> Slide tackle. Time it and win it clean. Miss the ball and catch the man: a foul, in your box a penalty.</span>" +
      "<span><b>3D also has</b> <kbd>C</kbd> cross from wide or a lofted ball (light for a driven one, hard for a whipped one), <kbd>R</kbd> finesse shot that curls, <kbd>G</kbd> chip (or a lofted through ball far out), <kbd>V</kbd> flair skills, <kbd>Z</kbd> shield the ball or jockey without it, <kbd>Space</kbd> on the ball knocks it on. The ball stays at your feet until someone tackles you, and running into the man on the ball wins it.</span>" +
      "<span><b>Skills (3D)</b> F or V with a direction picks the move from where you are facing. Tap again quickly for the bigger move, Shift with F for the cuts. E then Q is a fake shot.</span>" +
      "<span><b>In the air (3D)</b> <kbd>E</kbd> heads or volleys at goal, <kbd>Q</kbd> heads to a mate. Press early for a first time pass or shot.</span>" +
      "<span><b>Set pieces (3D)</b> W A S D aim, then hold a key for power: Q short, C cross or long, E shoot, R curl. Penalties: aim and hold E. Facing one in goal, hold W or S to dive.</span>" +
      "<span><kbd>Esc</kbd> Pause</span></div>" +
      "<p>You play as " + esc(mineName) + " and attack to the right. The game picks your player nearest the ball. The match takes about 6 minutes and you need a keyboard.</p>" +
      '<p class="mwarn">You get one go. Once you kick off, the final score is what counts for this week. If you leave before full time, the match is simmed like normal.</p>' +
      '<div class="mlook"><span class="mk">How it looks</span><div class="mseg">' +
      '<button class="small ghost' + (A.want3d ? " on" : "") + '" id="mxLook3d"' + (can3d ? "" : " disabled") + ">3D</button>" +
      '<button class="small ghost' + (A.want3d ? "" : " on") + '" id="mxLookClassic">Classic</button></div>' +
      '<small id="mxLookNote">' + (can3d ? "3D is the full game: real players on a real pitch, every pass, shot, skill and tackle, built on each player's ratings. Classic is the simple top down match as before, with the first five keys only. If 3D runs slowly on your laptop, pick Classic." : "3D is not available in this browser, so the match plays in Classic.") + "</small></div>" +
      (err ? '<p class="merr">' + esc(err) + "</p>" : "") +
      '<div class="mbtns"><button class="ghost" id="mxBack">Not now</button><button class="gold" id="mxGo">Kick off</button></div>'
    );
    on("mxBack", close);
    const pickLook = use3d => {
      A.want3d = use3d && can3d;
      saveLook(A.want3d ? "3d" : "classic");
      if (A.want3d) warm3d();
      const b3 = doc.getElementById("mxLook3d"), bc = doc.getElementById("mxLookClassic");
      if (b3) b3.classList.toggle("on", A.want3d);
      if (bc) bc.classList.toggle("on", !A.want3d);
    };
    on("mxLook3d", () => pickLook(true));
    on("mxLookClassic", () => pickLook(false));
    on("mxGo", async () => {
      const go = doc.getElementById("mxGo");
      if (go) { go.disabled = true; go.textContent = "Getting the teams..."; }
      try {
        const setup = await cfg.kickoff();
        if (active !== A || A.mode === "simmed") return;
        // build the 3D look if it was picked. Any problem at all and the match simply plays in Classic.
        let v3 = null, fell = false;
        if (A.want3d) {
          try {
            const make = await warm3d();
            if (make) v3 = make({ wrap, canvas, FL: FLMatch });
          } catch (e3) { v3 = null; }
          fell = !v3;
          if (active !== A || A.mode === "simmed") { if (v3) v3.dispose(); return; }
        }
        A.view3d = v3;
        wrap.classList.toggle("m3d", !!v3);
        A.strip = keyStrip(doc, wrap, !v3);
        A.stripT = 0;
        A.stripDim = false;
        // the 3D view brings the deep sim with it (match_sim3d.mjs). Classic keeps the sim in this file.
        A.sim = (v3 && typeof v3.createSim === "function" ? v3.createSim : createSim)(setup, {});
        if (fell) { A.view.fx.toast = "3D could not start, so this match is in Classic."; A.view.fx.toastT = 3.4; }
        A.view.fx.snap = true;
        A.acc = 0;
        A.keys = {};
        hide();
        A.mode = "playing";
      } catch (e) {
        if (active !== A || A.mode === "simmed") return;
        if (cfg.recheck) { try { await cfg.recheck(); } catch (e2) { /* show the kick off error below */ } }
        if (active !== A || A.mode === "simmed" || checkSimmed()) return;
        showPre(e && e.message ? e.message : "Could not start the match.");
      }
    });
  }

  function showPause() {
    A.mode = "paused";
    A.stripT = 0;
    A.keys = {}; A.down = {}; A.up = {};
    show(
      '<div class="mk">Paused</div><h2>Take a breath</h2>' +
      "<p>The clock is stopped. Press Esc or hit Resume to carry on.</p>" +
      '<div class="mkeys">' +
      "<span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move, <kbd>Shift</kbd> sprint. <kbd>Q</kbd> Pass. <kbd>E</kbd> Hold to shoot.</span>" +
      (A.view3d ? "<span><kbd>T</kbd> Through ball. <kbd>C</kbd> Cross or lofted ball. <kbd>R</kbd> Finesse. <kbd>G</kbd> Chip.</span>" +
        "<span><kbd>F</kbd> Skill, <kbd>V</kbd> flair (tap twice for more, Shift with F for cuts). <kbd>Z</kbd> Shield or jockey. <kbd>Space</kbd> Tackle, or knock it on. <kbd>X</kbd> Slide.</span>" +
        "<span>In the air, <kbd>E</kbd> heads or volleys at goal, <kbd>Q</kbd> to a mate. Without the ball, <kbd>Q</kbd> switches player.</span>" : "") +
      "</div>" +
      '<div class="mbtns"><button class="red" id="mxQuit">Quit match</button><button class="gold" id="mxRes">Resume</button></div>'
    );
    on("mxRes", resume);
    on("mxQuit", () => {
      show(
        '<div class="mk">Quit match</div><h2>Are you sure?</h2>' +
        '<p class="mwarn">If you quit now, this match is simmed like normal and you cannot play it again this week.</p>' +
        '<div class="mbtns"><button class="red" id="mxYes">Yes, quit</button><button class="gold" id="mxNo">Keep playing</button></div>'
      );
      on("mxYes", close);
      on("mxNo", resume);
    });
  }
  function resume() {
    if (A.mode !== "paused") return;
    hide();
    A.stripT = STRIP_FADE - 2.5;
    A.keys = {}; A.down = {}; A.up = {};
    A.acc = 0;
    A.mode = "playing";
  }

  // The host simmed the week while this match was open. Stop on the spot, send nothing,
  // and show what the sim decided. cfg.simmed() gives { home, away, hg, ag, note } once the round has moved on.
  function showSimmed(sm) {
    A.mode = "simmed";
    A.keys = {};
    const known = sm && sm.hg !== null && sm.hg !== undefined && sm.ag !== null && sm.ag !== undefined;
    const hm = sm && sm.home ? sm.home : info.home, aw = sm && sm.away ? sm.away : info.away;
    show(
      '<div class="mk">Match over</div>' +
      "<h2>The host has simmed this week</h2>" +
      '<p class="mdiff">The host has simmed this week, your match was decided by the sim.</p>' +
      (known
        ? '<div class="mk" style="margin-top:16px">Simmed final score</div><div class="mscore">' + esc(hm) + " <span>" + esc(sm.hg) + " - " + esc(sm.ag) + "</span> " + esc(aw) + "</div>"
        : "<p>You can see the simmed score for " + esc(hm) + " v " + esc(aw) + " in the Matches tab.</p>") +
      (sm && sm.note ? "<p>" + esc(sm.note) + "</p>" : "") +
      "<p>The score from the match you were playing does not count and nothing was sent.</p>" +
      '<div class="mbtns"><button class="gold" id="mxDone">Back to the game</button></div>'
    );
    panel.classList.add("msolid");
    on("mxDone", close);
  }
  function checkSimmed() {
    if (A.mode === "simmed" || A.saving || A.saved || !cfg.simmed) return false;
    const sm = cfg.simmed();
    if (!sm) return false;
    showSimmed(sm);
    return true;
  }

  async function finish() {
    A.mode = "done";
    const r = A.sim.result(), st = A.sim.m.stats;
    const possAll = st.poss[0] + st.poss[1] || 1;
    const myPoss = Math.round(st.poss[0] / possAll * 100);
    const mineG = info.side === "away" ? r.away : r.home, oppG = info.side === "away" ? r.home : r.away;
    const head = mineG > oppG ? "You won!" : mineG < oppG ? "You lost." : "It ends level.";
    const body = note =>
      '<div class="mk">Full time</div><h2>' + esc(info.home) + " <span>" + r.home + " - " + r.away + "</span> " + esc(info.away) + "</h2>" +
      '<p class="mdiff">' + head + "</p>" +
      '<div class="mrow"><div><b>' + st.shots[0] + "</b><small>YOUR SHOTS</small></div><div><b>" + st.shots[1] + "</b><small>THEIR SHOTS</small></div><div><b>" + myPoss + "%</b><small>YOUR POSSESSION</small></div></div>" +
      note;
    const send = async () => {
      if (checkSimmed()) return;
      show(body("<p>Saving your result...</p>"));
      A.saving = true;
      try {
        const msg = await cfg.finish(Math.min(MAX_GOALS, r.home), Math.min(MAX_GOALS, r.away));
        A.saving = false;
        A.saved = true;
        if (active !== A) return;
        show(body("<p>" + esc(msg || "Saved. This score counts when the host sims the week.") + '</p><div class="mbtns"><button class="gold" id="mxDone">Back to the game</button></div>'));
        on("mxDone", close);
      } catch (e) {
        A.saving = false;
        if (active !== A) return;
        // the usual reason a save is turned down is that the host simmed in the last few seconds
        if (cfg.recheck) { try { await cfg.recheck(); } catch (e2) { /* keep the save error below */ } }
        if (active !== A) return;
        if (checkSimmed()) return;
        show(body('<p class="merr">' + esc(e && e.message ? e.message : "Could not save the result.") + '</p><div class="mbtns"><button class="ghost" id="mxDone">Back to the game</button><button class="gold" id="mxRetry">Try again</button></div>'));
        on("mxDone", close);
        on("mxRetry", send);
      }
    };
    send();
  }

  function input() {
    const k = A.keys;
    const inp = {
      mx: (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0),
      my: (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0),
      sprint: !!(k.ShiftLeft || k.ShiftRight),
      shoot: !!k.KeyE || A.shootLatch,
      pass: A.passQ,
      through: A.throughQ,
      slide: A.slideQ,
      skill: A.skillQ,
      cross: A.crossQ,
      tackle: !!k.Space
    };
    // the 3D engine reads every action key as held, just pressed, and just let go (with how long it was held)
    if (A.view3d) {
      const held = {}, down = {}, up = {};
      for (const code in ACT_KEYS) { const n = ACT_KEYS[code]; held[n] = !!k[code]; if (A.down[code]) down[n] = true; if (A.up[code] !== undefined) up[n] = A.up[code]; }
      inp.held = held; inp.down = down; inp.up = up;
    }
    return inp;
  }
  A.onKey = e => {
    if (!KEYS.has(e.code)) return;
    const down = e.type === "keydown";
    if (A.mode === "pre" || A.mode === "done" || A.mode === "simmed") return;
    e.preventDefault();
    if (e.code === "Escape") {
      if (down && !e.repeat) { if (A.mode === "playing") showPause(); else resume(); }
      return;
    }
    if (A.mode !== "playing") return;
    if (ACT_KEYS[e.code]) {
      const now = root.performance && root.performance.now ? root.performance.now() : Date.now();
      if (down && !e.repeat && !A.keys[e.code]) { A.down[e.code] = true; A.holdAt[e.code] = now; }
      if (!down && A.keys[e.code]) A.up[e.code] = Math.max(0.02, (now - (A.holdAt[e.code] || now)) / 1000);
    }
    A.keys[e.code] = down;
    if (down && !e.repeat) {
      if (e.code === "KeyQ") A.passQ = true;
      if (e.code === "KeyE") A.shootLatch = true;
      if (e.code === "KeyT") A.throughQ = true;
      if (e.code === "KeyX") A.slideQ = true;
      if (e.code === "KeyF") A.skillQ = true;
      if (e.code === "KeyC") A.crossQ = true;
    }
  };
  A.onBlur = () => { A.keys = {}; if (A.mode === "playing") showPause(); };
  root.addEventListener("keydown", A.onKey);
  root.addEventListener("keyup", A.onKey);
  root.addEventListener("blur", A.onBlur);

  function frame(now) {
    if (active !== A) return;
    const dtR = A.last ? Math.min(0.1, (now - A.last) / 1000) : 0;
    A.last = now;
    if (A.mode === "playing" && A.sim) {
      A.acc += dtR;
      let n = 0;
      while (A.acc >= STEP && n < 6) {
        A.sim.step(input());
        A.passQ = false; A.shootLatch = false; A.throughQ = false; A.slideQ = false; A.skillQ = false; A.crossQ = false;
        A.down = {}; A.up = {};
        A.acc -= STEP; n++;
      }
      if (n === 6) A.acc = 0;
      const evs = A.sim.m.events.splice(0);
      let full = false;
      for (const ev of evs) { if (A.view3d) A.view3d.onEvent(ev, A.sim); else A.view.onEvent(ev, A.sim); if (ev.type === "full") full = true; }
      if (full) finish();
    }
    // a light check twice a second, in every screen of the match, for the host having simmed the week
    A.checkT += dtR;
    if (A.checkT > 0.5) { A.checkT = 0; checkSimmed(); }
    const dtV = A.mode === "paused" || A.mode === "simmed" ? 0 : dtR;
    if (A.strip) {
      if (A.mode === "playing") A.stripT += dtR;
      const dim = A.mode === "playing" && A.stripT > STRIP_FADE, off = A.mode === "done" || A.mode === "simmed";
      if (dim !== A.stripDim) { A.stripDim = dim; A.strip.classList.toggle("dim", dim); }
      if (off !== A.stripOff) { A.stripOff = off; A.strip.classList.toggle("off", off); }
    }
    if (A.view3d && A.sim) {
      // 3D: the view draws the scene and, when it owns its HUD, the scoreboard and labels too
      A.view3d.draw(A.sim, dtV, A.view.fx, A.acc / STEP);
      if (!A.view3d.ownHud) A.view.draw(A.sim, dtV, { overlay: A.view3d });
    } else A.view.draw(A.sim, dtV, {});
    A.raf = root.requestAnimationFrame(frame);
  }
  showPre();
  A.raf = root.requestAnimationFrame(frame);
  return true;
}

function close() {
  const A = active;
  if (!A) return;
  active = null;
  root.cancelAnimationFrame(A.raf);
  root.removeEventListener("keydown", A.onKey);
  root.removeEventListener("keyup", A.onKey);
  root.removeEventListener("blur", A.onBlur);
  A.panel.classList.add("hidden");
  A.panel.classList.remove("msolid");
  A.panel.innerHTML = "";
  if (A.view3d) { try { A.view3d.dispose(); } catch (e) { /* nothing left to free */ } A.view3d = null; }
  if (A.strip && A.strip.parentNode) A.strip.parentNode.removeChild(A.strip);
  A.strip = null;
  A.wrap.classList.remove("m3d");
  A.wrap.classList.add("hidden");
  if (A.cfg.closed) A.cfg.closed();
}

const DIMS = { HALF_L, HALF_W, GOAL_HALF, BAR_H, GOAL_DEPTH, BOX_D, BOX_HALF, SIX_D, SIX_HALF, SPOT_D, CIRCLE_R };
// load3D is filled in by the page. It resolves to a function that builds the 3D view (see match3d.mjs).
const FLMatch = { createSim, open, close, isOpen: () => !!active, MAX_GOALS, MATCH_SECONDS, STEP, DIMS, pickKits, load3D: null, look3d: () => !!(active && active.view3d), view3d: () => (active && active.view3d) || null };
root.FLMatch = FLMatch;
if (typeof module !== "undefined" && module.exports) module.exports = FLMatch;
})(typeof window !== "undefined" ? window : globalThis);

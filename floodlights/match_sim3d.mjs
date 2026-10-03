// Floodlights playable match, the deep sim used by the 3D look.
// It started as a copy of FLMatch.createSim in match.js (which Classic still uses, untouched) and then grew:
// every player gets six attributes derived from the real squad row (rating, position, role, name), and those
// attributes drive speed, acceleration, turning, close control, shot power and accuracy, pass accuracy and
// speed, tackle success and reach, stamina drain and keeper reactions. On top of that come the new actions:
// through balls, slide tackles, standing tackles with pressure, and skill moves, for the person playing and
// for the AI on both sides. Commentary lines fire on events.
//
// No DOM, no three.js. Runs in the browser and in node tests the same way.
// Pitch in metres, origin at the centre spot, x runs goal to goal. Team 0 is always the person playing and
// always attacks to the right.

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
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

// =====================================================================
// ATTRIBUTES
// =====================================================================
// The squad rows carry one rating plus a role. Six attributes come from the rating, a role profile and a
// small name hash jitter, so a 90 rated winger and a 90 rated centre back feel different, and a 90 rated
// player is clearly better than a 60 rated one at everything his role is about.
const ATTRS = ["pac", "dri", "sho", "pas", "def", "phy"];
const ROLE_PROFILE = {
  GK: { pac: -10, dri: -15, sho: -25, pas: -8, def: 5, phy: 2 },
  CB: { pac: -6, dri: -12, sho: -18, pas: -6, def: 8, phy: 6 },
  LB: { pac: 6, dri: -3, sho: -14, pas: -2, def: 4, phy: 0 },
  RB: { pac: 6, dri: -3, sho: -14, pas: -2, def: 4, phy: 0 },
  CDM: { pac: -4, dri: -6, sho: -10, pas: 4, def: 7, phy: 4 },
  CM: { pac: 0, dri: 1, sho: -5, pas: 6, def: -2, phy: 1 },
  CAM: { pac: 2, dri: 7, sho: 2, pas: 7, def: -14, phy: -4 },
  LW: { pac: 9, dri: 8, sho: 1, pas: 0, def: -16, phy: -5 },
  RW: { pac: 9, dri: 8, sho: 1, pas: 0, def: -16, phy: -5 },
  ST: { pac: 3, dri: 2, sho: 9, pas: -6, def: -18, phy: 3 }
};
const POS_FALLBACK = { GK: "GK", DF: "CB", MF: "CM", FW: "ST" };
export function deriveAttrs(row) {
  const r = clamp(Number(row.r) || 60, 40, 99);
  const role = String(row.role || "").toUpperCase();
  const prof = ROLE_PROFILE[role] || ROLE_PROFILE[POS_FALLBACK[row.pos] || "CM"];
  const h = hashStr(String(row.n || ""));
  const out = {};
  ATTRS.forEach((k, i) => {
    const jit = ((h >>> (i * 4)) % 7) - 3;
    out[k] = clamp(Math.round(r + prof[k] + jit), 30, 99);
  });
  return out;
}
// shirt numbers by role, unique inside the eleven
const NUM_PREF = {
  GK: [1, 13, 25], CB: [4, 5, 6, 15, 16, 24], LB: [3, 12, 21], RB: [2, 22, 23], CDM: [6, 8, 14, 16],
  CM: [8, 10, 14, 16, 18], CAM: [10, 7, 20, 21], LW: [11, 17, 19, 7], RW: [7, 17, 19, 11], ST: [9, 10, 18, 20]
};
export function assignNumbers(list) {
  const used = new Set();
  for (const p of list) {
    const pref = NUM_PREF[String(p.role || "").toUpperCase()] || NUM_PREF[POS_FALLBACK[p.pos] || "CM"];
    let n = pref.find(x => !used.has(x));
    if (!n) { n = 12; while (used.has(n)) n++; }
    used.add(n);
    p.num = n;
  }
  return list;
}

// the chances behind the new actions, kept as plain functions so tests can read them
export function skillChance(dri, def, move, extra) {
  const bonus = { nutmeg: -0.12, roulette: -0.05, stepover: 0, feint: 0.05, dragback: 0.03 }[move] || 0;
  return clamp(0.18 + (dri - def) * 0.013 + bonus + (extra || 0), 0.06, 0.93);
}
export function slideChance(def, dri, goodTiming, extra) {
  return clamp(0.3 + (def - dri) * 0.011 + (goodTiming ? 0.35 : -0.08) + (extra || 0), 0.08, 0.95);
}
export function tackleChance(def, dri, committed, extra) {
  return clamp((committed ? 0.42 : 0.14) + (def - dri) * (committed ? 0.011 : 0.004) + (extra || 0), 0.05, 0.9);
}
export function topSpeedFor(pac) { return 5.0 + (pac - 40) * 0.052; }

// =====================================================================
// COMMENTARY
// =====================================================================
export const LINES = {
  goal: [
    "GOAL! {n} finds the net! It is {s}.", "{n} scores! What a finish! {s}.", "It is in! {n} makes it {s}.",
    "{n} buries it! {s}.", "Get in! {n} with the goal. {s}.", "The net bulges! {n} scores. {s}.", "{n} does not miss those. {s}."
  ],
  owngoal: ["Own goal! {t} get a gift. It is {s}.", "Oh dear, that is an own goal. {s}.", "He has put it in his own net! {s}."],
  bigsave: ["What a save by {g}!", "{g} keeps it out!", "Huge stop from {g}!", "{g} gets down brilliantly!", "Fingertips from {g}!", "Denied! {g} with a worldie of a save!"],
  save: ["{g} holds on to it.", "Good hands from {g}.", "Safe as houses, {g} has it.", "{g} gathers it."],
  post: ["Off the post! So close!", "Rattled the post!", "The woodwork saves them!"],
  bar: ["Off the bar! So close!", "Crashes off the crossbar!", "The bar is shaking!"],
  wide: ["Just wide.", "Dragged wide.", "Off target, and it looked promising.", "Not far away."],
  over: ["Over the bar.", "Into the stands.", "He has leaned back and skied it.", "Row Z."],
  sitter: ["He has missed a sitter!", "How has he missed that?", "That was the easy bit, and he fluffed it.", "Oh no. Open goal, and he puts it wide.", "He will not sleep tonight after that miss."],
  skill: ["Dropped him!", "Oh he has done him!", "He has sent him to the shops!", "Twisted his blood!", "Left him for dead!", "Easy as you like!", "The defender is still looking for the ball!", "Silky stuff from {n}!", "{n} just danced past him!", "Sat him down!"],
  nutmeg: ["NUTMEG! Through the legs!", "Megs! The crowd loves that!", "Oh that is cheeky. Straight through his legs!", "Through the legs! Pure cheek from {n}!"],
  skillfail: ["Tried too much there.", "Too fancy, and he has lost it.", "The defender read that all the way.", "That did not come off.", "{n} got the ball stuck under his feet.", "All show and no go from {n}."],
  slidewin: ["CRUNCHING tackle from {n}!", "Clean as a whistle. {n} wins it.", "What a sliding challenge!", "{n} slides in and takes the lot.", "Textbook. Ball first, man second.", "Oh, that is a proper tackle!"],
  slidefail: ["He is on the ground and beaten.", "Flew in and missed it completely.", "{n} dived in and the attacker skipped past.", "Nowhere near it. He is on his backside.", "Rash from {n}, and now he is out of the game."],
  standwin: ["{n} muscles him off it.", "Good standing tackle from {n}.", "Won it fair and square.", "{n} stands him up and takes it."],
  through: ["Threaded through!", "What a ball into space!", "{n} splits them open!", "Perfect weight on that pass.", "Through the lines from {n}!"],
  tired: ["{n} is blowing hard out there.", "Legs are going for {n}."],
  kickoff: ["We are under way!", "And we are off!", "The whistle goes and we are off!"],
  half: ["Half time. It is {s}.", "The ref blows for half time. {s}."],
  second: ["Second half is go!", "Back out for the second half."],
  late: ["Into the last few minutes!", "Not long left now."],
  full: ["Full time! It ends {s}.", "That is the final whistle. {s}.", "All over. {s}."]
};

// =====================================================================
// SIM
// =====================================================================
// setup: { home, away, side: "home" or "away", homeXI, awayXI }, XI rows are { n, pos, role, r }
export function createSim3D(setup, opts) {
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
    stats: { shots: [0, 0], onTarget: [0, 0], poss: [0, 0], skills: [0, 0], skillsOk: [0, 0], slides: [0, 0], slidesOk: [0, 0], throughs: [0, 0], tackles: [0, 0] },
    charge: 0, charging: false, sprinting: false, tired: false, switchCd: 0, hands: 0, assist: false, pressing: false,
    restart: null, nextKick: 0, done: false, userHome, lateCall: false, overT: 0, passHint: null, deep: true,
    ball: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, owner: null, lastTeam: -1, lastPlayer: null, passTo: null, through: false, shot: null, protect: 0, kickId: 0, roll: 0 }
  };
  const b = m.ball;

  // ---------- commentary ----------
  const lastLine = {};
  function line(key, vars) {
    const pool = LINES[key];
    let i = Math.floor(rng() * pool.length);
    if (pool.length > 1 && i === lastLine[key]) i = (i + 1) % pool.length;
    lastLine[key] = i;
    return pool[i].replace(/\{(\w+)\}/g, (s, k) => (vars && vars[k] !== undefined ? String(vars[k]) : s));
  }
  function emit(ev) { m.events.push(ev); }
  function say(text) { emit({ type: "say", text }); }
  function sayLine(key, vars) { say(line(key, vars)); }

  function buildTeam(ti, xi, name) {
    const dir = ti === 0 ? 1 : -1;
    const list = (xi || []).slice(0, 11).map(p => ({
      n: String(p.n || "Player"), pos: p.pos, role: String(p.role || p.pos || "CM"), r: clamp(Number(p.r) || 60, 40, 99)
    }));
    while (list.length < 11) list.push({ n: "Youth player " + (list.length + 1), pos: "MF", role: "CM", r: 55 });
    let gkI = list.findIndex(p => p.pos === "GK");
    if (gkI < 0) { gkI = 0; list.forEach((p, i) => { if (p.r < list[gkI].r) gkI = i; }); }
    list.forEach((p, i) => {
      p.line = i === gkI ? "GK" : (p.pos === "DF" || p.pos === "MF" || p.pos === "FW") ? p.pos : (p.pos === "GK" ? "DF" : "MF");
      if (p.line === "GK") p.role = "GK";
      p.a = deriveAttrs(p);
    });
    assignNumbers(list);
    const avg = list.reduce((s, p) => s + p.r, 0) / list.length;
    const T = { idx: ti, name, dir, players: [], gk: null, avg, thinkGap: clamp(0.5 - (avg - 60) * 0.008, 0.16, 0.5), pressN: 1, pressMs: 0.9 };
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
        const a = src.a;
        const p = {
          id: m.players.length, team: ti, name: src.n, label: shortName(src.n), line, role: src.role, rating: src.r, gk: line === "GK", num: src.num, a,
          bx, by, x: bx * dir, y: by * dir, vx: 0, vy: 0, face: dir > 0 ? 0 : Math.PI,
          // movement from pace and dribbling, stamina from physical
          sp: topSpeedFor(a.pac), acc: 5.5 + (a.pac - 40) * 0.075, turn: 7 + (a.dri - 40) * 0.14,
          carry: clamp(0.98 - a.dri * 0.0025, 0.7, 0.9), ctl: 10 + a.dri * 0.12,
          drain: clamp(0.4 - a.phy * 0.0035, 0.08, 0.35), regen: 0.08 + a.phy * 0.0009,
          stamina: 1, stun: 0, tackleCd: 0, kickCd: 0,
          think: rng() * 0.3, drib: dir > 0 ? 0 : Math.PI, tx: bx * dir, ty: by * dir, ms: 0.7, manual: false, mvx: 0, mvy: 0,
          jx: 0, jy: 0, jT: rng() * 2, diving: false, react: 0, shotId: -1, misread: 0, hold: 0,
          // keeper numbers from the rating
          reactTime: clamp(0.46 - (src.r - 50) * 0.005, 0.2, 0.48), dive: 4 + (src.r - 50) * 0.06, catchLimit: 12 + (src.r - 50) * 0.25,
          // the new actions
          slide: null, slideCd: 0, down: 0, stumble: 0, move: null, skillCd: 0, burst: 0, celebrate: 0, kickAnim: 0, tackleAnim: 0, pressing: false, tiredSaid: false
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

  // how much stronger the other side is, used only for how many players close you down
  m.edge = clamp((m.teams[1].avg - m.teams[0].avg) / 10, -1, 1);
  m.teams[0].pressN = m.edge < -0.4 ? 2 : 1;
  m.teams[1].pressN = m.edge > 0.4 || (!m.auto && m.edge > -0.4) ? 2 : 1;

  function steered(p) { return !m.auto && p === m.ctrl && !m.assist; }
  function busy(p) { return p.stun > 0 || p.down > 0 || !!p.slide || !!p.move; }
  function topSpeed(p) { return p.sp * (0.86 + 0.14 * p.stamina) * (p.burst > 0 ? 1.3 : 1); }
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
    b.through = false;
    b.shot = null;
    b.protect = 0;
    b.kickId++;
    p.kickCd = 0.4;
    p.kickAnim = 0.35;
    p.hold = 0;
  }
  function passBall(p, mate) {
    const lead = 0.3 + p.a.pas * 0.0015;
    const ax = mate.x + mate.vx * lead, ay = mate.y + mate.vy * lead;
    const d = hyp(ax - p.x, ay - p.y);
    const ang = Math.atan2(ay - b.y, ax - b.x) + gauss() * (0.5 + (99 - p.a.pas) * 0.06) * Math.PI / 180;
    const sm = 0.9 + p.a.pas * 0.0025;
    if (d > 26) {
      const vz = clamp(3 + d * 0.12, 5, 9), T = 2 * vz / GRAVITY;
      kick(p, ang, d / T * 1.08, vz);
    } else {
      kick(p, ang, clamp(8 + d * 0.62, 10, 23) * sm, 0);
    }
    b.passTo = mate;
  }
  // a pass into the space ahead of a running team mate
  function throughBall(p, mate) {
    const T = m.teams[p.team], dir = T.dir;
    let ux = mate.vx, uy = mate.vy;
    const ul = hyp(ux, uy);
    if (ul < 1.5) { ux = dir; uy = -mate.y * 0.02; }
    else { ux /= ul; uy /= ul; }
    const lead = clamp(5 + p.a.pas * 0.06, 6, 12);
    let ax = mate.x + ux * lead, ay = mate.y + uy * lead;
    ax = clamp(ax, -HALF_L + 1.5, HALF_L - 1.5);
    ay = clamp(ay, -HALF_W + 1.5, HALF_W - 1.5);
    const d = hyp(ax - b.x, ay - b.y);
    const arrive = hyp(ax - mate.x, ay - mate.y) / (topSpeed(mate) * 0.95) + 0.15;
    const ang = Math.atan2(ay - b.y, ax - b.x) + gauss() * (1.2 + (99 - p.a.pas) * 0.1) * Math.PI / 180;
    // speed so the ball gets there about when the runner does, decaying along the ground
    const f = (1 - Math.exp(-GROUND_K * arrive)) / GROUND_K;
    const speed = clamp(d / Math.max(0.2, f) * (0.95 + p.a.pas * 0.001), 11, 27);
    kick(p, ang, speed, d > 30 ? 3.5 : 0);
    b.passTo = mate;
    b.through = true;
    m.stats.throughs[p.team]++;
  }
  function shootBall(p, ang, speed, vz) {
    const goalX = HALF_L * m.teams[p.team].dir;
    const dist = hyp(goalX - p.x, p.y);
    let open = true;
    for (const q of m.teams[1 - p.team].players) if (!q.gk && hyp(q.x - p.x, q.y - p.y) < 3) open = false;
    kick(p, ang, speed, vz);
    b.shot = { team: p.team, by: p, t: 0, speed, dist, open };
    m.stats.shots[p.team]++;
  }
  function take(p, protect) {
    const wasThrough = b.through && b.passTo === p;
    b.owner = p;
    b.passTo = null;
    b.through = false;
    b.shot = null;
    b.lastTeam = p.team;
    b.lastPlayer = p;
    b.z = 0;
    b.vz = 0;
    b.protect = protect;
    p.hold = 0;
    p.think = Math.min(p.think, 0.15 + rng() * 0.15);
    if (wasThrough && b.lastPlayer) { emit({ type: "through", team: p.team }); sayLine("through", { n: (m.lastPasser && m.lastPasser.label) || p.label }); }
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

  // the best pass on, with a through ball into space when a mate is running and the passer can play it
  function bestPass(p, T, opp) {
    const dir = T.dir, goalX = HALF_L * dir;
    let best = null;
    for (const mate of T.players) {
      if (mate === p || busy(mate)) continue;
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
      // a short pass needs a lane, a long one needs the mate to be free. Poor passers want it short and simple.
      const risky = d > 18 + p.a.pas * 0.12;
      if (d <= 26) { if (lane < 1.8 + d * 0.05) continue; }
      else if (open < 4) continue;
      let val = (mate.x - p.x) * dir * 0.9 + open * 1.4 - d * 0.08 - (risky ? 4 : 0);
      if (hyp(goalX - mate.x, mate.y) < 22) val += 6;
      let through = false;
      if (p.a.pas >= 70 && (T.throughCd || 0) <= 0 && mate.vx * dir > 2 && (mate.x - p.x) * dir > 4 && mate.x * dir < HALF_L - 14) {
        const lead = clamp(5 + p.a.pas * 0.06, 6, 12);
        const tx = mate.x + mate.vx / hyp(mate.vx, mate.vy) * lead, ty = mate.y + mate.vy / hyp(mate.vx, mate.vy) * lead;
        if (Math.abs(ty) < HALF_W - 2 && nearestOpp(tx, ty, opp) > 6.5 && segDist(opp.gk.x, opp.gk.y, p.x, p.y, tx, ty) > 3) { through = true; val += 3 + (p.a.pas - 70) * 0.08; }
      }
      if (!best || val > best.val) best = { mate, val, through };
    }
    return best;
  }

  function aiShoot(p, T, press) {
    const goalX = HALF_L * T.dir;
    const g = m.teams[1 - T.idx].gk;
    let side = g.y >= 0 ? -1 : 1;
    if (rng() < 0.2) side = -side;
    const aimY = side * (GOAL_HALF - 0.9);
    const sigma = (1.8 + (99 - p.a.sho) * 0.22) * (press < 2.5 ? 1.3 : 1);
    const ang = Math.atan2(aimY - b.y, goalX - b.x) + gauss() * sigma * Math.PI / 180;
    shootBall(p, ang, 20 + rng() * 5 + (p.a.sho - 60) * 0.1, 1.5 + rng() * 3.5 * (1.1 - p.a.sho * 0.004));
  }

  // ---------- skill moves ----------
  // Contextual: the move is picked from where the nearest defender stands. The chance is dribbling against
  // his defending. A win leaves him stumbling behind, a loss gives the ball away.
  function startSkill(p) {
    if (b.owner !== p || p.skillCd > 0 || busy(p)) return false;
    const T = m.teams[p.team], opp = m.teams[1 - p.team];
    let q = null, qd = 1e9;
    for (const o of opp.players) {
      if (o.gk) continue;
      const d = hyp(o.x - p.x, o.y - p.y);
      if (d < 4.2 && d < qd) { qd = d; q = o; }
    }
    p.skillCd = 1.3;
    m.stats.skills[p.team]++;
    if (!q) {
      // nobody near: a showboat stepover that changes nothing
      p.move = { type: "stepover", t: 0, dur: 0.5, side: rng() < 0.5 ? -1 : 1, ok: true, vs: null, show: true };
      return true;
    }
    const rel = angDiff(Math.atan2(q.y - p.y, q.x - p.x), p.face);
    const ar = Math.abs(rel);
    let type;
    if (ar < 0.55) type = qd < 1.9 ? (rng() < 0.3 ? "nutmeg" : "roulette") : "stepover";
    else if (ar < 2.1) type = "feint";
    else type = "dragback";
    const side = rel > 0 ? -1 : 1; // go away from the defender
    const extra = (q.stun > 0 || q.slide || q.down > 0 ? 0.1 : 0) + (q.a.pac < p.a.pac - 10 ? 0.04 : 0);
    const ok = rng() < skillChance(p.a.dri, q.a.def, type, extra);
    const dur = { stepover: 0.55, roulette: 0.7, feint: 0.6, dragback: 0.65, nutmeg: 0.5 }[type];
    p.move = { type, t: 0, dur, side, ok, vs: q };
    if (ok) {
      m.stats.skillsOk[p.team]++;
      q.stun = Math.max(q.stun, 0.9); q.stumble = 0.9; q.tackleCd = Math.max(q.tackleCd, 0.9);
      p.burst = 0.75;
      b.protect = 0.45;
      if (type === "nutmeg") {
        // the ball goes between his legs and the carrier runs on to it
        const ang = Math.atan2(q.y - p.y, q.x - p.x);
        kick(p, ang, 7.5 + p.a.dri * 0.02, 0);
        b.passTo = p; b.protect = 0.6;
        q.kickCd = 1.0;
      }
      emit({ type: "skill", ok: true, move: type, team: p.team, name: p.label, vs: q.label });
      sayLine(type === "nutmeg" ? "nutmeg" : "skill", { n: p.label });
    } else {
      // the ball gets away, toward the defender
      const ang = Math.atan2(q.y - p.y, q.x - p.x) + gauss() * 0.4;
      kick(p, ang, 3 + rng() * 2, 0);
      p.kickCd = 0.5;
      q.kickCd = 0;
      p.stun = 0.35; p.stumble = 0.4;
      emit({ type: "skill", ok: false, move: type, team: p.team, name: p.label, vs: q.label });
      sayLine("skillfail", { n: p.label });
    }
    return true;
  }

  // ---------- tackles ----------
  function startSlide(p) {
    if (p.slide || p.slideCd > 0 || p.down > 0 || p.stun > 0 || b.owner === p || p.gk) return false;
    const o = b.owner;
    let good = false;
    if (o && o.team !== p.team) {
      const d = hyp(b.x - p.x, b.y - p.y);
      const ahead = Math.cos(angDiff(Math.atan2(b.y - p.y, b.x - p.x), p.face)) > 0.55;
      good = ahead && d < 1.5 + p.a.def * 0.008;
    }
    p.slide = { t: 0, dur: 0.65, dir: p.face, spd: topSpeed(p) * 1.7, hit: false, good };
    p.vx = Math.cos(p.face) * p.slide.spd; p.vy = Math.sin(p.face) * p.slide.spd;
    p.slideCd = 1.6;
    p.tackleCd = Math.max(p.tackleCd, 0.6);
    m.stats.slides[p.team]++;
    return true;
  }
  function resolveSlide(p, dt) {
    const S = p.slide;
    S.t += dt;
    const o = b.owner;
    if (!S.hit && o && o.team !== p.team && !o.gk && b.protect <= 0) {
      const reach = 1.3 + p.a.def * 0.005;
      if (hyp(b.x - p.x, b.y - p.y) < reach) {
        S.hit = true;
        const pr = slideChance(p.a.def, o.a.dri, S.good, o.burst > 0 ? -0.15 : 0);
        if (rng() < pr) {
          m.stats.slidesOk[p.team]++;
          o.stun = 0.8; o.stumble = 0.8; o.kickCd = 0.6; o.tackleCd = 1.0;
          b.owner = null; b.passTo = null; b.through = false; b.shot = null;
          b.vx = Math.cos(S.dir) * 4 + p.vx * 0.4 + gauss() * 1.2;
          b.vy = Math.sin(S.dir) * 4 + p.vy * 0.4 + gauss() * 1.2;
          b.vz = 0.8;
          b.lastTeam = p.team; b.lastPlayer = p; b.kickId++;
          p.kickCd = 0.1;
          S.won = true;
          emit({ type: "tackle", kind: "slide", ok: true, team: p.team, name: p.label });
          sayLine("slidewin", { n: p.label });
        } else {
          S.won = false;
          p.downAfter = 1.1;
          o.burst = Math.max(o.burst, 0.4);
          emit({ type: "tackle", kind: "slide", ok: false, team: p.team, name: p.label });
          sayLine("slidefail", { n: p.label });
        }
      }
    }
    if (S.t >= S.dur) {
      p.down = S.won ? 0.45 : (p.downAfter || 0.7);
      p.downAfter = 0;
      p.slide = null;
    }
  }
  function standingTackle(q, o, committed) {
    const pr = tackleChance(q.a.def, o.a.dri, committed, (Math.cos(angDiff(Math.atan2(q.y - o.y, q.x - o.x), o.face)) > 0 ? 0.05 : 0) - (o.burst > 0 ? 0.12 : 0));
    q.tackleAnim = 0.35;
    if (rng() < clamp(pr, 0.05, 0.9)) {
      o.stun = 0.5; o.stumble = 0.5; o.tackleCd = 0.9; q.tackleCd = 0.5;
      take(q, q.gk ? 2.5 : 0.5);
      m.stats.tackles[q.team]++;
      emit({ type: "tackle", kind: "stand", ok: true, team: q.team, name: q.label });
      if (committed && rng() < 0.45) sayLine("standwin", { n: q.label });
      return true;
    }
    q.stun = committed ? 0.55 : 0.4; q.tackleCd = 1.1;
    if (committed) q.stumble = 0.4;
    return false;
  }

  function carrierAI(p, T, dt) {
    const dir = T.dir, goalX = HALF_L * dir;
    const opp = m.teams[1 - T.idx];
    p.think -= dt;
    if (p.think <= 0) {
      p.think = T.thinkGap * (0.7 + rng() * 0.6);
      const gdx = goalX - p.x, gdy = -p.y, dGoal = hyp(gdx, gdy);
      let press = 1e9, presser = null;
      for (const q of opp.players) {
        if (q.stun > 0 || q.down > 0) continue;
        const d = hyp(q.x - p.x, q.y - p.y);
        if (d < press) { press = d; presser = q; }
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
      // a dribbler with a man in front has a go at beating him, the better he is the more often
      if (presser && press < 3.2 && press > 1.1 && !presser.gk && Math.abs(angDiff(Math.atan2(presser.y - p.y, presser.x - p.x), p.face)) < 1.2) {
        const rate = p.a.dri >= 68 ? (p.a.dri - 60) / 80 : 0.03;
        if (rng() < rate && startSkill(p)) return;
      }
      const opt = bestPass(p, T, opp);
      if (opt && ((press < 3.2 && rng() < 0.8) || (opt.val > 9 && rng() < 0.45))) {
        m.lastPasser = p;
        if (opt.through) { throughBall(p, opt.mate); T.throughCd = 6; } else passBall(p, opt.mate);
        return;
      }
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
    // a ball flying at this goal: react after a delay set by the rating, read the line with some error
    if (live && !b.owner && b.vx * -dir > 5) {
      const tg = (goalX - b.x) / b.vx;
      if (tg > 0 && tg < 2.2 && Math.abs(b.y + b.vy * tg) < GOAL_HALF + 2) {
        if (g.shotId !== b.kickId) {
          g.shotId = b.kickId;
          g.react = g.reactTime * (0.8 + rng() * 0.5);
          g.misread = gauss() * (0.2 + (95 - g.rating) * 0.012);
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

  // closing down the carrier. Good defenders pick their moment for a slide, poor ones dive in rashly.
  function press(T, o, dt) {
    const gx = -HALF_L * T.dir;
    let ux = gx - o.x, uy = -o.y;
    const ul = hyp(ux, uy) || 1;
    ux /= ul; uy /= ul;
    const sx = o.x + o.vx * 0.25 + ux * 0.7, sy = o.y + o.vy * 0.25 + uy * 0.7;
    const cands = T.players
      .filter(p => !p.gk && !busy(p) && !steered(p))
      .sort((p, q) => hyp(p.x - sx, p.y - sy) - hyp(q.x - sx, q.y - sy));
    for (let i = 0; i < Math.min(T.pressN, cands.length); i++) {
      const p = cands[i];
      if (i === 0) {
        if (hyp(p.x - b.x, p.y - b.y) < 2.5) { p.tx = b.x; p.ty = b.y; }
        else { p.tx = sx; p.ty = sy; }
        if (p.slideCd <= 0 && m.phase === "play") {
          const d = hyp(o.x - p.x, o.y - p.y);
          const ahead = Math.cos(angDiff(Math.atan2(o.y - p.y, o.x - p.x), p.face)) > 0.6;
          const away = (o.vx * (o.x - p.x) + o.vy * (o.y - p.y)) > 0 && hyp(o.vx, o.vy) > topSpeed(p) * 0.75;
          const danger = hyp(gx - o.x, o.y) < 24;
          let rate = 0;
          if (ahead && d > 1.3 && d < 3.0 && (away || danger)) rate = (p.a.def - 50) / 120 + (danger ? 0.35 : 0);
          else if (ahead && p.a.def < 65 && d > 2.2 && d < 3.4) rate = (70 - p.a.def) / 260;
          if (rate > 0 && rng() < rate * dt) startSlide(p);
        }
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
        if (p.gk || busy(p) || steered(p)) continue;
        const q = intercept(p);
        const t = hyp(q[0] - p.x, q[1] - p.y) / p.sp;
        if (t < bt) { bt = t; ch = p; }
      }
    }
    if (ch && !steered(ch) && !busy(ch)) {
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
      if (!own.gk && !steered(own) && !own.move) carrierAI(own, T, dt);
    } else if (own) press(T, own, dt);
    else chase(T);
  }

  // ---------- the person playing ----------
  function updateCtrl(dt) {
    const T = m.teams[0], o = b.owner;
    m.switchCd -= dt;
    if (o && o.team === 0 && !o.gk) { m.ctrl = o; return; }
    if (!o && b.passTo && b.passTo.team === 0 && !b.passTo.gk) { m.ctrl = b.passTo; return; }
    // a player on the ground after a slide hands over to the next man
    if (m.ctrl && m.ctrl.slide) return;
    const f = ballAt(0.35);
    let best = null, bd = 1e9;
    for (const p of T.players) {
      if (p.gk || p.down > 0) continue;
      const d = hyp(p.x - f[0], p.y - f[1]);
      if (d < bd) { bd = d; best = p; }
    }
    const cd = m.ctrl && m.ctrl.down <= 0 ? hyp(m.ctrl.x - f[0], m.ctrl.y - f[1]) : 1e9;
    if (best && best !== m.ctrl && cd - bd > 3 && m.switchCd <= 0) { m.ctrl = best; m.switchCd = 0.7; }
  }
  function manualSwitch() {
    let best = null, bd = 1e9;
    for (const p of m.teams[0].players) {
      if (p.gk || p === m.ctrl || p.down > 0) continue;
      const d = hyp(p.x - b.x, p.y - b.y);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) { m.ctrl = best; m.switchCd = 1.5; }
  }
  function passTarget(c) {
    let best = null, bs = 1e9;
    for (const wide of [1.0, 1.75]) {
      for (const mate of m.teams[0].players) {
        if (mate === c || mate.down > 0) continue;
        const d = hyp(mate.x - c.x, mate.y - c.y);
        if (d < 3 || d > 45) continue;
        const a = Math.abs(angDiff(Math.atan2(mate.y - c.y, mate.x - c.x), c.face));
        if (a > wide) continue;
        const s = a + d * 0.004;
        if (s < bs) { bs = s; best = mate; }
      }
      if (best) break;
    }
    return best;
  }
  function userPass(c) {
    const best = passTarget(c);
    m.lastPasser = c;
    if (best) passBall(c, best);
    else kick(c, c.face, 14, 0);
  }
  // T: the team mate furthest up the pitch in front of me who has room to run into
  function userThrough(c) {
    let best = null, bs = -1e9;
    const opp = m.teams[1];
    for (const mate of m.teams[0].players) {
      if (mate === c || mate.gk || mate.down > 0) continue;
      const d = hyp(mate.x - c.x, mate.y - c.y);
      if (d < 4 || d > 40) continue;
      const a = Math.abs(angDiff(Math.atan2(mate.y - c.y, mate.x - c.x), c.face));
      if (a > 1.1) continue;
      const lead = clamp(5 + c.a.pas * 0.06, 6, 12);
      const ux = mate.vx, uy = mate.vy, ul = hyp(ux, uy);
      const tx = mate.x + (ul > 1.5 ? ux / ul : 1) * lead, ty = mate.y + (ul > 1.5 ? uy / ul : 0) * lead;
      const room = nearestOpp(tx, ty, opp);
      const s = (mate.x - c.x) * 0.6 + room * 1.2 - a * 4 + (ul > 2 ? 3 : 0);
      if (s > bs) { bs = s; best = mate; }
    }
    m.lastPasser = c;
    if (best) throughBall(c, best);
    else kick(c, c.face, 18, 2.5);
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
    const sho = c.a.sho;
    ang += gauss() * (0.8 + (99 - sho) * 0.16 + power * 1.6) * Math.PI / 180;
    const speed = (14 + 14 * power) * (0.88 + sho * 0.003);
    const vz = 1.0 + power * power * (5.8 + (99 - sho) * 0.03);
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
    m.pressing = false;
    if (m.assist) { m.charge = 0; m.charging = false; return; }
    if (sprint) {
      c.stamina = Math.max(0, c.stamina - c.drain * dt);
      if (c.stamina <= 0.02) m.tired = true;
    }
    if (busy(c)) { m.charge = 0; m.charging = false; return; }
    if (mag === 0 && !has && b.passTo === c) {
      const q = intercept(c);
      c.tx = q[0]; c.ty = q[1]; c.ms = 0.95;
    } else {
      c.manual = true;
      const sprintK = 1.1 + (c.a.pac - 50) * 0.002;
      let sp = topSpeed(c) * (sprint ? sprintK : 0.82) * (has ? 0.84 + c.a.dri * 0.0015 : 1) * (m.charging ? 0.85 : 1);
      let dx = mag > 0 ? ix / mag : 0, dy = mag > 0 ? iy / mag : 0;
      // Space while defending: close the carrier down, the stick only bends the run
      const o = b.owner;
      if (!has && inp.tackle && o && o.team !== 0) {
        m.pressing = true;
        const px = o.x + o.vx * 0.25 - c.x, py = o.y + o.vy * 0.25 - c.y, pl = hyp(px, py) || 1;
        if (mag > 0) { dx = dx * 0.6 + px / pl * 0.4; dy = dy * 0.6 + py / pl * 0.4; }
        else { dx = px / pl; dy = py / pl; }
        const dl = hyp(dx, dy) || 1; dx /= dl; dy /= dl;
        if (mag === 0) sp = topSpeed(c) * 0.9;
      }
      c.mvx = dx * sp;
      c.mvy = dy * sp;
    }
    if (has) {
      if (inp.shoot) {
        m.charge = Math.min(1, m.charge + dt / 0.85);
        m.charging = true;
      } else if (m.charging) {
        userShoot(c, Math.max(0.25, m.charge), iy);
        m.charge = 0; m.charging = false;
      }
      if (b.owner === c && inp.pass) { userPass(c); m.charge = 0; m.charging = false; }
      else if (b.owner === c && inp.through) { userThrough(c); m.charge = 0; m.charging = false; }
      else if (b.owner === c && inp.skill) { if (startSkill(c)) { m.charge = 0; m.charging = false; } }
    } else {
      m.charge = 0; m.charging = false;
      if (inp.pass) manualSwitch();
      if (inp.slide) startSlide(c);
    }
  }

  // ---------- movement ----------
  function movePlayers(dt) {
    for (const p of m.players) {
      if (p.stun > 0) p.stun -= dt;
      if (p.down > 0) p.down -= dt;
      if (p.stumble > 0) p.stumble -= dt;
      if (p.burst > 0) p.burst -= dt;
      if (p.celebrate > 0) p.celebrate -= dt;
      if (p.kickAnim > 0) p.kickAnim -= dt;
      if (p.tackleAnim > 0) p.tackleAnim -= dt;
      if (p.tackleCd > 0) p.tackleCd -= dt;
      if (p.kickCd > 0) p.kickCd -= dt;
      if (p.slideCd > 0) p.slideCd -= dt;
      if (p.skillCd > 0) p.skillCd -= dt;
      if (p.slide) resolveSlide(p, dt);
      const speedNow = hyp(p.vx, p.vy);
      // stamina: everyone tires when flat out, the person sprinting drains in userControl as well
      const flatOut = speedNow > topSpeed(p) * 0.86;
      if (p.team === 0 && p === m.ctrl && m.sprinting) { /* already drained */ }
      else if (flatOut) p.stamina = Math.max(0, p.stamina - p.drain * 0.5 * dt);
      else p.stamina = Math.min(1, p.stamina + p.regen * dt);
      if (p.stamina < 0.15 && !p.tiredSaid && p.team === 0 && !m.auto) { p.tiredSaid = true; sayLine("tired", { n: p.label }); }
      if (p.stamina > 0.6) p.tiredSaid = false;
      let dvx = 0, dvy = 0;
      let k = Math.min(1, dt * (p.diving ? 16 : p.acc));
      if (p.slide) {
        const S = p.slide, f = Math.pow(Math.max(0, 1 - S.t / S.dur), 0.7);
        dvx = Math.cos(S.dir) * S.spd * f; dvy = Math.sin(S.dir) * S.spd * f;
        k = Math.min(1, dt * 14);
      } else if (p.down > 0 || p.stun > 0) {
        /* on the ground or beaten: standing still */
      } else if (p.move) {
        const M = p.move;
        M.t += dt;
        const fwd = p.face, sp = topSpeed(p);
        let vx = 0, vy = 0;
        const side = M.side, sx = -Math.sin(fwd) * side, sy = Math.cos(fwd) * side;
        const u = M.t / M.dur;
        if (M.type === "stepover") { vx = Math.cos(fwd) * sp * 0.9 + sx * sp * 0.5; vy = Math.sin(fwd) * sp * 0.9 + sy * sp * 0.5; }
        else if (M.type === "feint") { const w = u < 0.4 ? -0.5 : 0.9; vx = Math.cos(fwd) * sp * 0.75 + sx * sp * w; vy = Math.sin(fwd) * sp * 0.75 + sy * sp * w; }
        else if (M.type === "roulette") { vx = Math.cos(fwd) * sp * 0.8; vy = Math.sin(fwd) * sp * 0.8; }
        else if (M.type === "dragback") { const w = u < 0.45 ? -0.7 : 0.8; vx = Math.cos(fwd) * sp * w + sx * sp * (u < 0.45 ? 0 : 0.6); vy = Math.sin(fwd) * sp * w + sy * sp * (u < 0.45 ? 0 : 0.6); }
        else if (M.type === "nutmeg") { vx = Math.cos(fwd) * sp * 1.05 + sx * sp * 0.35; vy = Math.sin(fwd) * sp * 1.05 + sy * sp * 0.35; }
        if (!M.ok) { vx *= 0.3; vy *= 0.3; }
        dvx = vx; dvy = vy;
        k = Math.min(1, dt * 12);
        if (M.t >= M.dur) { p.move = null; p.drib = fwd; }
      } else if (p.manual) { dvx = p.mvx; dvy = p.mvy; }
      else {
        const dx = p.tx - p.x, dy = p.ty - p.y, d = hyp(dx, dy);
        if (d > 0.05) {
          const sp = Math.min(p.diving ? p.dive : topSpeed(p) * p.ms, d * (p.diving ? 9 : 3.2));
          dvx = dx / d * sp; dvy = dy / d * sp;
        }
      }
      p.vx += (dvx - p.vx) * k;
      p.vy += (dvy - p.vy) * k;
      p.x = clamp(p.x + p.vx * dt, -HALF_L - 2, HALF_L + 2);
      p.y = clamp(p.y + p.vy * dt, -HALF_W - 2, HALF_W + 2);
      if (hyp(p.vx, p.vy) > 0.6 && !p.diving && !p.slide && !(p.move && p.move.type === "roulette")) {
        const want = Math.atan2(p.vy, p.vx);
        const rate = p.turn * (b.owner === p ? 0.85 : 1);
        p.face += clamp(angDiff(want, p.face), -dt * rate, dt * rate);
      }
    }
    // keep bodies from stacking on one spot
    const ps = m.players;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], c = ps[j];
      if (a.slide || c.slide) continue;
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
      const tx = o.x + Math.cos(o.face) * o.carry, ty = o.y + Math.sin(o.face) * o.carry;
      const k = Math.min(1, dt * o.ctl);
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
    b.passTo = null; b.through = false; b.shot = null;
    const T = m.teams[team];
    let taker = T.gk;
    if (type !== "goalkick") {
      let bd = 1e9;
      for (const p of T.players) {
        if (p.gk || p.down > 0) continue;
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
    b.shot = null; b.passTo = null; b.through = false;
    m.phase = "goal";
    m.phaseT = 3.2;
    m.nextKick = 1 - att;
    m.charge = 0; m.charging = false;
    const nm = scorer ? scorer.name : m.teams[att].name;
    if (scorer && !own) scorer.celebrate = 3;
    emit({ type: "goal", team: att, name: nm, own, min: Math.max(1, minute()), scorer: scorer ? scorer.id : -1 });
    if (own) sayLine("owngoal", { t: m.teams[att].name, s: scoreText() });
    else sayLine("goal", { n: nm, s: scoreText() });
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
        if (b.shot) sayLine(ay < GOAL_HALF - 0.1 ? "bar" : "post");
        b.shot = null;
        return;
      }
      if (b.shot && b.shot.team === att) {
        const over = b.z >= BAR_H && ay < GOAL_HALF + 1;
        if (b.shot.dist < 13 && b.shot.open && ay < GOAL_HALF + 3) { emit({ type: "miss", team: att }); sayLine("sitter"); }
        else sayLine(over ? "over" : "wide");
      }
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
      if (p.stun > 0 || p.kickCd > 0 || p.down > 0 || p.slide) continue;
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
        b.passTo = null; b.through = false; b.shot = null;
        b.kickId++;
        best.kickCd = 0.5;
        if (shot) { emit({ type: "save", big: true }); sayLine("bigsave", { g: best.label }); }
      } else {
        take(best, 2.5);
        if (shot) {
          emit({ type: "save", big: rel > 13 });
          if (rel > 13) sayLine("save", { g: best.label });
        }
      }
      return;
    }
    // a hard ball needs good close control to bring down
    if (rel > 13 + (best.a.dri - 50) * 0.18) {
      if (bd > 0.8) return;
      b.vx = -b.vx * 0.3 + gauss() * 2;
      b.vy = b.vy * 0.3 + gauss() * 3;
      b.vz = 1 + rng() * 2;
      b.lastTeam = best.team;
      if (!b.shot) b.lastPlayer = best;
      b.passTo = null; b.through = false; b.shot = null;
      b.kickId++;
      best.kickCd = 0.3;
      return;
    }
    take(best, 0.25);
  }

  // contact tackles. The AI tackles on contact with its defending against the carrier's dribbling.
  // The person playing only really tackles with Space held; a brush without it rarely wins the ball.
  function tackles() {
    const o = b.owner;
    if (!o || o.gk || b.protect > 0) return;
    for (const q of m.players) {
      if (q.team === o.team || busy(q) || q.tackleCd > 0) continue;
      const reach = (q.gk ? 1.4 : 1.0) + q.a.def * 0.004;
      if (hyp(q.x - b.x, q.y - b.y) > reach) continue;
      const mine = !m.auto && q === m.ctrl;
      if (q.gk) {
        if (rng() < 0.55) { o.stun = 0.45; o.tackleCd = 0.9; q.tackleCd = 0.5; take(q, 2.5); emit({ type: "tackle", kind: "stand", ok: true, team: q.team, name: q.label }); return; }
        q.tackleCd = 1.0;
        continue;
      }
      if (mine) {
        if (!m.pressing && rng() < 0.6) { q.tackleCd = 0.25; continue; }
        if (standingTackle(q, o, m.pressing)) return;
      } else {
        // the AI waits for its moment: the better the defender the more he commits when the carrier is slow or facing him
        const facing = Math.cos(angDiff(Math.atan2(q.y - o.y, q.x - o.x), o.face)) > 0;
        const slow = hyp(o.vx, o.vy) < topSpeed(o) * 0.6;
        const commit = q.a.def >= 60 ? (facing || slow || rng() < 0.5) : rng() < 0.8;
        if (standingTackle(q, o, commit)) return;
      }
    }
  }

  function setupKickoff(ti) {
    m.phase = "kickoff";
    m.phaseT = 1.5;
    for (const T of m.teams) for (const p of T.players) {
      const ax = p.gk ? -48.5 : Math.min(p.bx * 0.85 - 4, -2);
      p.x = ax * T.dir; p.y = p.by * T.dir;
      p.vx = 0; p.vy = 0; p.stun = 0; p.tackleCd = 0; p.kickCd = 0; p.diving = false; p.manual = false;
      p.slide = null; p.down = 0; p.stumble = 0; p.move = null; p.burst = 0; p.celebrate = 0;
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
    b.passTo = null; b.through = false; b.shot = null;
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
        sayLine("second");
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
    if (!m.lateCall && m.half === 2 && minute() >= 85) { m.lateCall = true; sayLine("late"); }

    const limit = m.half === 1 ? HALF_SECONDS : MATCH_SECONDS;
    if (m.t >= limit) {
      m.overT += dt;
      if (!danger() || m.overT > 5) {
        m.overT = 0;
        if (m.half === 1) {
          m.phase = "halftime"; m.phaseT = 4;
          emit({ type: "half" });
          sayLine("half", { s: scoreText() });
        } else {
          m.phase = "full"; m.done = true;
          emit({ type: "full" });
          sayLine("full", { s: scoreText() });
        }
        return;
      }
    }

    if (!m.auto) {
      updateCtrl(dt);
      m.hands = (inp.mx || inp.my || inp.shoot || inp.pass || inp.through || inp.slide || inp.tackle || inp.skill) ? 0 : m.hands + dt;
      m.assist = m.hands > (b.owner === m.ctrl ? 2 : 0.3);
    }
    for (const T of m.teams) { if (T.throughCd > 0) T.throughCd -= dt; teamAI(T, dt, true); }
    if (!m.auto) userControl(inp, dt);
    movePlayers(dt);
    const prev = moveBall(dt);
    checkBounds(prev[0], prev[1]);
    if (m.phase !== "play") return;
    pickups();
    tackles();
    // who the next pass would go to, for the name tags
    m.passHint = (!m.auto && m.ctrl && b.owner === m.ctrl) ? passTarget(m.ctrl) : null;
  }

  setupKickoff(userHome ? 0 : 1);
  m.phaseT = 2.2;
  sayLine("kickoff");

  return { m, step, minute, result, startSkill, startSlide, deep: true };
}

export const DIMS = { HALF_L, HALF_W, GOAL_HALF, BAR_H, GOAL_DEPTH, BOX_D, BOX_HALF, SIX_D, SIX_HALF, SPOT_D, CIRCLE_R };
export { STEP, MATCH_SECONDS, MAX_GOALS, SWEET_POWER };

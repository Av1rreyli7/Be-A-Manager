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

// ---------- set pieces and the game in the air ----------
// Heading comes from physical, the rating and the role: centre backs and strikers win headers, wingers less so.
const HEAD_ROLE = { GK: -10, CB: 8, LB: -4, RB: -4, CDM: 2, CM: -2, CAM: -6, LW: -9, RW: -9, ST: 7 };
export function headingFor(row, a) {
  const role = String(row.role || "").toUpperCase();
  const base = (Number(row.r) || 60) * 0.55 + (a ? a.phy : 60) * 0.45;
  const jit = ((hashStr(String(row.n || "") + "h") % 7) - 3);
  return clamp(Math.round(base + (HEAD_ROLE[role] !== undefined ? HEAD_ROLE[role] : 0) + jit), 30, 99);
}
// height in metres from the role and the name, so the big centre back really is bigger
const HEIGHT_ROLE = { GK: 1.89, CB: 1.87, LB: 1.77, RB: 1.78, CDM: 1.82, CM: 1.79, CAM: 1.76, LW: 1.75, RW: 1.75, ST: 1.83 };
export function heightFor(row) {
  const role = String(row.role || "").toUpperCase();
  const base = HEIGHT_ROLE[role] || 1.8;
  const jit = ((hashStr(String(row.n || "") + "t") % 13) - 6) * 0.012;
  return clamp(Math.round((base + jit) * 100) / 100, 1.68, 1.98);
}
// who wins a ball in the air: heading, how tall, how high he jumps, plus a bonus for being set and attacking it
export function aerialScore(hea, height, phy, extra) {
  return hea + (height - 1.8) * 60 + (phy - 60) * 0.25 + (extra || 0);
}
// the chance a failed tackle is a foul. From behind is far more likely, good defenders foul less.
export function foulChance(kind, def, fromBehind, extra) {
  if (kind === "slide") return clamp(0.2 + (fromBehind ? 0.34 : 0) + (72 - def) * 0.006 + (extra || 0), 0.04, 0.8);
  return clamp(0.3 + (fromBehind ? 0.15 : 0) + (64 - def) * 0.006 + (extra || 0), 0.08, 0.55);
}
// how often a keeper reads a penalty taker: a good keeper against a poor taker guesses right more
export function penaltyGuess(gkRating, sho) {
  return clamp(0.33 + (gkRating - sho) * 0.004, 0.2, 0.48);
}

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
  corner: ["Corner kick.", "That is a corner.", "Off the defender, corner.", "They win a corner.", "Corner, and the big men go forward."],
  cross: ["In comes the cross!", "Whipped in!", "Floated to the back post!", "Cross from the wing!", "Delivery into the box!"],
  headgoal: ["HEADER! {n} powers it in! {s}.", "What a header from {n}! {s}.", "{n} rises highest and nods it home! {s}.", "Bullet header! {n} scores! {s}.", "{n} gets his head on it and it is in! {s}."],
  headshot: ["{n} gets his head on it!", "Header from {n}!", "{n} goes up and meets it!", "Big leap from {n}!"],
  headclear: ["Headed clear by {n}.", "{n} wins it in the air and clears.", "Big header away from {n}.", "{n} gets the first contact. Cleared.", "Nodded away by {n}."],
  keeperclaim: ["{g} comes and claims it.", "Strong hands from {g} under pressure.", "{g} plucks it out of the air.", "Commanding from {g}."],
  foul: ["Foul. The ref blows up.", "That is a foul.", "He went through the back of him.", "Clumsy from {n}.", "Late from {n}, free kick.", "The ref has seen that one."],
  freekick: ["Free kick in a great spot.", "This is shooting range.", "Free kick, and {n} stands over it.", "The wall lines up. {n} is over the ball."],
  fkgoal: ["Over the wall and in! {n}! {s}.", "Free kick goal! What a strike from {n}! {s}.", "Top corner! {n} from the free kick! {s}.", "{n} bends it in! {s}."],
  wall: ["Into the wall.", "Blocked by the wall.", "The wall does its job.", "Straight into the wall."],
  penalty: ["PENALTY! The ref points to the spot!", "It is a penalty!", "Penalty! He brought him down in the box!", "The ref gives a penalty!"],
  pengoal: ["{n} sends the keeper the wrong way! {s}.", "Penalty scored by {n}! {s}.", "Cool as you like from {n}. {s}.", "{n} buries the penalty! {s}."],
  pensave: ["SAVED! {g} guessed right!", "{g} keeps out the penalty!", "Penalty saved by {g}! What a moment!", "{g} goes the right way and saves it!"],
  penmiss: ["He has missed the penalty!", "Wide of the post! A penalty missed!", "Over the bar from the spot!", "Oh no. He has missed it."],
  goalkick: ["Goal kick.", "Goal kick to come.", "Goal kick, everyone out of the box."],
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
    stats: {
      shots: [0, 0], onTarget: [0, 0], poss: [0, 0], skills: [0, 0], skillsOk: [0, 0], slides: [0, 0], slidesOk: [0, 0], throughs: [0, 0], tackles: [0, 0],
      corners: [0, 0], goalkicks: [0, 0], fouls: [0, 0], freekicks: [0, 0], directFks: [0, 0], penalties: [0, 0], penGoals: [0, 0], fkGoals: [0, 0],
      crosses: [0, 0], headers: [0, 0], headerShots: [0, 0], headerGoals: [0, 0], claims: [0, 0], gkBoxViolations: 0
    },
    // set pieces, read by the 3D view: { kind, team, x, y, phase: "setup" | "aim" | "taken", direct, wall }
    setPiece: null, aim: null, aimT: 0, headQ: null, diveSide: 0, fkWall: null,
    charge: 0, charging: false, sprinting: false, tired: false, switchCd: 0, hands: 0, assist: false, pressing: false,
    restart: null, nextKick: 0, done: false, userHome, lateCall: false, overT: 0, passHint: null, deep: true,
    ball: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, owner: null, lastTeam: -1, lastPlayer: null, passTo: null, through: false, shot: null, protect: 0, kickId: 0, roll: 0, spin: 0, dip: false, cross: null, headId: -1 }
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
      n: String(p.n || "Player"), pos: p.pos, role: String(p.role || p.pos || "CM"), r: clamp(Number(p.r) || 60, 40, 99),
      kn: Number.isInteger(p.num) && p.num > 0 && p.num < 100 ? p.num : 0
    }));
    while (list.length < 11) list.push({ n: "Youth player " + (list.length + 1), pos: "MF", role: "CM", r: 55 });
    let gkI = list.findIndex(p => p.pos === "GK");
    if (gkI < 0) { gkI = 0; list.forEach((p, i) => { if (p.r < list[gkI].r) gkI = i; }); }
    list.forEach((p, i) => {
      p.line = i === gkI ? "GK" : (p.pos === "DF" || p.pos === "MF" || p.pos === "FW") ? p.pos : (p.pos === "GK" ? "DF" : "MF");
      if (p.line === "GK") p.role = "GK";
      p.a = deriveAttrs(p);
      p.hea = headingFor(p, p.a);
      p.height = heightFor(p);
    });
    // the server sends squad wide shirt numbers (the same ones the lineup shirts show); use them when they are
    // all there and unique, else number the eleven by role
    if (list.every(p => p.kn) && new Set(list.map(p => p.kn)).size === list.length) list.forEach(p => { p.num = p.kn; });
    else assignNumbers(list);
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
          slide: null, slideCd: 0, down: 0, stumble: 0, move: null, skillCd: 0, burst: 0, celebrate: 0, kickAnim: 0, tackleAnim: 0, pressing: false, tiredSaid: false,
          // the game in the air: heading, height, jump, and what the view reads (air is the jump height in metres)
          hea: src.hea, height: src.height, jumpH: clamp(0.32 + (a.phy - 40) * 0.004 + (a.pac - 40) * 0.002, 0.3, 0.68),
          air: 0, jumpT: 0, headT: 0, headCd: 0, penDive: 0
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
    b.spin = 0; b.dip = false; b.cross = null;
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
    if (b.cross && p.gk && b.cross.team !== p.team) {
      m.stats.claims[p.team]++;
      if (rng() < 0.5) sayLine("keeperclaim", { g: p.label });
    }
    b.cross = null; b.spin = 0; b.dip = false;
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

  // ---------- the game in the air ----------
  const JUMP_T = 0.5;
  const goalXOf = ti => HALF_L * m.teams[ti].dir;
  function inOwnBox(ti, x, y) { return Math.abs(x + goalXOf(ti)) < BOX_D && Math.abs(y) < BOX_HALF; }
  // where the ball will be in t seconds, height included (no bounce)
  function predictBall(t) {
    let x = b.x, y = b.y, z = b.z, vx = b.vx, vy = b.vy, vz = b.vz;
    const n = Math.max(1, Math.round(t / (1 / 30))), h = t / n;
    for (let i = 0; i < n; i++) {
      if (z > 0.02 || vz > 0) { vz -= GRAVITY * (b.dip ? 1.6 : 1) * h; z = Math.max(0, z + vz * h); const f = Math.exp(-AIR_K * h); vx *= f; vy *= f; }
      else { const f = Math.exp(-GROUND_K * h); vx *= f; vy *= f; }
      x += vx * h; y += vy * h;
    }
    return { x, y, z };
  }
  // a lofted ball that arrives at (tx, ty) at about head height. power is the person's timing (0.68 is spot on).
  function crossBall(p, tx, ty, power, err) {
    const e = err === undefined ? 0.5 + (99 - p.a.pas) * 0.045 : err;
    const fromY = b.y;
    tx += gauss() * e * 0.6;
    ty += gauss() * e;
    const ang = Math.atan2(ty - b.y, tx - b.x);
    let d = hyp(tx - b.x, ty - b.y);
    if (power !== undefined) d *= 1 + (power - 0.68) * 0.6;
    const vz = clamp(5.5 + d * 0.17, 7, 12.5);
    const t = (vz + Math.sqrt(Math.max(0, vz * vz - 2 * GRAVITY * 1.9))) / GRAVITY;
    const f = (1 - Math.exp(-AIR_K * t)) / AIR_K;
    kick(p, ang, d / f, vz);
    b.cross = { team: p.team, x: b.x + Math.cos(ang) * d, y: b.y + Math.sin(ang) * d, fromY, by: p.id, t: 0 };
    m.stats.crosses[p.team]++;
    emit({ type: "cross", team: p.team, name: p.label });
  }
  // the box slots for attackers when a cross is coming: near post, far post, the spot, the six yard box, the edge
  function attackSlots(ti, side, n) {
    const gx = goalXOf(ti), dir = m.teams[ti].dir;
    const all = [
      [gx - dir * 5.2, side * 2.4], [gx - dir * 6.5, -side * 4.8], [gx - dir * 10.5, -side * 0.8],
      [gx - dir * 3.8, side * -0.6], [gx - dir * 16.5, side * 2.5], [gx - dir * 12, -side * 7.5]
    ];
    return all.slice(0, n);
  }
  // attackers make near and far post runs: the best in the air go first
  function boxRuns(T, side, corner) {
    const own = b.owner;
    const order = { FW: 0, MF: 1, DF: 2 };
    const pool = T.players.filter(p => !p.gk && p !== own && !busy(p) && !steered(p) && (corner || p.line !== "DF"));
    pool.sort((p, q) => corner ? (q.hea + q.height * 40) - (p.hea + p.height * 40) : (order[p.line] - order[q.line]) || ((q.x - p.x) * T.dir));
    const runners = pool.slice(0, corner ? 5 : 3);
    const slots = attackSlots(T.idx, side, runners.length);
    // greedy: each slot takes the nearest runner left
    const left = runners.slice();
    for (const s of slots) {
      let bi = -1, bd = 1e9;
      left.forEach((p, i) => { const d = hyp(p.x - s[0], p.y - s[1]); if (d < bd) { bd = d; bi = i; } });
      if (bi < 0) break;
      const p = left.splice(bi, 1)[0];
      p.tx = s[0]; p.ty = s[1]; p.ms = 0.97; p.run = s;
    }
    return runners;
  }
  // defenders pick up the attackers in and around their box, goal side, and one guards the near post
  function markRuns(T, side) {
    const att = m.teams[1 - T.idx], ownX = -goalXOf(T.idx);
    const threats = att.players.filter(p => !p.gk && Math.abs(p.x - ownX) < BOX_D + 5 && Math.abs(p.y) < BOX_HALF + 3 && p !== b.owner)
      .sort((p, q) => hyp(p.x - ownX, p.y) - hyp(q.x - ownX, q.y));
    const free = T.players.filter(p => !p.gk && !busy(p) && !steered(p) && p !== b.owner);
    for (const a of threats) {
      let bi = -1, bd = 1e9;
      free.forEach((d, i) => { const k = hyp(d.x - a.x, d.y - a.y); if (k < bd) { bd = k; bi = i; } });
      if (bi < 0) break;
      const d = free.splice(bi, 1)[0];
      const ux = ownX - a.x, uy = -a.y, ul = hyp(ux, uy) || 1;
      d.tx = a.x + ux / ul * 1.3; d.ty = a.y + uy / ul * 1.3; d.ms = 0.92;
    }
    if (free.length && side) {
      let bi = 0, bd = 1e9;
      free.forEach((d, i) => { const k = hyp(d.x - ownX, d.y - side * 3); if (k < bd) { bd = k; bi = i; } });
      const d = free[bi];
      d.tx = ownX + T.dir * 1.6; d.ty = side * (GOAL_HALF - 0.5); d.ms = 0.9;
    }
  }
  // while a cross is in the air: runs, marking, and the two nearest from each side attack the ball
  function crossShape(T) {
    const own = b.owner;
    if (b.cross && !own) {
      const side = b.cross.fromY >= 0 ? 1 : -1;
      const att = T.idx === b.cross.team;
      if (att) boxRuns(T, side, false); else markRuns(T, side);
      // attackers attack the ball at once; the defence reads it a beat later and sends one man, the rest stay with theirs
      if (!att && b.cross.t < 0.45) return;
      const near = T.players.filter(p => !p.gk && !busy(p) && !steered(p))
        .sort((p, q) => hyp(p.x - b.cross.x, p.y - b.cross.y) - hyp(q.x - b.cross.x, q.y - b.cross.y)).slice(0, att ? 2 : 1);
      for (const p of near) { p.tx = b.cross.x; p.ty = b.cross.y; p.ms = 1; }
      return;
    }
    // a team mate out wide in the last third: get into the box for the cross
    if (own && !own.gk && Math.abs(own.y) > 14 && (own.x * m.teams[own.team].dir) > HALF_L - 32) {
      const side = own.y >= 0 ? 1 : -1;
      if (T.idx === own.team) boxRuns(T, side, false); else markRuns(T, side);
    }
  }
  // who to aim a cross at: a team mate in or arriving in the box, the best in the air with room to attack it
  function crossTarget(p, T, opp) {
    const gx = goalXOf(T.idx), dir = T.dir;
    let best = null, bv = -1e9;
    for (const q of T.players) {
      if (q === p || q.gk || busy(q)) continue;
      // where he will be when the ball gets there, or the slot he is running to
      let fx = q.x + q.vx * 0.9, fy = q.y + q.vy * 0.9;
      if (q.run && hyp(q.tx - q.run[0], q.ty - q.run[1]) < 0.1) { fx = q.run[0]; fy = q.run[1]; }
      const depth = (gx - fx) * dir;
      if (depth < 2.5 || depth > 19 || Math.abs(fy) > 14) continue;
      const room = nearestOpp(fx, fy, opp);
      const v = q.hea * 0.25 + room * 3 - depth * 0.2;
      if (v > bv) { bv = v; best = { x: clamp(fx, -HALF_L + 3, HALF_L - 3), y: clamp(fy, -12, 12), mate: q }; }
    }
    return best;
  }

  // once per ball flight each player decides whether to go for it in the air. Crosses are always attacked;
  // a long pass flying past mostly is not, except by the man it is meant for and a few keen challengers.
  function goesForIt(p) {
    if (p.airKick !== b.kickId) {
      p.airKick = b.kickId;
      p.airGo = !!b.cross || b.passTo === p || rng() < 0.22 + (p.hea - 60) * 0.004;
    }
    return p.airGo || (!m.auto && p === m.ctrl && !!m.headQ);
  }
  // jumping: anyone near where a high ball is about to be goes up for it
  function jumps() {
    if (b.owner || (b.z < 0.8 && b.vz <= 0)) return;
    const f = predictBall(0.24);
    if (f.z < 1.45) return;
    for (const p of m.players) {
      if (p.gk || p.jumpT > 0 || p.headCd > 0 || busy(p)) continue;
      if (hyp(p.x - f.x, p.y - f.y) < 1.6 && f.z < p.height + p.jumpH + 0.35 && goesForIt(p)) p.jumpT = JUMP_T;
    }
  }
  // the duel: everyone the ball can reach at head height, best score wins and heads it
  function aerials() {
    if (b.owner || b.z < 1.2 || b.headId === b.kickId) return;
    // a ball still climbing off someone's boot is not there to be headed yet, unless it is a cross
    if (!b.cross && b.vz > 0.5) return;
    let best = null, bestS = -1e9, n = 0;
    for (const p of m.players) {
      if (p.gk || busy(p) || p.headCd > 0 || p.kickCd > 0) continue;
      const d = hyp(p.x - b.x, p.y - b.y);
      if (d > 1.05) continue;
      if (b.z > p.height + p.air + 0.22) continue;
      if (!goesForIt(p)) continue;
      // the man a long pass is meant for brings it down on his chest unless someone is on his back
      if (!b.cross && b.passTo === p && b.z < 1.9 && nearestOpp(p.x, p.y, m.teams[1 - p.team]) > 2) continue;
      // nobody near him and the ball at chest height: he just brings it down
      if (!b.cross && b.z < 1.75 && nearestOpp(b.x, b.y, m.teams[1 - p.team]) > 2.5) continue;
      n++;
      const mine = !m.auto && p === m.ctrl;
      // the attacker running on to a cross has the jump on a defender standing still
      const attacking = b.cross && b.cross.team === p.team;
      let extra = gauss() * 7 + (p.jumpT > 0 ? 4 : 0) - d * 4 + (attacking ? (b.cross.corner ? 4 : 13) : 0);
      if (mine) extra += m.headQ ? 6 : -2;
      const sc = aerialScore(p.hea, p.height, p.a.phy, extra);
      if (sc > bestS) { bestS = sc; best = p; }
    }
    if (!best) return;
    for (const p of m.players) if (p !== best && !p.gk && hyp(p.x - b.x, p.y - b.y) < 1.5) p.headCd = 0.45;
    header(best, n > 1);
  }
  function header(p, contested) {
    const T = m.teams[p.team], dir = T.dir, goalX = HALF_L * dir, ownX = -goalX;
    const mine = !m.auto && p === m.ctrl && !m.assist;
    const q = mine ? m.headQ : null;
    const wasCross = !!b.cross;
    m.headQ = null;
    const dGoal = hyp(goalX - b.x, b.y);
    const attackBox = (goalX - b.x) * dir < BOX_D + 3 && Math.abs(b.y) < BOX_HALF + 2;
    let kind;
    if (q) kind = q.kind === "pass" ? "pass" : (dGoal < 26 ? "shot" : "pass");
    else if (attackBox && dGoal < 18 && Math.abs(b.y) < 12) kind = "shot";
    else if (hyp(ownX - b.x, b.y) < 32) kind = "clear";
    else kind = "pass";
    const qual = p.hea;
    const inSpeed = hyp(b.vx, b.vy);
    if (kind === "shot") {
      const g = m.teams[1 - p.team].gk;
      let side = q && Math.abs(q.iy) > 0.3 ? Math.sign(q.iy) : (g.y >= 0 ? -1 : 1);
      if (!q && rng() < 0.25) side = -side;
      const aimY = side * (GOAL_HALF - 1.0);
      const sigma = 3 + (99 - qual) * 0.22 + (contested ? 2.5 : 0);
      const ang = Math.atan2(aimY - b.y, goalX - b.x) + gauss() * sigma * Math.PI / 180;
      const speed = clamp(10 + qual * 0.09 + Math.max(0, inSpeed - 12) * 0.15, 12, 22);
      const tg = dGoal / speed;
      const vz = clamp((1.1 - b.z + 0.5 * GRAVITY * tg * tg) / Math.max(0.2, tg) + gauss() * (0.6 + (99 - qual) * 0.035), -6, 7);
      shootBall(p, ang, speed, vz);
      b.shot.header = true;
      m.stats.headerShots[p.team]++;
      if (rng() < 0.5) sayLine("headshot", { n: p.label });
    } else if (kind === "clear") {
      const ys = b.y >= 0 ? 1 : -1;
      // under pressure near his own line a defender can only glance it behind: a corner
      const deep = Math.abs(b.x - ownX) < 9 && Math.abs(b.y) < BOX_HALF;
      const behind = deep && wasCross && rng() < 0.3 - (qual - 60) * 0.004;
      const ang = behind ? Math.atan2(ys * (0.7 + rng() * 0.6), -dir * (0.5 + rng() * 0.6)) : Math.atan2(ys * (0.4 + rng() * 0.9), dir * (1 + rng() * 0.8));
      kick(p, ang, behind ? 9 + rng() * 4 : 12 + qual * 0.07 + rng() * 3, behind ? 3 + rng() * 2 : 5 + rng() * 3.5);
      if (rng() < 0.4) sayLine("headclear", { n: p.label });
    } else {
      let mate = null, md = 1e9;
      if (mine) mate = passTarget(p);
      else for (const o of T.players) {
        if (o === p || o.gk || busy(o)) continue;
        const d = hyp(o.x - p.x, o.y - p.y);
        if (d < 4 || d > 18 || (o.x - p.x) * dir < -6) continue;
        if (d < md) { md = d; mate = o; }
      }
      if (mate) {
        const d = hyp(mate.x - b.x, mate.y - b.y);
        const ang = Math.atan2(mate.y - b.y, mate.x - b.x) + gauss() * (3 + (99 - qual) * 0.15) * Math.PI / 180;
        kick(p, ang, clamp(5 + d * 0.62, 7, 15), -0.6);
        b.passTo = mate;
      } else kick(p, p.face, 9, -0.4);
    }
    b.headId = b.kickId;
    p.kickAnim = 0; p.kickCd = 0.3; p.headT = 0.45; p.headCd = 0.6;
    m.stats.headers[p.team]++;
    emit({ type: "header", team: p.team, name: p.label, kind, id: p.id, cross: wasCross });
  }

  // ---------- fouls ----------
  function callFoul(by, victim) {
    const T = m.teams[by.team], ownX = -goalXOf(by.team);
    m.stats.fouls[by.team]++;
    emit({ type: "foul", team: by.team, name: by.label, on: victim.label });
    sayLine("foul", { n: by.label });
    victim.stun = Math.max(victim.stun, 0.5); victim.stumble = Math.max(victim.stumble, 0.6);
    const x = clamp(victim.x, -HALF_L + 1, HALF_L - 1), y = clamp(victim.y, -HALF_W + 1, HALF_W - 1);
    if (Math.abs(x - ownX) < BOX_D && Math.abs(y) < BOX_HALF) startRestart("penalty", victim.team, ownX + T.dir * SPOT_D, 0);
    else {
      const gx = goalXOf(victim.team), d = hyp(gx - x, y);
      const direct = d < 31 && Math.abs(y) < 22 && (gx - x) * m.teams[victim.team].dir > 14;
      startRestart("freekick", victim.team, x, y, { direct });
    }
  }
  // is a tackle from behind the man (the tackler is moving the same way the carrier faces)
  function fromBehind(tackler, carrier, dirAng) {
    return Math.cos(angDiff(dirAng, carrier.face)) > 0.3;
  }

  // ---------- set piece takers ----------
  function afterSetKick() {
    m.phase = "play";
    if (m.setPiece) { m.setPiece.phase = "taken"; m.setPiece.until = m.t + 1.6; }
    m.restart = null; m.aim = null; m.charge = 0; m.charging = false;
  }
  function takeCorner(R, tx, ty, power) {
    const p = R.taker;
    crossBall(p, tx, ty, power);
    b.cross.corner = true;
    if (rng() < 0.5) sayLine("cross");
    afterSetKick();
  }
  function shortSetPiece(R) {
    const p = R.taker, T = m.teams[p.team];
    let mate = null, md = 1e9;
    for (const o of T.players) {
      if (o === p || o.gk) continue;
      const d = hyp(o.x - p.x, o.y - p.y);
      if (d > 4 && d < md) { md = d; mate = o; }
    }
    m.lastPasser = p;
    if (mate) passBall(p, mate); else kick(p, p.face, 12, 0);
    afterSetKick();
  }
  // the most a free kick can travel and still clear a jumping wall 9.15 m out, then dip under the bar
  function fkSpeedMax(d) {
    const ge = GRAVITY * 1.6, den = Math.max(0.3, 2.15 - 1.5 * 9.15 / d);
    return Math.sqrt(Math.max(100, 0.5 * ge * 9.15 * Math.max(1, d - 9.15) / den));
  }
  function takeFreeKick(R, aimY, curve, power) {
    const p = R.taker, T = m.teams[p.team], goalX = HALF_L * T.dir, sho = p.a.sho;
    const d = hyp(goalX - b.x, aimY - b.y);
    const speed = clamp(Math.min(29, fkSpeedMax(d)) * (0.97 + (power - 0.72) * 0.3) * (0.94 + sho * 0.0008), 14, 31);
    const t = d / speed * 1.06;
    const ge = GRAVITY * 1.6;
    const spin = curve * 1.0;
    const vz = (1.5 + 0.5 * ge * t * t) / t + (power - 0.72) * 6 + gauss() * (0.25 + (99 - sho) * 0.025);
    const ang = Math.atan2(aimY - b.y, goalX - b.x) - spin * t / 2 + gauss() * (1.0 + (99 - sho) * 0.12) * Math.PI / 180;
    shootBall(p, ang, speed, vz);
    b.shot.fk = true;
    b.spin = spin; b.dip = true;
    if (R.wall) m.fkWall = Object.assign({ team: 1 - p.team }, R.wall);
    // the keeper is a touch slower to pick it up behind a wall
    const g = m.teams[1 - p.team].gk;
    g.shotId = b.kickId; g.react = g.reactTime * (1 + rng() * 0.5) + 0.22; g.misread = gauss() * (0.45 + (95 - g.rating) * 0.016);
    afterSetKick();
  }
  function takePenalty(R, aimY, power) {
    const p = R.taker, T = m.teams[p.team], goalX = HALF_L * T.dir, sho = p.a.sho;
    const g = m.teams[1 - p.team].gk;
    const ang = Math.atan2(aimY - b.y, goalX - b.x) + gauss() * (1.1 + (99 - sho) * 0.09 + power * 1.6) * Math.PI / 180;
    const speed = (17 + 13 * power) * (0.9 + sho * 0.0015);
    const vz = 0.4 + power * power * power * 6.4 + Math.abs(gauss()) * (99 - sho) * 0.012;
    shootBall(p, ang, speed, vz);
    b.shot.pen = true;
    // the keeper commits as the ball is struck: the person picks with W or S, the AI reads the taker
    let side;
    if (!m.auto && g.team === 0) side = m.diveSide;
    else {
      const aimSide = Math.abs(aimY) < 0.8 ? 0 : Math.sign(aimY);
      if (rng() < penaltyGuess(g.rating, sho)) side = aimSide;
      else side = aimSide === 0 ? (rng() < 0.5 ? -1 : 1) : (rng() < 0.25 ? 0 : -aimSide);
    }
    g.penDive = side; g.penDiveT = 1.0; g.react = 0.14;
    afterSetKick();
  }
  // the AI takes its set pieces by its ratings
  function aiTake(R) {
    const p = R.taker, T = m.teams[p.team], opp = m.teams[1 - p.team];
    if (R.type === "corner") {
      if (rng() < 0.1) { shortSetPiece(R); return; }
      const side = R.y >= 0 ? 1 : -1;
      const slots = attackSlots(T.idx, side, 4);
      let best = slots[0], bv = -1e9;
      for (const s of slots) {
        let near = null, nd = 1e9;
        for (const q of T.players) { if (q === p || q.gk) continue; const d = hyp(q.x - s[0], q.y - s[1]); if (d < nd) { nd = d; near = q; } }
        const v = (near ? near.hea : 40) - nd * 3 + nearestOpp(s[0], s[1], opp) * 2 + rng() * 6;
        if (v > bv) { bv = v; best = s; }
      }
      takeCorner(R, best[0], best[1]);
    } else if (R.type === "penalty") {
      const side = rng() < 0.5 ? -1 : 1;
      takePenalty(R, rng() < 0.12 ? 0 : side * (2.0 + rng() * 1.3), clamp(0.62 + gauss() * 0.08 + (p.a.sho - 70) * 0.003, 0.35, 0.95));
    } else if (R.type === "freekick") {
      const g = opp.gk;
      let side = R.y > 3 ? -1 : R.y < -3 ? 1 : (g.y >= 0 ? -1 : 1);
      if (rng() < 0.35) side = -side; // over the wall to the near post now and then
      if (rng() < 0.15) { shortSetPiece(R); return; }
      takeFreeKick(R, side * (GOAL_HALF - 0.6 - rng() * 0.4), side * (0.45 + rng() * 0.35) * (T.dir > 0 ? 1 : -1), clamp(0.72 + gauss() * (0.03 + (99 - p.a.sho) * 0.003), 0.4, 1));
    }
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
          // won the ball but went through the man from behind: still a foul now and then
          if (fromBehind(p, o, S.dir) && rng() < 0.1) callFoul(p, o);
        } else {
          S.won = false;
          p.downAfter = 1.1;
          emit({ type: "tackle", kind: "slide", ok: false, team: p.team, name: p.label });
          // a missed slide that catches the man is a foul, and a lunge in his own box is the riskiest of all
          const boxRisk = inOwnBox(p.team, o.x, o.y) ? 1.2 : 1;
          if (rng() < foulChance("slide", p.a.def, fromBehind(p, o, S.dir)) * boxRisk) callFoul(p, o);
          else {
            o.burst = Math.max(o.burst, 0.4);
            sayLine("slidefail", { n: p.label });
          }
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
    // a lunge that misses can clip him: a trip or a shirt pull
    if (committed && !q.gk) {
      const behind = Math.cos(angDiff(Math.atan2(o.y - q.y, o.x - q.x), o.face)) > 0.3;
      const boxRisk = inOwnBox(q.team, o.x, o.y) ? 1.3 : 1;
      if (rng() < foulChance("stand", q.a.def, behind) * boxRisk) { callFoul(q, o); return true; }
    }
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
      // out wide in the last third: whip a cross in for the runners, more often the better the crosser and the
      // closer to the byline
      const depth = (goalX - p.x) * dir;
      if (Math.abs(p.y) > 14 && depth < 30 && depth > 1.5) {
        const tgt = crossTarget(p, T, opp);
        if (tgt) {
          const pr = 0.3 + (p.a.pas - 60) * 0.008 + (depth < 12 ? 0.35 : 0) + (press < 3 ? 0.15 : 0);
          if (rng() < pr) { crossBall(p, tgt.x, tgt.y); if (rng() < 0.45) sayLine("cross"); return; }
        }
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
    // a penalty: the keeper went one way (or stayed) as the ball was struck
    if (g.penDiveT > 0) {
      g.penDiveT -= dt;
      g.react -= dt;
      g.tx = goalX + dir * 0.3;
      g.ty = g.react > 0 ? 0 : g.penDive * (GOAL_HALF - 0.35);
      g.diving = g.react <= 0 && g.penDive !== 0;
      g.ms = 1;
      if (b.owner) g.penDiveT = 0;
      return;
    }
    // a cross into his area: come and claim it if he gets there first, braver the better he is
    if (live && b.cross && b.cross.team !== g.team && !b.owner) {
      const lx = b.cross.x, ly = b.cross.y;
      if (Math.abs(lx - goalX) < 6.5 && Math.abs(ly) < SIX_HALF) {
        const tReach = hyp(lx - g.x, ly - g.y) / (g.sp * 0.95);
        const tBall = hyp(lx - b.x, ly - b.y) / Math.max(4, hyp(b.vx, b.vy));
        if (tReach < tBall - 0.2 + (g.rating - 70) * 0.006) { g.tx = lx; g.ty = ly; g.ms = 1; return; }
      }
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
          if (ahead && d > 1.3 && d < 3.0 && (away || danger)) rate = ((p.a.def - 50) / 120 + (danger ? 0.35 : 0)) * 1.8;
          else if (ahead && p.a.def < 65 && d > 2.2 && d < 3.4) rate = (70 - p.a.def) / 150;
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
    if (live) crossShape(T);
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
    // a cross in the air: hand over to my player nearest where it comes down, so I can attack it (or defend it)
    if (!o && b.cross) {
      let best = null, bd = 1e9;
      for (const p of T.players) {
        if (p.gk || p.down > 0 || p.slide) continue;
        const d = hyp(p.x - b.cross.x, p.y - b.cross.y);
        if (d < bd) { bd = d; best = p; }
      }
      if (best && best !== m.ctrl && (m.switchCd <= 0 || m.ctrlCross !== b.kickId)) { m.ctrl = best; m.switchCd = 0.6; m.ctrlCross = b.kickId; }
      return;
    }
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
  // C: a cross. From out wide it goes to the best runner in the box; from the middle it is a lofted ball forward.
  function userCross(c) {
    const T = m.teams[0], opp = m.teams[1];
    m.lastPasser = c;
    let tgt = crossTarget(c, T, opp);
    if (!tgt) {
      const side = c.y >= 0 ? 1 : -1;
      const s = Math.abs(c.y) > 10 && c.x > 15 ? attackSlots(0, side, 2)[1] : null;
      if (s) tgt = { x: s[0], y: s[1] };
      else {
        let far = null;
        for (const q of T.players) if (q !== c && !q.gk && q.x > c.x + 6 && (!far || q.x > far.x)) far = q;
        tgt = far ? { x: far.x + far.vx * 0.6, y: far.y + far.vy * 0.6 } : { x: c.x + Math.cos(c.face) * 25, y: c.y + Math.sin(c.face) * 25 };
      }
    }
    crossBall(c, clamp(tgt.x, -HALF_L + 2, HALF_L - 2), clamp(tgt.y, -HALF_W + 2, HALF_W - 2));
    if (rng() < 0.4) sayLine("cross");
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
    const high = !b.owner && (b.z > 0.6 || b.vz > 1.5);
    if (mag === 0 && !has && b.passTo === c) {
      const q = intercept(c);
      c.tx = q[0]; c.ty = q[1]; c.ms = 0.95;
    } else if (mag === 0 && !has && b.cross) {
      // no keys under a cross: my player attacks the spot it is coming down
      c.tx = b.cross.x; c.ty = b.cross.y; c.ms = 1;
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
      else if (b.owner === c && inp.cross) { userCross(c); m.charge = 0; m.charging = false; }
      else if (b.owner === c && inp.through) { userThrough(c); m.charge = 0; m.charging = false; }
      else if (b.owner === c && inp.skill) { if (startSkill(c)) { m.charge = 0; m.charging = false; } }
    } else {
      m.charge = 0; m.charging = false;
      // a high ball near me: E heads it at goal (W or S picks the side), Q heads it to a team mate
      const near = high && hyp(b.x - c.x, b.y - c.y) < 9;
      if (near && inp.shoot) m.headQ = { kind: "shot", iy, t: 0.8 };
      else if (near && inp.pass) m.headQ = { kind: "pass", iy, t: 0.8 };
      else if (inp.pass) manualSwitch();
      if (inp.slide) startSlide(c);
    }
  }

  // the person taking a corner, a free kick or a penalty. W A S D aim, hold E for power and let go to strike.
  // Corner: the marker moves over the box, C sends a well weighted cross straight away, Q plays it short.
  // Free kick: W or S picks the spot on the goal, A or D bends it, Q plays it short. Penalty: W or S picks the side.
  function userSetPiece(inp, dt, R) {
    const A = m.aim, ix = inp.mx || 0, iy = inp.my || 0;
    if (!A) { aiTake(R); return; }
    m.aimT -= dt;
    if (R.type === "corner") { A.x = clamp(A.x + ix * 13 * dt, HALF_L - 20, HALF_L - 1.5); A.y = clamp(A.y + iy * 13 * dt, -20, 20); }
    else if (R.type === "freekick") { A.y = clamp(A.y + iy * 3.2 * dt, -GOAL_HALF - 0.6, GOAL_HALF + 0.6); A.curve = clamp(A.curve + ix * 1.8 * dt, -1, 1); }
    else A.y = clamp(A.y + iy * 4.2 * dt, -GOAL_HALF + 0.15, GOAL_HALF - 0.15);
    if (R.type === "corner" && inp.cross && !m.charging) { takeCorner(R, A.x, A.y); return; }
    if (inp.shoot) { m.charge = Math.min(1, m.charge + dt / 0.9); m.charging = true; A.power = m.charge; return; }
    if (m.charging) {
      const pw = Math.max(0.3, m.charge);
      if (R.type === "corner") takeCorner(R, A.x, A.y, pw);
      else if (R.type === "freekick") takeFreeKick(R, A.y, A.curve, pw);
      else takePenalty(R, A.y, pw);
      return;
    }
    if (inp.pass && R.type !== "penalty") { shortSetPiece(R); return; }
    // nothing pressed for a long time: the game takes it for you
    if (m.aimT <= 0) aiTake(R);
  }
  // a direct free kick that does not clear the wall hits it
  function wallCheck() {
    const W = m.fkWall;
    if (!W || b.owner) { m.fkWall = null; return; }
    const along = (b.x - W.x0) * W.ux + (b.y - W.y0) * W.uy;
    if (along < 9.0) return;
    m.fkWall = null;
    const lat = -(b.x - W.x0) * W.uy + (b.y - W.y0) * W.ux;
    if (b.z < 2.0 && Math.abs(lat - W.off) < W.half) {
      b.vx = -b.vx * 0.22 + gauss() * 1.5; b.vy = b.vy * 0.3 + gauss() * 3;
      b.vz = 1.5 + rng() * 2.5; b.spin = 0; b.dip = false; b.shot = null;
      b.lastTeam = W.team; b.kickId++;
      emit({ type: "wall", team: W.team });
      sayLine("wall");
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
      if (p.headT > 0) p.headT -= dt;
      if (p.headCd > 0) p.headCd -= dt;
      if (p.jumpT > 0) {
        p.jumpT = Math.max(0, p.jumpT - dt);
        p.air = p.jumpH * Math.sin(Math.PI * (1 - p.jumpT / JUMP_T));
      } else p.air = 0;
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
        b.vz -= GRAVITY * (b.dip ? 1.6 : 1) * dt;
        b.z += b.vz * dt;
        const f = Math.exp(-AIR_K * dt);
        b.vx *= f; b.vy *= f;
        if (b.spin) {
          // curl: the ball's path turns while it is in the air
          const a = b.spin * dt, c = Math.cos(a), sn = Math.sin(a), vx = b.vx;
          b.vx = vx * c - b.vy * sn; b.vy = vx * sn + b.vy * c;
        }
        if (b.z <= 0) {
          b.z = 0;
          b.spin = 0; b.dip = false; b.cross = null;
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
  // the best man for a dead ball: crossers take corners, shooters take free kicks and penalties
  function pickTaker(T, type, x, y) {
    if (type === "goalkick") return T.gk;
    const field = T.players.filter(p => !p.gk && p.down <= 0);
    if (type === "corner") return field.reduce((a, p) => ((p.a.pas + p.a.dri * 0.3 + (p.line === "DF" && p.role === "CB" ? -30 : 0)) > (a.a.pas + a.a.dri * 0.3 + (a.line === "DF" && a.role === "CB" ? -30 : 0)) ? p : a));
    if (type === "penalty") return field.reduce((a, p) => (p.a.sho > a.a.sho ? p : a));
    if (type === "freekick" && m.restartDirect) return field.reduce((a, p) => ((p.a.sho * 0.6 + p.a.pas * 0.4) > (a.a.sho * 0.6 + a.a.pas * 0.4) ? p : a));
    let taker = field[0], bd = 1e9;
    for (const p of field) { const d = hyp(p.x - x, p.y - y); if (d < bd) { bd = d; taker = p; } }
    return taker;
  }
  function startRestart(type, team, x, y, opt) {
    opt = opt || {};
    m.phase = "restart";
    m.phaseT = { corner: 1.2, freekick: opt.direct ? 1.3 : 1.1, penalty: 1.6 }[type] || 1.1;
    b.owner = null; b.x = x; b.y = y; b.z = 0; b.vx = 0; b.vy = 0; b.vz = 0;
    b.passTo = null; b.through = false; b.shot = null; b.cross = null; b.spin = 0; b.dip = false;
    m.fkWall = null; m.headQ = null;
    for (const p of m.players) { p.jumpT = 0; p.air = 0; p.penDiveT = 0; }
    const T = m.teams[team];
    m.restartDirect = !!opt.direct;
    const taker = pickTaker(T, type, x, y);
    m.restart = { type, team, x, y, taker, direct: !!opt.direct };
    m.setPiece = type === "throw" || (type === "freekick" && !opt.direct) ? null : { kind: type, team, x, y, phase: "setup", direct: !!opt.direct, wall: null };
    m.aim = null;
    m.charge = 0; m.charging = false;
    if (type === "corner") { m.stats.corners[team]++; emit({ type: "corner", team }); sayLine("corner"); }
    else if (type === "goalkick") { m.stats.goalkicks[team]++; if (rng() < 0.3) sayLine("goalkick"); }
    else if (type === "freekick") {
      m.stats.freekicks[team]++;
      if (opt.direct) { m.stats.directFks[team]++; sayLine("freekick", { n: taker.label }); }
      emit({ type: "freekick", team, direct: !!opt.direct });
    } else if (type === "penalty") { m.stats.penalties[team]++; emit({ type: "penalty", team }); sayLine("penalty"); }
    if (type === "freekick" && opt.direct) {
      // the wall: 2 to 4 men 9.15 m out, on the line to goal, leaning to the near post
      const gx = goalXOf(team), d = hyp(gx - x, y);
      const ux = (gx - x) / d, uy = -y / d;
      const n = d < 21 ? 4 : d < 26 ? 3 : 2;
      const nearY = (y >= 0 ? 1 : -1) * GOAL_HALF;
      const off = (-(gx - x) * uy + (nearY - y) * ux) / d * 9.15 * 0.55;
      m.restart.wall = { x0: x, y0: y, ux, uy, off, half: n * 0.36 + 0.22, n };
      m.setPiece.wall = { x: x + ux * 9.15 - uy * off, y: y + uy * 9.15 + ux * off, n };
    }
  }
  // where everyone stands for a set piece. Runs after the normal shape every step until the kick.
  function setPieceShape(R) {
    const T = m.teams[R.team], D = m.teams[1 - R.team];
    const tk = R.taker;
    if (R.type === "goalkick") {
      // the other side must be out of the box before the kick is taken
      const ownX = -goalXOf(R.team);
      for (const p of D.players) {
        if (p.gk) continue;
        if (Math.abs(p.tx - ownX) < BOX_D + 1.5 && Math.abs(p.ty) < BOX_HALF + 1.5) p.tx = ownX + T.dir * (BOX_D + 2 + (p.id % 3) * 2);
      }
      return;
    }
    if (R.type === "corner") {
      const side = R.y >= 0 ? 1 : -1;
      R.key = boxRuns(T, side, true);
      markRuns(D, side);
      // nobody within 9.15 m of the arc but the taker
      for (const p of D.players) { const d = hyp(p.tx - R.x, p.ty - R.y); if (d < 9.2 && !p.gk) { p.tx = R.x - T.dir * 10; p.ty = R.y * 0.62; } }
      const g = D.gk, gx = goalXOf(R.team);
      g.tx = gx - T.dir * 0.9; g.ty = side * 0.6;
    } else if (R.type === "freekick" && R.direct && R.wall) {
      const W = R.wall;
      const wall = D.players.filter(p => !p.gk).sort((p, q) => hyp(p.x - R.x, p.y - R.y) - hyp(q.x - R.x, q.y - R.y)).slice(0, W.n);
      R.key = wall;
      wall.forEach((p, i) => {
        const lat = W.off + (i - (W.n - 1) / 2) * 0.72;
        p.tx = W.x0 + W.ux * 9.15 - W.uy * lat; p.ty = W.y0 + W.uy * 9.15 + W.ux * lat; p.ms = 1;
      });
      const side = R.y >= 0 ? 1 : -1;
      boxRuns(T, side, false);
      const others = D.players.filter(p => !p.gk && !wall.includes(p));
      for (const p of others) { const d = hyp(p.tx - R.x, p.ty - R.y); if (d < 9.5) { p.tx = R.x + (p.tx - R.x) / (d || 1) * 9.6; p.ty = R.y + (p.ty - R.y) / (d || 1) * 9.6; } }
      const g = D.gk, gx = goalXOf(R.team);
      g.tx = gx - T.dir * 0.6; g.ty = -side * 0.9;
    } else if (R.type === "penalty") {
      // only the taker and the keeper in the box, everyone else outside and behind the spot
      const gx = goalXOf(R.team);
      let i = 0;
      for (const p of m.players) {
        if (p === tk || p === D.gk) continue;
        // outside the box and outside the arc, 9.15 m from the spot
        p.tx = gx - T.dir * (BOX_D + 4.2 + (i % 3) * 2); p.ty = ((i >> 1) % 2 ? 1 : -1) * (1.5 + (i % 6) * 2.6); p.ms = 1;
        i++;
      }
      D.gk.tx = gx - T.dir * 0.3; D.gk.ty = 0; D.gk.ms = 1;
    }
  }
  // the taker's spot behind the ball, facing where it is going
  function takerSpot(R) {
    const T = m.teams[R.team], gx = goalXOf(R.team);
    let face;
    if (R.type === "goalkick") face = T.dir > 0 ? 0 : Math.PI;
    else if (R.type === "corner") face = Math.atan2(-R.y, (gx - T.dir * 8) - R.x);
    else if (R.type === "penalty" || (R.type === "freekick" && R.direct)) face = Math.atan2(-R.y, gx - R.x);
    else face = Math.atan2(-R.y, HALF_L * T.dir * 0.4 - R.x);
    const back = R.type === "penalty" ? 1.8 : 0.85;
    return { face, x: R.x - Math.cos(face) * back, y: R.y - Math.sin(face) * back };
  }
  function oppInBox(R) {
    const ownX = -goalXOf(R.team);
    return m.teams[1 - R.team].players.filter(p => !p.gk && Math.abs(p.x - ownX) < BOX_D && Math.abs(p.y) < BOX_HALF);
  }

  function goal(att) {
    m.score[att] = Math.min(MAX_GOALS, m.score[att] + 1);
    const own = b.lastTeam !== att;
    const scorer = b.lastPlayer;
    const sh = b.shot && b.shot.team === att ? b.shot : null;
    const how = own ? "own" : sh && sh.header ? "header" : sh && sh.pen ? "penalty" : sh && sh.fk ? "freekick" : "open";
    if (b.shot && b.shot.team === att) m.stats.onTarget[att]++;
    if (b.owner) { b.vx = b.owner.vx; b.vy = b.owner.vy; b.owner = null; }
    b.shot = null; b.passTo = null; b.through = false;
    m.phase = "goal";
    m.phaseT = 3.2;
    m.nextKick = 1 - att;
    m.charge = 0; m.charging = false;
    const nm = scorer ? scorer.name : m.teams[att].name;
    if (scorer && !own) scorer.celebrate = 3;
    emit({ type: "goal", team: att, name: nm, own, how, min: Math.max(1, minute()), scorer: scorer ? scorer.id : -1 });
    b.cross = null; b.spin = 0; b.dip = false; m.fkWall = null;
    if (own) sayLine("owngoal", { t: m.teams[att].name, s: scoreText() });
    else if (how === "header") { m.stats.headerGoals[att]++; sayLine("headgoal", { n: scorer ? scorer.label : nm, s: scoreText() }); }
    else if (how === "penalty") { m.stats.penGoals[att]++; sayLine("pengoal", { n: scorer ? scorer.label : nm, s: scoreText() }); }
    else if (how === "freekick") { m.stats.fkGoals[att]++; sayLine("fkgoal", { n: scorer ? scorer.label : nm, s: scoreText() }); }
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
        if (b.shot.pen) { emit({ type: "miss", team: att, pen: true }); sayLine("penmiss"); }
        else if (b.shot.dist < 13 && b.shot.open && ay < GOAL_HALF + 3) { emit({ type: "miss", team: att }); sayLine("sitter"); }
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
        if (rng() < 0.45) {
          // tipped over the bar or round the post: out for a corner, and never back into his own net
          const toLine = Math.max(0.3, HALF_L - Math.abs(b.x));
          b.vx = -T.dir * (2 + rng() * 2.5);
          const tl = toLine / Math.abs(b.vx);
          if (rng() < 0.5) { b.vy = gauss() * 1.5; b.vz = Math.max(6.5, (BAR_H + 0.6 - b.z + 0.5 * GRAVITY * tl * tl) / tl); }
          else { b.vy = ys * Math.max(6, (GOAL_HALF + 1.5 - ys * b.y) / tl); b.vz = 1.5 + rng() * 2; }
        } else {
          b.vx = T.dir * (6 + rng() * 5);
          b.vy = ys * (5 + rng() * 7);
          b.vz = 2 + rng() * 3;
        }
        b.lastTeam = best.team;
        b.passTo = null; b.through = false; b.shot = null;
        b.kickId++;
        best.kickCd = 0.5;
        if (shot) { emit({ type: "save", big: true, pen: !!shot.pen }); sayLine(shot.pen ? "pensave" : "bigsave", { g: best.label }); }
      } else {
        take(best, 2.5);
        if (shot) {
          emit({ type: "save", big: rel > 13 || !!shot.pen, pen: !!shot.pen });
          if (shot.pen) sayLine("pensave", { g: best.label });
          else if (rel > 13) sayLine("save", { g: best.label });
        }
      }
      return;
    }
    // a hard ball needs good close control to bring down
    if (rel > 13 + (best.a.dri - 50) * 0.18) {
      if (bd > 0.8) return;
      const block = shot && inOwnBox(best.team, b.x, b.y);
      b.vx = block && rng() < 0.4 ? b.vx * 0.45 + gauss() * 1.5 : -b.vx * 0.3 + gauss() * 2;
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
    // the kicker stands on the centre spot with the ball at his feet. He can just run with it: no pass needed.
    kicker.x = -kicker.carry * K.dir; kicker.y = 0;
    kicker.drib = kicker.face;
    b.x = 0; b.y = 0; b.z = 0; b.vx = 0; b.vy = 0; b.vz = 0;
    b.passTo = null; b.through = false; b.shot = null; b.cross = null; b.spin = 0; b.dip = false;
    m.restart = null; m.aim = null; m.fkWall = null; m.headQ = null;
    for (const p of m.players) { p.jumpT = 0; p.air = 0; p.penDiveT = 0; }
    take(kicker, 1.2);
    // a good dribbler on the AI side sometimes runs it himself from the kick off too
    kicker.think = rng() < clamp((kicker.a.dri - 50) / 70, 0.05, 0.6) ? 0.9 + rng() * 0.7 : 0.25;
    m.setPiece = { kind: "kickoff", team: ti, x: 0, y: 0, phase: "setup" };
    m.charge = 0; m.charging = false;
    if (!m.auto) {
      if (ti === 0) m.ctrl = kicker;
      else m.ctrl = m.teams[0].players.filter(p => !p.gk).sort((p, q) => hyp(p.x, p.y) - hyp(q.x, q.y))[0];
    }
  }

  function danger() {
    if (b.shot || b.cross) return true;
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
      // my kick off: any key after a short beat starts play at once, so I can just dribble away
      const mine = !m.auto && b.owner && b.owner.team === 0;
      const keen = mine && m.phaseT < 1.1 && !!(inp.mx || inp.my || inp.pass || inp.shoot || inp.through || inp.skill || inp.cross || inp.sprint);
      if (m.phaseT > 0 && !keen) return;
      m.phase = "play";
      if (m.setPiece && m.setPiece.kind === "kickoff") { m.setPiece.phase = "taken"; m.setPiece.until = m.t + 1.2; }
      if (!keen) return;
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
      m.t += dt; // the clock runs at dead balls, like on a real pitch
      for (const T of m.teams) teamAI(T, dt, false, T.idx === R.team);
      const keep = R.type === "penalty" ? 0 : (R.type === "freekick" || R.type === "corner") ? 9.15 : 8;
      for (const p of m.teams[1 - R.team].players) {
        if (!keep) break;
        const dx = p.tx - R.x, dy = p.ty - R.y, d = hyp(dx, dy);
        if (d < keep) {
          const ux = d > 0.01 ? dx / d : -Math.sign(R.x || 1), uy = d > 0.01 ? dy / d : 0;
          p.tx = clamp(R.x + ux * keep, -HALF_L, HALF_L); p.ty = clamp(R.y + uy * keep, -HALF_W, HALF_W);
        }
      }
      setPieceShape(R);
      const spot = takerSpot(R);
      R.taker.tx = spot.x; R.taker.ty = spot.y; R.taker.ms = 1.5;
      movePlayers(dt);
      let ready = m.phaseT <= 0 && (hyp(R.taker.x - spot.x, R.taker.y - spot.y) < 1.2 || m.phaseT < -2.5);
      // a real set piece waits for the wall, the runners and the box to be set, a few seconds at most
      if (ready && R.key && m.phaseT > (R.type === "corner" ? -3.2 : -1.6)) {
        for (const p of R.key) if (hyp(p.tx - p.x, p.ty - p.y) > 2) { ready = false; break; }
      }
      if (ready && R.type === "penalty") {
        const gx = goalXOf(R.team), D = m.teams[1 - R.team];
        for (const p of m.players) {
          if (p === R.taker || p === D.gk) continue;
          if (Math.abs(p.x - gx) < BOX_D + 0.5 && Math.abs(p.y) < BOX_HALF + 0.5) { p.x = gx - m.teams[R.team].dir * (BOX_D + 1); p.tx = p.x; }
        }
      }
      if (ready && R.type === "goalkick") {
        // wait for the box to clear; anyone still dawdling after a few seconds is waved out
        const inside = oppInBox(R);
        if (inside.length) {
          if (m.phaseT < -3.5) {
            const ownX = -goalXOf(R.team);
            for (const p of inside) { p.x = ownX + m.teams[R.team].dir * (BOX_D + 0.6); p.tx = p.x; p.vx = 0; p.vy = 0; }
          } else ready = false;
        }
      }
      if (ready) {
        R.taker.face = spot.face;
        R.taker.x = spot.x; R.taker.y = spot.y;
        R.taker.vx = 0; R.taker.vy = 0;
        R.taker.drib = spot.face;
        if (!m.auto && R.team === 0 && !R.taker.gk) m.ctrl = R.taker;
        if (R.type === "corner" || R.type === "penalty" || (R.type === "freekick" && R.direct)) {
          // a proper set piece: the taker lines it up, then aims (the person) or picks his spot (the AI)
          m.phase = "setpiece";
          if (m.setPiece) m.setPiece.phase = "aim";
          const human = !m.auto && R.team === 0;
          m.diveSide = 0;
          if (human) {
            const gx = goalXOf(0);
            m.aim = R.type === "corner"
              ? { kind: "corner", x: gx - 8, y: (R.y >= 0 ? 1 : -1) * 1.5, power: 0, curve: 0 }
              : { kind: R.type, x: gx, y: R.type === "penalty" ? 0 : (R.y >= 0 ? -1 : 1) * (GOAL_HALF - 1), power: 0, curve: 0 };
            m.aimT = 12;
          } else m.aimT = R.type === "corner" ? 0.5 + rng() * 0.4 : R.type === "penalty" ? 1.1 + rng() * 0.4 : 0.8 + rng() * 0.4;
          m.charge = 0; m.charging = false;
        } else {
          if (R.type === "goalkick" && oppInBox(R).length) m.stats.gkBoxViolations++;
          take(R.taker, 1.4);
          R.taker.think = 0.3;
          m.phase = "play";
          m.restart = null;
          if (m.setPiece) { m.setPiece.phase = "taken"; m.setPiece.until = m.t + 1.2; }
        }
      }
      return;
    }
    if (m.phase === "setpiece") {
      const R = m.restart, spot = takerSpot(R);
      m.t += dt;
      for (const T of m.teams) teamAI(T, dt, false, T.idx === R.team);
      setPieceShape(R);
      R.taker.tx = spot.x; R.taker.ty = spot.y; R.taker.ms = 0.5;
      movePlayers(dt);
      R.taker.face = spot.face;
      b.x = R.x; b.y = R.y; b.z = 0; b.vx = 0; b.vy = 0; b.vz = 0;
      if (!m.auto && R.team === 0) userSetPiece(inp, dt, R);
      else {
        // the person in goal picks a side for a penalty against him with W or S
        if (!m.auto && R.type === "penalty" && inp.my) m.diveSide = inp.my < 0 ? -1 : 1;
        m.aimT -= dt;
        if (m.aimT <= 0) aiTake(R);
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

    if (m.setPiece && m.setPiece.phase === "taken" && (m.t > m.setPiece.until || b.owner)) m.setPiece = null;
    if (m.headQ && (m.headQ.t -= dt) <= 0) m.headQ = null;
    if (b.cross) b.cross.t += dt;
    if (!m.auto) {
      updateCtrl(dt);
      m.hands = (inp.mx || inp.my || inp.shoot || inp.pass || inp.through || inp.slide || inp.tackle || inp.skill || inp.cross) ? 0 : m.hands + dt;
      m.assist = m.hands > (b.owner === m.ctrl ? 2 : 0.3);
    }
    for (const T of m.teams) { if (T.throughCd > 0) T.throughCd -= dt; teamAI(T, dt, true); }
    if (!m.auto) userControl(inp, dt);
    if (m.phase !== "play") return; // a foul in the AI's run of play stops it here
    jumps();
    movePlayers(dt);
    if (m.phase !== "play") return;
    const prev = moveBall(dt);
    checkBounds(prev[0], prev[1]);
    if (m.phase !== "play") return;
    wallCheck();
    pickups();
    aerials();
    tackles();
    // who the next pass would go to, for the name tags
    m.passHint = (!m.auto && m.ctrl && b.owner === m.ctrl) ? passTarget(m.ctrl) : null;
  }

  setupKickoff(userHome ? 0 : 1);
  m.phaseT = 2.2;
  sayLine("kickoff");

  return {
    m, step, minute, result, startSkill, startSlide, deep: true,
    // what the 3D view reads for set pieces and the aim marker
    get setPiece() { return m.setPiece; },
    // tests start a set piece straight away: restart("corner" | "freekick" | "penalty" | "goalkick", team, x, y, { direct })
    restart: (type, team, x, y, opt) => startRestart(type, team, x, y, opt),
    get aim() { return m.aim; }
  };
}

export const DIMS = { HALF_L, HALF_W, GOAL_HALF, BAR_H, GOAL_DEPTH, BOX_D, BOX_HALF, SIX_D, SIX_HALF, SPOT_D, CIRCLE_R };
export { STEP, MATCH_SECONDS, MAX_GOALS, SWEET_POWER };

// Player attributes and movement identity for the 3D match.
// Career Mode gives each player an effective OVR (form, morale, travel and home or away already folded in),
// a position group, a detailed role and an age. From those we build the full attribute sheet the gameplay
// reads (pace, agility, touch, passing, shooting, defending, keeping...) and a physical profile that makes
// every player move differently: height, mass, stride, cadence, top speed, burst, turning, posture, arm swing,
// preferred foot, skill level. Everything is deterministic for a given name, so a player always moves the
// same way, and two players with the same pace still look different.
import { clamp, hash01 } from "./util.mjs";

export const ATTR_KEYS = ["acc", "spd", "agi", "bal", "ctl", "dri", "rea", "com", "spa", "lpa", "cro", "fin", "pow", "cur", "hea", "jmp", "str", "sta", "agg", "awa", "tck", "sld", "vis", "apos", "gkd", "gkh", "gkr", "gkp", "gkk"];

// offsets from the overall for each role (an outfield player's keeping is always poor and the other way round)
const T = {
  //    acc spd agi bal ctl dri rea com spa lpa cro fin pow cur hea jmp str sta agg awa tck sld vis apos
  ST:  [  2,  3,  0, -2,  1,  0,  2,  2, -6,-14,-12,  5,  4, -4,  0,  0,  2, -4, -8,-40,-45,-48, -8,  6],
  LW:  [  6,  6,  6,  4,  2,  4,  0, -2, -3,-10,  0, -2, -3,  0,-18,-10,-12,  0,-14,-42,-42,-45, -2,  2],
  RW:  [  6,  6,  6,  4,  2,  4,  0, -2, -3,-10,  0, -2, -3,  0,-18,-10,-12,  0,-14,-42,-42,-45, -2,  2],
  CAM: [  0, -2,  4,  4,  4,  3,  1,  3,  4,  0, -4, -3, -2,  2,-20,-12,-12, -2,-12,-28,-30,-34,  6,  2],
  CM:  [ -4, -4, -2,  0,  1, -2,  1,  2,  4,  3, -6, -8,  0, -2,-10, -6, -4,  6, -2, -8, -8,-10,  3, -4],
  CDM: [ -8, -6, -6, -2, -2, -6,  0,  1,  2,  1,-14,-18, -2, -8, -2, -2,  4,  4,  6,  4,  4,  2, -2,-14],
  CB:  [-12, -8,-14, -8,-10,-16, -2, -2, -6, -6,-26,-32, -6,-20,  3,  2,  6, -6,  4,  4,  3,  2,-20,-36],
  LB:  [  0,  2, -2,  0, -4, -6, -2, -4, -3, -6,  0,-26,-10, -8,-10, -4, -6,  6,  0, -4, -2, -2,-10,-18],
  RB:  [  0,  2, -2,  0, -4, -6, -2, -4, -3, -6,  0,-26,-10, -8,-10, -4, -6,  6,  0, -4, -2, -2,-10,-18],
  GK:  [-24,-22,-20,-12,-24,-34,  2,  0,-24,-14,-40,-50,-20,-30,-40, -4, -6,-20,-30,-40,-50,-50,-24,-50]
};
const OUT_KEYS = ATTR_KEYS.slice(0, 24);
const ROLE_FALLBACK = { GK: "GK", DF: "CB", MF: "CM", FW: "ST" };

export function roleOf(row) {
  const r = String(row.role || "").toUpperCase();
  if (T[r]) return r;
  return ROLE_FALLBACK[row.pos] || "CM";
}

// the full attribute sheet, 25 to 99
export function deriveAttrs(row) {
  const name = String(row.n || row.name || "Player");
  const role = roleOf(row);
  const r = Number(row.r) || 70;
  const age = Number(row.age) || 26;
  const off = T[role];
  const a = {};
  // a personal style axis: some players are quick and slight, others big and strong
  const lean = hash01(name, 11) * 2 - 1;
  for (let i = 0; i < OUT_KEYS.length; i++) {
    const k = OUT_KEYS[i];
    let v = r + off[i] + (hash01(name, 100 + i) * 8 - 4);
    if (k === "acc" || k === "spd" || k === "agi") v += lean * 4;
    if (k === "str" || k === "hea" || k === "jmp") v -= lean * 4;
    // age: the young are sharp but light, the old lose a yard and gain calm
    if (k === "acc" || k === "spd") v += age <= 21 ? 2 : age >= 31 ? -(age - 30) * 1.6 : 0;
    if (k === "agi") v += age >= 32 ? -(age - 31) * 1.2 : 0;
    if (k === "com" || k === "vis") v += age <= 20 ? -4 : age >= 30 ? 3 : 0;
    if (k === "str") v += age <= 20 ? -4 : age >= 26 ? 2 : 0;
    if (k === "sta") v += age >= 32 ? -(age - 31) * 2 : 0;
    a[k] = Math.round(clamp(v, 25, 99));
  }
  if (role === "GK") {
    a.gkd = Math.round(clamp(r + 2 + hash01(name, 201) * 6 - 3, 30, 99));
    a.gkh = Math.round(clamp(r + hash01(name, 202) * 6 - 3, 30, 99));
    a.gkr = Math.round(clamp(r + 3 + hash01(name, 203) * 6 - 3, 30, 99));
    a.gkp = Math.round(clamp(r + hash01(name, 204) * 6 - 3, 30, 99));
    a.gkk = Math.round(clamp(r - 8 + hash01(name, 205) * 10 - 5, 30, 99));
  } else {
    for (const k of ["gkd", "gkh", "gkr", "gkp", "gkk"]) a[k] = Math.round(clamp(18 + hash01(name, 210 + k.length) * 14, 10, 40));
  }
  return a;
}

// 0 to 1 view of an attribute
export const n01 = v => clamp((v - 40) / 59, 0, 1);

// how a player moves: the numbers the body and the view both read
export function deriveProfile(row, a) {
  const name = String(row.n || row.name || "Player");
  const role = roleOf(row);
  const h1 = hash01(name, 301), h2 = hash01(name, 302), h3 = hash01(name, 303), h4 = hash01(name, 304), h5 = hash01(name, 305);
  // height by role, nudged by strength and agility (tall players are less nimble)
  const baseH = { GK: 1.91, CB: 1.89, ST: 1.83, CDM: 1.83, CM: 1.79, CAM: 1.76, LW: 1.75, RW: 1.75, LB: 1.78, RB: 1.78 }[role];
  const h = clamp(baseH + (h1 - 0.5) * 0.16 + (a.str - a.agi) * 0.0012, 1.62, 2.0);
  const bmi = 22.4 + (a.str - 60) * 0.035 + (h2 - 0.5) * 1.2;
  const mass = clamp(bmi * h * h, 58, 98);
  const pac = n01(a.spd), acc = n01(a.acc), agi = n01(a.agi), bal = n01(a.bal);
  // top speed 7.2 to 9.8 m/s, a heavy frame costs a little
  const vmax = 7.2 + pac * 2.55 - (mass - 76) * 0.006;
  // speed build up: k in dv/dt = k (vmax - v), and the first step burst in m/s2
  const accK = 0.95 + acc * 0.8 - (h - 1.8) * 0.6;
  const burst = 4.4 + acc * 2.8 - (mass - 76) * 0.02;
  // turning: how fast the body can yaw when slow and at full tilt, and lateral grip in m/s2
  const turnLo = 7 + agi * 6 - (h - 1.8) * 4;
  const turnHi = 2.1 + agi * 1.8;
  const grip = 7.2 + (agi * 0.6 + bal * 0.4) * 3.2;
  const brake = 6.4 + (agi * 0.5 + bal * 0.5) * 2.6;
  // stride: long legs and a long stride style take fewer, bigger steps
  const stepMax = h * (1.06 + h3 * 0.16);
  const cadMax = vmax / stepMax;
  const leftRoles = { LB: 0.62, LW: 0.38, RW: 0.42, RB: 0.1, CB: 0.2 };
  const foot = hash01(name, 306) < (leftRoles[role] !== undefined ? leftRoles[role] : 0.18) ? -1 : 1;
  const tech = n01((a.dri + a.ctl + a.agi) / 3);
  const stars = clamp(Math.round(1 + tech * 4 + (h4 - 0.5) * 1.2 + (role === "LW" || role === "RW" || role === "CAM" ? 0.5 : 0) - (role === "CB" || role === "GK" ? 1 : 0)), 1, 5);
  const weak = clamp(Math.round(2 + h5 * 2.6 + tech * 0.6), 1, 5);
  return {
    h, mass, vmax, accK, burst, turnLo, turnHi, grip, brake, stepMax, cadMax, foot, stars, weak,
    // posture and style, read by the animation
    lean: 0.08 + acc * 0.08 + (h4 - 0.5) * 0.06, // forward lean when accelerating
    upright: hash01(name, 307), // 0 hunched sprinter, 1 tall upright runner
    arm: 0.75 + hash01(name, 308) * 0.5, // arm swing size
    knee: 0.8 + hash01(name, 309) * 0.4, // knee lift
    bounce: 0.6 + hash01(name, 310) * 0.8, // vertical bob
    elbow: hash01(name, 311), // elbow out or tucked
    stance: 0.8 + hash01(name, 312) * 0.4, // dribbling crouch and width
    touch: 1.25 - tech * 0.5, // close control touch distance factor
    headUp: 0.3 + n01(a.vis) * 0.6, // how often the head comes up while dribbling
    style: hash01(name, 313), // picks among shooting, passing and celebration variants
    skin: Math.floor(hash01(name, 314) * 8),
    hair: Math.floor(hash01(name, 315) * 9),
    hairCol: Math.floor(hash01(name, 316) * 7),
    beard: hash01(name, 317) < 0.35 ? 1 + Math.floor(hash01(name, 318) * 2) : 0,
    boot: Math.floor(hash01(name, 319) * 6),
    sleeve: hash01(name, 320) < 0.12 ? 1 : 0, // long sleeves
    sock: hash01(name, 321) < 0.2 ? 1 : 0 // socks pulled over the knee
  };
}

// shirt numbers: the real one from the squad when the server sent it, else a role preference, unique in the XI
const NUM_PREF = {
  GK: [1, 13, 25], CB: [4, 5, 6, 15, 16, 24], LB: [3, 12, 21], RB: [2, 22, 23], CDM: [6, 8, 14, 16],
  CM: [8, 10, 14, 16, 18], CAM: [10, 7, 20, 21], LW: [11, 17, 19, 7], RW: [7, 17, 19, 11], ST: [9, 10, 18, 20]
};
export function assignNumbers(rows) {
  const used = new Set();
  for (const p of rows) if (p.num && !used.has(p.num) && p.num >= 1 && p.num <= 99) used.add(p.num); else p.num = 0;
  for (const p of rows) {
    if (p.num) continue;
    const pref = NUM_PREF[roleOf(p)] || NUM_PREF.CM;
    let n = pref.find(x => !used.has(x));
    if (!n) { n = 12; while (used.has(n)) n++; }
    used.add(n);
    p.num = n;
  }
  return rows;
}

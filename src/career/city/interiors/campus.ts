/**
 * The schools, colleges and clubs as grounds you walk (the server's campus.js says which, how good and in what
 * colours). Walk through the gate and the grounds open as their own outdoor scene:
 * - a school: the classroom block (in through its door to the corridor, then a classroom), the canteen, a plain
 *   pitch with goals and no stands (dust at the poorest), trees along the wall, a court at the better ones;
 * - a college: bigger and nicer, a glass lecture block, the student cafe, a library, a quad, a proper pitch with a
 *   small stand (a roof and a running track at the best);
 * - a club's training ground: two to four pitches, the main building in the club's colours with doors to the
 *   gym, the dressing room, the physio and recovery room and the canteen, and the car park where his own car sits.
 * Each one is its own: the layout keeps to a pattern, but sizes, colours, materials and the extras come from its
 * standing and its seed. The rooms inside are rooms of the place ("school/corridor", "training/physio"), the way
 * a garage is a room of a home.
 */
import * as THREE from "three";
import type { CareerState, WorldPlace } from "../../types";
import { rbox, cyl, sphere, plane, mat, glass, glow, makeVehicle, seeded } from "../kit3d";
import { Kit, surfMat, shopLight, plant, type Room, type RoomLight } from "./common";

/** the room of a campus place, from its id ("school/corridor" gives "corridor"); "" for the grounds */
export function subOf(p: WorldPlace) {
  const i = p.id.indexOf("/");
  return i < 0 ? "" : p.id.slice(i + 1);
}
export const baseOf = (id: string) => id.split("/")[0];
export const SUB_NAME: Record<string, string> = {
  corridor: "Corridor",
  classroom: "Classroom",
  canteen: "Canteen",
  gym: "Gym",
  changing: "Dressing room",
  physio: "Physio and recovery",
};
export const isCampus = (p: WorldPlace) => !!p.inst && (p.kind === "school" || p.kind === "college" || p.kind === "training");

// ---------- light ----------
function outdoorLight(night: number, weather = "clear"): RoomLight {
  const grey = weather === "rain" || weather === "storm" || weather === "fog" ? 1 : weather === "cloud" || weather === "snow" || weather === "haze" ? 0.5 : 0;
  if (night > 0.5)
    return {
      sky: "#24304a",
      ground: "#0b0d10",
      hemi: 0.45,
      key: "#a9bce6",
      keyI: 0.55,
      points: [
        { x: -20, y: 9, z: 0, col: "#ffe2b0", i: 60, dist: 70 },
        { x: 20, y: 9, z: -10, col: "#ffe2b0", i: 60, dist: 70 },
      ],
      bg: "#070a12",
      fog: ["#070a12", 50, 230],
    };
  const mix = (a: string, b: string, t: number) => "#" + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
  return {
    sky: mix("#cfe3fb", "#c4c9cf", grey),
    ground: "#4a5638",
    hemi: 0.9 - grey * 0.15,
    key: mix("#fff0d8", "#e8ecf0", grey),
    keyI: 2.1 - grey * 1.1,
    points: [],
    bg: mix("#8fb6de", "#8e969f", grey),
    fog: [mix("#b4cbe2", "#9aa1a9", grey), 100 - grey * 30, 340 - grey * 120],
  };
}
const weatherOf = (k: Kit) => k.st.life.weather?.kind || "clear";

// ---------- pieces ----------
const GRASS = "#4f8a45",
  GRASS2 = "#5a9850",
  DUST = "#a8875a";
/** a football pitch: grass with mown stripes (or dust), lines, centre circle, boxes, goals with nets, flags */
function pitch(k: Kit, cx: number, cz: number, pw: number, pd: number, o: { dust?: boolean; nets?: boolean } = {}) {
  const ground = o.dust ? mat(DUST, { rough: 1 }) : mat(GRASS, { rough: 0.95 });
  k.add(plane(pw + 6, pd + 6), ground, cx, 0.01, cz, 0, { rx: -Math.PI / 2, shadow: false });
  if (!o.dust) {
    const stripe = mat(GRASS2, { rough: 0.95 });
    const n = 10;
    for (let i = 0; i < n; i += 2) k.add(plane(pw / n, pd), stripe, cx - pw / 2 + (i + 0.5) * (pw / n), 0.015, cz, 0, { rx: -Math.PI / 2, shadow: false });
  }
  const line = mat(o.dust ? "#efe6d2" : "#f4f6f0", { rough: 0.8 });
  const L = (x: number, z: number, w: number, d: number) => k.add(plane(w, d), line, cx + x, 0.022, cz + z, 0, { rx: -Math.PI / 2, shadow: false });
  L(0, -pd / 2, pw, 0.12);
  L(0, pd / 2, pw, 0.12);
  L(-pw / 2, 0, 0.12, pd);
  L(pw / 2, 0, 0.12, pd);
  L(0, 0, 0.12, pd);
  // the centre circle as short segments
  const R = Math.min(9.15, pd * 0.2);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    k.add(plane(0.12, (Math.PI * 2 * R) / 28 + 0.05), line, cx + Math.sin(a) * R, 0.022, cz + Math.cos(a) * R, a, { rx: -Math.PI / 2, shadow: false });
  }
  // the boxes at each end (the pitch runs along x)
  const bw = Math.min(16.5, pw * 0.16),
    bd = Math.min(40.3, pd * 0.6);
  for (const sx of [-1, 1]) {
    const gx = cx + sx * pw / 2;
    L(sx * (pw / 2 - bw), 0, 0.12, bd);
    L(sx * (pw / 2 - bw / 2), -bd / 2, bw, 0.12);
    L(sx * (pw / 2 - bw / 2), bd / 2, bw, 0.12);
    // the goal: posts, the bar, the net behind
    const white = mat("#f4f4f4", { rough: 0.4 });
    const gw = Math.min(7.32, pd * 0.2),
      gh = Math.min(2.44, 2.0 + pd * 0.008);
    for (const sz of [-1, 1]) k.add(cyl(0.06, 0.06, gh, 8), white, gx, gh / 2, cz + sz * gw / 2);
    k.add(cyl(0.06, 0.06, gw, 8), white, gx, gh, cz, 0, { rx: Math.PI / 2 });
    if (o.nets !== false) {
      const net = mat("#e8ece8", { rough: 1, opacity: 0.35, side: THREE.DoubleSide });
      k.add(plane(gw, gh), net, gx + sx * 1.6, gh / 2, cz, Math.PI / 2, { shadow: false });
      k.add(plane(1.6, gw), net, gx + sx * 0.8, gh, cz, 0, { rx: Math.PI / 2, shadow: false });
    }
    k.block(gx, cz, 0.2, gw / 2 + 0.1);
    // corner flags
    for (const sz of [-1, 1]) {
      k.add(cyl(0.025, 0.025, 1.5, 6), white, gx, 0.75, cz + sz * pd / 2);
      k.add(plane(0.4, 0.3), mat("#ffd23c", { side: THREE.DoubleSide }), gx + 0.2 * -sx, 1.35, cz + sz * pd / 2, 0, { shadow: false });
    }
  }
}
/** a building block with rows of windows on its four faces, a band in the accent colour and a flat or pitched roof */
function building(k: Kit, x: number, z: number, w: number, d: number, floors: number, o: { wall: string; acc: string; glassy?: boolean; roof?: string; name?: string; nameFg?: string; door?: number }) {
  const H = floors * 3.6;
  const wallM = mat(o.wall, { rough: 0.85 });
  k.box(w, H, d, wallM, x, H / 2, z, 0, 0.05);
  k.block(x, z, w / 2, d / 2);
  const win = o.glassy ? glass("#5d7ea0", 0.75) : mat("#3a4c60", { rough: 0.12, metal: 0.5 });
  const frame = mat("#f2f0ea", { rough: 0.6 });
  const sill = mat("#b8b2a6", { rough: 0.8 });
  // a darker plinth along the bottom and a parapet along the top
  k.box(w + 0.1, 0.7, d + 0.1, mat("#8a857c", { rough: 0.9 }), x, 0.35, z);
  k.box(w + 0.2, 0.35, d + 0.2, mat("#cfc9bd", { rough: 0.8 }), x, H - 0.1, z);
  // windows on the long faces: a frame, the glass set back in it, a sill under it
  for (let f = 0; f < floors; f++) {
    const y = 1.9 + f * 3.6;
    if (o.glassy) {
      for (const sz of [-1, 1]) {
        k.add(plane(w - 1.2, 2.8), win, x, y, z + sz * (d / 2 + 0.02), sz > 0 ? 0 : Math.PI, { shadow: false });
        const mul = Math.max(2, Math.floor(w / 2.4));
        for (let i = 0; i <= mul; i++) k.box(0.08, 2.8, 0.08, mat("#2a2e34", { metal: 0.6, rough: 0.3 }), x - (w - 1.2) / 2 + (i * (w - 1.2)) / mul, y, z + sz * (d / 2 + 0.05));
      }
    } else {
      const n = Math.max(2, Math.floor(w / 3.2));
      for (let i = 0; i < n; i++)
        for (const sz of [-1, 1]) {
          const wx = x - w / 2 + (i + 0.5) * (w / n),
            wz = z + sz * (d / 2 + 0.02),
            ww = (w / n) * 0.62;
          k.add(plane(ww + 0.24, 1.94), frame, wx, y, wz, sz > 0 ? 0 : Math.PI, { shadow: false });
          k.add(plane(ww, 1.7), win, wx, y, wz + sz * 0.012, sz > 0 ? 0 : Math.PI, { shadow: false });
          k.add(plane(0.05, 1.7), frame, wx, y, wz + sz * 0.02, sz > 0 ? 0 : Math.PI, { shadow: false });
          k.box(ww + 0.3, 0.08, 0.22, sill, wx, y - 0.95, wz + sz * 0.1);
        }
    }
    const m = Math.max(1, Math.floor(d / 3.4));
    for (let i = 0; i < m; i++) for (const sx of [-1, 1]) k.add(plane((d / m) * 0.6, 1.7), win, x + sx * (w / 2 + 0.02), y, z - d / 2 + (i + 0.5) * (d / m), (sx * Math.PI) / 2, { shadow: false });
  }
  // the band under the roof in the place's colour, and the roof
  k.box(w + 0.3, 0.5, d + 0.3, mat(o.acc, { rough: 0.5 }), x, H + 0.25, z);
  if (o.roof) {
    const r = new THREE.CylinderGeometry(0.01, d * 0.62, 2.6, 4, 1);
    r.rotateY(Math.PI / 4);
    r.scale(w / (d * 0.88), 1, 1);
    k.add(r, mat(o.roof, { rough: 0.8 }), x, H + 1.8, z);
  }
  if (o.name) k.text(o.name.toUpperCase(), o.nameFg || "#ffffff", o.acc, x, H - 0.9, z + d / 2 + 0.06, Math.min(w * 0.7, o.name.length * 0.62 + 2), 0.9, 0);
  // the door on the long face toward the grounds (+z), at the given x offset
  if (o.door !== undefined) {
    const dx = x + o.door,
      dz = z + d / 2;
    // double doors in glass with a frame, a canopy on two posts, two steps up
    k.box(2.8, 3.0, 0.12, mat("#2a2e34", { metal: 0.5, rough: 0.3 }), dx, 1.5, dz + 0.04);
    for (const sx of [-0.65, 0.65]) k.add(plane(1.2, 2.6), glass("#6a8aa8", 0.85), dx + sx, 1.4, dz + 0.12, 0, { shadow: false });
    k.box(4.4, 0.2, 2.6, mat(o.acc, { rough: 0.5 }), dx, 3.4, dz + 1.25);
    for (const sx of [-1.9, 1.9]) {
      k.add(cyl(0.08, 0.08, 3.3, 8), mat("#d8dce0", { metal: 0.6, rough: 0.3 }), dx + sx, 1.65, dz + 2.3);
      k.circle(dx + sx, dz + 2.3, 0.12);
    }
    k.box(4.0, 0.14, 1.2, mat("#cfc9bd", { rough: 0.8 }), dx, 0.07, dz + 0.6);
    k.box(4.0, 0.14, 0.6, mat("#c4bdb0", { rough: 0.8 }), dx, 0.21, dz + 0.3);
  }
  return H;
}
function tree(k: Kit, x: number, z: number, s = 1, leaf = "#3d6b35") {
  k.add(cyl(0.16 * s, 0.22 * s, 2.6 * s, 7), mat("#5b4636", { rough: 0.9 }), x, 1.3 * s, z);
  k.add(sphere(1.7 * s, 9), mat(leaf, { rough: 0.9, flat: true }), x, 3.6 * s, z);
  k.add(sphere(1.2 * s, 8), mat(leaf, { rough: 0.9, flat: true }), x + 0.8 * s, 3.0 * s, z - 0.4 * s);
  k.circle(x, z, 0.35 * s);
}
/** the outer wall with the gate gap at gx on the street side (+z) */
function perimeter(k: Kit, W: number, D: number, gx: number, h: number, colour: string, gap = 8) {
  const m = mat(colour, { rough: 0.9 });
  k.wall(-W / 2, -D / 2, W / 2, -D / 2, h, m, {});
  k.wall(-W / 2, D / 2, -W / 2, -D / 2, h, m, {});
  k.wall(W / 2, -D / 2, W / 2, D / 2, h, m, {});
  k.wall(W / 2, D / 2, gx + gap / 2, D / 2, h, m, {});
  k.wall(gx - gap / 2, D / 2, -W / 2, D / 2, h, m, {});
}
/** a small stand along a pitch side: stepped rows of seats in two colours, a roof at the better places */
function stand(k: Kit, cx: number, cz: number, len: number, rows: number, face: 1 | -1, a: string, b: string, roof: boolean) {
  for (let r = 0; r < rows; r++) {
    const z = cz - face * (r * 0.8),
      y = 0.35 + r * 0.42;
    k.box(len, 0.42, 0.8, mat("#9aa0a6", { rough: 0.8 }), cx, y - 0.21 + 0.21, z, 0, 0.02);
    // seats as a coloured strip on each step
    k.box(len - 0.4, 0.18, 0.36, mat(r % 2 ? b : a, { rough: 0.5 }), cx, y + 0.3, z - face * 0.1);
  }
  k.block(cx, cz - (face * (rows - 1) * 0.8) / 2, len / 2, (rows * 0.8) / 2 + 0.3);
  if (roof) {
    const back = cz - face * rows * 0.8;
    for (const sx of [-1, 0, 1]) k.add(cyl(0.08, 0.08, 4.6, 8), mat("#c8ccd2", { metal: 0.7, rough: 0.3 }), cx + (sx * len) / 2.2, 2.3 + rows * 0.21, back);
    k.box(len + 1, 0.15, rows * 0.8 + 1.2, mat("#d6dadf", { rough: 0.4, metal: 0.4 }), cx, 4.7 + rows * 0.3, cz - face * (rows * 0.4 - 0.2));
  }
}

// ---------- the grounds ----------
export function campusGrounds(k: Kit, p: WorldPlace): Room {
  const inst = p.inst!;
  const sd = inst.standing;
  const college = p.kind === "college";
  const r = seeded(String(inst.seed));
  const [ca, cb] = inst.cols;
  const W = Math.round(college ? 118 + sd * 2.2 : 86 + sd * 1.8),
    D = Math.round(college ? 96 + sd : 76 + sd);
  const dusty = !college && sd <= 3;
  // the ground: grass with paths, the whole place inside a wall (railings at a college)
  k.floor(W, D, surfMat("concrete", college ? "#bdb6a8" : "#b8ae9c", "#9a907e", { rough: 0.95 }), 0, 0, 4);
  k.add(plane(W - 2, D - 2), mat(college ? "#5f8f4e" : "#6c9156", { rough: 1 }), 0, 0.004, 0, 0, { rx: -Math.PI / 2, shadow: false });
  const gx = W / 2 - (college ? 24 : 18);
  perimeter(k, W, D, gx, college ? 1.5 : 2.1, college ? "#2f3338" : r() < 0.5 ? "#d8cdb8" : "#c9b8a0");
  // the gate: pillars in the place's colours, the name over it
  for (const sx of [-1, 1]) {
    k.box(0.8, 3.6, 0.8, mat(ca, { rough: 0.6 }), gx + sx * 4.4, 1.8, D / 2 - 0.4);
    k.box(1.0, 0.25, 1.0, mat(cb, { rough: 0.5 }), gx + sx * 4.4, 3.7, D / 2 - 0.4);
  }
  k.text(p.name.toUpperCase(), cb, ca, gx, 4.4, D / 2 - 0.35, Math.min(14, p.name.length * 0.42 + 2), 0.85, Math.PI);
  k.spot("door", "Back to the street", gx, D / 2 - 1.6, { r: 1.4, y: 1.8 });
  // a path from the gate up to the buildings
  const path = surfMat("tile", college ? "#cfc8ba" : "#c4b9a6", "#a89c88", { rough: 0.85 });
  k.add(plane(5, D - 22), path, gx, 0.012, 6, 0, { rx: -Math.PI / 2, shadow: false });
  // ---------- the buildings along the back ----------
  const floors = college ? 3 + (sd >= 8 ? 1 : 0) : 2 + (sd >= 7 ? 1 : 0);
  const wallCol = college ? (sd >= 6 ? "#eceae4" : "#e2d8c6") : ["#e9dfc9", "#d9c7a8", "#c97b5a", "#e6e2d8", "#cfc3ad"][Math.floor(r() * 5)];
  const mainW = Math.round(W * 0.48),
    mainD = 14;
  const mainX = -W / 2 + 5 + mainW / 2,
    mainZ = -D / 2 + 5 + mainD / 2;
  building(k, mainX, mainZ, mainW, mainD, floors, { wall: wallCol, acc: ca, glassy: college && sd >= 5, roof: !college && r() < 0.5 ? "#6b4a3a" : undefined, name: college ? "Lecture block" : "Classrooms", door: 0 });
  k.spot("enter:corridor", college ? "Into the lecture block" : "Into the classrooms", mainX, mainZ + mainD / 2 + 1.6, { r: 1.5, y: 2.2 });
  const canW = Math.round(W * 0.2),
    canD = 14;
  const canX = W / 2 - 5 - canW / 2,
    canZ = -D / 2 + 5 + canD / 2;
  building(k, canX, canZ, canW, canD, college ? 2 : 1, { wall: wallCol, acc: cb === "#ffffff" || cb === "#f4f1ea" ? ca : cb, glassy: college, name: college ? "Student cafe" : "Canteen", door: 0 });
  k.spot("enter:canteen", college ? "Into the student cafe" : "Into the canteen", canX, canZ + canD / 2 + 1.6, { r: 1.5, y: 2.2 });
  if (college) {
    // the library between them: no way in, just a fine building to walk past
    const libX = (mainX + mainW / 2 + canX - canW / 2) / 2,
      libW = canX - canW / 2 - (mainX + mainW / 2) - 6;
    if (libW > 8) building(k, libX, mainZ + 2, libW, 18, 2, { wall: "#d7cfc0", acc: "#2f3338", glassy: sd >= 7, name: "Library" });
  }
  // ---------- the pitch, in front of the buildings on the far side from the gate ----------
  const pw = Math.round(college ? 64 + sd * 1.4 : 50 + sd * 1.3),
    pd = Math.round(college ? 40 + sd * 0.8 : 32 + sd * 0.7);
  const pcx = -W / 2 + 6 + pw / 2,
    pcz = D / 2 - 6 - pd / 2;
  if (college && sd >= 8) {
    // a running track round it
    k.add(plane(pw + 16, pd + 16), mat("#a5462f", { rough: 0.9 }), pcx, 0.006, pcz, 0, { rx: -Math.PI / 2, shadow: false });
  }
  pitch(k, pcx, pcz, pw, pd, { dust: dusty });
  if (college) stand(k, pcx, pcz - pd / 2 - 4.5, pw * 0.55, 4 + Math.floor(sd / 3), 1, ca, cb, sd >= 7);
  else {
    // a couple of benches along the side and a coach's shelter at the better schools
    for (const sx of [-1, 1]) {
      k.box(2.2, 0.45, 0.5, mat("#8a6a4a", { rough: 0.7 }), pcx + sx * 8, 0.25, pcz - pd / 2 - 2.5);
      k.block(pcx + sx * 8, pcz - pd / 2 - 2.5, 1.1, 0.3);
    }
    if (sd >= 6) {
      k.box(5, 2.2, 1.4, mat(ca, { rough: 0.5 }), pcx, 1.1, pcz - pd / 2 - 3.2);
      k.block(pcx, pcz - pd / 2 - 3.2, 2.5, 0.7);
    }
  }
  // ---------- around the rest: trees, a flagpole, a court at the better places ----------
  const ex = W / 2 - 12;
  for (let i = 0; i < 6; i++) tree(k, -W / 2 + 3 + r() * 4, -D / 2 + 26 + i * ((D - 34) / 6), 0.9 + r() * 0.3);
  for (let i = 0; i < 4; i++) tree(k, ex + (i % 2) * 6, 2 + Math.floor(i / 2) * 10, 1 + r() * 0.2, college ? "#2f6b3a" : "#3d6b35");
  k.add(cyl(0.07, 0.07, 9, 8), mat("#c8ccd2", { metal: 0.7, rough: 0.3 }), gx - 8, 4.5, D / 2 - 6);
  k.add(plane(1.8, 1.1), mat(ca, { side: THREE.DoubleSide }), gx - 7.1, 8.3, D / 2 - 6, 0, { shadow: false });
  k.circle(gx - 8, D / 2 - 6, 0.2);
  if (sd >= 5 && !college) {
    // a basketball court
    const bx = ex - 4,
      bz = -D / 2 + 30;
    k.add(plane(14, 9), mat("#3b6fa8", { rough: 0.8 }), bx, 0.01, bz, 0, { rx: -Math.PI / 2, shadow: false });
    for (const sx of [-1, 1]) {
      k.add(cyl(0.06, 0.06, 3, 8), mat("#2a2c30"), bx + sx * 7, 1.5, bz);
      k.box(1.2, 0.8, 0.05, mat("#f4f4f4"), bx + sx * 6.8, 3, bz, Math.PI / 2);
      k.circle(bx + sx * 7, bz, 0.15);
    }
  }
  if (college) {
    // the quad: a square of grass with paths across it and benches
    const qx = ex - 6,
      qz = -D / 2 + 34;
    k.add(plane(20, 20), mat("#6aa156", { rough: 1 }), qx, 0.008, qz, 0, { rx: -Math.PI / 2, shadow: false });
    k.add(plane(2, 20), path, qx, 0.012, qz, 0, { rx: -Math.PI / 2, shadow: false });
    k.add(plane(20, 2), path, qx, 0.012, qz, 0, { rx: -Math.PI / 2, shadow: false });
    for (const [bx, bz] of [
      [-5, -5],
      [5, 5],
    ]) {
      k.box(1.8, 0.45, 0.5, mat("#6a5a4a", { rough: 0.7 }), qx + bx, 0.25, qz + bz);
      k.block(qx + bx, qz + bz, 0.9, 0.3);
    }
    // on the quad: one on a bench with a book, one standing by the path
    k.crowd(qx - 5.3, qz - 5 + 0.05, 0, { sit: true, seat: 0.48, sx: qx - 5.3, sz: qz - 3.8 });
    k.crowd(qx + 2.2, qz - 1.6, -0.8, { sx: qx + 1.4, sz: qz - 0.9 });
  }
  // ---------- the little things: lamp posts along the path, benches, bins, bike racks, flower beds ----------
  furnish(k, gx, D, mainX, mainZ + mainD / 2, canX, canZ + canD / 2, college);
  // where people hang about: by the classroom door, by the canteen, on a bench by the path, watching the pitch
  k.group(mainX - 9, mainZ + mainD / 2 + 5.5, 2, 0.7, 0.6);
  k.group(canX - 7.5, canZ + canD / 2 + 5, 2, 0.7, 2.2);
  k.crowd(gx - 5.55, D / 2 - 16, Math.PI / 2, { sit: true, seat: 0.5, sx: gx - 4.2, sz: D / 2 - 16 });
  k.crowd(pcx + pw / 2 - 6, pcz - pd / 2 - 2.2, 0.2);
  // ---------- his own: extra sessions along the touchline, nearest the gate ----------
  if (inst.mine) {
    const ids = Object.keys(k.st.training.sessions).filter((id) => id !== "rest");
    ids.forEach((id, i) => {
      k.spot("session:" + id, k.st.training.sessions[id].label, pcx + pw / 2 - 4 - i * ((pw - 8) / Math.max(1, ids.length - 1)), pcz + pd / 2 + 3, { r: 1.3, y: 1.6 });
    });
  }
  return k.finish({
    w: W,
    d: D,
    spawn: [gx, D / 2 - 3.2],
    mood: "cool",
    outdoor: true,
    light: outdoorLight(k.night, weatherOf(k)),
    accent: ca,
    cam: { dist: 9.5, height: 6.4 },
    cell: 0.8,
    apron: college ? "#56804a" : "#5f8550",
  });
}

function furnish(k: Kit, gx: number, D: number, ax: number, az: number, bx: number, bz: number, college: boolean) {
  const steel = mat("#3a3f46", { metal: 0.6, rough: 0.4 });
  const lampOn = k.night > 0.5;
  for (let i = 0; i < 4; i++) {
    const z = D / 2 - 10 - i * ((D - 30) / 4);
    for (const sx of [-3.4, 3.4]) {
      if ((i + (sx > 0 ? 1 : 0)) % 2) continue;
      k.add(cyl(0.07, 0.09, 4.2, 8), steel, gx + sx, 2.1, z);
      k.add(sphere(0.26, 12), glow("#fff2d4", lampOn ? 2.2 : 0.7), gx + sx, 4.3, z);
      k.circle(gx + sx, z, 0.15);
      if (lampOn) k.pool(gx + sx, z, 3.2, "#ffd9a0", 0.3);
    }
  }
  // benches facing the path, bins beside them
  for (let i = 0; i < 3; i++) {
    const z = D / 2 - 16 - i * 14;
    k.box(1.8, 0.08, 0.5, mat("#8a6a4a", { rough: 0.7 }), gx - 5.4, 0.46, z, Math.PI / 2);
    k.box(0.08, 0.45, 1.6, steel, gx - 5.2, 0.22, z);
    k.block(gx - 5.4, z, 0.3, 0.9);
    k.add(cyl(0.26, 0.24, 0.9, 12), mat("#2f6b3a", { rough: 0.6 }), gx - 5.4, 0.45, z + 1.6);
    k.circle(gx - 5.4, z + 1.6, 0.3);
  }
  // flower beds by the two doors, a bike rack by the classrooms
  for (const [x, z] of [
    [ax - 4.5, az + 1.2],
    [ax + 4.5, az + 1.2],
    [bx - 4, bz + 1.2],
    [bx + 4, bz + 1.2],
  ]) {
    k.box(3.2, 0.4, 1.0, mat("#b8b2a6", { rough: 0.8 }), x, 0.2, z);
    for (let i = 0; i < 5; i++) k.add(sphere(0.22, 7), mat(["#d94a6a", "#f2c94c", "#ffffff", "#e8833a", "#9b5de5"][i % 5], { rough: 0.8, flat: true }), x - 1.2 + i * 0.6, 0.55, z);
    k.block(x, z, 1.6, 0.5);
  }
  if (!college) {
    for (let i = 0; i < 6; i++) {
      k.add(cyl(0.025, 0.025, 0.9, 6), steel, ax + 8 + i * 0.7, 0.45, az + 2.4, 0, { rz: Math.PI / 2 });
      k.add(cyl(0.3, 0.3, 0.05, 14, true), steel, ax + 8 + i * 0.7, 0.4, az + 2.4, Math.PI / 2, { rx: Math.PI / 2 });
    }
    k.block(ax + 9.75, az + 2.4, 2.2, 0.3);
  }
}

/** a club's training ground, in the club's colours and scaled to the club */
export function clubGround(k: Kit, p: WorldPlace, st: CareerState): Room {
  const inst = p.inst!;
  const sd = inst.standing;
  const r = seeded(String(inst.seed) + "tg");
  const [ca, cb] = inst.cols;
  // wide enough for two columns of full size pitches with a clear gap before the main building
  const W = Math.round(204 + sd * 2),
    D = Math.round(112 + sd * 1.5);
  k.floor(W, D, surfMat("concrete", "#9fa59a", "#8a8f86", { rough: 0.95 }), 0, 0, 4);
  k.add(plane(W - 2, D - 2), mat("#4f7f45", { rough: 1 }), 0, 0.004, 0, 0, { rx: -Math.PI / 2, shadow: false });
  const gx = W / 2 - 18;
  perimeter(k, W, D, gx, 3.2, "#3d5a3a", 9);
  for (const sx of [-1, 1]) k.box(0.6, 3.8, 0.6, mat(ca, { rough: 0.5 }), gx + sx * 4.8, 1.9, D / 2 - 0.3);
  k.text(p.name.toUpperCase(), cb, ca, gx, 4.6, D / 2 - 0.3, Math.min(16, p.name.length * 0.42 + 2), 0.9, Math.PI);
  k.spot("door", "Back to the street", gx, D / 2 - 1.6, { r: 1.4, y: 1.8 });
  // ---------- the pitches: two to four, laid out from the far corner ----------
  const n = sd >= 8 ? 4 : sd >= 5 ? 3 : 2;
  const pw = 62,
    pd = 40;
  const spots: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const col = i % 2,
      row = Math.floor(i / 2);
    spots.push([-W / 2 + 6 + pw / 2 + col * (pw + 8), -D / 2 + 6 + pd / 2 + row * (pd + 8)]);
  }
  spots.forEach(([x, z], i) => pitch(k, x, z, pw, pd, { nets: i < 2 }));
  // floodlights round the first pitch at the bigger clubs
  if (sd >= 7)
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const [x0, z0] = spots[0];
        k.add(cyl(0.18, 0.25, 16, 8), mat("#9aa3ad", { metal: 0.6, rough: 0.4 }), x0 + sx * (pw / 2 + 3), 8, z0 + sz * (pd / 2 + 3));
        k.box(3.2, 1.4, 0.4, glow("#f4f6ff", k.night > 0.5 ? 1.6 : 0.5), x0 + sx * (pw / 2 + 3), 16.3, z0 + sz * (pd / 2 + 3), sx * 0.4);
        k.circle(x0 + sx * (pw / 2 + 3), z0 + sz * (pd / 2 + 3), 0.35);
      }
  // ---------- the main building on the gate side: glass, the club's colours, doors to the rooms ----------
  const bx = W / 2 - 22,
    bw = 34,
    bd = 46;
  const bz = -D / 2 + 8 + bd / 2;
  const floors = sd >= 6 ? 2 : 1;
  const H = floors * 3.6;
  k.box(bw, H, bd, mat("#eef0ec", { rough: 0.7 }), bx, H / 2, bz, 0, 0.05);
  k.block(bx, bz, bw / 2, bd / 2);
  // glass in bands per floor all round (the front faces the pitches, -x), mullions on the front
  const gl = glass("#5a7a98", 0.8);
  for (let f = 0; f < floors; f++) {
    const y = 1.9 + f * 3.6;
    k.add(plane(bd - 2, 2.9), gl, bx - bw / 2 - 0.03, y, bz, -Math.PI / 2, { shadow: false });
    k.add(plane(bd - 2, 2.9), gl, bx + bw / 2 + 0.03, y, bz, Math.PI / 2, { shadow: false });
    for (const sz of [-1, 1]) k.add(plane(bw - 2, 2.9), gl, bx, y, bz + sz * (bd / 2 + 0.03), sz > 0 ? 0 : Math.PI, { shadow: false });
    for (let i = 0; i <= 12; i++) k.box(0.1, 2.9, 0.1, mat("#2a2e34", { metal: 0.5, rough: 0.3 }), bx - bw / 2 - 0.06, y, bz - (bd - 2) / 2 + (i * (bd - 2)) / 12);
  }
  // a band in the club's colour over the ground floor glass
  k.box(0.3, 0.6, bd, mat(ca, { rough: 0.5 }), bx - bw / 2 - 0.12, 3.65, bz);
  // a grey roof with a fascia in the club's colour round its edge
  k.box(bw + 0.2, 0.4, bd + 0.2, mat("#5f646b", { rough: 0.85 }), bx, H + 0.2, bz);
  for (const sz of [-1, 1]) k.box(bw + 0.6, 0.7, 0.3, mat(ca, { rough: 0.5 }), bx, H + 0.35, bz + sz * (bd / 2 + 0.25));
  for (const sx of [-1, 1]) k.box(0.3, 0.7, bd + 0.8, mat(ca, { rough: 0.5 }), bx + sx * (bw / 2 + 0.25), H + 0.35, bz);
  k.text(p.name.toUpperCase(), "#ffffff", ca, bx - bw / 2 - 0.08, H - 0.8, bz, Math.min(bd * 0.6, p.name.length * 0.6 + 3), 1.0, -Math.PI / 2);
  // the doors along the glass front: dressing room, gym, physio, canteen
  const rooms: [string, string][] = [
    ["changing", "Into the dressing room"],
    ["gym", "Into the gym"],
    ["physio", "Physio and recovery"],
    ["canteen", "Into the canteen"],
  ];
  rooms.forEach(([id, label], i) => {
    const z = bz - bd / 2 + 6 + i * ((bd - 12) / 3);
    k.box(0.12, 2.8, 2.2, mat("#14171c", { rough: 0.3 }), bx - bw / 2 - 0.06, 1.4, z);
    k.box(1.0, 0.25, 2.8, mat(ca, { rough: 0.5 }), bx - bw / 2 - 0.5, 3.05, z);
    k.spot("enter:" + id, label, bx - bw / 2 - 1.8, z, { r: 1.4, y: 2.2 });
  });
  // ---------- the car park by the gate: bays, the squad's cars, his own when he has one ----------
  const cpx = W / 2 - 22,
    cpz = D / 2 - 18;
  k.add(plane(36, 22), mat("#2b2e33", { rough: 0.9 }), cpx, 0.01, cpz, 0, { rx: -Math.PI / 2, shadow: false });
  const bayLine = mat("#e8e8e4", { rough: 0.8 });
  for (let i = 0; i <= 10; i++) k.add(plane(0.1, 5), bayLine, cpx - 15 + i * 3, 0.016, cpz - 6, 0, { rx: -Math.PI / 2, shadow: false });
  const cars = squadCars(st, sd, r);
  cars.forEach((c, i) => {
    const v = makeVehicle(c);
    k.own.push({ dispose: () => v.userData.dispose?.() });
    k.still(v, cpx - 13.5 + i * 3, 0, cpz - 6, Math.PI);
    k.block(cpx - 13.5 + i * 3, cpz - 6, 1.0, 2.3);
    if (c.mine) k.spot("mycar", c.brand + " " + c.model + " (yours)", cpx - 13.5 + i * 3, cpz - 2.4, { ax: cpx - 13.5 + i * 3, az: cpz - 6, y: 1.5, r: 1.4, tag: false });
  });
  // the squad between sessions: by the building and at the corner of the first pitch
  k.group(bx - bw / 2 - 7, bz - bd / 2 + 6 + (bd - 12) / 6, 2, 0.75, 1.2);
  k.crowd(spots[0][0] + pw / 2 + 2.5, spots[0][1] + pd / 2 - 4, -Math.PI / 2);
  k.crowd(spots[0][0] + pw / 2 + 2.6, spots[0][1] + pd / 2 - 5.4, -Math.PI / 2 - 0.3);
  // trees along the fence and a club crest in the grass by the building
  for (let i = 0; i < 8; i++) tree(k, W / 2 - 4, -D / 2 + 8 + i * ((D - 40) / 8), 1.1 + r() * 0.3, "#2f5f33");
  k.add(cyl(3.2, 3.2, 0.03, 32), mat(ca, { rough: 0.8 }), bx - bw / 2 - 8, 0.02, bz + bd / 2 + 6, 0, { shadow: false });
  k.add(cyl(2.4, 2.4, 0.03, 32), mat(cb, { rough: 0.8 }), bx - bw / 2 - 8, 0.03, bz + bd / 2 + 6, 0, { shadow: false });
  // his own: extra sessions on the first pitch, along its near touchline
  if (inst.mine) {
    const ids = Object.keys(st.training.sessions).filter((id) => id !== "rest");
    const [x0, z0] = spots[0];
    ids.forEach((id, i) => {
      k.spot("session:" + id, st.training.sessions[id].label, x0 - pw / 2 + 6 + i * ((pw - 12) / Math.max(1, ids.length - 1)), z0 + pd / 2 + 3, { r: 1.3, y: 1.6 });
    });
  }
  return k.finish({
    w: W,
    d: D,
    spawn: [gx, D / 2 - 3.2],
    mood: "cool",
    outdoor: true,
    light: outdoorLight(k.night, weatherOf(k)),
    accent: ca,
    cam: { dist: 10, height: 6.6 },
    cell: 0.8,
    apron: "#4a7542",
  });
}
/** the cars in the club car park: his own first (if he has one), then the squad's, flashier at the big clubs */
function squadCars(st: CareerState, sd: number, r: () => number) {
  const out: { body: string; colour: string; brand?: string; model?: string; mine?: boolean }[] = [];
  const daily = st.life.car;
  if (daily) {
    const cat = st.life.catalog?.cars.find((c) => c.id === daily.id);
    out.push({ body: cat?.body || daily.body, colour: cat?.colour || daily.colour, brand: cat?.brand || daily.brand, model: cat?.model || daily.model, mine: true });
  }
  const pool = sd >= 8 ? ["suv", "sports", "coupe", "suv", "hyper", "saloon"] : sd >= 5 ? ["suv", "saloon", "coupe", "hatch", "suv"] : ["hatch", "saloon", "hatch", "suv"];
  const cols = sd >= 7 ? ["#111111", "#f4f4f4", "#1d2733", "#8a8f96", "#c8102e", "#2b3b55"] : ["#9aa0a6", "#2b3b55", "#e8e4dc", "#5a5f66", "#7a2a2a"];
  const n = 5 + Math.floor(sd / 3);
  while (out.length < n) out.push({ body: pool[Math.floor(r() * pool.length)], colour: cols[Math.floor(r() * cols.length)] });
  return out;
}

// ---------- the rooms inside ----------
export function campusRoom(k: Kit, p0: WorldPlace, sub: string): Room {
  // the room's place carries "Name, room" for the HUD; signs inside show the place's own name
  const p = { ...p0, name: p0.name.split(", ")[0] };
  const inst = p.inst!;
  const [ca, cb] = inst.cols;
  const club = p.kind === "training";
  const college = p.kind === "college";
  const r = seeded(String(inst.seed) + sub);
  if (sub === "corridor") {
    const W = 30,
      D = 7,
      H = 3.4;
    k.floor(W, D, surfMat("terrazzo", "#d9d4ca", "#b9b2a4", { rough: 0.4 }), 0, 0, 2);
    const wallM = mat("#eee9dd", { rough: 0.9 });
    const walls = k.shell(W, D, H, wallM, { skip: ["s"] });
    k.wall(W / 2, D / 2, -W / 2, D / 2, H, wallM, {});
    k.mount(walls.n!, rbox(W, 0.18, 0.03, 0.01), mat(ca, { rough: 0.5 }), 0, 1.05, 0.12);
    // along the far wall: classroom doors with lockers in the school's colours between them
    const doorX = [-11, -3.5, 4, 11.5];
    doorX.forEach((x, i) => {
      k.mount(walls.n!, rbox(1.2, 2.3, 0.06, 0.01), mat(i === 1 ? "#6b4a2e" : "#8a6a4a", { rough: 0.6 }), x, 1.15, 0.08);
      k.mount(walls.n!, rbox(0.4, 0.5, 0.02, 0.005), glass("#cfe0ee", 0.6), x, 1.75, 0.12);
      k.text((college ? "ROOM " : "CLASS ") + (i + 1), "#1a1a1a", "#f4f4f4", x, 2.55, -D / 2 + 0.16, 1.0, 0.22, 0);
    });
    for (let g = 0; g < doorX.length - 1; g++) {
      const a = doorX[g] + 1.1,
        b = doorX[g + 1] - 1.1;
      const n = Math.floor((b - a) / 0.6);
      for (let i = 0; i < n; i++) {
        const x = a + 0.3 + i * 0.6;
        k.inst("locker", () => rbox(0.56, 1.9, 0.45, 0.01), mat("#ffffff", { rough: 0.5, metal: 0.2 }), x, 0.95, -D / 2 + 0.3, { col: i % 2 ? ca : cb === "#ffffff" || cb === "#f4f1ea" ? "#c8ccd2" : cb });
        k.inst("lockerhandle", () => rbox(0.04, 0.2, 0.03, 0.005), mat("#c8ccd2", { metal: 0.9, rough: 0.2 }), x + 0.18, 1.1, -D / 2 + 0.54, { col: "#c8ccd2" });
      }
      k.block((a + b) / 2, -D / 2 + 0.3, (b - a) / 2, 0.28);
    }
    k.spot("enter:classroom", college ? "Into room 2" : "Into class 2", -3.5, -D / 2 + 1.4, { r: 1.2, y: 2.2 });
    k.crowd(0.1, -D / 2 + 1.05, 0.5, { sx: 0.6, sz: 0.4 });
    k.crowd(1.2, -D / 2 + 1.15, -0.6, { sx: 1.4, sz: 0.5 });
    // the end wall: the notice board, the trophy cabinet, the school's name
    k.mount(walls.w!, rbox(3.2, 1.4, 0.04, 0.01), mat("#b88a5a", { rough: 0.8 }), -1.2, 1.6, 0.1);
    for (let i = 0; i < 6; i++) k.mount(walls.w!, rbox(0.5, 0.6, 0.02, 0.005), mat(["#ffffff", "#ffe08a", "#bfe3ff", "#ffc7c7"][i % 4]), -2.3 + (i % 3) * 1.0, 1.85 - Math.floor(i / 3) * 0.7, 0.13);
    k.box(0.5, 2.0, 2.2, glass("#c8dce8", 0.5), -W / 2 + 0.35, 1.0, 1.8);
    for (let i = 0; i < 3; i++) k.add(cyl(0.12, 0.08, 0.35, 10), mat("#d4af37", { metal: 0.9, rough: 0.25 }), -W / 2 + 0.35, 1.2, 1.1 + i * 0.7);
    k.block(-W / 2 + 0.35, 1.8, 0.3, 1.1);
    k.text(p.name.toUpperCase(), cb === "#ffffff" ? ca : "#ffffff", cb === "#ffffff" ? "#f4f4f4" : ca, 0, 2.7, -D / 2 + 0.16, 6, 0.42, 0);
    k.spot("back", "Back outside", W / 2 - 1.6, 0, { r: 1.3, y: 1.8 });
    for (let i = 0; i < 4; i++) k.spotLamp(-W / 2 + 4 + i * 7.5, H - 0.1, 0, "#f4f6ff", { r: 0.5, pool: 0.12 });
    return k.finish({ w: W, d: D, spawn: [W / 2 - 3, 0.6], mood: "cool", light: shopLight({ hemi: 0.8, keyI: 0.7, points: [{ x: 0, y: 3, z: 0, col: "#f4f6ff", i: 6, dist: 30 }] }), accent: ca });
  }
  if (sub === "classroom") {
    // deep enough for a walkway behind the last row, so he can get to the door at the back
    const W = college ? 16 : 11,
      D = college ? 14.5 : 11,
      H = 3.4;
    k.floor(W, D, surfMat(college ? "carpet" : "wood", college ? "#5a5f6a" : "#b8936a", college ? "#4a4f5a" : "#9a7a58", { rough: 0.8 }), 0, 0, 2);
    const wallM = mat("#f2eee4", { rough: 0.9 });
    const walls = k.shell(W, D, H, wallM, { skip: ["s"] });
    k.wall(W / 2, D / 2, -W / 2, D / 2, H, wallM, {});
    // the board at the front, the teacher's desk
    k.mount(walls.n!, rbox(college ? 6 : 4.2, 1.4, 0.05, 0.01), mat("#f8f8f6", { rough: 0.2 }), 0, 1.7, 0.1);
    const lesson = college ? ["MATCH LOAD AND RECOVERY", "Sleep, food, the next 48 hours"] : [["ALGEBRA", "Solve for x"], ["THE WATER CYCLE", "Evaporation, clouds, rain"], ["THE FIRST WORLD WAR", "Causes"]][Math.floor(r() * 3)];
    k.text(lesson[0], "#1a3a6a", "#f8f8f6", 0, 2.05, -D / 2 + 0.16, college ? 4.6 : 3.4, 0.36, 0);
    k.text(lesson[1], "#3a3a3a", "#f8f8f6", 0, 1.55, -D / 2 + 0.16, college ? 4.2 : 3.0, 0.26, 0);
    k.box(1.6, 0.76, 0.7, mat("#6b4a2e", { rough: 0.6 }), W / 2 - 2.0, 0.38, -D / 2 + 1.5);
    k.block(W / 2 - 2.0, -D / 2 + 1.5, 0.8, 0.35);
    // the desks: rows facing the board either side of an aisle down the middle
    const colsX = college ? [-6.2, -4.4, -2.6, 2.6, 4.4, 6.2] : [-3.7, -1.75, 1.75, 3.7];
    const rowsZ = college ? [-3.8, -2.0, -0.2, 1.6, 3.4] : [-2.4, -1.0, 0.4, 1.8];
    const deskW = college ? 1.5 : 1.1;
    const wood = mat("#d8c8a8", { rough: 0.6 }),
      steel = mat("#5a5f66", { metal: 0.6, rough: 0.4 });
    for (const z of rowsZ)
      for (const x of colsX) {
        k.inst("desktop", () => rbox(deskW, 0.05, 0.55, 0.01), wood, x, 0.74, z, { col: "#d8c8a8" });
        for (const [lx, lz] of [
          [-deskW / 2 + 0.06, -0.22],
          [deskW / 2 - 0.06, -0.22],
          [-deskW / 2 + 0.06, 0.22],
          [deskW / 2 - 0.06, 0.22],
        ])
          k.inst("deskleg", () => cyl(0.02, 0.02, 0.72, 6), steel, x + lx, 0.36, z + lz, { col: "#5a5f66" });
        // the chair behind it: a seat, a back, four legs
        k.inst("seat", () => rbox(0.42, 0.05, 0.4, 0.01), mat(ca, { rough: 0.6 }), x, 0.45, z + 0.55, { col: ca });
        k.inst("seatback", () => rbox(0.42, 0.36, 0.04, 0.01), mat(ca, { rough: 0.6 }), x, 0.7, z + 0.76, { col: ca });
        for (const [lx, lz] of [
          [-0.18, 0.37],
          [0.18, 0.37],
          [-0.18, 0.73],
          [0.18, 0.73],
        ])
          k.inst("chairleg", () => cyl(0.015, 0.015, 0.45, 6), steel, x + lx, 0.22, z + lz, { col: "#5a5f66" });
        k.block(x, z + 0.25, deskW / 2 + 0.05, 0.55);
      }
    // windows down one side
    for (let i = 0; i < 3; i++) k.mount(walls.e!, rbox(1.8, 1.4, 0.04, 0.01), glow("#cfe8ff", 0.8), -D / 2 + 2 + i * (D / 3), 1.8, 0.1);
    // the class: in the aisle seats, facing the board (not his own row)
    const mid = Math.floor(rowsZ.length / 2);
    const inner = colsX.filter((x) => Math.abs(x) === Math.min(...colsX.map(Math.abs)));
    rowsZ.forEach((z, ri) => {
      if (ri === mid) return;
      for (const x of inner) k.crowd(x, z + 0.68, Math.PI, { sit: true, seat: 0.475, sx: Math.sign(x) * 0.55, sz: z + 0.5 });
    });
    // his seat: in the aisle by the middle rows
    k.spot("class", college ? "Find a seat for the lecture" : "Take your seat", 0, rowsZ[Math.floor(rowsZ.length / 2)] + 0.4, { r: 1.3, y: 1.6 });
    k.spot("back:corridor", "Back to the corridor", -W / 2 + 1.2, D / 2 - 1.1, { r: 1.1, y: 1.8 });
    k.spotLamp(0, H - 0.1, 0, "#f4f6ff", { r: 0.6, pool: 0.15 });
    return k.finish({ w: W, d: D, spawn: [0, D / 2 - 1.1], mood: "cool", light: shopLight({ hemi: 0.85, keyI: 0.8, points: [{ x: 0, y: 3, z: 0, col: "#f4f6ff", i: 6, dist: 20 }] }), accent: ca });
  }
  if (sub === "canteen") {
    const W = 18,
      D = 13,
      H = 3.6;
    k.floor(W, D, surfMat(club ? "epoxy" : "tile", club ? "#e8eae6" : "#e4ddd0", club ? "#cfd2cc" : "#cbbfab", { rough: 0.5 }), 0, 0, 2);
    const wallM = mat(club ? "#f4f5f2" : "#efe6d6", { rough: 0.9 });
    k.shell(W, D, H, wallM, { skip: ["s"] });
    k.wall(W / 2, D / 2, -W / 2, D / 2, H, wallM, {});
    // the counter with trays and the menu board
    k.box(W - 6, 1.0, 0.9, mat("#c8ccd2", { metal: 0.6, rough: 0.3 }), -1, 0.5, -D / 2 + 1.4);
    k.block(-1, -D / 2 + 1.4, (W - 6) / 2, 0.5);
    for (let i = 0; i < 8; i++) k.inst("tray", () => rbox(0.45, 0.04, 0.32, 0.01), mat("#2a2c30"), -W / 2 + 4 + i * 1.3, 1.03, -D / 2 + 1.4, { col: ["#e8c040", "#7ab36a", "#d9774a", "#f4f1ea"][i % 4] });
    k.text(club ? "TODAY: SALMON, RICE, GREENS" : college ? "TODAY: PASTA, CURRY, SALADS" : "TODAY: DAL, RICE, ROTI, FRUIT", "#ffffff", club ? ca : "#2a2c30", -1, 2.6, -D / 2 + 0.16, 7, 0.5, 0);
    // long tables with benches
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 2; j++) {
        const x = -W / 2 + 4 + j * 8,
          z = -1 + i * 2.6;
        k.box(5, 0.06, 1.0, mat(club ? "#f4f4f4" : "#c89a6a", { rough: 0.5 }), x, 0.76, z);
        for (const sz of [-0.75, 0.75]) k.box(5, 0.06, 0.35, mat(club ? ca : "#8a6a4a", { rough: 0.6 }), x, 0.46, z + sz);
        k.block(x, z, 2.5, 1.0);
      }
    for (const [x, z, f] of [
      [-W / 2 + 4 + 1.9, -1 + 0.85, Math.PI],
      [-W / 2 + 12 - 1.9, 1.6 - 0.85, 0],
      [-W / 2 + 4 + 1.9, 4.2 + 0.85, Math.PI],
    ] as [number, number, number][])
      k.crowd(x, z, f, { sit: true, seat: 0.49, sx: x < -W / 2 + 8 ? -W / 2 + 7.2 : -W / 2 + 8.8, sz: z });
    k.crowd(-W / 2 + 12 - 1.9, 4.2 - 0.85, 0, { sit: true, seat: 0.49, sx: -W / 2 + 8.8, sz: 4.2 - 0.85 });
    if (club) k.text(p.name.toUpperCase(), "#ffffff", ca, W / 2 - 0.16, 2.4, 0, 6, 0.6, -Math.PI / 2);
    k.spot("canteen", club ? "Team lunch" : college ? "Grab lunch" : "Lunch with the others", -1, -D / 2 + 2.8, { r: 1.3, y: 1.6 });
    k.spot("back", "Back outside", W / 2 - 1.6, D / 2 - 1.4, { r: 1.2, y: 1.8 });
    plant(k, -W / 2 + 0.7, D / 2 - 0.7, 1.1);
    return k.finish({ w: W, d: D, spawn: [W / 2 - 2.4, D / 2 - 1.8], mood: "warm", light: shopLight({ warm: true, hemi: 0.8, keyI: 0.8, points: [{ x: 0, y: 3, z: 0, col: "#ffe6c0", i: 7, dist: 24 }] }), accent: ca });
  }
  if (sub === "gym") {
    const W = 24,
      D = 15,
      H = 4.4;
    k.floor(W, D, surfMat("rubber", "#33363b", "#2a2d31", { rough: 0.9 }), 0, 0, 2);
    const wallM = mat("#e4e7ea", { rough: 0.8 });
    const walls = k.shell(W, D, H, wallM, { skip: ["s"] });
    k.wall(W / 2, D / 2, -W / 2, D / 2, H, wallM, {});
    // a mirror along the back, a band in the club's colour, the club's name over it
    k.mount(walls.n!, rbox(W - 2, 2.2, 0.03, 0.01), mat("#c8d2dc", { rough: 0.05, metal: 0.9 }), 0, 1.5, 0.1);
    k.mount(walls.n!, rbox(W, 0.5, 0.03, 0.01), mat(ca, { rough: 0.5 }), 0, 3.0, 0.11);
    k.text(p.name.toUpperCase(), "#ffffff", ca, 0, 3.0, -D / 2 + 0.16, Math.min(12, p.name.length * 0.42 + 2), 0.42, 0);
    for (const wg of [walls.w!, walls.e!]) k.mount(wg, rbox(D, 0.5, 0.03, 0.01), mat(ca, { rough: 0.5 }), 0, 3.0, 0.11);
    const steel = mat("#2a2d31", { metal: 0.7, rough: 0.35 }),
      chrome = mat("#c8ccd2", { metal: 1, rough: 0.2 }),
      pad = mat(ca, { rough: 0.6 });
    // power racks: four posts, the bar with plates on it, a bench in front
    for (let i = 0; i < 3; i++) {
      const x = -W / 2 + 3 + i * 4;
      for (const sx of [-0.6, 0.6]) for (const sz of [-0.5, 0.5]) k.add(cyl(0.05, 0.05, 2.4, 8), steel, x + sx, 1.2, -3 + sz);
      k.box(1.3, 0.06, 1.1, steel, x, 2.4, -3);
      k.add(cyl(0.025, 0.025, 2.0, 8), chrome, x, 1.4, -2.55, 0, { rz: Math.PI / 2 });
      for (const sx of [-0.85, 0.85]) k.add(cyl(0.22, 0.22, 0.06, 18), mat("#111214", { rough: 0.6 }), x + sx, 1.4, -2.55, 0, { rz: Math.PI / 2 });
      k.box(0.35, 0.42, 1.2, pad, x, 0.21, -1.6);
      k.block(x, -2.6, 0.75, 1.05);
    }
    // a dumbbell rack along the mirror
    k.box(6, 0.8, 0.6, steel, 5, 0.4, -D / 2 + 0.6);
    for (let i = 0; i < 12; i++) k.inst("dumbbell", () => cyl(0.07, 0.07, 0.32, 10), mat("#111214", { rough: 0.5 }), 2.3 + i * 0.48, 0.88, -D / 2 + 0.6, { rz: Math.PI / 2, col: "#1a1b1e" });
    k.block(5, -D / 2 + 0.6, 3, 0.35);
    // treadmills with lit consoles, bikes, a row of benches
    for (let i = 0; i < 4; i++) {
      const x = 3 + i * 2.1;
      k.box(0.8, 0.22, 1.9, steel, x, 0.11, 1.8);
      k.box(0.7, 0.04, 1.6, mat("#111214", { rough: 0.9 }), x, 0.24, 1.8);
      for (const sx of [-0.35, 0.35]) k.add(cyl(0.03, 0.03, 1.2, 8), steel, x + sx, 0.75, 0.95);
      k.box(0.8, 0.35, 0.12, steel, x, 1.4, 0.95);
      k.add(plane(0.5, 0.22), glow(ca, 0.9), x, 1.42, 1.02, 0, { shadow: false });
      k.block(x, 1.8, 0.42, 1.0);
    }
    for (let i = 0; i < 3; i++) {
      const x = -W / 2 + 3 + i * 2.2;
      k.box(0.5, 0.6, 1.2, steel, x, 0.3, 4.4);
      k.box(0.3, 0.08, 0.4, pad, x, 0.95, 4.0);
      k.add(cyl(0.03, 0.03, 0.9, 8), steel, x, 1.0, 4.9);
      k.block(x, 4.4, 0.3, 0.6);
    }
    k.crowd(5, -D / 2 + 1.7, 0.2);
    k.crowd(-2.2, -2.2, -0.7);
    k.spot("clubgym", "Gym session with the fitness coach", -1.5, 1.4, { r: 1.4, y: 1.8 });
    k.spot("back", "Back outside", W / 2 - 1.6, D / 2 - 1.4, { r: 1.2, y: 1.8 });
    for (let i = 0; i < 3; i++) k.spotLamp(-8 + i * 8, H - 0.1, 0, "#f4f6ff", { r: 0.6, pool: 0.15 });
    return k.finish({ w: W, d: D, spawn: [W / 2 - 2.4, D / 2 - 1.8], mood: "cool", light: shopLight({ hemi: 0.95, keyI: 0.9, points: [{ x: 0, y: 4, z: 0, col: "#f4f6ff", i: 10, dist: 34 }] }), accent: ca });
  }
  if (sub === "changing") {
    const W = 16,
      D = 11,
      H = 3.4;
    k.floor(W, D, surfMat("epoxy", "#2a2d33", "#1f2227", { rough: 0.5 }), 0, 0, 2);
    const wallM = mat("#e9ebe7", { rough: 0.8 });
    const walls = k.shell(W, D, H, wallM, { skip: ["s"] });
    k.wall(W / 2, D / 2, -W / 2, D / 2, H, wallM, {});
    k.mount(walls.n!, rbox(W, 0.45, 0.03, 0.01), mat(ca, { rough: 0.5 }), 0, 3.0, 0.11);
    k.text(p.name.toUpperCase(), "#ffffff", ca, 0, 3.0, -D / 2 + 0.13, Math.min(12, p.name.length * 0.42 + 2), 0.4, 0);
    // the crest on the floor
    k.add(cyl(1.6, 1.6, 0.02, 32), mat(ca, { rough: 0.6 }), 0, 0.012, 0.3, 0, { shadow: false });
    k.add(cyl(1.1, 1.1, 0.02, 32), mat(cb, { rough: 0.6 }), 0, 0.02, 0.3, 0, { shadow: false });
    const st = k.st;
    const myNum = st.person.num || 9;
    const oak = mat("#8a6a4a", { rough: 0.6 }),
      cushion = mat(ca, { rough: 0.75 }),
      trim = mat(cb, { rough: 0.7 });
    // the places round three walls: a cubby, a padded bench, a shirt on its hanger with the number on the back
    let n = 0;
    for (const [x1, z1, x2, z2, ry] of [
      [-W / 2 + 0.35, -D / 2 + 1.2, -W / 2 + 0.35, D / 2 - 2.2, Math.PI / 2],
      [-W / 2 + 1.4, -D / 2 + 0.35, W / 2 - 1.4, -D / 2 + 0.35, 0],
      [W / 2 - 0.35, -D / 2 + 1.2, W / 2 - 0.35, D / 2 - 3.2, -Math.PI / 2],
    ] as [number, number, number, number, number][]) {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const cnt = Math.floor(len / 1.25);
      const inX = Math.sin(ry),
        inZ = Math.cos(ry);
      for (let i = 0; i < cnt; i++) {
        const t = (i + 0.5) / cnt;
        const x = x1 + (x2 - x1) * t,
          z = z1 + (z2 - z1) * t;
        const along = [Math.cos(ry), -Math.sin(ry)];
        // the cubby's side panels and its shelf
        for (const sd of [-0.6, 0.6]) k.inst("cubbyside", () => rbox(0.05, 2.3, 0.55, 0.01), oak, x + along[0] * sd + inX * 0.27, 1.15, z + along[1] * sd + inZ * 0.27, { ry, col: "#8a6a4a" });
        k.inst("cubbyshelf", () => rbox(1.2, 0.05, 0.55, 0.01), oak, x + inX * 0.27, 2.0, z + inZ * 0.27, { ry, col: "#8a6a4a" });
        // the bench and its cushion
        k.inst("bench", () => rbox(1.2, 0.08, 0.5, 0.02), oak, x + inX * 0.75, 0.42, z + inZ * 0.75, { ry, col: "#6b4a2e" });
        k.inst("cushion", () => rbox(1.12, 0.07, 0.44, 0.03), cushion, x + inX * 0.75, 0.5, z + inZ * 0.75, { ry, col: ca });
        // the shirt: a body, two short sleeves and a collar in the second colour
        const sx = x + inX * 0.22,
          sz = z + inZ * 0.22;
        k.inst("shirtbody", () => rbox(0.5, 0.66, 0.05, 0.03), cushion, sx, 1.45, sz, { ry, col: ca });
        for (const side of [-1, 1]) k.inst("shirtsleeve", () => rbox(0.2, 0.2, 0.05, 0.03), cushion, sx + along[0] * side * 0.32, 1.67, sz + along[1] * side * 0.32, { ry, rz: side * 0.5, col: ca });
        k.inst("shirtcollar", () => rbox(0.16, 0.05, 0.06, 0.02), trim, sx, 1.79, sz, { ry, col: cb });
        const num = n === 4 ? myNum : ((n * 7 + 3) % 30) + 1;
        k.text(String(num), cb, ca, sx + inX * 0.03, 1.42, sz + inZ * 0.03, 0.3, 0.3, ry);
        if (n === 4) k.text(st.person.last.toUpperCase(), "#1a1a1a", "#f4f1ea", x + inX * 0.56, 2.14, z + inZ * 0.56, 1.0, 0.18, ry);
        if ([1, 6, 9, 12, 17].includes(n)) k.crowd(x + inX * 0.66, z + inZ * 0.66, ry, { sit: true, seat: 0.54, sx: x + inX * 1.75, sz: z + inZ * 1.75 });
        n++;
      }
      k.block((x1 + x2) / 2 + inX * 0.55, (z1 + z2) / 2 + inZ * 0.55, Math.abs(x2 - x1) / 2 + 0.6 * Math.abs(inZ) + 0.55 * Math.abs(inX), Math.abs(z2 - z1) / 2 + 0.6 * Math.abs(inX) + 0.55 * Math.abs(inZ));
    }
    // the tactics board, towels and a pair of boots by his place
    k.box(2.6, 1.6, 0.06, mat("#f4f6f0", { rough: 0.3 }), 4, 1.6, D / 2 - 2.2, Math.PI);
    k.text("PRESS HIGH. WIN IT BACK.", "#c8102e", "#f4f6f0", 4, 1.8, D / 2 - 2.24, 2.2, 0.22, Math.PI);
    k.block(4, D / 2 - 2.2, 1.3, 0.2);
    for (let i = 0; i < 6; i++) k.inst("towel", () => rbox(0.45, 0.08, 0.3, 0.03), mat("#f4f4f4", { rough: 0.9 }), -W / 2 + 2 + i * 1.3, 0.04, -D / 2 + 1.6, { col: "#f4f4f4" });
    k.spot("changing", "Sit with the lads", 0, 1.8, { r: 1.4, y: 1.6 });
    k.spot("back", "Back outside", -W / 2 + 2.2, D / 2 - 1.2, { r: 1.2, y: 1.8 });
    k.spotLamp(0, H - 0.1, -1, "#fff4e0", { r: 0.7, pool: 0.2 });
    return k.finish({ w: W, d: D, spawn: [-W / 2 + 2.8, D / 2 - 1.6], mood: "warm", light: shopLight({ warm: true, hemi: 0.8, keyI: 0.85, points: [{ x: 0, y: 3, z: 0, col: "#fff0d8", i: 8, dist: 24 }] }), accent: ca });
  }
  // the physio and recovery room
  const W = 18,
    D = 11,
    H = 3.4;
  k.floor(W, D, surfMat("tile", "#e6edef", "#cfd8db", { rough: 0.3 }), 0, 0, 1.6);
  const wallM = mat("#f6f9fa", { rough: 0.8 });
  const walls = k.shell(W, D, H, wallM, { skip: ["s"] });
  k.wall(W / 2, D / 2, -W / 2, D / 2, H, wallM, {});
  k.mount(walls.n!, rbox(W, 0.14, 0.03, 0.01), mat(ca, { rough: 0.5 }), 0, 1.0, 0.12);
  // treatment tables
  for (let i = 0; i < 3; i++) {
    const x = -W / 2 + 3 + i * 3.2;
    k.box(0.8, 0.08, 2.0, mat("#1f3a4a", { rough: 0.6 }), x, 0.72, -2.6, 0, 0.03);
    for (const sx of [-0.28, 0.28]) for (const sz of [-0.8, 0.8]) k.box(0.05, 0.7, 0.05, mat("#c8ccd2", { metal: 0.8 }), x + sx, 0.35, -2.6 + sz);
    k.block(x, -2.6, 0.45, 1.05);
  }
  // ice baths and the cryo chamber
  for (let i = 0; i < 2; i++) {
    const x = 3 + i * 2.6;
    k.add(cyl(0.85, 0.85, 1.0, 24), mat("#d8e2e6", { rough: 0.3, metal: 0.3 }), x, 0.5, -D / 2 + 1.6);
    k.add(cyl(0.78, 0.78, 0.04, 24), glow("#9adcff", 0.55), x, 0.95, -D / 2 + 1.6, 0, { shadow: false });
    k.circle(x, -D / 2 + 1.6, 0.9);
  }
  k.add(cyl(0.65, 0.65, 2.2, 20), mat("#e8eef2", { rough: 0.3, metal: 0.2 }), W / 2 - 1.4, 1.1, -D / 2 + 1.4);
  k.add(cyl(0.66, 0.66, 1.2, 20, true), glow("#9adcff", 0.45), W / 2 - 1.4, 1.3, -D / 2 + 1.4, 0, { shadow: false });
  k.circle(W / 2 - 1.4, -D / 2 + 1.4, 0.7);
  k.text("RECOVERY", "#ffffff", ca, 4.3, 2.6, -D / 2 + 0.16, 3, 0.45, 0);
  k.crowd(-W / 2 + 3, -2.2, 0, { sit: true, seat: 0.76, sx: -W / 2 + 3, sz: -1.0 });
  k.spot("physio", "See the physio", -W / 2 + 6.2, -0.6, { r: 1.4, y: 1.6 });
  k.spot("back", "Back outside", W / 2 - 1.6, D / 2 - 1.2, { r: 1.2, y: 1.8 });
  k.spotLamp(-4, H - 0.1, -2.6, "#ffffff", { r: 0.7, pool: 0.25 });
  return k.finish({ w: W, d: D, spawn: [W / 2 - 2.4, D / 2 - 1.6], mood: "cool", light: shopLight({ hemi: 0.85, keyI: 0.9, points: [{ x: 0, y: 3, z: 0, col: "#f4fbff", i: 6, dist: 22 }] }), accent: ca });
}

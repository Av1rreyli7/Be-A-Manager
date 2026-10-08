/**
 * The still parts of the city, built once per city: the ground and the roads, the sea and the beach, the
 * ordinary buildings grouped into chunks that stream in and out around him, every place with its own front and
 * its sign, the bus shelters, street lamps (with pools of light at night), trees, benches and traffic lights.
 * Repeated things are instanced; one of a kind things are merged; every sign shares one texture.
 */
import * as THREE from "three";
import { Mesher, BOX, CYL, CYL6, CYL16, BALL, PRISM, worldMaterial } from "./mesher";
import { rng, type CityPlan, type PlaceSpot } from "./gen";
import { bodyGeometry, type Body } from "./vehicles";
import { windowsMaterial } from "../city/kit3d";

// ---------- signs: every place name painted into one texture ----------
export function signAtlas(names: { text: string; fg: string; bg: string }[]) {
  const W = 1024,
    rowH = 96;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = Math.max(rowH, rowH * names.length);
  const x = cv.getContext("2d")!;
  const rects: { u0: number; v0: number; u1: number; v1: number; aspect: number }[] = [];
  names.forEach((n, i) => {
    x.fillStyle = n.bg;
    x.fillRect(0, i * rowH, W, rowH);
    x.fillStyle = n.fg;
    let size = 64;
    x.font = `700 ${size}px Inter, system-ui, sans-serif`;
    const txt = n.text.toUpperCase();
    while (x.measureText(txt).width > W - 40 && size > 20) {
      size -= 2;
      x.font = `700 ${size}px Inter, system-ui, sans-serif`;
    }
    x.textAlign = "center";
    x.textBaseline = "middle";
    // a little letter spacing by drawing the letters one by one would be nicer; the plain run reads cleanly
    x.fillText(txt, W / 2, i * rowH + rowH / 2 + 2);
    const tw = Math.min(W - 20, x.measureText(txt).width + 60);
    const u0 = (W / 2 - tw / 2) / W,
      u1 = (W / 2 + tw / 2) / W;
    rects.push({ u0, u1, v0: 1 - ((i + 1) * rowH) / cv.height, v1: 1 - (i * rowH) / cv.height, aspect: tw / rowH });
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, rects };
}

/** a builder that works in a place's own frame: x along the street front, z out to the street, y up */
function local(m: Mesher, s: PlaceSpot) {
  const ry = Math.atan2(s.face[0], s.face[1]);
  const c = Math.cos(ry),
    sn = Math.sin(ry);
  const fw = Math.abs(s.face[0]) > 0 ? s.d : s.w;
  const fd = Math.abs(s.face[0]) > 0 ? s.w : s.d;
  const at = (lx: number, lz: number): [number, number] => [s.x + lx * c + lz * sn, s.z - lx * sn + lz * c];
  return {
    fw,
    fd,
    ry,
    at,
    box(col: string, lx: number, ly: number, lz: number, w: number, h: number, d: number, o: { glow?: number; day?: number; rx?: number } = {}) {
      const [x, z] = at(lx, lz);
      m.add(BOX, col, x, ly, z, { ry, rx: o.rx, sx: w, sy: h, sz: d, glow: o.glow, day: o.day });
    },
    cyl(col: string, lx: number, ly: number, lz: number, r: number, h: number, o: { glow?: number; day?: number } = {}) {
      const [x, z] = at(lx, lz);
      m.add(CYL, col, x, ly, z, { ry, sx: r * 2, sy: h, sz: r * 2, glow: o.glow, day: o.day });
    },
    ball(col: string, lx: number, ly: number, lz: number, r: number, o: { glow?: number; day?: number } = {}) {
      const [x, z] = at(lx, lz);
      m.add(BALL, col, x, ly, z, { ry, sx: r * 2, sy: r * 2, sz: r * 2, glow: o.glow, day: o.day });
    },
    roof(col: string, lx: number, ly: number, lz: number, w: number, h: number, d: number) {
      const [x, z] = at(lx, lz);
      m.add(PRISM, col, x, ly, z, { ry: ry + Math.PI / 2, sx: d, sy: h, sz: w });
    },
    car(body: Body, colour: string, lx: number, lz: number, turn: number) {
      const g = bodyGeometry(body, colour);
      const [x, z] = at(lx, lz);
      g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, 0.2, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry + turn), new THREE.Vector3(1, 1, 1)));
      m.parts.push(g);
    },
  };
}

const GLASS = "#22303c";
const WARM = "#ffd9a0";

/** a place's outside: its own building, by kind and brand */
function placeFront(m: Mesher, s: PlaceSpot, sign: (text: string, lx: number, ly: number, lz: number, h: number) => void, flav: CityPlan["flavor"]) {
  const L = local(m, s);
  const { fw, fd } = L;
  const st = s.place.style;
  const H = s.h;
  const front = fd / 2;
  const kind = s.place.kind;
  const door = (w = 2.2, h = 3) => {
    L.box("#0b0d10", 0, h / 2, front + 0.06, w, h, 0.12);
    L.box(st.accent, 0, h + 0.1, front + 0.1, w + 0.3, 0.12, 0.16, { glow: 0.9, day: 0.25 });
  };
  if (kind === "store" || kind === "watches") {
    const lux = s.place.where === "luxury";
    L.box(st.wall, 0, H / 2, 0, fw, H, fd);
    L.box(st.floor, 0, 2.3, front + 0.04, fw - 1.4, 3.8, 0.1, { glow: 0.85, day: 0.25 });
    L.box(st.trim, 0, 4.4, front + 0.1, fw, 0.3, 0.3);
    L.box(st.accent, 0, H - 0.3, front + 0.12, fw, 0.6, 0.3);
    for (let k = 1; k < Math.floor(H / 3.2); k++) L.box(GLASS, 0, 4.6 + k * 3.2 - 1.6, front + 0.03, fw - 2, 1.5, 0.08, { glow: 0.45 });
    if (lux) {
      for (const sx of [-1, 1]) L.cyl(st.trim, sx * (fw / 2 - 0.6), 3, front + 0.4, 0.32, 6);
      L.box(st.trim, 0, 6.1, front + 0.4, fw, 0.25, 0.9);
    } else L.box(st.accent, 0, 3.9, front + 1.0, fw * 0.7, 0.12, 2.0, { rx: -0.18 });
    door(2, 3);
    sign(s.place.name, 0, 5.2, front + 0.18, 1.1);
    return;
  }
  if (kind === "mall") {
    L.box(st.wall, 0, H / 2, -1, fw, H, fd - 2);
    L.box(GLASS, 0, 6, front - 0.9, fw * 0.5, 11, 0.4, { glow: 0.7, day: 0.15 });
    L.box(st.accent, 0, 12.2, front - 0.6, fw * 0.56, 0.6, 1.2);
    L.box(st.trim, 0, 4.2, front + 1.6, fw * 0.4, 0.25, 4, { glow: 0.3 });
    for (const sx of [-1, 1]) L.cyl(st.trim, sx * fw * 0.18, 2.1, front + 3.2, 0.25, 4.2);
    // bands of the store names on the front
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) L.box(k % 2 ? st.accent : st.trim, sx * fw * 0.37, 3 + k * 4.2, front - 0.88, fw * 0.2, 2.4, 0.1, { glow: 0.6, day: 0.2 });
    door(5, 3.6);
    sign(s.place.name, 0, H - 2.5, front - 0.2, 2.2);
    return;
  }
  if (kind === "supermarket") {
    L.box(st.wall, 0, H / 2, 0, fw, H, fd);
    L.box(GLASS, 0, 1.9, front + 0.04, fw - 3, 3.2, 0.1, { glow: 0.8, day: 0.3 });
    L.box(st.accent, 0, H - 1.2, front + 0.1, fw, 2.4, 0.3, { day: 0.1 });
    for (let k = -2; k <= 2; k++) L.box("#9aa3ad", k * 1.1 - fw / 2 + 4, 0.55, front + 2.4, 0.8, 1, 1.2);
    door(4, 3);
    sign(s.place.name, 0, H - 1.2, front + 0.3, 1.6);
    return;
  }
  if (kind === "cafe") {
    L.box(st.wall, 0, H / 2, 0, fw, H, fd);
    L.box(WARM, 0, 1.8, front + 0.04, fw - 1.2, 2.8, 0.1, { glow: 0.9, day: 0.35 });
    for (let k = 0; k < 6; k++) L.box(k % 2 ? st.accent : st.trim, -fw / 2 + fw / 12 + (k * fw) / 6, 3.5, front + 0.9, fw / 6, 0.12, 1.8, { rx: -0.25 });
    for (const sx of [-1, 1]) {
      L.cyl("#3a3d42", sx * 3, 0.45, front + 3.1, 0.4, 0.06);
      L.cyl("#3a3d42", sx * 3, 0.22, front + 3.1, 0.05, 0.44);
      L.cyl(st.accent, sx * 3, 2.1, front + 3.1, 1.2, 0.08);
      L.cyl("#d9d0c0", sx * 3, 1.1, front + 3.1, 0.03, 2.1);
    }
    door(1.6, 2.6);
    sign(s.place.name, 0, 4.4, front + 0.12, 0.8);
    return;
  }
  if (kind === "restaurant") {
    const sea = s.zone === "seafront";
    L.box(st.wall, 0, sea ? 2.2 : H / 2, -1, fw, sea ? 4.4 : H, fd - 2);
    L.box(WARM, 0, 2.2, front - 0.95, fw - 1, 3.4, 0.1, { glow: 0.95, day: 0.3 });
    L.box(st.trim, 0, sea ? 4.6 : H + 0.2, -1, fw + 1, 0.3, fd);
    if (sea) {
      // a timber deck out front with a rail and a string of lights
      L.box("#8a6a48", 0, 0.25, front + 1.7, fw + 2, 0.2, 3.4);
      L.box("#c9b38a", 0, 1.1, front + 3.3, fw + 2, 0.08, 0.08);
      for (let k = -4; k <= 4; k++) L.ball(WARM, k * (fw / 9), 3.2 + Math.cos(k) * 0.15, front + 3.3, 0.09, { glow: 1, day: 0.2 });
      for (const sx of [-1, 1]) L.cyl("#f2efe8", sx * 5, 0.75, front + 1.8, 0.5, 0.06);
    } else for (let k = -2; k <= 2; k++) L.ball(WARM, k * 3, H + 1.3, -1, 0.12, { glow: 1 });
    door(2, 2.8);
    sign(s.place.name, 0, sea ? 3.9 : H - 1.2, front - 0.8, 0.9);
    return;
  }
  if (kind === "club") {
    L.box("#0a0a0d", 0, H / 2, 0, fw, H, fd);
    for (const y of [0.15, H - 0.15]) L.box(st.accent, 0, y, front + 0.06, fw, 0.18, 0.08, { glow: 1, day: 0.6 });
    for (const sx of [-1, 1]) L.box(st.trim, sx * (fw / 2 - 0.1), H / 2, front + 0.06, 0.16, H, 0.08, { glow: 1, day: 0.6 });
    L.box(st.accent, fw / 2 - 2, H / 2 + 1, front + 0.5, 0.5, H - 4, 0.3, { glow: 1, day: 0.7 });
    for (let k = -2; k <= 2; k++) L.cyl("#c9a24a", k * 0.9 + 3.2, 0.5, front + 1.8, 0.05, 1);
    L.box("#9b1c2c", 3.2, 0.95, front + 1.8, 3.6, 0.05, 0.05);
    door(2, 2.8);
    sign(s.place.name, 0, H - 2.2, front + 0.12, 1.1);
    return;
  }
  if (kind === "clinic") {
    L.box("#eef1f3", 0, H / 2, 0, fw, H, fd);
    for (let k = 0; k < Math.floor(H / 3.4); k++) L.box(GLASS, 0, 1.8 + k * 3.4, front + 0.03, fw - 1.6, 1.8, 0.08, { glow: 0.5 });
    L.box("#1aa35a", fw / 2 - 2, H - 2, front + 0.15, 2.2, 0.6, 0.2, { glow: 1, day: 0.8 });
    L.box("#1aa35a", fw / 2 - 2, H - 2, front + 0.15, 0.6, 2.2, 0.2, { glow: 1, day: 0.8 });
    L.box(st.accent, 0, 3.3, front + 1.4, fw * 0.5, 0.2, 2.6);
    door(2.4, 3);
    sign(s.place.name, -2, 4.3, front + 0.12, 0.9);
    return;
  }
  if (kind === "gym") {
    L.box(st.wall, 0, H / 2, 0, fw, H, fd);
    L.box(GLASS, 0, 3.4, front + 0.04, fw - 2, 5.4, 0.1, { glow: 0.75, day: 0.15 });
    L.box(st.accent, 0, H - 0.8, front + 0.12, fw, 1, 0.3, { glow: 0.5, day: 0.2 });
    door(2.2, 3);
    sign(s.place.name, 0, H - 0.8, front + 0.3, 1);
    return;
  }
  if (kind === "dealer") {
    L.box(st.wall, 0, H - 0.6, 0, fw, 1.2, fd);
    L.box(st.floor, 0, 0.1, 0, fw, 0.2, fd);
    for (const sx of [-1, 1]) L.box(st.trim, sx * (fw / 2 - 0.2), H / 2, 0, 0.4, H, fd);
    L.box(st.trim, 0, H / 2, -fd / 2 + 0.2, fw, H, 0.4);
    L.box(GLASS, 0, (H - 1.2) / 2, front - 0.1, fw - 0.8, H - 1.2, 0.08, { glow: 0.3, day: 0.05 });
    L.car("sports", st.accent, -fw / 4, 0, 0.6);
    L.car("suv", "#1b1e23", fw / 4, -1, -0.5);
    for (const sx of [-1, 1]) {
      L.cyl("#c8ccd2", sx * (fw / 2 + 1.5), 4, front + 1.5, 0.06, 8);
      L.box(st.accent, sx * (fw / 2 + 1.5) + 0.6, 6.8, front + 1.5, 1.2, 2, 0.05, { glow: 0.4, day: 0.3 });
    }
    door(3, 3.2);
    sign(s.place.name, 0, H - 0.6, front + 0.12, 1.1);
    return;
  }
  if (kind === "stadium") {
    // a bowl of stands round a pitch, a roof ring and four floodlight towers
    const rx = fw / 2 - 1,
      rz = fd / 2 - 1;
    const seg = 28;
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      const a2 = ((k + 0.5) / seg) * Math.PI * 2;
      const len = Math.hypot(rx * (Math.cos(a2) - Math.cos(a)), rz * (Math.sin(a2) - Math.sin(a))) * 2.1;
      for (let tier = 0; tier < 3; tier++) {
        const f = 1 - tier * 0.12;
        const lx = Math.cos(a2) * rx * f,
          lz = Math.sin(a2) * rz * f;
        const [x, z] = L.at(lx, lz);
        m.add(BOX, tier === 1 ? st.accent : st.wall, x, 3 + tier * 5, z, { ry: L.ry - a2 + Math.PI / 2, sx: len, sy: 6, sz: 5 });
      }
      const [x, z] = L.at(Math.cos(a2) * rx * 1.02, Math.sin(a2) * rz * 1.02);
      m.add(BOX, st.trim, x, H, z, { ry: L.ry - a2 + Math.PI / 2, sx: len, sy: 0.6, sz: 9 });
    }
    L.box("#2f7d43", 0, 0.12, 0, fw * 0.56, 0.1, fd * 0.46);
    for (let k = -3; k <= 3; k++) L.box("#348a4a", k * fw * 0.08, 0.13, 0, fw * 0.04, 0.1, fd * 0.46);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        L.cyl("#9aa3ad", sx * rx * 0.92, 14, sz * rz * 0.92, 0.5, 28);
        L.box("#f4f6ff", sx * rx * 0.92, 28.5, sz * rz * 0.92, 4, 2, 0.6, { glow: 1, day: 0.4 });
      }
    door(5, 4);
    sign(s.place.name, 0, H + 1.8, front + 0.5, 2.4);
    return;
  }
  if (kind === "training") {
    L.box("#2f7d43", 0, 0.1, 0, fw - 2, 0.1, fd - 2);
    for (let k = -4; k <= 4; k++) L.box("#348a4a", k * (fw / 10), 0.11, 0, fw / 20, 0.1, fd - 2);
    for (const sz of [-1, 1]) {
      L.box("#f4f4f4", 0, 1.2, sz * (fd / 2 - 3), 7.3, 0.12, 0.12);
      for (const sx of [-1, 1]) L.box("#f4f4f4", sx * 3.65, 0.6, sz * (fd / 2 - 3), 0.12, 2.4, 0.12);
    }
    for (let k = 0; k < 20; k++) {
      const t = (k / 20) * 2 - 1;
      L.cyl("#5c6066", t * (fw / 2 - 1), 1.2, fd / 2 - 0.5, 0.05, 2.4);
      L.cyl("#5c6066", t * (fw / 2 - 1), 1.2, -fd / 2 + 0.5, 0.05, 2.4);
    }
    L.box(st.wall, fw / 2 - 9, 2.5, front - 4, 14, 5, 6);
    L.box(GLASS, fw / 2 - 9, 2.5, front - 0.95, 12, 2.4, 0.1, { glow: 0.6 });
    door(2, 2.8);
    sign(s.place.name, fw / 2 - 9, 5.6, front - 0.9, 0.9);
    return;
  }
  if (kind === "home") {
    const id = s.place.homeId || s.place.id.replace("home:", "");
    if (id === "mansion") {
      L.box("#3f6b3a", 0, 0.08, 0, fw, 0.1, fd);
      L.box("#c9c0ad", 0, 0.1, front - 6, 4, 0.06, 12);
      L.box("#efe9dc", 0, 5, -4, fw * 0.6, 10, fd * 0.45);
      for (const sx of [-1, 1]) L.box("#e7e0d1", sx * fw * 0.36, 3.5, -2, fw * 0.2, 7, fd * 0.36);
      L.roof("#4a4e54", 0, 10, -4, fw * 0.62, 3.2, fd * 0.47);
      for (let k = -2; k <= 2; k++) L.cyl("#f4f1ea", k * 2.4, 4, -4 + fd * 0.225 + 1.6, 0.4, 8);
      L.box("#f4f1ea", 0, 8.3, -4 + fd * 0.225 + 1.6, 12.4, 0.6, 3.6);
      for (let k = 0; k < 3; k++) L.box(GLASS, -fw * 0.2 + k * fw * 0.2, 6.4, -4 + fd * 0.225 + 0.02, 1.4, 2, 0.08, { glow: 0.7 });
      L.cyl("#c8ccd2", 0, 0.5, front - 9, 2.2, 1);
      L.cyl("#4fa3d9", 0, 1.02, front - 9, 1.9, 0.06, { glow: 0.3, day: 0.2 });
      for (const sx of [-1, 1]) L.box("#2a2d33", sx * fw * 0.36, 1.6, -2 + fd * 0.18 + 0.02, 5, 3.2, 0.1);
      for (const sx of [-1, 1]) L.box("#d9d0c0", sx * (fw / 2 - 0.3), 1, 0, 0.5, 2, fd);
      L.box("#2a2d33", 0, 1.4, front - 0.2, 5, 2.8, 0.15);
      return;
    }
    if (id === "villa") {
      L.box("#56824c", 0, 0.08, 0, fw, 0.1, fd);
      L.box("#f2efe8", -2, 3, -3, fw * 0.55, 6, fd * 0.4);
      L.box("#e9e4da", 5, 5.2, -5, fw * 0.3, 3.2, fd * 0.28);
      L.box(GLASS, -2, 2.4, -3 + fd * 0.2 + 0.03, fw * 0.45, 3.6, 0.08, { glow: 0.7 });
      L.box("#3fa7d6", 6, 0.12, 5, 8, 0.12, 5, { glow: 0.25, day: 0.25 });
      for (const sx of [-1, 1]) L.box("#e7e0d1", sx * (fw / 2 - 0.2), 1, 0, 0.4, 2, fd);
      L.box("#e7e0d1", -fw / 4 - 1.5, 1, front - 0.2, fw / 2 - 3, 2, 0.4);
      L.box("#e7e0d1", fw / 4 + 1.5, 1, front - 0.2, fw / 2 - 3, 2, 0.4);
      L.box("#2a2d33", 0, 1, front - 0.2, 3, 2, 0.1);
      return;
    }
    const wallCol = id === "penthouse" ? "#2c3540" : id === "apartment" ? "#cfc8bb" : flav === "uk" ? "#6b4434" : "#c9bba0";
    L.box(wallCol, 0, H / 2, 0, fw, H, fd);
    const floors = Math.floor(H / 3.1);
    for (let k = 0; k < floors; k++) {
      L.box(GLASS, 0, 1.9 + k * 3.1, front + 0.03, fw - 1.6, 1.7, 0.08, { glow: 0.5 + (id === "penthouse" && k > floors - 3 ? 0.5 : 0) });
      if (id === "apartment" && k > 0 && k % 2 === 0) L.box("#e8e4dc", 0, 0.6 + k * 3.1, front + 0.8, fw - 2, 0.15, 1.6);
    }
    if (id === "penthouse") L.box("#d0e85c", 0, H + 0.6, 0, fw * 0.7, 1.2, fd * 0.7, { glow: 0.4, day: 0.1 });
    if (id === "shared" || id === "family") L.roof("#3a3f46", 0, H, 0, fw, 2.4, fd);
    door(1.8, 2.6);
    return;
  }
}

// ---------- the ground ----------
export function buildGround(plan: CityPlan, night: { value: number }) {
  const m = new Mesher();
  const inner = plan.pitch - plan.road - plan.walk * 2;
  const pave = plan.flavor === "india" ? "#8e8679" : plan.flavor === "gulf" ? "#b9a888" : plan.flavor === "med" ? "#b8ad9b" : "#7d7f82";
  const plaza = plan.flavor === "med" ? "#c7b9a2" : "#6f7275";
  const grass = plan.flavor === "gulf" ? "#7a8a4a" : "#3f6b3a";
  for (let i = 0; i < plan.n; i++)
    for (let j = 0; j < plan.n; j++) {
      if (plan.zones[i][j] === "sea") continue;
      const cx = -plan.half + i * plan.pitch + plan.pitch / 2,
        cz = -plan.half + j * plan.pitch + plan.pitch / 2;
      const side = inner + plan.walk * 2;
      if (plan.zones[i][j] === "river") {
        // the river: water between stone banks, the roads cross it on bridges
        m.box("#8e8679", cx, 0.4, cz - side / 2 + 0.4, side, 0.8, 0.8);
        m.box("#8e8679", cx, 0.4, cz + side / 2 - 0.4, side, 0.8, 0.8);
        m.box("#20526b", cx, 0.03, cz, side, 0.02, side - 1.6);
        continue;
      }
      m.box(pave, cx, 0.075, cz, side, 0.15, side);
      const z = plan.zones[i][j];
      m.box(z === "park" ? grass : z === "suburb" || z === "hill" ? "#4a6b40" : plaza, cx, 0.16, cz, inner, 0.02, inner);
      // a kerb stone line
      m.box("#a3a6a9", cx, 0.155, cz - side / 2 + 0.15, side, 0.02, 0.3);
      m.box("#a3a6a9", cx, 0.155, cz + side / 2 - 0.15, side, 0.02, 0.3);
      m.box("#a3a6a9", cx - side / 2 + 0.15, 0.155, cz, 0.3, 0.02, side);
      m.box("#a3a6a9", cx + side / 2 - 0.15, 0.155, cz, 0.3, 0.02, side);
    }
  // paths across the parks
  for (const p of plan.parks) {
    const cx = (p.x0 + p.x1) / 2,
      cz = (p.z0 + p.z1) / 2;
    m.box("#b9ad94", cx, 0.175, cz, p.x1 - p.x0, 0.02, 3);
    m.box("#b9ad94", cx, 0.176, cz, 3, 0.02, p.z1 - p.z0);
  }
  const blocks = m.build();
  // road markings: a dashed middle line on every stretch and zebra crossings at the corners
  const marks = new Mesher();
  const g = (k: number) => -plan.half + k * plan.pitch;
  const last = plan.coastRow === null ? plan.n : plan.coastRow + 1;
  for (let k = 0; k <= plan.n; k++)
    for (let mm = 0; mm < plan.n; mm++) {
      for (let t = 0.25; t < 0.8; t += 0.09) {
        if (k <= last) marks.box("#e6e2d6", g(mm) + plan.pitch * t, 0.012, g(k), 2.4, 0.01, 0.15);
        if (mm < last) marks.box("#e6e2d6", g(k), 0.012, g(mm) + plan.pitch * t, 0.15, 0.01, 2.4);
      }
    }
  for (let k = 0; k <= plan.n; k++)
    for (let mm = 0; mm <= last; mm++)
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const cx = g(k) + dx * (plan.road / 2 + 2),
          cz = g(mm) + dz * (plan.road / 2 + 2);
        for (let s = -2; s <= 2; s++) {
          if (dx) marks.box("#e9e6dc", cx, 0.013, cz + s * 1.8, 2.6, 0.01, 0.9);
          else marks.box("#e9e6dc", cx + s * 1.8, 0.013, cz, 0.9, 0.01, 2.6);
        }
      }
  const markGeo = marks.build();
  // the asphalt under everything
  const span = plan.n * plan.pitch + 260;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(span, span).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#474a50", roughness: 0.9 }));
  road.receiveShadow = true;
  const mat = worldMaterial(night, { rough: 0.9 });
  const blockMesh = new THREE.Mesh(blocks, mat);
  blockMesh.receiveShadow = true;
  const markMesh = new THREE.Mesh(markGeo, mat);
  markMesh.receiveShadow = true;
  const group = new THREE.Group();
  group.add(road, blockMesh, markMesh);
  // the beach and the sea
  let water: THREE.Mesh | null = null;
  if (plan.coastRow !== null) {
    const z0 = g(plan.coastRow + 1) + plan.road / 2;
    const sand = new THREE.Mesh(new THREE.BoxGeometry(span, 0.3, 34), new THREE.MeshStandardMaterial({ color: plan.flavor === "india" ? "#cdb68a" : "#e2d3ad", roughness: 1 }));
    sand.position.set(0, 0.05, z0 + 17 + plan.walk);
    sand.receiveShadow = true;
    const prom = new THREE.Mesh(new THREE.BoxGeometry(span, 0.3, plan.walk + 1), new THREE.MeshStandardMaterial({ color: "#c9c2b3", roughness: 0.9 }));
    prom.position.set(0, 0.1, z0 + plan.walk / 2);
    const wm = new THREE.MeshStandardMaterial({ color: "#14435a", roughness: 0.08, metalness: 0.1 });
    const uT = { value: 0 };
    wm.onBeforeCompile = (sh) => {
      sh.uniforms.uT = uT;
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vW;").replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vW;\nuniform float uT;")
        .replace(
          "#include <normal_fragment_maps>",
          `#include <normal_fragment_maps>
          vec2 p = vW.xz * 0.08;
          float w1 = sin(p.x * 1.7 + uT * 0.9) * 0.5 + sin(p.y * 2.3 - uT * 1.1) * 0.5;
          float w2 = sin((p.x + p.y) * 3.1 + uT * 1.6) * 0.3;
          normal = normalize(normal + vec3(w1 * 0.06, 0.0, w2 * 0.06));`,
        );
    };
    water = new THREE.Mesh(new THREE.PlaneGeometry(span * 3, 1600).rotateX(-Math.PI / 2), wm);
    water.position.set(0, -0.15, z0 + plan.walk + 34 + 800);
    water.userData.uT = uT;
    group.add(sand, prom, water);
  }
  return {
    group,
    water,
    dispose: () => {
      group.traverse((o) => {
        const mm = o as THREE.Mesh;
        if (mm.isMesh) {
          mm.geometry.dispose();
          (mm.material as THREE.Material).dispose();
        }
      });
    },
  };
}

// ---------- ordinary buildings, in chunks of 3 by 3 blocks ----------
export interface Chunk {
  x: number;
  z: number;
  walls: THREE.InstancedMesh;
  roofs: THREE.InstancedMesh | null;
  shops: THREE.InstancedMesh | null;
  /** close up only: a cornice, a darker base, plant boxes on flat roofs */
  trims: THREE.InstancedMesh;
}
export function buildBuildings(plan: CityPlan, night: { value: number }, quality: number) {
  const chunks = new Map<string, { list: number[] }>();
  const C = plan.pitch * 3;
  plan.buildings.forEach((b, k) => {
    const key = Math.floor((b.x + plan.half) / C) + "," + Math.floor((b.z + plan.half) / C);
    const c = chunks.get(key);
    if (c) c.list.push(k);
    else chunks.set(key, { list: [k] });
  });
  const wallMat = windowsMaterial("#ffffff", "#ffd9a0", night, { lit: 0.36 });
  const roofMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.85 });
  const trimMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9 });
  const shopMat = worldMaterial(night);
  const shopGeo = (() => {
    const m = new Mesher();
    m.box("#ffffff", 0, 0, 0, 1, 1, 1, { glow: 0.42, day: 0.06 });
    return m.build();
  })();
  const col = new THREE.Color();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const out: Chunk[] = [];
  const group = new THREE.Group();
  const r = rng(plan.seed + 3);
  for (const [key, c] of chunks) {
    const [ci, cj] = key.split(",").map(Number);
    const list = c.list.map((k) => plan.buildings[k]);
    const walls = new THREE.InstancedMesh(BOX, wallMat, list.length);
    const pitched = list.filter((b) => b.roof === 1);
    const setback = list.filter((b) => b.roof === 2);
    const roofs = pitched.length + setback.length ? new THREE.InstancedMesh(PRISM, roofMat, pitched.length + setback.length) : null;
    const shopList = list.filter((b) => (b.zone === "centre" || b.zone === "mid" || b.zone === "seafront") && b.h > 8);
    const shops = shopList.length && quality >= 1 ? new THREE.InstancedMesh(shopGeo, shopMat, shopList.length) : null;
    list.forEach((b, k) => {
      m4.compose(new THREE.Vector3(b.x, b.h / 2, b.z), q.identity(), new THREE.Vector3(b.w, b.h, b.d));
      walls.setMatrixAt(k, m4);
      walls.setColorAt(k, col.set(plan.palette.walls[b.col % plan.palette.walls.length]));
    });
    let rk = 0;
    for (const b of pitched) {
      const ridgeX = b.w > b.d;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ridgeX ? Math.PI / 2 : 0);
      m4.compose(new THREE.Vector3(b.x, b.h, b.z), q, new THREE.Vector3(ridgeX ? b.d : b.w, Math.min(4, Math.min(b.w, b.d) * 0.45), ridgeX ? b.w : b.d));
      roofs!.setMatrixAt(rk, m4);
      roofs!.setColorAt(rk++, col.set(plan.palette.roofs[Math.floor(r() * plan.palette.roofs.length)]));
    }
    for (const b of setback) {
      q.identity();
      m4.compose(new THREE.Vector3(b.x, b.h, b.z), q, new THREE.Vector3(b.w * 0.6, 7, b.d * 0.6));
      roofs!.setMatrixAt(rk, m4);
      roofs!.setColorAt(rk++, col.set(plan.palette.walls[(b.col + 2) % plan.palette.walls.length]));
    }
    // the trims: a darker base and a cornice on every building, plant boxes on flat roofs
    const flat = list.filter((b) => b.roof === 0);
    const trims = new THREE.InstancedMesh(BOX, trimMat, list.length * 2 + flat.length);
    let tk = 0;
    const dark = new THREE.Color();
    for (const b of list) {
      dark.set(plan.palette.walls[b.col % plan.palette.walls.length]).multiplyScalar(0.55);
      trims.setMatrixAt(tk, m4.compose(new THREE.Vector3(b.x, 0.55, b.z), q.identity(), new THREE.Vector3(b.w + 0.16, 1.1, b.d + 0.16)));
      trims.setColorAt(tk++, dark);
      dark.set(plan.palette.walls[b.col % plan.palette.walls.length]).multiplyScalar(b.roof === 1 ? 0.8 : 0.7);
      trims.setMatrixAt(tk, m4.compose(new THREE.Vector3(b.x, b.h - 0.2, b.z), q.identity(), new THREE.Vector3(b.w + 0.5, 0.45, b.d + 0.5)));
      trims.setColorAt(tk++, dark);
    }
    for (const b of flat) {
      const s = 0.25 + r() * 0.2;
      trims.setMatrixAt(tk, m4.compose(new THREE.Vector3(b.x + (r() - 0.5) * b.w * 0.4, b.h + 0.9, b.z + (r() - 0.5) * b.d * 0.4), q.identity(), new THREE.Vector3(b.w * s, 1.8, b.d * s)));
      trims.setColorAt(tk++, col.set("#8d939b"));
    }
    trims.frustumCulled = false;
    group.add(trims);
    if (shops) {
      // a lit shop window along the street side of tall buildings, on the ground floor
      shopList.forEach((b, k) => {
        const along = b.w > b.d;
        m4.compose(new THREE.Vector3(b.x, 2.2, b.z), q.identity(), new THREE.Vector3(along ? b.w * 0.92 : b.w + 0.12, 3.2, along ? b.d + 0.12 : b.d * 0.92));
        shops.setMatrixAt(k, m4);
        col.set(["#ffd9a0", "#bfe3ff", "#ffe8c4", "#f6f2e8"][k % 4]);
        shops.setColorAt(k, col);
      });
    }
    walls.castShadow = quality >= 2;
    walls.receiveShadow = quality >= 2;
    walls.frustumCulled = false;
    walls.computeBoundingSphere();
    group.add(walls);
    if (roofs) {
      roofs.castShadow = quality >= 2;
      group.add(roofs);
    }
    if (shops) group.add(shops);
    out.push({ x: -plan.half + ci * C + C / 2, z: -plan.half + cj * C + C / 2, walls, roofs, shops, trims });
  }
  return {
    group,
    chunks: out,
    /** stream: chunks out of range are hidden; the shop windows only show close up */
    stream: (x: number, z: number, far: number) => {
      for (const c of out) {
        const d = Math.hypot(c.x - x, c.z - z) - C * 0.7;
        const on = d < far;
        c.walls.visible = on;
        if (c.roofs) c.roofs.visible = on && d < far * 0.8;
        if (c.shops) c.shops.visible = on && d < 170;
        c.trims.visible = on && d < 240;
      }
    },
    dispose: () => {
      for (const c of out) {
        c.walls.dispose();
        c.roofs?.dispose();
        c.shops?.dispose();
        c.trims.dispose();
      }
      trimMat.dispose();
      wallMat.dispose();
      roofMat.dispose();
      shopMat.dispose();
      shopGeo.dispose();
    },
  };
}

// ---------- the places and the bus shelters ----------
export function buildPlaces(plan: CityPlan, night: { value: number }) {
  const m = new Mesher();
  const signs: { text: string; fg: string; bg: string; x: number; y: number; z: number; ry: number; h: number }[] = [];
  for (const s of plan.places) {
    const L = local(new Mesher(), s);
    placeFront(
      m,
      s,
      (text, lx, ly, lz, h) => {
        const [x, z] = L.at(lx, lz);
        const st = s.place.style;
        signs.push({ text, fg: s.place.kind === "clinic" ? "#ffffff" : st.trim === st.wall ? "#ffffff" : st.trim, bg: s.place.kind === "club" ? "#0a0a0d" : st.accent === st.trim ? st.wall : st.accent, x, y: ly, z, ry: L.ry, h });
      },
      plan.flavor,
    );
  }
  // bus shelters
  for (const st of plan.stops) {
    const c = Math.cos(st.ry),
      sn = Math.sin(st.ry);
    const at = (lx: number, lz: number): [number, number] => [st.x + lx * c + lz * sn, st.z - lx * sn + lz * c];
    const add = (col: string, lx: number, ly: number, lz: number, w: number, h: number, d: number, glow = 0) => {
      const [x, z] = at(lx, lz);
      m.add(BOX, col, x, ly, z, { ry: st.ry, sx: w, sy: h, sz: d, glow });
    };
    // the shelter's back is away from the road; lx runs along the road
    const back = plan.side;
    add("#2c3036", 0, 2.6, 0, 0.12 + 0, 0.1, 4.2);
    add("#9fb6c8", -1.0 * back, 1.4, 0, 0.06, 2.2, 4, 0.2);
    add("#2c3036", -0.9 * back, 2.55, 0, 1.6, 0.1, 4.4);
    add("#6b5a4a", -0.6 * back, 0.55, 0, 0.5, 0.08, 3);
    add("#ffb000", 0.6 * back, 2.8, 2.4, 0.5, 0.5, 0.06, 1);
    add("#3a3d42", 0.6 * back, 1.4, 2.4, 0.08, 2.8, 0.08);
    signs.push({ text: "BUS  " + st.name, fg: "#111111", bg: "#ffb000", x: at(-0.92 * back, 0)[0], y: 2.25, z: at(-0.92 * back, 0)[1], ry: st.ry + (back > 0 ? -Math.PI / 2 : Math.PI / 2), h: 0.35 });
  }
  const geo = m.build();
  const mat = worldMaterial(night, { rough: 0.6, metal: 0.08 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // the signs, all from one texture
  const atlas = signAtlas(signs.map((s) => ({ text: s.text, fg: s.fg, bg: s.bg })));
  const pos: number[] = [],
    uv: number[] = [],
    idx: number[] = [];
  signs.forEach((s, k) => {
    const R = atlas.rects[k];
    const w = s.h * R.aspect,
      h = s.h;
    const c = Math.cos(s.ry),
      sn = Math.sin(s.ry);
    const corner = (lx: number, ly: number) => [s.x + lx * c, s.y + ly, s.z - lx * sn];
    const base = pos.length / 3;
    for (const [lx, ly, u, v] of [
      [-w / 2, -h / 2, R.u0, R.v0],
      [w / 2, -h / 2, R.u1, R.v0],
      [w / 2, h / 2, R.u1, R.v1],
      [-w / 2, h / 2, R.u0, R.v1],
    ]) {
      pos.push(...corner(lx, ly));
      uv.push(u, v);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  sg.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  sg.setIndex(idx);
  sg.computeVertexNormals();
  const smat = new THREE.MeshBasicMaterial({ map: atlas.tex, toneMapped: false, side: THREE.DoubleSide });
  const signMesh = new THREE.Mesh(sg, smat);
  const group = new THREE.Group();
  group.add(mesh, signMesh);
  return {
    group,
    dispose: () => {
      geo.dispose();
      mat.dispose();
      sg.dispose();
      smat.dispose();
      atlas.tex.dispose();
    },
  };
}

// ---------- lamps, pools of light, trees, benches, traffic lights ----------
export function buildStreetFurniture(plan: CityPlan, night: { value: number }, quality: number) {
  const group = new THREE.Group();
  const mat = worldMaterial(night, { rough: 0.7, metal: 0.2 });
  const lampGeo = (() => {
    const m = new Mesher();
    m.add(CYL6, "#3a3d42", 0, 3.2, 0, { sx: 0.16, sy: 6.4, sz: 0.16 });
    m.box("#3a3d42", 0, 6.3, 0.7, 0.1, 0.1, 1.5);
    m.box("#fff2d6", 0, 6.18, 1.35, 0.5, 0.12, 0.3, { glow: 1, day: 0.05 });
    return m.build();
  })();
  const lamps = new THREE.InstancedMesh(lampGeo, mat, plan.lamps.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  plan.lamps.forEach(([x, z, ry], k) => {
    q.setFromAxisAngle(up, ry);
    lamps.setMatrixAt(k, m4.compose(new THREE.Vector3(x, 0.15, z), q, one));
  });
  lamps.frustumCulled = false;
  group.add(lamps);
  // pools of warm light on the ground under the lamps, only at night
  const poolTex = (() => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    const x = cv.getContext("2d")!;
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,214,150,0.9)");
    g.addColorStop(0.45, "rgba(255,190,120,0.35)");
    g.addColorStop(1, "rgba(255,180,110,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false });
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), poolMat, plan.lamps.length);
  plan.lamps.forEach(([x, z, ry], k) => {
    const ox = Math.sin(ry) * 1.35,
      oz = Math.cos(ry) * 1.35;
    pools.setMatrixAt(k, m4.compose(new THREE.Vector3(x + ox, 0.03, z + oz), q.identity(), new THREE.Vector3(11, 1, 11)));
  });
  pools.frustumCulled = false;
  pools.renderOrder = 2;
  group.add(pools);
  // trees: a trunk and a low poly crown
  const treeGeo = (() => {
    const m = new Mesher();
    m.add(CYL6, "#5b4331", 0, 1.3, 0, { sx: 0.3, sy: 2.6, sz: 0.3 });
    m.add(BALL, plan.flavor === "gulf" || plan.flavor === "india" ? "#4f7a35" : "#3d6b35", 0, 3.6, 0, { sx: 3, sy: 3.2, sz: 3 });
    m.add(BALL, "#467a3a", 0.5, 4.6, 0.2, { sx: 2, sy: 2, sz: 2 });
    return m.build();
  })();
  const nTrees = Math.min(plan.trees.length, [160, 320, 600, 1000][quality]);
  const trees = new THREE.InstancedMesh(treeGeo, worldMaterial(night, { rough: 0.9, flat: true }), nTrees);
  const col = new THREE.Color();
  const r = rng(plan.seed + 11);
  for (let k = 0; k < nTrees; k++) {
    const [x, z, s] = plan.trees[k];
    q.setFromAxisAngle(up, r() * 6.28);
    trees.setMatrixAt(k, m4.compose(new THREE.Vector3(x, 0.15, z), q, new THREE.Vector3(s, s * (0.9 + r() * 0.3), s)));
    trees.setColorAt(k, col.setHSL(0.27 + r() * 0.06, 0.25 + r() * 0.2, 0.5 + r() * 0.2));
  }
  trees.castShadow = quality >= 2;
  trees.frustumCulled = false;
  group.add(trees);
  // benches on the sea front
  if (plan.benches.length) {
    const benchGeo = (() => {
      const m = new Mesher();
      m.box("#7a5a3a", 0, 0.45, 0, 1.8, 0.08, 0.5);
      m.box("#7a5a3a", 0, 0.75, -0.22, 1.8, 0.5, 0.06);
      m.box("#2c3036", -0.8, 0.22, 0, 0.08, 0.44, 0.45);
      m.box("#2c3036", 0.8, 0.22, 0, 0.08, 0.44, 0.45);
      return m.build();
    })();
    const benches = new THREE.InstancedMesh(benchGeo, mat, plan.benches.length);
    plan.benches.forEach(([x, z, ry], k) => {
      q.setFromAxisAngle(up, ry);
      benches.setMatrixAt(k, m4.compose(new THREE.Vector3(x, 0.15, z), q, one));
    });
    group.add(benches);
  }
  // traffic lights on one corner of every junction, facing each way
  const g = (k: number) => -plan.half + k * plan.pitch;
  const last = plan.coastRow === null ? plan.n : plan.coastRow + 1;
  const tl: { x: number; z: number; ry: number; jx: number; jz: number; alongX: boolean }[] = [];
  for (let k = 1; k < plan.n; k++)
    for (let mm = 1; mm < last; mm++) {
      const off = plan.road / 2 + plan.walk - 0.6;
      tl.push({ x: g(k) + off, z: g(mm) + off, ry: 0, jx: g(k), jz: g(mm), alongX: false });
      tl.push({ x: g(k) - off, z: g(mm) - off, ry: Math.PI, jx: g(k), jz: g(mm), alongX: false });
      tl.push({ x: g(k) - off, z: g(mm) + off, ry: -Math.PI / 2, jx: g(k), jz: g(mm), alongX: true });
      tl.push({ x: g(k) + off, z: g(mm) - off, ry: Math.PI / 2, jx: g(k), jz: g(mm), alongX: true });
    }
  const poleGeo = (() => {
    const m = new Mesher();
    m.add(CYL6, "#2c3036", 0, 1.7, 0, { sx: 0.12, sy: 3.4, sz: 0.12 });
    m.box("#1a1c20", 0, 3.4, 0.05, 0.32, 0.9, 0.22);
    return m.build();
  })();
  const poles = new THREE.InstancedMesh(poleGeo, mat, tl.length);
  const headMat = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), headMat, tl.length);
  tl.forEach((t, k) => {
    q.setFromAxisAngle(up, t.ry);
    poles.setMatrixAt(k, m4.compose(new THREE.Vector3(t.x, 0.15, t.z), q, one));
    heads.setMatrixAt(k, m4.compose(new THREE.Vector3(t.x + Math.sin(t.ry) * 0.17, 3.55, t.z + Math.cos(t.ry) * 0.17), q, one));
    heads.setColorAt(k, col.set("#ff3030"));
  });
  poles.frustumCulled = false;
  heads.frustumCulled = false;
  group.add(poles, heads);
  let lastLight = -1;
  return {
    group,
    lights: tl,
    /** each frame: the pools fade with the night; the traffic lights follow the junction clock */
    tick: (t: number, nightV: number, green: (x: number, z: number, alongX: boolean, t: number) => boolean) => {
      poolMat.opacity = Math.max(0, (nightV - 0.25) / 0.75) * 0.85;
      pools.visible = poolMat.opacity > 0.01;
      if (Math.floor(t * 4) === lastLight) return;
      lastLight = Math.floor(t * 4);
      tl.forEach((L, k) => heads.setColorAt(k, col.set(green(L.jx, L.jz, L.alongX, t) ? "#2ee86a" : "#ff3030")));
      if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
    },
    dispose: () => {
      group.traverse((o) => {
        const mm = o as THREE.Mesh;
        if (mm.isMesh) mm.geometry.dispose();
      });
      mat.dispose();
      poolMat.dispose();
      poolTex.dispose();
      headMat.dispose();
      (trees.material as THREE.Material).dispose();
    },
  };
}

export { CYL16 };

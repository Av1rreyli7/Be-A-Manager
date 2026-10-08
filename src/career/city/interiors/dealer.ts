/**
 * The car showrooms, each in its own style: the everyday dealer bright and plain, the prestige dealer dark and
 * polished with cars turning on turntables, the supercar dealer in red and black, the bike shop industrial.
 * Every car on the floor is one the dealer sells; walk up to it and it is the one on the card.
 */
import * as THREE from "three";
import type { WorldPlace } from "../../types";
import { rbox, cyl, plane, mat, glow, makeVehicle, cachedTexture } from "../kit3d";
import { Kit, surfMat, shopLight, people, plant, type Room, type Surface } from "./common";

type Style = "everyday" | "prestige" | "super" | "bikes";
interface DLook {
  floor: [Surface, string, string?];
  rough: number;
  wall: string;
  face?: [Surface, string, string?];
  accent: string;
  podium: string;
  turn: boolean;
  bg: string;
  hemi: number;
  light: string;
}
const LOOK: Record<Style, DLook> = {
  everyday: { floor: ["tile", "#f2f2f0", "#d8d8d4"], rough: 0.25, wall: "#fafafa", accent: "#eb0a1e", podium: "#e8e8e6", turn: false, bg: "#0c0d0f", hemi: 1.0, light: "#ffffff" },
  prestige: {
    floor: ["tile", "#1a1c20", "#0e0f12"],
    rough: 0.22,
    wall: "#24272c",
    face: ["slats", "#3a2a1e"],
    accent: "#1c69d4",
    podium: "#d8dce2",
    turn: true,
    bg: "#050607",
    hemi: 0.55,
    light: "#f4f6ff",
  },
  super: {
    floor: ["tile", "#111111", "#070707"],
    rough: 0.2,
    wall: "#141414",
    face: ["plain", "#161616"],
    accent: "#d40000",
    podium: "#1a1a1a",
    turn: true,
    bg: "#030303",
    hemi: 0.45,
    light: "#fff2e8",
  },
  bikes: {
    floor: ["concrete", "#6e6c68"],
    rough: 0.7,
    wall: "#5a3a2e",
    face: ["brick", "#7a4a36", "#3a2a22"],
    accent: "#cc0000",
    podium: "#2a2a2a",
    turn: false,
    bg: "#08080a",
    hemi: 0.75,
    light: "#fff0dc",
  },
};
const styleOf = (p: WorldPlace): Style => (p.id.includes("prestige") ? "prestige" : p.id.includes("super") ? "super" : p.id.includes("bike") ? "bikes" : "everyday");

/** a car maker's name on the wall, written its own way */
function makerSign(brand: string, fg: string, bg: string) {
  return cachedTexture(
    "maker|" + brand + fg + bg,
    (x, w, h) => {
      x.fillStyle = bg;
      x.fillRect(0, 0, w, h);
      x.fillStyle = fg;
      x.textAlign = "center";
      x.textBaseline = "middle";
      const b = brand.toLowerCase();
      const font = b.includes("ferrari")
        ? "italic 700 {s}px 'Times New Roman', serif"
        : b.includes("lamborghini")
          ? "800 {s}px 'Copperplate', 'Helvetica Neue', serif"
          : b.includes("porsche") || b.includes("bmw") || b.includes("mercedes") || b.includes("brabus")
            ? "700 {s}px 'Helvetica Neue', Arial, sans-serif"
            : b.includes("range")
              ? "600 {s}px 'Gill Sans', 'Helvetica Neue', sans-serif"
              : "800 {s}px 'Helvetica Neue', Arial, sans-serif";
      let s = 110;
      const t = brand.toUpperCase();
      x.font = font.replace("{s}", String(s));
      while (x.measureText(t).width > w * 0.86 && s > 16) {
        s -= 6;
        x.font = font.replace("{s}", String(s));
      }
      if ("letterSpacing" in x) (x as unknown as { letterSpacing: string }).letterSpacing = s * 0.12 + "px";
      x.fillText(t, w / 2, h / 2 + 4);
    },
    1024,
    192,
  );
}

export function dealerRoom(k: Kit, p: WorldPlace): Room {
  const sty = styleOf(p);
  const L = LOOK[sty];
  const accent = p.style.accent || L.accent;
  const cars = k.cat.cars.filter((c) => c.dealer === p.id);
  const bikes = sty === "bikes";
  // a grid of bays: wider for cars, tighter for bikes
  const cols = bikes ? 4 : cars.length > 9 ? 5 : cars.length > 4 ? 4 : 3;
  const rows = Math.max(1, Math.ceil(cars.length / cols));
  const bx = bikes ? 3.4 : 6.4,
    bz = bikes ? 4.6 : 7.6;
  const W = Math.max(18, cols * bx + 4),
    D = rows * bz + 7;
  const H = sty === "everyday" ? 6 : 6.5;
  // ---------- the shell ----------
  k.floor(W, D, surfMat(L.floor[0], L.floor[1], L.floor[2], { rough: L.rough, metal: 0 }), 0, 0, sty === "bikes" ? 4 : 2.4);
  const wallM = mat(L.wall, { rough: 0.85 });
  const face = L.face ? surfMat(L.face[0], L.face[1], L.face[2], { rough: 0.8 }) : undefined;
  const walls = k.shell(W, D, H, wallM, { skip: ["s"], face, tile: sty === "bikes" ? 2.4 : 3, faces: sty === "super" ? { n: surfMat("velvet", "#5a0606") } : undefined });
  const gap = 4;
  k.wall(W / 2, D / 2, gap / 2, D / 2, H, wallM, { face });
  k.wall(-gap / 2, D / 2, -W / 2, D / 2, H, wallM, { face });
  const head = k.wall(gap / 2, D / 2, -gap / 2, D / 2, H, wallM, { solid: false, low: 3.4 });
  k.mount(head, rbox(gap + 0.2, 0.16, 0.3, 0.02), mat(accent, { rough: 0.4 }), 0, 3.4, 0);
  k.spot("door", "Way out", 0, D / 2 - 0.7, { r: 1.2, y: 1.8 });
  // the makers' names across the back wall
  const makers = [...new Set(cars.map((c) => c.brand))];
  const fg = sty === "everyday" ? accent : sty === "super" ? "#ffffff" : sty === "bikes" ? "#f2f2f2" : "#e8ecf2";
  const bg = sty === "everyday" ? "#fafafa" : sty === "super" ? "#141414" : sty === "bikes" ? "#2a2a2a" : "#24272c";
  makers.forEach((m, i) => {
    const sw = Math.min(5.5, (W - 4) / makers.length - 0.6);
    const x = -((makers.length - 1) * (sw + 0.6)) / 2 + i * (sw + 0.6);
    k.sign(makerSign(m, fg, bg), x, H - 1.4, 0.14, sw, sw * 0.19, 0, { to: walls.n! });
  });
  if (sty === "everyday") {
    // a red band and big bright windows on the side walls
    k.mount(walls.n!, rbox(W, 0.4, 0.04, 0.01), mat(accent, { rough: 0.5 }), 0, H - 0.5, 0.13);
    for (const wg of [walls.w!, walls.e!]) for (let z = -D / 2 + 3; z < D / 2 - 2; z += 4.5) k.mount(wg, plane(3.4, 2.6), glow("#dfeefa", 0.9), z - D / 2 + D / 2, 2.4, 0.12);
  } else if (sty === "super") {
    // red light lines along the floor and up the walls
    for (const wg of [walls.n!, walls.w!, walls.e!]) k.mount(wg, rbox(wg === walls.n ? W : D, 0.05, 0.03, 0.01), glow(accent, 2.2), 0, 0.3, 0.13);
    for (const wg of [walls.n!, walls.w!, walls.e!]) k.mount(wg, rbox(wg === walls.n ? W : D, 0.03, 0.03, 0.01), glow(accent, 1.6), 0, H - 1.0, 0.13);
    for (const x of [-W / 2 + 1, W / 2 - 1]) k.add(rbox(0.06, 0.012, D - 3, 0.005), glow(accent, 2), x, 0.008, -0.6, 0, { shadow: false });
  } else if (sty === "bikes") {
    // steel beams overhead and a workshop corner
    const steel = mat("#2a2c2e", { metal: 0.7, rough: 0.5 });
    for (let x = -W / 2 + 2; x <= W / 2 - 2; x += 4) k.add(rbox(0.25, 0.35, D, 0.01), steel, x, H - 0.4, 0, 0, { shadow: false });
    k.box(3.0, 0.9, 0.7, mat("#3a3a3a", { metal: 0.4, rough: 0.6 }), W / 2 - 2.2, 0.45, -D / 2 + 0.7);
    k.mount(walls.n!, rbox(3.0, 1.6, 0.04, 0.01), mat("#d8d8d4", { rough: 0.9 }), W / 2 - 2.2, 1.9, 0.14);
    for (let i = 0; i < 8; i++) k.mount(walls.n!, rbox(0.05, 0.35, 0.03, 0.005), mat("#aab0b6", { metal: 1, rough: 0.3 }), W / 2 - 3.4 + i * 0.32, 1.9, 0.18);
    k.block(W / 2 - 2.2, -D / 2 + 0.7, 1.55, 0.4);
  } else {
    for (const wg of [walls.w!, walls.e!]) k.mount(wg, rbox(D, 0.04, 0.03, 0.01), glow("#cfe0ff", 1.2), 0, 0.12, 0.13);
  }
  // ---------- the cars on their stands ----------
  const turners: THREE.Object3D[] = [];
  const podiumM = mat(L.podium, { rough: sty === "everyday" ? 0.5 : 0.15, metal: sty === "prestige" ? 0.6 : 0.2 });
  const heroes = new Set(
    [...cars]
      .sort((a, b) => b.price - a.price)
      .slice(0, L.turn ? 3 : 0)
      .map((c) => c.id),
  );
  const discM = mat(L.podium, { rough: 0.2, metal: 0.5 });
  cars.forEach((c, i) => {
    const r = Math.floor(i / cols),
      col = i % cols;
    const n = Math.min(cols, cars.length - r * cols);
    const x = (col - (n - 1) / 2) * bx;
    const z = -D / 2 + 3.6 + r * bz;
    const v = makeVehicle(c);
    k.own.push({ dispose: () => v.userData.dispose?.() });
    const rad = bikes ? 1.2 : 2.7;
    // the dearest few turn slowly on their turntables; the rest are parked and merged into the room
    k.add(cyl(rad, rad + 0.06, 0.12, 48), heroes.has(c.id) ? discM : podiumM, x, 0.06, z, 0, { shadow: false });
    if (heroes.has(c.id)) {
      k.add(cyl(rad + 0.04, rad + 0.04, 0.04, 48, true), glow(sty === "super" ? accent : "#e8f0ff", 1.6), x, 0.1, z, 0, { shadow: false });
      const tt = new THREE.Group();
      v.position.y = 0.12;
      tt.add(v);
      k.obj(tt, x, 0, z, (i * 0.9) % 6.28);
      turners.push(tt);
    } else k.still(v, x, 0.1, z, bikes ? 0.7 : 0.55);
    // a spotlight on each car
    k.beam(x, H - 0.3, z, rad * 0.9, sty === "super" ? "#ffe8e0" : "#f4f6ff", sty === "everyday" ? 0.03 : 0.07);
    k.pool(x, z, rad * 2.6, sty === "super" ? "#ff8a7a" : "#f4f6ff", sty === "everyday" ? 0.1 : 0.28);
    k.add(rbox(0.5, 0.08, 0.5, 0.02), mat("#141414", { metal: 0.6, rough: 0.4 }), x, H - 0.25, z, 0, { shadow: false });
    // a price stand in front, the card has the rest
    k.add(rbox(0.04, 0.9, 0.04, 0.005), mat("#2a2a2a", { metal: 0.6 }), x + (bikes ? 0.9 : 1.6), 0.45, z + rad + 0.3);
    k.add(rbox(0.5, 0.34, 0.03, 0.01), mat(sty === "everyday" ? "#ffffff" : "#111111", { rough: 0.5 }), x + (bikes ? 0.9 : 1.6), 0.95, z + rad + 0.3, 0, { rx: -0.4 });
    k.circle(x, z, rad + 0.1);
    k.spot("car:" + c.id, c.brand + " " + c.model, x, z + rad + 0.85, { ax: x, az: z, y: bikes ? 0.8 : 0.9, r: bikes ? 1.3 : 1.9 });
  });
  if (turners.length) k.ticks.push((_, dt) => turners.forEach((t, i) => (t.rotation.y += dt * (0.18 + (i % 3) * 0.03))));
  // ---------- a desk, somewhere to sit, a coffee machine ----------
  const deskX = -W / 2 + 2.6,
    deskZ = D / 2 - 2.4;
  k.box(2.4, 1.0, 0.8, mat(sty === "everyday" ? "#f2f2f0" : "#141414", { rough: 0.3 }), deskX, 0.5, deskZ);
  k.add(rbox(2.44, 0.04, 0.84, 0.01), mat(accent, { rough: 0.4 }), deskX, 1.02, deskZ);
  k.add(rbox(0.5, 0.32, 0.02, 0.005), glow("#9ec8ff", 0.7), deskX + 0.5, 1.22, deskZ - 0.2, 0, { shadow: false });
  k.block(deskX, deskZ, 1.25, 0.45);
  people(k, "staff", [{ x: deskX - 0.3, z: deskZ - 0.75, ry: 0, col: sty === "everyday" ? accent : "#141414" }]);
  k.circle(deskX - 0.3, deskZ - 0.75, 0.3);
  const sofaM = mat(sty === "super" ? "#8a0a0a" : sty === "prestige" ? "#3a2a1e" : "#5a5a5a", { rough: 0.6 });
  k.box(2.0, 0.42, 0.8, sofaM, W / 2 - 2.6, 0.21, D / 2 - 2.2, 0, 0.12);
  k.box(2.0, 0.5, 0.2, sofaM, W / 2 - 2.6, 0.55, D / 2 - 1.85, 0, 0.08);
  k.block(W / 2 - 2.6, D / 2 - 2.1, 1.05, 0.5);
  plant(k, W / 2 - 0.8, -D / 2 + 0.8, 1.4);
  plant(k, -W / 2 + 0.8, -D / 2 + 0.8, 1.4);
  if (sty !== "bikes") for (const x of [-W / 3, 0, W / 3]) k.add(rbox(0.12, 0.05, D - 4, 0.01), glow(L.light, sty === "everyday" ? 1.6 : 0.9), x, H - 0.2, 0, 0, { shadow: false });
  else for (let x = -W / 2 + 4; x < W / 2 - 2; x += 4) k.spotLamp(x, H - 0.8, 0, "#ffd8a8", { shade: "#2a2a2a", r: 1.6, pool: 0.25 });
  return k.finish({
    w: W,
    d: D,
    spawn: [0, D / 2 - 2.0],
    mood: sty === "everyday" ? "cool" : "night",
    light: shopLight({
      hemi: L.hemi,
      warm: sty === "bikes",
      bg: L.bg,
      keyI: sty === "everyday" ? 1.2 : 0.7,
      ground: sty === "everyday" ? "#5a5a5a" : "#141414",
      points: [
        { x: -W / 4, y: H - 0.5, z: -D / 4, col: sty === "super" ? "#ff5040" : L.light, i: sty === "everyday" ? 7 : 6, dist: W },
        { x: W / 4, y: H - 0.5, z: -D / 4, col: L.light, i: sty === "everyday" ? 7 : 5, dist: W },
      ],
    }),
    accent,
    cam: { dist: 8.2, height: 5.8 },
  });
}

/**
 * Homes: one set of rooms per kind of home, from the shared flat to the mansion. His own home has his things:
 * the wardrobe with what he bought hanging in it, the trophy shelf, a bed or a sofa to rest on, the games
 * console if he has one, and (from the apartment up) a door down to the garage. A home he does not own yet is
 * shown staged for a viewing, with Buy and Rent by the door. The garage shows every car he owns: walk to one
 * and drive it out.
 */
import * as THREE from "three";
import type { CareerState, CatalogCar, WorldPlace } from "../../types";
import { rbox, cyl, sphere, plane, mat, glass, glow, makeVehicle, signTexture } from "../kit3d";
import { Kit, surfMat, shopLight, goodsMat, plant, viewTex, catalogOf, type Room } from "./common";
import { shapeGeo, shapeOf, isHanging } from "./goods";

export const isGarage = (p: WorldPlace) => p.id.endsWith("/garage");
export const garagePlace = (home: WorldPlace): WorldPlace => ({ ...home, id: home.id + "/garage", name: "Garage" });
type HomeExtra = WorldPlace & { living?: boolean; owned?: boolean };
/** he lives here, or owns it (the server says so on the place; older states are worked out) */
export function homeOwned(st: CareerState, p: WorldPlace) {
  const x = p as HomeExtra;
  const living = x.living ?? (st.life.home.id === p.homeId && (st.life.home.city ?? st.life.city) === st.life.city);
  const owned = x.owned ?? st.life.owned.some((o) => o.id === p.homeId && o.city === st.life.city);
  return { living: !!living, owned: !!owned, his: !!living || !!owned || p.homeId === "family" };
}
const TIER: Record<string, number> = { family: 0, hostel: 0, shared: 1, apartment: 2, penthouse: 3, villa: 4, mansion: 5 };

export function homeRoom(k: Kit, p: WorldPlace): Room {
  const st = k.st;
  const life = st.life;
  const id = p.homeId || "apartment";
  const tier = TIER[id] ?? 2;
  const { his } = homeOwned(st, p);
  const style = p.style;
  // the size of the place grows with the home
  const [W, D, H] = (
    [
      [10, 8, 2.8],
      [10, 8, 2.8],
      [13, 10, 3.0],
      [20, 14, 3.4],
      [22, 16, 3.6],
      [28, 22, 4.6],
    ] as [number, number, number][]
  )[tier];
  const view = p.where === "seafront" ? "sea" : p.where === "hill" || p.where === "outskirts" ? "hills" : "city";
  const night = k.night;
  const warm = tier <= 2;
  const floorM = tier >= 3 ? surfMat("marble", style.floor || "#ece6dc", "#b8ab98", { rough: 0.16 }) : surfMat(tier === 2 ? "parquet" : "wood", style.floor || "#a68a64", undefined, { rough: 0.55 });
  const wallM = mat(style.wall || "#efe9df", { rough: 0.9 });
  const trim = mat(style.trim || "#3b4048", { rough: 0.5 });
  const acc = style.accent || "#2a5bd7";
  // ---------- the shell: the door at the front, a window wall at the back ----------
  const outdoor = tier >= 4;
  const yard = outdoor ? 9 : 0;
  k.floor(W, D, floorM, 0, 0, tier >= 3 ? 2.6 : 3);
  const glassBack = tier >= 3;
  if (!glassBack) {
    const n = k.wall(-W / 2, -D / 2, W / 2, -D / 2, H, wallM, { solid: false });
    // a window with the view
    const vw = tier === 2 ? 5 : 2.4;
    k.sign(viewTex(view, life.style.sky, night, life.style.key), tier === 2 ? 1.5 : 1.2, 1.55, 0.13, vw, 1.5, 0, { to: n });
    k.mount(n, rbox(vw + 0.14, 1.64, 0.06, 0.02), trim, tier === 2 ? 1.5 : 1.2, 1.55, 0.1);
  } else {
    // floor to ceiling glass and the view beyond it
    k.add(rbox(W, 0.1, 0.12, 0.02), trim, 0, 0.05, -D / 2);
    k.add(rbox(W, 0.14, 0.14, 0.02), trim, 0, H, -D / 2);
    for (let x = -W / 2; x <= W / 2 + 1e-3; x += W / Math.round(W / 3.2)) k.add(rbox(0.06, H, 0.08, 0.01), trim, x, H / 2, -D / 2);
    const pane = mat("#dfeef6", { rough: 0.05, metal: 0.3, opacity: 0.1 });
    if (outdoor) {
      // sliding doors open in the middle
      k.wall(-W / 2, -D / 2, -1.6, -D / 2, H, pane, { thick: 0.04 });
      k.wall(1.6, -D / 2, W / 2, -D / 2, H, pane, { thick: 0.04 });
    } else k.wall(-W / 2, -D / 2, W / 2, -D / 2, H, pane, { thick: 0.04 });
    // the view: close enough that a look down through the glass still lands on it
    const far = outdoor ? yard + 6 : 8;
    k.sign(viewTex(view, life.style.sky, night, life.style.key), 0, 2.2, -D / 2 - far, W * 2 + 24, 17, 0);
    if (outdoor) {
      // the terrace, the pool and palms beyond the glass; sliding doors in the middle
      const deck = surfMat("wood", "#b89a72", undefined, { rough: 0.7 });
      k.floor(W + 10, yard, deck, 0, -D / 2 - yard / 2, 2);
      k.add(plane(W * 0.55, 4), glow("#3fbfe0", 0.7), 0, 0.045, -D / 2 - 5, 0, { rx: -Math.PI / 2, shadow: false });
      k.box(W * 0.55 + 0.4, 0.06, 4.4, mat("#f2efe8", { rough: 0.5 }), 0, 0.0, -D / 2 - 5);
      k.block(0, -D / 2 - 5, W * 0.275 + 0.2, 2.2);
      for (const sx of [-1, 1]) {
        const px = sx * (W * 0.38),
          pz = -D / 2 - 6.5;
        k.add(cyl(0.12, 0.18, 4.2, 8), mat("#7a5a3a", { rough: 0.9 }), px, 2.1, pz);
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          k.add(rbox(0.32, 0.04, 1.8, 0.02), mat("#2f6a34", { rough: 0.8 }), px + Math.cos(a) * 0.8, 4.3, pz + Math.sin(a) * 0.8, -a + Math.PI / 2, { rx: 0.45 });
        }
        k.circle(px, pz, 0.4);
        // loungers
        k.box(0.7, 0.3, 1.9, mat("#f4f2ec", { rough: 0.8 }), sx * (W * 0.3 + 1.6), 0.15, -D / 2 - 2.2, 0, 0.06);
        k.block(sx * (W * 0.3 + 1.6), -D / 2 - 2.2, 0.4, 1.0);
      }
      k.pool(0, -D / 2 - 5, 9, "#3fbfe0", 0.18);
    }
  }
  const sides = k.shell(W, D, H, wallM, { skip: ["n", "s"] });
  void sides;
  const gap = 1.6;
  const doorX = tier >= 5 ? 0 : -W / 2 + 2.2;
  if (tier >= 5) {
    // the mansion's rooms: a living room and a dressing room to the west, a cinema and the bedroom to the east,
    // the hall with the staircase in the middle
    const inner = { inner: true, thick: 0.18 };
    const wallsAt: [number, number, number, number][] = [
      [-5, -D / 2, -5, -2.5],
      [-5, 0.5, -5, 4],
      [-W / 2, 4, -8, 4],
      [-6.5, 4, -5, 4],
      [5, -D / 2, 5, -9],
      [5, -7.5, 5, 1],
      [5, 3, 5, 4],
      [5, -6, W / 2, -6],
      [5, 4, W / 2, 4],
    ];
    for (const [x1, z1, x2, z2] of wallsAt) k.wall(x1, z1, x2, z2, H, wallM, inner);
  }
  k.wall(W / 2, D / 2, doorX + gap / 2, D / 2, H, wallM, {});
  k.wall(doorX - gap / 2, D / 2, -W / 2, D / 2, H, wallM, {});
  const head = k.wall(doorX + gap / 2, D / 2, doorX - gap / 2, D / 2, H, wallM, { solid: false, low: 2.2 });
  k.mount(head, rbox(gap + 0.16, 0.1, 0.22, 0.02), trim, 0, 2.2, 0);
  k.spot("door", "Way out", doorX, D / 2 - 0.55, { r: 0.9, y: 1.6 });
  if (outdoor) k.block(doorX, D / 2 + 0.5, gap / 2 + 0.3, 0.3);
  // ---------- furniture by the size of the home ----------
  const sofaCol = tier >= 3 ? "#e8e2d6" : tier === 2 ? "#4a5560" : "#6a5a4a";
  const owns = (re: RegExp) => catalogOf(st).items.some((i) => i.owned && re.test(i.label)) || life.items.some((i) => i.owned && i.id === "console");
  const consoleOwned = owns(/playstation|xbox|switch|console|ps5/i);
  // the living area: a sofa facing a screen
  const lx = tier <= 1 ? 1.2 : tier === 2 ? -1.5 : -W / 2 + 6,
    lz = tier <= 1 ? 0.8 : tier === 2 ? 0.5 : 0.5;
  const sofaLen = tier <= 1 ? 2.2 : tier === 2 ? 2.8 : 3.6;
  sofa(k, lx, lz + 1.0, sofaLen, sofaCol, tier >= 3);
  tv(k, lx, lz - 1.8, tier <= 1 ? 1.2 : tier === 2 ? 1.8 : 2.6, consoleOwned);
  rug(k, lx, lz - 0.3, sofaLen + 0.8, 2.6, tier >= 3 ? "#d8cfc0" : "#3a4a5a");
  k.box(1.1, 0.35, 0.6, mat(tier >= 3 ? "#1a1a1a" : "#6b5340", { rough: 0.4 }), lx, 0.18, lz - 0.2);
  k.block(lx, lz - 0.2, 0.6, 0.35);
  // the bed (or for the smallest homes, a bed in the corner)
  const bx = W / 2 - (tier <= 1 ? 1.6 : 2.6),
    bz = -D / 2 + (tier <= 1 ? 1.6 : 2.4);
  bed(k, bx, bz, tier <= 1 ? 1.2 : tier >= 3 ? 2.0 : 1.6, tier >= 3 ? "#f2efe8" : "#e8e4dc", acc);
  // a kitchen
  const kx = tier <= 1 ? -W / 2 + 1.6 : tier === 2 ? 3.2 : tier >= 5 ? 9.5 : 1.4,
    kz = tier <= 1 ? -D / 2 + 0.6 : tier === 2 ? 1.6 : tier >= 5 ? 8.0 : 2.2;
  if (tier <= 1) {
    k.box(2.6, 0.9, 0.6, mat("#e8e4dc", { rough: 0.5 }), kx + 0.6, 0.45, kz);
    k.box(2.62, 0.04, 0.64, mat("#3a3a3a", { rough: 0.3 }), kx + 0.6, 0.92, kz);
    k.box(0.7, 1.8, 0.65, mat("#d8dcde", { metal: 0.4, rough: 0.3 }), kx - 1.0, 0.9, kz);
    k.block(kx + 0.2, kz, 1.75, 0.35);
  } else {
    k.box(tier >= 3 ? 3.4 : 2.4, 0.92, 1.0, mat(tier >= 3 ? "#f4f2ee" : "#f0eee8", { rough: 0.3 }), kx, 0.46, kz, 0, 0.03);
    k.box(tier >= 3 ? 3.5 : 2.5, 0.05, 1.1, mat("#1e1f22", { rough: 0.12, metal: 0.2 }), kx, 0.94, kz);
    for (let i = 0; i < (tier >= 3 ? 4 : 3); i++) k.add(cyl(0.18, 0.18, 0.7, 14), mat("#2a2c30", { metal: 0.5, rough: 0.4 }), kx - (tier >= 3 ? 1.2 : 0.8) + i * 0.8, 0.35, kz + 0.8);
    k.block(kx, kz, (tier >= 3 ? 3.4 : 2.4) / 2 + 0.05, 0.55);
    for (const ox of [-0.8, 0.8]) k.spotLamp(kx + ox, 2.4, kz, "#ffe0b0", { beam: 0.06, r: 0.6 });
  }
  // ---------- his things: the wardrobe, the trophies, the games ----------
  if (his) {
    // a wardrobe rail with what he bought hanging on it
    const wx = tier <= 1 ? W / 2 - 0.45 : -W / 2 + 0.6,
      wz = tier <= 1 ? 1.4 : D / 2 - 3.2;
    const side = tier <= 1 ? -1 : 1;
    const wm = mat(tier >= 3 ? "#2a2c30" : "#d9d2c2", { rough: 0.6 });
    k.box(0.08, 2.3, 2.5, wm, wx - side * 0.26, 1.15, wz);
    k.box(0.6, 0.08, 2.5, wm, wx, 2.3, wz);
    for (const ez of [-1.22, 1.22]) k.box(0.6, 2.3, 0.06, wm, wx, 1.15, wz + ez);
    k.add(cyl(0.02, 0.02, 2.3, 6), mat("#c8ccd2", { metal: 1, rough: 0.3 }), wx, 1.95, wz, 0, { rx: Math.PI / 2 });
    const clothes = catalogOf(st)
      .items.filter((i) => i.owned && isHanging(shapeOf(i)))
      .slice(0, 6);
    clothes.forEach((it, i) => {
      const s = shapeOf(it);
      k.inst("g|" + s, () => shapeGeo(s), goodsMat("cloth"), wx, 1.9, wz - 0.9 + i * 0.36, { ry: side * (Math.PI / 2), col: it.colour, s: 0.92 });
    });
    k.block(wx, wz, 0.32, 1.2);
    k.spot("wardrobe", "Wardrobe", wx + side * 1.15, wz, { r: 1.1, y: 1.6 });
    // the trophy shelf
    const tx = tier <= 1 ? -W / 2 + 0.3 : W / 2 - 0.35,
      tz = tier <= 1 ? 1.6 : tier >= 5 ? 6.2 : 1.4;
    const ts = tier <= 1 ? 1 : -1;
    k.box(0.4, 1.9, 1.8, tier >= 3 ? glass("#c8d6e2", 0.25) : mat("#5a3e2a", { rough: 0.6 }), tx, 0.95, tz);
    for (const y of [0.6, 1.1, 1.6]) k.add(rbox(0.38, 0.03, 1.76, 0.005), mat("#2a1d15", { rough: 0.5 }), tx, y, tz);
    const cups = Math.min(12, st.trophies.length + st.awards.length);
    for (let i = 0; i < cups; i++) {
      const y = 0.62 + Math.floor(i / 4) * 0.5,
        z = tz - 0.66 + (i % 4) * 0.44;
      k.inst("cup", () => cupGeo(), goodsMat("metal"), tx, y, z, { col: i < st.trophies.length ? "#e8c46a" : "#c8ccd2" });
    }
    // a framed shirt with his number above
    k.add(rbox(0.04, 0.8, 0.6, 0.01), mat("#111111"), tx - ts * 0.18, 2.35, tz, 0, { shadow: false });
    k.sign(signTexture(String(st.player.num || 9), "#ffffff", st.kit?.[0] || acc, 256, 320, "900 200px Inter, sans-serif"), tx - ts * 0.205, 2.35, tz, 0.5, 0.7, (ts * Math.PI) / 2);
    k.block(tx, tz, 0.25, 0.95);
    k.spot("trophies", "Trophy shelf", tx + ts * 1.0, tz, { r: 1.0, y: 1.4 });
    k.spot("rest", tier <= 1 ? "Lie down and rest" : "Rest", bx - (tier <= 1 ? 1.0 : 1.5), bz + 0.6, { r: 1.1, y: 1.0 });
    if (consoleOwned) k.spot("unwind", "Play some games", lx + 0.9, lz - 0.9, { r: 1.0, y: 1.2 });
    if (tier >= 2) {
      // the door down to the garage, the lift in the bigger homes
      const gx = W / 2 - 0.12,
        gz = D / 2 - 2.0;
      k.box(0.1, 2.3, 1.3, mat(tier >= 3 ? "#c8ccd2" : "#6a5a4a", { metal: tier >= 3 ? 0.8 : 0, rough: 0.3 }), gx, 1.15, gz);
      k.sign(signTexture(tier >= 3 ? "LIFT TO GARAGE" : "GARAGE", "#ffffff", "#1a1a1a", 512, 96), gx - 0.07, 2.5, gz, 1.0, 0.24, -Math.PI / 2);
      k.spot("garage", tier >= 3 ? "Lift to the garage" : "The garage", gx - 0.9, gz, { r: 1.0, y: 1.6 });
    }
  } else {
    // a viewing: staged, with the agent's sign by the door and Buy and Rent next to it
    const h = life.homes.find((x) => x.id === id);
    k.add(rbox(0.05, 1.2, 0.05, 0.01), mat("#2a2a2a"), doorX + 1.4, 0.6, D / 2 - 1.0);
    k.sign(signTexture("FOR SALE", "#ffffff", acc, 512, 280, "800 120px Inter, sans-serif"), doorX + 1.4, 1.35, D / 2 - 1.0, 0.9, 0.5, 0);
    if (!h || h.buy > 0) k.spot("buy-home", "Buy this home", doorX + 1.6, D / 2 - 2.0, { r: 0.95, y: 1.4 });
    if (!h || h.rent > 0) k.spot("rent-home", "Rent it", doorX - 0.2, D / 2 - 2.5, { r: 0.95, y: 1.4 });
  }
  // ---------- the bigger homes: a dining table, a piano, a chandelier, a cinema ----------
  if (tier >= 3) {
    const dx = tier >= 5 ? 0 : W / 2 - 4.4,
      dz = tier >= 5 ? 6.4 : 2.6;
    k.box(2.6, 0.05, 1.1, mat("#1a1a1a", { rough: 0.15, metal: 0.2 }), dx, 0.76, dz);
    k.box(0.12, 0.74, 0.8, mat("#1a1a1a"), dx - 1.0, 0.37, dz);
    k.box(0.12, 0.74, 0.8, mat("#1a1a1a"), dx + 1.0, 0.37, dz);
    for (let i = 0; i < 6; i++) k.box(0.45, 0.85, 0.45, mat("#e8e2d6", { rough: 0.8 }), dx - 1.0 + (i % 3) * 1.0, 0.42, dz + (i < 3 ? -0.85 : 0.85), 0, 0.05);
    k.block(dx, dz, 1.6, 1.1);
    k.spotLamp(dx, 2.6, dz, "#ffe0b0", { r: 1.0, pool: 0.14 });
    rug(k, dx, dz, 4.2, 3.0, tier >= 5 ? "#6a2a2a" : "#c8bfae");
  }
  if (tier >= 4) {
    // a grand piano by the glass
    k.box(1.5, 0.3, 1.9, mat("#0b0b0b", { rough: 0.1, metal: 0.3 }), -W / 2 + 2.4, 0.85, -D / 2 + 2.2, 0.4, 0.1);
    for (const [ox, oz] of [
      [-0.5, -0.6],
      [0.5, -0.6],
      [0, 0.7],
    ])
      k.add(cyl(0.05, 0.05, 0.7, 8), mat("#0b0b0b"), -W / 2 + 2.4 + ox, 0.35, -D / 2 + 2.2 + oz);
    k.circle(-W / 2 + 2.4, -D / 2 + 2.2, 1.1);
  }
  if (tier >= 5) {
    // a sweeping staircase to the floor above, a chandelier, the cinema room behind glass
    for (let i = 0; i < 14; i++) k.box(2.4, 0.18, 0.4, mat("#f2efe8", { rough: 0.4 }), -1.6 + i * 0.05, 0.09 + i * 0.18, -D / 2 + 6.0 - i * 0.32, 0.12);
    k.block(-1.3, -D / 2 + 3.8, 1.4, 2.4);
    const gold = mat("#c9a24a", { metal: 1, rough: 0.25 });
    k.add(new THREE.TorusGeometry(1.0, 0.03, 6, 32), gold, 0, H - 1.2, 0, 0, { rx: Math.PI / 2, shadow: false });
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      k.add(new THREE.OctahedronGeometry(0.06), mat("#f4f8ff", { rough: 0.05, emissive: "#fff2dc", ei: 0.7 }), Math.cos(a), H - 1.35, Math.sin(a), 0, { s: [1, 2, 1], shadow: false });
    }
    k.add(sphere(0.25, 12), glow("#fff0d8", 2), 0, H - 1.3, 0, 0, { shadow: false });
    k.pool(0, 0, 7, "#ffe6c0", 0.16);
    for (const sx of [-3.2, 1.6]) plant(k, sx, -D / 2 + 2.0, 1.6);
    // the cinema: a big screen and recliners at the east end
    const cx = W / 2 - 4,
      cz = -2;
    k.add(rbox(4.2, 2.2, 0.08, 0.02), mat("#050505"), cx, 1.7, cz - 2.6);
    k.add(plane(4.0, 2.0), glow("#2a4a7a", 0.8), cx, 1.7, cz - 2.55, 0, { shadow: false });
    for (let i = 0; i < 3; i++) k.box(1.0, 0.7, 1.0, mat("#5a1a1a", { rough: 0.7 }), cx - 1.2 + i * 1.2, 0.35, cz, 0, 0.12);
    k.block(cx, cz, 1.8, 0.55);
    k.block(cx, cz - 2.6, 2.1, 0.15);
  }
  // plants and lamps everywhere, more of them the bigger the home
  plant(k, -W / 2 + 0.6, -D / 2 + 0.7, 1.2);
  if (tier >= 2) plant(k, W / 2 - 0.6, D / 2 - 0.7, 1.1);
  if (tier >= 3) plant(k, -W / 2 + 0.7, 0, 1.4);
  // a floor lamp at the end of the sofa
  k.add(cyl(0.16, 0.18, 0.03, 16), mat("#1b1c1e", { metal: 0.6, rough: 0.4 }), lx - sofaLen / 2 - 0.45, 0.015, lz + 1.0);
  k.add(cyl(0.015, 0.015, 1.55, 6), mat("#1b1c1e", { metal: 0.6, rough: 0.4 }), lx - sofaLen / 2 - 0.45, 0.8, lz + 1.0);
  k.spotLamp(lx - sofaLen / 2 - 0.45, 1.6, lz + 1.0, "#ffd9a0", { shade: "#e8dcc4", r: 0.8, pool: 0.3, cord: 0 });
  k.circle(lx - sofaLen / 2 - 0.45, lz + 1.0, 0.2);
  // art on the walls
  const art = ["#c8102e", "#1e5aa8", "#e8c040", "#2e7d32"];
  for (let i = 0; i < (tier >= 3 ? 3 : 1); i++) k.box(1.2, 0.9, 0.04, mat(art[(i + tier) % 4], { rough: 0.8 }), -W / 2 + 0.14, 1.8, -D / 4 + i * 2.2 - 1, Math.PI / 2, 0.01);
  if (life.style && tier <= 1) {
    // posters and a bit of mess
    for (const [i, t] of ["DREAM", "WORK"].entries()) {
      k.sign(signTexture(t, "#f2f4ee", "#0d0f0c", 256, 384, "800 60px Inter, sans-serif"), -W / 2 + 0.12, 1.6, -1.6 + i * 1.0, 0.6, 0.9, Math.PI / 2);
    }
    if (id === "shared") {
      for (let i = 0; i < 3; i++) k.box(0.42, 0.05, 0.42, mat("#c8a070", { rough: 0.9 }), lx + 1.4, 0.03 + i * 0.05, lz - 1.2, i * 0.3);
      k.box(1.2, 1.0, 0.5, mat("#c8ccd2", { metal: 0.6, rough: 0.4 }), -W / 2 + 0.6, 0.5, D / 2 - 2.6);
      k.block(-W / 2 + 0.6, D / 2 - 2.6, 0.3, 0.6);
    }
  }
  return k.finish({
    w: W,
    d: outdoor ? D + yard * 2 : D,
    spawn: [doorX + 0.6, D / 2 - 2.1],
    mood: "warm",
    light: shopLight({
      warm: true,
      hemi: warm ? 0.7 : 0.85,
      keyI: 1.0,
      ground: "#2a2420",
      bg: "#0a0b0d",
      points: [{ x: 0, y: H - 0.4, z: 0, col: "#ffe2b8", i: tier >= 3 ? 9 : 6, dist: Math.max(W, D) * 1.3 }],
    }),
    accent: acc,
    apron: tier === 3 ? null : undefined,
    cam: tier >= 4 ? { dist: 7.2, height: 5.6 } : undefined,
  });
}

// ---------- the furniture ----------
function sofa(k: Kit, x: number, z: number, len: number, col: string, lshape: boolean) {
  const m = mat(col, { rough: 0.95 });
  k.box(len, 0.42, 0.95, m, x, 0.21, z, 0, 0.1);
  k.box(len, 0.5, 0.22, m, x, 0.62, z + 0.38, 0, 0.08);
  for (let i = 0; i < Math.round(len / 1.0); i++) k.box(0.9, 0.12, 0.75, mat(col === "#e8e2d6" ? "#f4f0e8" : "#5a6470", { rough: 1 }), x - len / 2 + 0.55 + i * 1.0, 0.48, z - 0.05, 0, 0.05);
  k.block(x, z + 0.05, len / 2 + 0.05, 0.5);
  if (lshape) {
    k.box(0.95, 0.42, 1.8, m, x - len / 2 + 0.47, 0.21, z - 1.3, 0, 0.1);
    k.block(x - len / 2 + 0.47, z - 1.3, 0.5, 0.9);
  }
}
function tv(k: Kit, x: number, z: number, w: number, games: boolean) {
  k.box(w + 0.4, 0.42, 0.45, mat("#24262a", { rough: 0.5 }), x, 0.21, z);
  k.box(w, w * 0.56, 0.05, mat("#0a0b0c", { rough: 0.2, metal: 0.4 }), x, 0.42 + w * 0.32, z);
  k.add(plane(w - 0.06, w * 0.56 - 0.06), glow(games ? "#3a6a9a" : "#2a4060", 0.75), x, 0.42 + w * 0.32, z + 0.03, 0, { shadow: false });
  if (games) k.box(0.36, 0.08, 0.28, mat("#f2f2f2", { rough: 0.3 }), x + w / 2 - 0.1, 0.46, z);
  k.block(x, z, w / 2 + 0.2, 0.25);
}
function bed(k: Kit, x: number, z: number, w: number, sheet: string, acc: string) {
  k.box(w + 0.1, 0.35, 2.1, mat("#5a3e2a", { rough: 0.7 }), x, 0.18, z, 0, 0.06);
  k.box(w, 0.22, 2.0, mat(sheet, { rough: 0.95 }), x, 0.46, z, 0, 0.1);
  k.box(w + 0.02, 0.08, 1.2, mat(acc, { rough: 0.95 }), x, 0.6, z + 0.35, 0, 0.04);
  k.box(w * 0.4, 0.14, 0.4, mat("#f4f2ec", { rough: 1 }), x - w * 0.22, 0.64, z - 0.75, 0, 0.07);
  k.box(w * 0.4, 0.14, 0.4, mat("#f4f2ec", { rough: 1 }), x + w * 0.22, 0.64, z - 0.75, 0, 0.07);
  k.box(w + 0.2, 1.0, 0.12, mat("#3a2a1e", { rough: 0.6 }), x, 0.6, z - 1.08);
  k.block(x, z, w / 2 + 0.1, 1.1);
}
function rug(k: Kit, x: number, z: number, w: number, d: number, col: string) {
  k.add(rbox(w, 0.02, d, 0.01), mat(col, { rough: 1 }), x, 0.012, z, 0, { shadow: false });
}
let cupCache: THREE.BufferGeometry | null = null;
function cupGeo() {
  if (!cupCache) {
    const g = new THREE.LatheGeometry(
      [
        [0.0, 0],
        [0.08, 0],
        [0.07, 0.03],
        [0.025, 0.06],
        [0.025, 0.14],
        [0.09, 0.2],
        [0.1, 0.32],
        [0.0, 0.3],
      ].map(([a, b]) => new THREE.Vector2(a, b)),
      12,
    ).toNonIndexed();
    g.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
    cupCache = g;
  }
  return cupCache.clone();
}

// ---------- the garage: every car he owns, in rows ----------
export function garageRoom(k: Kit, p: WorldPlace): Room {
  const st = k.st;
  const cat = catalogOf(st);
  const ids = new Set<string>(st.life.garage || []);
  for (const c of cat.cars) if (c.owned) ids.add(c.id);
  for (const c of st.life.cars) if (c.owned) ids.add(c.id);
  const cars = [...ids]
    .map((id) => cat.cars.find((c) => c.id === id) || (st.life.cars.find((c) => c.id === id) as unknown as CatalogCar | undefined))
    .filter((c): c is CatalogCar => !!c)
    .sort((a, b) => b.price - a.price);
  const perRow = Math.max(3, Math.min(6, Math.ceil(cars.length / 2)));
  const rows = cars.length > perRow ? 2 : 1;
  const bay = 3.8;
  const W = Math.max(14, perRow * bay + 4),
    D = rows === 2 ? 19 : 12,
    H = 3.6;
  k.floor(W, D, surfMat("epoxy", "#5a5e62", undefined, { rough: 0.62 }), 0, 0, 3);
  const wallM = mat("#e8e8e4", { rough: 0.9 });
  const walls = k.shell(W, D, H, wallM, { skip: [] });
  // a roller door, a tool wall, light strips, yellow bay lines
  k.mount(walls.s!, plane(5, 2.8), surfMat("slats", "#9aa0a6"), 2, 1.4, -0.13, { ry: Math.PI });
  k.mount(walls.n!, rbox(4, 1.8, 0.05, 0.01), mat("#2a2c2e", { rough: 0.6 }), -W / 2 + 3, 1.6, 0.14);
  for (let i = 0; i < 9; i++) k.mount(walls.n!, rbox(0.05, 0.3, 0.04, 0.005), mat(["#c8102e", "#f4d03f", "#c8ccd2"][i % 3], { metal: 0.5, rough: 0.4 }), -W / 2 + 1.4 + i * 0.4, 1.7, 0.18);
  const line = glow("#e8c040", 0.7);
  const rowZ = rows === 2 ? [-D / 2 + 3.4, D / 2 - 3.4] : [-D / 2 + 3.6];
  const hx = -W / 2 + 0.12,
    hz = rows === 2 ? 0 : D / 2 - 2.2;
  k.box(0.1, 2.2, 1.2, mat("#6a5a4a", { rough: 0.5 }), hx, 1.1, hz);
  k.spot("house", "Back into the house", hx + 0.9, hz, { r: 1.0, y: 1.6 });
  cars.forEach((c, i) => {
    const r = Math.floor(i / perRow),
      col = i % perRow;
    const n = Math.min(perRow, cars.length - r * perRow);
    const x = (col - (n - 1) / 2) * bay;
    const z = rowZ[r];
    const face = r === 0 ? 0 : Math.PI;
    const v = makeVehicle(c);
    k.own.push({ dispose: () => v.userData.dispose?.() });
    k.still(v, x, 0, z, face);
    for (const sx of [-1, 1]) k.add(plane(0.08, 5), line, x + sx * bay * 0.5, 0.012, z, 0, { rx: -Math.PI / 2, shadow: false });
    const bike = c.body === "bike" || c.body === "scooter";
    k.block(x, z, bike ? 0.5 : 1.05, bike ? 1.1 : 2.4);
    const sz = z + (r === 0 ? 3.3 : -3.3);
    k.spot("drive:" + c.id, c.brand + " " + c.model, x, sz, { ax: x, az: z, y: 1.5, r: 1.4 });
    k.pool(x, z, 4.4, "#f4f8ff", 0.16);
  });
  if (!cars.length) k.text("NOTHING PARKED YET", "#8a8a8a", "#e8e8e4", 0, 1.8, -D / 2 + 0.14, 5, 0.6, 0);
  for (const z of rowZ) k.add(rbox(W - 2, 0.05, 0.14, 0.01), glow("#f4f8ff", 1.6), 0, H - 0.15, z, 0, { shadow: false });
  void rbox;
  return k.finish({
    w: W,
    d: D,
    spawn: [hx + 2.4, hz],
    mood: "cool",
    light: shopLight({ hemi: 0.9, keyI: 1.0, ground: "#3a3a3a", points: [{ x: 0, y: H - 0.4, z: 0, col: "#f4f8ff", i: 9, dist: W * 1.2 }] }),
    accent: p.style.accent || "#d4af37",
    cam: { dist: 7.4, height: 5.4 },
  });
}

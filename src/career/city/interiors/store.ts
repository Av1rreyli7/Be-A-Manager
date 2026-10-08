/**
 * A clothing store (and the boots, tech and jewellery shops): one builder, dressed per brand. Rails along the
 * walls, freestanding rails, tables, mannequins in the window and plinths under spotlights, every real item for
 * sale drawn in its own colour where you can walk up to it. The rest of the rails fill with stock in the brand's
 * colours so the shop never looks empty. Built in local space with the door at +z, so the mall can place the
 * same shop behind its own shop front.
 */
import * as THREE from "three";
import type { CatalogItem, WorldPlace } from "../../types";
import { rbox, cyl, sphere, plane, mat, glass, glow, cone } from "../kit3d";
import { Kit, surfMat, goodsMat, shopLight, plant, type RoomLight } from "./common";
import { lookFor, logoTex, heartTex, ledTex, type BrandLook } from "./brand";
import { shapeGeo, shapeOf, wornGeo, foldGeo, SHAPE_MID, isHanging, goodsKind, type Shape } from "./goods";

interface Slot {
  x: number;
  y: number;
  z: number;
  ry: number;
  kind: "hang" | "top";
  sx: number;
  sz: number;
}

/** the biggest share of what a shop sells */
export function mostlyOf(items: CatalogItem[]) {
  const n: Record<string, number> = {};
  for (const i of items) n[i.cat] = (n[i.cat] || 0) + 1;
  return Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0] || "top";
}

/** a store: w wide, d deep, the way in at +z; standalone or behind a shop front in the mall */
export function buildStore(k: Kit, p: WorldPlace, o: { w?: number; d?: number; inMall?: boolean } = {}): { look: BrandLook; light: RoomLight } {
  const items = k.cat.items.filter((i) => i.store === p.id);
  const mostly = mostlyOf(items);
  const look = lookFor(p, mostly);
  const lux = look.luxury;
  const w = o.w ?? (lux ? 13 : 14),
    d = o.d ?? 11;
  const H = lux ? 4.6 : 4.2;
  const R = k.rnd;
  const wallM = mat(look.wallBase, { rough: 0.9 });
  const faceM = surfMat(look.wall[0], look.wall[1], look.wall[2], { rough: look.wall[0] === "marble" ? 0.2 : 0.9 });
  const floorM = surfMat(look.floor[0], look.floor[1], look.floor[2], { rough: look.floorRough, metal: look.floorRough < 0.25 ? 0.15 : 0 });
  k.floor(w, d, floorM, 0, 0, look.floorTile);
  // ---------- walls: the back and the two sides, the front with its door ----------
  // in the mall the side walls are plain (fewer draws), the back wall keeps the brand's surface
  const sideFace = o.inMall ? undefined : faceM;
  const back = k.wall(-w / 2, -d / 2, w / 2, -d / 2, H, wallM, { face: faceM, tile: look.wallTile, solid: false, inner: o.inMall });
  const west = k.wall(-w / 2, d / 2, -w / 2, -d / 2, H, wallM, { face: sideFace, tile: look.wallTile, solid: !!o.inMall, inner: o.inMall });
  const east = k.wall(w / 2, -d / 2, w / 2, d / 2, H, wallM, { face: sideFace, tile: look.wallTile, solid: !!o.inMall, inner: o.inMall });
  const gap = o.inMall ? 3.2 : 2.4;
  if (o.inMall) shopFront(k, p, look, w, d, H, gap);
  else {
    k.wall(w / 2, d / 2, gap / 2, d / 2, H, wallM, { face: faceM, tile: look.wallTile });
    k.wall(-gap / 2, d / 2, -w / 2, d / 2, H, wallM, { face: faceM, tile: look.wallTile });
    const head = k.wall(gap / 2, d / 2, -gap / 2, d / 2, H, wallM, { solid: false, low: 2.7 });
    // a door frame and a mat
    k.mount(head, rbox(gap + 0.2, 0.12, 0.26, 0.02), mat(look.rail, { metal: look.railMetal, rough: 0.3 }), 0, 2.64, 0);
    k.box(1.8, 0.008, 0.8, mat("#2c2c2a", { rough: 1 }), 0, 0.005, d / 2 - 0.5);
    k.spot("door", "Way out", 0, d / 2 - 0.55, { r: 1.0, y: 1.6 });
  }
  // a skirting line and a top line in the trim colour
  for (const wg of o.inMall ? [] : [back, west, east]) k.mount(wg, rbox(wg === back ? w : d, 0.12, 0.03, 0.01), mat(look.rail, { metal: look.railMetal * 0.6, rough: 0.4 }), 0, 0.06, 0.12);
  // ---------- the back wall: the logo and the brand's big moment ----------
  const logo = logoTex(look, p.brand || p.name);
  k.sign(logo, 0, H - 1.1, 0.13, 4.4, 1.1, 0, { to: back });
  featureWall(k, back, look, w, d, H);
  // ---------- the wall units along the sides: uprights, a bar, a shelf of folded stock above ----------
  const slots: Slot[] = [];
  const railM = mat(look.rail, { metal: look.railMetal, rough: 0.3 });
  const shelfM = mat(look.table, { rough: 0.6 });
  const step = lux ? 1.0 : 0.66;
  // what the shop sells decides its fixtures: rails for clothes, lit shelves for boots, tables for tech, glass for jewellery
  const sells: "clothes" | "boots" | "tech" | "jewellery" =
    mostly === "boots" || p.id === "boots" ? "boots" : mostly === "tech" ? "tech" : mostly === "jewellery" || mostly === "watch" ? "jewellery" : "clothes";
  const shelfSlots: Slot[] = [];
  if (sells === "clothes") {
    for (const side of [-1, 1]) {
      const z0 = -d / 2 + 1.5,
        z1 = d / 2 - (o.inMall ? 1.9 : 2.2);
      const len = z1 - z0 + 0.6,
        zc = (z0 + z1) / 2;
      const xw = side * (w / 2 - 0.42);
      k.add(cyl(0.022, 0.022, len, 8), railM, xw, 1.76, zc, 0, { rx: Math.PI / 2 });
      for (const zz of [zc - len / 2, zc + len / 2]) k.add(rbox(0.05, 2.3, 0.05, 0.01), railM, xw, 1.15, zz);
      k.add(rbox(0.42, 0.04, len, 0.01), shelfM, side * (w / 2 - 0.3), 2.25, zc);
      k.block(side * (w / 2 - 0.3), zc, 0.36, len / 2);
      for (let z = z0; z <= z1 + 1e-3; z += step) slots.push({ x: xw, y: 1.7, z, ry: side < 0 ? Math.PI / 2 : -Math.PI / 2, kind: "hang", sx: side * (w / 2 - 1.45), sz: z });
      for (let z = z0; z <= z1 + 1e-3; z += lux ? 1.0 : 0.5) {
        if (R() > look.density * k.dense) continue;
        for (let s = 0; s < 3 + Math.floor(R() * 3); s++) k.inst("fold", foldGeo, goodsMat("cloth"), side * (w / 2 - 0.3), 2.29 + s * 0.06, z, { ry: Math.PI / 2, col: pick(look.palette, R) });
      }
    }
  } else {
    // shelving down both side walls; the boots and the gadgets sit on it, eye level first
    const z0 = -d / 2 + 1.4,
      z1 = d / 2 - (o.inMall ? 1.9 : 2.2);
    const len = z1 - z0 + 0.6,
      zc = (z0 + z1) / 2;
    const glassy = sells === "jewellery";
    const levels = glassy ? [1.0] : [1.25, 0.85, 1.65, 0.45];
    for (const side of [-1, 1]) {
      const xs = side * (w / 2 - 0.32);
      if (glassy) {
        k.box(0.6, 0.95, len, mat(look.table, { rough: 0.3 }), xs - side * 0.05, 0.48, zc, 0, 0.02);
        k.add(rbox(0.56, 0.36, len - 0.04, 0.01), glass("#eef4f8", 0.14), xs - side * 0.05, 1.14, zc, 0, { shadow: false });
        k.add(rbox(0.5, 0.02, len - 0.1, 0.005), glow("#fff6e4", 0.5), xs - side * 0.05, 0.97, zc, 0, { shadow: false });
      } else {
        k.box(0.06, 2.1, len, mat(look.table, { rough: 0.6 }), side * (w / 2 - 0.12), 1.05, zc);
        for (const y of levels) {
          k.add(rbox(0.42, 0.03, len, 0.005), mat(look.table, { rough: 0.5 }), xs, y - 0.02, zc);
          if (sells === "boots") k.add(rbox(0.02, 0.02, len, 0.004), glow(look.accent, 1.4), xs - side * 0.2, y - 0.035, zc, 0, { shadow: false });
        }
      }
      k.block(xs, zc, 0.36, len / 2);
      const stepZ = sells === "boots" ? 0.5 : 0.62;
      for (const y of levels) for (let z = z0; z <= z1 + 1e-3; z += stepZ) shelfSlots.push({ x: xs, y, z, ry: side < 0 ? Math.PI / 2 : -Math.PI / 2, kind: "top", sx: side * (w / 2 - 1.35), sz: z });
    }
    // the boot wall at the back: every lit shelf full
    if (sells === "boots")
      for (let r = 0; r < 4; r++)
        for (let x = -w / 2 + 1.6; x <= w / 2 - 1.6 + 1e-3; x += 0.48) shelfSlots.push({ x, y: 0.72 + r * 0.45, z: -d / 2 + 0.32, ry: 0, kind: "top", sx: x, sz: -d / 2 + 1.5 });
  }
  // ---------- the floor: rails, tables, plinths, mannequins ----------
  const tableM = mat(look.table, { rough: lux ? 0.25 : 0.55, metal: lux ? 0.1 : 0 });
  const plinthM = mat(look.plinth, { rough: lux ? 0.18 : 0.5, metal: lux ? 0.2 : 0 });
  const rail = (cx: number, cz: number, len: number) => {
    for (const s of [-1, 1]) {
      k.add(cyl(0.022, 0.022, 1.78, 8), railM, cx + (s * len) / 2, 0.89, cz);
      k.add(rbox(0.06, 0.04, 0.5, 0.01), railM, cx + (s * len) / 2, 0.02, cz);
    }
    k.add(cyl(0.02, 0.02, len, 8), railM, cx, 1.76, cz, 0, { rz: Math.PI / 2 });
    k.block(cx, cz, len / 2 + 0.05, 0.22);
    const n = Math.max(2, Math.floor(len / (lux ? 0.9 : 0.6)));
    for (let i = 0; i < n; i++) {
      const x = cx - len / 2 + (len / n) * (i + 0.5);
      slots.push({ x, y: 1.7, z: cz + 0.09, ry: 0, kind: "hang", sx: x, sz: cz + 1.05 });
      slots.push({ x, y: 1.7, z: cz - 0.09, ry: Math.PI, kind: "hang", sx: x, sz: cz - 1.05 });
    }
  };
  const table = (cx: number, cz: number, tw: number, td: number, n: number) => {
    k.box(tw, 0.06, td, tableM, cx, 0.82, cz, 0, 0.02);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.add(rbox(0.06, 0.8, 0.06, 0.01), tableM, cx + sx * (tw / 2 - 0.08), 0.4, cz + sz * (td / 2 - 0.08));
    k.block(cx, cz, tw / 2 + 0.05, td / 2 + 0.05);
    for (let i = 0; i < n; i++) {
      const x = cx - tw / 2 + (tw / n) * (i + 0.5);
      slots.push({ x, y: 0.85, z: cz, ry: 0, kind: "top", sx: x, sz: cz + td / 2 + 0.75 });
    }
    // folded stock round the edges
    for (let i = 0; i < Math.round(n * 1.5); i++) {
      if (R() > look.density * k.dense) continue;
      const x = cx - tw / 2 + 0.25 + R() * (tw - 0.5);
      for (let s = 0; s < 2 + Math.floor(R() * 4); s++) k.inst("fold", foldGeo, goodsMat("cloth"), x, 0.86 + s * 0.06, cz - td / 2 + 0.2, { ry: (R() - 0.5) * 0.1, col: pick(look.palette, R) });
    }
  };
  const plinth = (cx: number, cz: number, h = 1.0) => {
    k.box(0.7, h, 0.7, plinthM, cx, h / 2, cz, 0, 0.02);
    if (lux) {
      k.add(rbox(0.66, 0.5, 0.66, 0.01), glass("#e8eef4", 0.16), cx, h + 0.25, cz, 0, { shadow: false });
      k.spotLamp(cx, H - 0.5, cz, look.lightCol, { beam: 0.06, pool: 0.25, r: 0.5 });
    }
    k.block(cx, cz, 0.4, 0.4);
    slots.push({ x: cx, y: h + 0.02, z: cz, ry: 0, kind: "top", sx: cx, sz: cz + 1.05 });
  };
  if (sells !== "clothes") {
    if (sells === "jewellery") {
      // a glass island in the middle
      for (const cx of [-1.4, 1.4]) {
        k.box(2.0, 0.95, 0.7, mat(look.table, { rough: 0.3 }), cx, 0.48, -0.6, 0, 0.02);
        k.add(rbox(1.96, 0.34, 0.66, 0.01), glass("#eef4f8", 0.14), cx, 1.13, -0.6, 0, { shadow: false });
        k.add(rbox(1.9, 0.02, 0.6, 0.005), glow("#fff6e4", 0.5), cx, 0.97, -0.6, 0, { shadow: false });
        k.block(cx, -0.6, 1.05, 0.4);
        for (let i = 0; i < 3; i++) slots.push({ x: cx - 0.6 + i * 0.6, y: 1.0, z: -0.6, ry: 0, kind: "top", sx: cx - 0.6 + i * 0.6, sz: 0.55 });
        k.spotLamp(cx, H - 0.6, -0.6, look.lightCol, { r: 0.7, pool: 0.25 });
      }
    } else {
      // long tables down the middle; benches to try boots on
      const tw = sells === "tech" ? 3.4 : 2.2;
      for (const [cx, cz] of [
        [-2.4, 0.4],
        [2.4, 0.4],
        [0, -2.4],
      ]) {
        k.box(tw, 0.06, 1.0, mat(sells === "tech" ? "#c9a87a" : look.table, { rough: 0.45 }), cx, 0.86, cz, 0, 0.02);
        k.box(tw - 0.2, 0.82, 0.12, mat(sells === "tech" ? "#c9a87a" : look.table, { rough: 0.5 }), cx, 0.41, cz);
        k.block(cx, cz, tw / 2 + 0.05, 0.55);
        const n = sells === "tech" ? 4 : 3;
        for (let i = 0; i < n; i++) slots.push({ x: cx - tw / 2 + (tw / n) * (i + 0.5), y: 0.9, z: cz, ry: 0, kind: "top", sx: cx - tw / 2 + (tw / n) * (i + 0.5), sz: cz + 1.25 });
      }
      if (sells === "boots")
        for (const cz of [2.8, -4.4]) {
          k.box(2.2, 0.42, 0.5, mat("#2a2a2a", { rough: 0.6 }), 0, 0.21, cz, 0, 0.06);
          k.block(0, cz, 1.15, 0.3);
        }
    }
    slots.push(...shelfSlots);
  } else if (lux) {
    rail(-w / 2 + 3.6, -0.8, 2.0);
    rail(w / 2 - 3.6, -0.8, 2.0);
    plinth(-1.6, 1.2);
    plinth(1.6, 1.2);
    plinth(-1.6, -2.4, 1.1);
    plinth(1.6, -2.4, 1.1);
    table(0, -d / 2 + 2.0, 2.2, 0.8, 3);
    // somewhere to sit while he decides
    const seat = mat(look.key === "gucci" ? "#8a1a24" : look.key === "lv" ? "#6a4426" : look.key === "dior" ? "#c8c4be" : "#1a1a1a", { rough: 0.8 });
    k.box(1.6, 0.42, 0.7, seat, 0, 0.21, 1.4, 0, 0.12);
    k.block(0, 1.4, 0.85, 0.4);
  } else {
    rail(-w / 2 + 3.9, 0.6, 2.6);
    rail(w / 2 - 3.9, 0.6, 2.6);
    rail(-w / 2 + 3.9, -2.0, 2.6);
    rail(w / 2 - 3.9, -2.0, 2.6);
    table(0, -0.7, 2.0, 0.9, 3);
    table(0, d / 2 - (o.inMall ? 3.6 : 3.4), 1.8, 0.8, 2);
  }
  // the till
  const tx = w / 2 - 2.0,
    tz = -d / 2 + 1.5;
  k.box(2.2, 1.0, 0.7, tableM, tx, 0.5, tz);
  k.box(2.26, 0.04, 0.76, mat(look.rail, { metal: look.railMetal, rough: 0.3 }), tx, 1.02, tz);
  k.box(0.32, 0.22, 0.04, mat("#111111"), tx - 0.4, 1.17, tz - 0.1, 0.3);
  k.add(rbox(0.28, 0.18, 0.01, 0.005), glow("#9ec8ff", 0.7), tx - 0.4, 1.17, tz - 0.077, 0.3);
  k.box(0.3, 0.36, 0.14, mat(look.signBg, { rough: 0.8 }), tx + 0.6, 1.22, tz);
  k.block(tx, tz, 1.15, 0.4);
  // mannequins in the window, wearing the shop's best things
  const tops = items.filter((i) => ["top", "outer"].includes(i.cat)).sort((a, b) => b.price - a.price);
  const bottoms = items.filter((i) => i.cat === "bottom");
  const mz = d / 2 - (o.inMall ? 1.25 : 1.6);
  const mxs = o.inMall ? [-w / 2 + 1.4, -w / 2 + 2.5, w / 2 - 2.5, w / 2 - 1.4] : [-w / 2 + 2.0, w / 2 - 2.0];
  if (sells === "clothes")
    mxs.forEach((mx, i) => {
      const top = tops[i % Math.max(1, tops.length)];
      const bot = bottoms[i % Math.max(1, bottoms.length)];
      mannequin(k, look, mx, mz, top ? top.colour : pick(look.palette, R), top ? shapeOf(top) : "tee", bot ? bot.colour : look.palette[0], bot ? shapeOf(bot) : "trousers", i % 2 ? -0.25 : 0.25);
    });
  // ---------- the real items into the best slots, then the stock ----------
  placeItems(k, look, items, slots, R, sells !== "clothes");
  // ---------- the lights ----------
  lights(k, look, w, d, H);
  plant(k, -w / 2 + 0.7, -d / 2 + 0.7, 1.3, look.plinth, "#2f5a2e");
  const light = shopLight({
    warm: look.warm,
    hemi: look.hemi,
    bg: look.bg,
    keyI: look.warm ? 0.9 : 1.05,
    points: [{ x: 0, y: H - 0.6, z: 0, col: look.lightCol, i: lux ? 7 : 9, dist: Math.max(w, d) * 1.5 }],
  });
  return { look, light };
}
const pick = <T>(a: T[], r: () => number) => a[Math.floor(r() * a.length) % a.length];

/** the mall's view of a shop: glass, a door gap, the sign over it */
function shopFront(k: Kit, p: WorldPlace, look: BrandLook, w: number, d: number, H: number, gap: number) {
  const z = d / 2;
  const frame = mat(look.key === "zara" || look.key === "ami" || look.key === "adidas" ? "#d8d8d4" : "#141414", { metal: 0.6, rough: 0.35 });
  const pane = glass("#cfe0ee", 0.18);
  const left = k.wall(-gap / 2, z, -w / 2, z, 3.2, pane, { inner: true, thick: 0.06 });
  const right = k.wall(w / 2, z, gap / 2, z, 3.2, pane, { inner: true, thick: 0.06 });
  for (const [wg, len] of [
    [left, w / 2 - gap / 2],
    [right, w / 2 - gap / 2],
  ] as [THREE.Object3D, number][]) {
    k.mount(wg, rbox(1, 0.3, 0.14, 0.01), frame, 0, 0.15, 0, { s: [len, 1, 1] });
    k.mount(wg, rbox(0.08, 3.2, 0.12, 0.01), frame, -len / 2, 1.6, 0);
    k.mount(wg, rbox(0.08, 3.2, 0.12, 0.01), frame, len / 2, 1.6, 0);
  }
  // the fascia: a band across the whole front, the logo over the door, facing out into the mall
  const fascia = k.wall(w / 2, z, -w / 2, z, H, mat(look.signBg, { rough: 0.6 }), { inner: true, solid: false, thick: 0.3, low: 3.2 });
  k.sign(logoTex(look, p.brand || p.name), 0, 3.2 + (H - 3.2) / 2, -0.17, Math.min(w * 0.5, 4.4), Math.min(1.0, H - 3.3), Math.PI, { to: fascia });
  k.mount(fascia, rbox(gap + 0.2, 0.1, 0.32, 0.01), frame, 0, 3.2, 0);
}

/** a mannequin: head, hands, a stand, wearing a top and a bottom */
function mannequin(k: Kit, look: BrandLook, x: number, z: number, topCol: string, top: Shape, botCol: string, bot: Shape, ry: number) {
  const skin = mat(look.mannequin, { rough: 0.4 });
  k.box(0.9, 0.12, 0.9, mat(look.plinth, { rough: 0.5 }), x, 0.06, z, ry);
  k.add(cyl(0.02, 0.02, 0.5, 8), mat("#888888", { metal: 1, rough: 0.3 }), x, 0.36, z);
  k.add(sphere(0.11, 14), skin, x, 1.84, z, 0, { s: [0.9, 1.15, 1] });
  k.add(cyl(0.045, 0.05, 0.12, 10), skin, x, 1.68, z);
  const long = ["hoodie", "crew", "shirt", "jacket", "puffer", "blazer"].includes(top);
  const worn = top === "hoodie" ? "hood" : ["jacket", "puffer", "blazer"].includes(top) ? "coat" : long ? "long" : "top";
  k.inst("worn|" + worn, () => wornGeo(worn), goodsMat("cloth"), x, 1.6, z, { ry, col: topCol });
  const legs = bot === "shorts" ? "short" : "legs";
  k.inst("worn|" + legs, () => wornGeo(legs), goodsMat("cloth"), x, 1.02, z, { ry, col: botCol });
  if (legs === "short") for (const sx of [-1, 1]) k.add(cyl(0.05, 0.045, 0.5, 8), skin, x + sx * 0.085 * Math.cos(ry), 0.42, z - sx * 0.085 * Math.sin(ry));
  for (const sx of [-1, 1]) k.add(sphere(0.045, 8), skin, x + sx * 0.27 * Math.cos(ry), long ? 1.0 : 1.3, z - sx * 0.27 * Math.sin(ry));
  k.circle(x, z, 0.5);
}

/** the real items: hanging things on the rails, shoes and bags on tables and plinths; stock fills the rest */
function placeItems(k: Kit, look: BrandLook, items: CatalogItem[], slots: Slot[], R: () => number, noClothes = false) {
  const hangs = slots.filter((s) => s.kind === "hang");
  const tops = slots.filter((s) => s.kind === "top");
  // the best hanging slots first: the walls, near the front, then the rails
  const order = (a: Slot[]) =>
    a
      .map((s, i) => ({ s, k: i % 2 ? i + 1000 : i }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.s);
  const freeH = order(hangs.slice());
  const freeT = tops.slice();
  const hangShapes: Shape[] = [];
  const hanger = mat(look.hanger, { rough: 0.5, metal: look.hanger === "#c9a24a" || look.hanger === "#bdbdbd" ? 1 : 0.2 });
  const put = (it: CatalogItem | null, s: Slot, shape: Shape, col: string) => {
    const id = it ? "item:" + it.id : undefined;
    const kind = goodsKind(shape);
    const hang = isHanging(shape) && s.kind === "hang";
    if (hang) {
      k.inst("g|" + shape, () => shapeGeo(shape), goodsMat(kind), s.x, s.y, s.z, { ry: s.ry, col, id });
      // its hanger
      k.inst("hanger", () => hangerGeo(), hanger as THREE.MeshStandardMaterial, s.x, s.y + 0.02, s.z, { ry: s.ry, col: "#ffffff" });
    } else if (isHanging(shape)) {
      // a folded one on a table
      k.inst("fold", foldGeo, goodsMat("cloth"), s.x, s.y, s.z, { ry: s.ry, col, id });
      k.inst("fold", foldGeo, goodsMat("cloth"), s.x, s.y + 0.06, s.z, { ry: s.ry, col });
    } else {
      const ry = shape === "trainers" || shape === "boots" ? s.ry + 0.5 : s.ry;
      const big = shape === "bag" ? 1.25 : shape.startsWith("watch") || ["chain", "ring", "earrings"].includes(shape) ? 1.7 : 1;
      k.inst("g|" + shape, () => shapeGeo(shape), goodsMat(kind), s.x, s.y + (shape.startsWith("watch") ? 0.11 : shape === "chain" ? 0.16 : 0.03), s.z, { ry, col, id, s: big });
    }
    if (it) {
      const mid = hang ? s.y + (SHAPE_MID[shape] ?? -0.3) : s.y + 0.18;
      k.spot("item:" + it.id, it.label, s.sx, s.sz, { ax: s.x, az: s.z, y: mid, r: 0.85 });
    }
  };
  for (const it of [...items].sort((a, b) => b.price - a.price)) {
    const shape = shapeOf(it);
    if (isHanging(shape)) {
      hangShapes.push(shape);
      const s = freeH.shift() || freeT.shift();
      if (s) put(it, s, shape, it.colour);
    } else {
      const s = freeT.shift() || freeH.shift();
      if (s) put(it, s, shape, it.colour);
    }
  }
  // stock: the same kinds of things in the brand's colours
  const shapes: Shape[] = hangShapes.length ? hangShapes : ["tee", "hoodie", "trousers"];
  const others = items.filter((i) => !isHanging(shapeOf(i))).map(shapeOf);
  if (!noClothes) for (const s of freeH) if (R() < look.density * k.dense) put(null, s, shapes[Math.floor(R() * shapes.length)], pick(look.palette, R));
  for (const s of freeT) if (R() < look.density * k.dense * 0.9) put(null, s, others.length ? others[Math.floor(R() * others.length)] : "trainers", pick(look.palette, R));
}

let hangerCache: THREE.BufferGeometry | null = null;
function hangerGeo() {
  if (!hangerCache) {
    const a = new THREE.CylinderGeometry(0.008, 0.008, 0.44, 5).rotateZ(Math.PI / 2).translate(0, -0.005, 0);
    const b = new THREE.TorusGeometry(0.03, 0.006, 4, 10, Math.PI * 1.3).translate(0, 0.05, 0);
    const c = new THREE.CylinderGeometry(0.006, 0.006, 0.05, 4).translate(0, 0.02, 0);
    const parts = [a, b, c].map((g) => {
      const n = g.toNonIndexed();
      g.dispose();
      n.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 3).fill(1), 3));
      return n;
    });
    hangerCache = mergeAll(parts);
  }
  return hangerCache.clone();
}
function mergeAll(parts: THREE.BufferGeometry[]) {
  let n = 0;
  for (const p of parts) n += p.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "uv", "color"]) {
    const size = name === "uv" ? 2 : 3;
    const arr = new Float32Array(n * size);
    let o = 0;
    for (const p of parts) {
      const a = p.attributes[name] as THREE.BufferAttribute;
      if (a) arr.set(a.array as Float32Array, o);
      o += p.attributes.position.count * size;
    }
    out.setAttribute(name, new THREE.Float32BufferAttribute(arr, size));
  }
  parts.forEach((p) => p.dispose());
  return out;
}

/** the back wall's moment, per brand */
function featureWall(k: Kit, back: THREE.Object3D, look: BrandLook, w: number, d: number, H: number) {
  const f = look.feature;
  if (f === "heart") {
    k.sign(heartTex(), 0, 1.75, 0.14, 1.9, 1.9, 0, { to: back, transparent: true, strength: 1.6 });
    k.pool(0, -d / 2 + 0.6, 3.2, "#ff2a40", 0.28);
  } else if (f === "ledwall") {
    const t = ledTex(look.accent);
    const m = new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
    k.own.push(m);
    k.add(plane(7.2, 2.4), m, 0, 1.6, 0.14, 0, { to: back, shadow: false });
    k.mount(back, rbox(7.4, 2.6, 0.1, 0.02), mat("#050505"), 0, 1.6, 0.08);
    k.ticks.push((_, dt) => (t.offset.x = (t.offset.x + dt * 0.06) % 1));
    k.pool(0, -d / 2 + 0.8, 4.5, look.accent, 0.2);
  } else if (f === "stripes") {
    for (let i = 0; i < 3; i++) k.mount(back, rbox(0.5, 2.6, 0.04, 0.01), mat("#111111", { rough: 0.6 }), -w / 2 + 1.4 + i * 0.85, 1.4, 0.14, { ry: 0 }).rotation.set(0, 0, -0.5);
  } else if (f === "fireplace") {
    k.mount(back, rbox(2.0, 1.3, 0.4, 0.03), mat("#d8cfc0", { rough: 0.6 }), -w / 2 + 2.6, 0.65, 0.3);
    k.mount(back, rbox(1.1, 0.7, 0.1, 0.02), mat("#120a06"), -w / 2 + 2.6, 0.5, 0.47);
    k.mount(back, rbox(0.8, 0.3, 0.1, 0.05), glow("#ff8a2a", 1.4), -w / 2 + 2.6, 0.32, 0.5);
    k.pool(-w / 2 + 2.6, -d / 2 + 1.2, 2.2, "#ff8a3a", 0.35);
    // two leather armchairs and books
    for (const sx of [-1, 1]) {
      k.box(0.8, 0.45, 0.8, mat("#5a2e18", { rough: 0.45 }), -w / 2 + 2.6 + sx * 1.2, 0.23, -d / 2 + 2.0, 0, 0.12);
      k.box(0.8, 0.5, 0.18, mat("#5a2e18", { rough: 0.45 }), -w / 2 + 2.6 + sx * 1.2, 0.6, -d / 2 + 2.35, 0, 0.08);
    }
    k.block(-w / 2 + 2.6, -d / 2 + 2.0, 1.7, 0.45);
    for (let i = 0; i < 14; i++) k.mount(back, rbox(0.06, 0.3, 0.22, 0.01), mat(["#5a1a1a", "#1a2a4a", "#2a4a2a", "#6a5a3a"][i % 4], { rough: 0.8 }), w / 2 - 4.4 + i * 0.075, 2.05, 0.2);
    k.mount(back, rbox(1.4, 0.03, 0.3, 0.01), mat("#2a1a10"), w / 2 - 3.9, 1.88, 0.2);
  } else if (f === "chandelier") {
    chandelier(k, 0, H - 0.9, -0.4, 1.0);
    k.mount(back, rbox(1.4, 2.4, 0.04, 0.01), glass("#e8eef2", 0.55), -w / 2 + 2.4, 1.5, 0.14);
    k.mount(back, rbox(1.4, 2.4, 0.04, 0.01), glass("#e8eef2", 0.55), w / 2 - 4.2, 1.5, 0.14);
  } else if (f === "velvet") {
    k.mount(back, rbox(w, 0.06, 0.05, 0.01), mat("#c9a24a", { metal: 1, rough: 0.25 }), 0, 3.2, 0.14);
    k.mount(back, rbox(w, 0.04, 0.05, 0.01), mat("#c9a24a", { metal: 1, rough: 0.25 }), 0, 0.9, 0.14);
    chandelier(k, 0, H - 1.0, 0.2, 0.7);
  } else if (f === "monogram") {
    k.mount(back, rbox(w, 0.05, 0.05, 0.01), mat("#c9a24a", { metal: 1, rough: 0.25 }), 0, 3.1, 0.14);
    k.mount(back, rbox(2.6, 1.6, 0.4, 0.04), mat("#3a2618", { rough: 0.35 }), -w / 2 + 2.6, 0.8, 0.3);
    // a trunk on display: the famous luggage
    k.box(1.0, 0.55, 0.55, mat("#6a4a2e", { rough: 0.5 }), -w / 2 + 2.6, 1.88, -d / 2 + 0.45);
    k.box(1.04, 0.05, 0.59, mat("#c9a24a", { metal: 1, rough: 0.3 }), -w / 2 + 2.6, 2.12, -d / 2 + 0.45);
  } else if (f === "graffiti") {
    // a skate deck wall and a crate of records
    for (let i = 0; i < 5; i++) k.mount(back, rbox(0.22, 0.8, 0.03, 0.08), mat(["#111111", "#c8202a", "#2a4a8a", "#e8dcc4", "#5a6a3a"][i], { rough: 0.6 }), -w / 2 + 1.6 + i * 0.4, 1.8, 0.16);
    k.box(0.8, 0.45, 0.5, mat("#a8875a", { rough: 0.8 }), w / 2 - 3.6, 0.23, -d / 2 + 0.5);
  } else if (f === "bootwall") {
    // lit cubbies across the back wall (the boots themselves are the shop's items)
    for (let r = 0; r < 4; r++) k.mount(back, rbox(w - 2.2, 0.04, 0.36, 0.01), glow("#f4fff0", 0.6), 0, 0.7 + r * 0.45, 0.2);
    k.pool(0, -d / 2 + 0.8, 5, look.accent, 0.14);
  } else if (f === "screens") {
    for (const sx of [-1, 1]) {
      k.mount(back, rbox(3.2, 1.8, 0.06, 0.02), mat("#0b0b0b"), sx * 3.4, 1.9, 0.14);
      k.mount(back, plane(3.0, 1.62), glow(sx < 0 ? "#2a6ad8" : "#7a3ad8", 0.75), sx * 3.4, 1.9, 0.18);
    }
  } else if (f === "cases") {
    k.mount(back, rbox(w - 3, 0.04, 0.05, 0.01), mat("#c9a24a", { metal: 1, rough: 0.25 }), 0, 2.9, 0.14);
  }
}

/** a crystal chandelier: rings of glass drops and a few glowing bulbs, all merged */
export function chandelier(k: Kit, x: number, y: number, z: number, s: number) {
  const gold = mat("#c9a24a", { metal: 1, rough: 0.25 });
  const drop = mat("#f4f8ff", { rough: 0.05, metal: 0.2, emissive: "#fff2dc", ei: 0.6 });
  k.add(cyl(0.01, 0.01, 1.2, 4), gold, x, y + 0.6 * s + 0.4, z, 0, { shadow: false });
  for (const [r, yy, n] of [
    [0.6, 0, 18],
    [0.42, 0.22, 12],
    [0.24, 0.42, 8],
  ] as [number, number, number][]) {
    k.add(new THREE.TorusGeometry(r * s, 0.012, 4, 24), gold, x, y + yy * s, z, 0, { rx: Math.PI / 2, shadow: false });
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      k.add(new THREE.OctahedronGeometry(0.035 * s), drop, x + Math.cos(a) * r * s, y + yy * s - 0.07, z + Math.sin(a) * r * s, a, { s: [1, 1.8, 1], shadow: false });
    }
  }
  k.add(sphere(0.12 * s, 10), glow("#fff0d8", 2), x, y + 0.1 * s, z, 0, { shadow: false });
  k.pool(x, z, 3.6 * s, "#ffe6c0", 0.3);
}

/** the ceiling lights: tracks of spots, glowing strips, brass pendants or spots over each plinth */
function lights(k: Kit, look: BrandLook, w: number, d: number, H: number) {
  const col = look.lightCol;
  if (look.lights === "strips") {
    // light from coves along the side walls, soft pools down the room
    for (const sx of [-1, 1]) {
      k.add(rbox(0.06, 0.04, d - 2, 0.01), glow(col, 1.6), sx * (w / 2 - 0.2), H - 0.15, 0, 0, { shadow: false });
      k.pool(sx * (w / 2 - 2.6), -d / 4, 3.6, col, 0.12);
      k.pool(sx * (w / 2 - 2.6), d / 4, 3.6, col, 0.12);
    }
    k.pool(0, 0, 4, col, 0.1);
  } else if (look.lights === "pendants") {
    const brass = mat("#b8913a", { metal: 1, rough: 0.3, side: THREE.DoubleSide });
    for (const [x, z] of [
      [-w / 2 + 3.9, 0.6],
      [w / 2 - 3.9, 0.6],
      [-w / 2 + 3.9, -2.0],
      [w / 2 - 3.9, -2.0],
      [0, -0.7],
    ]) {
      k.add(cyl(0.006, 0.006, 1.2, 4), brass, x, H - 0.6, z, 0, { shadow: false });
      k.add(cone(0.24, 0.28), brass, x, H - 1.25, z, 0, { shadow: false });
      k.add(sphere(0.07, 8), glow("#ffd8a0", 2), x, H - 1.36, z, 0, { shadow: false });
      k.pool(x, z, 2.8, "#ffc880", 0.3);
    }
  } else if (look.lights === "chandelier") {
    for (const [x, z] of [
      [-w / 2 + 3.6, -0.8],
      [w / 2 - 3.6, -0.8],
    ])
      k.pool(x, z, 2.6, col, 0.16);
  } else {
    // a black track across the room with spot heads (spots: just the pools of light, the plinths have their own)
    const trackM = mat("#151515", { metal: 0.5, rough: 0.4 });
    if (look.lights === "spots")
      for (const [x, z] of [
        [-w / 2 + 3.6, 0.6],
        [w / 2 - 3.6, 0.6],
        [-w / 2 + 3.6, -2.0],
        [w / 2 - 3.6, -2.0],
      ])
        k.pool(x, z, 3, col, 0.18);
    for (const z of look.lights === "track" ? [-d / 4, d / 4] : []) {
      k.add(rbox(w - 2, 0.05, 0.06, 0.01), trackM, 0, H - 0.3, z, 0, { shadow: false });
      for (let x = -w / 2 + 2; x <= w / 2 - 2 + 1e-3; x += 2.4) {
        k.add(cyl(0.05, 0.06, 0.16, 10), trackM, x, H - 0.42, z, 0, { rx: 0.4, shadow: false });
        k.add(sphere(0.035, 8), glow(col, 2.2), x, H - 0.5, z + 0.04, 0, { shadow: false });
        k.pool(x, z + 1.0, 2.2, col, 0.16);
      }
    }
  }
}

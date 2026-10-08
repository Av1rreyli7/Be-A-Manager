/**
 * The supermarket: a big bright hall. Fruit and veg on crates by the door, long aisles of shelves full of
 * colourful packets, cans, bottles and jars (all instanced, thinner on low quality), fridges along the back,
 * freezers down the side, checkouts at the front. Every grocery the shop sells is a stack on its shelf with its
 * own label: walk up to the Pringles and the Pringles light up.
 */
import * as THREE from "three";
import type { Grocery, WorldPlace } from "../../types";
import { rbox, plane, mat, glass, glow } from "../kit3d";
import { Kit, surfMat, shopLight, textAtlas, goodsMat, people, plant, type Room } from "./common";
import { prodGeo, prodOf, PROD_H, type Prod } from "./goods";

const PACK = ["#c8102e", "#f4d03f", "#1e5aa8", "#2e7d32", "#ff7a2a", "#7a2a8a", "#e8e4dc", "#111111", "#00a3a3", "#f2a0b4", "#8a5a2a", "#4a9ad8", "#d4af37", "#5a8a2a"];
const WIDTH: Record<Prod, number> = { box: 0.23, bottle: 0.1, can: 0.075, jar: 0.11, carton: 0.085, bag: 0.21, tub: 0.135, fruit: 0.1 };

export function supermarketRoom(k: Kit, p: WorldPlace): Room {
  const W = 34,
    D = 26,
    H = 4.4;
  const st = p.style;
  const R = k.rnd;
  const accent = st.accent || "#00843d";
  const trim = st.trim || "#ffcd00";
  const groceries = k.cat.groceries;
  // ---------- the hall ----------
  k.floor(W, D, surfMat("tile", "#ecebe6", "#cfcdc6", { rough: 0.3 }), 0, 0, 2.4);
  const wallM = mat("#f6f6f2", { rough: 0.9 });
  const band = surfMat("plain", accent);
  const walls = k.shell(W, D, H, wallM, { skip: ["s"] });
  for (const [wg, len] of [
    [walls.n!, W],
    [walls.w!, D],
    [walls.e!, D],
  ] as [THREE.Object3D, number][])
    k.mount(wg, rbox(len, 0.5, 0.04, 0.01), band, 0, 3.4, 0.12);
  const doorX = -12,
    gap = 3;
  k.wall(W / 2, D / 2, doorX + gap / 2, D / 2, H, wallM, {});
  k.wall(doorX - gap / 2, D / 2, -W / 2, D / 2, H, wallM, {});
  const head = k.wall(doorX + gap / 2, D / 2, doorX - gap / 2, D / 2, H, wallM, { solid: false, low: 2.8 });
  k.mount(head, rbox(gap, 0.1, 0.3, 0.01), mat("#2b2b2b", { metal: 0.5 }), 0, 2.8, 0);
  k.spot("door", "Way out", doorX, D / 2 - 0.6, { r: 1.2, y: 1.8 });
  // the shop's name over the fridges
  k.text(p.name.toUpperCase(), accent, trim, 0, 3.6, -D / 2 + 0.14, 9, 1.0, 0);
  // ---------- the shelves ----------
  const shelfM = mat("#e8e8e4", { rough: 0.5, metal: 0.2 });
  const edgeM = mat("#fafaf8", { rough: 0.4 });
  const levels = [0.17, 0.62, 1.07, 1.52];
  const z0 = -8.5,
    z1 = 3.5,
    L = z1 - z0,
    zc = (z0 + z1) / 2;
  const units = [-7, -2.5, 2, 6.5, 11];
  // the aisles: which face of which unit holds which kind of thing
  const faces: { x: number; side: number; aisle: string }[] = [];
  units.forEach((ux, i) => {
    k.box(1.1, 0.15, L, mat("#d8d8d4", { rough: 0.6 }), ux, 0.075, zc);
    k.box(0.06, 2.05, L, shelfM, ux, 1.03, zc);
    for (const side of [-1, 1])
      for (const y of levels) {
        k.add(rbox(0.46, 0.03, L, 0.005), shelfM, ux + side * 0.27, y - 0.015, zc);
        k.add(rbox(0.012, 0.045, L, 0.004), edgeM, ux + side * 0.5, y - 0.02, zc);
      }
    // end caps: a promo stack and a little sign
    for (const ez of [z0 - 0.45, z1 + 0.45]) {
      k.box(1.0, 0.9, 0.7, mat(PACK[(i * 3) % PACK.length], { rough: 0.6 }), ux, 0.45, ez);
      for (let s = 0; s < 6; s++) k.inst("prod|box", () => prodGeo("box"), goodsMat("plastic"), ux - 0.35 + (s % 3) * 0.35, 0.9, ez + (s < 3 ? -0.15 : 0.15), { col: PACK[(i * 5 + s) % PACK.length] });
    }
    k.block(ux, zc, 0.6, L / 2 + 0.9);
    const names = [
      ["Bakery", "Snacks"],
      ["Snacks", "Drinks"],
      ["Drinks", "Pantry"],
      ["Pantry", "Breakfast"],
      ["Breakfast", "Household"],
    ][i];
    faces.push({ x: ux, side: -1, aisle: names[0] }, { x: ux, side: 1, aisle: names[1] });
  });
  // the aisle signs, hanging over each aisle
  const signs = ["1 Fruit and veg", "2 Bakery and snacks", "3 Snacks and drinks", "4 Drinks and pantry", "5 Breakfast", "6 Household", "Fridges", "Frozen"];
  const at = textAtlas("aisles|" + accent, signs, { fg: "#ffffff", bg: accent, cellW: 512, cellH: 96 });
  const signM = new THREE.MeshBasicMaterial({ map: at.tex, toneMapped: false });
  k.own.push(signM);
  const aisleX = [-10, -4.75, -0.25, 4.25, 8.75, 13.8];
  aisleX.forEach((x, i) => {
    for (const ry of [0, Math.PI]) {
      const g = plane(2.6, 0.48).clone();
      uvRect(g, at.uvOf(i));
      k.own.push(g);
      k.add(g, signM, x, 3.25, zc + 2 + (ry ? -0.01 : 0.01), ry, { shadow: false });
    }
    k.box(2.7, 0.56, 0.02, mat("#1a1a1a"), x, 3.25, zc + 2);
  });
  // ---------- groceries: where each one goes ----------
  const byAisle = (a: string) => groceries.filter((g) => g.aisle === a);
  const heroLabels = textAtlas(
    "groc|" + groceries.map((g) => g.id).join(","),
    groceries.map((g) => g.label),
    { fg: "#111111", bg: "#fff8d0", cellW: 320, cellH: 64 },
  );
  const tagM = new THREE.MeshBasicMaterial({ map: heroLabels.tex, toneMapped: false });
  k.own.push(tagM);
  const tag = (g: Grocery, x: number, y: number, z: number, ry: number) => {
    const geo = plane(0.42, 0.085).clone();
    uvRect(geo, heroLabels.uvOf(groceries.indexOf(g)));
    k.own.push(geo);
    k.add(geo, tagM, x, y, z, ry, { shadow: false });
  };
  const hero = (g: Grocery, x: number, y: number, z: number, faceRy: number, sx: number, sz: number) => {
    const kind = prodOf(g.label, g.aisle);
    const w = WIDTH[kind];
    const n = Math.max(2, Math.min(5, Math.floor(0.42 / w)));
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * w;
      const [ox, oz] = [Math.cos(faceRy) * off, -Math.sin(faceRy) * off];
      k.inst("prod|" + kind, () => prodGeo(kind), goodsMat(kind === "bottle" ? "gloss" : "plastic"), x + ox, y, z + oz, { ry: faceRy, col: g.colour, id: i === 0 ? "grocery:" + g.id : undefined });
    }
    k.spot("grocery:" + g.id, g.label, sx, sz, { ax: x, az: z, y: y + PROD_H[kind] / 2, r: 0.9 });
  };
  // the shelves: stock all along, with each aisle's groceries at eye height
  for (const f of faces) {
    const list = byAisle(f.aisle);
    const fx = f.x + f.side * 0.36;
    const ry = f.side > 0 ? Math.PI / 2 : -Math.PI / 2;
    // the real groceries first: spaced along the face at the second shelf from the top
    const heroZ = list.map((_, i) => z0 + 1.2 + i * ((L - 2.4) / Math.max(1, list.length - 1 || 1)));
    list.forEach((g, i) => {
      hero(g, fx, levels[2], heroZ[i], ry, f.x + f.side * 1.45, heroZ[i]);
      tag(g, f.x + f.side * 0.515, levels[2] - 0.03, heroZ[i], ry);
    });
    for (const y of levels) {
      let z = z0 + 0.1;
      while (z < z1 - 0.1) {
        const kind = (["box", "bottle", "can", "jar", "carton", "bag", "tub"] as Prod[])[Math.floor(R() * 7)];
        const run = 0.8 + R() * 1.0;
        const col = PACK[Math.floor(R() * PACK.length)];
        const w = WIDTH[kind];
        const end = Math.min(z1 - 0.1, z + run);
        for (; z + w < end; z += w * 1.04) {
          if (y === levels[2] && heroZ.some((hz) => Math.abs(hz - z) < 0.32)) continue;
          if (R() > k.dense + 0.1) continue;
          if (kind === "bag" && y > 1.4) continue;
          k.inst("prod|" + kind, () => prodGeo(kind), goodsMat(kind === "bottle" ? "gloss" : "plastic"), fx, y, z + w / 2, { ry, col });
        }
        z = end + 0.04;
      }
    }
  }
  // ---------- fruit and veg: crates on stands by the door ----------
  const crateM = mat("#9a7a52", { rough: 0.9 });
  const fruitCols = ["#f4d03f", "#c8102e", "#ff8a2a", "#5a8a2a", "#3b4cca", "#8a2a4a", "#e8c040", "#4a7c2c"];
  const produce = byAisle("Fruit and veg");
  const pz = [-6.5, -3, 0.5, 4];
  pz.forEach((zz, i) => {
    k.box(1.4, 0.8, 3.0, mat("#6a5038", { rough: 0.8 }), -13.6, 0.4, zz, 0, 0.03);
    for (let c = 0; c < 4; c++) {
      const cz = zz - 1.1 + c * 0.73;
      k.add(rbox(1.2, 0.18, 0.66, 0.02), crateM, -13.5, 0.92, cz, 0, { rz: 0.28 });
      const col = c === 0 && produce[i] ? produce[i].colour : fruitCols[(i * 4 + c) % fruitCols.length];
      for (let f = 0; f < Math.round(14 * k.dense); f++) {
        const fx = -13.95 + R() * 0.9,
          fy = 0.98 + (fx + 13.95) * 0.28 + R() * 0.05;
        k.inst("prod|fruit", () => prodGeo("fruit"), goodsMat("plastic"), fx, fy, cz - 0.24 + R() * 0.48, { col, s: 0.9 + R() * 0.3 });
      }
    }
    k.block(-13.6, zz, 0.75, 1.55);
  });
  produce.forEach((g, i) => {
    const zz = pz[i % pz.length] - 1.1 + 0.73 * 2 * Math.floor(i / pz.length);
    hero(g, -13.0, 1.18, zz, Math.PI / 2, -11.7, zz);
    tag(g, -12.88, 0.82, zz, Math.PI / 2);
  });
  // ---------- the fridges along the back wall: protein and dairy ----------
  const fridgeIn = glow("#eef6ff", 0.85);
  const fx0 = -9,
    fx1 = 15,
    fl = fx1 - fx0,
    fcx = (fx0 + fx1) / 2,
    fzz = -D / 2 + 0.55;
  const cab = mat("#2a2c30", { rough: 0.5 });
  k.box(fl, 2.3, 0.1, cab, fcx, 1.15, fzz - 0.45);
  k.box(fl, 0.25, 0.9, cab, fcx, 2.18, fzz - 0.05);
  k.box(fl, 0.3, 0.9, cab, fcx, 0.15, fzz - 0.05);
  for (const sx of [fx0, fx1]) k.box(0.1, 2.3, 0.9, cab, sx, 1.15, fzz - 0.05);
  k.add(plane(fl - 0.2, 1.75), fridgeIn, fcx, 1.17, fzz - 0.39, 0, { shadow: false });
  for (const y of [0.45, 0.9, 1.35, 1.8]) k.add(rbox(fl - 0.2, 0.02, 0.6, 0.004), glass("#dfe8ee", 0.5), fcx, y - 0.01, fzz - 0.05);
  for (let x = fx0 + 0.75; x < fx1; x += 1.5) {
    k.add(rbox(0.04, 2.0, 0.04, 0.005), mat("#c8ccd2", { metal: 0.8, rough: 0.3 }), x - 0.75, 1.2, fzz + 0.4);
    k.add(rbox(1.46, 1.96, 0.02, 0.005), glass("#e6f0f6", 0.16), x, 1.2, fzz + 0.4, 0, { shadow: false });
  }
  k.pool(fcx, fzz + 1.6, 9, "#dfefff", 0.14);
  k.block(fcx, fzz, fl / 2, 0.55);
  const protein = byAisle("Protein");
  protein.forEach((g, i) => {
    const x = fx0 + 1.5 + i * ((fl - 3) / Math.max(1, protein.length - 1));
    hero(g, x, 0.92, fzz + 0.05, 0, x, fzz + 1.5);
    tag(g, x, 0.86, fzz + 0.38, 0);
  });
  for (const y of [0.47, 0.92, 1.37, 1.82])
    for (let x = fx0 + 0.2; x < fx1 - 0.2; x += 0.13) {
      if (y === 0.92 && protein.some((_, i) => Math.abs(fx0 + 1.5 + i * ((fl - 3) / Math.max(1, protein.length - 1)) - x) < 0.35)) continue;
      if (R() > k.dense) continue;
      const kind: Prod = y > 1.5 ? "carton" : y > 1 ? "tub" : R() < 0.5 ? "carton" : "jar";
      k.inst("prod|" + kind, () => prodGeo(kind), goodsMat("plastic"), x, y, fzz - 0.1 + R() * 0.1, { col: ["#ffffff", "#e8f0ff", "#f4e4c8", "#c8102e", "#1e5aa8", "#f4d03f"][Math.floor(R() * 6)] });
    }
  // ---------- the freezers down the right wall ----------
  const frozen = byAisle("Frozen");
  const ix = W / 2 - 0.85;
  for (let i = 0; i < 4; i++) {
    const zz = -7.5 + i * 3.0;
    k.box(1.2, 0.85, 2.8, mat("#f2f4f6", { rough: 0.4 }), ix, 0.43, zz, 0, 0.04);
    k.add(plane(1.0, 2.6), glow("#cfe8ff", 0.8), ix, 0.86, zz, 0, { rx: -Math.PI / 2, shadow: false });
    k.add(rbox(1.1, 0.02, 2.7, 0.005), glass("#e6f0f6", 0.2), ix, 0.92, zz, 0, { shadow: false });
    for (let f = 0; f < Math.round(18 * k.dense); f++)
      k.inst("prod|box", () => prodGeo("box"), goodsMat("plastic"), ix - 0.35 + R() * 0.7, 0.86 - 0.24, zz - 1.2 + R() * 2.4, {
        rx: -Math.PI / 2 + 0.3,
        ry: R() * 0.4,
        col: PACK[Math.floor(R() * PACK.length)],
        s: 0.8,
      });
    k.block(ix, zz, 0.65, 1.45);
  }
  frozen.forEach((g, i) => {
    const zz = -7.5 + i * 3.0;
    hero(g, ix - 0.62, 0.86, zz, -Math.PI / 2, ix - 1.75, zz);
  });
  // ---------- the checkouts at the front ----------
  const lanes = [-2, 2.2, 6.4, 10.6];
  const counter = mat("#dcdcd6", { rough: 0.5 });
  lanes.forEach((x, i) => {
    k.box(0.9, 0.9, 3.2, counter, x, 0.45, 8.6, 0, 0.03);
    k.box(0.7, 0.03, 2.2, mat("#141414", { rough: 0.8 }), x, 0.92, 8.2);
    k.box(0.36, 0.3, 0.3, mat("#2a2a2a"), x + 0.1, 1.06, 9.6);
    k.add(rbox(0.3, 0.2, 0.02, 0.005), glow("#9ec8ff", 0.7), x + 0.1, 1.15, 9.44, 0, { shadow: false });
    k.add(rbox(0.05, 2.4, 0.05, 0.01), mat("#2a2a2a"), x - 0.4, 1.2, 10.2);
    k.add(rbox(0.36, 0.36, 0.08, 0.02), glow(i === 1 ? "#ff4a4a" : accent, 1.3), x - 0.4, 2.5, 10.2, 0, { shadow: false });
    k.block(x, 8.6, 0.5, 1.65);
  });
  people(
    k,
    "staff",
    lanes.map((x) => ({ x: x + 0.85, z: 9.4, ry: -Math.PI / 2, col: accent })),
  );
  for (const x of lanes) k.circle(x + 0.85, 9.4, 0.3);
  // trolleys and baskets by the door, a few shoppers, plants
  for (let i = 0; i < 4; i++) {
    const tx = -15.6 + i * 0.32;
    k.add(rbox(0.55, 0.45, 0.85, 0.02), mat("#c8ccd2", { metal: 0.9, rough: 0.35 }), tx + 0.1, 0.75, 10.8, 0, { s: [1, 1, 1] });
    k.add(rbox(0.5, 0.04, 0.04, 0.01), mat(accent, { rough: 0.5 }), tx + 0.1, 1.05, 11.25);
  }
  k.block(-15, 10.8, 0.9, 0.6);
  for (let i = 0; i < 4; i++) k.box(0.5, 0.22, 0.36, mat("#c8102e", { rough: 0.6 }), -16.2, 0.12 + i * 0.12, 8.4, 0, 0.02);
  const crowd = [
    { x: -4.75, z: -5, col: "#2a3a5a" },
    { x: 4.25, z: 0.5, col: "#e8e4dc" },
    { x: 8.75, z: -3, col: "#c8202a" },
    { x: -10, z: 2, col: "#3a5a3a" },
    { x: 13.8, z: -1, col: "#111111" },
  ].slice(0, Math.round(5 * k.dense) + 1);
  people(
    k,
    "shopper",
    crowd.map((c) => ({ ...c, ry: R() * 6.28 })),
  );
  for (const c of crowd) k.circle(c.x, c.z, 0.3);
  plant(k, -W / 2 + 0.7, D / 2 - 3.6, 1.2);
  // the lights: soft pools down every aisle (no bars across the picture)
  for (const x of aisleX) {
    k.pool(x, zc - 3, 4.2, "#f4f8ff", 0.1);
    k.pool(x, zc + 3, 4.2, "#f4f8ff", 0.1);
  }
  for (const x of lanes) k.pool(x, 8.6, 3, "#fff4e0", 0.12);
  return k.finish({
    w: W,
    d: D,
    spawn: [doorX, D / 2 - 2.2],
    mood: "cool",
    light: shopLight({ hemi: 1.0, sky: "#f6f8ff", ground: "#6a6a64", keyI: 1.1, points: [{ x: 0, y: 4, z: -2, col: "#f4f8ff", i: 12, dist: 36 }] }),
    accent,
    cam: { dist: 7.4, height: 5.6 },
  });
}

/** point a plane's UVs at one cell of an atlas */
function uvRect(g: THREE.BufferGeometry, [u0, v0, u1, v1]: [number, number, number, number]) {
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) < 0.5 ? u0 : u1, uv.getY(i) < 0.5 ? v0 : v1);
  uv.needsUpdate = true;
}

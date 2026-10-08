/**
 * Cafes and the restaurant. A cafe has its counter, the espresso machine, a lit pastry case and the menu on the
 * wall; every drink and plate on the menu sits on the counter where he can walk up to it. Each chain dresses
 * the room its own way. The restaurant puts each dish on its own table; by the sea it opens onto a terrace over
 * the water at dusk, in the city it is a rooftop with the towers all round.
 */
import * as THREE from "three";
import type { MenuItem, WorldPlace } from "../../types";
import { rbox, cyl, sphere, plane, mat, glass, glow, cachedTexture } from "../kit3d";
import { Kit, surfMat, shopLight, goodsMat, people, plant, shaded, slug, textAtlas, viewTex, type Room, type Surface } from "./common";

interface CafeLook {
  floor: [Surface, string, string?];
  wall: [Surface, string, string?];
  counter: string;
  top: string;
  accent: string;
  seat: string;
  lamp: string;
  logo: "siren" | "word";
  font: string;
}
function cafeLook(p: WorldPlace): CafeLook {
  const s = slug(p.brand || p.name);
  const acc = p.style.accent || "#00704a";
  if (s.includes("starbucks"))
    return {
      floor: ["wood", "#8a6444"],
      wall: ["slats", "#9a6c48"],
      counter: "#2a1e16",
      top: "#e8e4dc",
      accent: "#00704a",
      seat: "#3a5a3a",
      lamp: "#ffd09a",
      logo: "siren",
      font: "800 {s}px 'Helvetica Neue', Arial, sans-serif",
    };
  if (s.includes("bluetokai"))
    return {
      floor: ["tile", "#f2f2ee", "#d8dcde"],
      wall: ["plain", "#f4f6f8"],
      counter: "#1b3a6b",
      top: "#f4f2ec",
      accent: "#1b3a6b",
      seat: "#c8a878",
      lamp: "#fff0dc",
      logo: "word",
      font: "700 {s}px 'Avenir Next', 'Helvetica Neue', sans-serif",
    };
  if (s.includes("thirdwave"))
    return {
      floor: ["concrete", "#5a5854"],
      wall: ["brick", "#3a3a3a", "#1a1a1a"],
      counter: "#141414",
      top: "#c8a878",
      accent: "#111111",
      seat: "#1a1a1a",
      lamp: "#ffc880",
      logo: "word",
      font: "800 {s}px 'Futura', 'Helvetica Neue', sans-serif",
    };
  if (s.includes("costa"))
    return {
      floor: ["wood", "#8a6a4a"],
      wall: ["plain", "#efe3cf"],
      counter: "#6d1f37",
      top: "#e8e4dc",
      accent: "#6d1f37",
      seat: "#6d1f37",
      lamp: "#ffd8a0",
      logo: "word",
      font: "800 {s}px 'Helvetica Neue', sans-serif",
    };
  if (s.includes("pret"))
    return {
      floor: ["tile", "#e8e4dc", "#c8c0b4"],
      wall: ["plain", "#f4f0e8"],
      counter: "#8a1538",
      top: "#d8cfc0",
      accent: "#8a1538",
      seat: "#3a2a22",
      lamp: "#ffe0b0",
      logo: "word",
      font: "700 {s}px 'Times New Roman', serif",
    };
  return {
    floor: ["wood", p.style.floor || "#8a6a4a"],
    wall: ["plain", p.style.wall || "#efe3cf"],
    counter: acc,
    top: "#e8e4dc",
    accent: acc,
    seat: "#5a4a3a",
    lamp: "#ffd8a0",
    logo: "word",
    font: "800 {s}px 'Helvetica Neue', sans-serif",
  };
}
function cafeSign(name: string, look: CafeLook) {
  return cachedTexture(
    "cafesign|" + name + look.accent,
    (x, w, h) => {
      x.clearRect(0, 0, w, h);
      x.textAlign = "center";
      x.textBaseline = "middle";
      if (look.logo === "siren") {
        // a green roundel with the name round it
        x.fillStyle = look.accent;
        x.beginPath();
        x.arc(h / 2, h / 2, h * 0.46, 0, Math.PI * 2);
        x.fill();
        x.strokeStyle = "#ffffff";
        x.lineWidth = 6;
        x.beginPath();
        x.arc(h / 2, h / 2, h * 0.3, 0, Math.PI * 2);
        x.stroke();
        x.fillStyle = "#ffffff";
        x.font = "700 40px 'Helvetica Neue', sans-serif";
        x.fillText("★", h / 2, h / 2 - 2);
        x.fillStyle = look.accent;
        x.textAlign = "left";
        x.font = "800 96px 'Helvetica Neue', Arial, sans-serif";
        x.fillText(name.toUpperCase(), h + 20, h / 2 + 4, w - h - 30);
      } else {
        x.fillStyle = look.accent === "#111111" ? "#f2f2f2" : look.accent;
        let s = 110;
        x.font = look.font.replace("{s}", String(s));
        while (x.measureText(name).width > w * 0.92 && s > 20) {
          s -= 6;
          x.font = look.font.replace("{s}", String(s));
        }
        x.fillText(name, w / 2, h / 2 + 4);
      }
    },
    1024,
    200,
  );
}
/** a cup, a tall cup or a plate with food, from what is on the menu */
type Dish = "cup" | "tall" | "small" | "plate" | "bowl";
function dishOf(m: MenuItem): { d: Dish; c: string } {
  const l = m.label.toLowerCase();
  if (/espresso/.test(l)) return { d: "small", c: "#4a2a1a" };
  if (/matcha/.test(l)) return { d: "tall", c: "#7ab04a" };
  if (/iced|smoothie|shake|juice/.test(l)) return { d: "tall", c: /smoothie/.test(l) ? "#e8c890" : "#c89a6a" };
  if (/coffee|latte|flat white|cappuccino|tea|americano/.test(l)) return { d: "cup", c: "#f4f2ec" };
  if (/croissant|pastry|cake|muffin/.test(l)) return { d: "plate", c: "#d8a050" };
  if (/avocado|toast/.test(l)) return { d: "plate", c: "#7aa04a" };
  if (/sushi|omakase/.test(l)) return { d: "plate", c: "#f08070" };
  if (/steak|ribeye/.test(l)) return { d: "plate", c: "#6a2a1a" };
  if (/burger/.test(l)) return { d: "plate", c: "#b8742a" };
  if (/bass|fish|seafood|salmon/.test(l)) return { d: "plate", c: "#e8dcc4" };
  if (/tasting|menu/.test(l)) return { d: "plate", c: "#c8a0c0" };
  return { d: "bowl", c: "#7aa04a" };
}
const dishCache = new Map<Dish, THREE.BufferGeometry>();
function dishGeo(d: Dish) {
  let g = dishCache.get(d);
  if (!g) {
    const parts: THREE.BufferGeometry[] = [];
    const add = (geo: THREE.BufferGeometry, shade: number, y: number) => {
      geo.translate(0, y, 0);
      const n = geo.index ? geo.toNonIndexed() : geo;
      parts.push(shaded(n, shade));
    };
    if (d === "cup" || d === "small") {
      const s = d === "small" ? 0.7 : 1;
      add(new THREE.CylinderGeometry(0.05 * s, 0.04 * s, 0.1 * s, 12), 1, 0.05 * s);
      add(new THREE.CylinderGeometry(0.045 * s, 0.045 * s, 0.006, 12), 0.45, 0.1 * s);
      add(new THREE.CylinderGeometry(0.09, 0.09, 0.01, 14), 1.2, 0.005);
    } else if (d === "tall") {
      add(new THREE.CylinderGeometry(0.05, 0.04, 0.18, 12), 1, 0.09);
      add(new THREE.CylinderGeometry(0.052, 0.052, 0.012, 12), 1.5, 0.18);
      add(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 5), 0.5, 0.24);
    } else if (d === "plate") {
      add(new THREE.CylinderGeometry(0.16, 0.13, 0.025, 18), 1.6, 0.012);
      const f = new THREE.SphereGeometry(0.09, 10, 6);
      f.scale(1, 0.45, 0.75);
      add(f, 1, 0.05);
    } else {
      add(new THREE.CylinderGeometry(0.12, 0.07, 0.07, 16), 1.5, 0.035);
      const f = new THREE.SphereGeometry(0.1, 10, 6);
      f.scale(1, 0.35, 1);
      add(f, 1, 0.07);
    }
    let n = 0;
    for (const p of parts) n += p.attributes.position.count;
    const out = new THREE.BufferGeometry();
    for (const name of ["position", "normal", "uv", "color"]) {
      const size = name === "uv" ? 2 : 3;
      const arr = new Float32Array(n * size);
      let o = 0;
      for (const p of parts) {
        arr.set(p.attributes[name].array as Float32Array, o);
        o += p.attributes.position.count * size;
      }
      out.setAttribute(name, new THREE.Float32BufferAttribute(arr, size));
    }
    parts.forEach((p) => p.dispose());
    g = out;
    dishCache.set(d, g);
  }
  return g.clone();
}
function dish(k: Kit, m: MenuItem, x: number, y: number, z: number, s = 1.8) {
  const { d, c } = dishOf(m);
  k.inst("dish|" + d, () => dishGeo(d), goodsMat("gloss"), x, y, z, { col: c, s, id: "menu:" + m.id });
}

// ---------- a cafe ----------
export function cafeRoom(k: Kit, p: WorldPlace): Room {
  const W = 15,
    D = 11,
    H = 3.6;
  const L = cafeLook(p);
  const menu = k.cat.menus.cafe;
  const R = k.rnd;
  k.floor(W, D, surfMat(L.floor[0], L.floor[1], L.floor[2], { rough: 0.55 }), 0, 0, 3);
  const wallM = mat(L.wall[1], { rough: 0.9 });
  const face = surfMat(L.wall[0], L.wall[1], L.wall[2], { rough: 0.85 });
  const walls = k.shell(W, D, H, wallM, { skip: ["s"], face, tile: L.wall[0] === "brick" ? 2.2 : 3 });
  const gap = 2.0;
  const doorX = 2.2;
  k.wall(W / 2, D / 2, doorX + gap / 2, D / 2, H, wallM, {});
  k.wall(doorX - gap / 2, D / 2, -W / 2, D / 2, H, wallM, {});
  const head = k.wall(doorX + gap / 2, D / 2, doorX - gap / 2, D / 2, H, wallM, { solid: false, low: 2.5 });
  k.mount(head, rbox(gap + 0.16, 0.1, 0.24, 0.02), mat(L.counter), 0, 2.5, 0);
  k.spot("door", "Way out", doorX, D / 2 - 0.6, { r: 1.0, y: 1.6 });
  // ---------- the counter along the back ----------
  const cz = -D / 2 + 1.9,
    cx = -1.2,
    cl = 8.6;
  const counterM = mat(L.counter, { rough: 0.45 });
  k.box(cl, 1.0, 0.8, counterM, cx, 0.5, cz, 0, 0.03);
  k.box(cl + 0.06, 0.05, 0.86, mat(L.top, { rough: 0.25 }), cx, 1.03, cz);
  k.block(cx, cz, cl / 2 + 0.05, 0.45);
  // the back bar: shelves of cups and bags of beans, the espresso machine, the grinder
  k.box(cl, 0.9, 0.6, counterM, cx, 0.45, -D / 2 + 0.4);
  k.box(1.1, 0.5, 0.5, mat("#c8ccd2", { metal: 0.9, rough: 0.25 }), cx + 1.5, 1.15, -D / 2 + 0.45);
  k.box(0.25, 0.45, 0.25, mat("#1a1a1a", { rough: 0.4 }), cx + 2.4, 1.12, -D / 2 + 0.45);
  for (const y of [1.6, 2.1]) k.mount(walls.n!, rbox(cl, 0.04, 0.3, 0.01), mat("#3a2a1e", { rough: 0.6 }), cx, y, 0.25);
  for (let i = 0; i < 22; i++)
    k.inst("beans", () => shaded(new THREE.BoxGeometry(0.12, 0.2, 0.08)), goodsMat("plastic"), cx - cl / 2 + 0.3 + (i % 11) * 0.36, i < 11 ? 1.72 : 2.22, -D / 2 + 0.28, {
      col: [L.accent, "#c8a878", "#2a2a2a", "#e8e4dc"][i % 4],
    });
  // the menu board above the counter
  const at = textAtlas(
    "menu|" + p.id,
    menu.map((m) => m.label),
    { fg: L.accent === "#111111" ? "#f2f2f2" : "#f4f2ec", bg: L.accent === "#111111" ? "#1a1a1a" : "#22201c", cellW: 480, cellH: 64 },
  );
  const boardM = new THREE.MeshBasicMaterial({ map: at.tex, toneMapped: false });
  k.own.push(boardM);
  menu.forEach((m, i) => {
    const g = plane(1.9, 0.26).clone();
    const [u0, v0, u1, v1] = at.uvOf(i);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let j = 0; j < uv.count; j++) uv.setXY(j, uv.getX(j) < 0.5 ? u0 : u1, uv.getY(j) < 0.5 ? v0 : v1);
    k.own.push(g);
    k.mount(walls.n!, g, boardM, cx - 3.1 + (i % 4) * 2.05, 3.05 - Math.floor(i / 4) * 0.3, 0.16);
  });
  k.sign(cafeSign(p.name, L), W / 2 - 2.8, 2.55, -D / 2 + 0.16, 3.6, 0.7, 0, { transparent: true });
  // the pastry case, lit, with cakes and croissants
  const px = cx - cl / 2 + 1.2;
  k.add(rbox(1.8, 0.45, 0.7, 0.02), glass("#f4f8fa", 0.22), px, 1.28, cz, 0, { shadow: false });
  k.add(plane(1.7, 0.6), glow("#fff2dc", 0.6), px, 1.07, cz, 0, { rx: -Math.PI / 2, shadow: false });
  for (let i = 0; i < Math.round(14 * k.dense); i++)
    k.inst(
      "pastry",
      () => shaded(new THREE.SphereGeometry(0.06, 8, 5).scale(1.3, 0.6, 1)),
      goodsMat("cloth"),
      px - 0.75 + (i % 7) * 0.25,
      1.1 + Math.floor(i / 7) * 0.0,
      cz - 0.15 + Math.floor(i / 7) * 0.3,
      { col: ["#d8a050", "#8a4a2a", "#f2d8b0", "#c8607a"][i % 4] },
    );
  // the menu on the counter: one of each, where he can walk up and order it
  menu.forEach((m, i) => {
    const x = cx - cl / 2 + 2.6 + i * ((cl - 3.2) / Math.max(1, menu.length - 1));
    dish(k, m, x, 1.06, cz + 0.22);
    k.spot("menu:" + m.id, m.label, x, cz + 1.25, { ax: x, az: cz + 0.22, y: 1.2, r: 0.75 });
  });
  people(k, "barista", [
    { x: cx + 1.5, z: cz - 0.75, ry: 0, col: L.accent },
    { x: cx - 2.2, z: cz - 0.75, ry: 0.3, col: L.accent },
  ]);
  // ---------- seats: little tables, a long table, armchairs by the window ----------
  const tableM = mat(L.top, { rough: 0.35 });
  const seatM = mat(L.seat, { rough: 0.7 });
  const tables: [number, number][] = [
    [-5.4, 0.8],
    [-2.6, 1.6],
    [0.2, 0.8],
    [-5.4, 3.6],
    [3.4, 2.2],
  ];
  for (const [tx, tz] of tables) {
    k.add(cyl(0.42, 0.42, 0.04, 20), tableM, tx, 0.74, tz);
    k.add(cyl(0.04, 0.12, 0.72, 8), mat("#1a1a1a", { metal: 0.6 }), tx, 0.36, tz);
    for (const a of [0, Math.PI]) k.box(0.42, 0.45, 0.42, seatM, tx + Math.cos(a) * 0.7, 0.23, tz + Math.sin(a) * 0.7, 0, 0.05);
    k.block(tx, tz, 1.0, 0.45);
    k.spotLamp(tx, 2.4, tz, L.lamp, { shade: L.counter === "#141414" ? "#1a1a1a" : "#2a2a2a", r: 0.7, pool: 0.25, beam: 0.05, cord: 1.0 });
    if (R() < 0.6) k.inst("dish|cup", () => dishGeo("cup"), goodsMat("gloss"), tx + 0.1, 0.76, tz, { col: "#f4f2ec" });
  }
  people(k, "sit", [
    { x: -5.4 - 0.7, z: 0.8, ry: Math.PI / 2, col: "#2a3a5a", sit: true },
    { x: 0.2 + 0.7, z: 0.8, ry: -Math.PI / 2, col: "#c8202a", sit: true },
    { x: 3.4 - 0.7, z: 2.2, ry: Math.PI / 2, col: "#e8e4dc", sit: true },
  ]);
  // armchairs and a low table in the corner
  for (const sx of [-0.8, 0.8]) k.box(0.8, 0.7, 0.8, mat(L.logo === "siren" ? "#5a3a2a" : L.seat, { rough: 0.6 }), W / 2 - 2.4 + sx, 0.35, -0.6, 0, 0.12);
  k.box(0.8, 0.4, 0.5, tableM, W / 2 - 2.4, 0.2, 0.3);
  k.block(W / 2 - 2.4, -0.3, 1.25, 0.9);
  plant(k, -W / 2 + 0.6, D / 2 - 0.6, 1.2);
  plant(k, W / 2 - 0.6, -D / 2 + 0.6, 1.3);
  return k.finish({
    w: W,
    d: D,
    spawn: [doorX, D / 2 - 1.7],
    mood: "warm",
    light: shopLight({ warm: true, hemi: 0.9, keyI: 1.0, points: [{ x: -1, y: 3, z: 0, col: L.lamp, i: 8, dist: 18 }] }),
    accent: L.accent,
  });
}

// ---------- the restaurant: by the sea, or on a roof in the city ----------
export function restaurantRoom(k: Kit, p: WorldPlace): Room {
  const sea = p.where === "seafront";
  const W = 22,
    D = 14,
    H = 4.0,
    T = 7;
  const st = p.style;
  const life = k.st.life;
  const menu = k.cat.menus.restaurant.length ? k.cat.menus.restaurant : life.meals.map((m) => ({ ...m, time: 1 }));
  const acc = st.accent || "#1f6f8b";
  const gold = mat(st.trim || "#c9a45c", { metal: 1, rough: 0.3 });
  // the inside is D deep, the terrace T more to the north, the whole walkable area centred
  const oz = T / 2;
  k.floor(W, D, surfMat("parquet", sea ? "#9a7a58" : "#5a4030", undefined, { rough: 0.45 }), 0, oz, 2);
  k.floor(W, T, surfMat("wood", sea ? "#a88a64" : "#5a5856"), 0, oz - D / 2 - T / 2, 2.2);
  const wallM = mat(st.wall || "#f5efe4", { rough: 0.9 });
  const zb = oz - D / 2;
  k.wall(-W / 2, oz + D / 2, -W / 2, zb, H, wallM, { solid: false });
  k.wall(W / 2, zb, W / 2, oz + D / 2, H, wallM, { solid: false });
  const gap = 2.2;
  k.wall(W / 2, oz + D / 2, gap / 2, oz + D / 2, H, wallM, {});
  k.wall(-gap / 2, oz + D / 2, -W / 2, oz + D / 2, H, wallM, {});
  const head = k.wall(gap / 2, oz + D / 2, -gap / 2, oz + D / 2, H, wallM, { solid: false, low: 2.7 });
  k.mount(head, rbox(gap + 0.2, 0.12, 0.26, 0.02), gold, 0, 2.7, 0);
  k.spot("door", "Way out", 0, oz + D / 2 - 0.6, { r: 1.0, y: 1.6 });
  // the glass wall onto the terrace, open in the middle
  const g1 = k.wall(-W / 2, zb, -1.6, zb, H, glass("#d8e8f0", 0.12), { thick: 0.05, inner: true });
  const g2 = k.wall(1.6, zb, W / 2, zb, H, glass("#d8e8f0", 0.12), { thick: 0.05, inner: true });
  for (const [wg, len] of [
    [g1, W / 2 - 1.6],
    [g2, W / 2 - 1.6],
  ] as [THREE.Object3D, number][]) {
    k.mount(wg, rbox(len, 0.1, 0.1, 0.01), gold, 0, 0.05, 0);
    for (let u = -len / 2; u <= len / 2 + 1e-3; u += len / 3) k.mount(wg, rbox(0.05, H, 0.08, 0.01), gold, u, H / 2, 0);
  }
  k.add(rbox(3.2, 0.12, 0.14, 0.02), gold, 0, H - 0.06, zb);
  // ---------- beyond: the sea at dusk, or the city all round ----------
  const vt = viewTex(sea ? "sea" : "city", life.style.sky, k.night, life.style.key + "|r");
  const vm = new THREE.MeshBasicMaterial({ map: vt, toneMapped: false, fog: false });
  k.own.push(vm);
  const far = zb - T - 40;
  k.add(plane(160, 40), vm, 0, 10, far, 0, { shadow: false });
  for (const sx of [-1, 1]) k.add(plane(120, 40), vm, sx * 70, 10, far + 50, (-sx * Math.PI) / 2, { shadow: false });
  if (sea) {
    const water = new THREE.MeshStandardMaterial({ color: "#123048", roughness: 0.12, metalness: 0.6, emissive: new THREE.Color("#3a2a3a"), emissiveIntensity: 0.25 });
    k.own.push(water);
    k.add(plane(200, 60), water, 0, -1.2, zb - T - 30, 0, { rx: -Math.PI / 2, shadow: false });
    k.add(plane(5, 50), glow("#ffb070", 0.35), 6, -1.15, zb - T - 26, 0, { rx: -Math.PI / 2, shadow: false });
  } else {
    const roofs = mat("#2a2c32", { rough: 0.9 });
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI - Math.PI;
      const r = 40 + (i % 3) * 8;
      k.add(rbox(8, 12 + (i % 4) * 6, 8, 0.1), roofs, Math.cos(a) * r, -8, zb - T + Math.sin(a) * r, 0, { shadow: false });
    }
  }
  // the terrace: a rail at the edge, tables with candles, string lights
  const rail = glass("#e8f0f4", 0.25);
  k.add(rbox(W, 1.05, 0.05, 0.01), rail, 0, 0.52, zb - T + 0.05, 0, { shadow: false });
  // the building under the floors, so the view down past the terrace is not a void
  k.add(rbox(W + 0.4, 6, D + T + 0.2, 0.02), mat(sea ? "#3a3430" : "#2a2c32", { rough: 0.9 }), 0, -3.02, oz - T / 2, 0, { shadow: false });
  k.block(0, oz + D / 2 + 0.7, gap / 2 + 0.3, 0.3);
  k.add(rbox(W, 0.05, 0.08, 0.01), gold, 0, 1.06, zb - T + 0.05);
  k.block(0, zb - T + 0.05, W / 2, 0.1);
  for (let i = 0; i < 22; i++) {
    const x = -W / 2 + 0.5 + i * ((W - 1) / 21);
    const sag = Math.sin((i / 21) * Math.PI) * 0.5;
    k.add(sphere(0.05, 6), glow("#ffd8a0", 2.4), x, 3.2 - sag, zb - T / 2, 0, { shadow: false });
  }
  for (const x of [-W / 2 + 0.3, W / 2 - 0.3]) k.add(cyl(0.04, 0.04, 3.3, 6), mat("#2a2a2a", { metal: 0.6 }), x, 1.65, zb - T / 2);
  // ---------- inside: a bar, a sushi counter, the tables ----------
  const barM = mat("#2a1d15", { rough: 0.4 });
  k.box(0.9, 1.1, 6, barM, W / 2 - 1.2, 0.55, oz + 1.5);
  k.add(rbox(1.0, 0.05, 6.1, 0.01), mat("#d8cfc0", { rough: 0.2 }), W / 2 - 1.2, 1.12, oz + 1.5);
  for (let i = 0; i < 16; i++)
    k.inst("rbottle", () => shaded(new THREE.CylinderGeometry(0.04, 0.05, 0.3, 8)), goodsMat("gloss"), W / 2 - 0.25, 1.75, oz - 1.0 + i * 0.32, {
      col: ["#2a6a3a", "#c89a4a", "#e8e4dc", "#6a2a2a"][i % 4],
    });
  k.box(0.3, 0.04, 5.4, mat("#2a1d15"), W / 2 - 0.25, 1.58, oz + 1.0);
  k.block(W / 2 - 1.2, oz + 1.5, 0.5, 3.05);
  const sushiX = -W / 2 + 1.2;
  k.box(0.9, 1.05, 5, mat("#e8dcc4", { rough: 0.5 }), sushiX, 0.53, oz + 0.5);
  k.add(rbox(1.0, 0.05, 5.1, 0.01), mat("#3a2a1e", { rough: 0.3 }), sushiX, 1.07, oz + 0.5);
  k.block(sushiX, oz + 0.5, 0.5, 2.55);
  people(k, "chef", [{ x: -W / 2 + 0.45, z: oz + 0.5, ry: Math.PI / 2, col: "#f4f4f2" }]);
  // the tables: one dish on each, the best one by the glass or out on the terrace
  const clothM = mat("#f6f4ee", { rough: 0.85 });
  const chairM = mat(sea ? "#c8b49a" : "#3a2a20", { rough: 0.7 });
  const spots: { x: number; z: number; out?: boolean; counter?: boolean }[] = [
    { x: -4, z: zb - 2.4, out: true },
    { x: 4, z: zb - 2.4, out: true },
    { x: -4.5, z: zb + 1.8 },
    { x: 4.5, z: zb + 1.8 },
    { x: -1.6, z: oz + 3.4 },
    { x: 3.6, z: oz + 4.0 },
    { x: -5.2, z: oz + 4.4 },
  ];
  const sorted = [...menu].sort((a, b) => b.price - a.price);
  const used = new Set<number>();
  const placeFor = (m: MenuItem) => {
    if (/omakase|sushi/i.test(m.label)) return -1;
    if (/sea|bass|fish/i.test(m.label) && !used.has(0)) return 0;
    for (let i = 0; i < spots.length; i++) if (!used.has(i)) return i;
    return spots.length - 1;
  };
  for (const m of sorted) {
    const i = placeFor(m);
    if (i < 0) {
      dish(k, m, sushiX + 0.1, 1.1, oz + 0.5, 1.6);
      k.spot("menu:" + m.id, m.label, sushiX + 1.3, oz + 0.5, { ax: sushiX + 0.1, az: oz + 0.5, y: 1.25, r: 1.0 });
      continue;
    }
    used.add(i);
    const s = spots[i];
    k.add(cyl(0.6, 0.6, 0.05, 24), clothM, s.x, 0.76, s.z);
    k.add(cyl(0.62, 0.66, 0.5, 24, true), clothM, s.x, 0.52, s.z, 0, { shadow: false });
    for (const a of [0, Math.PI]) k.box(0.45, 0.48, 0.45, chairM, s.x + Math.cos(a) * 0.95, 0.24, s.z, 0, 0.06);
    k.add(cyl(0.025, 0.025, 0.12, 8), glow("#ffe6b0", 1.4), s.x + 0.25, 0.85, s.z - 0.2, 0, { shadow: false });
    dish(k, m, s.x, 0.79, s.z + 0.05, 2.0);
    k.block(s.x, s.z, 1.25, 0.65);
    k.spot("menu:" + m.id, m.label, s.x, s.z + 1.15, { ax: s.x, az: s.z, y: 1.0, r: 1.0 });
    if (!s.out) k.spotLamp(s.x, 2.7, s.z, "#ffc27a", { r: 0.8, pool: 0.3 });
    else k.pool(s.x, s.z, 3, "#ffc27a", 0.25);
  }
  people(k, "diner", [
    { x: 4.5 + 0.95, z: zb + 1.8, ry: -Math.PI / 2, col: "#1a2a4a", sit: true },
    { x: -1.6 - 0.95, z: oz + 3.4, ry: Math.PI / 2, col: "#8a1a24", sit: true },
    { x: W / 2 - 2.0, z: oz + 0.2, ry: Math.PI / 2, col: "#e8e4dc" },
  ]);
  k.text(p.name.toUpperCase(), "#2a1d15", "transparent", 0, 3.3, oz + D / 2 - 0.14, 6, 0.6, Math.PI);
  plant(k, -W / 2 + 0.7, oz + D / 2 - 0.7, 1.3);
  plant(k, W / 2 - 0.7, oz + D / 2 - 0.7, 1.3);
  return k.finish({
    w: W,
    d: D + T * 2,
    spawn: [0, oz + D / 2 - 1.8],
    mood: "warm",
    light: shopLight({
      warm: true,
      hemi: 0.7,
      sky: sea ? "#ffd8b8" : "#d8c8ff",
      ground: "#2a2028",
      keyI: 0.9,
      key: "#ffc890",
      bg: "#0a0c14",
      points: [
        { x: 0, y: 3.2, z: oz + 1, col: "#ffcf96", i: 8, dist: 20 },
        { x: 6, y: 3, z: zb - 3, col: "#ffb070", i: 5, dist: 14 },
      ],
    }),
    accent: acc,
    apron: null,
    cam: { dist: 7.4, height: 4.0 },
  });
}

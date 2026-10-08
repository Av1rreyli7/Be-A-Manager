/**
 * The watch boutique. By the door, bright glass counters: Casio and Guess, then Tissot, TAG Heuer and Omega.
 * Through the arch at the back, a dark green room lit like a vault: Rolex along the back wall, Audemars Piguet
 * and Richard Mille down the sides, every watch alone in its own glass cube under its own light.
 */
import * as THREE from "three";
import type { CatalogItem, WorldPlace } from "../../types";
import { rbox, cyl, mat, glass, glow, cachedTexture } from "../kit3d";
import { Kit, surfMat, shopLight, goodsMat, people, plant, slug, type Room } from "./common";
import { shapeGeo, shapeOf } from "./goods";

const BACK = ["rolex", "audemarspiguet", "richardmille", "patekphilippe"];
/** each watch brand's sign, drawn the way it writes its name */
function watchLogo(brand: string) {
  const b = slug(brand);
  return cachedTexture(
    "wlogo|" + b,
    (x, w, h) => {
      const S: Record<string, [string, string]> = {
        casio: ["#0a3d91", "#ffffff"],
        guess: ["#111111", "#ffffff"],
        tissot: ["#d8102e", "#ffffff"],
        tagheuer: ["#0b0b0b", "#ffffff"],
        omega: ["#f6f4ee", "#b8102e"],
        rolex: ["#0b3a24", "#d4af37"],
        audemarspiguet: ["#111111", "#e8e2d4"],
        richardmille: ["#d01818", "#ffffff"],
      };
      const [bg, fg] = S[b] || ["#141414", "#e8d4a8"];
      x.fillStyle = bg;
      x.fillRect(0, 0, w, h);
      x.fillStyle = fg;
      x.strokeStyle = fg;
      x.textAlign = "center";
      x.textBaseline = "middle";
      const fit = (t: string, font: string, size: number, y: number) => {
        let s = size;
        x.font = font.replace("{s}", String(s));
        while (x.measureText(t).width > w * 0.86 && s > 12) {
          s -= 4;
          x.font = font.replace("{s}", String(s));
        }
        x.fillText(t, w / 2, y);
      };
      if (b === "rolex") {
        // the crown
        x.beginPath();
        const cx = w / 2,
          cy = h * 0.36;
        x.moveTo(cx - 60, cy + 30);
        for (let i = 0; i < 5; i++) {
          const px = cx - 60 + i * 30;
          x.lineTo(px + 15, cy - 25 - (i === 2 ? 10 : 0));
          x.lineTo(px + 30, cy + 10);
        }
        x.lineTo(cx + 60, cy + 30);
        x.closePath();
        x.fill();
        for (let i = 0; i < 5; i++) {
          x.beginPath();
          x.arc(cx - 45 + i * 22.5, cy - 30 - (i === 2 ? 10 : 0), 7, 0, Math.PI * 2);
          x.fill();
        }
        fit("ROLEX", "500 {s}px 'Times New Roman', Didot, serif", 96, h * 0.76);
      } else if (b === "guess") {
        x.fillStyle = "#c8102e";
        x.beginPath();
        x.moveTo(w / 2 - 150, h * 0.12);
        x.lineTo(w / 2 + 150, h * 0.12);
        x.lineTo(w / 2, h * 0.95);
        x.closePath();
        x.fill();
        x.fillStyle = "#ffffff";
        fit("GUESS", "italic 800 {s}px 'Helvetica Neue', Arial, sans-serif", 70, h * 0.36);
      } else if (b === "omega") {
        fit("Ω", "400 {s}px 'Times New Roman', serif", 120, h * 0.36);
        fit("OMEGA", "600 {s}px 'Helvetica Neue', Arial, sans-serif", 64, h * 0.8);
      } else if (b === "casio") fit("CASIO", "italic 900 {s}px 'Helvetica Neue', Arial, sans-serif", 130, h * 0.55);
      else if (b === "tagheuer") {
        x.fillStyle = "#0a7a3a";
        x.fillRect(w / 2 - 70, h * 0.1, 140, h * 0.8);
        x.fillStyle = "#d8102e";
        x.fillRect(w / 2 - 60, h * 0.5, 120, h * 0.3);
        x.fillStyle = "#ffffff";
        fit("TAG", "800 {s}px 'Helvetica Neue', Arial, sans-serif", 54, h * 0.32);
        fit("HEUER", "800 {s}px 'Helvetica Neue', Arial, sans-serif", 34, h * 0.65);
      } else if (b === "audemarspiguet") fit("AUDEMARS PIGUET", "400 {s}px 'Times New Roman', Didot, serif", 64, h * 0.55);
      else if (b === "richardmille") fit("RICHARD MILLE", "800 {s}px 'Helvetica Neue', Arial, sans-serif", 70, h * 0.55);
      else fit(brand.toUpperCase(), "700 {s}px 'Helvetica Neue', Arial, sans-serif", 80, h * 0.55);
    },
    512,
    256,
  );
}

export function watchRoom(k: Kit, p: WorldPlace): Room {
  const W = 14,
    D = 16,
    H = 4.4;
  const items = k.cat.items.filter((i) => i.store === p.id);
  const gold = mat("#c9a24a", { metal: 1, rough: 0.25 });
  const green = p.style.trim && p.style.trim !== "#ffffff" ? p.style.trim : "#0f3d28";
  // ---------- the shell: a bright front, a dark green vault at the back ----------
  const split = -2;
  k.floor(W, D - (split + D / 2), surfMat("marble", "#e2d8c6", "#b8a888", { rough: 0.18 }), 0, (split + D / 2) / 2, 2.6);
  k.floor(W, split + D / 2, surfMat("carpet", "#0d2a1c"), 0, (-D / 2 + split) / 2, 3);
  const wallF = mat("#f4efe6", { rough: 0.85 });
  const wallB = mat(green, { rough: 0.8 });
  const faceB = surfMat("velvet", green);
  const back = k.wall(-W / 2, -D / 2, W / 2, -D / 2, H, wallB, { face: faceB, solid: false });
  k.wall(-W / 2, D / 2, -W / 2, split, H, wallF, { solid: false });
  k.wall(W / 2, split, W / 2, D / 2, H, wallF, { solid: false });
  const westB = k.wall(-W / 2, split, -W / 2, -D / 2, H, wallB, { face: faceB, solid: false });
  const eastB = k.wall(W / 2, -D / 2, W / 2, split, H, wallB, { face: faceB, solid: false });
  const gap = 2.4;
  k.wall(W / 2, D / 2, gap / 2, D / 2, H, wallF, {});
  k.wall(-gap / 2, D / 2, -W / 2, D / 2, H, wallF, {});
  const head = k.wall(gap / 2, D / 2, -gap / 2, D / 2, H, wallF, { solid: false, low: 2.7 });
  k.mount(head, rbox(gap + 0.2, 0.12, 0.26, 0.02), gold, 0, 2.66, 0);
  k.spot("door", "Way out", 0, D / 2 - 0.6, { r: 1.0, y: 1.6 });
  // the arch into the vault: a green wall with a gold framed opening
  const arch = 3.4;
  for (const [x1, x2] of [
    [-W / 2, -arch / 2],
    [arch / 2, W / 2],
  ]) {
    const wg = k.wall(x2, split, x1, split, H, wallB, { inner: true, thick: 0.3 });
    k.mount(wg, rbox(Math.abs(x2 - x1), 0.06, 0.04, 0.01), gold, 0, 3.0, 0.17);
  }
  const over = k.wall(arch / 2, split, -arch / 2, split, H, wallB, { inner: true, solid: false, low: 3.1, thick: 0.3 });
  k.mount(over, rbox(arch + 0.3, 0.14, 0.4, 0.02), gold, 0, 3.1, 0);
  k.sign(watchLogo("Rolex"), 0, 3.65, 0.17, 1.6, 0.8, 0, { to: over });
  // ---------- the front: four glass counters, the everyday brands ----------
  const brandOf = (it: CatalogItem) => slug(it.brand);
  const front = items.filter((i) => !BACK.includes(brandOf(i)));
  const groups = new Map<string, CatalogItem[]>();
  for (const it of front) {
    if (!groups.has(it.brand)) groups.set(it.brand, []);
    groups.get(it.brand)!.push(it);
  }
  // the counters stand along the side walls, the cheapest nearest the door, facing the middle of the room
  const counterSpots: [number, number, number][] = [
    [-W / 2 + 1.0, 5.6, 1],
    [W / 2 - 1.0, 5.6, 3],
    [-W / 2 + 1.0, 2.6, 1],
    [W / 2 - 1.0, 2.6, 3],
    [-W / 2 + 1.0, -0.4, 1],
    [W / 2 - 1.0, -0.4, 3],
  ];
  const counterM = mat("#f6f2ea", { rough: 0.4 });
  const pad = mat("#1a1a1a", { rough: 0.9 });
  [...groups.entries()]
    .sort((a, b) => Math.min(...a[1].map((i) => i.price)) - Math.min(...b[1].map((i) => i.price)))
    .slice(0, counterSpots.length)
    .forEach(([brand, list], gi) => {
      const [cx, cz, q] = counterSpots[gi];
      k.at(cx, cz, q, () => {
        const len = Math.min(3.0, Math.max(2.0, list.length * 0.7 + 0.5));
        k.box(len, 0.9, 0.7, counterM, 0, 0.45, 0, 0, 0.03);
        k.add(rbox(len, 0.04, 0.72, 0.01), gold, 0, 0.92, 0);
        k.add(rbox(len - 0.04, 0.34, 0.66, 0.01), glass("#eef4f8", 0.14), 0, 1.1, 0, 0, { shadow: false });
        k.add(rbox(len - 0.1, 0.02, 0.6, 0.005), glow("#fff6e4", 0.5), 0, 0.95, 0, 0, { shadow: false });
        k.block(0, 0, len / 2 + 0.05, 0.4);
        // the brand's sign on the wall behind the counter
        k.sign(watchLogo(brand), 0, 2.2, -0.75, 1.3, 0.65, 0);
        list.forEach((it, i) => {
          const x = -len / 2 + (len / (list.length + 1)) * (i + 1);
          k.add(cyl(0.11, 0.11, 0.14, 14), pad, x, 1.02, 0, 0, { rz: Math.PI / 2 });
          watch(k, it, x, 1.02, 0.02, 0, 1.35, x, 1.15);
        });
        k.pool(0, 0.6, 3, "#fff2dc", 0.14);
      });
    });
  // in the middle of the room: a big watch turning slowly on a round plinth, the clock over the arch
  k.add(cyl(0.7, 0.8, 0.9, 32), mat("#1a1a1a", { rough: 0.2, metal: 0.3 }), 0, 0.45, 2.6);
  k.add(cyl(0.72, 0.72, 0.04, 32), gold, 0, 0.92, 2.6);
  k.circle(0, 2.6, 0.85);
  const big = new THREE.Mesh(shapeGeo("watch"), new THREE.MeshStandardMaterial({ color: "#d4af37", metalness: 1, roughness: 0.2, vertexColors: true }));
  k.own.push(big.geometry, big.material as THREE.Material);
  big.scale.setScalar(4.2);
  const turn = new THREE.Group();
  turn.add(big);
  k.obj(turn, 0, 1.55, 2.6);
  k.ticks.push((_, dt) => (turn.rotation.y += dt * 0.4));
  k.pool(0, 2.6, 3.5, "#ffe6b0", 0.25);
  k.beam(0, H - 0.2, 2.6, 0.8, "#fff0d8", 0.08);
  // ---------- the vault: Rolex along the back, AP on the left, RM on the right ----------
  const vault = items.filter((i) => BACK.includes(brandOf(i)));
  const plinthM = mat("#0b0b0b", { rough: 0.2, metal: 0.3 });
  const cushion = (b: string) => mat(b === "rolex" ? "#0b3a24" : b === "richardmille" ? "#1a1a1a" : "#e8e2d4", { rough: 0.9 });
  const plinth = (it: CatalogItem, x: number, z: number, faceRy: number, sx: number, sz: number) => {
    k.box(0.62, 1.05, 0.62, plinthM, x, 0.525, z, 0, 0.02);
    k.add(rbox(0.66, 0.04, 0.66, 0.01), gold, x, 1.07, z);
    k.add(rbox(0.58, 0.5, 0.58, 0.01), glass("#f0f6fa", 0.12), x, 1.34, z, 0, { shadow: false });
    k.add(cyl(0.13, 0.13, 0.16, 14), cushion(brandOf(it)), x, 1.24, z, faceRy, { rz: Math.PI / 2 });
    watch(k, it, x, 1.24, z, faceRy, 1.6, sx, sz);
    k.spotLamp(x, H - 0.4, z, "#fff0d8", { beam: 0.09, pool: 0.32, r: 0.45 });
    k.block(x, z, 0.36, 0.36);
  };
  const rolex = vault.filter((i) => brandOf(i) === "rolex");
  const ap = vault.filter((i) => brandOf(i) === "audemarspiguet");
  const rm = vault.filter((i) => brandOf(i) === "richardmille");
  rolex.forEach((it, i) => {
    const x = (i - (rolex.length - 1) / 2) * Math.min(1.7, (W - 5) / Math.max(1, rolex.length - 1));
    plinth(it, x, -D / 2 + 1.1, 0, x, -D / 2 + 2.25);
  });
  // down the side walls of the vault, spread between the back corner and the arch wall
  const along = (n: number, i: number) => {
    const a = -D / 2 + 1.3,
      b = split - 0.9;
    return n <= 1 ? (a + b) / 2 : a + ((b - a) * i) / (n - 1);
  };
  ap.forEach((it, i) => plinth(it, -W / 2 + 1.0, along(ap.length, i), Math.PI / 2, -W / 2 + 2.15, along(ap.length, i)));
  rm.forEach((it, i) => plinth(it, W / 2 - 1.0, along(rm.length, i), -Math.PI / 2, W / 2 - 2.15, along(rm.length, i)));
  // the brands' names on the vault walls
  k.sign(watchLogo("Rolex"), 0, 3.0, 0.14, 2.0, 1.0, 0, { to: back });
  k.sign(watchLogo("Audemars Piguet"), -1.2, 2.9, 0.14, 2.4, 0.9, 0, { to: westB });
  k.sign(watchLogo("Richard Mille"), 0.6, 2.9, 0.14, 2.4, 0.9, 0, { to: eastB });
  for (const wg of [back, westB, eastB]) k.mount(wg, rbox(wg === back ? W : D / 2 + split, 0.05, 0.04, 0.01), gold, 0, 3.6, 0.14);
  // a sofa and a low table to sit at while they bring the tray
  k.box(1.8, 0.42, 0.8, mat("#e8dcc4", { rough: 0.9 }), 0, 0.21, -D / 2 + 4.6, 0, 0.12);
  k.box(1.8, 0.5, 0.2, mat("#e8dcc4", { rough: 0.9 }), 0, 0.55, -D / 2 + 4.95, 0, 0.08);
  k.box(1.0, 0.36, 0.5, mat("#1a1a1a", { rough: 0.2, metal: 0.3 }), 0, 0.18, -D / 2 + 3.8);
  k.block(0, -D / 2 + 4.3, 1.0, 0.75);
  people(k, "staff", [
    { x: -2.2, z: -D / 2 + 3.6, ry: 0.4, col: "#141414" },
    { x: -4.2, z: 4.2, ry: -1.2, col: "#141414" },
  ]);
  k.circle(-2.2, -D / 2 + 3.6, 0.3);
  k.circle(-4.2, 4.2, 0.3);
  plant(k, -W / 2 + 0.8, D / 2 - 0.8, 1.3);
  plant(k, W / 2 - 0.8, D / 2 - 0.8, 1.3);
  // lights: warm strips in the front, the vault lit only by its spots
  for (const x of [-4.6, 0, 4.6]) k.add(rbox(0.1, 0.04, 8, 0.01), glow("#fff2dc", 1.3), x, H - 0.25, 3.6, 0, { shadow: false });
  k.pool(0, -D / 2 + 3.8, 6, "#d8b46a", 0.12);
  return k.finish({
    w: W,
    d: D,
    spawn: [0, D / 2 - 2.6],
    mood: "warm",
    light: shopLight({
      warm: true,
      hemi: 0.6,
      keyI: 0.7,
      ground: "#1a1612",
      points: [
        { x: 0, y: 3.4, z: 3.5, col: "#ffe8c8", i: 7, dist: 16 },
        { x: 0, y: 3.2, z: -5, col: "#ffd8a0", i: 3.5, dist: 10 },
      ],
    }),
    accent: "#d4af37",
  });
}

/** one watch, upright, its face to the shopper */
function watch(k: Kit, it: CatalogItem, x: number, y: number, z: number, ry: number, s: number, sx: number, sz: number) {
  const shape = shapeOf(it);
  k.inst("w|" + shape, () => shapeGeo(shape), goodsMat("metal"), x, y, z, { ry, s, col: it.colour, id: "item:" + it.id });
  k.spot("item:" + it.id, it.label, sx, sz, { ax: x, az: z, y: y + 0.05, r: 0.8 });
}

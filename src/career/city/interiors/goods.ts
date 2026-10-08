/**
 * The things in the shops, as shapes: a tee, a hoodie, a polo, a shirt, a jacket, a puffer, trousers, shorts,
 * a pair of trainers, football boots, a bag, a watch, a chain, a phone, a laptop, headphones, and groceries.
 * Low poly but easy to read from the camera. Each shape carries a grey shade per vertex (pockets, collars,
 * zips and soles darker), and the shop multiplies it by the item's own colour, so one instanced mesh draws
 * every hoodie in the room in its own colour.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CatalogItem } from "../../types";

type V2 = [number, number];
const cache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry) {
  let g = cache.get(key);
  if (!g) {
    g = make();
    g.computeBoundingSphere();
    cache.set(key, g);
  }
  // the room owns what it is handed and disposes it, so hand out a copy
  return g.clone();
}

/** a part of a shape: flat (no index), moved into place, with its shade */
function part(geo: THREE.BufferGeometry, shade: number, o: { x?: number; y?: number; z?: number; rx?: number; ry?: number; rz?: number; s?: [number, number, number] } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(o.x || 0, o.y || 0, o.z || 0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx || 0, o.ry || 0, o.rz || 0)),
    new THREE.Vector3(...(o.s || [1, 1, 1])),
  );
  g.applyMatrix4(m);
  for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3).fill(shade);
  g.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
  g.clearGroups();
  return g;
}
function join(parts: THREE.BufferGeometry[]) {
  const g = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return g;
}
/** a flat outline pushed out to a thickness, softly bevelled, centred on its depth */
function slab(pts: V2[], depth: number, bevel = 0.012) {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  return g;
}
/** a garment front: the right half from the neck to the hem corner, mirrored */
function outline(right: V2[], neckDip: number): V2[] {
  const hemY = right[right.length - 1][1];
  const left = [...right].reverse().map(([x, y]) => [-x, y] as V2);
  return [[0, -neckDip], ...right, [0, hemY], ...left];
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cylG = (rt: number, rb: number, h: number, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);

// ---------- clothes, hanging face out; the top of the shoulders at y 0, hanging down ----------
const TEE = outline(
  [
    [0.09, 0],
    [0.22, -0.03],
    [0.36, -0.17],
    [0.3, -0.25],
    [0.235, -0.19],
    [0.24, -0.68],
  ],
  0.06,
);
const LONG = outline(
  [
    [0.1, 0],
    [0.2, -0.02],
    [0.3, -0.07],
    [0.35, -0.62],
    [0.27, -0.645],
    [0.255, -0.3],
    [0.255, -0.66],
  ],
  0.05,
);
const COAT = outline(
  [
    [0.1, 0],
    [0.22, -0.02],
    [0.32, -0.07],
    [0.37, -0.68],
    [0.28, -0.7],
    [0.265, -0.32],
    [0.275, -0.78],
  ],
  0.04,
);
export type Shape =
  | "tee"
  | "hoodie"
  | "crew"
  | "polo"
  | "shirt"
  | "jacket"
  | "puffer"
  | "blazer"
  | "trousers"
  | "shorts"
  | "trainers"
  | "boots"
  | "bag"
  | "watch"
  | "watch8"
  | "watchRM"
  | "watchSq"
  | "chain"
  | "ring"
  | "earrings"
  | "phone"
  | "laptop"
  | "headphones"
  | "console"
  | "tablet"
  | "cap";

export function shapeGeo(s: Shape): THREE.BufferGeometry {
  return cached("shape|" + s, () => {
    const D = 0.05;
    const front = D / 2 + 0.012;
    switch (s) {
      case "tee":
        return join([part(slab(TEE, D), 1), part(box(0.17, 0.03, 0.02), 0.82, { y: -0.035, z: front })]);
      case "polo":
        return join([
          part(slab(TEE, D), 1),
          part(
            slab(
              [
                [-0.08, 0.005],
                [-0.005, -0.065],
                [-0.12, -0.055],
              ],
              0.012,
              0.004,
            ),
            0.9,
            { z: front },
          ),
          part(
            slab(
              [
                [0.08, 0.005],
                [0.12, -0.055],
                [0.005, -0.065],
              ],
              0.012,
              0.004,
            ),
            0.9,
            { z: front },
          ),
          part(box(0.035, 0.15, 0.012), 0.82, { y: -0.12, z: front }),
          part(new THREE.SphereGeometry(0.009, 6, 4), 1.4, { y: -0.1, z: front + 0.01 }),
          part(new THREE.SphereGeometry(0.009, 6, 4), 1.4, { y: -0.16, z: front + 0.01 }),
        ]);
      case "shirt":
        return join([
          part(slab(LONG, D * 0.8), 1),
          part(
            slab(
              [
                [-0.075, 0.01],
                [-0.005, -0.07],
                [-0.13, -0.06],
              ],
              0.012,
              0.004,
            ),
            0.92,
            { z: front },
          ),
          part(
            slab(
              [
                [0.075, 0.01],
                [0.13, -0.06],
                [0.005, -0.07],
              ],
              0.012,
              0.004,
            ),
            0.92,
            { z: front },
          ),
          part(box(0.03, 0.62, 0.01), 0.86, { y: -0.35, z: front - 0.004 }),
          ...[0, 1, 2, 3, 4].map((i) => part(new THREE.SphereGeometry(0.008, 6, 4), 1.35, { y: -0.12 - i * 0.12, z: front + 0.006 })),
        ]);
      case "hoodie":
      case "crew": {
        const p = [
          part(slab(LONG, D * 1.3), 1),
          part(box(0.5, 0.05, 0.02), 0.84, { y: -0.635, z: front + 0.006 }),
          part(box(0.08, 0.04, 0.05), 0.84, { x: 0.31, y: -0.62, z: 0.005 }),
          part(box(0.08, 0.04, 0.05), 0.84, { x: -0.31, y: -0.62, z: 0.005 }),
        ];
        if (s === "hoodie") {
          p.push(part(slab(ellipse(0.17, 0.13), 0.06), 0.8, { y: 0.04, z: -0.03 }));
          p.push(part(slab(ellipse(0.1, 0.065), 0.02), 0.45, { y: 0.0, z: 0.02 }));
          p.push(
            part(
              slab(
                [
                  [-0.15, -0.38],
                  [0.15, -0.38],
                  [0.19, -0.56],
                  [-0.19, -0.56],
                ],
                0.012,
                0.004,
              ),
              0.88,
              { z: front + 0.004 },
            ),
          );
          p.push(part(cylG(0.006, 0.006, 0.18, 5), 1.35, { x: 0.045, y: -0.12, z: front + 0.01 }));
          p.push(part(cylG(0.006, 0.006, 0.18, 5), 1.35, { x: -0.045, y: -0.12, z: front + 0.01 }));
        } else p.push(part(new THREE.TorusGeometry(0.1, 0.018, 4, 14, Math.PI), 0.82, { y: 0.005, z: front - 0.01, rz: Math.PI }));
        return join(p);
      }
      case "jacket":
      case "puffer":
      case "blazer": {
        const p = [part(slab(COAT, s === "puffer" ? 0.1 : D * 1.4), 1)];
        const fz = (s === "puffer" ? 0.05 : D * 0.7) + 0.012;
        if (s === "blazer") {
          p.push(
            part(
              slab(
                [
                  [-0.1, 0.0],
                  [-0.02, -0.34],
                  [-0.16, -0.12],
                ],
                0.014,
                0.004,
              ),
              0.82,
              { z: fz },
            ),
          );
          p.push(
            part(
              slab(
                [
                  [0.1, 0.0],
                  [0.16, -0.12],
                  [0.02, -0.34],
                ],
                0.014,
                0.004,
              ),
              0.82,
              { z: fz },
            ),
          );
          p.push(part(new THREE.SphereGeometry(0.012, 6, 4), 0.5, { y: -0.42, z: fz + 0.008 }));
          p.push(part(new THREE.SphereGeometry(0.012, 6, 4), 0.5, { y: -0.52, z: fz + 0.008 }));
          p.push(part(box(0.1, 0.012, 0.012), 0.7, { x: -0.13, y: -0.58, z: fz }));
          p.push(part(box(0.1, 0.012, 0.012), 0.7, { x: 0.13, y: -0.58, z: fz }));
        } else {
          p.push(part(box(0.014, 0.76, 0.014), 0.32, { y: -0.39, z: fz }));
          p.push(part(box(0.26, 0.07, 0.04), 0.86, { y: 0.0, z: fz - 0.02 }));
          if (s === "puffer") for (let i = 0; i < 6; i++) p.push(part(cylG(0.03, 0.03, 0.54, 8), 1.06, { y: -0.08 - i * 0.12, z: 0.02, rz: Math.PI / 2, s: [1, 1, 0.8] }));
          else {
            p.push(part(box(0.1, 0.014, 0.014), 0.6, { x: -0.13, y: -0.52, z: fz, rz: 0.3 }));
            p.push(part(box(0.1, 0.014, 0.014), 0.6, { x: 0.13, y: -0.52, z: fz, rz: -0.3 }));
          }
        }
        return join(p);
      }
      case "trousers":
      case "shorts": {
        const L = s === "shorts" ? 0.48 : 0.95;
        const w = s === "shorts" ? 0.24 : 0.21;
        return join([
          part(
            slab(
              [
                [-0.19, 0],
                [0.19, 0],
                [w, -L],
                [0.035, -L],
                [0, -0.26],
                [-0.035, -L],
                [-w, -L],
              ],
              D,
            ),
            1,
          ),
          part(box(0.4, 0.05, 0.02), 0.78, { y: -0.025, z: front }),
          part(box(0.012, 0.18, 0.01), 0.6, { x: 0.03, y: -0.13, z: front }),
        ]);
      }
      case "cap":
        return join([part(new THREE.SphereGeometry(0.1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 1, { s: [1, 0.8, 1.1] }), part(box(0.17, 0.012, 0.11), 0.85, { y: 0.004, z: 0.12 })]);
      case "trainers":
      case "boots": {
        const prof: V2[] =
          s === "trainers"
            ? [
                [-0.15, 0.03],
                [-0.155, 0.125],
                [-0.1, 0.13],
                [-0.03, 0.1],
                [0.03, 0.105],
                [0.1, 0.065],
                [0.15, 0.04],
                [0.155, 0.03],
              ]
            : [
                [-0.14, 0.03],
                [-0.145, 0.1],
                [-0.09, 0.105],
                [-0.02, 0.075],
                [0.06, 0.07],
                [0.13, 0.042],
                [0.155, 0.03],
              ];
        const p: THREE.BufferGeometry[] = [];
        for (const side of [-1, 1]) {
          p.push(part(slab(prof, 0.085, 0.015), 1, { z: side * 0.062 }));
          p.push(part(box(0.32, 0.035, 0.1), s === "trainers" ? 1.6 : 0.4, { y: 0.018, z: side * 0.062 }));
          p.push(part(box(0.11, 0.012, 0.004), s === "trainers" ? 0.7 : 1.5, { x: 0.02, y: 0.07, z: side * (0.062 + 0.056), rz: -0.35 }));
          if (s === "boots") for (let k = 0; k < 4; k++) p.push(part(cylG(0.012, 0.009, 0.02, 6), 0.5, { x: -0.1 + k * 0.075, y: -0.008, z: side * 0.062 }));
        }
        return join(p);
      }
      case "bag":
        return join([
          part(
            slab(
              [
                [-0.18, 0],
                [0.18, 0],
                [0.15, 0.24],
                [-0.15, 0.24],
              ],
              0.13,
            ),
            1,
          ),
          part(
            slab(
              [
                [-0.155, 0.245],
                [0.155, 0.245],
                [0.165, 0.12],
                [-0.165, 0.12],
              ],
              0.01,
              0.004,
            ),
            0.8,
            { z: 0.08 },
          ),
          part(new THREE.TorusGeometry(0.09, 0.012, 5, 14, Math.PI), 0.72, { y: 0.25 }),
          part(box(0.05, 0.03, 0.012), 1.7, { y: 0.13, z: 0.088 }),
        ]);
      case "watch":
      case "watch8":
      case "watchRM":
      case "watchSq": {
        // upright, wrapped round an unseen wrist, the case facing the shopper
        const p = [part(new THREE.TorusGeometry(0.085, 0.016, 6, 22), 0.92, { s: [1, 1, 1.5] })];
        const cz = 0.095;
        if (s === "watch") {
          p.push(part(cylG(0.058, 0.058, 0.03, 24), 1, { z: cz, rx: Math.PI / 2 }));
          p.push(part(new THREE.TorusGeometry(0.056, 0.008, 5, 24), 1.25, { z: cz + 0.016 }));
          p.push(part(cylG(0.048, 0.048, 0.004, 24), 0.12, { z: cz + 0.016, rx: Math.PI / 2 }));
        } else if (s === "watch8") {
          p.push(part(cylG(0.062, 0.062, 0.03, 8), 1, { z: cz, rx: Math.PI / 2, ry: Math.PI / 8 }));
          p.push(part(cylG(0.046, 0.046, 0.004, 8), 0.16, { z: cz + 0.016, rx: Math.PI / 2, ry: Math.PI / 8 }));
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
            p.push(part(cylG(0.005, 0.005, 0.006, 6), 1.5, { x: Math.cos(a) * 0.054, y: Math.sin(a) * 0.054, z: cz + 0.017, rx: Math.PI / 2 }));
          }
        } else if (s === "watchRM") {
          const barrel: V2[] = [];
          for (let i = 0; i < 20; i++) {
            const a = (i / 20) * Math.PI * 2;
            barrel.push([Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), 0.55) * 0.055, Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.55) * 0.068]);
          }
          p.push(part(slab(barrel, 0.03, 0.008), 1, { z: cz }));
          p.push(part(box(0.07, 0.09, 0.004), 0.2, { z: cz + 0.024 }));
          p.push(part(box(0.05, 0.012, 0.004), 1.6, { y: 0.02, z: cz + 0.027 }));
        } else {
          p.push(part(box(0.11, 0.12, 0.035), 1, { z: cz }));
          p.push(part(box(0.07, 0.05, 0.004), 0.22, { z: cz + 0.019 }));
          p.push(part(box(0.06, 0.012, 0.004), 1.5, { y: 0.04, z: cz + 0.019 }));
        }
        p.push(part(cylG(0.009, 0.009, 0.016, 8), 1.2, { x: 0.068, z: cz, rz: Math.PI / 2 }));
        // hour marks
        if (s !== "watchSq" && s !== "watchRM")
          for (let i = 0; i < 12; i += 3) {
            const a = (i / 12) * Math.PI * 2;
            p.push(part(box(0.006, 0.014, 0.003), 1.8, { x: Math.sin(a) * 0.036, y: Math.cos(a) * 0.036, z: cz + 0.02, rz: -a }));
          }
        return join(p);
      }
      case "chain":
        return join([part(new THREE.TorusGeometry(0.11, 0.009, 5, 28), 1, { rx: 0.35, s: [1, 1.25, 1] }), part(new THREE.SphereGeometry(0.02, 8, 6), 1.1, { y: -0.135, z: 0.04 })]);
      case "ring":
        return join([part(new THREE.TorusGeometry(0.035, 0.01, 6, 18), 1), part(new THREE.OctahedronGeometry(0.018), 1.6, { y: 0.045 })]);
      case "earrings":
        return join([part(new THREE.OctahedronGeometry(0.02), 1.4, { x: -0.04 }), part(new THREE.OctahedronGeometry(0.02), 1.4, { x: 0.04 }), part(box(0.14, 0.008, 0.008), 0.7, { y: 0.03 })]);
      case "phone":
        return join([
          part(new THREE.BoxGeometry(0.15, 0.3, 0.018), 1),
          part(box(0.135, 0.28, 0.004), 0.08, { z: 0.011 }),
          part(cylG(0.018, 0.018, 0.008, 12), 0.5, { x: -0.035, y: 0.1, z: -0.012, rx: Math.PI / 2 }),
        ]);
      case "tablet":
        return join([part(box(0.36, 0.26, 0.014), 1), part(box(0.34, 0.24, 0.004), 0.08, { z: 0.009 })]);
      case "laptop":
        return join([
          part(box(0.5, 0.022, 0.34), 1, { y: 0.011 }),
          part(box(0.44, 0.004, 0.16), 0.45, { y: 0.024, z: -0.04 }),
          part(box(0.5, 0.32, 0.014), 1, { y: 0.17, z: -0.2, rx: -0.25 }),
          part(box(0.46, 0.28, 0.004), 0.1, { y: 0.172, z: -0.19, rx: -0.25 }),
        ]);
      case "headphones":
        return join([
          part(new THREE.TorusGeometry(0.12, 0.014, 6, 18, Math.PI), 1, { y: 0.05 }),
          part(cylG(0.06, 0.06, 0.05, 14), 1, { x: -0.12, y: 0.03, rz: Math.PI / 2 }),
          part(cylG(0.06, 0.06, 0.05, 14), 1, { x: 0.12, y: 0.03, rz: Math.PI / 2 }),
          part(cylG(0.05, 0.05, 0.02, 14), 0.4, { x: -0.095, y: 0.03, rz: Math.PI / 2 }),
          part(cylG(0.05, 0.05, 0.02, 14), 0.4, { x: 0.095, y: 0.03, rz: Math.PI / 2 }),
        ]);
      case "console":
        return join([part(box(0.36, 0.09, 0.28), 1, { y: 0.045 }), part(box(0.36, 0.01, 0.01), 0.3, { y: 0.06, z: 0.141 }), part(box(0.16, 0.05, 0.1), 0.4, { x: 0.12, y: 0.115, z: 0.18, rx: 0.2 })]);
    }
  });
}
function ellipse(rx: number, ry: number, n = 14): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push([Math.cos(a) * rx, Math.sin(a) * ry]);
  }
  return out;
}

/** which shape an item is, from its category and its name */
export function shapeOf(it: Pick<CatalogItem, "cat" | "label" | "brand">): Shape {
  const l = (it.label + " " + it.brand).toLowerCase();
  const has = (...w: string[]) => w.some((x) => l.includes(x));
  switch (it.cat) {
    case "top":
      if (has("hood")) return "hoodie";
      if (has("polo")) return "polo";
      if (has("shirt") && !has("t-shirt", "tshirt", "tee")) return "shirt";
      if (has("sweat", "crew", "jumper", "knit", "cardigan", "sweater")) return "crew";
      return "tee";
    case "outer":
      if (has("puffer", "down", "parka", "nuptse")) return "puffer";
      if (has("blazer", "suit", "tailored")) return "blazer";
      return "jacket";
    case "bottom":
      return has("short") ? "shorts" : "trousers";
    case "shoes":
      return "trainers";
    case "boots":
      return "boots";
    case "bag":
      return "bag";
    case "watch":
      if (has("audemars", "royal oak", "nautilus", "aquanaut")) return "watch8";
      if (has("richard mille", "rm ", "rm0", "rm1", "rm6")) return "watchRM";
      if (has("casio", "g-shock", "apple watch", "digital", "f-91", "f91")) return "watchSq";
      return "watch";
    case "jewellery":
      if (has("ring")) return "ring";
      if (has("earring", "stud")) return "earrings";
      return "chain";
    case "tech":
      if (has("laptop", "macbook", "notebook")) return "laptop";
      if (has("headphone", "airpods", "buds", "beats", "sony wh", "speaker")) return "headphones";
      if (has("console", "playstation", "xbox", "switch", "ps5")) return "console";
      if (has("ipad", "tablet")) return "tablet";
      if (has("watch")) return "watchSq";
      return "phone";
  }
  return "tee";
}
/** how high the middle of a shape sits above its origin (for the highlight) */
export const SHAPE_MID: Partial<Record<Shape, number>> = {
  tee: -0.34,
  polo: -0.34,
  shirt: -0.36,
  hoodie: -0.33,
  crew: -0.33,
  jacket: -0.38,
  puffer: -0.38,
  blazer: -0.38,
  trousers: -0.45,
  shorts: -0.24,
};
export const isHanging = (s: Shape) => ["tee", "polo", "shirt", "hoodie", "crew", "jacket", "puffer", "blazer", "trousers", "shorts"].includes(s);
export const goodsKind = (s: Shape): "cloth" | "leather" | "metal" | "gloss" | "plastic" =>
  ["watch", "watch8", "watchRM", "chain", "ring", "earrings"].includes(s)
    ? "metal"
    : s === "bag"
      ? "leather"
      : ["trainers", "boots"].includes(s)
        ? "leather"
        : ["phone", "tablet", "laptop", "headphones", "console", "watchSq"].includes(s)
          ? "gloss"
          : "cloth";

// ---------- worn on a mannequin: a body shape, not a flat front ----------
export function wornGeo(kind: "top" | "long" | "hood" | "coat" | "legs" | "short") {
  return cached("worn|" + kind, () => {
    const p: THREE.BufferGeometry[] = [];
    if (kind === "legs" || kind === "short") {
      const L = kind === "short" ? 0.38 : 0.82;
      p.push(part(cylG(0.17, 0.16, 0.16, 14), 1, { y: -0.08, s: [1, 1, 0.7] }));
      for (const sx of [-1, 1]) p.push(part(cylG(0.085, 0.07, L, 10), 1, { x: sx * 0.085, y: -0.16 - L / 2, rz: sx * 0.03 }));
      p.push(part(box(0.32, 0.04, 0.2), 0.78, { y: -0.01 }));
      return join(p);
    }
    const long = kind !== "top";
    const coat = kind === "coat";
    p.push(part(cylG(0.18, coat ? 0.19 : 0.16, coat ? 0.78 : 0.6, 14), 1, { y: coat ? -0.39 : -0.3, s: [1, 1, 0.66] }));
    p.push(part(new THREE.SphereGeometry(0.18, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 1, { s: [1, 0.4, 0.66] }));
    for (const sx of [-1, 1]) {
      const L = long ? 0.55 : 0.2;
      p.push(part(cylG(0.065, 0.055, L, 10), 1, { x: sx * 0.215, y: -L / 2 - 0.02, rz: sx * 0.12 }));
    }
    if (kind === "hood") p.push(part(new THREE.SphereGeometry(0.13, 12, 8), 0.82, { y: 0.04, z: -0.09, s: [1, 0.8, 0.8] }));
    else p.push(part(new THREE.TorusGeometry(0.07, 0.02, 5, 14), 0.82, { y: 0.02, rx: Math.PI / 2 }));
    if (coat) p.push(part(box(0.014, 0.76, 0.014), 0.32, { y: -0.39, z: 0.125 }));
    return join(p);
  });
}

// ---------- groceries ----------
export type Prod = "box" | "bottle" | "can" | "jar" | "carton" | "bag" | "fruit" | "tub";
export function prodGeo(p: Prod) {
  return cached("prod|" + p, () => {
    switch (p) {
      case "box":
        return join([part(box(0.2, 0.28, 0.07), 1, { y: 0.14 }), part(box(0.16, 0.1, 0.004), 1.5, { y: 0.16, z: 0.037 })]);
      case "bottle": {
        const lathe = new THREE.LatheGeometry(
          [
            [0, 0],
            [0.038, 0],
            [0.04, 0.02],
            [0.04, 0.17],
            [0.02, 0.22],
            [0.014, 0.25],
            [0, 0.25],
          ].map(([x, y]) => new THREE.Vector2(x, y)),
          8,
        );
        return join([part(lathe, 1), part(cylG(0.0415, 0.0415, 0.07, 8), 1.55, { y: 0.1 }), part(cylG(0.016, 0.016, 0.025, 8), 0.4, { y: 0.26 })]);
      }
      case "can":
        return join([part(cylG(0.033, 0.033, 0.12, 8), 1, { y: 0.06 }), part(cylG(0.03, 0.033, 0.01, 8), 1.7, { y: 0.125 })]);
      case "jar":
        return join([part(cylG(0.045, 0.045, 0.1, 8), 1.15, { y: 0.05 }), part(cylG(0.047, 0.047, 0.025, 8), 0.7, { y: 0.112 })]);
      case "carton":
        return join([part(box(0.07, 0.19, 0.07), 1.45, { y: 0.095 }), part(cylG(0.0, 0.05, 0.04, 4), 1, { y: 0.21, ry: Math.PI / 4 }), part(box(0.072, 0.07, 0.072), 1, { y: 0.1 })]);
      case "bag":
        return join([part(new THREE.SphereGeometry(0.12, 8, 6), 1, { y: 0.13, s: [0.85, 1.1, 0.4] }), part(box(0.18, 0.02, 0.05), 0.85, { y: 0.255 })]);
      case "tub":
        return join([part(cylG(0.06, 0.05, 0.08, 10), 1.1, { y: 0.04 }), part(cylG(0.062, 0.062, 0.012, 10), 0.8, { y: 0.085 })]);
      case "fruit":
        return part(new THREE.IcosahedronGeometry(0.05, 1), 1);
    }
  });
}
export const PROD_H: Record<Prod, number> = { box: 0.28, bottle: 0.27, can: 0.13, jar: 0.125, carton: 0.23, bag: 0.27, fruit: 0.1, tub: 0.09 };
/** a grocery's packaging from its name */
export function prodOf(label: string, aisle = ""): Prod {
  const l = (label + " " + aisle).toLowerCase();
  const has = (...w: string[]) => w.some((x) => l.includes(x));
  if (has("banana", "apple", "orange", "mango", "fruit", "berries", "avocado", "lemon", "veg", "tomato", "onion", "potato")) return "fruit";
  if (has("milk", "juice", "lassi", "carton")) return "carton";
  if (has("water", "drink", "soda", "cola", "bottle", "oil", "sauce", "shake", "kombucha", "gatorade", "isotonic", "lucozade")) return "bottle";
  if (has("can", "beans", "tuna", "energy", "red bull", "monster")) return "can";
  if (has("crisp", "chips", "nachos", "snack", "lays", "popcorn")) return "bag";
  if (has("yog", "ice cream", "hummus", "tub", "curd", "paneer")) return "tub";
  if (has("jar", "honey", "jam", "nutella", "peanut", "pickle", "spread")) return "jar";
  return "box";
}

/** a folded tee or jumper on a table, a little fold line across it */
export function foldGeo() {
  return cached("fold", () =>
    join([part(box(0.34, 0.06, 0.27), 1, { y: 0.03 }), part(box(0.34, 0.008, 0.01), 0.75, { y: 0.045, z: 0.13 }), part(box(0.12, 0.004, 0.08), 0.85, { y: 0.062, z: 0.04 })]),
  );
}

/** a static copy of a shape without its shades (for things that are never sold: fillers in plain materials) */
export function plainGeo(g: THREE.BufferGeometry) {
  const c = g.clone();
  c.deleteAttribute("color");
  return c;
}

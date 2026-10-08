/**
 * The shared kit every interior is built with. A room is built in local coordinates (quarter turns and offsets
 * can be stacked, so a shop can be built inside the mall the same way it is built on its own), then finished:
 * every static mesh that shares a material is merged into one, repeated things (clothes, products, bottles,
 * light pools) become instanced meshes, so even the big rooms draw in a few dozen calls.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CareerState, WorldPlace, LifeCatalog } from "../../types";
import { rbox, plane, mat, glow, signTexture, cachedTexture, seeded, cone, lightCone } from "../kit3d";

export interface Hotspot {
  id: string;
  label: string;
  /** where he stands to use it */
  x: number;
  z: number;
  r?: number;
  /** the thing itself: where the highlight and its little label sit (defaults to the standing spot) */
  ax?: number;
  az?: number;
  y?: number;
  /** a place to use: a ring on the floor and a floating name. Items have neither, they light up when he is near */
  tag?: boolean;
  /** the instance to brighten while he stands at it */
  inst?: { mesh: THREE.InstancedMesh; i: number };
}
export type Circle = { x: number; z: number; r: number };
export type Rect = { x: number; z: number; hw: number; hd: number };
export type Ob = Circle | Rect;
export const isRect = (o: Ob): o is Rect => (o as Rect).hw !== undefined;
export interface Wall {
  mesh: THREE.Object3D;
  nx: number;
  nz: number;
  cx: number;
  cz: number;
  /** half its length; inner walls only drop when they stand between the camera and him */
  half?: number;
  inner?: boolean;
}
export interface RoomLight {
  sky: string;
  ground: string;
  hemi: number;
  key: string;
  keyI: number;
  points: { x: number; y: number; z: number; col: string; i: number; dist: number }[];
  bg: string;
  fog?: [string, number, number];
}
export interface Room {
  w: number;
  d: number;
  spawn: [number, number];
  obstacles: Ob[];
  hotspots: Hotspot[];
  group: THREE.Group;
  walls: Wall[];
  mood: "warm" | "cool" | "night" | "stadium";
  outdoor?: boolean;
  light?: RoomLight;
  accent?: string;
  cam?: { dist: number; height: number };
  tick?: (t: number, dt: number) => void;
  dispose: () => void;
}

export const catalogOf = (st: CareerState): LifeCatalog => st.life.catalog || { items: [], cars: [], groceries: [], menus: { cafe: [], restaurant: [], club: [], clinic: [] } };
export const placesOf = (st: CareerState): WorldPlace[] => st.life.world?.places || [];
export const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// ---------- surfaces: floors and walls painted on canvases, cached ----------
export type Surface =
  | "concrete"
  | "wood"
  | "darkwood"
  | "parquet"
  | "carpet"
  | "marble"
  | "checker"
  | "tile"
  | "plywood"
  | "rubber"
  | "terrazzo"
  | "epoxy"
  | "plain"
  | "panels"
  | "moulding"
  | "monogram"
  | "graffiti"
  | "stripes"
  | "velvet"
  | "brick"
  | "slats"
  | "led";
const rgb = (c: THREE.Color, k = 1) => `rgb(${Math.round(Math.min(1, c.r * k) * 255)},${Math.round(Math.min(1, c.g * k) * 255)},${Math.round(Math.min(1, c.b * k) * 255)})`;
/** a tiling surface texture: kind, a main colour and a second one */
export function surface(kind: Surface, a: string, b = "#000000") {
  return cachedTexture(
    "surf|" + kind + "|" + a + "|" + b,
    (x, w, h) => {
      const r = seeded(kind + a + b);
      const A = new THREE.Color(a),
        B = new THREE.Color(b);
      x.fillStyle = a;
      x.fillRect(0, 0, w, h);
      const speck = (n: number, alpha: number, size = 2) => {
        for (let i = 0; i < n; i++) {
          x.fillStyle = r() < 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha * 1.4})`;
          x.fillRect(r() * w, r() * h, size, size);
        }
      };
      if (kind === "concrete") {
        for (let i = 0; i < 26; i++) {
          const cx = r() * w,
            cy = r() * h;
          const g = x.createRadialGradient(cx, cy, 0, cx, cy, 60 + r() * 140);
          g.addColorStop(0, r() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)");
          g.addColorStop(1, "rgba(0,0,0,0)");
          x.fillStyle = g;
          x.fillRect(0, 0, w, h);
        }
        speck(5000, 0.05, 1.5);
        x.strokeStyle = "rgba(0,0,0,0.12)";
        x.lineWidth = 2;
        x.strokeRect(0, 0, w, h);
      } else if (kind === "wood" || kind === "darkwood") {
        const rows = 8;
        for (let i = 0; i < rows; i++) {
          const k = 0.86 + r() * 0.26;
          x.fillStyle = rgb(A, k);
          x.fillRect(0, (i * h) / rows, w, h / rows - 2);
          for (let s = 0; s < 18; s++) {
            x.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.06})`;
            x.fillRect(r() * w, (i * h) / rows + r() * (h / rows), 30 + r() * w * 0.5, 1);
          }
          x.fillStyle = "rgba(0,0,0,0.4)";
          x.fillRect(r() * w, (i * h) / rows, 2, h / rows);
        }
      } else if (kind === "parquet") {
        const n = 8,
          s = w / n;
        for (let i = 0; i < n; i++)
          for (let j = 0; j < n; j++) {
            const vertical = (i + j) % 2 === 0;
            for (let k = 0; k < 4; k++) {
              x.fillStyle = rgb(A, 0.9 + r() * 0.16);
              if (vertical) x.fillRect(i * s + (k * s) / 4, j * s, s / 4 - 1, s - 1);
              else x.fillRect(i * s, j * s + (k * s) / 4, s - 1, s / 4 - 1);
            }
          }
      } else if (kind === "carpet" || kind === "velvet") {
        speck(9000, kind === "velvet" ? 0.03 : 0.05, 1);
        if (kind === "velvet") {
          for (let i = 0; i < w; i += 4) {
            const v = Math.sin(i * 0.05) * 0.5 + Math.sin(i * 0.013) * 0.5;
            x.fillStyle = v > 0 ? `rgba(255,255,255,${v * 0.07})` : `rgba(0,0,0,${-v * 0.22})`;
            x.fillRect(i, 0, 4, h);
          }
        }
      } else if (kind === "marble") {
        speck(1500, 0.02, 3);
        x.lineCap = "round";
        for (let v = 0; v < 9; v++) {
          x.strokeStyle = b;
          x.globalAlpha = 0.18 + r() * 0.3;
          x.lineWidth = 0.6 + r() * 2.2;
          x.beginPath();
          let px = r() * w,
            py = 0;
          x.moveTo(px, py);
          while (py < h) {
            px += (r() - 0.5) * 60;
            py += 12 + r() * 30;
            x.lineTo(px, py);
          }
          x.stroke();
        }
        x.globalAlpha = 1;
        x.strokeStyle = "rgba(0,0,0,0.18)";
        x.lineWidth = 2;
        x.strokeRect(0, 0, w, h);
      } else if (kind === "checker") {
        const n = 4,
          s = w / n;
        for (let i = 0; i < n; i++)
          for (let j = 0; j < n; j++) {
            x.fillStyle = (i + j) % 2 ? b : a;
            x.fillRect(i * s, j * s, s, s);
            x.strokeStyle = (i + j) % 2 ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
            x.globalAlpha = 0.5;
            for (let v = 0; v < 2; v++) {
              x.beginPath();
              x.moveTo(i * s + r() * s, j * s);
              x.lineTo(i * s + r() * s, j * s + s);
              x.stroke();
            }
            x.globalAlpha = 1;
          }
        x.strokeStyle = "rgba(128,128,128,0.35)";
        for (let i = 0; i <= n; i++) {
          x.beginPath();
          x.moveTo(i * s, 0);
          x.lineTo(i * s, h);
          x.moveTo(0, i * s);
          x.lineTo(w, i * s);
          x.stroke();
        }
      } else if (kind === "tile") {
        const n = 4,
          s = w / n;
        x.fillStyle = b;
        x.fillRect(0, 0, w, h);
        for (let i = 0; i < n; i++)
          for (let j = 0; j < n; j++) {
            x.fillStyle = rgb(A, 0.95 + r() * 0.08);
            x.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
          }
      } else if (kind === "plywood") {
        for (let i = 0; i < 70; i++) {
          x.strokeStyle = `rgba(120,80,30,${0.05 + r() * 0.1})`;
          x.lineWidth = 1 + r() * 3;
          x.beginPath();
          const y0 = r() * h;
          x.moveTo(0, y0);
          x.bezierCurveTo(w * 0.3, y0 + (r() - 0.5) * 40, w * 0.6, y0 + (r() - 0.5) * 40, w, y0 + (r() - 0.5) * 20);
          x.stroke();
        }
        x.strokeStyle = "rgba(60,40,20,0.5)";
        x.lineWidth = 3;
        x.strokeRect(1, 1, w - 2, h - 2);
        x.fillStyle = "rgba(40,40,40,0.6)";
        for (const [sx, sy] of [
          [10, 10],
          [w - 10, 10],
          [10, h - 10],
          [w - 10, h - 10],
          [w / 2, 10],
          [w / 2, h - 10],
        ]) {
          x.beginPath();
          x.arc(sx, sy, 3, 0, Math.PI * 2);
          x.fill();
        }
      } else if (kind === "rubber") {
        speck(6000, 0.05, 2);
      } else if (kind === "terrazzo") {
        for (let i = 0; i < 900; i++) {
          x.fillStyle = [b, "#ffffff", "#8a8a8a", rgb(B, 0.7)][Math.floor(r() * 4)];
          x.globalAlpha = 0.5 + r() * 0.5;
          x.beginPath();
          x.ellipse(r() * w, r() * h, 2 + r() * 6, 2 + r() * 4, r() * 3, 0, Math.PI * 2);
          x.fill();
        }
        x.globalAlpha = 1;
      } else if (kind === "epoxy") {
        speck(7000, 0.06, 1.5);
        for (let i = 0; i < 12; i++) {
          const cx = r() * w,
            cy = r() * h;
          const g = x.createRadialGradient(cx, cy, 0, cx, cy, 80 + r() * 100);
          g.addColorStop(0, "rgba(255,255,255,0.05)");
          g.addColorStop(1, "rgba(255,255,255,0)");
          x.fillStyle = g;
          x.fillRect(0, 0, w, h);
        }
      } else if (kind === "panels") {
        const n = 4,
          s = w / n;
        for (let i = 0; i < n; i++) {
          x.fillStyle = rgb(A, 0.9 + r() * 0.12);
          x.fillRect(i * s, 0, s, h);
          x.strokeStyle = "rgba(0,0,0,0.45)";
          x.lineWidth = 4;
          x.strokeRect(i * s + 14, 20, s - 28, h * 0.42);
          x.strokeRect(i * s + 14, h * 0.5, s - 28, h * 0.46);
          x.strokeStyle = b;
          x.globalAlpha = 0.35;
          x.lineWidth = 2;
          x.strokeRect(i * s + 18, 24, s - 36, h * 0.42 - 8);
          x.strokeRect(i * s + 18, h * 0.5 + 4, s - 36, h * 0.46 - 8);
          x.globalAlpha = 1;
          x.fillStyle = "rgba(0,0,0,0.5)";
          x.fillRect(i * s, 0, 3, h);
        }
      } else if (kind === "moulding") {
        const n = 2,
          s = w / n;
        for (let i = 0; i < n; i++) {
          x.strokeStyle = rgb(A, 1.12);
          x.lineWidth = 6;
          x.strokeRect(i * s + 24, 30, s - 48, h * 0.55);
          x.strokeRect(i * s + 24, h * 0.66, s - 48, h * 0.28);
          x.strokeStyle = rgb(A, 0.78);
          x.lineWidth = 2;
          x.strokeRect(i * s + 30, 36, s - 60, h * 0.55 - 12);
          x.strokeRect(i * s + 30, h * 0.66 + 6, s - 60, h * 0.28 - 12);
        }
        x.fillStyle = rgb(A, 0.82);
        x.fillRect(0, h * 0.62, w, 6);
      } else if (kind === "monogram") {
        // a pattern in the way of the famous canvas: flowers, quatrefoils and the two letters, in rows
        const n = 4,
          s = w / n;
        x.fillStyle = b;
        x.textAlign = "center";
        x.textBaseline = "middle";
        for (let i = 0; i < n; i++)
          for (let j = 0; j < n; j++) {
            const cx = i * s + s / 2 + (j % 2 ? s / 2 : 0),
              cy = j * s + s / 2;
            const kind2 = (i + j * 3) % 3;
            x.save();
            x.translate(cx % w, cy);
            if (kind2 === 0) {
              x.font = "italic 700 34px Futura, 'Gill Sans', sans-serif";
              x.fillText("LV", 0, 2);
            } else if (kind2 === 1) {
              for (let p = 0; p < 4; p++) {
                x.rotate(Math.PI / 2);
                x.beginPath();
                x.ellipse(0, -11, 6, 11, 0, 0, Math.PI * 2);
                x.fill();
              }
              x.fillStyle = a;
              x.beginPath();
              x.arc(0, 0, 4, 0, Math.PI * 2);
              x.fill();
              x.fillStyle = b;
            } else {
              x.beginPath();
              for (let p = 0; p < 8; p++) {
                const ang = (p / 8) * Math.PI * 2;
                const rr = p % 2 ? 9 : 20;
                x.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
              }
              x.closePath();
              x.fill();
            }
            x.restore();
          }
      } else if (kind === "graffiti") {
        speck(2000, 0.04, 2);
        const words = ["STUSSY", "S", "WORLD TOUR", "NO.4", "SS", "8 BALL"];
        for (let i = 0; i < 18; i++) {
          x.save();
          x.translate(r() * w, r() * h);
          x.rotate((r() - 0.5) * 0.6);
          x.globalAlpha = 0.45 + r() * 0.45;
          x.fillStyle = r() < 0.6 ? "#111111" : ["#c8102e", "#1e5aa8", "#f2f2f2"][Math.floor(r() * 3)];
          x.font = `${r() < 0.5 ? "italic " : ""}700 ${18 + Math.floor(r() * 46)}px 'Brush Script MT', 'Marker Felt', cursive`;
          x.fillText(words[Math.floor(r() * words.length)], 0, 0);
          x.restore();
        }
        x.globalAlpha = 1;
      } else if (kind === "stripes") {
        x.fillStyle = b;
        for (let i = 0; i < 3; i++) x.fillRect(0, h * 0.18 + i * h * 0.12, w, h * 0.06);
      } else if (kind === "brick") {
        const rows = 16,
          bh = h / rows,
          bw = w / 4;
        x.fillStyle = b;
        x.fillRect(0, 0, w, h);
        for (let j = 0; j < rows; j++)
          for (let i = -1; i < 5; i++) {
            x.fillStyle = rgb(A, 0.75 + r() * 0.4);
            x.fillRect(i * bw + (j % 2 ? bw / 2 : 0) + 2, j * bh + 2, bw - 4, bh - 4);
          }
      } else if (kind === "slats") {
        const n = 16,
          s = w / n;
        for (let i = 0; i < n; i++) {
          x.fillStyle = rgb(A, 0.85 + r() * 0.25);
          x.fillRect(i * s, 0, s - 4, h);
          x.fillStyle = "rgba(0,0,0,0.55)";
          x.fillRect(i * s + s - 4, 0, 4, h);
        }
      } else if (kind === "led") {
        x.fillStyle = "#050505";
        x.fillRect(0, 0, w, h);
        for (let i = 0; i < w; i += 8)
          for (let j = 0; j < h; j += 8) {
            x.fillStyle = `rgba(255,255,255,${0.04 + r() * 0.05})`;
            x.fillRect(i + 1, j + 1, 5, 5);
          }
      } else {
        speck(3000, 0.025, 2);
      }
    },
    512,
    512,
    [1, 1],
  );
}

/** a plane whose UVs tile a texture every tile metres (cached by size) */
const uvCache = new Map<string, THREE.BufferGeometry>();
export function tiledPlane(w: number, h: number, tileW: number, tileH = tileW) {
  const k = `${w}|${h}|${tileW}|${tileH}`;
  let g = uvCache.get(k);
  if (!g) {
    g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tileW, (uv.getY(i) * h) / tileH);
    uvCache.set(k, g);
  }
  return g;
}
const surfMats = new Map<string, THREE.MeshStandardMaterial>();
export function surfMat(kind: Surface, a: string, b = "#000000", o: { rough?: number; metal?: number; emissive?: number } = {}) {
  const k = kind + a + b + (o.rough ?? 0.8) + (o.metal ?? 0) + (o.emissive ?? 0);
  let m = surfMats.get(k);
  if (!m) {
    const t = surface(kind, a, b);
    m = new THREE.MeshStandardMaterial({ map: t, roughness: o.rough ?? 0.8, metalness: o.metal ?? 0 });
    if (o.emissive) {
      m.emissive = new THREE.Color("#ffffff");
      m.emissiveMap = t;
      m.emissiveIntensity = o.emissive;
    }
    surfMats.set(k, m);
  }
  return m;
}

/** a soft round pool of light for floors: one texture, additive */
function poolTex() {
  return cachedTexture(
    "pool",
    (x, w, h) => {
      const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.35, "rgba(255,255,255,0.45)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
    },
    128,
    128,
  );
}

/** many short texts on one texture (shelf labels, aisle signs, price cards): one material for all of them */
export function textAtlas(key: string, texts: string[], o: { fg?: string; bg?: string; cellW?: number; cellH?: number; font?: string } = {}) {
  const cw = o.cellW || 256,
    ch = o.cellH || 64;
  const cols = Math.max(1, Math.min(8, Math.ceil(Math.sqrt(texts.length * (ch / cw))) * 2));
  const rows = Math.max(1, Math.ceil(texts.length / cols));
  const W = cols * cw,
    H = rows * ch;
  const tex = cachedTexture(
    "atlas|" + key + "|" + texts.join("¦"),
    (x) => {
      texts.forEach((t, i) => {
        const cx = (i % cols) * cw,
          cy = Math.floor(i / cols) * ch;
        x.fillStyle = o.bg || "#ffffff";
        x.fillRect(cx, cy, cw, ch);
        x.fillStyle = o.fg || "#111111";
        let size = Math.round(ch * 0.46);
        const font = o.font || "700 {s}px Inter, 'Helvetica Neue', system-ui, sans-serif";
        x.font = font.replace("{s}", String(size));
        while (x.measureText(t).width > cw * 0.9 && size > 9) {
          size -= 2;
          x.font = font.replace("{s}", String(size));
        }
        x.textAlign = "center";
        x.textBaseline = "middle";
        x.fillText(t, cx + cw / 2, cy + ch / 2 + 1);
      });
    },
    W,
    H,
  );
  const uvOf = (i: number) => {
    const c = i % cols,
      r = Math.floor(i / cols);
    return [c / cols, 1 - (r + 1) / rows, (c + 1) / cols, 1 - r / rows] as [number, number, number, number];
  };
  return { tex, uvOf };
}

const v3 = new THREE.Vector3();
const q4 = new THREE.Quaternion();
const e3 = new THREE.Euler();
const s3 = new THREE.Vector3();
const m4 = new THREE.Matrix4();

interface Frame {
  ox: number;
  oz: number;
  q: number;
  parent: THREE.Object3D;
}
interface Bank {
  geo: THREE.BufferGeometry;
  m: THREE.Material;
  mats: THREE.Matrix4[];
  cols: THREE.Color[];
  ids: (string | null)[];
  dyn?: boolean;
}

/** the room builder: everything a room needs, in local coordinates that can be offset and turned */
export class Kit {
  g = new THREE.Group();
  statics = new THREE.Group();
  walls: Wall[] = [];
  ob: Ob[] = [];
  hs: Hotspot[] = [];
  own: { dispose: () => void }[] = [];
  ticks: ((t: number, dt: number) => void)[] = [];
  pools: { x: number; z: number; r: number; c: THREE.Color }[] = [];
  banks = new Map<string, Bank>();
  bankMeshes = new Map<string, THREE.InstancedMesh>();
  private stack: Frame[] = [];
  private f: Frame;
  /** density of repeated stock: fewer things on Low quality, never fewer frames */
  dense: number;
  rnd: () => number;
  constructor(
    public st: CareerState,
    public place: WorldPlace,
    public night: number,
    public quality: number,
  ) {
    this.g.add(this.statics);
    this.f = { ox: 0, oz: 0, q: 0, parent: this.statics };
    this.dense = quality <= 0 ? 0.55 : quality === 1 ? 0.8 : 1;
    this.rnd = seeded(place.id + "|" + (st.life.world?.seed ?? 0));
  }
  get cat() {
    return catalogOf(this.st);
  }
  // ---------- local to world ----------
  P(x: number, z: number): [number, number] {
    const a = (this.f.q * Math.PI) / 2,
      c = Math.round(Math.cos(a)),
      s = Math.round(Math.sin(a));
    return [this.f.ox + x * c + z * s, this.f.oz - x * s + z * c];
  }
  A(ry: number) {
    return ry + (this.f.q * Math.PI) / 2;
  }
  /** build something at an offset, turned by quarter turns */
  at(x: number, z: number, q: number, fn: () => void) {
    const sub = new THREE.Group();
    sub.position.set(x, 0, z);
    sub.rotation.y = (q * Math.PI) / 2;
    this.f.parent.add(sub);
    const [wx, wz] = this.P(x, z);
    this.stack.push(this.f);
    this.f = { ox: wx, oz: wz, q: (((this.f.q + q) % 4) + 4) % 4, parent: sub };
    try {
      fn();
    } finally {
      this.f = this.stack.pop()!;
    }
  }
  // ---------- things ----------
  add(
    geo: THREE.BufferGeometry,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    ry = 0,
    o: { rx?: number; rz?: number; s?: number | [number, number, number]; dyn?: boolean; to?: THREE.Object3D; shadow?: boolean } = {},
  ) {
    const me = new THREE.Mesh(geo, m);
    me.position.set(x, y, z);
    me.rotation.set(o.rx || 0, ry, o.rz || 0);
    if (o.s !== undefined) {
      if (typeof o.s === "number") me.scale.setScalar(o.s);
      else me.scale.set(o.s[0], o.s[1], o.s[2]);
    }
    me.castShadow = o.shadow !== false;
    me.receiveShadow = true;
    if (!o.dyn) me.userData.bake = true;
    (o.to || this.f.parent).add(me);
    return me;
  }
  /** a rounded box in a colour or material */
  box(w: number, h: number, d: number, m: THREE.Material | string, x: number, y: number, z: number, ry = 0, r = 0.02) {
    return this.add(rbox(w, h, d, r, r > 0.03 ? 2 : 1), typeof m === "string" ? mat(m) : m, x, y, z, ry);
  }
  /** a group whose meshes never move again (a parked car): placed like obj, merged into the room at the end */
  still(o: THREE.Object3D, x: number, y: number, z: number, ry = 0) {
    o.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) c.userData.bake = true;
    });
    return this.obj(o, x, y, z, ry);
  }
  /** any object (a car, a group) placed in local coordinates, not merged */
  obj(o: THREE.Object3D, x: number, y: number, z: number, ry = 0) {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    this.f.parent.add(o);
    return o;
  }
  // ---------- what he bumps into, and what he can use ----------
  block(x: number, z: number, hw: number, hd: number) {
    const [wx, wz] = this.P(x, z);
    const odd = this.f.q % 2 === 1;
    this.ob.push({ x: wx, z: wz, hw: odd ? hd : hw, hd: odd ? hw : hd });
  }
  circle(x: number, z: number, r: number) {
    const [wx, wz] = this.P(x, z);
    this.ob.push({ x: wx, z: wz, r });
  }
  spot(id: string, label: string, x: number, z: number, o: { r?: number; ax?: number; az?: number; y?: number; tag?: boolean } = {}) {
    const [wx, wz] = this.P(x, z);
    const [ax, az] = this.P(o.ax ?? x, o.az ?? z);
    const h: Hotspot = { id, label, x: wx, z: wz, r: o.r, ax, az, y: o.y ?? 1.2, tag: o.tag ?? !/^(item|grocery|car|menu|drive):/.test(id) };
    // one hotspot per id: a second copy of the same item only lights the first
    if (!this.hs.some((e) => e.id === id)) this.hs.push(h);
    return h;
  }
  // ---------- surfaces ----------
  floor(w: number, d: number, m: THREE.Material, x = 0, z = 0, tile = 4, y = 0) {
    const f = this.add(tiledPlane(w, d, tile), m, x, y, z, 0, { rx: -Math.PI / 2, shadow: false });
    f.name = "floor";
    return f;
  }
  /**
   * A wall from one point to another, h high. The side to its left (looking from the first point to the second)
   * is the room side. It returns the wall's own group: things hung on it (shelves, signs) go in there with
   * mount(), so they drop with the wall when the camera is behind it.
   */
  wall(x1: number, z1: number, x2: number, z2: number, h: number, m: THREE.Material, o: { inner?: boolean; thick?: number; face?: THREE.Material; tile?: number; solid?: boolean; low?: number } = {}) {
    const dx = x2 - x1,
      dz = z2 - z1,
      L = Math.hypot(dx, dz);
    const t = o.thick ?? 0.2;
    const grp = new THREE.Group();
    grp.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
    grp.rotation.y = Math.atan2(-dz, dx);
    grp.userData.wall = true;
    this.f.parent.add(grp);
    // local +z of the group is the room side
    const lo = o.low ?? 0;
    this.add(rbox(L, h - lo, t, 0.015, 1), m, 0, lo + (h - lo) / 2, 0, 0, { to: grp });
    if (o.face) this.add(tiledPlane(L, h - lo, o.tile ?? 3, o.tile ?? 3), o.face, 0, lo + (h - lo) / 2, t / 2 + 0.004, 0, { to: grp, shadow: false });
    const [c1x, c1z] = this.P(x1, z1);
    const [c2x, c2z] = this.P(x2, z2);
    const wdx = c2x - c1x,
      wdz = c2z - c1z;
    this.walls.push({ mesh: grp, nx: -wdz / L, nz: wdx / L, cx: (c1x + c2x) / 2, cz: (c1z + c2z) / 2, half: L / 2, inner: !!o.inner });
    if (o.solid !== false) {
      const ax = Math.abs(wdx) > Math.abs(wdz);
      this.ob.push({ x: (c1x + c2x) / 2, z: (c1z + c2z) / 2, hw: ax ? L / 2 : t / 2 + 0.02, hd: ax ? t / 2 + 0.02 : L / 2 });
    }
    return grp;
  }
  /** put something on a wall: u along it from its middle, y up, out from its face */
  mount(wallGrp: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, u: number, y: number, out: number, o: { rx?: number; ry?: number; s?: number | [number, number, number] } = {}) {
    return this.add(geo, m, u, y, out, o.ry || 0, { rx: o.rx, s: o.s, to: wallGrp });
  }
  /** the four walls of a w by d room centred here; skip names sides ("n", "s", "e", "w") left open */
  shell(w: number, d: number, h: number, m: THREE.Material, o: { face?: THREE.Material; tile?: number; skip?: string[]; faces?: Partial<Record<"n" | "s" | "e" | "w", THREE.Material>> } = {}) {
    const out: Partial<Record<"n" | "s" | "e" | "w", THREE.Object3D>> = {};
    const sk = o.skip || [];
    const face = (k: "n" | "s" | "e" | "w") => o.faces?.[k] ?? o.face;
    if (!sk.includes("n")) out.n = this.wall(-w / 2, -d / 2, w / 2, -d / 2, h, m, { face: face("n"), tile: o.tile, solid: false });
    if (!sk.includes("s")) out.s = this.wall(w / 2, d / 2, -w / 2, d / 2, h, m, { face: face("s"), tile: o.tile, solid: false });
    if (!sk.includes("w")) out.w = this.wall(-w / 2, d / 2, -w / 2, -d / 2, h, m, { face: face("w"), tile: o.tile, solid: false });
    if (!sk.includes("e")) out.e = this.wall(w / 2, -d / 2, w / 2, d / 2, h, m, { face: face("e"), tile: o.tile, solid: false });
    return out;
  }
  /** a painted sign (cached texture) */
  sign(tex: THREE.Texture, x: number, y: number, z: number, w: number, h: number, ry = 0, o: { to?: THREE.Object3D; strength?: number; transparent?: boolean } = {}) {
    const k = "signmat|" + tex.uuid + "|" + (o.strength ?? 1) + "|" + (o.transparent ? 1 : 0);
    let m = signMats.get(k);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: !!o.transparent, depthWrite: !o.transparent, color: new THREE.Color(1, 1, 1).multiplyScalar(o.strength ?? 1) });
      signMats.set(k, m);
    }
    return this.add(plane(w, h), m, x, y, z, ry, { to: o.to, shadow: false });
  }
  text(text: string, fg: string, bg: string, x: number, y: number, z: number, w: number, h: number, ry = 0, o: { font?: string; to?: THREE.Object3D; strength?: number } = {}) {
    const ph = Math.max(48, Math.min(256, Math.round((512 * h) / w)));
    const font = (o.font || "700 {s}px Inter, 'Helvetica Neue', system-ui, sans-serif").replace("{s}", String(Math.round(ph * 0.58)));
    const tex = signTexture(text, fg, bg, 512, ph, font);
    return this.sign(tex, x, y, z, w, h, ry, { to: o.to, strength: o.strength, transparent: bg === "transparent" });
  }
  /** a soft pool of light on the floor (instanced at the end) */
  pool(x: number, z: number, r: number, col: string, strength = 0.35) {
    const [wx, wz] = this.P(x, z);
    this.pools.push({ x: wx, z: wz, r, c: new THREE.Color(col).multiplyScalar(strength) });
  }
  /** a cone of light from a lamp down to the floor (additive, merged with the others of its colour) */
  beam(x: number, y: number, z: number, r: number, col: string, strength = 0.1) {
    this.add(cone(r, y), lightCone(col, strength), x, y / 2, z, 0, { shadow: false });
  }
  /** a lamp: a bright little bulb, a shade, its beam and a pool on the floor */
  spotLamp(x: number, y: number, z: number, col = "#ffe6c0", o: { shade?: string; beam?: number; pool?: number; r?: number; cord?: number } = {}) {
    this.add(cone(0.12, 0.16), mat(o.shade || "#141414", { rough: 0.4, metal: 0.6, side: THREE.DoubleSide }), x, y + 0.08, z, 0, { shadow: false });
    const cord = o.cord ?? 1.4;
    if (cord > 0) this.add(rbox(0.012, cord, 0.012, 0.002), mat("#111111"), x, y + 0.16 + cord / 2, z, 0, { shadow: false });
    this.add(rbox(0.1, 0.03, 0.1, 0.01), glow(col, 2.2), x, y - 0.01, z, 0, { shadow: false });
    if (o.beam !== 0) this.beam(x, y, z, o.r ?? 0.8, col, o.beam ?? 0.07);
    if (o.pool !== 0) this.pool(x, z, (o.r ?? 0.8) * 2.4, col, o.pool ?? 0.22);
  }
  // ---------- repeated things: instanced ----------
  /** one more copy of a shape: a world matrix, a colour and the hotspot it belongs to (if any) */
  inst(
    key: string,
    geo: () => THREE.BufferGeometry,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    o: { ry?: number; rx?: number; rz?: number; s?: number | [number, number, number]; col?: string | THREE.Color; id?: string; dyn?: boolean } = {},
  ) {
    let b = this.banks.get(key);
    if (!b) {
      b = { geo: geo(), m, mats: [], cols: [], ids: [], dyn: o.dyn };
      this.banks.set(key, b);
    }
    const [wx, wz] = this.P(x, z);
    e3.set(o.rx || 0, o.ry || 0, o.rz || 0, "YXZ");
    q4.setFromEuler(e3);
    q4.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (this.f.q * Math.PI) / 2));
    if (o.s === undefined) s3.set(1, 1, 1);
    else if (typeof o.s === "number") s3.setScalar(o.s);
    else s3.set(o.s[0], o.s[1], o.s[2]);
    b.mats.push(new THREE.Matrix4().compose(v3.set(wx, y, wz), q4, s3));
    b.cols.push(o.col instanceof THREE.Color ? o.col.clone() : new THREE.Color(o.col || "#ffffff"));
    b.ids.push(o.id || null);
    return b.mats.length - 1;
  }
  // ---------- the end: merge, instance, hand over ----------
  finish(r: Omit<Room, "group" | "walls" | "obstacles" | "hotspots" | "dispose" | "tick"> & { tick?: Room["tick"]; apron?: string | null }): Room {
    // the ground outside the room, so the view past a dropped wall is not a void
    if (r.apron !== null) {
      const ap = this.add(plane(1, 1), mat(r.apron || "#1c1e22", { rough: 1 }), 0, -0.02, 0, 0, { rx: -Math.PI / 2, s: [r.w * 3 + 40, r.d * 3 + 40, 1], shadow: false, dyn: true });
      ap.raycast = () => {};
    }
    this.g.updateMatrixWorld(true);
    bakeInto(this.statics, this.own);
    for (const wl of this.walls) bakeInto(wl.mesh, this.own);
    // the instanced banks
    for (const [key, b] of this.banks) {
      const im = new THREE.InstancedMesh(b.geo, b.m, b.mats.length);
      b.mats.forEach((mm, i) => {
        im.setMatrixAt(i, mm);
        im.setColorAt(i, b.cols[i]);
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = true;
      im.receiveShadow = true;
      im.userData.hsIds = b.ids;
      im.userData.cols = b.cols;
      im.computeBoundingSphere();
      this.g.add(im);
      this.own.push(b.geo);
      this.bankMeshes.set(key, im);
      b.ids.forEach((id, i) => {
        if (!id) return;
        const h = this.hs.find((x) => x.id === id);
        if (h && !h.inst) h.inst = { mesh: im, i };
      });
    }
    if (this.pools.length) {
      const pm = new THREE.MeshBasicMaterial({ map: poolTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
      const pg = plane(1, 1);
      const im = new THREE.InstancedMesh(pg, pm, this.pools.length);
      const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
      this.pools.forEach((p, i) => {
        im.setMatrixAt(i, m4.compose(v3.set(p.x, 0.018, p.z), rot, s3.set(p.r, p.r, 1)));
        im.setColorAt(i, p.c);
      });
      im.renderOrder = 2;
      im.computeBoundingSphere();
      this.g.add(im);
      this.own.push(pm);
    }
    const ticks = this.ticks;
    const own = this.own;
    return {
      ...r,
      group: this.g,
      walls: this.walls,
      obstacles: this.ob,
      hotspots: this.hs,
      tick: r.tick || (ticks.length ? (t, dt) => ticks.forEach((f) => f(t, dt)) : undefined),
      dispose: () => own.forEach((o) => o.dispose()),
    };
  }
}
const signMats = new Map<string, THREE.MeshBasicMaterial>();

/** merge every static mesh under root that shares a material into one mesh (walls are baked on their own) */
function bakeInto(root: THREE.Object3D, own: { dispose: () => void }[]) {
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<string, { m: THREE.Material; geos: THREE.BufferGeometry[]; cast: boolean }>();
  const kill: THREE.Mesh[] = [];
  const walk = (o: THREE.Object3D) => {
    for (const c of o.children) {
      if (c.userData.wall && c !== root) continue;
      const me = c as THREE.Mesh;
      if (me.isMesh && !(me as THREE.InstancedMesh).isInstancedMesh && me.userData.bake && !Array.isArray(me.material)) {
        const m = me.material as THREE.Material;
        const geo = me.geometry;
        const key = m.uuid + "|" + (geo.index ? "i" : "n") + "|" + Object.keys(geo.attributes).sort().join(",");
        const gg = geo.clone();
        gg.applyMatrix4(m4.multiplyMatrices(inv, me.matrixWorld));
        gg.clearGroups();
        let b = buckets.get(key);
        if (!b) {
          b = { m, geos: [], cast: false };
          buckets.set(key, b);
        }
        b.geos.push(gg);
        b.cast = b.cast || me.castShadow;
        kill.push(me);
      }
      walk(c);
    }
  };
  walk(root);
  for (const me of kill) me.parent?.remove(me);
  for (const b of buckets.values()) {
    const merged = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false);
    if (b.geos.length > 1) b.geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, b.m);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = true;
    root.add(mesh);
    own.push(merged);
  }
}

/** a material for instanced goods: vertex shading times the instance colour */
const goodsMats = new Map<string, THREE.MeshStandardMaterial>();
export function goodsMat(kind: "cloth" | "leather" | "metal" | "gloss" | "plastic" | "glow" = "cloth") {
  let m = goodsMats.get(kind);
  if (!m) {
    const o: Record<string, [number, number]> = { cloth: [0.88, 0], leather: [0.42, 0.05], metal: [0.22, 1], gloss: [0.18, 0.1], plastic: [0.5, 0], glow: [0.6, 0] };
    const [rough, metal] = o[kind];
    m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: metal });
    if (kind === "glow") {
      m.emissive = new THREE.Color("#ffffff");
      m.emissiveIntensity = 0.35;
    }
    goodsMats.set(kind, m);
  }
  return m;
}

/** a typical light set for a shop: the room tells Interior which lights to switch on */
export function shopLight(o: Partial<RoomLight> & { warm?: boolean } = {}): RoomLight {
  return {
    sky: o.sky || (o.warm ? "#ffe8cc" : "#eef3ff"),
    ground: o.ground || "#2a2622",
    hemi: o.hemi ?? 0.75,
    key: o.key || (o.warm ? "#ffe2bc" : "#f4f7ff"),
    keyI: o.keyI ?? 1.0,
    points: o.points || [],
    bg: o.bg || "#0b0c0e",
    fog: o.fog,
  };
}

/** a plain shape made ready for the goods materials (which multiply a per vertex shade): every shade 1 */
export function shaded(g: THREE.BufferGeometry, shade = 1) {
  g.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(shade), 3));
  return g;
}
/** a little person (staff, diners, the crowd): instanced capsules with heads */
export function people(k: Kit, key: string, spots: { x: number; z: number; ry?: number; col: string; sit?: boolean; skin?: string }[]) {
  const skins = ["#8a5a3c", "#c68e6a", "#e0b08a", "#5a3a28", "#a8724c"];
  spots.forEach((p, i) => {
    const h = p.sit ? 0.45 : 0.9;
    k.inst(key + (p.sit ? "sit" : "body"), () => shaded(new THREE.CapsuleGeometry(0.19, p.sit ? 0.3 : 0.62, 4, 10)), goodsMat("cloth"), p.x, h, p.z, { ry: p.ry, col: p.col });
    k.inst(key + "head", () => shaded(new THREE.SphereGeometry(0.13, 12, 9)), goodsMat("cloth"), p.x, h + (p.sit ? 0.42 : 0.62), p.z, { col: p.skin || skins[i % skins.length] });
  });
}

/** plants in pots, merged */
export function plant(k: Kit, x: number, z: number, s = 1, pot = "#d8d2c4", leaf = "#2f5a2e") {
  k.add(rbox(0.42 * s, 0.46 * s, 0.42 * s, 0.06), mat(pot, { rough: 0.6 }), x, 0.23 * s, z);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    k.add(cone(0.09 * s, 0.9 * s), mat(leaf, { rough: 0.85, side: THREE.DoubleSide }), x + Math.cos(a) * 0.09 * s, 0.86 * s, z + Math.sin(a) * 0.09 * s, a, {
      rx: Math.cos(a) * 0.25,
      rz: -Math.sin(a) * 0.25,
    });
  }
  k.circle(x, z, 0.32 * s);
}

export { glow, mat };

/**
 * The view out of a big window: a dusk sky, the sun low, the city's towers with lit windows, and the sea in
 * front of them when there is one. One wide texture, cached per city and light.
 */
export function viewTex(kind: "city" | "sea" | "hills", sky: [string, string], night: number, seed: string) {
  return cachedTexture(
    "view|" + kind + "|" + sky.join() + "|" + night.toFixed(1) + "|" + seed,
    (x, w, h) => {
      const r = seeded(seed + kind);
      const top = new THREE.Color(sky[0]).lerp(new THREE.Color("#03050a"), night * 0.7);
      const low = new THREE.Color(sky[1]).lerp(new THREE.Color("#2a1e30"), night * 0.6);
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, top.getStyle());
      g.addColorStop(0.62, low.getStyle());
      g.addColorStop(1, low.clone().multiplyScalar(0.7).getStyle());
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
      // the sun going down
      const sx = w * 0.62,
        sy = h * (kind === "sea" ? 0.6 : 0.56);
      const sg = x.createRadialGradient(sx, sy, 0, sx, sy, h * 0.5);
      sg.addColorStop(0, `rgba(255,214,150,${0.95 - night * 0.6})`);
      sg.addColorStop(0.12, `rgba(255,170,100,${0.55 - night * 0.3})`);
      sg.addColorStop(1, "rgba(255,120,80,0)");
      x.fillStyle = sg;
      x.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        x.fillStyle = `rgba(255,255,255,${(0.2 + r() * 0.5) * night})`;
        x.fillRect(r() * w, r() * h * 0.4, 2, 2);
      }
      const horizon = kind === "sea" ? h * 0.64 : h;
      // towers: a far row, then a nearer, darker one
      for (const [n, hmax, shade, lit] of [
        [70, 0.22, 0.55, 0.25],
        [46, 0.4, 0.3, 0.45],
      ] as [number, number, number, number][]) {
        for (let k = 0; k < n; k++) {
          const bw = 14 + r() * 46,
            bh = h * (0.05 + r() * hmax) * (kind === "hills" ? 0.5 : 1);
          const bx = r() * w,
            by = horizon - bh;
          const c = low.clone().lerp(new THREE.Color("#0a0c14"), 1 - shade * 0.5);
          x.fillStyle = c.getStyle();
          x.fillRect(bx, by, bw, bh);
          for (let wy = by + 5; wy < horizon - 3; wy += 7)
            for (let wx = bx + 3; wx < bx + bw - 3; wx += 6)
              if (r() < lit * (0.4 + night)) {
                x.fillStyle = r() < 0.7 ? "rgba(255,214,150,0.9)" : "rgba(200,225,255,0.85)";
                x.fillRect(wx, wy, 2.5, 3);
              }
        }
      }
      if (kind === "sea") {
        const sea = x.createLinearGradient(0, horizon, 0, h);
        sea.addColorStop(0, low.clone().lerp(new THREE.Color("#1a3a5a"), 0.6).getStyle());
        sea.addColorStop(1, "#06121e");
        x.fillStyle = sea;
        x.fillRect(0, horizon, w, h - horizon);
        // the sun's path on the water
        for (let i = 0; i < 120; i++) {
          const yy = horizon + Math.pow(r(), 1.6) * (h - horizon);
          const ww = 10 + r() * 60 * (1 + (yy - horizon) / (h - horizon));
          x.fillStyle = `rgba(255,200,130,${(0.5 - night * 0.3) * (1 - (yy - horizon) / (h - horizon))})`;
          x.fillRect(sx - ww / 2 + (r() - 0.5) * 40, yy, ww, 2);
        }
        for (let i = 0; i < 6; i++) {
          x.fillStyle = "rgba(255,230,180,0.9)";
          x.fillRect(r() * w, horizon + 4 + r() * 30, 3, 2);
        }
      }
      if (kind === "hills") {
        x.fillStyle = "#1a2a22";
        x.beginPath();
        x.moveTo(0, h);
        for (let i = 0; i <= 20; i++) x.lineTo((i / 20) * w, h * (0.62 + Math.sin(i * 1.3) * 0.06 + r() * 0.05));
        x.lineTo(w, h);
        x.fill();
      }
    },
    2048,
    512,
  );
}

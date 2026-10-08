// The players' bodies: one skinned mesh per player on a 26 bone skeleton, built procedurally so every player
// has his own height, build, skin tone, hair, beard and boots, and wears his club's kit with his own number and
// name on the back. One draw call per player (plus its shadow).
// Character space: +Y up, +Z forward, +X the player's left. The view turns it to face the sim's direction.

import { heroHead, heroHair } from "./hero.mjs";

// bone layout: name, parent, rest offset from the parent as fractions of height
export const BONES = [
  ["hips", -1, [0, 0.53, 0]],
  ["spine1", 0, [0, 0.055, 0]],
  ["spine2", 1, [0, 0.075, 0]],
  ["chest", 2, [0, 0.08, 0]],
  ["neck", 3, [0, 0.105, 0]],
  ["head", 4, [0, 0.05, 0]],
  ["clavL", 3, [0.02, 0.075, 0]],
  ["armL", 6, [0.092, -0.005, 0]],
  ["foreL", 7, [0, -0.18, 0]],
  ["handL", 8, [0, -0.15, 0]],
  ["clavR", 3, [-0.02, 0.075, 0]],
  ["armR", 10, [-0.092, -0.005, 0]],
  ["foreR", 11, [0, -0.18, 0]],
  ["handR", 12, [0, -0.15, 0]],
  ["thighL", 0, [0.056, -0.028, 0]],
  ["shinL", 14, [0, -0.238, 0]],
  ["footL", 15, [0, -0.222, 0]],
  ["toeL", 16, [0, -0.032, 0.112]],
  ["thighR", 0, [-0.056, -0.028, 0]],
  ["shinR", 18, [0, -0.238, 0]],
  ["footR", 19, [0, -0.222, 0]],
  ["toeR", 20, [0, -0.032, 0.112]],
  ["hem", 0, [0, 0.0, 0]], // the shirt's loose lower edge, a spring
  ["hair", 5, [0, 0.03, -0.045]], // long hair and ponytails, a spring
  ["jaw", 5, [0, -0.02, 0.02]],
  ["brow", 5, [0, 0.03, 0.05]]
];
export const B = Object.fromEntries(BONES.map((b, i) => [b[0], i]));

export const SKIN = ["#f1d2b8", "#e2b48f", "#c98f66", "#a86f49", "#8a5636", "#6b3f26", "#4f2d1c", "#3a2116"];
// the first seven are natural colours (the match picks from these); the rest are for the career creator
export const HAIR_COL = ["#151110", "#2a1d15", "#4a3222", "#6e4a2c", "#a87a46", "#d2b07a", "#8b8b8b", "#e9e1c8", "#a4512c", "#5a1f1a", "#c9cbd3", "#2f4fa8", "#d9d9d9"];
// boots: the first six are the match's colourways; the rest are the career's boot brands
export const BOOTS = [["#111111", "#f3f3f3"], ["#f4f4f4", "#111111"], ["#ff5a1f", "#1b1b1b"], ["#d6f53a", "#151515"], ["#1f5cff", "#ffffff"], ["#e01f3d", "#f1f1f1"],
  ["#d0e85c", "#0c0f12"], ["#0b0b0c", "#ff6a2a"], ["#f2f2f2", "#d4af37"], ["#7d3cff", "#f4f4f4"], ["#00b39b", "#101418"], ["#ff2e7a", "#1a1a1a"], ["#c0c4cc", "#1c1f24"], ["#ffd23f", "#1a1a1a"]];
export const EYE_COL = ["#3b2416", "#24170f", "#6b4a2b", "#4d6b3a", "#3f6f9f", "#6f7c86"];
// accessory finishes: gold, silver, black, rose gold, white, a coloured band
export const ACC_COL = { gold: "#d4af37", silver: "#c8ccd2", black: "#141414", rose: "#d8a38f", white: "#f2f2f2", steel: "#9aa3ad", volt: "#d0e85c", red: "#d0263b", blue: "#2a5bd7", navy: "#1c2a4a", orange: "#ff7a2a", pink: "#ff5fa2", green: "#2fbf71" };
// what each part of the body is made of, for close up scenes that give each its own material
export const MAT = { cloth: 0, skin: 1, hair: 2, boot: 3, eye: 4, metal: 5, face: 6 };
const GK_KITS = [["#2bd673", "#0b3d22"], ["#ff8a1f", "#3a1600"], ["#8a4dff", "#1d0c3d"], ["#f2e600", "#2a2600"], ["#1fd4e0", "#06353a"]];

function hexToRgb(h) { const n = parseInt(String(h).replace("#", ""), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
// a colour that remembers what it is made of (only read by close up scenes)
function tag(c, m) { c.tag = m; return c; }
// skin from the palette by index (the match) or blended smoothly from a 0 to 1 slider (the creator)
function skinAt(look) {
  if (look.skinF === undefined) return hexToRgb(SKIN[look.skin % SKIN.length]);
  const f = Math.max(0, Math.min(1, look.skinF)) * (SKIN.length - 1), i = Math.min(SKIN.length - 2, Math.floor(f));
  return mixc(hexToRgb(SKIN[i]), hexToRgb(SKIN[i + 1]), f - i);
}
// a 0 to 1 slider read as a multiplier that is exactly 1 when the slider is missing or centred
const knob = (v, lo, hi) => (v === undefined || v === null ? 1 : lo + (hi - lo) * Math.max(0, Math.min(1, v)));
function lum(c) { return c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114; }
function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

// the keeper wears a colour away from both outfield kits
export function keeperKit(kits) {
  const outs = kits.map(k => hexToRgb(k[0]));
  let best = GK_KITS[0], bs = -1;
  for (const g of GK_KITS) {
    const c = hexToRgb(g[0]);
    const d = Math.min(...outs.map(o => Math.hypot(o[0] - c[0], o[1] - c[1], o[2] - c[2])));
    if (d > bs) { bs = d; best = g; }
  }
  return best;
}

// ---------- geometry builder ----------
class Builder {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.uv = []; this.si = []; this.sw = []; this.idx = []; this.mat = []; this.n = 0; }
  vert(x, y, z, c, b0, b1, w1, u, v) {
    this.pos.push(x, y, z); this.nor.push(0, 0, 0); this.col.push(c[0], c[1], c[2]); this.mat.push(c.tag || 0);
    this.uv.push(u === undefined ? 0.001 : u, v === undefined ? 0.001 : v);
    this.si.push(b0, b1 === undefined ? b0 : b1, 0, 0); this.sw.push(1 - (w1 || 0), w1 || 0, 0, 0);
    return this.n++;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  // make every triangle added since index i0 face away from a centre (cx, cy, cz), or along a direction when
  // dir is given: the builder never trusts its own winding
  orient(i0, cx, cy, cz, dir) {
    const P = this.pos, I = this.idx;
    for (let k = i0; k < I.length; k += 3) {
      const a = I[k] * 3, b = I[k + 1] * 3, c = I[k + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      let ox, oy, oz;
      if (dir) { ox = dir[0]; oy = dir[1]; oz = dir[2]; }
      else { ox = (P[a] + P[b] + P[c]) / 3 - cx; oy = (P[a + 1] + P[b + 1] + P[c + 1]) / 3 - cy; oz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3 - cz; }
      if (nx * ox + ny * oy + nz * oz < 0) { const t = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t; }
    }
  }
  // a tube of elliptical rings; ring: { y, w, d, cx, cz, col, b0, b1, w1, uvFn }. axis "y" (vertical) or "z" (forward)
  tube(rings, seg, axis, capStart, capEnd) {
    // close ups: smooth curves through the rings (Catmull-Rom on positions and sizes), so limbs and the torso are
    // round instead of faceted. Bones, colours and texture coordinates come from the nearer original ring.
    if (this.sub > 1 && rings.length > 2) rings = smoothRings(rings, this.sub, axis);
    const base = this.n;
    const i0 = this.idx.length;
    for (const r of rings) {
      for (let i = 0; i < seg; i++) {
        const a = i / seg * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        let x, y, z;
        if (axis === "z") { x = r.cx + r.w * ca; y = r.cy + r.d * sa; z = r.z; }
        else { x = r.cx + r.w * ca; y = r.y; z = r.cz + r.d * sa; }
        const c = typeof r.col === "function" ? r.col(x, y, z, a) : r.col;
        const uv = r.uv ? r.uv(x, y, z, a) : null;
        const bw = r.bf ? r.bf(x, y, z, a) : null;
        if (bw) this.vert(x, y, z, c, bw[0], bw[1], bw[2], uv ? uv[0] : undefined, uv ? uv[1] : undefined);
        else this.vert(x, y, z, c, r.b0, r.b1, r.w1, uv ? uv[0] : undefined, uv ? uv[1] : undefined);
      }
    }
    for (let k = 0; k < rings.length - 1; k++) {
      const s0 = this.idx.length;
      for (let i = 0; i < seg; i++) {
        const a = base + k * seg + i, b = base + k * seg + (i + 1) % seg, c = a + seg, d = b + seg;
        this.tri(a, b, c); this.tri(b, d, c);
      }
      // outward from the centre line of this band
      const r0 = rings[k], r1 = rings[k + 1];
      if (axis === "z") this.orientBand(s0, (r0.cx + r1.cx) / 2, (r0.cy + r1.cy) / 2, null, "z");
      else this.orientBand(s0, (r0.cx + r1.cx) / 2, null, ((r0.cz || 0) + (r1.cz || 0)) / 2, "y");
    }
    const cap = (k, flip) => {
      const r = rings[k];
      const c0 = this.idx.length;
      const ctr = axis === "z" ? this.vert(r.cx, r.cy, r.z, typeof r.col === "function" ? r.col(r.cx, r.cy, r.z, 0) : r.col, r.b0, r.b1, r.w1) : this.vert(r.cx, r.y, r.cz, typeof r.col === "function" ? r.col(r.cx, r.y, r.cz, 0) : r.col, r.b0, r.b1, r.w1);
      for (let i = 0; i < seg; i++) {
        const a = base + k * seg + i, b = base + k * seg + (i + 1) % seg;
        this.tri(ctr, b, a);
      }
      // a cap faces away from the rest of the tube
      const o = rings[k === 0 ? 1 : rings.length - 2];
      const d = axis === "z" ? [0, 0, r.z - o.z] : [0, r.y - o.y, 0];
      this.orient(c0, 0, 0, 0, d);
    };
    if (capStart) cap(0, axis === "z");
    if (capEnd) cap(rings.length - 1, axis !== "z");
  }
  orientBand(i0, cx, cy, cz, axis) {
    const P = this.pos, I = this.idx;
    for (let k = i0; k < I.length; k += 3) {
      const a = I[k] * 3, b = I[k + 1] * 3, c = I[k + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const mx = (P[a] + P[b] + P[c]) / 3, my = (P[a + 1] + P[b + 1] + P[c + 1]) / 3, mz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3;
      const ox = mx - cx, oy = axis === "z" ? my - cy : 0, oz = axis === "y" ? mz - cz : 0;
      if (nx * ox + ny * oy + nz * oz < 0) { const t = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t; }
    }
  }
  // an ellipsoid (for the head, hands, hair caps)
  blob(cx, cy, cz, rx, ry, rz, col, b0, latN, lonN, yMin, shapeFn) {
    const base = this.n;
    const i0 = this.idx.length;
    const lat0 = yMin === undefined ? 0 : yMin;
    for (let i = 0; i <= latN; i++) {
      const t = lat0 + (1 - lat0) * i / latN;
      const phi = t * Math.PI; // 0 top, pi bottom
      for (let j = 0; j < lonN; j++) {
        const th = j / lonN * Math.PI * 2;
        let x = Math.sin(phi) * Math.cos(th), y = Math.cos(phi), z = Math.sin(phi) * Math.sin(th);
        let sx = rx, sy = ry, sz = rz;
        if (shapeFn) { const s = shapeFn(x, y, z); sx *= s[0]; sy *= s[1]; sz *= s[2]; }
        const c = typeof col === "function" ? col(x, y, z) : col;
        if (this.blend) this.vert(cx + x * sx, cy + y * sy, cz + z * sz, c, b0, this.blend[0], this.blend[1]);
        else this.vert(cx + x * sx, cy + y * sy, cz + z * sz, c, b0, b0, 0);
      }
    }
    for (let i = 0; i < latN; i++) for (let j = 0; j < lonN; j++) {
      const a = base + i * lonN + j, b = base + i * lonN + (j + 1) % lonN, c = a + lonN, d = b + lonN;
      this.tri(a, c, b); this.tri(b, c, d);
    }
    this.orient(i0, cx, cy, cz, null);
  }
  geometry(THREE, grouped) {
    // close up scenes: triangles sorted by material, one group each (skin, cloth, hair, boots, eyes, metal)
    if (grouped) {
      const tris = [];
      for (let k = 0; k < this.idx.length; k += 3) tris.push(k);
      const m = k => this.mat[this.idx[k]];
      tris.sort((a, b) => m(a) - m(b));
      const idx = [];
      for (const k of tris) idx.push(this.idx[k], this.idx[k + 1], this.idx[k + 2]);
      this.groups = [];
      let start = 0;
      for (let i = 0; i <= tris.length; i++) {
        if (i === tris.length || (i > 0 && m(tris[i]) !== m(tris[i - 1]))) { this.groups.push({ start: start * 3, count: (i - start) * 3, mat: m(tris[start]) }); start = i; }
      }
      this.idx = idx;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.idx);
    if (grouped) for (const gr of this.groups) g.addGroup(gr.start, gr.count, gr.mat);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

function smoothRings(rings, sub, axis) {
  const keys = axis === "z" ? ["z", "w", "d", "cx", "cy"] : ["y", "w", "d", "cx", "cz"];
  const cr = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  const out = [];
  for (let k = 0; k < rings.length - 1; k++) {
    const r0 = rings[Math.max(0, k - 1)], r1 = rings[k], r2 = rings[k + 1], r3 = rings[Math.min(rings.length - 1, k + 2)];
    for (let i = 0; i < sub; i++) {
      const t = i / sub;
      if (i === 0) { out.push(r1); continue; }
      const r = Object.assign({}, t < 0.5 ? r1 : r2);
      for (const key of keys) { const a = r0[key] || 0, b = r1[key] || 0, c = r2[key] || 0, d = r3[key] || 0; r[key] = cr(a, b, c, d, t); }
      out.push(r);
    }
  }
  out.push(rings[rings.length - 1]);
  return out;
}

// ---------- one player's body ----------
// look: { h, mass, skin, hair, hairCol, beard, boot, sleeve, sock, kit: [shirt, trim], shorts, socks, gk, cell }
// The career creator adds more, all optional (0 to 1 sliders unless noted; missing means the match's standard
// look, so match players are built exactly as before): skinF, faceW, jaw, chin, cheeks, eyes, eyeCol (index),
// brows, nose, mouth, ears, hairline, moustache (0 or 1), muscle, shoulders, legs, and accessories as finish
// names from ACC_COL: watch, bracelet, necklace, earrings, headband, gloves, compression (sleeves and tights).
// The career's other people add, also optional and never set for a match player: fem (a woman's figure: narrower
// shoulders and waist, wider hips, a softer face), bottom ("shorts" as now, "trousers", "skirt", "dress" in the
// top's colour, "gown" to the floor), top ("vest" for bare arms; sleeve still makes long sleeves), plain (no kit
// side panels), shoe ([upper, sole] colours in place of the boots), tights (a colour for bare legs), and hair
// styles 16 to 21 (long, ponytail, bob, long curls, a plait, a top knot).
// opts: { detail: 1 for the match, 2 for close ups; groups: true splits the mesh by material }
export const FEM_LOOK = { jaw: 0.22, chin: 0.3, brows: 0.3, nose: 0.3, cheeks: 0.62 };
// a woman's figure: width and depth of the torso by height (hips out, waist in, a narrower ribcage and neck)
const FEM_W = [[0.4, 1.1], [0.5, 1.1], [0.55, 0.97], [0.6, 0.86], [0.645, 0.87], [0.69, 0.92], [0.77, 0.92], [0.833, 0.86]];
const FEM_D = [[0.4, 1.07], [0.5, 1.04], [0.6, 0.92], [0.69, 0.98], [0.75, 1.0], [0.795, 0.93], [0.833, 0.88]];
// and a gentle fullness at the front of the chest, as a forward shift of the ring
const FEM_Z = [[0.66, 0], [0.7, 0.007], [0.735, 0.012], [0.77, 0.008], [0.8, 0]];
function tab(T, y) {
  if (y <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++) if (y <= T[i][0]) { const a = T[i - 1], b = T[i]; return a[1] + (b[1] - a[1]) * (y - a[0]) / (b[0] - a[0]); }
  return T[T.length - 1][1];
}
export function buildBody(THREE, look, opts) {
  if (look.fem) look = Object.assign({}, FEM_LOOK, look);
  const fem = !!look.fem;
  const bottom = look.bottom || "shorts";
  const trousers = bottom === "trousers";
  // where a skirt, a dress or a gown ends, as a fraction of height (0 for shorts and trousers)
  const skirtHem = bottom === "skirt" ? 0.34 : bottom === "dress" ? 0.3 : bottom === "gown" ? 0.012 : 0;
  const vest = look.top === "vest";
  const det = (opts && opts.detail) || 1;
  const seg = n => (det === 1 ? n : Math.max(3, Math.round(n * det)));
  const h = look.h;
  const bulk = Math.max(0.9, Math.min(1.14, Math.sqrt(look.mass / (22.6 * h * h)))); // build relative to a 22.6 BMI
  const S = v => v * h;
  const W = v => v * h * bulk;
  const musc = fem ? knob(look.muscle, 0.93, 1.09) * 0.86 : knob(look.muscle, 0.93, 1.09), shoulder = fem ? knob(look.shoulders, 0.93, 1.08) * 0.9 : knob(look.shoulders, 0.93, 1.08), legK = knob(look.legs, 0.93, 1.08);
  const acc = name => tag(hexToRgb(ACC_COL[name] || ACC_COL.black), name === "black" || name === "white" || name === "navy" || name === "volt" || name === "red" || name === "blue" || name === "orange" || name === "pink" || name === "green" ? MAT.cloth : MAT.metal);
  const skin = tag(skinAt(look), MAT.skin);
  const skinD = tag(mixc(skin, [0, 0, 0], 0.18), MAT.skin);
  const shirt = hexToRgb(look.kit[0]), trim = hexToRgb(look.kit[1]);
  const shorts = hexToRgb(look.shorts), socks = hexToRgb(look.socks);
  const boots = look.shoe || BOOTS[look.boot % BOOTS.length], bootC = tag(hexToRgb(boots[0]), MAT.boot), bootS = tag(hexToRgb(boots[1]), MAT.boot);
  const hairC = tag(hexToRgb(HAIR_COL[look.hairCol % HAIR_COL.length]), MAT.hair);
  const glove = look.gk ? hexToRgb(look.kit[1]) : look.gloves ? tag(hexToRgb(ACC_COL[look.gloves] || ACC_COL.black), MAT.cloth) : skin;
  const comp = look.compression ? tag(hexToRgb(ACC_COL[look.compression] || ACC_COL.black), MAT.cloth) : null;
  const armSkin = comp || skin, legSkin = comp || (look.tights ? tag(hexToRgb(look.tights), MAT.cloth) : skin);
  // below the waist: shorts (or the skirt) in the shorts colour, a dress and a gown in the top's
  const lowC = bottom === "dress" || bottom === "gown" ? shirt : shorts;
  const bd = new Builder();
  if (det > 1) bd.sub = 3;
  const cell = look.cell; // [u0, v0, u1, v1] on the team's number sheet, or null
  // ---------- torso (shorts below, shirt above), skinned up the spine ----------
  // broader shoulders and more muscle widen the upper chest only; both are exactly 1 for match players
  const chestK = y => 1 + (shoulder - 1) * Math.max(0, Math.min(1, (y - 0.66) / 0.13)) + (musc - 1) * 0.6 * (y >= 0.69 ? 1 : 0);
  const torsoRing = fem
    ? (y, w, d, col, b0, b1, w1, cz) => ({ y: S(y), w: W(w) * chestK(y) * tab(FEM_W, y), d: W(d) * (1 + (musc - 1) * 0.5 * (y >= 0.69 ? 1 : 0)) * tab(FEM_D, y), cx: 0, cz: S((cz || 0) + tab(FEM_Z, y)), col, b0, b1, w1 })
    : (y, w, d, col, b0, b1, w1, cz) => ({ y: S(y), w: W(w) * chestK(y), d: W(d) * (1 + (musc - 1) * 0.5 * (y >= 0.69 ? 1 : 0)), cx: 0, cz: S(cz || 0), col, b0, b1, w1 });
  // the back panel carries the name and number; the chest a small number
  const panel = (x, y, z) => {
    if (!cell) return null;
    const yy = y / h;
    if (z < 0 && yy > 0.6 && yy < 0.8 && Math.abs(x) < W(0.085)) {
      // seen from behind, the body's left (+X) is on the viewer's left: the sheet reads left to right
      const u = 0.5 - x / W(0.17), v = (yy - 0.6) / 0.2;
      return [cell[0] + (cell[2] - cell[0]) * u, cell[1] + (cell[3] - cell[1]) * v];
    }
    if (z > 0 && yy > 0.715 && yy < 0.775 && x < -W(0.02) && x > -W(0.075)) {
      // a small number over the right of the chest: the lower part of the cell (the digits)
      // seen from the front the body's right (minus X) is on the viewer's left
      const u = (x + W(0.075)) / W(0.055), v = (yy - 0.715) / 0.06;
      return [cell[0] + (cell[2] - cell[0]) * u, cell[1] + (cell[3] - cell[1]) * (0.02 + v * 0.62)];
    }
    return null;
  };
  const shirtCol = (x, y, z) => {
    // a trim at the collar and a side panel
    const yy = y / h;
    if (yy > 0.805) return trim;
    if (look.plain) return shirt;
    if (Math.abs(x) > W(0.095) && yy < 0.75 && yy > 0.56) return mixc(shirt, trim, 0.35);
    return shirt;
  };
  // the torso: athletic V shape (broad chest and shoulders, narrow waist), glutes inside the shorts
  const rings = [
    torsoRing(0.44, 0.1, 0.07, lowC, B.hips, B.hips, 0, -0.004),
    torsoRing(0.47, 0.106, 0.078, lowC, B.hips, B.hips, 0, -0.008),
    torsoRing(0.5, 0.108, 0.075, lowC, B.hips, B.hips, 0, -0.004),
    Object.assign(torsoRing(0.51, 0.111, 0.077, shirtCol, B.hem, B.hips, 0.2), { uv: panel }),
    Object.assign(torsoRing(0.55, 0.104, 0.07, shirtCol, B.hips, B.spine1, 0.5), { uv: panel }),
    Object.assign(torsoRing(0.6, 0.097, 0.066, shirtCol, B.spine1, B.spine1, 0), { uv: panel }),
    Object.assign(torsoRing(0.645, 0.1, 0.067, shirtCol, B.spine1, B.spine2, 0.5), { uv: panel }),
    Object.assign(torsoRing(0.69, 0.108, 0.071, shirtCol, B.spine2, B.chest, 0.4, 0.003), { uv: panel }),
    Object.assign(torsoRing(0.735, 0.117, 0.076, shirtCol, B.chest, B.chest, 0, 0.006), { uv: panel }),
    Object.assign(torsoRing(0.77, 0.123, 0.074, shirtCol, B.chest, B.chest, 0, 0.004), { uv: panel }),
    Object.assign(torsoRing(0.795, 0.12, 0.066, shirtCol, B.chest, B.chest, 0), { uv: panel }),
    torsoRing(0.812, 0.1, 0.058, shirtCol, B.chest, B.chest, 0),
    torsoRing(0.825, 0.07, 0.05, shirtCol, B.chest, B.neck, 0.25),
    torsoRing(0.833, 0.046, 0.041, trim, B.chest, B.neck, 0.6)
  ];
  // close ups: the shorts taper and round off between the thighs instead of ending in a flat cap
  if (det > 1) rings.unshift(torsoRing(0.405, 0.05, 0.04, lowC, B.hips, B.hips, 0, 0), torsoRing(0.42, 0.082, 0.06, lowC, B.hips, B.hips, 0, -0.003));
  bd.tube(rings, seg(20), "y", true, false);
  if (skirtHem) {
    // a skirt, a dress or a gown: a flared tube from the hips to the hem, lined inside; its lower edge follows
    // each leg part of the way, so walking moves it
    const ys = bottom === "gown" ? [0.5, 0.45, 0.38, 0.3, 0.22, 0.14, 0.06, skirtHem] : [0.5, 0.465, 0.42, 0.38, skirtHem];
    const hipW = 0.108 * (fem ? 1.1 : 1), flare = bottom === "gown" ? 0.2 : bottom === "dress" ? 0.15 : 0.142;
    const ring = (y, k) => {
      const t = (0.5 - y) / (0.5 - skirtHem), w = (hipW + (flare - hipW) * Math.pow(t, 0.85)) * k;
      return { y: S(y), w: W(w) * 1.03, d: W(w) * 0.82, cx: 0, cz: S(-0.004), col: lowC, b0: B.hips, b1: B.hips, w1: 0,
        bf: x => [B.hips, x > 0 ? B.thighL : B.thighR, Math.min(1, Math.abs(x) / (W(w) * 0.8)) * t * (bottom === "gown" ? 0.35 : 0.55)] };
    };
    bd.tube(ys.map(y => ring(y, 1)), seg(22), "y", false, false);
    const i0 = bd.idx.length;
    bd.tube(ys.map(y => ring(y, 0.97)), seg(22), "y", false, false);
    for (let k = i0; k < bd.idx.length; k += 3) { const t = bd.idx[k + 1]; bd.idx[k + 1] = bd.idx[k + 2]; bd.idx[k + 2] = t; }
  }
  // shoulder caps (the deltoids) round off where the arm meets the body
  const capK = fem ? musc * 0.86 : musc;
  for (const side of [1, -1]) bd.blob(side * W(0.104) * shoulder, S(0.79), 0, W(0.04) * capK, W(0.036) * capK, W(0.038) * capK, vest ? armSkin : shirt, side > 0 ? B.armL : B.armR, seg(6), seg(12));
  // the neck, with the trapezius slope from the shoulders
  bd.tube([
    { y: S(0.818), w: W(0.05), d: W(0.042), cx: 0, cz: S(-0.002), col: skinD, b0: B.neck, b1: B.chest, w1: 0.4 },
    { y: S(0.84), w: W(0.037), d: W(0.035), cx: 0, cz: S(0.004), col: skinD, b0: B.neck },
    { y: S(0.875), w: W(0.033), d: W(0.032), cx: 0, cz: S(0.008), col: skin, b0: B.neck, b1: B.head, w1: 0.5 }
  ], seg(12), "y", false, false);
  // ---------- head: skull, jaw and chin, cheekbones; eyes set in, brows, nose, lips, ears; the beard ----------
  const hy = S(0.93), hz = S(0.012);
  const faceW = knob(look.faceW, 0.93, 1.07);
  const jawK = look.jaw === undefined ? 0.3 : 0.42 - Math.max(0, Math.min(1, look.jaw)) * 0.24;
  const cheekK = look.cheeks === undefined ? 1.04 : 1 + Math.max(0, Math.min(1, look.cheeks)) * 0.08;
  const chinK = knob(look.chin, 0.92, 1.08);
  const beardCol = look.beard ? tag(mixc(hairC, skin, look.beard === 3 ? 0.62 : 0.25), MAT.hair) : skin;
  const moCol = tag(mixc(hairC, skin, 0.3), MAT.hair);
  const beardAt = (x, y, z) => {
    const b = look.beard || 0;
    if (b === 1 || b === 2 || b === 3) return y < -0.3 && z > -0.25;
    if (b === 4) return y < -0.42 && z > 0.45 && Math.abs(x) < 0.38; // goatee
    if (b === 5) return y < -0.3 && z > -0.25 && (y < -0.78 || Math.abs(x) > 0.68 || z < 0.35); // chin strap
    return false;
  };
  const rxHead = W(0.05) / bulk * 1.02 * faceW;
  const iris = look.eyeCol === undefined ? null : hexToRgb(EYE_COL[look.eyeCol % EYE_COL.length]);
  const earK = knob(look.ears, 0.82, 1.22);
  if (det > 1) {
    // close up: a sculpted head with real eyes, lids, brows and ears, and clumped hair (hero.mjs)
    // (the face width slider lives inside the sculpt, so the frame takes the plain head width)
    const hctx = { bd, cx: 0, cy: hy, cz: hz, rx: S(0.051), ry: S(0.066), rz: S(0.06), skin, skinD, iris: iris || [0.23, 0.15, 0.09], B, tag, MAT, mixc, look };
    heroHead(hctx);
    heroHair({ bd, cx: 0, cy: hy, cz: hz, rx: S(0.051), ry: S(0.066), rz: S(0.06), col: hairC, skin, style: look.hair, hairline: look.hairline, B, tag, MAT, mixc, look });
  } else {
  bd.blob(0, hy, hz, rxHead, S(0.066), S(0.06), (x, y, z) => {
    if (beardAt(x, y, z)) return beardCol;
    if (look.beard === 2 && y < 0.05 && z > 0.6 && Math.abs(x) < 0.5) return tag(mixc(beardCol, skin, 0.45), MAT.hair);
    if (look.moustache && y < -0.12 && y > -0.36 && z > 0.72 && Math.abs(x) < 0.42) return moCol;
    return skin;
  }, B.head, seg(12), seg(18), 0, (x, y, z) => {
    // a narrower jaw and chin, flatter at the sides, the face plane slightly forward
    const jaw = y < 0 ? 1 - (-y) * (jawK + Math.max(0, -z) * 0.2) : 1 - y * 0.04;
    const cheek = y < 0.15 && y > -0.35 && z > 0.3 ? cheekK : 1;
    return [jaw * cheek, y < -0.55 ? chinK : 1, (z > 0 ? 1.06 : 0.97) * (y < -0.6 ? 0.9 : 1)];
  });
  const eyeS = knob(look.eyes, 0.85, 1.2), browK = knob(look.brows, 0.6, 1.4), noseK = knob(look.nose, 0.8, 1.25), mouthK = knob(look.mouth, 0.85, 1.18);
  for (const sx of [1, -1]) {
    // ears
    bd.blob(sx * (W(0.05) * faceW + (earK - 1) * S(0.006)), hy - S(0.004), hz - S(0.006), S(0.008) * earK, S(0.017) * earK, S(0.012) * earK, skinD, B.head, seg(4), seg(8));
    // eyes, just under the brow ridge (close ups get real eyes from hero.mjs)
    bd.blob(sx * S(0.0185), hy + S(0.006), hz + S(0.053), S(0.0062) * eyeS, S(0.0042) * eyeS, S(0.0028), tag(iris ? mixc(iris, [0, 0, 0], 0.55) : [0.06, 0.05, 0.045], MAT.eye), B.head, seg(3), seg(8));
    bd.blob(sx * S(0.0185), hy + S(0.0135), hz + S(0.054), S(0.011) * eyeS, S(0.0035), S(0.0045), tag(mixc(skinD, [0, 0, 0], 0.1), MAT.skin), B.head, seg(3), seg(8));
    // brows (they move with mood)
    bd.blob(sx * S(0.02), hy + S(0.02), hz + S(0.055), S(0.0125) * (0.85 + browK * 0.15), S(0.0026) * browK, S(0.0036), tag(mixc(hairC, skinD, 0.2), MAT.hair), B.brow, seg(2), seg(8));
  }
  // nose and lips
  bd.blob(0, hy - S(0.004), hz + S(0.062), S(0.0075) * noseK, S(0.017) * (1 + (noseK - 1) * 0.5), S(0.011) * noseK, skin, B.head, seg(4), seg(8), 0, (x, y, z) => [1 + Math.max(0, -y) * 0.5, 1, 1]);
  bd.blob(0, hy - S(0.029), hz + S(0.055), S(0.014) * mouthK, S(0.0042) * (1 + (mouthK - 1) * 0.6), S(0.0048), tag(mixc(skinD, [0.45, 0.16, 0.14], 0.35), MAT.skin), B.jaw, seg(3), seg(8));
  // ---------- hair: sixteen styles ----------
  hairStyle(bd, look.hair, hy, hz, rxHead, S, hairC, seg, look.hairline);
  }
  // ---------- accessories on the head ----------
  if (look.headband) bd.tube([
    { y: hy + S(0.021), w: rxHead * 1.1, d: S(0.064), cx: 0, cz: hz - S(0.004), col: acc(look.headband), b0: B.head },
    { y: hy + S(0.036), w: rxHead * 1.07, d: S(0.062), cx: 0, cz: hz - S(0.006), col: acc(look.headband), b0: B.head }
  ], seg(18), "y", false, false);
  if (look.earrings) for (const sx of [1, -1]) bd.blob(sx * (W(0.05) * faceW + (earK - 1) * S(0.006) + S(0.002)), hy - S(0.019) * earK, hz - S(0.004), S(0.0032), S(0.0032), S(0.0032), acc(look.earrings), B.head, seg(3), seg(6));
  if (look.necklace) {
    bd.tube([
      { y: S(0.835), w: W(0.047), d: W(0.044), cx: 0, cz: S(0.004), col: acc(look.necklace), b0: B.neck, b1: B.chest, w1: 0.5 },
      { y: S(0.829), w: W(0.049), d: W(0.046), cx: 0, cz: S(0.004), col: acc(look.necklace), b0: B.neck, b1: B.chest, w1: 0.5 }
    ], seg(16), "y", false, false);
    bd.blob(0, S(0.817), S(0.004) + W(0.046), S(0.006), S(0.008), S(0.003), acc(look.necklace), B.chest, seg(3), seg(6));
  }
  // ---------- arms: sleeves, skin (or long sleeves), hands (or gloves) ----------
  for (const side of [1, -1]) {
    const ax = side * W(0.114) * shoulder, ay = S(0.792);
    const arm = side > 0 ? B.armL : B.armR, fore = side > 0 ? B.foreL : B.foreR, hand = side > 0 ? B.handL : B.handR, clav = side > 0 ? B.clavL : B.clavR;
    const longSleeve = look.gk || look.sleeve;
    const sleeveEnd = longSleeve ? 2 : vest ? 0 : 0.52;
    const upY = [0.0, 0.025, 0.06, 0.09, 0.12, 0.15, 0.18];
    const upR = [0.043, 0.042, 0.04, 0.037, 0.034, 0.03, 0.027];
    const up = upY.map((yy, i) => {
      const sl = yy / 0.18 < sleeveEnd;
      const hem = !longSleeve && yy / 0.18 >= sleeveEnd - 0.1 && sl;
      return { y: ay - S(yy), w: W(upR[i]) * musc * (sl ? (look.plain ? 1.05 : 1.1) : 1), d: W(upR[i]) * musc * (sl ? (look.plain ? 1.03 : 1.06) : 0.96), cx: ax, cz: 0, col: sl ? (hem ? trim : shirt) : armSkin, b0: i === 0 ? clav : arm, b1: i === 0 ? arm : i === upY.length - 1 ? fore : arm, w1: i === 0 ? 0.7 : i === upY.length - 1 ? 0.5 : 0 };
    });
    bd.tube(up, seg(14), "y", false, false);
    // close up: a rounded cap over the shoulder joint, so the sleeve meets the body without a step
    if (det > 1) bd.blob(ax - side * W(0.006), ay - S(0.006), 0, W(0.047) * musc * (longSleeve ? 1.04 : 1.08), S(0.034), W(0.045) * musc, longSleeve || sleeveEnd > 0 ? shirt : armSkin, clav, seg(5), seg(12), 0, null);
    const fy = ay - S(0.18);
    const fyy = [0.0, 0.03, 0.06, 0.09, 0.12, 0.15];
    const fr = [0.027, 0.029, 0.028, 0.024, 0.02, 0.018];
    bd.tube(fr.map((r, i) => ({ y: fy - S(fyy[i]), w: W(r) * musc, d: W(r) * musc * 0.86, cx: ax, cz: 0, col: longSleeve ? (i === fr.length - 1 && look.gk ? glove : shirt) : armSkin, b0: i === 0 ? arm : fore, b1: i === 0 ? fore : i === fr.length - 1 ? hand : fore, w1: i === 0 ? 0.5 : i === fr.length - 1 ? 0.3 : 0 })), seg(12), "y", false, false);
    // the hand: a rounded mitten with a thumb; gloves are bigger and bolder
    const hs = look.gk ? 1.3 : fem ? 0.9 : 1;
    if (det > 1 && !look.gk) {
      // close up: a palm, four fingers in two curled pieces (index at the front, little finger at the back,
      // the palm facing the thigh) and a thumb across the front
      bd.blob(ax, fy - S(0.172), 0, S(0.0115), S(0.026), S(0.0205), glove, hand, seg(5), seg(10));
      const len = [0.026, 0.029, 0.027, 0.021];
      for (let k = 0; k < 4; k++) {
        const z = S(0.0138) - k * S(0.0092), L = S(len[k]);
        const y0 = fy - S(0.194);
        bd.blob(ax - side * S(0.0012), y0 - L * 0.26, z, S(0.0056), L * 0.32, S(0.0049), glove, hand, seg(3), seg(7));
        bd.blob(ax - side * S(0.0052), y0 - L * 0.7, z * 0.96, S(0.0049), L * 0.27, S(0.0044), glove, hand, seg(3), seg(7));
      }
      bd.blob(ax - side * S(0.0085), fy - S(0.178), S(0.0205), S(0.0062), S(0.0155), S(0.0066), glove, hand, seg(3), seg(7));
      bd.blob(ax - side * S(0.0125), fy - S(0.196), S(0.0225), S(0.0052), S(0.0095), S(0.0056), glove, hand, seg(3), seg(7));
    } else {
      bd.blob(ax, fy - S(0.188), S(0.003), S(0.02) * hs, S(0.038) * hs, S(0.012) * hs, glove, hand, seg(6), seg(10));
      bd.blob(ax - side * S(0.011) * hs, fy - S(0.168), S(0.012), S(0.0075) * hs, S(0.017) * hs, S(0.0075) * hs, glove, hand, seg(4), seg(8));
    }
    // a watch on the left wrist, a bracelet on the right
    const wristBand = (col, wide, face) => {
      bd.tube([
        { y: fy - S(0.133), w: W(0.0205) * musc * 1.12, d: W(0.0205) * musc * 0.98, cx: ax, cz: 0, col, b0: fore, b1: hand, w1: 0.3 },
        { y: fy - S(0.133 + wide), w: W(0.0198) * musc * 1.12, d: W(0.0198) * musc * 0.98, cx: ax, cz: 0, col, b0: fore, b1: hand, w1: 0.4 }
      ], seg(12), "y", false, false);
      if (face) bd.blob(ax, fy - S(0.139), W(0.0205) * musc * 0.95, S(0.008), S(0.009), S(0.003), face, fore, seg(3), seg(8));
    };
    if (side > 0 && look.watch) wristBand(acc(look.watch), 0.013, tag(mixc(acc(look.watch), [0.05, 0.05, 0.06], 0.4), MAT.metal));
    if (side < 0 && look.bracelet) wristBand(acc(look.bracelet), 0.005, null);
  }
  // ---------- legs: shorts over the thigh, the knee, a calf in the sock, the boot ----------
  for (const side of [1, -1]) {
    const lx = fem ? side * W(0.056) * 1.07 : side * W(0.056), ly = S(0.502);
    const thigh = side > 0 ? B.thighL : B.thighR, shin = side > 0 ? B.shinL : B.shinR, foot = side > 0 ? B.footL : B.footR, toe = side > 0 ? B.toeL : B.toeR;
    const tY = [0, 0.03, 0.06, 0.09, 0.112, 0.118, 0.15, 0.18, 0.21, 0.238];
    const tR = [0.066, 0.066, 0.063, 0.06, 0.057, 0.054, 0.05, 0.046, 0.041, 0.037];
    const thighK = legK * (1 + (musc - 1) * 0.5);
    bd.tube(tY.map((yy, i) => {
      const inShorts = yy < 0.115;
      // under a skirt the thigh wears the skirt's colour, so a stride never shows through it
      const under = skirtHem && ly - S(yy) > S(skirtHem) - S(0.01);
      const col = trousers ? shorts : inShorts && !skirtHem ? (yy > 0.1 ? mixc(shorts, trim, 0.45) : shorts) : under ? lowC : legSkin;
      return { y: ly - S(yy), w: W(tR[i]) * thighK * (inShorts ? 1.1 : trousers ? 1.05 : 0.96), d: W(tR[i]) * thighK * (inShorts ? 1.08 : trousers ? 1.05 : 1.02), cx: lx + (inShorts ? side * W(0.004) : 0), cz: S(i > 4 && i < 8 ? 0.006 : 0.003), col, b0: i === 0 ? B.hips : thigh, b1: i === 0 ? thigh : i === tY.length - 1 ? shin : thigh, w1: i === 0 ? 0.65 : i === tY.length - 1 ? 0.5 : 0 };
    }), seg(14), "y", false, false);
    // the knee cap
    bd.blob(lx, ly - S(0.236), S(0.03), W(0.022) * legK, W(0.024) * legK, W(0.012) * legK, trousers ? shorts : skirtHem && ly - S(0.236) > S(skirtHem) ? lowC : legSkin, shin, seg(4), seg(8));
    const kneeY = ly - S(0.238);
    const sockTop = look.sock ? 0.0 : 0.035;
    const sY = [0, 0.025, 0.05, 0.075, 0.1, 0.13, 0.16, 0.19, 0.21, 0.222];
    const sR = [0.036, 0.038, 0.042, 0.043, 0.04, 0.034, 0.028, 0.024, 0.022, 0.022];
    bd.tube(sY.map((yy, i) => {
      const sock = yy >= sockTop;
      const band = yy >= sockTop && yy < sockTop + 0.02;
      // the calf bulges at the back
      const calf = i > 1 && i < 6 ? 0.006 : 0;
      if (trousers || skirtHem) {
        // trousers to the ankle, a little wider at the hem; bare legs (or tights) under a skirt or a dress
        const k = trousers ? 1.12 + yy * 0.5 : fem ? 0.93 : 1;
        const col = trousers ? shorts : kneeY - S(yy) > S(skirtHem) ? lowC : legSkin;
        return { y: kneeY - S(yy), w: W(sR[i]) * legK * k, d: W(sR[i]) * legK * k, cx: lx, cz: trousers ? 0 : -S(calf), col, b0: i === 0 ? thigh : shin, b1: i === 0 ? shin : i === sY.length - 1 ? foot : shin, w1: i === 0 ? 0.5 : i === sY.length - 1 ? 0.4 : 0 };
      }
      return { y: kneeY - S(yy), w: W(sR[i]) * legK * (sock ? 1.05 : 1), d: W(sR[i]) * legK * (sock ? 1.05 : 1), cx: lx, cz: -S(calf), col: band ? trim : sock ? socks : legSkin, b0: i === 0 ? thigh : shin, b1: i === 0 ? shin : i === sY.length - 1 ? foot : shin, w1: i === 0 ? 0.5 : i === sY.length - 1 ? 0.4 : 0 };
    }), seg(13), "y", false, false);
    // the boot: from the heel to the toe along +Z, a darker sole, a soft rounded toe
    const ankY = kneeY - S(0.222);
    const fz = [-0.036, -0.026, -0.005, 0.025, 0.055, 0.085, 0.11, 0.128, 0.136];
    const fw = [0.02, 0.028, 0.032, 0.034, 0.035, 0.033, 0.029, 0.021, 0.01];
    const fh = [0.022, 0.03, 0.031, 0.026, 0.021, 0.018, 0.016, 0.013, 0.008];
    const fk = fem ? 0.86 : 1;
    bd.tube(fz.map((zz, i) => ({ z: S(zz), w: fem ? S(fw[i]) * fk : S(fw[i]), d: S(fh[i]), cx: lx, cy: ankY - S(0.03) + S(fh[i] * 0.85), col: (x, y, z) => y < ankY - S(0.027) ? bootS : bootC, b0: zz < 0.075 ? foot : toe, b1: zz < 0.075 ? (zz > 0.045 ? toe : foot) : toe, w1: zz > 0.045 && zz < 0.075 ? 0.4 : 0 })), seg(12), "z", true, true);
  }
  return bd.geometry(THREE, !!(opts && opts.groups));
}

// hairline: 0 low and full to 1 high (the cap sits up and back); missing means the match's standard cap
function hairStyle(bd, style, hy, hz, rx, S, col, seg, hairline) {
  seg = seg || (n => n);
  const hl = hairline === undefined || hairline === null ? 0 : (Math.max(0, Math.min(1, hairline)) - 0.5);
  hy += hl * S(0.012); hz -= hl * S(0.012);
  const top = (sy, yMin, shape) => bd.blob(0, hy + S(0.008), hz - S(0.004), rx * 1.06, S(0.064) * sy, S(0.063), col, B.head, seg(6), seg(14), 0, shape);
  const cap = (k) => bd.blob(0, hy + S(0.012), hz - S(0.006), rx * (k || 1.02), S(0.058), S(0.06), col, B.head, seg(5), seg(14), 0, (x, y, z) => [1, y < -0.1 ? 0.2 : 1, z > 0.6 && y < 0.4 ? 0.9 : 1]);
  if (style >= 16 && style <= 21) {
    // the long styles (the career's other people; never a match player)
    const lumpy = (x, y, z) => { const b = 1 + 0.08 * Math.sin(x * 17) * Math.sin(y * 13); return [b, 1, b]; };
    if (style === 16 || style === 19) {
      // long, straight or curly, past the shoulders and down the back
      top(1.06, 0, (x, y, z) => [1.03, y < -0.3 && z > 0.2 ? 0.25 : 1, 1]);
      bd.blob(0, hy - S(0.05), hz - S(0.058), rx * (style === 19 ? 1.3 : 1.14), S(0.075), S(0.03), col, B.head, seg(5), seg(12), 0, style === 19 ? lumpy : null);
      bd.blob(0, hy - S(0.15), hz - S(0.075), rx * (style === 19 ? 1.25 : 1.05), S(0.06), S(0.022), col, B.hair, seg(5), seg(12), 0, style === 19 ? lumpy : null);
    } else if (style === 17) {
      // a ponytail from the back of the head
      top(1.02, 0, (x, y, z) => [1, y < 0 ? 0.3 : 1, 1]);
      bd.blob(0, hy + S(0.01), hz - S(0.062), S(0.016), S(0.016), S(0.016), col, B.head, seg(4), seg(8));
      bd.blob(0, hy - S(0.06), hz - S(0.078), S(0.018), S(0.065), S(0.018), col, B.hair, seg(4), seg(8));
    } else if (style === 18) {
      // a bob to the jaw, over the ears
      top(1.07, 0, (x, y, z) => [1.04, y < -0.3 && z > 0.2 ? 0.25 : 1, 1]);
      bd.blob(0, hy - S(0.016), hz - S(0.022), rx * 1.17, S(0.05), S(0.052), col, B.head, seg(5), seg(14));
    } else if (style === 20) {
      // a plait down the back
      cap(1.03);
      for (let i = 0; i < 6; i++) bd.blob((i % 2 ? 1 : -1) * S(0.004), hy - S(0.05) - i * S(0.03), hz - S(0.066) - Math.min(i, 3) * S(0.006), S(0.016) * (1 - i * 0.07), S(0.02), S(0.015), col, i < 2 ? B.head : B.hair, seg(4), seg(8));
    } else {
      // a top knot
      cap(1.03);
      bd.blob(0, hy + S(0.072), hz - S(0.022), S(0.024), S(0.021), S(0.024), col, B.hair, seg(4), seg(8));
    }
    return;
  }
  switch (style % 16) {
    case 0: // buzz cut: a thin cap
      cap();
      break;
    case 1: // short crop with a fringe
      top(1.04, 0, (x, y, z) => [1, y < 0 ? 0.25 : 1, z > 0.7 && y < 0.3 ? 0.95 : 1]);
      break;
    case 2: // curly top: volume on the crown, short sides
      bd.blob(0, hy + S(0.03), hz - S(0.004), rx * 1.08, S(0.055), S(0.064), col, B.head, seg(6), seg(14), 0, (x, y, z) => [1 + Math.max(0, y) * 0.1, y < 0.1 ? 0.3 : 1.15, 1]);
      break;
    case 3: // afro
      bd.blob(0, hy + S(0.03), hz - S(0.01), rx * 1.35, S(0.082), S(0.078), col, B.head, seg(7), seg(14), 0, (x, y, z) => [1, y < -0.25 ? 0.4 : 1, 1]);
      break;
    case 4: // long hair tied in a bun, the bun swings on the hair bone
      top(1.02, 0, (x, y, z) => [1, y < 0 ? 0.3 : 1, 1]);
      bd.blob(0, hy + S(0.05), hz - S(0.06), S(0.024), S(0.022), S(0.024), col, B.hair, seg(4), seg(8));
      break;
    case 5: // shaved sides with a mohawk strip
      bd.blob(0, hy + S(0.012), hz - S(0.006), rx * 1.01, S(0.056), S(0.06), col, B.head, seg(5), seg(14), 0, (x, y, z) => [Math.abs(x) > 0.35 ? 0.98 : 1, y < -0.1 ? 0.2 : 1, 1]);
      bd.blob(0, hy + S(0.05), hz - S(0.004), S(0.012), S(0.035), S(0.06), col, B.head, seg(4), seg(8));
      break;
    case 6: // bald
      break;
    case 7: // long flowing hair down to the neck, on the hair bone for movement
      top(1.05, 0, (x, y, z) => [1.02, y < -0.3 && z > 0.2 ? 0.25 : 1, 1]);
      bd.blob(0, hy - S(0.03), hz - S(0.045), rx * 1.05, S(0.06), S(0.035), col, B.hair, seg(5), seg(12));
      break;
    case 8: // side part, medium length
      top(1.06, 0, (x, y, z) => [1.03, y < -0.05 ? 0.35 : 1, z > 0.75 && y < 0.25 ? 0.9 : 1]);
      break;
    case 9: // skin fade with a textured crop on top
      cap(1.005);
      bd.blob(0, hy + S(0.036), hz - S(0.002), rx * 0.86, S(0.036), S(0.056), col, B.head, seg(5), seg(14), 0, (x, y, z) => [1, y < 0 ? 0.3 : 1, z > 0.7 ? 1.04 : 1]);
      break;
    case 10: // cornrow braids: a tight cap with rows running front to back
      cap(1.01);
      for (let i = -2; i <= 2; i++) bd.blob(i * rx * 0.3, hy + S(0.05) - Math.abs(i) * S(0.012), hz - S(0.004), S(0.0055), S(0.006), S(0.058), col, B.head, seg(3), seg(10));
      break;
    case 11: // dreadlocks: a cap and locks hanging round the back and sides, swinging on the hair bone
      cap(1.04);
      for (let i = 0; i < 11; i++) {
        const a = Math.PI * (0.15 + i * 0.07);
        const x = Math.cos(a) * rx * 1.02, z = hz - Math.sin(a) * S(0.06);
        bd.blob(x, hy - S(0.03), z, S(0.007), S(0.05), S(0.007), col, i % 3 === 0 ? B.head : B.hair, seg(3), seg(6));
      }
      break;
    case 12: // quiff: short sides, the front swept up high
      top(1.02, 0, (x, y, z) => [1, y < -0.05 ? 0.3 : 1, 1]);
      bd.blob(0, hy + S(0.055), hz + S(0.022), rx * 0.7, S(0.03), S(0.035), col, B.head, seg(5), seg(12));
      break;
    case 13: // undercut with a man bun on the crown
      cap(1.0);
      bd.blob(0, hy + S(0.03), hz - S(0.01), rx * 0.92, S(0.04), S(0.058), col, B.head, seg(5), seg(14), 0, (x, y, z) => [1, y < 0.2 ? 0.2 : 1, 1]);
      bd.blob(0, hy + S(0.07), hz - S(0.035), S(0.02), S(0.018), S(0.02), col, B.hair, seg(4), seg(8));
      break;
    case 14: // twists: a lumpy crown of short twists
      bd.blob(0, hy + S(0.026), hz - S(0.004), rx * 1.12, S(0.06), S(0.067), col, B.head, seg(7), seg(16), 0, (x, y, z) => { const b = 1 + 0.06 * Math.sin(x * 19) * Math.sin(z * 17); return [b, y < -0.05 ? 0.3 : 1.08 * b, b]; });
      break;
    default: // 15, mullet: short on top, long at the back on the hair bone
      top(1.03, 0, (x, y, z) => [1.01, y < -0.1 ? 0.3 : 1, 1]);
      bd.blob(0, hy - S(0.04), hz - S(0.05), rx * 0.95, S(0.05), S(0.026), col, B.hair, seg(5), seg(12));
  }
}

// the team's sheet of names and numbers (one cell per player), drawn on a canvas when there is a page
export function numberSheet(THREE, doc, players, kit) {
  if (!doc) return { tex: null, cells: {} };
  const cv = doc.createElement("canvas");
  const cols = 4, rows = 3, CW = 256, CH = 256;
  cv.width = cols * CW; cv.height = rows * CH;
  const g = cv.getContext("2d");
  if (!g) return { tex: null, cells: {} };
  g.clearRect(0, 0, cv.width, cv.height);
  const shirt = hexToRgb(kit[0]);
  const ink = lum(shirt) > 0.55 ? "#141414" : kit[1] && Math.abs(lum(hexToRgb(kit[1])) - lum(shirt)) > 0.3 ? kit[1] : "#f4f4f4";
  const cells = {};
  players.forEach((p, i) => {
    const cx = (i % cols) * CW, cy = Math.floor(i / cols) * CH;
    g.fillStyle = ink;
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.font = "700 30px 'Chakra Petch', 'Arial Narrow', Arial, sans-serif";
    const nm = String(p.short || "").toUpperCase().slice(0, 12);
    g.fillText(nm, cx + CW / 2, cy + 44, CW - 20);
    g.font = "700 176px 'Chakra Petch', 'Arial Black', Arial, sans-serif";
    g.fillText(String(p.num || ""), cx + CW / 2, cy + 222, CW - 24);
    // v runs bottom up in UV space
    cells[p.id] = [cx / cv.width, 1 - (cy + CH) / cv.height, (cx + CW) / cv.width, 1 - cy / cv.height];
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, cells };
}

// the kit material: vertex colours for the regions, the name and number sheet laid over them as a decal
export function kitMaterial(THREE, sheet) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.68, metalness: 0.0 });
  if (sheet) {
    mat.map = sheet;
    mat.onBeforeCompile = sh => {
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <map_fragment>", "")
        .replace("#include <color_fragment>", "#include <color_fragment>\n#ifdef USE_MAP\n vec4 dec = texture2D( map, vMapUv );\n diffuseColor.rgb = mix( diffuseColor.rgb, dec.rgb, dec.a );\n#endif");
    };
    mat.customProgramCacheKey = () => "flkit";
  }
  return mat;
}

// a skeleton in its rest pose for one player
export function buildSkeleton(THREE, h) {
  const bones = BONES.map(([name, parent, off]) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(off[0] * h, off[1] * h, off[2] * h);
    return b;
  });
  BONES.forEach(([name, parent], i) => { if (parent >= 0) bones[parent].add(bones[i]); });
  return bones;
}

export { hexToRgb, lum, skinAt };
export { paintFace, faceShape, sculpt, hairCoverage, hairStyleOf, headFrame, HAIR } from "./hero.mjs";

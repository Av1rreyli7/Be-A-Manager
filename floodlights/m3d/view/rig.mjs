// The players' bodies: one skinned mesh per player on a 26 bone skeleton, built procedurally so every player
// has his own height, build, skin tone, hair, beard and boots, and wears his club's kit with his own number and
// name on the back. One draw call per player (plus its shadow).
// Character space: +Y up, +Z forward, +X the player's left. The view turns it to face the sim's direction.

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
export const HAIR_COL = ["#151110", "#2a1d15", "#4a3222", "#6e4a2c", "#a87a46", "#d2b07a", "#8b8b8b"];
export const BOOTS = [["#111111", "#f3f3f3"], ["#f4f4f4", "#111111"], ["#ff5a1f", "#1b1b1b"], ["#d6f53a", "#151515"], ["#1f5cff", "#ffffff"], ["#e01f3d", "#f1f1f1"]];
const GK_KITS = [["#2bd673", "#0b3d22"], ["#ff8a1f", "#3a1600"], ["#8a4dff", "#1d0c3d"], ["#f2e600", "#2a2600"], ["#1fd4e0", "#06353a"]];

function hexToRgb(h) { const n = parseInt(String(h).replace("#", ""), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
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
  constructor() { this.pos = []; this.nor = []; this.col = []; this.uv = []; this.si = []; this.sw = []; this.idx = []; this.n = 0; }
  vert(x, y, z, c, b0, b1, w1, u, v) {
    this.pos.push(x, y, z); this.nor.push(0, 0, 0); this.col.push(c[0], c[1], c[2]);
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
        this.vert(x, y, z, c, r.b0, r.b1, r.w1, uv ? uv[0] : undefined, uv ? uv[1] : undefined);
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
        this.vert(cx + x * sx, cy + y * sy, cz + z * sz, c, b0, b0, 0);
      }
    }
    for (let i = 0; i < latN; i++) for (let j = 0; j < lonN; j++) {
      const a = base + i * lonN + j, b = base + i * lonN + (j + 1) % lonN, c = a + lonN, d = b + lonN;
      this.tri(a, c, b); this.tri(b, c, d);
    }
    this.orient(i0, cx, cy, cz, null);
  }
  geometry(THREE) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

// ---------- one player's body ----------
// look: { h, mass, skin, hair, hairCol, beard, boot, sleeve, sock, kit: [shirt, trim], shorts, socks, gk, cell }
export function buildBody(THREE, look) {
  const h = look.h;
  const bulk = Math.max(0.9, Math.min(1.14, Math.sqrt(look.mass / (22.6 * h * h)))); // build relative to a 22.6 BMI
  const S = v => v * h;
  const W = v => v * h * bulk;
  const skin = hexToRgb(SKIN[look.skin % SKIN.length]);
  const skinD = mixc(skin, [0, 0, 0], 0.18);
  const shirt = hexToRgb(look.kit[0]), trim = hexToRgb(look.kit[1]);
  const shorts = hexToRgb(look.shorts), socks = hexToRgb(look.socks);
  const boots = BOOTS[look.boot % BOOTS.length], bootC = hexToRgb(boots[0]), bootS = hexToRgb(boots[1]);
  const hairC = hexToRgb(HAIR_COL[look.hairCol % HAIR_COL.length]);
  const glove = look.gk ? hexToRgb(look.kit[1]) : skin;
  const bd = new Builder();
  const cell = look.cell; // [u0, v0, u1, v1] on the team's number sheet, or null
  // ---------- torso (shorts below, shirt above), skinned up the spine ----------
  const torsoRing = (y, w, d, col, b0, b1, w1, cz) => ({ y: S(y), w: W(w), d: W(d), cx: 0, cz: S(cz || 0), col, b0, b1, w1 });
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
    if (Math.abs(x) > W(0.095) && yy < 0.75 && yy > 0.56) return mixc(shirt, trim, 0.35);
    return shirt;
  };
  // the torso: athletic V shape (broad chest and shoulders, narrow waist), glutes inside the shorts
  const rings = [
    torsoRing(0.44, 0.1, 0.07, shorts, B.hips, B.hips, 0, -0.004),
    torsoRing(0.47, 0.106, 0.078, shorts, B.hips, B.hips, 0, -0.008),
    torsoRing(0.5, 0.108, 0.075, shorts, B.hips, B.hips, 0, -0.004),
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
  bd.tube(rings, 20, "y", true, false);
  // shoulder caps (the deltoids) round off where the arm meets the body
  for (const side of [1, -1]) bd.blob(side * W(0.104), S(0.79), 0, W(0.04), W(0.036), W(0.038), shirt, side > 0 ? B.armL : B.armR, 6, 12);
  // the neck, with the trapezius slope from the shoulders
  bd.tube([
    { y: S(0.818), w: W(0.05), d: W(0.042), cx: 0, cz: S(-0.002), col: skinD, b0: B.neck, b1: B.chest, w1: 0.4 },
    { y: S(0.84), w: W(0.037), d: W(0.035), cx: 0, cz: S(0.004), col: skinD, b0: B.neck },
    { y: S(0.875), w: W(0.033), d: W(0.032), cx: 0, cz: S(0.008), col: skin, b0: B.neck, b1: B.head, w1: 0.5 }
  ], 12, "y", false, false);
  // ---------- head: skull, jaw and chin, cheekbones; eyes set in, brows, nose, lips, ears; the beard ----------
  const hy = S(0.93), hz = S(0.012);
  const beardCol = look.beard ? mixc(hairC, skin, 0.25) : skin;
  bd.blob(0, hy, hz, W(0.05) / bulk * 1.02, S(0.066), S(0.06), (x, y, z) => {
    if (look.beard && y < -0.3 && z > -0.25) return beardCol;
    if (look.beard === 2 && y < 0.05 && z > 0.6 && Math.abs(x) < 0.5) return mixc(beardCol, skin, 0.45);
    return skin;
  }, B.head, 12, 18, 0, (x, y, z) => {
    // a narrower jaw and chin, flatter at the sides, the face plane slightly forward
    const jaw = y < 0 ? 1 - (-y) * (0.3 + Math.max(0, -z) * 0.2) : 1 - y * 0.04;
    const cheek = y < 0.15 && y > -0.35 && z > 0.3 ? 1.04 : 1;
    return [jaw * cheek, 1, (z > 0 ? 1.06 : 0.97) * (y < -0.6 ? 0.9 : 1)];
  });
  for (const sx of [1, -1]) {
    // ears
    bd.blob(sx * W(0.05), hy - S(0.004), hz - S(0.006), S(0.008), S(0.017), S(0.012), skinD, B.head, 4, 8);
    // eyes, just under the brow ridge
    bd.blob(sx * S(0.0185), hy + S(0.006), hz + S(0.053), S(0.0062), S(0.0042), S(0.0028), [0.06, 0.05, 0.045], B.head, 3, 8);
    bd.blob(sx * S(0.0185), hy + S(0.0135), hz + S(0.054), S(0.011), S(0.0035), S(0.0045), mixc(skinD, [0, 0, 0], 0.1), B.head, 3, 8);
    // brows (they move with mood)
    bd.blob(sx * S(0.02), hy + S(0.02), hz + S(0.055), S(0.0125), S(0.0026), S(0.0036), mixc(hairC, skinD, 0.2), B.brow, 2, 8);
  }
  // nose and lips
  bd.blob(0, hy - S(0.004), hz + S(0.062), S(0.0075), S(0.017), S(0.011), skin, B.head, 4, 8, 0, (x, y, z) => [1 + Math.max(0, -y) * 0.5, 1, 1]);
  bd.blob(0, hy - S(0.029), hz + S(0.055), S(0.014), S(0.0042), S(0.0048), mixc(skinD, [0.45, 0.16, 0.14], 0.35), B.jaw, 3, 8);
  // ---------- hair: nine styles ----------
  hairStyle(bd, look.hair, hy, hz, W(0.05) / bulk * 1.02, S, hairC);
  // ---------- arms: sleeves, skin (or long sleeves), hands (or gloves) ----------
  for (const side of [1, -1]) {
    const ax = side * W(0.114), ay = S(0.792);
    const arm = side > 0 ? B.armL : B.armR, fore = side > 0 ? B.foreL : B.foreR, hand = side > 0 ? B.handL : B.handR, clav = side > 0 ? B.clavL : B.clavR;
    const longSleeve = look.gk || look.sleeve;
    const sleeveEnd = longSleeve ? 2 : 0.52;
    const upY = [0.0, 0.025, 0.06, 0.09, 0.12, 0.15, 0.18];
    const upR = [0.043, 0.042, 0.04, 0.037, 0.034, 0.03, 0.027];
    const up = upY.map((yy, i) => {
      const sl = yy / 0.18 < sleeveEnd;
      const hem = !longSleeve && yy / 0.18 >= sleeveEnd - 0.1 && sl;
      return { y: ay - S(yy), w: W(upR[i]) * (sl ? 1.1 : 1), d: W(upR[i]) * (sl ? 1.06 : 0.96), cx: ax, cz: 0, col: sl ? (hem ? trim : shirt) : skin, b0: i === 0 ? clav : arm, b1: i === 0 ? arm : i === upY.length - 1 ? fore : arm, w1: i === 0 ? 0.7 : i === upY.length - 1 ? 0.5 : 0 };
    });
    bd.tube(up, 14, "y", false, false);
    const fy = ay - S(0.18);
    const fyy = [0.0, 0.03, 0.06, 0.09, 0.12, 0.15];
    const fr = [0.027, 0.029, 0.028, 0.024, 0.02, 0.018];
    bd.tube(fr.map((r, i) => ({ y: fy - S(fyy[i]), w: W(r), d: W(r) * 0.86, cx: ax, cz: 0, col: longSleeve ? (i === fr.length - 1 && look.gk ? glove : shirt) : skin, b0: i === 0 ? arm : fore, b1: i === 0 ? fore : i === fr.length - 1 ? hand : fore, w1: i === 0 ? 0.5 : i === fr.length - 1 ? 0.3 : 0 })), 12, "y", false, false);
    // the hand: a rounded mitten with a thumb; gloves are bigger and bolder
    const hs = look.gk ? 1.3 : 1;
    bd.blob(ax, fy - S(0.188), S(0.003), S(0.02) * hs, S(0.038) * hs, S(0.012) * hs, glove, hand, 6, 10);
    bd.blob(ax - side * S(0.011) * hs, fy - S(0.168), S(0.012), S(0.0075) * hs, S(0.017) * hs, S(0.0075) * hs, glove, hand, 4, 8);
  }
  // ---------- legs: shorts over the thigh, the knee, a calf in the sock, the boot ----------
  for (const side of [1, -1]) {
    const lx = side * W(0.056), ly = S(0.502);
    const thigh = side > 0 ? B.thighL : B.thighR, shin = side > 0 ? B.shinL : B.shinR, foot = side > 0 ? B.footL : B.footR, toe = side > 0 ? B.toeL : B.toeR;
    const tY = [0, 0.03, 0.06, 0.09, 0.112, 0.118, 0.15, 0.18, 0.21, 0.238];
    const tR = [0.066, 0.066, 0.063, 0.06, 0.057, 0.054, 0.05, 0.046, 0.041, 0.037];
    bd.tube(tY.map((yy, i) => {
      const inShorts = yy < 0.115;
      return { y: ly - S(yy), w: W(tR[i]) * (inShorts ? 1.1 : 0.96), d: W(tR[i]) * (inShorts ? 1.08 : 1.02), cx: lx + (inShorts ? side * W(0.004) : 0), cz: S(i > 4 && i < 8 ? 0.006 : 0.003), col: inShorts ? (yy > 0.1 ? mixc(shorts, trim, 0.45) : shorts) : skin, b0: i === 0 ? B.hips : thigh, b1: i === 0 ? thigh : i === tY.length - 1 ? shin : thigh, w1: i === 0 ? 0.65 : i === tY.length - 1 ? 0.5 : 0 };
    }), 14, "y", false, false);
    // the knee cap
    bd.blob(lx, ly - S(0.236), S(0.03), W(0.022), W(0.024), W(0.012), skin, shin, 4, 8);
    const kneeY = ly - S(0.238);
    const sockTop = look.sock ? 0.0 : 0.035;
    const sY = [0, 0.025, 0.05, 0.075, 0.1, 0.13, 0.16, 0.19, 0.21, 0.222];
    const sR = [0.036, 0.038, 0.042, 0.043, 0.04, 0.034, 0.028, 0.024, 0.022, 0.022];
    bd.tube(sY.map((yy, i) => {
      const sock = yy >= sockTop;
      const band = yy >= sockTop && yy < sockTop + 0.02;
      // the calf bulges at the back
      const calf = i > 1 && i < 6 ? 0.006 : 0;
      return { y: kneeY - S(yy), w: W(sR[i]) * (sock ? 1.05 : 1), d: W(sR[i]) * (sock ? 1.05 : 1), cx: lx, cz: -S(calf), col: band ? trim : sock ? socks : skin, b0: i === 0 ? thigh : shin, b1: i === 0 ? shin : i === sY.length - 1 ? foot : shin, w1: i === 0 ? 0.5 : i === sY.length - 1 ? 0.4 : 0 };
    }), 13, "y", false, false);
    // the boot: from the heel to the toe along +Z, a darker sole, a soft rounded toe
    const ankY = kneeY - S(0.222);
    const fz = [-0.036, -0.026, -0.005, 0.025, 0.055, 0.085, 0.11, 0.128, 0.136];
    const fw = [0.02, 0.028, 0.032, 0.034, 0.035, 0.033, 0.029, 0.021, 0.01];
    const fh = [0.022, 0.03, 0.031, 0.026, 0.021, 0.018, 0.016, 0.013, 0.008];
    bd.tube(fz.map((zz, i) => ({ z: S(zz), w: S(fw[i]), d: S(fh[i]), cx: lx, cy: ankY - S(0.03) + S(fh[i] * 0.85), col: (x, y, z) => y < ankY - S(0.027) ? bootS : bootC, b0: zz < 0.075 ? foot : toe, b1: zz < 0.075 ? (zz > 0.045 ? toe : foot) : toe, w1: zz > 0.045 && zz < 0.075 ? 0.4 : 0 })), 12, "z", true, true);
  }
  return bd.geometry(THREE);
}

function hairStyle(bd, style, hy, hz, rx, S, col) {
  const top = (sy, yMin, shape) => bd.blob(0, hy + S(0.008), hz - S(0.004), rx * 1.06, S(0.064) * sy, S(0.063), col, B.head, 6, 14, 0, shape);
  switch (style % 9) {
    case 0: // buzz cut: a thin cap
      bd.blob(0, hy + S(0.012), hz - S(0.006), rx * 1.02, S(0.058), S(0.06), col, B.head, 5, 14, 0, (x, y, z) => [1, y < -0.1 ? 0.2 : 1, z > 0.6 && y < 0.4 ? 0.9 : 1]);
      break;
    case 1: // short crop with a fringe
      top(1.04, 0, (x, y, z) => [1, y < 0 ? 0.25 : 1, z > 0.7 && y < 0.3 ? 0.95 : 1]);
      break;
    case 2: // curly top: volume on the crown, short sides
      bd.blob(0, hy + S(0.03), hz - S(0.004), rx * 1.08, S(0.055), S(0.064), col, B.head, 6, 14, 0, (x, y, z) => [1 + Math.max(0, y) * 0.1, y < 0.1 ? 0.3 : 1.15, 1]);
      break;
    case 3: // afro
      bd.blob(0, hy + S(0.03), hz - S(0.01), rx * 1.35, S(0.082), S(0.078), col, B.head, 7, 14, 0, (x, y, z) => [1, y < -0.25 ? 0.4 : 1, 1]);
      break;
    case 4: // long hair tied in a bun, the bun swings on the hair bone
      top(1.02, 0, (x, y, z) => [1, y < 0 ? 0.3 : 1, 1]);
      bd.blob(0, hy + S(0.05), hz - S(0.06), S(0.024), S(0.022), S(0.024), col, B.hair, 4, 8);
      break;
    case 5: // shaved sides with a mohawk strip
      bd.blob(0, hy + S(0.012), hz - S(0.006), rx * 1.01, S(0.056), S(0.06), col, B.head, 5, 14, 0, (x, y, z) => [Math.abs(x) > 0.35 ? 0.98 : 1, y < -0.1 ? 0.2 : 1, 1]);
      bd.blob(0, hy + S(0.05), hz - S(0.004), S(0.012), S(0.035), S(0.06), col, B.head, 4, 8);
      break;
    case 6: // bald
      break;
    case 7: // long flowing hair down to the neck, on the hair bone for movement
      top(1.05, 0, (x, y, z) => [1.02, y < -0.3 && z > 0.2 ? 0.25 : 1, 1]);
      bd.blob(0, hy - S(0.03), hz - S(0.045), rx * 1.05, S(0.06), S(0.035), col, B.hair, 5, 12);
      break;
    default: // side part, medium length
      top(1.06, 0, (x, y, z) => [1.03, y < -0.05 ? 0.35 : 1, z > 0.75 && y < 0.25 ? 0.9 : 1]);
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

export { hexToRgb, lum };

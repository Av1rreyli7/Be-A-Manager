// Floodlights 3D match view: the stadium around the pitch.
// A two tier bowl that runs all the way round with rounded corners (stairs, vomitories, roofs, an LED ribbon on
// the front of the upper tier), LED boards round the pitch that page through plain words and flash on a goal,
// dugouts and a tunnel, a press box behind the gantry camera, four floodlight pylons with lamp banks, glare and
// light shafts in the haze, a night sky, and the crowd: one InstancedMesh of low poly people (one draw call)
// that bob, stand up for chances, jump for their team's goal and slump for the other's.
// three.js is handed in, never imported. With ctx.doc null (node tests) every texture is a small DataTexture.
//
// Axes: three.x = sim x, three.y = up, three.z = sim y. The main stand (+z) is where the broadcast camera sits:
// its upper tier is set back and kept low so it stays under the camera's line of sight, and the press box is
// behind the camera. Nothing here casts shadows. Draw calls: about 8.
import { HALF_L, HALF_W } from "../consts.mjs";

const BOARD_X = HALF_L + 6.5, BOARD_Z = HALF_W + 5.5, BOARD_H = 0.9; // same rectangle as the pitch run off
const EX = HALF_L + 10, EZ = HALF_W + 9.5, RC = 18, ARC_SEG = 12; // the front of the bowl: a rounded rectangle
const AISLE_P = 12, AISLE_W = 1.2, SEAT = 0.54;
const LOW_ROWS = 24, LOW_DEPTH = 0.8, LOW_H0 = 0.9, UP_ROWS = 18;
const LED_PERIOD = 28.8, LED_ADS = 6; // one pass of the LED strip covers 28.8 m of boards
const PYLON_R = 72, PYLON_H = 62;
const VOLT = "#d0e85c";
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

// the lower tier is the same all round: row front edges (metres out from the front wall) and tread heights
const lowD = [], lowH = [];
{
  let h = LOW_H0;
  for (let r = 0; r <= LOW_ROWS; r++) { lowD.push(0.3 + r * LOW_DEPTH); lowH.push(h); h += 0.34 + (0.16 * r) / (LOW_ROWS - 1); }
}
const LOW_BACK = 0.3 + LOW_ROWS * LOW_DEPTH, LOW_TOP = lowH[LOW_ROWS - 1];

// the cross section above the lower tier, m 0 for a normal stand and 1 for the main stand (blended on corners)
function profile(m) {
  const L = (a, b) => a + (b - a) * m;
  const p = { m, fasciaD: L(15.5, 23), fasciaBot: L(12.6, 11.5), fasciaTop: L(14.4, 12.9), upDepth: L(0.8, 0.85), upD: [], upH: [] };
  const r0 = L(0.56, 0.55), r1 = L(0.68, 0.55);
  let h = p.fasciaTop;
  for (let r = 0; r <= UP_ROWS; r++) { p.upD.push(p.fasciaD + 0.3 + r * p.upDepth); p.upH.push(h); h += r0 + ((r1 - r0) * r) / (UP_ROWS - 1); }
  p.upBack = p.fasciaD + 0.3 + UP_ROWS * p.upDepth;
  p.upTop = p.upH[UP_ROWS - 1];
  p.backD = p.upBack + (60 - p.upBack) * m;
  p.soffBH = p.upTop - 2.6;
  p.roofFD = L(-1, 2); p.roofFH = L(31.5, 38.5); p.roofBD = p.backD + 0.5; p.roofBH = L(33, 40);
  return p;
}
const soffAt = (p, d) => p.fasciaBot + (p.soffBH - p.fasciaBot) * clamp((d - p.fasciaD) / (p.upBack - p.fasciaD), 0, 1);

// the bowl's front line, sampled: straights are single segments, each corner a quarter arc
function bowlPath() {
  const pts = [], cx = EX - RC, cz = EZ - RC;
  const corners = [[cx, cz, 90, 0, 1, 0], [cx, -cz, 0, -90, 0, 0], [-cx, -cz, -90, -180, 0, 0], [-cx, cz, 180, 90, 0, 1]];
  for (const [ox, oz, a0, a1, m0, m1] of corners) {
    for (let k = 0; k <= ARC_SEG; k++) {
      const t = k / ARC_SEG, a = ((a0 + (a1 - a0) * t) * Math.PI) / 180, e = t * t * (3 - 2 * t);
      const nx = Math.cos(a), nz = Math.sin(a);
      pts.push({ x: ox + nx * RC, z: oz + nz * RC, nx, nz, m: m0 + (m1 - m0) * e, s: 0 });
    }
  }
  let s = 0;
  for (let i = 1; i < pts.length; i++) { s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); pts[i].s = s; }
  const total = s + Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].z - pts[pts.length - 1].z);
  return { pts, total };
}

// a flat shaded quad builder: positions, normals, colours (linear, may go above 1 for lights) and uvs
function builder() {
  // typed arrays that double when full, so a big build makes little garbage
  let cap = 2048, P = new Float32Array(cap * 3), N = new Float32Array(cap * 3), C = new Float32Array(cap * 3), U = new Float32Array(cap * 2), I = new Uint32Array(cap * 1.5);
  let nv = 0, ni = 0;
  const grow = (a, k) => { const b2 = new a.constructor(cap * k); b2.set(a); return b2; };
  const UV0 = [[0.5, 0.75], [0.5, 0.75], [0.5, 0.75], [0.5, 0.75]];
  const b = {
    // a, b, c, d go round the quad; hint is roughly the way it should face
    quad(a, bb, c, d, col, uv, hint) {
      const ex = c[0] - a[0], ey = c[1] - a[1], ez = c[2] - a[2];
      const fx = d[0] - bb[0], fy = d[1] - bb[1], fz = d[2] - bb[2];
      let nx = ey * fz - ez * fy, ny = ez * fx - ex * fz, nz = ex * fy - ey * fx;
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (l < 1e-7) return;
      nx /= l; ny /= l; nz /= l;
      let q1 = bb, q3 = d, uvs = uv || UV0, u1 = uvs[1], u3 = uvs[3];
      if (hint && nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) { q1 = d; q3 = bb; u1 = uvs[3]; u3 = uvs[1]; nx = -nx; ny = -ny; nz = -nz; }
      if (nv + 4 > cap) { cap *= 2; P = grow(P, 3); N = grow(N, 3); C = grow(C, 3); U = grow(U, 2); I = grow(I, 1.5); }
      const qs = [a, q1, c, q3], us = [uvs[0], u1, uvs[2], u3];
      for (let k = 0; k < 4; k++) {
        const o = (nv + k) * 3, q = qs[k];
        P[o] = q[0]; P[o + 1] = q[1]; P[o + 2] = q[2];
        N[o] = nx; N[o + 1] = ny; N[o + 2] = nz;
        C[o] = col[0]; C[o + 1] = col[1]; C[o + 2] = col[2];
        U[(nv + k) * 2] = us[k][0]; U[(nv + k) * 2 + 1] = us[k][1];
      }
      I[ni] = nv; I[ni + 1] = nv + 1; I[ni + 2] = nv + 2; I[ni + 3] = nv; I[ni + 4] = nv + 2; I[ni + 5] = nv + 3;
      ni += 6; nv += 4;
    },
    // a box from a centre and three half axes
    obox(c, A, B, Cv, col) {
      const pt = (sa, sb, sc) => [c[0] + A[0] * sa + B[0] * sb + Cv[0] * sc, c[1] + A[1] * sa + B[1] * sb + Cv[1] * sc, c[2] + A[2] * sa + B[2] * sb + Cv[2] * sc];
      for (const s of [-1, 1]) {
        b.quad(pt(s, -1, -1), pt(s, 1, -1), pt(s, 1, 1), pt(s, -1, 1), col, null, [A[0] * s, A[1] * s, A[2] * s]);
        b.quad(pt(-1, s, -1), pt(1, s, -1), pt(1, s, 1), pt(-1, s, 1), col, null, [B[0] * s, B[1] * s, B[2] * s]);
        b.quad(pt(-1, -1, s), pt(1, -1, s), pt(1, 1, s), pt(-1, 1, s), col, null, [Cv[0] * s, Cv[1] * s, Cv[2] * s]);
      }
    },
    box(x0, y0, z0, x1, y1, z1, col) {
      b.obox([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [(x1 - x0) / 2, 0, 0], [0, (y1 - y0) / 2, 0], [0, 0, (z1 - z0) / 2], col);
    },
    // a square beam from a to b, w thick
    beam(a, c, w, col) {
      let dx = c[0] - a[0], dy = c[1] - a[1], dz = c[2] - a[2];
      const len = Math.hypot(dx, dy, dz);
      dx /= len; dy /= len; dz /= len;
      const rx = Math.abs(dy) < 0.9 ? 0 : 1, ry = Math.abs(dy) < 0.9 ? 1 : 0;
      let sx = dy * 0 - dz * ry, sy = dz * rx - dx * 0, sz = dx * ry - dy * rx;
      const sl = Math.hypot(sx, sy, sz); sx /= sl; sy /= sl; sz /= sl;
      const tx = sy * dz - sz * dy, ty = sz * dx - sx * dz, tz = sx * dy - sy * dx, h = w / 2;
      b.obox([(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2], [dx * len / 2, dy * len / 2, dz * len / 2], [sx * h, sy * h, sz * h], [tx * h, ty * h, tz * h], col);
    },
    count: () => nv,
    build(THREE) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(P.slice(0, nv * 3), 3));
      geo.setAttribute("normal", new THREE.BufferAttribute(N.slice(0, nv * 3), 3));
      geo.setAttribute("color", new THREE.BufferAttribute(C.slice(0, nv * 3), 3));
      geo.setAttribute("uv", new THREE.BufferAttribute(U.slice(0, nv * 2), 2));
      geo.setIndex(new THREE.BufferAttribute(nv > 65535 ? I.slice(0, ni) : Uint16Array.from(I.subarray(0, ni)), 1));
      geo.computeBoundingSphere();
      return geo;
    }
  };
  return b;
}

// one low poly spectator, seated, feet on the floor at y 0, facing +z (the pitch). aPart: 0 torso, 1 head,
// 2 left arm, 3 right arm, 4 legs. Eight shared corners a box, so the shading comes out soft and rounded.
function personGeometry(THREE) {
  const P = [], N = [], A = [], I = [];
  // skip: faces nobody sees, as a list like ["-y", "+y"]
  function box(x0, y0, z0, x1, y1, z1, part, top, skip) {
    const base = P.length / 3, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    for (let k = 0; k < 8; k++) {
      const sx = k & 1 ? 1 : -1, sy = k & 2 ? 1 : -1, sz = k & 4 ? 1 : -1;
      let x = sx > 0 ? x1 : x0, z = sz > 0 ? z1 : z0;
      if (sy > 0 && top) { x = cx + (x - cx) * top; z = cz + (z - cz) * top; }
      P.push(x, sy > 0 ? y1 : y0, z);
      const l = Math.hypot(sx, sy * 0.7, sz);
      N.push(sx / l, (sy * 0.7) / l, sz / l);
      A.push(part);
    }
    for (const [ab, o1, o2] of [[1, 2, 4], [2, 1, 4], [4, 1, 2]]) {
      for (const s of [0, 1]) {
        if (skip && skip.includes((s ? "+" : "-") + "xyz"[ab === 1 ? 0 : ab === 2 ? 1 : 2])) continue;
        const c = [0, o1, o1 | o2, o2].map(v => base + (s ? ab : 0) + v);
        const p = i => [P[c[i] * 3], P[c[i] * 3 + 1], P[c[i] * 3 + 2]];
        const p0 = p(0), p1 = p(1), p3 = p(3);
        const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2], vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
        const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
        const axis = ab === 1 ? 0 : ab === 2 ? 1 : 2;
        if (n[axis] * (s ? 1 : -1) > 0) I.push(c[0], c[1], c[2], c[0], c[2], c[3]);
        else I.push(c[0], c[2], c[1], c[0], c[3], c[2]);
      }
    }
  }
  box(-0.17, 0, 0.06, 0.17, 0.46, 0.3, 4, 0, ["-y", "+y"]);
  box(-0.18, 0.44, -0.13, 0.18, 1.0, 0.11, 0, 1.12, ["-y"]);
  box(-0.095, 1.03, -0.1, 0.095, 1.27, 0.1, 1, 0, ["-y"]);
  box(-0.29, 0.5, -0.06, -0.2, 0.98, 0.06, 2);
  box(0.2, 0.5, -0.06, 0.29, 0.98, 0.06, 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  geo.setAttribute("aPart", new THREE.Float32BufferAttribute(A, 1));
  geo.setIndex(I);
  return geo;
}

// ---------- crowd placement (small top level functions, so they run fast on the first build) ----------
const DARKS = [[0.01, 0.01, 0.012], [0.008, 0.012, 0.035], [0.035, 0.036, 0.04], [0.11, 0.11, 0.12], [0.03, 0.034, 0.018], [0.05, 0.01, 0.012], [0.22, 0.18, 0.12], [0.5, 0.5, 0.5]];
function pushPerson(buf, x, y, z, th, team, light, r, g, b) {
  if (buf.n >= buf.cap) { buf.cap *= 2; const b2 = new Float32Array(buf.cap * 9); b2.set(buf.F); buf.F = b2; }
  const F = buf.F, o = buf.n * 9;
  F[o] = x; F[o + 1] = y; F[o + 2] = z; F[o + 3] = th; F[o + 4] = team; F[o + 5] = light; F[o + 6] = r; F[o + 7] = g; F[o + 8] = b;
  buf.n++;
}
function inVom(vomF, x, z, nx, nz) {
  for (let i = 0; i < vomF.length; i += 6) if (nx * vomF[i + 2] + nz * vomF[i + 3] > 0.9 && Math.abs((x - vomF[i]) * vomF[i + 4] + (z - vomF[i + 1]) * vomF[i + 5]) < 1.75) return true;
  return false;
}
// a person on every seat but the aisles, the vomitories and a few empty ones. Team codes: 0 home, 1 away,
// 0.5 neutral. Shirts: the team's first or second colour, or a dark coat.
function seatCrowd(pts, prof, total, rnd, vomF, kitRGB, rest, mainSide) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const A = pts[i], B = pts[(i + 1) % n], pa = prof[i], pb = prof[(i + 1) % n];
    const sA = A.s, sB = i + 1 < n ? B.s : total, fD = (pa.fasciaD + pb.fasciaD) / 2;
    for (let upper = 0; upper < 2; upper++) {
      const rows = upper ? UP_ROWS : LOW_ROWS;
      for (let r = 0; r < rows; r++) {
        const da = (upper ? pa.upD[r] : lowD[r]) + 0.5, db = (upper ? pb.upD[r] : lowD[r]) + 0.5;
        const ha = upper ? pa.upH[r] : lowH[r], hb = upper ? pb.upH[r] : lowH[r];
        const rowLight = upper ? 0.92 - (0.3 * r) / (UP_ROWS - 1) : 1 - 0.38 * clamp((da - 0.5 - fD) / 3, 0, 1);
        seatRow(A, B, sA, sB, da, db, ha, hb, rowLight, upper === 1, !upper && r >= 8 && r <= 15, rnd, vomF, kitRGB, rest, mainSide);
      }
    }
  }
}
// one row of seats between two path samples (its own function, so the engine optimises it once and keeps it)
function seatRow(A, B, sA, sB, da, db, ha, hb, rowLight, upper, checkVom, rnd, vomF, kitRGB, rest, mainSide) {
  const ax = A.x + A.nx * da, az = A.z + A.nz * da, bx = B.x + B.nx * db, bz = B.z + B.nz * db;
  const cnt = Math.max(1, Math.floor(Math.sqrt((bx - ax) * (bx - ax) + (bz - az) * (bz - az)) / SEAT));
  for (let k = 0; k < cnt; k++) {
    const t = (k + 0.5) / cnt, s = sA + (sB - sA) * t;
    if (((s % AISLE_P) + AISLE_P) % AISLE_P < AISLE_W + 0.15) continue;
    const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    let nx = A.nx + (B.nx - A.nx) * t, nz = A.nz + (B.nz - A.nz) * t;
    const nl = Math.sqrt(nx * nx + nz * nz); nx /= nl; nz /= nl;
    if (checkVom && inVom(vomF, x, z, nx, nz)) continue;
    // two random words give the eight small random numbers a seat needs
    const w1 = (rnd() * 4294967296) >>> 0, w2 = (rnd() * 4294967296) >>> 0;
    if ((w1 & 255) / 256 < (upper ? 0.07 : 0.05)) continue;
    const q = ((w1 >>> 8) & 255) / 256, q2 = ((w1 >>> 16) & 255) / 256, q3 = (w1 >>> 24) / 256;
    const f0 = (w2 & 255) / 256, f1 = ((w2 >>> 8) & 255) / 256, f2 = ((w2 >>> 16) & 255) / 256, f3 = (w2 >>> 24) / 256;
    // the away fans fill the west end (upper tier, and the lower tier's north half)
    const awayEnd = x < -(EX - 6) && (upper || z > 0);
    const team = awayEnd ? (q < 0.9 ? 1 : 0.5) : q < 0.8 ? 0 : q < 0.95 ? 0.5 : 1;
    let cr, cg, cb, mul;
    if ((team === 0 || team === 1) && q2 < 0.56) {
      const o = (team * 2 + (q2 < 0.42 ? 0 : 1)) * 3;
      mul = 0.82 + q3 * 0.26; cr = kitRGB[o]; cg = kitRGB[o + 1]; cb = kitRGB[o + 2];
    } else {
      const d = DARKS[Math.min(DARKS.length - 1, (f0 * f1 * DARKS.length * 1.4) | 0)];
      mul = 0.85 + q3 * 0.3; cr = d[0]; cg = d[1]; cb = d[2];
    }
    const jt = (f2 - 0.5) * 0.08;
    pushPerson(nz > 0.5 ? mainSide : rest, x + nz * jt, ha + (hb - ha) * t, z - nx * jt, Math.atan2(-nx, -nz) + (f3 - 0.5) * 0.3, team, rowLight * (0.74 + f1 * 0.1), cr * mul, cg * mul, cb * mul);
  }
}
// write the people into the instance matrices and attributes; every buffer but the first is shuffled so a lower
// count still spreads evenly over its stands
function writeCrowd(IM, aShirt, aFan, bufs, rnd) {
  let k = 0;
  for (let bi = 0; bi < bufs.length; bi++) {
    const { F, n } = bufs[bi], order = new Uint32Array(n);
    for (let i = 0; i < n; i++) order[i] = i;
    if (bi > 0) for (let i = n - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0, tmp = order[i]; order[i] = order[j]; order[j] = tmp; }
    for (let i = 0; i < n; i++, k++) {
      const o = order[i] * 9;
      const w = (rnd() * 4294967296) >>> 0, kid = F[o + 4] < 1.5 && (w & 255) < 8;
      const sh = kid ? 0.78 : 0.92 + (((w >>> 8) & 255) / 256) * 0.16, sw = kid ? 0.82 : 0.9 + (((w >>> 16) & 255) / 256) * 0.22;
      // a turn about y, a scale and a position, straight into the instance matrix (column major)
      const c = Math.cos(F[o + 3]), s = Math.sin(F[o + 3]), m = k * 16;
      IM[m] = c * sw; IM[m + 1] = 0; IM[m + 2] = -s * sw; IM[m + 3] = 0;
      IM[m + 4] = 0; IM[m + 5] = sh; IM[m + 6] = 0; IM[m + 7] = 0;
      IM[m + 8] = s * sw; IM[m + 9] = 0; IM[m + 10] = c * sw; IM[m + 11] = 0;
      IM[m + 12] = F[o]; IM[m + 13] = F[o + 1]; IM[m + 14] = F[o + 2]; IM[m + 15] = 1;
      aShirt[k * 3] = F[o + 6]; aShirt[k * 3 + 1] = F[o + 7]; aShirt[k * 3 + 2] = F[o + 8];
      aFan[k * 4] = F[o + 4]; aFan[k * 4 + 1] = rnd(); aFan[k * 4 + 2] = rnd(); aFan[k * 4 + 3] = F[o + 5];
    }
  }
}

// ---------- the crowd's vertex work (inside a Lambert material, so the scene lights and fog still apply) ----------
const FAN_PARS = `
uniform float flTime;
uniform vec2 flJump;
uniform vec2 flSlump;
uniform float flStand;
uniform float flArms;
uniform float flFlash;
uniform vec2 flWave;
attribute float aPart;
attribute vec3 aShirt;
attribute vec4 aFan;
varying vec3 vFanCol;
varying float vFanFlash;
`;
const FAN_VERT = `
  float fTeam = aFan.x, fS = aFan.y, fS2 = aFan.z;
  float fStaff = step(1.5, fTeam);
  float fStaffUp = fStaff * (1.0 - step(2.5, fTeam));
  float fIsH = step(fTeam, 0.25), fIsA = step(0.75, fTeam) * (1.0 - fStaff), fIsN = (1.0 - fIsH - fIsA) * (1.0 - fStaff);
  float fJump = fIsH * flJump.x + fIsA * flJump.y + fIsN * 0.35 * max(flJump.x, flJump.y);
  float fSlump = fIsH * flSlump.x + fIsA * flSlump.y;
  vec2 fIp = instanceMatrix[3].xz;
  float fWd = abs(mod(atan(fIp.y, fIp.x) - flWave.x + 3.14159265, 6.2831853) - 3.14159265);
  float fWave = flWave.y * (1.0 - smoothstep(0.0, 0.42, fWd + (fS - 0.5) * 0.12)) * (1.0 - fStaff);
  float fStand = max(smoothstep(fS * 0.5, fS * 0.5 + 0.35, flStand), max(smoothstep(0.15, 0.5, fJump - fS * 0.15), fWave));
  fStand *= 1.0 - fSlump * 0.9;
  fStand = mix(fStand * (1.0 - fStaff), 1.0, fStaffUp);
  float fBounce = fJump * max(0.0, sin(flTime * (8.0 + fS * 3.0) + fS2 * 6.2832)) * (0.1 + 0.14 * fS2);
  float fBob = sin(flTime * (1.2 + fS * 1.3) + fS2 * 37.0) * 0.015 * (1.0 + flStand) * (1.0 - fStaff);
  float fArms = clamp(max(fJump * step(0.2, fS2), max(flArms * step(0.5, fS), fWave * step(0.3, fS2))), 0.0, 1.0) * (1.0 - fStaff);
  vec3 fP = position;
  vec3 fN = normal;
  if (aPart > 3.5) {
    fP.y *= 1.0 + fStand * 0.88;
    fP.z -= fStand * 0.17;
  } else {
    if (aPart > 1.5) {
      float sg = aPart < 2.5 ? -1.0 : 1.0;
      vec2 pv = vec2(0.245 * sg, 0.97);
      vec2 o = fP.xy - pv;
      float a = fArms * (2.55 + 0.35 * sin(flTime * (5.0 + fS * 4.0) + fS2 * 20.0)) * sg;
      float ca = cos(a), sa = sin(a);
      fP.xy = pv + vec2(ca * o.x - sa * o.y, sa * o.x + ca * o.y);
      fN.xy = vec2(ca * fN.x - sa * fN.y, sa * fN.x + ca * fN.y);
    }
    fP.y += fStand * 0.4;
    fP.z += fSlump * (fP.y - 0.44) * 0.3;
  }
  fP.y += fBounce + fBob;
  float hs = fract(fS * 13.7 + fS2 * 5.3), hh = fract(fS * 7.31 + fS2 * 3.17), ht = fract(fS * 5.13 + 0.37);
  vec3 skin = hs < 0.22 ? vec3(0.07, 0.04, 0.025) : (hs < 0.5 ? vec3(0.3, 0.16, 0.09) : vec3(0.6, 0.39, 0.29));
  vec3 hair = hh < 0.55 ? vec3(0.018, 0.014, 0.012) : (hh < 0.75 ? vec3(0.09, 0.055, 0.03) : (hh < 0.85 ? vec3(0.42, 0.31, 0.15) : (hh < 0.92 ? vec3(0.3) : aShirt)));
  vec3 legs = ht < 0.5 ? vec3(0.018, 0.018, 0.022) : (ht < 0.8 ? vec3(0.045, 0.06, 0.1) : vec3(0.1, 0.085, 0.07));
  vec3 fCol = aShirt;
  if (aPart > 3.5) fCol = legs;
  else if (aPart > 1.5) fCol = position.y < 0.6 ? skin : aShirt;
  else if (aPart > 0.5) fCol = position.y > 1.2 ? hair : skin;
  vFanCol = fCol * aFan.w;
  vFanFlash = (aPart > 1.5 && aPart < 3.5 && position.y < 0.6 && flFlash > 0.0) ? step(1.0 - flFlash * 0.012, fract(sin(fS * 91.7 + fS2 * 13.1 + floor(flTime * 9.0) * 0.618) * 43758.55)) * (1.0 - fStaff) : 0.0;
  vec3 objectNormal = fN;
  #ifdef USE_TANGENT
    vec3 objectTangent = vec3(tangent.xyz);
  #endif
`;

// additive light: haze shafts under the lamps and the LED spill on the grass, faded by the fog, softer at the
// edges of the shafts
const GLOW_VERT = `
#include <common>
#include <fog_pars_vertex>
attribute vec3 aCol;
attribute float aSoft;
varying vec3 vCol;
varying float vSoft;
varying vec3 vN;
varying vec3 vV;
void main() {
  vCol = aCol; vSoft = aSoft;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;
const GLOW_FRAG = `
#include <common>
#include <fog_pars_fragment>
uniform float flGain;
varying vec3 vCol;
varying float vSoft;
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = abs(dot(normalize(vN), normalize(vV)));
  vec3 c = vCol * mix(1.0, f * f, vSoft) * flGain;
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      float ff = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      float ff = smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    c *= 1.0 - ff;
  #endif
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}
`;
// lamp glare: camera facing quads, brightest when the camera looks into the lamp's beam, with a soft
// horizontal streak on the big halos like a broadcast lens
const GLARE_VERT = `
uniform float flTime;
attribute vec4 aG;
attribute vec3 aAim;
varying vec2 vUv;
varying float vI;
varying float vKind;
void main() {
  vec3 c = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 toCam = normalize(cameraPosition - c);
  float facing = max(dot(aAim, toCam), 0.0);
  float vis = aG.z < 0.5 ? 0.3 + 0.7 * pow(facing, 3.0) : pow(facing, 5.0);
  vI = aG.y * vis * (0.97 + 0.03 * sin(flTime * 13.0 + aG.w));
  vec4 mv = viewMatrix * vec4(c, 1.0);
  mv.xyz += normalize(-mv.xyz) * aG.x * 0.5;
  mv.xy += position.xy * aG.x;
  vUv = position.xy;
  vKind = aG.z;
  gl_Position = projectionMatrix * mv;
}
`;
const GLARE_FRAG = `
varying vec2 vUv;
varying float vI;
varying float vKind;
void main() {
  float r = length(vUv) * 2.0;
  float core = exp(-r * r * 10.0);
  float halo = exp(-r * 3.4) * 0.3;
  float streak = vKind > 0.5 ? exp(-abs(vUv.y) * 70.0) * (1.0 - smoothstep(0.0, 0.5, abs(vUv.x))) * 0.6 : 0.0;
  float a = (core + halo) * (1.0 - smoothstep(0.8, 1.0, r)) + streak;
  gl_FragColor = vec4(vec3(1.0, 0.95, 0.86) * a * vI, 1.0);
  #include <colorspace_fragment>
}
`;
const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const SKY_FRAG = `
uniform float flTime;
varying vec3 vDir;
float flH3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main() {
  vec3 d = normalize(vDir);
  float e = clamp(d.y, -0.2, 1.0);
  vec3 col = mix(vec3(0.03, 0.036, 0.052), vec3(0.003, 0.005, 0.011), pow(max(e, 0.0), 0.45));
  col += vec3(0.05, 0.045, 0.036) * exp(-max(e, 0.0) * 7.0) * 0.55;
  float s = flH3(floor(d * 1400.0));
  col += vec3(0.55, 0.6, 0.75) * step(0.9982, s) * smoothstep(0.1, 0.4, e) * (0.55 + 0.45 * sin(flTime * (0.8 + s * 3.0) + s * 60.0));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createStadium(THREE, ctx) {
  ctx = ctx || {};
  const doc = ctx.doc || null;
  let quality = clamp(ctx.quality == null ? 2 : ctx.quality | 0, 0, 2);
  const group = new THREE.Group();
  group.name = "stadium";
  const geos = [], mats = [], texs = [];
  const G = x => (geos.push(x), x), M = x => (mats.push(x), x), T = x => (texs.push(x), x);
  const rnd = rng(77031);
  let dead = false;

  // ---------- colours ----------
  const kitIn = Array.isArray(ctx.kits) ? ctx.kits : [];
  const FALLBACK = [["#c8102e", "#ffffff"], ["#1b2430", "#ffffff"]];
  const kits = [0, 1].map(t => [0, 1].map(k => {
    const c = new THREE.Color(FALLBACK[t][k]);
    const v = kitIn[t] && kitIn[t][k];
    if (v != null) { try { c.set(v); } catch (e) { /* keep the fallback */ } }
    return c;
  }));
  const lum = c => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const css = c => "#" + c.getHexString();
  const seatCol = kits[0][0].clone().lerp(new THREE.Color(0.02, 0.022, 0.026), 0.62);
  const C_WALL = [0.045, 0.05, 0.058], C_CAP = [0.09, 0.095, 0.1], C_FLOOR = [0.06, 0.062, 0.066], C_DARK = [0.02, 0.022, 0.026];
  const C_SOFF = [0.035, 0.038, 0.045], C_ROOF = [0.05, 0.055, 0.062], C_ROOFTOP = [0.12, 0.125, 0.13], C_STEEL = [0.3, 0.31, 0.33];
  const C_BOARD = [0.015, 0.016, 0.018], C_LAMPBODY = [0.08, 0.085, 0.09], C_RIB = [0.3, 0.36, 0.05];
  const L_CONC = [1.1, 1.0, 0.82], L_VOM = [0.07, 0.065, 0.058], L_ROOF = [2.6, 2.45, 2.1], L_LAMP = [6, 5.7, 5.0], L_WIN = [0.9, 0.8, 0.62], L_TUN = [0.3, 0.27, 0.22];
  const WHITE = [1, 1, 1];

  // ---------- textures ----------
  // seats atlas: the bottom half is one stair period (aisle at the start, seats after), the top half is plain
  // white for everything else that shares the material
  function seatAtlas() {
    const W = 256, H = 64, d = new Uint8Array(W * H * 4);
    const sc = seatCol.clone().convertLinearToSRGB();
    const aisleU = AISLE_W / AISLE_P;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 4, u = (x + 0.5) / W;
        let r = 255, g = 255, b = 255;
        if (y < 32) {
          if (u < aisleU) { const v = y < 3 ? 150 : 86; r = v; g = v; b = v + 4; }
          else if (y < 4) { r = 52; g = 54; b = 58; }
          else if (y >= 31) { r = 18; g = 19; b = 22; }
          else {
            let k = y >= 22 ? 1.22 : 1;
            if ((u * AISLE_P) % 0.5 < 0.06) k *= 0.6;
            r = clamp(sc.r * 255 * k, 0, 255); g = clamp(sc.g * 255 * k, 0, 255); b = clamp(sc.b * 255 * k, 0, 255);
          }
        }
        d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
      }
    }
    const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  }
  const atlas = T(seatAtlas());

  // LED strip: three rows (the ads, a home goal, an away goal), six panels a row
  const FONT = '"Chakra Petch", "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
  const contrastCss = c => (lum(c) > 0.3 ? "#05070b" : "#ffffff");
  const brightCss = (a, b) => (lum(a) > 0.04 ? css(a) : lum(b) > 0.2 ? css(b) : "#ffffff");
  const ADS = [
    { bg: "#05070b", fg: VOLT, text: "FLOODLIGHTS" },
    { bg: VOLT, fg: "#05070b", text: "MATCH NIGHT" },
    { bg: css(kits[0][0]), fg: contrastCss(kits[0][0]), text: "BE-A-MANAGER" },
    { bg: "#0a1424", fg: "#ffffff", text: "LIVE FOOTBALL" },
    { bg: "#f1f3f5", fg: "#05070b", text: "FLOODLIGHTS" },
    { bg: css(kits[1][0]), fg: contrastCss(kits[1][0]), text: "MATCH NIGHT" }
  ];
  function drawLed(c, W, RH) {
    const SW = W / LED_ADS;
    const text = (s, x, y, w, h, size, spacing, fill) => {
      c.fillStyle = fill;
      c.font = "700 " + Math.round(size) + "px " + FONT;
      c.textAlign = "center"; c.textBaseline = "middle";
      try { c.letterSpacing = Math.round(spacing) + "px"; } catch (e) { /* older canvas */ }
      const tw = c.measureText ? c.measureText(s).width : w;
      const sx = tw > w ? w / tw : 1;
      c.save(); c.translate(x, y); c.scale(sx, 1); c.fillText(s, 0, 0); c.restore();
    };
    const slash = (x, y, h, fill) => { c.fillStyle = fill; c.beginPath(); c.moveTo(x, y + h); c.lineTo(x + 36, y); c.lineTo(x + 52, y); c.lineTo(x + 16, y + h); c.closePath(); c.fill(); };
    for (let k = 0; k < LED_ADS; k++) {
      const ad = ADS[k], x = k * SW;
      c.fillStyle = ad.bg; c.fillRect(x, 0, SW, RH);
      slash(x + 22, 0, RH, ad.bg === VOLT ? "#05070b" : VOLT);
      c.fillStyle = "rgba(255,255,255,0.13)"; c.fillRect(x, 0, SW, 2); c.fillRect(x, RH - 2, SW, 2);
      text(ad.text, x + SW / 2 + 22, RH * 0.53, SW - 150, RH, RH * 0.56, RH * 0.06, ad.fg);
    }
    for (let t = 0; t < 2; t++) {
      const y = (t + 1) * RH, k1 = kits[t][0], k2 = kits[t][1];
      for (let k = 0; k < LED_ADS; k++) {
        const x = k * SW, solid = k % 2 === 0;
        c.fillStyle = solid ? css(k1) : "#05070b"; c.fillRect(x, y, SW, RH);
        slash(x + 22, y, RH, VOLT); slash(x + SW - 74, y, RH, VOLT);
        text("GOAL", x + SW / 2, y + RH * 0.54, SW - 200, RH, RH * 0.74, RH * 0.14, solid ? contrastCss(k1) : brightCss(k1, k2));
      }
    }
  }
  function ledTexture() {
    if (doc && doc.createElement) {
      try {
        const cv = doc.createElement("canvas");
        cv.width = 4096; cv.height = 384;
        const c = cv.getContext && cv.getContext("2d");
        if (c && c.fillRect) {
          drawLed(c, 4096, 128);
          const t = new THREE.CanvasTexture(cv);
          t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = 8;
          // redraw once the page fonts have loaded, so the boards use Chakra Petch
          if (doc.fonts && doc.fonts.ready && doc.fonts.ready.then) doc.fonts.ready.then(() => { if (dead) return; try { drawLed(c, 4096, 128); t.needsUpdate = true; } catch (e) { /* keep the first draw */ } });
          return t;
        }
      } catch (e) { /* fall through to the plain blocks */ }
    }
    // no canvas: plain colour blocks, rows bottom to top are away goal, home goal, ads
    const W = LED_ADS * 4, H = 6, d = new Uint8Array(W * H * 4), tmp = new THREE.Color();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const row = 2 - ((y / 2) | 0), k = (x / 4) | 0, o = (y * W + x) * 4;
        if (row === 0) tmp.set(ADS[k].bg); else tmp.copy(kits[row - 1][k % 2]);
        const s = tmp.clone().convertLinearToSRGB();
        d[o] = s.r * 255; d[o + 1] = s.g * 255; d[o + 2] = s.b * 255; d[o + 3] = 255;
      }
    }
    const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  }
  const ledTex = T(ledTexture());
  ledTex.wrapS = THREE.RepeatWrapping; ledTex.wrapT = THREE.ClampToEdgeWrapping;
  ledTex.repeat.set(1, 1 / 3);
  ledTex.offset.set(0, 2 / 3);

  // ---------- builders: one per material ----------
  const S = builder(); // stands, roofs, pylons, board bodies, dugouts (Lambert, seat atlas, vertex colours)
  const E = builder(); // lamps, light strips, windows (unlit, bright)
  const Ld = builder(); // LED faces: boards and the ribbon on the upper tier
  const Gl = builder(); // glass: dugout canopies
  const gP = [], gN = [], gC = [], gS = [], gI = []; // additive glow
  function glowQuad(a, b, c, d, ca, cb, cc, cd, soft) {
    const ex = c[0] - a[0], ey = c[1] - a[1], ez = c[2] - a[2], fx = d[0] - b[0], fy = d[1] - b[1], fz = d[2] - b[2];
    let nx = ey * fz - ez * fy, ny = ez * fx - ex * fz, nz = ex * fy - ey * fx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const v = gP.length / 3;
    for (const [p, col] of [[a, ca], [b, cb], [c, cc], [d, cd]]) { gP.push(p[0], p[1], p[2]); gN.push(nx, ny, nz); gC.push(col[0], col[1], col[2]); gS.push(soft); }
    gI.push(v, v + 1, v + 2, v, v + 2, v + 3);
  }

  // ---------- the bowl ----------
  const { pts, total } = bowlPath();
  const n = pts.length;
  const prof = pts.map(p => profile(p.m));
  const UP = [0, 1, 0], DOWN = [0, -1, 0];
  const at = (Q, d, h) => [Q.x + Q.nx * d, h, Q.z + Q.nz * d];
  const vom = [];
  for (const x of [-30, 0, 30]) vom.push({ x, z: -EZ, nx: 0, nz: -1, tx: 1, tz: 0 });
  for (const x of [-30, 30]) vom.push({ x, z: EZ, nx: 0, nz: 1, tx: 1, tz: 0 });
  for (const sx of [-1, 1]) for (const z of [-12, 12]) vom.push({ x: sx * EX, z, nx: sx, nz: 0, tx: 0, tz: 1 });

  for (let i = 0; i < n; i++) {
    const A = pts[i], B = pts[(i + 1) % n], pa = prof[i], pb = prof[(i + 1) % n];
    const sA = A.s, sB = i + 1 < n ? B.s : total;
    const IN = [-(A.nx + B.nx) / 2, 0, -(A.nz + B.nz) / 2], OUT = [-IN[0], 0, -IN[2]];
    const u0 = sA / AISLE_P, u1 = sB / AISLE_P;
    const treadUv = [[u0, 0.02], [u1, 0.02], [u1, 0.47], [u0, 0.47]], riserUv = [[u0, 0.03], [u1, 0.03], [u1, 0.03], [u0, 0.03]];
    const fD = (pa.fasciaD + pb.fasciaD) / 2;
    // lower tier: the front wall, then the rows
    const pH = LOW_H0 + 1;
    S.quad(at(A, 0, 0), at(B, 0, 0), at(B, 0, pH), at(A, 0, pH), C_WALL, null, IN);
    S.quad(at(A, 0, pH), at(B, 0, pH), at(B, 0.3, pH), at(A, 0.3, pH), C_CAP, null, UP);
    S.quad(at(A, 0.3, LOW_H0), at(B, 0.3, LOW_H0), at(B, 0.3, pH), at(A, 0.3, pH), C_WALL, null, OUT);
    for (let r = 0; r < LOW_ROWS; r++) {
      const d0 = lowD[r], d1 = d0 + LOW_DEPTH, h = lowH[r];
      const sh = 1 - 0.38 * clamp((d0 - fD) / 3, 0, 1);
      S.quad(at(A, d0, h), at(B, d0, h), at(B, d1, h), at(A, d1, h), [sh, sh, sh], treadUv, UP);
      if (r < LOW_ROWS - 1) S.quad(at(A, d1, h), at(B, d1, h), at(B, d1, lowH[r + 1]), at(A, d1, lowH[r + 1]), [sh * 0.75, sh * 0.75, sh * 0.75], riserUv, IN);
    }
    // the concourse at the back of the lower tier, with a strip of lights
    const cA = Math.max(LOW_BACK, pa.fasciaD), cB = Math.max(LOW_BACK, pb.fasciaD);
    const wA = soffAt(pa, cA), wB = soffAt(pb, cB);
    S.quad(at(A, LOW_BACK, LOW_TOP), at(B, LOW_BACK, LOW_TOP), at(B, cB, LOW_TOP), at(A, cA, LOW_TOP), C_FLOOR, null, UP);
    S.quad(at(A, cA, LOW_TOP), at(B, cB, LOW_TOP), at(B, cB, wB), at(A, cA, wA), C_DARK, null, IN);
    const lA = LOW_TOP + (wA - LOW_TOP) * 0.6, lB = LOW_TOP + (wB - LOW_TOP) * 0.6;
    E.quad(at(A, cA - 0.03, lA), at(B, cB - 0.03, lB), at(B, cB - 0.03, lB + 0.12), at(A, cA - 0.03, lA + 0.12), L_CONC, null, IN);
    // the upper tier front: LED ribbon, a parapet, the soffit underneath
    const rA = (total - sA) / (LED_PERIOD * 2), rB = (total - sB) / (LED_PERIOD * 2);
    Ld.quad(at(A, pa.fasciaD, pa.fasciaBot), at(B, pb.fasciaD, pb.fasciaBot), at(B, pb.fasciaD, pb.fasciaTop), at(A, pa.fasciaD, pa.fasciaTop), WHITE, [[rA, 0], [rB, 0], [rB, 1], [rA, 1]], IN);
    const tA = pa.fasciaTop + 0.9, tB = pb.fasciaTop + 0.9;
    S.quad(at(A, pa.fasciaD, pa.fasciaTop), at(B, pb.fasciaD, pb.fasciaTop), at(B, pb.fasciaD, tB), at(A, pa.fasciaD, tA), C_WALL, null, IN);
    S.quad(at(A, pa.fasciaD, tA), at(B, pb.fasciaD, tB), at(B, pb.fasciaD + 0.3, tB), at(A, pa.fasciaD + 0.3, tA), C_CAP, null, UP);
    S.quad(at(A, pa.fasciaD + 0.3, pa.fasciaTop), at(B, pb.fasciaD + 0.3, pb.fasciaTop), at(B, pb.fasciaD + 0.3, tB), at(A, pa.fasciaD + 0.3, tA), C_WALL, null, OUT);
    S.quad(at(A, pa.fasciaD, pa.fasciaBot), at(B, pb.fasciaD, pb.fasciaBot), at(B, pb.upBack, pb.soffBH), at(A, pa.upBack, pa.soffBH), C_SOFF, null, DOWN);
    // upper rows, darker toward the back under the roof
    for (let r = 0; r < UP_ROWS; r++) {
      const a0 = pa.upD[r], a1 = a0 + pa.upDepth, b0 = pb.upD[r], b1 = b0 + pb.upDepth, ha = pa.upH[r], hb = pb.upH[r];
      const sh = 0.94 - (0.3 * r) / (UP_ROWS - 1);
      S.quad(at(A, a0, ha), at(B, b0, hb), at(B, b1, hb), at(A, a1, ha), [sh, sh, sh], treadUv, UP);
      if (r < UP_ROWS - 1) S.quad(at(A, a1, ha), at(B, b1, hb), at(B, b1, pb.upH[r + 1]), at(A, a1, pa.upH[r + 1]), [sh * 0.75, sh * 0.75, sh * 0.75], riserUv, IN);
    }
    // the gantry deck on the main stand (zero wide elsewhere), the back wall, the roof
    S.quad(at(A, pa.upBack, pa.upTop), at(B, pb.upBack, pb.upTop), at(B, pb.backD, pb.upTop), at(A, pa.backD, pa.upTop), C_FLOOR, null, UP);
    S.quad(at(A, pa.backD, pa.upTop), at(B, pb.backD, pb.upTop), at(B, pb.backD, pb.roofBH), at(A, pa.backD, pa.roofBH), C_DARK, null, IN);
    S.quad(at(A, pa.roofFD, pa.roofFH), at(B, pb.roofFD, pb.roofFH), at(B, pb.roofBD, pb.roofBH), at(A, pa.roofBD, pa.roofBH), C_ROOF, null, DOWN);
    S.quad(at(A, pa.roofFD, pa.roofFH + 1.3), at(B, pb.roofFD, pb.roofFH + 1.3), at(B, pb.roofBD, pb.roofBH + 1.3), at(A, pa.roofBD, pa.roofBH + 1.3), C_ROOFTOP, null, UP);
    S.quad(at(A, pa.roofFD, pa.roofFH), at(B, pb.roofFD, pb.roofFH), at(B, pb.roofFD, pb.roofFH + 1.3), at(A, pa.roofFD, pa.roofFH + 1.3), C_ROOF, null, IN);
    E.quad(at(A, pa.roofFD + 0.4, pa.roofFH - 0.03), at(B, pb.roofFD + 0.4, pb.roofFH - 0.03), at(B, pb.roofFD + 1.0, pb.roofFH - 0.03), at(A, pa.roofFD + 1.0, pa.roofFH - 0.03), L_ROOF, null, DOWN);
  }

  // vomitories: dark mouths in the lower tier with low walls each side
  for (const v of vom) {
    const P = (t, d, h) => [v.x + v.tx * t + v.nx * d, h, v.z + v.tz * t + v.nz * d];
    const d0 = lowD[9], d1 = lowD[15], hb = lowH[9], ht = lowH[14] + 0.15, hw = 1.4;
    // the mouth shows a dimly lit passage, with a lit strip over it
    E.quad(P(-hw, d0, hb), P(hw, d0, hb), P(hw, d0, ht), P(-hw, d0, ht), L_VOM, null, [-v.nx, 0, -v.nz]);
    E.quad(P(-hw, d0 - 0.02, ht - 0.25), P(hw, d0 - 0.02, ht - 0.25), P(hw, d0 - 0.02, ht - 0.12), P(-hw, d0 - 0.02, ht - 0.12), L_CONC, null, [-v.nx, 0, -v.nz]);
    S.quad(P(-hw, d0, ht), P(hw, d0, ht), P(hw, d1, ht), P(-hw, d1, ht), C_CAP, null, UP);
    for (const sg of [-1, 1]) {
      for (const face of [-1, 1]) S.quad(P(sg * hw, d0, hb), P(sg * hw, d1, lowH[15]), P(sg * hw, d1, ht + 1), P(sg * hw, d0, ht + 1), C_WALL, null, [v.tx * face, 0, v.tz * face]);
    }
  }

  // ---------- LED boards round the pitch ----------
  const SPILL = [0.016, 0.018, 0.021], NONE = [0, 0, 0];
  const runs = [
    [-58, -BOARD_Z, 58, -BOARD_Z, 0, 1], [BOARD_X, -31, BOARD_X, 31, -1, 0], [58, BOARD_Z, 17, BOARD_Z, 0, -1],
    [-17, BOARD_Z, -58, BOARD_Z, 0, -1], [-BOARD_X, 31, -BOARD_X, -31, 1, 0]
  ];
  let dist = 0;
  for (const [x0, z0, x1, z1, fx, fz] of runs) {
    const len = Math.hypot(x1 - x0, z1 - z0), tilt = 0.12, ua = dist / LED_PERIOD, ub = (dist + len) / LED_PERIOD;
    Ld.quad([x0, 0.06, z0], [x1, 0.06, z1], [x1 - fx * tilt, 0.06 + BOARD_H, z1 - fz * tilt], [x0 - fx * tilt, 0.06 + BOARD_H, z0 - fz * tilt], WHITE, [[ua, 0], [ub, 0], [ub, 1], [ua, 1]], [fx, 0.1, fz]);
    const ax = (x1 - x0) / len, az = (z1 - z0) / len;
    S.obox([(x0 + x1) / 2 - fx * 0.32, 0.5, (z0 + z1) / 2 - fz * 0.32], [ax * len / 2, 0, az * len / 2], [0, 0.5, 0], [fx * 0.18, 0, fz * 0.18], C_BOARD);
    glowQuad([x0, 0.03, z0], [x1, 0.03, z1], [x1 + fx * 2.6, 0.03, z1 + fz * 2.6], [x0 + fx * 2.6, 0.03, z0 + fz * 2.6], SPILL, SPILL, NONE, NONE, 0);
    dist += len + 2;
  }

  // ---------- dugouts and the tunnel on the main side ----------
  const benchCol = t => { const c = kits[t][0].clone().multiplyScalar(0.55); return [c.r, c.g, c.b]; };
  const staff = []; // people who are not in the stands: [x, y, z, facing, code, shirt]
  for (const [t, sx] of [[0, -1], [1, 1]]) {
    const x = sx * 8.5, z0 = HALF_W + 6.4, z1 = HALF_W + 9.4;
    S.box(x - 3.5, 0, z0, x + 3.5, 0.12, z1, C_FLOOR);
    S.box(x - 3.5, 0, z1 - 0.3, x + 3.5, 2.3, z1, C_DARK);
    S.box(x - 3.4, 0.12, z1 - 1.25, x + 3.4, 0.45, z1 - 0.6, benchCol(t));
    S.box(x - 3.4, 0.45, z1 - 0.75, x + 3.4, 1.0, z1 - 0.6, benchCol(t));
    S.box(x - 3.55, 1.86, z0 - 0.05, x + 3.55, 1.94, z0 + 0.05, C_STEEL);
    Gl.quad([x - 3.5, 2.3, z1], [x + 3.5, 2.3, z1], [x + 3.5, 1.9, z0], [x - 3.5, 1.9, z0], WHITE, null, UP);
    for (const e of [-1, 1]) Gl.quad([x + e * 3.5, 0, z0], [x + e * 3.5, 0, z1], [x + e * 3.5, 2.3, z1], [x + e * 3.5, 1.9, z0], WHITE, null, [e, 0, 0]);
    const k = kits[t][0].clone().multiplyScalar(0.6);
    for (let p = 0; p < 7; p++) staff.push([x - 3 + p, 0, z1 - 0.95, Math.PI, 3, k]);
  }
  {
    // the players' tunnel: a ribbed hood from the stand to the side of the pitch, lit inside
    const z0 = BOARD_Z + 0.1, z1 = EZ + 0.2;
    const sect = [[-1.8, 0], [-1.8, 2.0], [-1.2, 2.7], [1.2, 2.7], [1.8, 2.0], [1.8, 0]];
    for (let k = 0; k < sect.length - 1; k++) {
      const [ax, ay] = sect[k], [bx, by] = sect[k + 1], ox = (ax + bx) / 2, oy = (ay + by) / 2 - 1;
      S.quad([ax, ay, z0], [bx, by, z0], [bx, by, z1], [ax, ay, z1], C_DARK, null, [ox, oy, 0]);
      for (let z = z0 + 0.3; z < z1 - 0.2; z += 0.9) S.quad([ax * 1.03, ay * 1.03, z], [bx * 1.03, by * 1.03, z], [bx * 1.03, by * 1.03, z + 0.14], [ax * 1.03, ay * 1.03, z + 0.14], C_RIB, null, [ox, oy, 0]);
    }
    E.quad([-1.8, 0, z0 + 0.02], [1.8, 0, z0 + 0.02], [1.8, 2.0, z0 + 0.02], [-1.8, 2.0, z0 + 0.02], L_TUN, null, [0, 0, -1]);
    E.quad([-1.8, 2.0, z0 + 0.02], [1.8, 2.0, z0 + 0.02], [1.2, 2.7, z0 + 0.02], [-1.2, 2.7, z0 + 0.02], L_TUN, null, [0, 0, -1]);
  }
  // stewards facing the crowd, photographers behind the goal lines (they never join in)
  const HIVIS = new THREE.Color(0.5, 0.58, 0.02), BIB = new THREE.Color(0.7, 0.22, 0.02);
  for (let x = -54; x <= 54; x += 12) staff.push([x, 0, -(BOARD_Z + 2), Math.PI, 2, HIVIS]);
  for (const sx of [-1, 1]) {
    for (const z of [-18, 0, 18]) staff.push([sx * (BOARD_X + 1.8), 0, z, (sx * Math.PI) / 2, 2, HIVIS]);
    for (let z = -22; z <= 22; z += 2.2) if (Math.abs(z) > 5.5) staff.push([sx * (HALF_L + 4.2), 0, z + (rnd() - 0.5) * 0.6, (-sx * Math.PI) / 2, 3, BIB]);
  }

  // ---------- the press box, behind the gantry camera ----------
  {
    const pm = profile(1), fl = pm.upTop, z0 = EZ + 52, z1 = EZ + 58;
    S.box(-38, fl, z0, 38, fl + 1, z0 + 0.4, C_WALL);
    S.box(-38, fl + 3.6, z0, 38, fl + 4.8, z1, C_WALL);
    for (let x = -38; x < 38; x += 4) E.quad([x + 0.2, fl + 1, z0 - 0.02], [x + 3.8, fl + 1, z0 - 0.02], [x + 3.8, fl + 3.6, z0 - 0.02], [x + 0.2, fl + 3.6, z0 - 0.02], L_WIN, null, [0, 0, -1]);
  }

  // ---------- floodlight pylons at the corners ----------
  const pylons = [], glare = [], cones = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const bx = sx * (EX - RC) + sx * PYLON_R * Math.SQRT1_2, bz = sz * (EZ - RC) + sz * PYLON_R * Math.SQRT1_2;
      const R0 = 3.6, R1 = 1.3, legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      const leg = (k, y) => { const r = R0 + ((R1 - R0) * y) / PYLON_H; return [bx + legs[k][0] * r, y, bz + legs[k][1] * r]; };
      for (let k = 0; k < 4; k++) S.beam(leg(k, 0), leg(k, PYLON_H), 0.45, C_STEEL);
      const LV = 10;
      for (let l = 1; l <= LV; l++) {
        const y = (l * PYLON_H) / LV, yp = ((l - 1) * PYLON_H) / LV;
        for (let k = 0; k < 4; k++) {
          const k2 = (k + 1) % 4;
          S.beam(leg(k, y), leg(k2, y), 0.22, C_STEEL);
          S.beam(l % 2 ? leg(k, yp) : leg(k2, yp), l % 2 ? leg(k2, y) : leg(k, y), 0.16, C_STEEL);
        }
      }
      S.box(bx - 2.2, PYLON_H - 0.4, bz - 2.2, bx + 2.2, PYLON_H, bz + 2.2, C_STEEL);
      // the lamp bank, square on to its aim point on the pitch
      const il = Math.hypot(bx, bz), ix = -bx / il, iz = -bz / il;
      const H = [bx + ix * 2.5, PYLON_H + 4.5, bz + iz * 2.5], aim = [sx * 14, 0, sz * 8];
      let fx = aim[0] - H[0], fy = aim[1] - H[1], fz = aim[2] - H[2];
      const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
      let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
      const ux = -fy * rz, uy = fz * rx - fx * rz, uz = fy * rx;
      const ul = Math.hypot(ux, uy, uz), U = [ux / ul, uy / ul, uz / ul], R = [rx, 0, rz], F = [fx, fy, fz];
      const off = (p, a, ka, b, kb, c, kc) => [p[0] + a[0] * ka + b[0] * kb + c[0] * kc, p[1] + a[1] * ka + b[1] * kb + c[1] * kc, p[2] + a[2] * ka + b[2] * kb + c[2] * kc];
      S.obox(off(H, F, -0.6, R, 0, U, 0), [R[0] * 6.8, 0, R[2] * 6.8], [U[0] * 4.3, U[1] * 4.3, U[2] * 4.3], [F[0] * 0.25, F[1] * 0.25, F[2] * 0.25], C_STEEL);
      for (const [a, b] of [[0, -1], [1, -1], [2, 1], [3, 1]]) S.beam(leg(a, PYLON_H), off(H, F, -0.8, R, b * 5, U, -4), 0.3, C_STEEL);
      for (let c = 0; c < 6; c++) {
        for (let r = 0; r < 4; r++) {
          const Lc = off(H, R, (c - 2.5) * 2.1, U, (r - 1.5) * 1.9, F, 0);
          S.obox(Lc, [R[0] * 0.8, 0, R[2] * 0.8], [U[0] * 0.65, U[1] * 0.65, U[2] * 0.65], [F[0] * 0.45, F[1] * 0.45, F[2] * 0.45], C_LAMPBODY);
          const Fc = off(Lc, F, 0.46, R, 0, U, 0);
          E.quad(off(Fc, R, -0.7, U, -0.55, F, 0), off(Fc, R, 0.7, U, -0.55, F, 0), off(Fc, R, 0.7, U, 0.55, F, 0), off(Fc, R, -0.7, U, 0.55, F, 0), L_LAMP, null, F);
          glare.push([off(Lc, F, 0.7, R, 0, U, 0), F, 2.6, 1.0, 0, rnd() * 6.28]);
        }
      }
      glare.push([off(H, F, 1.5, R, 0, U, 0), F, 40, 0.45, 1, rnd() * 6.28]);
      cones.push([off(H, F, 1.2, R, 0, U, 0), F, R, U, fl * 0.92]);
      pylons.push({ x: H[0], y: H[1], z: H[2], aimX: aim[0], aimZ: aim[2] });
    }
  }
  // light shafts: a wide soft cone from each bank down to the pitch
  const HAZE = [0.013, 0.0125, 0.011];
  for (const [Ap, F, R, U, len] of cones) {
    const K = 20, r0 = 6, r1 = len * 0.36;
    for (let k = 0; k < K; k++) {
      const a0 = (k / K) * TAU, a1 = ((k + 1) / K) * TAU;
      const ring = (a, rad, d) => [Ap[0] + F[0] * d + (R[0] * Math.cos(a) + U[0] * Math.sin(a)) * rad, Ap[1] + F[1] * d + (R[1] * Math.cos(a) + U[1] * Math.sin(a)) * rad, Ap[2] + F[2] * d + (R[2] * Math.cos(a) + U[2] * Math.sin(a)) * rad];
      glowQuad(ring(a0, r0, 0), ring(a1, r0, 0), ring(a1, r1, len), ring(a0, r1, len), HAZE, HAZE, NONE, NONE, 1);
    }
  }

  // ---------- meshes ----------
  const structMat = M(new THREE.MeshLambertMaterial({ color: 0xffffff, map: atlas, vertexColors: true }));
  const structure = new THREE.Mesh(G(S.build(THREE)), structMat);
  structure.name = "stadium-structure";
  const lightMat = M(new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true }));
  const lights = new THREE.Mesh(G(E.build(THREE)), lightMat);
  lights.name = "stadium-lights";
  const ledMat = M(new THREE.MeshBasicMaterial({ map: ledTex, color: new THREE.Color(1.35, 1.35, 1.35) }));
  const leds = new THREE.Mesh(G(Ld.build(THREE)), ledMat);
  leds.name = "stadium-led";
  const glassMat = M(new THREE.MeshStandardMaterial({ color: 0xa9c2d6, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
  glassMat.forceSinglePass = true;
  const glass = new THREE.Mesh(G(Gl.build(THREE)), glassMat);
  glass.name = "stadium-glass";

  const glowGeo = G(new THREE.BufferGeometry());
  glowGeo.setAttribute("position", new THREE.Float32BufferAttribute(gP, 3));
  glowGeo.setAttribute("normal", new THREE.Float32BufferAttribute(gN, 3));
  glowGeo.setAttribute("aCol", new THREE.Float32BufferAttribute(gC, 3));
  glowGeo.setAttribute("aSoft", new THREE.Float32BufferAttribute(gS, 1));
  glowGeo.setIndex(gI);
  glowGeo.computeBoundingSphere();
  const glowMat = M(new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { flGain: { value: 1 } }]),
    vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, fog: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false
  }));
  glowMat.forceSinglePass = true;
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.name = "stadium-haze";
  glow.renderOrder = 5;

  const flTime = { value: 0 };
  const quadGeo = G(new THREE.PlaneGeometry(1, 1));
  const gA = new Float32Array(glare.length * 4), gD = new Float32Array(glare.length * 3);
  const glareMat = M(new THREE.ShaderMaterial({
    uniforms: { flTime }, vertexShader: GLARE_VERT, fragmentShader: GLARE_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false
  }));
  const glares = new THREE.InstancedMesh(quadGeo, glareMat, glare.length);
  const m4 = new THREE.Matrix4();
  glare.forEach(([p, F, size, inten, kind, ph], k) => {
    m4.makeTranslation(p[0], p[1], p[2]);
    glares.setMatrixAt(k, m4);
    gA[k * 4] = size; gA[k * 4 + 1] = inten; gA[k * 4 + 2] = kind; gA[k * 4 + 3] = ph;
    gD[k * 3] = F[0]; gD[k * 3 + 1] = F[1]; gD[k * 3 + 2] = F[2];
  });
  quadGeo.setAttribute("aG", new THREE.InstancedBufferAttribute(gA, 4));
  quadGeo.setAttribute("aAim", new THREE.InstancedBufferAttribute(gD, 3));
  glares.instanceMatrix.needsUpdate = true;
  glares.frustumCulled = false;
  glares.renderOrder = 6;
  glares.name = "stadium-glare";

  const skyMat = M(new THREE.ShaderMaterial({ uniforms: { flTime }, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false }));
  const sky = new THREE.Mesh(G(new THREE.SphereGeometry(440, 32, 16)), skyMat);
  sky.renderOrder = -10;
  sky.name = "stadium-sky";

  // ---------- the crowd ----------
  const kitRGB = new Float32Array(12);
  for (let t = 0; t < 2; t++) for (let k = 0; k < 2; k++) { const c = kits[t][k], o = (t * 2 + k) * 3; kitRGB[o] = c.r; kitRGB[o + 1] = c.g; kitRGB[o + 2] = c.b; }
  const vomF = new Float32Array(vom.length * 6);
  vom.forEach((v, i) => vomF.set([v.x, v.z, v.nx, v.nz, v.tx, v.tz], i * 6));
  // staff first (always shown), then the stands the broadcast camera sees, then the main stand behind it, so a
  // lower quality drops the people nobody can see before anyone else
  const crew = { F: new Float32Array(96 * 9), n: 0, cap: 96 }, rest = { F: new Float32Array(30000 * 9), n: 0, cap: 30000 }, mainSide = { F: new Float32Array(10000 * 9), n: 0, cap: 10000 };
  for (const [x, y, z, th, code, c] of staff) pushPerson(crew, x, y, z, th, code, 1, c.r, c.g, c.b);
  seatCrowd(pts, prof, total, rnd, vomF, kitRGB, rest, mainSide);
  const NP = crew.n + rest.n + mainSide.n;
  const personGeo = G(personGeometry(THREE));
  const aShirt = new Float32Array(NP * 3), aFan = new Float32Array(NP * 4);
  const crowdU = {
    flTime, flJump: { value: new THREE.Vector2() }, flSlump: { value: new THREE.Vector2() }, flStand: { value: 0 },
    flArms: { value: 0 }, flFlash: { value: 0 }, flWave: { value: new THREE.Vector2() }
  };
  const crowdMat = M(new THREE.MeshLambertMaterial({ color: 0xffffff }));
  crowdMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, crowdU);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\n" + FAN_PARS)
      .replace("#include <beginnormal_vertex>", FAN_VERT)
      .replace("#include <begin_vertex>", "vec3 transformed = fP;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vFanCol;\nvarying float vFanFlash;")
      .replace("#include <color_fragment>", "diffuseColor.rgb *= vFanCol;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(vFanFlash * 4.0);");
  };
  crowdMat.customProgramCacheKey = () => "fl-crowd-1";
  const crowd = new THREE.InstancedMesh(personGeo, crowdMat, NP);
  writeCrowd(crowd.instanceMatrix.array, aShirt, aFan, [crew, rest, mainSide], rnd);
  personGeo.setAttribute("aShirt", new THREE.InstancedBufferAttribute(aShirt, 3));
  personGeo.setAttribute("aFan", new THREE.InstancedBufferAttribute(aFan, 4));
  crowd.instanceMatrix.needsUpdate = true;
  crowd.frustumCulled = false;
  crowd.name = "stadium-crowd";
  const counts = [Math.round(crew.n + rest.n * 0.4), Math.round(crew.n + rest.n * 0.75), NP];

  for (const o of [sky, structure, lights, leds, crowd, glass, glow, glares]) { o.castShadow = false; o.receiveShadow = false; group.add(o); }

  // ---------- reactions ----------
  const st = { jump: [0, 0], slump: [0, 0], stand: 0, hold: 0, arms: 0, flash: 0, goalT: 0, goalTeam: 0, calm: 0, waveOn: false, waveT: 0, waveA: 0, waveAmp: 0, led: 0, ledTeam: 0, page: 0, pageT: 0 };
  // kind: "goal" (power >= 0 the home side, team 0, scored; < 0 the away side), "chance", "save", "foul", "calm"
  function react(kind, power) {
    const pw = Number.isFinite(power) ? power : 1, mag = Math.min(1, Math.abs(pw) || 1);
    st.calm = 0;
    if (kind === "goal") {
      const t = pw < 0 ? 1 : 0;
      st.goalT = 9; st.goalTeam = t; st.stand = 1; st.hold = 3; st.flash = 1; st.led = 8; st.ledTeam = t;
    } else if (kind === "chance") {
      st.stand = Math.max(st.stand, 0.55 + 0.45 * mag); st.hold = Math.max(st.hold, 1.3); st.arms = Math.max(st.arms, 0.75); st.flash = Math.max(st.flash, 0.35);
    } else if (kind === "save") {
      st.stand = Math.max(st.stand, 0.5 * (0.6 + 0.4 * mag)); st.hold = Math.max(st.hold, 0.9); st.arms = Math.max(st.arms, 0.55); st.flash = Math.max(st.flash, 0.2);
    } else if (kind === "foul") {
      st.arms = Math.max(st.arms, 0.6 * (0.5 + 0.5 * mag)); st.stand = Math.max(st.stand, 0.25); st.hold = Math.max(st.hold, 0.6);
    } else if (kind === "calm") {
      st.hold = 0; st.goalT = Math.min(st.goalT, 0); st.arms *= 0.5; st.led = Math.min(st.led, 0.3);
    }
  }

  let time = 0;
  const ease = x => x * x * (3 - 2 * x);
  function update(dt) {
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
    time += dt;
    if (st.goalT > 0) {
      st.goalT -= dt;
      const k = st.goalTeam, age = 9 - st.goalT;
      st.jump[k] = age < 6.5 ? Math.min(1, st.jump[k] + dt * 3) : Math.max(0, st.jump[k] - dt * 0.45);
      st.jump[1 - k] = Math.max(0, st.jump[1 - k] - dt);
      st.slump[1 - k] = Math.min(1, st.slump[1 - k] + dt * 1.5);
    } else {
      for (let k = 0; k < 2; k++) { st.jump[k] = Math.max(0, st.jump[k] - dt * 0.6); st.slump[k] = Math.max(0, st.slump[k] - dt * 0.3); }
    }
    if (st.hold > 0) st.hold -= dt; else st.stand = Math.max(0, st.stand - dt * 0.5);
    st.arms = Math.max(0, st.arms - dt * 0.45);
    st.flash = Math.max(0, st.flash - dt * 0.22);
    // a Mexican wave now and then, when nothing has happened for a while
    st.calm += dt;
    if (!st.waveOn && st.calm > 45 && rnd() < dt * 0.02) { st.waveOn = true; st.waveT = 0; st.waveA = rnd() * TAU; }
    if (st.waveOn) {
      st.waveT += dt; st.waveA = (st.waveA + dt * 0.55) % TAU;
      st.waveAmp = Math.min(1, st.waveT / 2) * clamp((13 - st.waveT) / 2, 0, 1);
      if (st.waveT > 13 || st.calm < 0.5) { st.waveOn = false; st.waveAmp = 0; }
    }
    flTime.value = time;
    crowdU.flJump.value.set(st.jump[0], st.jump[1]);
    crowdU.flSlump.value.set(st.slump[0], st.slump[1]);
    crowdU.flStand.value = st.stand;
    crowdU.flArms.value = st.arms;
    crowdU.flFlash.value = st.flash;
    crowdU.flWave.value.set(st.waveA, st.waveAmp);
    // LED boards: hold a page, slide to the next; on a goal, the scorers' GOAL rolls fast and flashes
    if (st.led > 0) {
      st.led -= dt;
      ledTex.offset.y = st.ledTeam ? 0 : 1 / 3;
      ledTex.offset.x = (ledTex.offset.x + dt * 0.3) % 1;
      ledMat.color.setScalar(Math.sin(time * 9) > 0 ? 1.9 : 1.3);
      if (st.led <= 0) { ledTex.offset.y = 2 / 3; ledMat.color.setScalar(1.35); }
    } else {
      st.pageT += dt;
      if (st.pageT >= 7.7) { st.pageT -= 7.7; st.page = (st.page + 1) % LED_ADS; }
      ledTex.offset.x = (st.page + (st.pageT > 7 ? ease((st.pageT - 7) / 0.7) : 0)) / LED_ADS;
    }
  }

  function setQuality(q) {
    quality = clamp(q | 0, 0, 2);
    crowd.count = counts[quality];
    glow.visible = quality > 0;
    glowMat.uniforms.flGain.value = quality > 1 ? 1 : 0.8;
  }
  setQuality(quality);

  function dispose() {
    if (dead) return;
    dead = true;
    for (const x of geos) x.dispose();
    for (const x of mats) x.dispose();
    for (const x of texs) x.dispose();
    if (crowd.dispose) crowd.dispose();
    if (glares.dispose) glares.dispose();
    group.clear();
  }

  // layout numbers for the view: the boards, the bowl front, the lamp heads (for lights and lens effects)
  const info = { boardX: BOARD_X, boardZ: BOARD_Z, bowlX: EX, bowlZ: EZ, pylons, people: NP, counts };
  return { group, update, react, setQuality, dispose, info };
}

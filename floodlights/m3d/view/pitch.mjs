// Floodlights 3D match view: the pitch.
// Dark night turf with mow stripes, fibre detail and every painted line worked out in the shader (so the lines
// stay sharp and steady at any distance), a wear layer the view scuffs with slides, dives and skids, two goals
// with soft box nets that bulge where the ball hits and settle again, and four corner flags that flutter.
// three.js is handed in, never imported. With ctx.doc null (node tests) every texture is a small DataTexture
// built in plain JS, so nothing here needs a document, a window or a canvas.
//
// Axes: three.x = sim x (goal to goal), three.y = up, three.z = sim y (touchline to touchline).
// One draw call each for the ground, the goal frames (posts, bars, stanchions, flag poles), the nets, the flags.
import { HALF_L, HALF_W, GOAL_HALF, BAR_H, GOAL_DEPTH, POST_R, BOX_D, BOX_HALF, SIX_D, SIX_HALF, SPOT_D, CIRCLE_R } from "../consts.mjs";

// the LED boards stand on this rectangle (the stadium uses the same numbers); beyond it is the darker run off
const BOARD_X = HALF_L + 6.5, BOARD_Z = HALF_W + 5.5;
// the ground runs on under the front of the stands
const GROUND_X = HALF_L + 15, GROUND_Z = HALF_W + 14;
const BAND = (HALF_L * 2) / 20; // 20 mow stripes from goal line to goal line
// the wear layer covers the pitch and a margin, about 0.22 m a texel, two bytes a texel (lifted turf, bare soil)
const WEAR_W = 512, WEAR_H = 352;
const WEAR_X0 = -(HALF_L + 4), WEAR_Z0 = -(HALF_W + 4), WEAR_SX = 2 * (HALF_L + 4), WEAR_SZ = 2 * (HALF_W + 4);
const NET_CELL = 0.12; // net mesh size in metres
// the net bulge: a damped spring that starts with a kick outward
const NET_W = 11, NET_Z = 0.28, NET_WD = NET_W * Math.sqrt(1 - NET_Z * NET_Z);
const NET_PEAK = Math.exp(-NET_Z * NET_W * Math.atan(NET_WD / (NET_Z * NET_W)) / NET_WD) * Math.sin(Math.atan(NET_WD / (NET_Z * NET_W)));

const g = v => (Math.round(v * 10000) / 10000).toFixed(4); // a number written into GLSL
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
function hash2(i, j) {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// smooth value noise that tiles: a cells x cells grid of random values, eased between
function valueNoise(N, cells, rnd) {
  const gr = new Float32Array(cells * cells);
  for (let i = 0; i < gr.length; i++) gr[i] = rnd();
  const out = new Float32Array(N * N), k = cells / N;
  for (let y = 0; y < N; y++) {
    const fy = y * k, y0 = fy | 0, ty = fy - y0, sy = ty * ty * (3 - 2 * ty), y1 = (y0 + 1) % cells;
    for (let x = 0; x < N; x++) {
      const fx = x * k, x0 = fx | 0, tx = fx - x0, sx = tx * tx * (3 - 2 * tx), x1 = (x0 + 1) % cells;
      const a = gr[y0 * cells + x0], b = gr[y0 * cells + x1], c = gr[y1 * cells + x0], d = gr[y1 * cells + x1];
      out[y * N + x] = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    }
  }
  return out;
}

function dataTex(THREE, data, w, h, format, repeat, mips) {
  const t = new THREE.DataTexture(data, w, h, format, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.generateMipmaps = !!mips;
  t.needsUpdate = true;
  return t;
}

// three noise scales in R, G and B (big patches, mid clumps, fine speckle) and white noise in A
function noiseTexture(THREE, rnd) {
  const N = 128;
  const a = valueNoise(N, 4, rnd), b = valueNoise(N, 8, rnd), c = valueNoise(N, 16, rnd), d = valueNoise(N, 32, rnd), e = valueNoise(N, 64, rnd);
  const data = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    data[i * 4] = clamp((a[i] * 0.62 + b[i] * 0.38) * 255, 0, 255);
    data[i * 4 + 1] = clamp((c[i] * 0.6 + d[i] * 0.4) * 255, 0, 255);
    data[i * 4 + 2] = clamp((d[i] * 0.45 + e[i] * 0.55) * 255, 0, 255);
    data[i * 4 + 3] = rnd() * 255;
  }
  return dataTex(THREE, data, N, N, THREE.RGBAFormat, true, true);
}

// grass fibre: thousands of short blades scattered on a tile that wraps, turned into a normal map with the
// height kept in alpha (the shader darkens the gaps between blades with it)
function fibreTexture(THREE, N, rnd) {
  const H = new Float32Array(N * N);
  const blades = Math.round(N * N * 0.45);
  for (let k = 0; k < blades; k++) {
    let x = rnd() * N, y = rnd() * N;
    const a = rnd() * Math.PI * 2, len = 2 + rnd() * N * 0.03, dx = Math.cos(a), dy = Math.sin(a), h = 0.4 + rnd() * 0.6;
    for (let s = 0; s < len; s++) {
      const i = ((x | 0) % N + N) % N, j = ((y | 0) % N + N) % N;
      H[j * N + i] += h * (1 - (s / len) * 0.7);
      x += dx; y += dy;
    }
  }
  let mx = 0;
  for (let i = 0; i < H.length; i++) if (H[i] > mx) mx = H[i];
  const inv = mx > 0 ? 1 / mx : 1, data = new Uint8Array(N * N * 4), K = 2.6;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const l = H[j * N + (i + N - 1) % N] * inv, r = H[j * N + (i + 1) % N] * inv;
      const d = H[((j + N - 1) % N) * N + i] * inv, u = H[((j + 1) % N) * N + i] * inv;
      let nx = (l - r) * K, ny = (d - u) * K, nz = 1;
      const nl = 1 / Math.hypot(nx, ny, nz);
      nx *= nl; ny *= nl; nz *= nl;
      const o = (j * N + i) * 4;
      data[o] = (nx * 0.5 + 0.5) * 255; data[o + 1] = (ny * 0.5 + 0.5) * 255; data[o + 2] = (nz * 0.5 + 0.5) * 255;
      data[o + 3] = Math.sqrt(H[j * N + i] * inv) * 255;
    }
  }
  return dataTex(THREE, data, N, N, THREE.RGBAFormat, true, true);
}

// ---------- shader parts for the ground ----------
const GROUND_PARS = `
uniform sampler2D flNoise;
uniform sampler2D flWear;
uniform float flDetail;
uniform vec3 flDark;
uniform vec3 flLight;
uniform vec3 flRun;
uniform vec3 flLift;
uniform vec3 flSoil;
uniform vec3 flPaint;
varying vec2 vPitch;
float flSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
// distance in metres to the nearest painted line, on one folded quarter of the pitch
float flLines(vec2 A) {
  float d = flSeg(A, vec2(0.0, ${g(HALF_W)}), vec2(${g(HALF_L)}, ${g(HALF_W)}));
  d = min(d, flSeg(A, vec2(${g(HALF_L)}, 0.0), vec2(${g(HALF_L)}, ${g(HALF_W)})));
  d = min(d, flSeg(A, vec2(0.0, 0.0), vec2(0.0, ${g(HALF_W)})));
  d = min(d, abs(length(A) - ${g(CIRCLE_R)}));
  d = min(d, length(A) - 0.09);
  d = min(d, flSeg(A, vec2(${g(HALF_L - BOX_D)}, 0.0), vec2(${g(HALF_L - BOX_D)}, ${g(BOX_HALF)})));
  d = min(d, flSeg(A, vec2(${g(HALF_L - BOX_D)}, ${g(BOX_HALF)}), vec2(${g(HALF_L)}, ${g(BOX_HALF)})));
  d = min(d, flSeg(A, vec2(${g(HALF_L - SIX_D)}, 0.0), vec2(${g(HALF_L - SIX_D)}, ${g(SIX_HALF)})));
  d = min(d, flSeg(A, vec2(${g(HALF_L - SIX_D)}, ${g(SIX_HALF)}), vec2(${g(HALF_L)}, ${g(SIX_HALF)})));
  vec2 spot = vec2(${g(HALF_L - SPOT_D)}, 0.0);
  d = min(d, length(A - spot) - 0.08);
  d = min(d, max(abs(length(A - spot) - ${g(CIRCLE_R)}), A.x - ${g(HALF_L - BOX_D)}));
  d = min(d, max(abs(length(A - vec2(${g(HALF_L)}, ${g(HALF_W)})) - 1.0), max(A.x - ${g(HALF_L)}, A.y - ${g(HALF_W)})));
  return d;
}
`;

const GROUND_MAIN = `
  vec2 flP = vPitch;
  vec2 flA = abs(flP);
  float nBig = texture2D(flNoise, flP * 0.0208 + vec2(0.13, 0.71)).r;
  float nMid = texture2D(flNoise, flP * 0.0417 + vec2(0.57, 0.29)).g;
  float nFin = texture2D(flNoise, flP * 0.156 + vec2(0.31, 0.83)).b;
  float fib = texture2D(normalMap, vNormalMapUv).a;
  float run = step(0.0, max(flA.x - ${g(BOARD_X)}, flA.y - ${g(BOARD_Z)}));
  // mow stripes: crisp edges with a hair of wobble, stronger toward the far side where the view grazes
  float st = (flP.x + ${g(HALF_L)}) / ${g(BAND)} + (nMid - 0.5) * 0.006;
  float tri = abs(fract(st * 0.5) * 2.0 - 1.0);
  float sw = fwidth(st) + 1e-4;
  float band = smoothstep(0.5 - sw, 0.5 + sw, tri) * 2.0 - 1.0;
  vec3 flV = normalize(cameraPosition - vec3(flP.x, 0.0, flP.y));
  float graze = 1.0 - flV.y;
  float contrast = (0.5 + 0.4 * graze * graze) * (1.0 - run);
  vec3 col = mix(flDark, flLight, 0.5 + 0.5 * band * contrast);
  col = mix(col, flRun * (0.88 + 0.24 * nMid), run);
  col *= 0.84 + 0.32 * nBig;
  col *= 0.92 + 0.16 * nMid;
  col = mix(col, col * vec3(1.16, 1.05, 0.76), smoothstep(0.58, 0.9, nBig) * 0.4);
  col *= mix(1.0, 0.74 + 0.48 * fib, flDetail);
  col *= 0.94 + 0.12 * nFin;
  // wear: what the view painted, plus a little old wear in the goalmouths and on the assistant referees' runs
  vec2 wr = texture2D(flWear, (flP - vec2(${g(WEAR_X0)}, ${g(WEAR_Z0)})) * vec2(${g(1 / WEAR_SX)}, ${g(1 / WEAR_SZ)})).rg;
  vec2 gq = vec2(flA.x - ${g(HALF_L - 3)}, flP.y) * vec2(0.36, 0.3);
  float gm = exp(-dot(gq, gq)) * (0.45 + 0.9 * nMid) * (1.0 - run);
  float ar = exp(-pow((flA.y - ${g(HALF_W + 1.3)}) / 0.4, 2.0)) * step(0.0, flP.x * flP.y) * (1.0 - smoothstep(${g(HALF_L - 4)}, ${g(HALF_L)}, flA.x)) * (0.4 + 0.6 * nFin);
  float lift = clamp(wr.r + gm * 0.3 + ar * 0.2, 0.0, 1.0);
  float soil = clamp(wr.g + gm * gm * 0.1 * nFin, 0.0, 1.0);
  col = mix(col, flLift * (0.8 + 0.4 * nFin), lift * 0.8);
  col = mix(col, flSoil * (0.7 + 0.6 * nFin), soil * 0.9);
  // painted lines, anti aliased on their distance; when a line gets thinner than a pixel it fades instead of
  // breaking up, so the far touchline never crawls
  float ld = flLines(flA);
  float aa = fwidth(ld) + 1e-5;
  float lw = max(0.06, aa * 0.6);
  float lm = (1.0 - smoothstep(lw - aa * 0.5, lw + aa * 0.5, ld)) * (0.06 / lw) * (1.0 - run);
  lm *= 1.0 - clamp(lift * 0.45 + soil * 0.85, 0.0, 1.0);
  col = mix(col, flPaint * (0.9 + 0.1 * nFin) * mix(1.0, 0.86 + 0.2 * fib, flDetail), lm * 0.95);
  diffuseColor.rgb = col;
  // the light stripes are the blades lying toward the lights: a touch shinier
  float flRough = mix(0.88, 0.72, 0.5 + 0.5 * band);
  flRough = mix(flRough, 0.94, run);
  flRough = mix(flRough, 0.8, lm);
  flRough = clamp(flRough + lift * 0.06 + soil * 0.1, 0.0, 1.0);
`;

const NET_VERT_PARS = `
uniform float flTime;
uniform vec4 flHit[4];
uniform float flHitA[4];
attribute float aPin;
attribute vec2 aNetUv;
varying vec2 vNetUv;
`;
const NET_VERT = `
  vNetUv = aNetUv;
  float sway = aPin * (0.022 * sin(flTime * 1.35 + position.z * 0.9 + position.x * 0.5) + 0.01 * sin(flTime * 3.1 + position.y * 2.3 + position.z * 1.9));
  float push = 0.0;
  for (int k = 0; k < 4; k++) {
    vec3 dd = position - flHit[k].xyz;
    float r2 = flHit[k].w * flHit[k].w;
    float dq = dot(dd, dd);
    push += flHitA[k] * (exp(-dq / r2) + 0.3 * exp(-dq / (6.0 * r2)));
  }
  transformed += normal * (sway + push * aPin);
`;
const NET_FRAG = `
  {
    // a diamond mesh of thin strands; far away it settles into an even veil instead of shimmering
    vec2 q = vec2(vNetUv.x + vNetUv.y, vNetUv.x - vNetUv.y) * 0.70711;
    vec2 dl = 0.5 - abs(fract(q) - 0.5);
    vec2 fw = max(fwidth(q), vec2(1e-4));
    vec2 wv = max(vec2(0.055), fw * 0.75);
    vec2 cv = (1.0 - smoothstep(wv - fw * 0.5, wv + fw * 0.5, dl)) * (0.055 / wv);
    float cov = max(cv.x, cv.y);
    cov = mix(cov, 0.2, smoothstep(0.35, 1.2, max(fw.x, fw.y)));
    diffuseColor.a *= clamp(cov * 1.15, 0.0, 1.0);
  }
`;
const FLAG_VERT = `
  float fu = aFlag.x;
  float fw = sin(flTime * 7.5 + aFlag.y - fu * 5.5) * 0.06 + sin(flTime * 13.0 + aFlag.y * 1.7 - fu * 9.0) * 0.02;
  transformed += vec3(aFlag.z, 0.0, aFlag.w) * fw * fu;
  transformed.y -= fu * fu * 0.03 * (1.0 + 0.5 * sin(flTime * 2.0 + aFlag.y));
`;

export function createPitch(THREE, ctx) {
  ctx = ctx || {};
  const doc = ctx.doc || null;
  let quality = clamp(ctx.quality == null ? 2 : ctx.quality | 0, 0, 2);
  let maxAniso = ctx.maxAniso || 0;
  if (!maxAniso && ctx.renderer && ctx.renderer.capabilities && ctx.renderer.capabilities.getMaxAnisotropy) maxAniso = Math.min(16, ctx.renderer.capabilities.getMaxAnisotropy());
  maxAniso = maxAniso || 4;
  const group = new THREE.Group();
  group.name = "pitch";
  const geos = [], mats = [], texs = [];
  const G = x => (geos.push(x), x), M = x => (mats.push(x), x), T = x => (texs.push(x), x);
  const rnd = rng(20260611);
  const flTime = { value: 0 };

  // ---------- textures ----------
  const noiseTex = T(noiseTexture(THREE, rnd));
  noiseTex.anisotropy = Math.min(4, maxAniso);
  const fibreTex = T(fibreTexture(THREE, doc ? 256 : 64, rnd));
  fibreTex.anisotropy = maxAniso;
  fibreTex.repeat.set((GROUND_X * 2) / 0.9, (GROUND_Z * 2) / 0.9);
  const wear = new Uint8Array(WEAR_W * WEAR_H * 2);
  const wearTex = T(dataTex(THREE, wear, WEAR_W, WEAR_H, THREE.RGFormat, false, false));

  // ---------- the ground: one plane from stand to stand ----------
  const groundGeo = G(new THREE.PlaneGeometry(GROUND_X * 2, GROUND_Z * 2, 1, 1));
  groundGeo.rotateX(-Math.PI / 2);
  const gU = {
    flNoise: { value: noiseTex }, flWear: { value: wearTex }, flDetail: { value: 1 },
    flDark: { value: new THREE.Color(0x2c4b25) }, flLight: { value: new THREE.Color(0x3b5f31) },
    flRun: { value: new THREE.Color(0x26392a) }, flLift: { value: new THREE.Color(0x7d7b4a) },
    flSoil: { value: new THREE.Color(0x3e2c1d) }, flPaint: { value: new THREE.Color(0xeef1ea) }
  };
  const groundMat = M(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, normalMap: fibreTex, normalScale: new THREE.Vector2(0.6, 0.6) }));
  groundMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, gU);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vPitch;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvPitch = position.xz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\n" + GROUND_PARS)
      .replace("#include <map_fragment>", GROUND_MAIN)
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = flRough;");
  };
  groundMat.customProgramCacheKey = () => "fl-pitch-ground-1";
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.name = "pitch-ground";
  ground.receiveShadow = true;
  ground.castShadow = false;
  group.add(ground);

  // ---------- goal frames, stanchions and flag poles, merged, vertex coloured ----------
  const yAxis = new THREE.Vector3(0, 1, 0), tv = new THREE.Vector3(), tq = new THREE.Quaternion(), tm = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1), mid = new THREE.Vector3();
  const parts = [];
  function tube(ax, ay, az, bx, by, bz, r, seg, color) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz);
    const geo = new THREE.CylinderGeometry(r, r, len, seg, 1, false);
    tq.setFromUnitVectors(yAxis, tv.set(dx / len, dy / len, dz / len));
    tm.compose(mid.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), tq, one);
    geo.applyMatrix4(tm);
    parts.push({ geo, color });
  }
  const white = new THREE.Color(0xf6f8fa), steel = new THREE.Color(0xc9ced4), poleCol = new THREE.Color(0xf0f0ea);
  const GH = GOAL_HALF, GD = GOAL_DEPTH;
  for (const s of [-1, 1]) {
    const x0 = s * HALF_L, x1 = s * (HALF_L + GD);
    for (const zs of [-1, 1]) {
      tube(x0, 0, zs * GH, x0, BAR_H + POST_R, zs * GH, POST_R, 16, white);
      tube(x1, 0, zs * GH, x1, BAR_H, zs * GH, 0.035, 8, steel);
      tube(x0, BAR_H, zs * GH, x1, BAR_H, zs * GH, 0.03, 8, steel);
      tube(x0, 0.03, zs * GH, x1, 0.03, zs * GH, 0.03, 6, steel);
    }
    tube(x0, BAR_H, -GH - POST_R, x0, BAR_H, GH + POST_R, POST_R, 16, white);
    tube(x1, BAR_H, -GH, x1, BAR_H, GH, 0.035, 8, steel);
    tube(x1, 0.03, -GH, x1, 0.03, GH, 0.03, 6, steel);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) tube(sx * HALF_L, 0, sz * HALF_W, sx * HALF_L, 1.55, sz * HALF_W, 0.022, 8, poleCol);
  const frameGeo = G(mergeColoured(THREE, parts));
  const frameMat = M(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.32, metalness: 0.15 }));
  const frames = new THREE.Mesh(frameGeo, frameMat);
  frames.name = "pitch-goals";
  frames.castShadow = true;
  frames.receiveShadow = false;
  group.add(frames);

  // ---------- nets: back, sides and roof of both goals in one soft mesh ----------
  const nP = [], nN = [], nUV = [], nPin = [], nI = [];
  function panel(ox, oy, oz, ux, uy, uz, vx, vy, vz, nu, nv, outX, outY, outZ, sag) {
    const base = nP.length / 3, lu = Math.hypot(ux, uy, uz), lv = Math.hypot(vx, vy, vz);
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const a = i / nu, b = j / nv, w = Math.sin(Math.PI * a) * Math.sin(Math.PI * b);
        nP.push(ox + ux * a + vx * b + outX * sag * w, oy + uy * a + vy * b + outY * sag * w, oz + uz * a + vz * b + outZ * sag * w);
        nN.push(outX, outY, outZ);
        nUV.push((lu * a) / NET_CELL, (lv * b) / NET_CELL);
        nPin.push(w);
      }
    }
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const k = base + j * (nu + 1) + i;
        nI.push(k, k + 1, k + nu + 2, k, k + nu + 2, k + nu + 1);
      }
    }
  }
  for (const s of [-1, 1]) {
    const x0 = s * HALF_L, xb = s * (HALF_L + GD);
    panel(xb, 0, -GH, 0, 0, GH * 2, 0, BAR_H, 0, 28, 10, s, 0, 0, 0.07);
    for (const zs of [-1, 1]) panel(x0, 0, zs * GH, s * GD, 0, 0, 0, BAR_H, 0, 8, 10, 0, 0, zs, 0.05);
    panel(x0, BAR_H, -GH, s * GD, 0, 0, 0, 0, GH * 2, 8, 28, 0, 1, 0, -0.09);
  }
  const netGeo = G(new THREE.BufferGeometry());
  netGeo.setAttribute("position", new THREE.Float32BufferAttribute(nP, 3));
  netGeo.setAttribute("normal", new THREE.Float32BufferAttribute(nN, 3));
  netGeo.setAttribute("aNetUv", new THREE.Float32BufferAttribute(nUV, 2));
  netGeo.setAttribute("aPin", new THREE.Float32BufferAttribute(nPin, 1));
  netGeo.setIndex(nI);
  // the bulge can push the mesh past its rest box, so give the bounds some room
  netGeo.computeBoundingSphere();
  if (netGeo.boundingSphere) netGeo.boundingSphere.radius += 1.5;
  const hitVecs = [0, 1, 2, 3].map(() => new THREE.Vector4(0, -50, 0, 1));
  const nU = { flTime, flHit: { value: hitVecs }, flHitA: { value: [0, 0, 0, 0] } };
  const netMat = M(new THREE.MeshStandardMaterial({ color: 0xf3f4f0, roughness: 0.9, metalness: 0, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  netMat.forceSinglePass = true;
  netMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, nU);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\n" + NET_VERT_PARS)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n" + NET_VERT);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vNetUv;")
      .replace("#include <alphamap_fragment>", "#include <alphamap_fragment>\n" + NET_FRAG);
  };
  netMat.customProgramCacheKey = () => "fl-pitch-net-1";
  const nets = new THREE.Mesh(netGeo, netMat);
  nets.name = "pitch-nets";
  nets.castShadow = false;
  nets.receiveShadow = false;
  nets.renderOrder = 2;
  group.add(nets);
  const hits = [0, 1, 2, 3].map(() => ({ on: false, age: 0, amp: 0 }));
  let hitNext = 0;

  // ---------- corner flags: four small cloths that flap in the same breeze ----------
  const fP = [], fN = [], fA = [], fI = [];
  const windA = 0.55, wx = Math.cos(windA), wz = Math.sin(windA), fnx = -wz, fnz = wx;
  let fk = 0;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = sx * HALF_L, pz = sz * HALF_W, phase = fk * 1.7, base = fP.length / 3, NU = 6, NV = 3;
      for (let j = 0; j <= NV; j++) {
        for (let i = 0; i <= NU; i++) {
          const u = i / NU, v = j / NV;
          fP.push(px + wx * u * 0.42, 1.22 + v * 0.3, pz + wz * u * 0.42);
          fN.push(fnx, 0, fnz);
          fA.push(u, phase, fnx, fnz);
        }
      }
      for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
        const k = base + j * (NU + 1) + i;
        fI.push(k, k + 1, k + NU + 2, k, k + NU + 2, k + NU + 1);
      }
      fk++;
    }
  }
  const flagGeo = G(new THREE.BufferGeometry());
  flagGeo.setAttribute("position", new THREE.Float32BufferAttribute(fP, 3));
  flagGeo.setAttribute("normal", new THREE.Float32BufferAttribute(fN, 3));
  flagGeo.setAttribute("aFlag", new THREE.Float32BufferAttribute(fA, 4));
  flagGeo.setIndex(fI);
  flagGeo.computeBoundingSphere();
  const flagMat = M(new THREE.MeshStandardMaterial({ color: 0xd0e85c, emissive: 0x161c06, roughness: 0.7, metalness: 0, side: THREE.DoubleSide }));
  flagMat.onBeforeCompile = sh => {
    sh.uniforms.flTime = flTime;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float flTime;\nattribute vec4 aFlag;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n" + FLAG_VERT);
  };
  flagMat.customProgramCacheKey = () => "fl-pitch-flag-1";
  const flags = new THREE.Mesh(flagGeo, flagMat);
  flags.name = "pitch-flags";
  flags.castShadow = false;
  group.add(flags);

  // ---------- wear painting ----------
  let wearDirty = false, wearLive = false, upT = 0, decayT = 0, decayRow = -1, decayHit = false;
  const DECAY_EVERY = 3, DECAY_ROWS = 44;
  // paint an oriented capsule into the wear layer. r and gr are peak amounts (0 to 255) of lifted turf and bare
  // soil; kind shapes them along the mark (t runs 0 to 1 from where it starts to where it ends)
  function stamp(kind, x0, y0, ang, len, wid, r, gr) {
    const ca = Math.cos(ang), sa = Math.sin(ang), rad = wid * 0.5;
    const x1 = x0 + ca * len, y1 = y0 + sa * len;
    const i0 = clamp(Math.floor(((Math.min(x0, x1) - rad - WEAR_X0) / WEAR_SX) * WEAR_W), 1, WEAR_W - 2);
    const i1 = clamp(Math.ceil(((Math.max(x0, x1) + rad - WEAR_X0) / WEAR_SX) * WEAR_W), 1, WEAR_W - 2);
    const j0 = clamp(Math.floor(((Math.min(y0, y1) - rad - WEAR_Z0) / WEAR_SZ) * WEAR_H), 1, WEAR_H - 2);
    const j1 = clamp(Math.ceil(((Math.max(y0, y1) + rad - WEAR_Z0) / WEAR_SZ) * WEAR_H), 1, WEAR_H - 2);
    const sxp = WEAR_SX / WEAR_W, szp = WEAR_SZ / WEAR_H;
    for (let j = j0; j <= j1; j++) {
      const py = WEAR_Z0 + (j + 0.5) * szp;
      for (let i = i0; i <= i1; i++) {
        const px = WEAR_X0 + (i + 0.5) * sxp, rx = px - x0, ry = py - y0;
        const along = rx * ca + ry * sa, across = -rx * sa + ry * ca;
        const out = along < 0 ? -along : along > len ? along - len : 0;
        const d = Math.hypot(out, across) / rad;
        if (d >= 1) continue;
        const n = hash2(i, j), t = len > 0 ? clamp(along / len, 0, 1) : 0;
        const edge = clamp((1 - d * d) * (0.6 + 0.8 * n) - 0.12, 0, 1);
        let ar = 0, ag = 0;
        if (kind === 0) {
          // slide: the scuff grows along the slide, a pile of lifted turf at the end, stud lines dug at the start
          ar = r * edge * (0.5 + 0.5 * t) + (t > 0.82 ? r * 0.45 * edge : 0);
          const studs = Math.exp(-((Math.abs(across) - 0.11) ** 2) / 0.006);
          ag = gr * (studs * (1 - 0.7 * t) + 0.18 * edge) * (0.6 + 0.6 * n);
        } else if (kind === 1) {
          ar = r * edge; ag = gr * edge * n;
        } else {
          ar = r * edge; ag = gr * edge * edge * (0.5 + n);
        }
        const o = (j * WEAR_W + i) * 2;
        wear[o] = Math.min(255, wear[o] + ar);
        wear[o + 1] = Math.min(255, wear[o + 1] + ag);
      }
    }
    wearDirty = true; wearLive = true;
  }
  // kind: "slide" (a long scuffed strip), "dive" (a short wide patch), "skid" (a small scuff: a hard cut or a
  // plant). x, y in sim metres, dir the heading in radians (sim, atan2(dy, dx)), len metres
  function mark(kind, x, y, dir, len) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    let a = typeof dir === "number" ? dir : dir && Number.isFinite(dir.x) ? Math.atan2(dir.y, dir.x) : 0;
    if (!Number.isFinite(a)) a = 0;
    const L = Number.isFinite(len) ? Math.abs(len) : 0;
    if (kind === "slide") stamp(0, x, y, a, clamp(L || 2.6, 0.8, 6), 0.62, 120, 150);
    else if (kind === "dive") stamp(1, x - Math.cos(a) * 0.5, y - Math.sin(a) * 0.5, a, clamp(L * 1.6, 1.2, 2.6), 1.05, 85, 22);
    else stamp(2, x, y, a, clamp(L || 0.5, 0.2, 1.2), 0.5, 70, 80);
  }

  // ---------- net hits ----------
  // goalSide -1 or +1 (which end), y and z in sim metres (across and up), power the ball speed in m/s.
  // An optional x (sim) puts the bulge on the side netting or the roof where the ball actually went in.
  function netHit(goalSide, y, z, power, x) {
    const s = goalSide < 0 ? -1 : 1;
    const yy = clamp(Number.isFinite(y) ? y : 0, -GH, GH), zz = clamp(Number.isFinite(z) ? z : 1, 0, BAR_H);
    const pw = Math.abs(Number.isFinite(power) ? power : 8);
    let hx = s * (HALF_L + GD);
    if (Number.isFinite(x)) hx = s * clamp(Math.abs(x), HALF_L + 0.2, HALF_L + GD);
    else if (Math.abs(yy) > GH - 0.25 || zz > BAR_H - 0.25) hx = s * (HALF_L + GD * 0.55);
    // reuse a free slot, or the oldest one
    let k = -1;
    for (let i = 0; i < 4; i++) if (!hits[i].on) { k = i; break; }
    if (k < 0) { k = hitNext; hitNext = (hitNext + 1) % 4; }
    const h = hits[k];
    h.on = true; h.age = 0; h.amp = clamp(0.06 + pw * 0.022, 0.08, 0.55);
    hitVecs[k].set(hx, zz, yy, clamp(0.55 + pw * 0.02, 0.6, 1.15));
  }

  let time = 0;
  function update(dt) {
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
    time += dt;
    flTime.value = time;
    const ha = nU.flHitA.value;
    for (let k = 0; k < 4; k++) {
      const h = hits[k];
      if (!h.on) { ha[k] = 0; continue; }
      h.age += dt;
      ha[k] = (h.amp * Math.exp(-NET_Z * NET_W * h.age) * Math.sin(NET_WD * h.age)) / NET_PEAK;
      if (h.age > 2.6) { h.on = false; ha[k] = 0; }
    }
    // marks fade very slowly: every few seconds a pass over the layer, a slice of rows a frame
    if (wearLive) {
      if (decayRow < 0) { decayT += dt; if (decayT >= DECAY_EVERY) { decayT = 0; decayRow = 0; decayHit = false; } }
      if (decayRow >= 0) {
        const end = Math.min(WEAR_H, decayRow + DECAY_ROWS);
        for (let o = decayRow * WEAR_W * 2, oe = end * WEAR_W * 2; o < oe; o++) {
          const v = wear[o];
          if (v) { wear[o] = v - (v >> 6) - 1; decayHit = true; }
        }
        decayRow = end;
        if (decayRow >= WEAR_H) { decayRow = -1; wearDirty = true; if (!decayHit) wearLive = false; }
      }
    }
    // uploads are batched: at most one every 0.2 s
    upT += dt;
    if (wearDirty && upT >= 0.2) { wearTex.needsUpdate = true; wearDirty = false; upT = 0; }
  }

  function setQuality(q) {
    quality = clamp(q | 0, 0, 2);
    groundMat.normalScale.setScalar([0.25, 0.42, 0.6][quality]);
    gU.flDetail.value = [0.4, 0.75, 1][quality];
  }
  setQuality(quality);

  let dead = false;
  function dispose() {
    if (dead) return;
    dead = true;
    for (const x of geos) x.dispose();
    for (const x of mats) x.dispose();
    for (const x of texs) x.dispose();
    group.clear();
  }

  return { group, update, mark, netHit, setQuality, dispose };
}

// merge a list of { geo, color } into one indexed geometry with position, normal and color
function mergeColoured(THREE, parts) {
  let nv = 0, ni = 0;
  for (const p of parts) { nv += p.geo.attributes.position.count; ni += p.geo.index ? p.geo.index.count : p.geo.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const p of parts) {
    const P = p.geo.attributes.position, N = p.geo.attributes.normal, c = p.color;
    pos.set(P.array, vo * 3);
    nor.set(N.array, vo * 3);
    for (let i = 0; i < P.count; i++) { col[(vo + i) * 3] = c.r; col[(vo + i) * 3 + 1] = c.g; col[(vo + i) * 3 + 2] = c.b; }
    if (p.geo.index) { const a = p.geo.index.array; for (let i = 0; i < a.length; i++) idx[io++] = a[i] + vo; }
    else for (let i = 0; i < P.count; i++) idx[io++] = vo + i;
    vo += P.count;
    p.geo.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}

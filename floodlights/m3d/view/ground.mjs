// Floodlights 3D match view: a school, college or academy ground, in place of the stadium. Player Career only
// (a match with a venue); Manager Career matches never come here.
// A school: the pitch in the school grounds, no stands, a few people standing along the touchlines, the school
// buildings round the field, trees, daylight. A college: the same with a small stand partly filled along the far
// side and bigger campus buildings behind it. An academy: the club's training ground, a small stand, the glass
// main building in the club's colours.
// Same shape as createStadium: { group, update, react, setQuality, dispose, info }. Static scenery is merged
// into one mesh (one draw call); the people are two instanced meshes (bodies and heads) that bob, turn to the
// ball and jump for their side's goals. three.js is handed in, never imported; no textures, so it builds in node.
// Axes: three.x = sim x, three.y = up, three.z = sim y; the broadcast camera sits on the +z side.
import { HALF_L, HALF_W } from "../consts.mjs";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
const SKINS = ["#f1d2b8", "#e2b48f", "#c98f66", "#a86f49", "#8a5636", "#6b3f26"];
const CASUAL = ["#2a3a5a", "#c8202a", "#e8e4dc", "#3a5a3a", "#1a1a1a", "#d8a878", "#7d8fb3", "#5a4a8a", "#f0c419"];

export function createGround(THREE, ctx) {
  ctx = ctx || {};
  const v = ctx.venue || {};
  const kind = v.kind === "college" ? "college" : v.kind === "academy" ? "academy" : "school";
  const sd = clamp(Number(v.standing) || 5, 1, 10);
  const rnd = rng((Number(v.seed) || 7) >>> 0);
  const cols = Array.isArray(v.cols) && v.cols.length === 2 ? v.cols : ["#1e3a8a", "#f4f4f4"];
  const crowdK = clamp(Number(v.crowd) || 0.3, 0.05, 1);
  const group = new THREE.Group();
  group.name = "ground";
  const geos = [], mats = [];

  // ---------- the static scenery: boxes with vertex colours, merged into one mesh ----------
  const pos = [], nor = [], col = [];
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
  const cA = new THREE.Color();
  function push(g, x, y, z, ry, c) {
    const ng = g.index ? g.toNonIndexed() : g;
    tmpE.set(0, ry || 0, 0);
    tmpQ.setFromEuler(tmpE);
    tmpM.compose(tmpP.set(x, y, z), tmpQ, tmpS.set(1, 1, 1));
    ng.applyMatrix4(tmpM);
    const P = ng.getAttribute("position"), N = ng.getAttribute("normal");
    cA.set(c);
    for (let i = 0; i < P.count; i++) {
      pos.push(P.getX(i), P.getY(i), P.getZ(i));
      nor.push(N.getX(i), N.getY(i), N.getZ(i));
      col.push(cA.r, cA.g, cA.b);
    }
    ng.dispose();
    if (ng !== g) g.dispose();
  }
  const box = (w, h, d, x, y, z, c, ry) => push(new THREE.BoxGeometry(w, h, d), x, y, z, ry, c);
  const cone = (r, h, x, y, z, c) => push(new THREE.ConeGeometry(r, h, 7), x, y, z, 0, c);
  const ball = (r, x, y, z, c) => push(new THREE.IcosahedronGeometry(r, 1), x, y, z, 0, c);

  // the ground round the pitch, and a path along the near side
  const grass = kind === "school" && sd <= 3 ? "#7f8a4e" : "#5f8a48";
  const flat = new THREE.PlaneGeometry(520, 420);
  flat.rotateX(-Math.PI / 2);
  push(flat, 0, -0.03, 0, 0, grass);
  if (kind === "college" && sd >= 8) {
    // a running track round the pitch
    const tr = new THREE.PlaneGeometry(HALF_L * 2 + 26, HALF_W * 2 + 24);
    tr.rotateX(-Math.PI / 2);
    push(tr, 0, -0.02, 0, 0, "#a5462f");
  }
  // a building: a block, window bands per floor, a roof line, in the place's own colours
  const WALLS = ["#e9dfc9", "#d9c7a8", "#c97b5a", "#e6e2d8", "#cfc3ad", "#eceae4"];
  function building(x, z, w, d, floors, ry, glassy, wall, band) {
    const h = floors * 3.4 + 0.8;
    box(w, h, d, x, h / 2, z, wall, ry);
    const fx = Math.sin(ry), fz = Math.cos(ry);
    for (let f = 0; f < floors; f++) {
      const y = 1.9 + f * 3.4;
      // the windows face the pitch (the building's +z after its turn)
      box(w - 2, glassy ? 2.6 : 1.5, 0.12, x + fx * (d / 2 + 0.05), y, z + fz * (d / 2 + 0.05), glassy ? "#4a6a88" : "#2a3442", ry);
    }
    box(w + 0.4, 0.5, d + 0.4, x, h + 0.25, z, band || "#8a8f96", ry);
  }
  const wall = WALLS[Math.floor(rnd() * WALLS.length)];
  const far = -(HALF_W + 24), endX = HALF_L + 28;
  if (kind === "school") {
    const floors = 2 + (sd >= 7 ? 1 : 0);
    building(-14, far - 6, 74, 14, floors, 0, false, wall, cols[0]);
    building(-endX - 10, -6, 40, 13, floors, Math.PI / 2, false, wall, cols[0]);
    building(endX + 6, far + 4, 26, 12, 1, -0.3, false, wall, cols[0]);
  } else if (kind === "college") {
    const floors = 3 + (sd >= 8 ? 1 : 0);
    building(-22, far - 14, 64, 16, floors, 0, sd >= 5, sd >= 6 ? "#eceae4" : "#e2d8c6", "#2f3338");
    building(36, far - 10, 36, 18, floors - 1, -0.2, sd >= 7, "#d7cfc0", cols[0]);
    building(-endX - 14, -2, 46, 16, floors, Math.PI / 2, sd >= 5, "#e2d8c6", "#2f3338");
  } else {
    // the club's main building: glass all round, a band in the club's colour
    building(endX + 12, -10, 46, 30, sd >= 6 ? 2 : 1, -Math.PI / 2, true, "#eef0ec", cols[0]);
    building(-20, far - 20, 40, 16, 1, 0, true, "#e6e8e4", cols[0]);
    // the other pitches beyond, and their floodlights at a bigger club
    const p2 = new THREE.PlaneGeometry(70, 46);
    p2.rotateX(-Math.PI / 2);
    push(p2, -HALF_L - 60, -0.02, -20, 0, "#5a8f45");
    if (sd >= 7) for (const [x, z] of [[-HALF_L - 26, HALF_W + 12], [-HALF_L - 94, HALF_W + 12], [-HALF_L - 26, -HALF_W - 30], [-HALF_L - 94, -HALF_W - 30]]) {
      box(0.5, 16, 0.5, x, 8, z, "#9aa3ad", 0);
      box(3, 1.2, 0.5, x, 16.4, z, "#f4f6ff", 0);
    }
  }
  // a fence or a wall round it all, the trees, benches on the near side
  const fenceCol = kind === "academy" ? "#3d5a3a" : kind === "college" ? "#2f3338" : "#c9b8a0";
  const FX = HALF_L + 22, FZ = HALF_W + 20;
  box(FX * 2, kind === "school" ? 2.2 : 2.6, 0.3, 0, kind === "school" ? 1.1 : 1.3, -FZ, fenceCol, 0);
  for (const sx of [-1, 1]) box(0.3, kind === "school" ? 2.2 : 2.6, FZ * 2, sx * FX, kind === "school" ? 1.1 : 1.3, 0, fenceCol, 0);
  for (let i = 0; i < 26; i++) {
    const t = i / 26;
    const along = t < 0.5;
    const x = along ? -FX + 4 + t * 2 * (FX * 2 - 8) : (t < 0.75 ? -1 : 1) * (FX + 6 + rnd() * 8);
    const z = along ? -FZ - 6 - rnd() * 6 : -FZ + 10 + (t % 0.25) * 4 * (FZ * 2 - 20);
    const s = 0.8 + rnd() * 0.6;
    box(0.4 * s, 3 * s, 0.4 * s, x, 1.5 * s, z, "#5a4030", 0);
    if (rnd() < 0.5) cone(2.6 * s, 6 * s, x, 3 * s + 3 * s, z, "#2f5f33");
    else ball(2.8 * s, x, 4.4 * s, z, "#3d6b35");
  }
  // the teams' benches (proper dugouts at the academy) on the near side
  for (const sx of [-1, 1]) {
    if (kind === "academy") {
      box(8, 2.2, 1.8, sx * 9, 1.1, HALF_W + 6, "#1a1c20", 0);
      box(8, 0.12, 2.2, sx * 9, 2.25, HALF_W + 6, cols[0], 0);
    } else box(4, 0.45, 0.5, sx * 9, 0.25, HALF_W + 5, "#8a6a4a", 0);
  }
  // the college stand along the far side: rows of steps with benches, a roof at the better ones
  const seats = [];
  if (kind !== "school") {
    const rows = kind === "college" ? 4 + Math.floor(sd / 3) : 4;
    const len = kind === "college" ? 34 + sd * 3 : 30;
    const z0 = -HALF_W - 6;
    for (let r = 0; r < rows; r++) {
      const y = 0.45 + r * 0.45, z = z0 - r * 0.8;
      box(len, 0.45, 0.8, 0, y - 0.22, z, "#8f949c", 0);
      box(len, 0.08, 0.36, 0, y + 0.04, z + 0.1, kind === "academy" ? cols[0] : r % 2 ? cols[0] : "#d8d8dc", 0);
      for (let i = 0; i < Math.floor(len / 0.6); i++) seats.push({ x: -len / 2 + 0.3 + i * 0.6, y: y + 0.08, z: z + 0.05 });
    }
    box(len, rows * 0.45 + 0.6, 0.4, 0, (rows * 0.45 + 0.6) / 2, z0 - rows * 0.8 - 0.1, "#6f747c", 0);
    if (sd >= 7 || kind === "academy") {
      box(len + 1, 0.2, rows * 0.8 + 2, 0, rows * 0.45 + 2.6, z0 - rows * 0.4 + 0.4, "#2a2e34", 0);
      for (const sx of [-1, 1]) box(0.3, rows * 0.45 + 2.6, 0.3, sx * len / 2, (rows * 0.45 + 2.6) / 2, z0 - rows * 0.8 + 0.2, "#2a2e34", 0);
    }
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  sg.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  sg.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  sg.computeBoundingSphere();
  const sm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  geos.push(sg); mats.push(sm);
  const scenery = new THREE.Mesh(sg, sm);
  scenery.receiveShadow = true;
  group.add(scenery);

  // ---------- the people watching ----------
  // standing along the touchlines (a school has only these), and sat in the stand when there is one
  const standers = [];
  const nStand = kind === "school" ? Math.round(14 + sd * 1.4) : kind === "college" ? 10 : 18;
  for (let i = 0; i < nStand; i++) {
    const nearSide = rnd() < 0.55;
    const z = nearSide ? HALF_W + 3 + rnd() * 2.5 : -HALF_W - 3 - rnd() * 2.5;
    let x = (rnd() * 2 - 1) * (HALF_L - 6);
    if (nearSide && Math.abs(x) < 13) x += x < 0 ? -12 : 12;
    standers.push({ x, y: 0, z, sit: false });
  }
  const fill = Math.min(seats.length, Math.round(seats.length * (kind === "college" ? 0.25 + crowdK * 0.6 : 0.4 + crowdK * 0.4)));
  for (let i = seats.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = seats[i]; seats[i] = seats[j]; seats[j] = t; }
  const folk = standers.concat(seats.slice(0, fill).map(s => Object.assign({ sit: true }, s)));
  const n = folk.length;
  // one low poly person: legs and a body (the shirt colour goes on per person), a head (skin per person)
  const bodyG = new THREE.BoxGeometry(0.48, 0.66, 0.3);
  bodyG.translate(0, 1.18, 0);
  const legG = new THREE.BoxGeometry(0.34, 0.86, 0.2);
  legG.translate(0, 0.43, 0);
  const bodyMerged = mergeSimple(THREE, [bodyG, legG]);
  bodyG.dispose(); legG.dispose();
  const headG = new THREE.IcosahedronGeometry(0.15, 1);
  headG.translate(0, 1.63, 0);
  const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  const headMat = new THREE.MeshStandardMaterial({ roughness: 0.7 });
  geos.push(bodyMerged, headG); mats.push(bodyMat, headMat);
  const bodies = new THREE.InstancedMesh(bodyMerged, bodyMat, Math.max(1, n));
  const heads = new THREE.InstancedMesh(headG, headMat, Math.max(1, n));
  bodies.count = n; heads.count = n;
  const shirts = kind === "school" ? ["#f4f4f4", "#f4f4f4", cols[0], "#e8e4dc", "#2a3a5a"] : kind === "academy" ? [cols[0], cols[0], "#1a1a1a", "#e8e4dc", "#2a3a5a"] : CASUAL;
  const cc = new THREE.Color();
  // who each one cheers for: most of them for the home side
  const side = new Float32Array(n), phase = new Float32Array(n), base = [];
  for (let i = 0; i < n; i++) {
    bodies.setColorAt(i, cc.set(shirts[Math.floor(rnd() * shirts.length)]));
    heads.setColorAt(i, cc.set(SKINS[Math.floor(rnd() * SKINS.length)]));
    side[i] = rnd() < 0.78 ? 0 : 1;
    phase[i] = rnd() * 6.28;
    base.push({ x: folk[i].x, y: folk[i].sit ? folk[i].y - 0.5 : 0, z: folk[i].z, ry: folk[i].z > 0 ? Math.PI : 0 });
  }
  bodies.instanceColor.needsUpdate = true;
  heads.instanceColor.needsUpdate = true;
  bodies.frustumCulled = false; heads.frustumCulled = false;
  group.add(bodies, heads);

  // ---------- reactions ----------
  const st = { goalT: 0, goalTeam: 0, stand: 0, hold: 0 };
  function react(kindR, power) {
    const pw = Number.isFinite(power) ? power : 1;
    if (kindR === "goal") { st.goalT = 6; st.goalTeam = pw < 0 ? 1 : 0; }
    else if (kindR === "chance" || kindR === "save") { st.stand = 1; st.hold = 1.2; }
    else if (kindR === "calm") { st.goalT = 0; st.hold = 0; }
  }
  let time = 0;
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), s4 = new THREE.Vector3(1, 1, 1), p4 = new THREE.Vector3();
  function update(dt) {
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
    time += dt;
    if (st.goalT > 0) st.goalT -= dt;
    if (st.hold > 0) st.hold -= dt; else st.stand = Math.max(0, st.stand - dt);
    for (let i = 0; i < n; i++) {
      const b = base[i];
      const mine = st.goalT > 0 && side[i] === st.goalTeam;
      const jump = mine ? Math.abs(Math.sin(time * 9 + phase[i])) * 0.35 : 0;
      const bob = Math.sin(time * 1.7 + phase[i]) * 0.015 + st.stand * 0.04;
      e4.set(0, b.ry + Math.sin(time * 0.4 + phase[i]) * 0.25, 0);
      q4.setFromEuler(e4);
      m4.compose(p4.set(b.x, b.y + jump + bob, b.z), q4, s4);
      bodies.setMatrixAt(i, m4);
      heads.setMatrixAt(i, m4);
    }
    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
  }
  update(0);
  function setQuality() {}
  function dispose() {
    for (const g of geos) g.dispose();
    for (const m of mats) m.dispose();
  }
  return { group, update, react, setQuality, dispose, info: { kind, people: n, seats: seats.length } };
}

// a couple of geometries into one (positions and normals only)
function mergeSimple(THREE, list) {
  const pos = [], nor = [];
  for (const g of list) {
    const ng = g.index ? g.toNonIndexed() : g;
    const P = ng.getAttribute("position"), N = ng.getAttribute("normal");
    for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); }
    if (ng !== g) ng.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  out.computeBoundingSphere();
  return out;
}

// what the light and the sky look like at a ground in the day (the view applies it)
export const DAYLIGHT = { sky: 0x9cc4e6, fog: [0xcfe0ec, 220, 640], hemi: [0xe6f0ff, 0x6c7a4a, 1.2], sun: [0xfff1dc, 2.6], sunPos: [-40, 110, 60], fills: [0.35, 0.25, 0.1], exposure: 1.12 };

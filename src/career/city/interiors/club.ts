/**
 * The nightclub: dark, a lit dance floor whose tiles change colour with the beat, a DJ on a stage in front of a
 * screen, beams of coloured light sweeping the room, a long bar lit from behind, VIP booths. Under eighteen, the
 * rope stays shut: the bouncer stands in the way and the night out card says why.
 */
import * as THREE from "three";
import type { WorldPlace } from "../../types";
import { rbox, cyl, plane, mat, glass, glow, cone, lightCone } from "../kit3d";
import { Kit, surfMat, goodsMat, people, shaded, type Room } from "./common";
import { prodGeo } from "./goods";

export function clubRoom(k: Kit, p: WorldPlace): Room {
  const W = 22,
    D = 18,
    H = 5.5;
  const st = p.style;
  const pink = st.accent || "#ff2e7a",
    violet = st.trim || "#7d3cff";
  const old = k.st.player.age >= (p.minAge ?? 18);
  const R = k.rnd;
  // ---------- the shell ----------
  k.floor(W, D, surfMat("concrete", "#16141c"), 0, 0, 4);
  const wallM = mat(st.wall || "#16121f", { rough: 0.9 });
  const walls = k.shell(W, D, H, wallM, { skip: ["s"] });
  for (const [wg, len] of [
    [walls.n!, W],
    [walls.w!, D],
    [walls.e!, D],
  ] as [THREE.Object3D, number][]) {
    k.mount(wg, rbox(len, 0.04, 0.03, 0.01), glow(pink, 2.2), 0, 0.25, 0.13);
    k.mount(wg, rbox(len, 0.03, 0.03, 0.01), glow(violet, 2.0), 0, H - 0.6, 0.13);
  }
  // the way in: a corridor at the front left, the rope, the bouncer
  const ex = 0;
  k.wall(W / 2, D / 2, ex + 1.4, D / 2, H, wallM, {});
  k.wall(ex - 1.4, D / 2, -W / 2, D / 2, H, wallM, {});
  const head = k.wall(ex + 1.4, D / 2, ex - 1.4, D / 2, H, wallM, { solid: false, low: 2.6 });
  k.mount(head, plane(2.6, 0.5), glow(pink, 1.4), 0, 3.0, 0.13);
  k.text(p.name.toUpperCase(), "#ffffff", "transparent", ex, 3.0, D / 2 - 0.12, 2.6, 0.5, Math.PI);
  const corridor = mat("#0e0c12", { rough: 0.9 });
  k.box(0.2, 1.1, 4.2, corridor, ex + 1.5, 0.55, D / 2 - 2.1);
  k.add(rbox(0.22, 0.04, 4.2, 0.01), glow(pink, 1.8), ex + 1.5, 1.12, D / 2 - 2.1, 0, { shadow: false });
  k.block(ex + 1.5, D / 2 - 2.1, 0.12, 2.1);
  k.spot("door", "Way out", ex, D / 2 - 0.6, { r: 1.0, y: 1.8 });
  // the rope: brass posts and red velvet; under age it blocks the way in
  const ropeZ = D / 2 - 3.6;
  for (const sx of [-1, 1]) k.add(cyl(0.05, 0.08, 1.0, 10), mat("#c9a24a", { metal: 1, rough: 0.25 }), ex + sx * 1.2, 0.5, ropeZ);
  if (!old) k.add(cyl(0.035, 0.035, 2.4, 8), mat("#8a0a1a", { rough: 0.7 }), ex, 0.85, ropeZ, 0, { rz: Math.PI / 2 });
  people(k, "bouncer", [{ x: ex + (old ? 1.9 : 0.3), z: ropeZ - 0.5, ry: 0, col: "#0b0b0b" }]);
  if (!old) k.block(ex, ropeZ, 1.4, 0.2);
  k.circle(ex + (old ? 1.9 : 0.3), ropeZ - 0.5, 0.35);
  // ---------- the dance floor: tiles that light up ----------
  const fx = 0,
    fz = -2.2,
    n = 8,
    m = 6,
    t = 0.9;
  const tileG = shaded(new THREE.BoxGeometry(t - 0.05, 0.06, t - 0.05));
  const tileM = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  k.own.push(tileM);
  const tiles = new THREE.InstancedMesh(tileG, tileM, n * m);
  const mm = new THREE.Matrix4();
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) tiles.setMatrixAt(i * m + j, mm.makeTranslation(fx + (i - (n - 1) / 2) * t, 0.03, fz + (j - (m - 1) / 2) * t));
  const cols = [new THREE.Color(pink), new THREE.Color(violet), new THREE.Color("#2ad8ff"), new THREE.Color("#ffd23f")];
  const c = new THREE.Color();
  for (let i = 0; i < n * m; i++) tiles.setColorAt(i, cols[i % 4]);
  k.g.add(tiles);
  k.own.push(tileG);
  k.box(n * t + 0.3, 0.05, m * t + 0.3, mat("#0a0a0a"), fx, 0.02, fz);
  // ---------- the stage, the DJ and the screen behind ----------
  k.box(9, 0.8, 3.4, mat("#0c0c10", { rough: 0.6 }), fx, 0.4, -D / 2 + 1.7);
  k.box(2.6, 1.1, 0.9, mat("#1a1a20", { rough: 0.4 }), fx, 1.35, -D / 2 + 2.2);
  k.add(rbox(2.4, 0.04, 0.7, 0.01), glow(violet, 1.0), fx, 1.92, -D / 2 + 2.2, 0, { shadow: false });
  for (const sx of [-0.6, 0.6]) k.add(cyl(0.18, 0.18, 0.04, 20), mat("#2a2a30", { metal: 0.6 }), fx + sx, 1.95, -D / 2 + 2.2);
  people(k, "dj", [{ x: fx, z: -D / 2 + 1.5, ry: 0, col: "#111111" }]);
  for (const sx of [-1, 1]) {
    k.box(1.0, 2.2, 0.9, mat("#0a0a0c", { rough: 0.5 }), fx + sx * 4.0, 1.9, -D / 2 + 1.0);
    k.add(cyl(0.3, 0.3, 0.05, 20), mat("#1a1a1a"), fx + sx * 4.0, 2.4, -D / 2 + 1.46, 0, { rx: Math.PI / 2 });
  }
  k.block(fx, -D / 2 + 1.7, 4.5, 1.75);
  const scrT = clubScreen(pink, violet);
  const scr = new THREE.MeshBasicMaterial({ map: scrT, toneMapped: false });
  k.own.push(scr, scrT);
  k.add(plane(10, 3.2), scr, fx, 2.9, -D / 2 + 0.13, 0, { shadow: false });
  // ---------- the bar along the right wall, lit from behind ----------
  const bx = W / 2 - 1.6;
  k.box(1.0, 1.1, 8, mat("#0e0e12", { rough: 0.3, metal: 0.3 }), bx, 0.55, 0);
  k.add(rbox(1.1, 0.05, 8.1, 0.01), glow(pink, 0.9), bx, 1.12, 0, 0, { shadow: false });
  k.add(rbox(0.04, 0.05, 8.0, 0.01), glow(violet, 2.0), bx - 0.53, 0.2, 0, 0, { shadow: false });
  k.mount(walls.e!, plane(8, 2.0), glow("#ffb070", 0.45), 0, 2.0, 0.16);
  for (const y of [1.5, 2.1, 2.7]) k.mount(walls.e!, rbox(8, 0.03, 0.3, 0.005), glass("#e8eef2", 0.4), 0, y, 0.3);
  for (const y of [1.52, 2.12, 2.72])
    for (let z = -3.8; z < 3.8; z += 0.16)
      k.inst("bottle", () => prodGeo("bottle"), goodsMat("gloss"), W / 2 - 0.3, y, z, { col: ["#2a6a3a", "#c89a4a", "#e8e4dc", "#6a2a2a", "#3a5a8a"][Math.floor(R() * 5)] });
  for (let i = 0; i < 6; i++) k.add(cyl(0.2, 0.2, 0.05, 14), mat("#c9a24a", { metal: 1, rough: 0.3 }), bx - 1.0, 0.75, -3 + i * 1.2);
  k.block(bx, 0, 0.55, 4.05);
  people(k, "staff", [{ x: W / 2 - 0.65, z: -1, ry: -Math.PI / 2, col: "#111111" }]);
  // ---------- VIP booths on the left ----------
  const vipM = mat("#5a0a2a", { rough: 0.7 });
  for (let i = 0; i < 2; i++) {
    const vz = -4 + i * 4.6;
    k.box(1.0, 0.45, 3.0, vipM, -W / 2 + 0.9, 0.23, vz, 0, 0.1);
    k.box(0.25, 0.9, 3.0, vipM, -W / 2 + 0.5, 0.6, vz, 0, 0.06);
    k.box(1.0, 0.06, 1.6, mat("#111111", { rough: 0.1, metal: 0.4 }), -W / 2 + 2.2, 0.5, vz);
    k.add(cyl(0.06, 0.06, 0.5, 8), mat("#c9a24a", { metal: 1 }), -W / 2 + 2.2, 0.25, vz);
    for (let b = 0; b < 3; b++) k.inst("bottle", () => prodGeo("bottle"), goodsMat("gloss"), -W / 2 + 2.0 + b * 0.18, 0.53, vz + 0.2, { col: b === 1 ? "#e8d080" : "#1a3a2a" });
    k.block(-W / 2 + 1.5, vz, 1.2, 1.55);
    k.pool(-W / 2 + 1.8, vz, 3, violet, 0.3);
  }
  k.text("VIP", "#ffffff", "transparent", -W / 2 + 0.14, 2.6, -1.7, 1.2, 0.6, Math.PI / 2);
  // ---------- the crowd, the beams, the lights ----------
  const crowd: { x: number; z: number; ry: number; col: string }[] = [];
  for (let i = 0; i < Math.round(26 * k.dense); i++) {
    const x = fx + (R() - 0.5) * (n * t - 0.6),
      z = fz + (R() - 0.5) * (m * t - 0.6);
    if (Math.hypot(x - fx, z - fz - 1.4) < 1.0) continue;
    crowd.push({ x, z, ry: R() * 6.28, col: ["#e8e4dc", "#111111", pink, "#2a3a5a", "#c8c8c8", violet][Math.floor(R() * 6)] });
  }
  people(k, "crowd", crowd);
  const beams: THREE.Object3D[] = [];
  const bcol = [pink, violet, "#2ad8ff", "#ffffff", pink, violet];
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(cone(0.9, 6.5), lightCone(bcol[i], 0.6));
    const pivot = new THREE.Group();
    pivot.position.set(fx - 5 + i * 2, H - 0.3, -D / 2 + 3.4);
    b.position.y = -3.25;
    pivot.add(b);
    k.g.add(pivot);
    beams.push(pivot);
    k.add(cyl(0.16, 0.2, 0.3, 10), mat("#111111", { metal: 0.6 }), fx - 5 + i * 2, H - 0.2, -D / 2 + 3.4, 0, { shadow: false });
  }
  k.box(12, 0.12, 0.12, mat("#222222", { metal: 0.6 }), fx, H - 0.1, -D / 2 + 3.4);
  // a mirror ball
  k.add(new THREE.IcosahedronGeometry(0.4, 1), mat("#d8dce2", { metal: 1, rough: 0.1, flat: true }), fx, H - 1.2, fz, 0, { shadow: false });
  k.pool(fx, fz, 9, pink, 0.16);
  // ---------- what he can do here ----------
  if (old) {
    k.spot("night", "Night out", fx, fz + m * t * 0.5 + 0.6, { r: 1.6, y: 1.6 });
    k.spot("menu:vip", "VIP table", -W / 2 + 2.8, 0.6, { ax: -W / 2 + 1.4, az: 0.6, r: 1.3, y: 1.4 });
  } else k.spot("night", "Over 18s only", ex, ropeZ + 0.9, { r: 1.3, y: 1.6, tag: true });
  // the beat: tiles flick through the colours, the beams sweep, the dancers bob
  const base = new Map<THREE.InstancedMesh, THREE.Matrix4[]>();
  k.ticks.push((time) => {
    const beat = Math.floor(time * 2.1);
    for (let i = 0; i < n * m; i++) {
      const on = (i * 7 + beat * 3) % 5 === 0 || (i + beat) % 9 === 0;
      c.copy(cols[(i + beat) % 4]).multiplyScalar(on ? 1.8 : 0.35);
      tiles.setColorAt(i, c);
    }
    tiles.instanceColor!.needsUpdate = true;
    beams.forEach((b, i) => {
      b.rotation.z = Math.sin(time * (0.6 + i * 0.13) + i) * 0.55;
      b.rotation.x = 0.35 + Math.cos(time * (0.5 + i * 0.11) + i * 2) * 0.35;
    });
    for (const key of ["crowdbody", "crowdhead"]) {
      const cm = k.bankMeshes.get(key);
      if (!cm) continue;
      let b0 = base.get(cm);
      if (!b0) {
        b0 = [];
        for (let i = 0; i < cm.count; i++) b0.push(new THREE.Matrix4().fromArray(cm.instanceMatrix.array as Float32Array, i * 16));
        base.set(cm, b0);
      }
      for (let i = 0; i < cm.count; i++) {
        mm.copy(b0[i]);
        mm.elements[13] += Math.abs(Math.sin(time * 4.2 + i * 1.7)) * 0.12;
        cm.setMatrixAt(i, mm);
      }
      cm.instanceMatrix.needsUpdate = true;
    }
  });
  return k.finish({
    w: W,
    d: D,
    spawn: [ex, D / 2 - 1.6],
    mood: "night",
    light: {
      sky: violet,
      ground: "#0a0612",
      hemi: 0.35,
      key: pink,
      keyI: 0.35,
      bg: "#030206",
      points: [
        { x: fx, y: 4, z: fz, col: pink, i: 14, dist: 16 },
        { x: W / 2 - 2, y: 3, z: 0, col: "#ffb070", i: 6, dist: 10 },
      ],
    },
    accent: pink,
    apron: "#050408",
  });
}

/** the screen behind the DJ: bars of colour and the club's own glow */
function clubScreen(a: string, b: string) {
  const cv = document.createElement("canvas");
  cv.width = 1024;
  cv.height = 320;
  const x = cv.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 1024, 0);
  g.addColorStop(0, b);
  g.addColorStop(0.5, a);
  g.addColorStop(1, b);
  x.fillStyle = "#050308";
  x.fillRect(0, 0, 1024, 320);
  for (let i = 0; i < 64; i++) {
    const hh = 40 + Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23)) * 240;
    x.fillStyle = g;
    x.fillRect(i * 16 + 2, 320 - hh, 12, hh);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

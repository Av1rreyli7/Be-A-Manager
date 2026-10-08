/**
 * The sports clinic: a bright reception with a desk and a waiting area, the doctor's room with a scan on the
 * light box (the check up), and the treatment room with the physio table, bands, a bike and rollers (the
 * treatment that takes a week off an injury).
 */
import * as THREE from "three";
import type { WorldPlace } from "../../types";
import { rbox, cyl, mat, glass, glow, cachedTexture } from "../kit3d";
import { Kit, surfMat, shopLight, people, plant, type Room } from "./common";

export function clinicRoom(k: Kit, p: WorldPlace): Room {
  const W = 20,
    D = 14,
    H = 3.4;
  const st = p.style;
  const acc = st.accent || "#2a9d8f";
  const white = mat("#f8fafb", { rough: 0.6 });
  // ---------- the shell, split into reception (front) and two rooms (back) ----------
  k.floor(W, D, surfMat("tile", "#dfe6e8", "#c4ced2", { rough: 0.3 }), 0, 0, 1.6);
  const wallM = mat(st.wall || "#ffffff", { rough: 0.9 });
  const walls = k.shell(W, D, H, wallM, { skip: ["s"] });
  for (const [wg, len] of [
    [walls.n!, W],
    [walls.w!, D],
    [walls.e!, D],
  ] as [THREE.Object3D, number][])
    k.mount(wg, rbox(len, 0.12, 0.03, 0.01), mat(acc, { rough: 0.5 }), 0, 1.0, 0.12);
  const gap = 2.2;
  k.wall(W / 2, D / 2, gap / 2, D / 2, H, wallM, {});
  k.wall(-gap / 2, D / 2, -W / 2, D / 2, H, wallM, {});
  const head = k.wall(gap / 2, D / 2, -gap / 2, D / 2, H, wallM, { solid: false, low: 2.6 });
  k.mount(head, rbox(gap + 0.2, 0.08, 0.24, 0.02), mat(acc), 0, 2.6, 0);
  k.spot("door", "Way out", 0, D / 2 - 0.6, { r: 1.0, y: 1.6 });
  // the partition between reception and the two rooms (glass in the middle), and between the two rooms
  const pz = -1;
  // frosted glass above a low wall, so the rooms read from the camera
  const frost = mat("#e6f4f2", { rough: 0.3, opacity: 0.32 });
  const low = mat(acc, { rough: 0.6 });
  for (const [x1, x2] of [
    [-W / 2, -3.2],
    [3.2, W / 2],
  ]) {
    const wg = k.wall(x1, pz, x2, pz, 2.4, frost, { inner: true, thick: 0.06 });
    k.mount(wg, rbox(Math.abs(x2 - x1), 1.0, 0.12, 0.01), low, 0, 0.5, 0);
  }
  const mid = k.wall(0, -D / 2, 0, pz, 2.4, frost, { inner: true, thick: 0.06 });
  k.mount(mid, rbox(D / 2 + pz, 1.0, 0.12, 0.01), low, 0, 0.5, 0);
  for (const x of [-2.3, 2.3]) {
    k.sign(signTex(x < 0 ? "DOCTOR" : "PHYSIO", acc), x, 2.3, pz + 0.05, 1.6, 0.35, 0);
    k.add(rbox(0.02, 0.6, 0.02, 0.005), mat("#c8ccd2"), x - 0.6, 2.75, pz + 0.05);
    k.add(rbox(0.02, 0.6, 0.02, 0.005), mat("#c8ccd2"), x + 0.6, 2.75, pz + 0.05);
  }
  // ---------- reception ----------
  k.box(3.6, 1.05, 0.8, white, 4.5, 0.53, 3.2, 0, 0.04);
  k.box(3.7, 0.05, 0.9, mat(acc, { rough: 0.4 }), 4.5, 1.08, 3.2);
  k.add(rbox(0.5, 0.32, 0.02, 0.005), glow("#bfe8ff", 0.7), 4.0, 1.3, 2.95, 0, { shadow: false });
  people(k, "staff", [{ x: 4.5, z: 2.4, ry: 0, col: acc }]);
  k.block(4.5, 3.0, 1.85, 0.7);
  k.sign(signTex(p.name.toUpperCase(), acc), 2.8, 2.5, 0.13, 3.4, 0.74, 0, { to: walls.e! });
  // the waiting area: chairs, a low table, a water cooler, magazines
  for (let i = 0; i < 4; i++) {
    k.box(0.55, 0.45, 0.55, mat("#c8d8dc", { rough: 0.7 }), -7.5 + i * 0.7, 0.23, 4.6, 0, 0.06);
    k.box(0.55, 0.5, 0.1, mat("#c8d8dc", { rough: 0.7 }), -7.5 + i * 0.7, 0.6, 4.85, 0, 0.04);
  }
  k.block(-6.45, 4.7, 1.45, 0.35);
  k.box(1.2, 0.4, 0.6, mat("#e8e4dc", { rough: 0.5 }), -6.4, 0.2, 3.4);
  k.block(-6.4, 3.4, 0.65, 0.35);
  k.box(0.35, 1.2, 0.35, white, -W / 2 + 0.5, 0.6, 1.0);
  k.add(cyl(0.14, 0.14, 0.4, 14), glass("#bfe4ff", 0.6), -W / 2 + 0.5, 1.4, 1.0);
  plant(k, -W / 2 + 0.6, D / 2 - 0.6, 1.2);
  plant(k, W / 2 - 0.6, D / 2 - 0.6, 1.2);
  // ---------- the doctor's room: a desk, the light box with a scan, a couch ----------
  const dx = -W / 4 - 0.5,
    dz = -D / 2 + 2.6;
  k.box(1.8, 0.05, 0.8, mat("#e8e4dc", { rough: 0.4 }), dx, 0.76, dz);
  for (const sx of [-0.8, 0.8]) k.box(0.05, 0.74, 0.7, mat("#c8ccd2", { metal: 0.6 }), dx + sx, 0.37, dz);
  k.add(rbox(0.5, 0.32, 0.02, 0.005), glow("#bfe8ff", 0.7), dx + 0.4, 1.0, dz - 0.2, 0, { shadow: false });
  k.block(dx, dz, 0.95, 0.45);
  people(k, "doc", [{ x: dx, z: dz - 0.75, ry: 0, col: "#f4f6f8" }]);
  k.circle(dx, dz - 0.75, 0.3);
  k.mount(walls.n!, rbox(1.6, 1.1, 0.05, 0.01), mat("#1a1a1a"), dx, 1.7, 0.14);
  k.sign(scanTex(), dx, 1.7, 0.17, 1.5, 1.0, 0, { to: walls.n! });
  k.box(0.8, 0.6, 2.0, mat(acc, { rough: 0.7 }), -W / 2 + 0.8, 0.3, dz + 0.4, 0, 0.06);
  k.block(-W / 2 + 0.8, dz + 0.4, 0.45, 1.05);
  k.spot("checkup", "Check up", dx, dz + 1.1, { r: 1.2, y: 1.5 });
  // ---------- the treatment room: the physio table, a bike, bands, rollers ----------
  const tx = W / 4 + 0.5,
    tz = -D / 2 + 2.6;
  k.box(0.75, 0.08, 2.0, mat("#1f3a4a", { rough: 0.6 }), tx, 0.72, tz, 0, 0.03);
  k.box(0.6, 0.1, 0.4, mat("#1f3a4a", { rough: 0.6 }), tx, 0.82, tz - 0.8, 0, 0.04);
  for (const sx of [-0.25, 0.25]) for (const sz of [-0.8, 0.8]) k.box(0.05, 0.7, 0.05, mat("#c8ccd2", { metal: 0.8 }), tx + sx, 0.35, tz + sz);
  k.block(tx, tz, 0.45, 1.05);
  people(k, "physio", [{ x: tx + 0.9, z: tz, ry: -Math.PI / 2, col: acc }]);
  k.circle(tx + 0.9, tz, 0.3);
  // the bike, wall bars, rollers, a lamp over the table
  k.box(0.4, 0.9, 1.1, mat("#2a2c30", { rough: 0.5 }), W / 2 - 1.2, 0.45, -D / 2 + 1.2);
  k.block(W / 2 - 1.2, -D / 2 + 1.2, 0.3, 0.6);
  for (let i = 0; i < 8; i++) k.mount(walls.e!, cyl(0.02, 0.02, 1.2, 6), mat("#c89a6a", { rough: 0.5 }), -3.6, 0.3 + i * 0.3, 0.15).rotation.set(0, 0, Math.PI / 2);
  for (let i = 0; i < 3; i++) k.add(cyl(0.08, 0.08, 0.5, 12), mat(["#2a9d8f", "#1a1a1a", "#e8c040"][i], { rough: 0.6 }), tx - 1.6, 0.08, tz - 0.6 + i * 0.4, 0, { rz: Math.PI / 2 });
  k.spotLamp(tx, 2.6, tz, "#ffffff", { r: 0.7, pool: 0.3 });
  k.spotLamp(dx, 2.6, dz, "#ffffff", { r: 0.7, pool: 0.2 });
  k.spot("treat", "Treatment", tx - 1.0, tz + 0.6, { r: 1.2, y: 1.5 });
  // a cryo chamber in the corner, for show
  k.add(cyl(0.6, 0.6, 2.2, 20), mat("#e8eef2", { rough: 0.3, metal: 0.2 }), 1.2, 1.1, -D / 2 + 1.0);
  k.add(cyl(0.61, 0.61, 1.2, 20, true), glow("#9adcff", 0.5), 1.2, 1.3, -D / 2 + 1.0, 0, { shadow: false });
  k.circle(1.2, -D / 2 + 1.0, 0.65);

  // anatomy posters and a wall of signed shirts in reception
  for (let i = 0; i < 3; i++) k.mount(walls.w!, rbox(0.9, 1.1, 0.03, 0.01), mat(["#c8102e", "#1e5aa8", "#111111"][i], { rough: 0.7 }), 3.6 - i * 1.3, 1.8, 0.14);
  return k.finish({
    w: W,
    d: D,
    spawn: [0, D / 2 - 1.8],
    mood: "cool",
    light: shopLight({ hemi: 0.82, sky: "#f4fbff", ground: "#6a7a7e", keyI: 0.9, points: [{ x: 0, y: 3, z: 2, col: "#f4fbff", i: 5, dist: 22 }] }),
    accent: acc,
  });
}
function signTex(text: string, acc: string) {
  return cachedTexture(
    "clinicsign|" + text + acc,
    (x, w, h) => {
      x.fillStyle = "#ffffff";
      x.fillRect(0, 0, w, h);
      x.fillStyle = acc;
      x.fillRect(0, 0, 18, h);
      let s = 64;
      x.font = `700 ${s}px Inter, 'Helvetica Neue', sans-serif`;
      x.textBaseline = "middle";
      while (x.measureText(text).width > w - 60 && s > 16) {
        s -= 4;
        x.font = `700 ${s}px Inter, 'Helvetica Neue', sans-serif`;
      }
      x.fillText(text, 40, h / 2 + 2);
    },
    512,
    112,
  );
}
function scanTex() {
  return cachedTexture(
    "scan",
    (x, w, h) => {
      x.fillStyle = "#0a1a24";
      x.fillRect(0, 0, w, h);
      x.strokeStyle = "rgba(200,235,255,0.85)";
      x.lineWidth = 10;
      x.lineCap = "round";
      // a knee: the thigh bone, the shin bone, the kneecap
      x.beginPath();
      x.moveTo(w * 0.45, 10);
      x.lineTo(w * 0.47, h * 0.45);
      x.moveTo(w * 0.5, h * 0.55);
      x.lineTo(w * 0.48, h - 10);
      x.stroke();
      x.beginPath();
      x.arc(w * 0.56, h * 0.48, 18, 0, Math.PI * 2);
      x.stroke();
      x.fillStyle = "rgba(255,120,100,0.6)";
      x.beginPath();
      x.arc(w * 0.5, h * 0.5, 30, 0, Math.PI * 2);
      x.fill();
    },
    256,
    192,
  );
}

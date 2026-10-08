/**
 * The mall: one big bright atrium with the shops round it, each behind its own front (its glass, its colours,
 * its sign). Walk through a shop's door and you are in that shop, in the same building: the shops are built by
 * the same builder as the street shops, just turned to face the atrium.
 */
import type { WorldPlace } from "../../types";
import { rbox, cyl, plane, mat, glow } from "../kit3d";
import { Kit, surfMat, shopLight, placesOf, people, type Room } from "./common";
import { buildStore } from "./store";
import { lookFor, logoTex } from "./brand";

export function mallRoom(k: Kit, p: WorldPlace): Room {
  const W = 46,
    D = 32,
    H = 7.5;
  const all = placesOf(k.st);
  const stores = (p.inside || []).map((id) => all.find((x) => x.id === id)).filter((x): x is WorldPlace => !!x);
  const st = p.style;
  // ---------- the shell ----------
  k.floor(W, D, surfMat("marble", "#cfc5b4", "#8a7c66", { rough: 0.22 }), 0, 0, 3.2);
  const wallM = mat(st.wall || "#f4f2ee", { rough: 0.85 });
  k.wall(-W / 2, -D / 2, W / 2, -D / 2, H, wallM, { solid: false });
  k.wall(-W / 2, D / 2, -W / 2, -D / 2, H, wallM, { solid: false });
  k.wall(W / 2, -D / 2, W / 2, D / 2, H, wallM, { solid: false });
  const gap = 4;
  k.wall(W / 2, D / 2, gap / 2, D / 2, H, wallM, {});
  k.wall(-gap / 2, D / 2, -W / 2, D / 2, H, wallM, {});
  const head = k.wall(gap / 2, D / 2, -gap / 2, D / 2, H, wallM, { solid: false, low: 3.2 });
  k.mount(head, rbox(gap + 0.4, 0.2, 0.4, 0.02), mat(st.trim || "#2b2b2b", { metal: 0.6, rough: 0.3 }), 0, 3.2, 0);
  k.spot("door", "Way out", 0, D / 2 - 0.6, { r: 1.2, y: 1.8 });
  // ---------- the shops round the atrium: three along the back, the rest down the sides ----------
  const slots: { x: number; z: number; q: number; w: number; d: number }[] = [
    { x: -15.2, z: -D / 2 + 5.6, q: 0, w: 14.4, d: 11 },
    { x: 0, z: -D / 2 + 5.6, q: 0, w: 14.4, d: 11 },
    { x: 15.2, z: -D / 2 + 5.6, q: 0, w: 14.4, d: 11 },
    { x: -W / 2 + 5.6, z: 0.3, q: 1, w: 10.2, d: 11 },
    { x: W / 2 - 5.6, z: 0.3, q: 3, w: 10.2, d: 11 },
    { x: -W / 2 + 5.6, z: 10.6, q: 1, w: 10.2, d: 11 },
    { x: W / 2 - 5.6, z: 10.6, q: 3, w: 10.2, d: 11 },
  ];
  const used = stores.slice(0, slots.length);
  used.forEach((sp, i) => {
    const s = slots[i];
    k.at(s.x, s.z, s.q, () => buildStore(k, sp, { w: s.w, d: s.d, inMall: true }));
  });
  // empty units: a hoarding with "coming soon"
  for (let i = used.length; i < slots.length; i++) {
    const s = slots[i];
    k.at(s.x, s.z, s.q, () => {
      const hoard = k.wall(s.w / 2, s.d / 2, -s.w / 2, s.d / 2, 4.2, mat("#2b2b2b", { rough: 0.7 }), { inner: true });
      k.sign(logoTex(lookFor(p), "Opening soon", "#2b2b2b"), 0, 2.4, -0.12, 6, 1.5, Math.PI, { to: hoard });
      k.block(0, 0, s.w / 2, s.d / 2 - 0.2);
    });
  }
  // ---------- the atrium: a fountain, escalators, palms, benches, a kiosk, the mall's name ----------
  const stone = mat("#e2ddd4", { rough: 0.35 });
  const fz = 3.6;
  k.add(cyl(3.2, 3.4, 0.55, 40), stone, 0, 0.27, fz);
  k.add(cyl(2.95, 2.95, 0.06, 40), glow("#4fb8dc", 0.62), 0, 0.5, fz, 0, { shadow: false });
  k.add(cyl(0.5, 0.7, 1.4, 20), stone, 0, 1.0, fz);
  k.add(cyl(1.0, 1.0, 0.12, 24), stone, 0, 1.7, fz);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    k.add(cyl(0.03, 0.05, 1.3, 6), glow("#d8f4ff", 1.1), Math.cos(a) * 1.5, 1.05, fz + Math.sin(a) * 1.5, 0, { rx: Math.sin(a) * 0.55, rz: -Math.cos(a) * 0.55, shadow: false });
  }
  k.pool(0, fz, 8, "#7ad8ff", 0.2);
  k.circle(0, fz, 3.6);
  // tall columns holding up the roof, wrapped in light
  for (const [x, z] of [
    [-9, -2.5],
    [9, -2.5],
    [-9, 11],
    [9, 11],
  ]) {
    k.add(cyl(0.45, 0.45, H, 20), mat("#efece6", { rough: 0.5 }), x, H / 2, z);
    k.add(cyl(0.47, 0.47, 0.08, 20), glow(st.accent || "#d4af37", 1.2), x, 3.6, z, 0, { shadow: false });
    k.circle(x, z, 0.5);
  }
  // palms in big planters, benches, a coffee kiosk
  for (const [x, z] of [
    [-8.6, 4],
    [8.6, 4],
    [-6, 13.6],
    [6, 13.6],
  ]) {
    k.box(1.4, 0.7, 1.4, mat("#cfc8bc", { rough: 0.5 }), x, 0.35, z, 0, 0.05);
    k.add(cyl(0.09, 0.13, 3.2, 8), mat("#7a5a3a", { rough: 0.9 }), x, 2.2, z);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      k.add(rbox(0.3, 0.04, 1.6, 0.02), mat("#2f6a34", { rough: 0.8 }), x + Math.cos(a) * 0.7, 3.6, z + Math.sin(a) * 0.7, -a + Math.PI / 2, { rx: 0.5 });
    }
    k.circle(x, z, 0.85);
  }
  for (const [x, z, ry] of [
    [-4.6, 8.4, 0],
    [4.6, 8.4, 0],
  ]) {
    k.box(2.2, 0.08, 0.6, mat("#8a6a4a", { rough: 0.6 }), x, 0.46, z, ry);
    k.box(0.1, 0.44, 0.5, mat("#2b2b2b", { metal: 0.5 }), x - 0.95, 0.22, z, ry);
    k.box(0.1, 0.44, 0.5, mat("#2b2b2b", { metal: 0.5 }), x + 0.95, 0.22, z, ry);
    k.block(x, z, 1.15, 0.35);
  }
  // the directory and the mall's name hanging over the atrium
  k.box(1.2, 2.2, 0.2, mat("#1a1a1a", { rough: 0.4 }), -3.2, 1.1, 11.4);
  k.add(plane(1.0, 1.8), glow("#e8f0ff", 0.5), -3.2, 1.15, 11.51, 0, { shadow: false });
  k.block(-3.2, 11.4, 0.7, 0.2);
  k.text(p.name.toUpperCase(), "#ffffff", st.trim || "#2b2b2b", 0, 6.7, -3.6, 11, 1.1, 0);
  k.add(rbox(11.3, 1.3, 0.08, 0.02), mat(st.accent || "#d4af37", { metal: 0.8, rough: 0.3 }), 0, 6.7, -3.66, 0, { shadow: false });
  for (const sx of [-5, 5]) k.add(cyl(0.01, 0.01, 1.0, 4), mat("#888888"), sx, 7.7, -3.62, 0, { shadow: false });
  // a skylight: long bright panels and soft pools on the floor
  for (const z of [-1, 6, 12]) {
    k.add(rbox(12, 0.06, 2.2, 0.02), glow("#f4f8ff", 1.2), 0, H - 0.2, z, 0, { shadow: false });

  }
  // shoppers wandering
  const R = k.rnd;
  const crowd = Array.from({ length: Math.round(16 * k.dense) }, () => ({
    x: (R() - 0.5) * 20,
    z: -3 + R() * 17,
    ry: R() * 6.28,
    col: ["#2a3a5a", "#c8202a", "#e8e4dc", "#3a5a3a", "#111111", "#d8a878"][Math.floor(R() * 6)],
  })).filter((c) => Math.hypot(c.x, c.z - fz) > 4 && Math.abs(c.z - 8.4) > 0.8 && Math.abs(c.x) < 10);
  people(k, "shopper", crowd);
  for (const c of crowd) k.circle(c.x, c.z, 0.3);
  return k.finish({
    w: W,
    d: D,
    spawn: [0, D / 2 - 2.4],
    cam: { dist: 9.6, height: 7.6 },
    mood: "cool",
    light: shopLight({ hemi: 0.78, sky: "#f4f6ff", ground: "#5a554e", keyI: 0.95, bg: "#0b0c0e", points: [{ x: 0, y: 6.5, z: 4, col: "#fff4e6", i: 7, dist: 34 }] }),
    accent: st.accent || "#d4af37",
  });
}

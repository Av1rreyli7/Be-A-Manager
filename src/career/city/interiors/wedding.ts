/**
 * The wedding: a garden for a small or a big one, a terrace by the sea for a huge one. An aisle down the middle,
 * white chairs either side for the family and friends (they sit in the slots, the people are this week's
 * guests), a flower arch at the front where he waits, lights over the big ones, and the cake. She walks down
 * the aisle from the back (Interior does that, and the camera).
 */
import * as THREE from "three";
import { rbox, cyl, sphere, plane, mat, glow } from "../kit3d";
import { Kit, surfMat, shopLight, plant, viewTex, type Room } from "./common";

export function weddingRoom(k: Kit): Room {
  const size = k.st.social?.dating?.wedding?.size || "small";
  const huge = size === "huge",
    big = size !== "small";
  const rows = huge ? 7 : big ? 5 : 3;
  const per = huge ? 4 : big ? 3 : 2;
  const W = huge ? 26 : 20,
    D = 10 + rows * 1.5;
  const archZ = -D / 2 + 3.2;
  // the ground: a lawn, or a stone terrace over the sea
  k.floor(W, D, huge ? surfMat("marble", "#ece6dc", "#c8bca8", { rough: 0.3 }) : surfMat("concrete", "#6f9c58", "#5f8a4a", { rough: 1 }), 0, 0, huge ? 2.4 : 4);
  if (!huge) k.add(plane(W - 1, D - 1), mat("#6aa156", { rough: 1 }), 0, 0.004, 0, 0, { rx: -Math.PI / 2, shadow: false });
  // the aisle: a long runner and petals along it
  k.add(plane(1.6, D - 5), mat(huge ? "#f6f2ea" : "#f4efe6", { rough: 0.95 }), 0, 0.012, archZ + (D - 5) / 2 + 0.6, 0, { rx: -Math.PI / 2, shadow: false });
  for (let i = 0; i < 46; i++) {
    const z = archZ + 1.2 + (i / 46) * (D - 6);
    const x = (i % 2 ? 1 : -1) * (0.62 + (i % 5) * 0.03);
    k.inst("petal", () => new THREE.CircleGeometry(0.05, 6).rotateX(-Math.PI / 2), mat("#ffffff", { rough: 0.9 }), x, 0.016, z, { col: ["#f2b6c4", "#ffffff", "#e88aa0"][i % 3] });
  }
  // the arch: two posts and a curve of flowers, the guests' chairs in rows facing it
  const wood = mat("#f4efe6", { rough: 0.6 });
  for (const sx of [-1, 1]) k.add(cyl(0.08, 0.08, 2.9, 10), wood, sx * 1.25, 1.45, archZ);
  for (let i = 0; i <= 30; i++) {
    const a = (i / 30) * Math.PI;
    const x = Math.cos(a) * 1.25,
      y = 2.9 + Math.sin(a) * 0.9;
    k.inst("archflower", () => sphere(0.16, 8), mat("#ffffff", { rough: 0.8 }), x, y, archZ, { col: ["#ffffff", "#f2b6c4", "#fff2d8", "#e88aa0", "#d8ecd0"][i % 5], s: 0.8 + (i % 3) * 0.15 });
  }
  for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) k.inst("archflower", () => sphere(0.16, 8), mat("#ffffff", { rough: 0.8 }), sx * 1.25 + (i % 2 ? 0.12 : -0.12), 0.4 + i * 0.42, archZ, { col: ["#d8ecd0", "#ffffff", "#f2b6c4"][i % 3], s: 0.75 });
  k.circle(-1.25, archZ, 0.2);
  k.circle(1.25, archZ, 0.2);
  const chairM = mat("#f8f6f0", { rough: 0.5 });
  for (let r = 0; r < rows; r++) {
    const z = archZ + 2.6 + r * 1.5;
    for (const side of [-1, 1])
      for (let i = 0; i < per; i++) {
        const x = side * (1.35 + i * 0.72);
        k.inst("wchair", () => rbox(0.44, 0.05, 0.42, 0.01), chairM, x, 0.45, z, { col: "#f8f6f0" });
        k.inst("wchairback", () => rbox(0.44, 0.48, 0.04, 0.01), chairM, x, 0.7, z + 0.22, { col: "#f8f6f0" });
        for (const [lx, lz] of [
          [-0.18, -0.17],
          [0.18, -0.17],
          [-0.18, 0.18],
          [0.18, 0.18],
        ])
          k.inst("wchairleg", () => cyl(0.015, 0.015, 0.45, 6), chairM, x + lx, 0.22, z + lz, { col: "#f8f6f0" });
        k.crowd(x, z + 0.08, Math.PI, { sit: true, seat: 0.475 });
      }
    k.block(-1.35 - ((per - 1) * 0.72) / 2, z, ((per - 1) * 0.72) / 2 + 0.3, 0.32);
    k.block(1.35 + ((per - 1) * 0.72) / 2, z, ((per - 1) * 0.72) / 2 + 0.3, 0.32);
    // flowers at the end of each row on the aisle
    for (const side of [-1, 1]) k.inst("rowflower", () => sphere(0.14, 8), mat("#ffffff", { rough: 0.8 }), side * 0.95, 0.5, z, { col: r % 2 ? "#f2b6c4" : "#ffffff" });
  }
  // the cake on its own table to one side, the lights over a big one
  const cx = W / 2 - 3,
    cz = archZ + 1;
  k.add(cyl(0.6, 0.6, 0.05, 24), mat("#f6f2ea", { rough: 0.8 }), cx, 0.76, cz);
  k.add(cyl(0.62, 0.66, 0.74, 24, true), mat("#f6f2ea", { rough: 0.9 }), cx, 0.38, cz, 0, { shadow: false });
  for (let i = 0; i < 3; i++) k.add(cyl(0.3 - i * 0.08, 0.3 - i * 0.08, 0.22, 24), mat("#fffaf2", { rough: 0.6 }), cx, 0.9 + i * 0.22, cz);
  k.add(sphere(0.06, 10), mat("#f2b6c4", { rough: 0.6 }), cx, 1.6, cz);
  k.block(cx, cz, 0.7, 0.7);
  if (big)
    for (let i = 0; i < 40; i++) {
      const z = archZ + 1 + (i % 20) * ((D - 4) / 20);
      const x = i < 20 ? -W / 2 + 2 : W / 2 - 2;
      k.add(sphere(0.05, 6), glow("#ffe2a8", 2.2), x + Math.sin(i) * 0.2, 3.1 - Math.abs(Math.sin(i * 0.7)) * 0.3, z, 0, { shadow: false });
    }
  if (big) for (const sx of [-1, 1]) k.add(cyl(0.05, 0.05, 3.2, 6), mat("#2a2a2a", { metal: 0.6 }), sx * (W / 2 - 2), 1.6, archZ + D / 2 - 2);
  // round the edge: hedges and trees in the garden, a rail and the sea beyond the terrace
  if (huge) {
    const vt = viewTex("sea", k.st.life.style.sky, k.night, "wedding");
    const vm = new THREE.MeshBasicMaterial({ map: vt, toneMapped: false, fog: false });
    k.own.push(vm);
    k.add(plane(140, 40), vm, 0, 8, -D / 2 - 40, 0, { shadow: false });
    const water = new THREE.MeshStandardMaterial({ color: "#1d4a66", roughness: 0.15, metalness: 0.5 });
    k.own.push(water);
    k.add(plane(160, 60), water, 0, -1.4, -D / 2 - 30, 0, { rx: -Math.PI / 2, shadow: false });
    k.add(rbox(W, 1.0, 0.06, 0.01), mat("#f4efe6", { rough: 0.4 }), 0, 0.5, -D / 2 + 0.05);
    k.add(rbox(W + 0.4, 5, D + 0.2, 0.02), mat("#c8bca8", { rough: 0.9 }), 0, -2.52, 0, 0, { shadow: false });
  } else {
    const hedge = mat("#2f5a2e", { rough: 0.9 });
    k.add(rbox(W, 1.4, 0.8, 0.2), hedge, 0, 0.7, -D / 2 + 0.4);
    for (const sx of [-1, 1]) k.add(rbox(0.8, 1.4, D, 0.2), hedge, sx * (W / 2 - 0.4), 0.7, 0);
    for (const [x, z] of [
      [-W / 2 + 2.2, -D / 2 + 2],
      [W / 2 - 2.2, -D / 2 + 2],
      [-W / 2 + 2.2, D / 2 - 3],
    ])
      plant(k, x, z, 2.2, "#c8bca8", "#3d6b35");
  }
  k.spot("leave", "Back to the city", 0, D / 2 - 1.2, { r: 1.2, y: 1.8, tag: false });
  k.pool(0, archZ + 0.6, 4, "#ffe6c0", 0.25);
  return k.finish({
    w: W,
    d: D,
    spawn: [0.7, archZ + 0.9],
    mood: "warm",
    outdoor: true,
    light: shopLight({ warm: true, hemi: 1.0, sky: huge ? "#ffe0c8" : "#f4f8ff", ground: "#4a5a3a", keyI: 1.3, key: "#fff0d8", bg: "#cfe0ea", points: [{ x: 0, y: 4, z: archZ + 2, col: "#ffe6c0", i: 6, dist: 20 }] }),
    accent: "#e8c46a",
    apron: huge ? null : "#557a46",
    cam: { dist: 8, height: 4.4 },
  });
}

/** where they stand at the arch, and where she starts walking from */
export function weddingMarks(room: Room) {
  const archZ = -room.d / 2 + 3.2;
  return { him: { x: 0.7, z: archZ + 0.9 }, her: { x: -0.7, z: archZ + 0.9 }, start: { x: 0, z: room.d / 2 - 1.6 }, archZ };
}

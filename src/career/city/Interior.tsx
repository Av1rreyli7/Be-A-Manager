"use client";
/* eslint-disable react-hooks/immutability -- three.js objects built in useMemo are moved every frame in useFrame, which is how React Three Fiber works */
/**
 * The places you can walk into: your home (it grows with the home you have), the gym, the restaurant, the mall,
 * the boutiques and the car showroom, the training ground and the stadium. Your own footballer walks them:
 * click the floor or use WASD or the arrow keys. Glowing rings on the floor are things to use; walk up and press
 * E. Walls between the camera and you drop down, so the room never hides you.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { makeBody, type Outfit } from "../body";
import type { CareerState, Life } from "../types";
import type { PlaceId } from "./CityScene";
import { rbox, cyl, sphere, plane, mat, glass, glow, signTexture, cachedTexture, seeded, makeCar, lightCone, cone } from "./kit3d";

export interface Hotspot {
  id: string;
  label: string;
  x: number;
  z: number;
  r?: number;
}
interface Wall {
  mesh: THREE.Object3D;
  nx: number;
  nz: number;
  cx: number;
  cz: number;
}
interface Room {
  w: number;
  d: number;
  spawn: [number, number];
  obstacles: { x: number; z: number; r: number }[];
  hotspots: Hotspot[];
  group: THREE.Group;
  walls: Wall[];
  mood: "warm" | "cool" | "night" | "stadium";
  outdoor?: boolean;
  dispose: () => void;
}
export interface WalkCtl {
  yaw: number;
  zoom: number;
  use: number;
}

// ---------- shared pieces ----------
function floorTex(kind: "wood" | "rubber" | "tile" | "grass" | "stone" | "carpet", tint = "") {
  return cachedTexture(
    "floor|" + kind + "|" + tint,
    (x, w, h) => {
      const r = seeded(kind);
      if (kind === "wood") {
        for (let i = 0; i < 16; i++) {
          const base = 100 + Math.floor(r() * 40);
          x.fillStyle = `rgb(${base + 40},${base + 8},${base - 30})`;
          x.fillRect(0, (i * h) / 16, w, h / 16 - 2);
          for (let k = 0; k < 6; k++) {
            x.fillStyle = "rgba(60,30,10,0.12)";
            x.fillRect(r() * w, (i * h) / 16 + r() * (h / 16), r() * w * 0.4, 1);
          }
          x.fillStyle = "rgba(0,0,0,0.35)";
          x.fillRect(r() * w, (i * h) / 16, 2, h / 16);
        }
      } else if (kind === "rubber") {
        x.fillStyle = "#1b1d1f";
        x.fillRect(0, 0, w, h);
        for (let i = 0; i < 4000; i++) {
          x.fillStyle = r() < 0.5 ? "#26292c" : "#141516";
          x.fillRect(r() * w, r() * h, 2, 2);
        }
        x.strokeStyle = "rgba(0,0,0,0.6)";
        for (let i = 1; i < 4; i++) {
          x.strokeRect(0, 0, (i * w) / 4, (i * h) / 4);
        }
      } else if (kind === "tile") {
        for (let i = 0; i < 8; i++)
          for (let j = 0; j < 8; j++) {
            const v = 210 + Math.floor(r() * 18);
            x.fillStyle = tint || `rgb(${v},${v - 4},${v - 10})`;
            x.fillRect((i * w) / 8, (j * h) / 8, w / 8 - 2, h / 8 - 2);
          }
      } else if (kind === "grass") {
        for (let k = 0; k < 10; k++) {
          x.fillStyle = k % 2 ? "#2f7634" : "#368a3a";
          x.fillRect((k * w) / 10, 0, w / 10, h);
        }
        for (let i = 0; i < 3000; i++) {
          x.fillStyle = r() < 0.5 ? "rgba(20,60,20,0.25)" : "rgba(120,200,110,0.12)";
          x.fillRect(r() * w, r() * h, 1, 3);
        }
      } else if (kind === "stone") {
        x.fillStyle = "#4a4a48";
        x.fillRect(0, 0, w, h);
        for (let i = 0; i < 6; i++)
          for (let j = 0; j < 6; j++) {
            const v = 60 + Math.floor(r() * 25);
            x.fillStyle = `rgb(${v},${v},${v - 2})`;
            x.fillRect((i * w) / 6 + 2, (j * h) / 6 + 2, w / 6 - 4, h / 6 - 4);
          }
      } else {
        x.fillStyle = tint || "#3a3f48";
        x.fillRect(0, 0, w, h);
        for (let i = 0; i < 6000; i++) {
          x.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.06)";
          x.fillRect(r() * w, r() * h, 1, 1);
        }
      }
    },
    512,
    512,
    [1, 1],
  );
}
/** the view out of a window: this city's sky and its lit towers */
function skyline(life: Life, night: number) {
  return cachedTexture(
    "skyline|" + life.style.key + "|" + night.toFixed(1),
    (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h);
      const top = new THREE.Color(life.style.sky[0]).lerp(new THREE.Color("#03050a"), night * 0.7);
      const bot = new THREE.Color(life.style.sky[1]).lerp(new THREE.Color("#1a1c2a"), night * 0.6);
      g.addColorStop(0, top.getStyle());
      g.addColorStop(0.75, bot.getStyle());
      g.addColorStop(1, bot.getStyle());
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
      const r = seeded(life.style.key + "sky");
      for (let k = 0; k < 40; k++) {
        const bw = 20 + r() * 50,
          bh = h * (0.18 + r() * 0.55 * life.style.height);
        const bx = r() * w,
          by = h - bh;
        x.fillStyle = `rgba(${12 + r() * 20},${14 + r() * 20},${20 + r() * 24},1)`;
        x.fillRect(bx, by, bw, bh);
        for (let wy = by + 6; wy < h - 4; wy += 9)
          for (let wx = bx + 4; wx < bx + bw - 4; wx += 7)
            if (r() < 0.35 + night * 0.25) {
              x.fillStyle = r() < 0.7 ? "rgba(255,214,150,0.85)" : "rgba(200,225,255,0.8)";
              x.fillRect(wx, wy, 3, 4);
            }
      }
    },
    1024,
    384,
  );
}
function poster(text: string, accent: string) {
  return cachedTexture(
    "poster|" + text + accent,
    (x, w, h) => {
      x.fillStyle = "#0d0f0c";
      x.fillRect(0, 0, w, h);
      x.fillStyle = accent;
      x.beginPath();
      x.arc(w / 2, h * 0.42, w * 0.28, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = "#0d0f0c";
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        x.beginPath();
        x.arc(w / 2 + Math.cos(a) * w * 0.16, h * 0.42 + Math.sin(a) * w * 0.16, w * 0.07, 0, Math.PI * 2);
        x.fill();
      }
      x.fillStyle = "#f2f4ee";
      x.font = "800 34px Inter, system-ui, sans-serif";
      x.textAlign = "center";
      x.fillText(text, w / 2, h * 0.86);
    },
    256,
    384,
  );
}

// ---------- the rooms ----------
function buildRoom(place: PlaceId, st: CareerState, night: number): Room {
  const life = st.life;
  const g = new THREE.Group();
  const walls: Wall[] = [];
  const own: THREE.Material[] = [];
  const ownGeo: THREE.BufferGeometry[] = [];
  const ownTex: THREE.Texture[] = [];
  const accent = life.style.accent;
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, ry = 0) => {
    const me = new THREE.Mesh(geo, m);
    me.position.set(x, y, z);
    me.rotation.y = ry;
    me.castShadow = true;
    me.receiveShadow = true;
    g.add(me);
    return me;
  };
  const floor = (w: number, d: number, tex: THREE.Texture, rough = 0.6, rep = 1) => {
    const t = tex.clone();
    t.needsUpdate = true;
    ownTex.push(t);
    t.repeat.set((w / 4) * rep, (d / 4) * rep);
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: rough, metalness: 0.02 });
    own.push(m);
    const f = new THREE.Mesh(plane(w, d), m);
    f.rotation.x = -Math.PI / 2;
    f.receiveShadow = true;
    f.name = "floor";
    g.add(f);
    return f;
  };
  // four walls, each knows which way it faces so it can drop when the camera is behind it
  const room = (w: number, d: number, h: number, colour: string, skip: string[] = []) => {
    const m = mat(colour, { rough: 0.92 });
    const sides: [string, number, number, number, number, number][] = [
      ["n", 0, -d / 2, w, 0, 1],
      ["s", 0, d / 2, w, 0, -1],
      ["w", -w / 2, 0, d, 1, 0],
      ["e", w / 2, 0, d, -1, 0],
    ];
    for (const [id, cx, cz, len, nx, nz] of sides) {
      if (skip.includes(id)) continue;
      const geo = rbox(len, h, 0.18, 0.02);
      const me = new THREE.Mesh(geo, m);
      me.geometry = geo.clone();
      me.geometry.translate(0, h / 2, 0);
      me.position.set(cx, 0, cz);
      me.rotation.y = nx ? Math.PI / 2 : 0;
      me.receiveShadow = true;
      g.add(me);
      walls.push({ mesh: me, nx, nz, cx, cz });
    }
  };
  const windowOn = (x: number, y: number, z: number, w: number, h: number, ry: number) => {
    const t = skyline(life, night);
    const m = new THREE.MeshBasicMaterial({ map: t, toneMapped: false, color: new THREE.Color(1, 1, 1).multiplyScalar(0.9) });
    own.push(m);
    const p = new THREE.Mesh(plane(w, h), m);
    p.position.set(x, y, z);
    p.rotation.y = ry;
    g.add(p);
    const frame = add(rbox(w + 0.12, h + 0.12, 0.06, 0.02), mat("#1a1b1d", { rough: 0.5, metal: 0.4 }), x, y, z - Math.cos(ry) * 0.035, ry);
    frame.castShadow = false;
    return p;
  };
  // a lamp: a dark shade, a small bright bulb under it and a soft cone of light down to the floor
  const lamp = (x: number, y: number, z: number, col = "#ffd9a0") => {
    const shade = add(cone(0.22, 0.26), mat("#1b1c1e", { rough: 0.5, metal: 0.5, side: THREE.DoubleSide }), x, y + 0.1, z);
    shade.castShadow = false;
    const bulb = add(sphere(0.06, 10), glow(col, 1.6), x, y - 0.02, z);
    bulb.castShadow = false;
    const beam = new THREE.Mesh(cone(0.9, Math.max(0.5, y - 0.1)), lightCone(col, 0.12));
    beam.position.set(x, (y - 0.05) / 2, z);
    g.add(beam);
    return bulb;
  };
  const rug = (x: number, z: number, w: number, d: number, col: string) => {
    const r = add(rbox(w, 0.02, d, 0.01), mat(col, { rough: 1 }), x, 0.012, z);
    r.castShadow = false;
    return r;
  };
  const plant = (x: number, z: number, s = 1) => {
    add(cyl(0.22 * s, 0.17 * s, 0.42 * s, 14), mat("#d8d2c4", { rough: 0.6 }), x, 0.21 * s, z);
    const b = add(sphere(0.42 * s, 10), mat("#2f5a2e", { rough: 0.9 }), x, 0.78 * s, z);
    b.scale.set(1, 1.3, 1);
  };
  const signBoard = (text: string, fg: string, bg: string, x: number, y: number, z: number, w: number, h: number, ry = 0) => {
    const m = new THREE.MeshBasicMaterial({ map: signTexture(text, fg, bg, 512, 128), toneMapped: false });
    own.push(m);
    const p = new THREE.Mesh(plane(w, h), m);
    p.position.set(x, y, z);
    p.rotation.y = ry;
    g.add(p);
  };
  const hs: Hotspot[] = [];
  const ob: Room["obstacles"] = [];
  let w = 8,
    d = 7,
    spawn: [number, number] = [0, 2];
  let mood: Room["mood"] = night > 0.5 ? "night" : "warm";
  let outdoor = false;

  if (place === "home") {
    const tier = life.home.tier;
    const small = tier <= 1;
    if (small) {
      w = 6.4;
      d = 5.4;
      floor(w, d, floorTex(tier === 0 ? "wood" : "carpet", "#3b3f47"), 0.7);
      room(w, d, 2.7, "#c9c2b4");
      windowOn(0.6, 1.6, -d / 2 + 0.1, 1.8, 1.1, 0);
      // the bed
      add(rbox(1.2, 0.35, 2.1, 0.06), mat("#5a3e2a", { rough: 0.7 }), -2.3, 0.18, -1.4);
      add(rbox(1.12, 0.22, 2.0, 0.1), mat("#e8e4dc", { rough: 0.95 }), -2.3, 0.46, -1.4);
      add(rbox(1.14, 0.08, 1.3, 0.04), mat(accent, { rough: 0.95 }), -2.3, 0.6, -1.0);
      add(rbox(0.7, 0.14, 0.4, 0.07), mat("#f4f2ec", { rough: 1 }), -2.3, 0.64, -2.2);
      ob.push({ x: -2.3, z: -1.4, r: 1.1 });
      hs.push({ id: "rest", label: "Lie down and rest", x: -1.4, z: -0.9 });
      // the desk and the laptop
      add(rbox(1.4, 0.06, 0.6, 0.02), mat("#2a2c30", { rough: 0.5 }), 2.2, 0.76, -2.2);
      for (const sx of [-0.62, 0.62]) add(rbox(0.05, 0.74, 0.55, 0.01), mat("#2a2c30"), 2.2 + sx, 0.37, -2.2);
      add(rbox(0.36, 0.02, 0.25, 0.01), mat("#1b1c1e", { metal: 0.6, rough: 0.3 }), 2.2, 0.8, -2.1);
      const scr = add(rbox(0.36, 0.24, 0.015, 0.005), glow("#9ec8ff", 0.9), 2.2, 0.93, -2.22);
      scr.rotation.x = -0.2;
      ob.push({ x: 2.2, z: -2.2, r: 0.75 });
      hs.push({ id: "laptop", label: "Laptop: homes and money", x: 2.2, z: -1.4 });
      // the wardrobe
      add(rbox(1.0, 2.0, 0.55, 0.03), mat("#d9d2c2", { rough: 0.7 }), 2.6, 1.0, 0.8, -Math.PI / 2);
      ob.push({ x: 2.6, z: 0.8, r: 0.65 });
      hs.push({ id: "wardrobe", label: "Wardrobe", x: 1.8, z: 0.8 });
      // posters, a lamp, a rug
      for (const [k, t] of [
        [0, "DREAM"],
        [1, "WORK"],
      ] as [number, string][]) {
        const m = new THREE.MeshBasicMaterial({ map: poster(t, accent), toneMapped: false });
        own.push(m);
        const p = new THREE.Mesh(plane(0.6, 0.9), m);
        p.position.set(-w / 2 + 0.1, 1.6, -1.8 + k * 1.1);
        p.rotation.y = Math.PI / 2;
        g.add(p);
      }
      lamp(2.6, 1.2, -2.3);
      rug(0, 0.4, 2.4, 1.6, "#3a4a5a");
      if (life.items.some((i) => i.id === "console" && i.owned)) {
        add(rbox(0.9, 0.5, 0.05, 0.02), glow("#7ad0ff", 0.6), -0.3, 1.2, -d / 2 + 0.12);
        hs.push({ id: "unwind", label: "Play some games", x: -0.3, z: -1.6 });
      }
      spawn = [0, 1.6];
    } else {
      const k = [1, 1, 1, 1.15, 1.3, 1.55][tier];
      w = 10 * k;
      d = 8 * k;
      const glassWall = tier >= 3;
      floor(w, d, floorTex(tier >= 4 ? "stone" : "wood"), tier >= 4 ? 0.35 : 0.55, tier >= 4 ? 1.4 : 1);
      room(w, d, tier >= 5 ? 4.2 : 3, tier >= 4 ? "#ece8e0" : "#d9d4c8", glassWall ? ["n"] : []);
      if (glassWall) {
        windowOn(0, 1.9, -d / 2 + 0.05, w - 0.4, 3.4, 0);
        add(rbox(w, 0.08, 0.1, 0.02), mat("#141516", { metal: 0.6 }), 0, 0.04, -d / 2 + 0.05);
      } else {
        windowOn(-w * 0.2, 1.6, -d / 2 + 0.1, 2.6, 1.5, 0);
        windowOn(w * 0.22, 1.6, -d / 2 + 0.1, 2.6, 1.5, 0);
      }
      // the sofa and the screen
      const sx = -w * 0.18,
        sz = d * 0.12;
      add(rbox(3.2, 0.42, 0.95, 0.12), mat("#3a3f46", { rough: 0.95 }), sx, 0.21, sz + 0.6);
      add(rbox(3.2, 0.5, 0.22, 0.1), mat("#3a3f46", { rough: 0.95 }), sx, 0.62, sz + 1.0);
      add(rbox(0.95, 0.42, 1.9, 0.12), mat("#3a3f46", { rough: 0.95 }), sx - 1.15, 0.21, sz - 0.2);
      for (const cx of [-1, 0, 1]) add(rbox(0.9, 0.12, 0.8, 0.05), mat("#474d55", { rough: 1 }), sx + cx * 1.0, 0.48, sz + 0.55);
      ob.push({ x: sx, z: sz + 0.7, r: 1.6 }, { x: sx - 1.15, z: sz - 0.3, r: 1.0 });
      hs.push({ id: "rest", label: "Sofa: rest", x: sx + 0.4, z: sz - 0.4 });
      add(rbox(1.1, 0.35, 0.6, 0.06), mat("#6b5340", { rough: 0.5 }), sx, 0.18, sz - 0.6);
      rug(sx, sz - 0.3, 3.6, 2.6, tier >= 4 ? "#c9bfae" : "#4a4f58");
      const tvz = sz - 2.6;
      add(rbox(2.4, 1.35, 0.06, 0.02), mat("#0a0b0c", { rough: 0.2, metal: 0.4 }), sx, 1.35, tvz);
      add(rbox(2.3, 1.27, 0.02, 0.01), glow("#2a4060", 0.7), sx, 1.35, tvz + 0.035);
      add(rbox(2.6, 0.4, 0.45, 0.05), mat("#24262a", { rough: 0.5 }), sx, 0.2, tvz + 0.05);
      ob.push({ x: sx, z: tvz, r: 0.6 });
      if (life.items.some((i) => i.id === "console" && i.owned)) hs.push({ id: "unwind", label: "Play some games", x: sx + 1.3, z: tvz + 0.9 });
      // the kitchen island
      const kx = w * 0.26,
        kz = d * 0.05;
      add(rbox(2.4, 0.92, 0.9, 0.04), mat("#f0eee8", { rough: 0.3 }), kx, 0.46, kz);
      add(rbox(2.5, 0.05, 1.0, 0.02), mat("#1e1f22", { rough: 0.15, metal: 0.2 }), kx, 0.94, kz);
      for (const st of [-0.7, 0, 0.7]) add(cyl(0.18, 0.18, 0.7, 14), mat("#2a2c30", { metal: 0.5, rough: 0.4 }), kx + st, 0.35, kz + 0.75);
      ob.push({ x: kx, z: kz, r: 1.35 });
      for (const lx of [-0.7, 0.7]) lamp(kx + lx, 2.3, kz, "#ffe0b0");
      // the trophy cabinet, the wardrobe door, the laptop on a side desk, plants
      const cabX = w / 2 - 0.4;
      add(rbox(0.5, 2.0, 1.6, 0.03), glass("#c8d6e2", 0.25), cabX, 1.0, -d * 0.25);
      add(rbox(0.52, 0.06, 1.62, 0.02), mat("#1a1b1d"), cabX, 2.0, -d * 0.25);
      const cups = Math.min(8, st.trophies.length + st.awards.length);
      for (let i = 0; i < cups; i++) {
        const cy = 0.45 + Math.floor(i / 4) * 0.7,
          cz = -d * 0.25 - 0.55 + (i % 4) * 0.37;
        add(cyl(0.08, 0.05, 0.22, 12), mat("#e8c46a", { metal: 1, rough: 0.25 }), cabX, cy, cz);
      }
      ob.push({ x: cabX, z: -d * 0.25, r: 0.9 });
      hs.push({ id: "trophies", label: "Trophy cabinet", x: cabX - 1.0, z: -d * 0.25 });
      add(rbox(1.0, 2.2, 0.08, 0.02), mat("#8a7a66", { rough: 0.6 }), -w / 2 + 0.06, 1.1, d * 0.28, Math.PI / 2);
      hs.push({ id: "wardrobe", label: "Dressing room", x: -w / 2 + 0.9, z: d * 0.28 });
      add(rbox(1.2, 0.05, 0.55, 0.02), mat("#2a2c30"), w * 0.3, 0.76, d / 2 - 0.5);
      for (const lx of [-0.5, 0.5]) add(rbox(0.05, 0.74, 0.5, 0.01), mat("#2a2c30"), w * 0.3 + lx, 0.37, d / 2 - 0.5);
      const scr = add(rbox(0.36, 0.24, 0.015, 0.005), glow("#9ec8ff", 0.9), w * 0.3, 0.93, d / 2 - 0.62);
      scr.rotation.y = Math.PI;
      ob.push({ x: w * 0.3, z: d / 2 - 0.5, r: 0.7 });
      hs.push({ id: "laptop", label: "Laptop: homes and money", x: w * 0.3, z: d / 2 - 1.3 });
      plant(-w / 2 + 0.6, -d / 2 + 0.6, 1.2);
      plant(w / 2 - 0.6, d / 2 - 0.6, 1);
      lamp(sx - 1.6, 1.6, sz + 1.1);
      // tier 3 and up: the car in a glass bay, villas and mansions: a pool outside the glass
      if (st.life.car && tier >= 3) {
        const car = makeCar(st.life.car);
        car.position.set(-w * 0.32, 0, -d * 0.28);
        car.rotation.y = 0.9;
        g.add(car);
        ob.push({ x: -w * 0.32, z: -d * 0.28, r: 2.3 });
        hs.push({ id: "garage", label: "Your cars", x: -w * 0.32 + 2.2, z: -d * 0.28 + 1.0 });
      } else if (st.life.cars.some((c) => c.owned)) hs.push({ id: "garage", label: "Car keys", x: -w / 2 + 0.9, z: -d * 0.05 });
      if (tier >= 4) {
        const pool = new THREE.Mesh(plane(w * 0.6, 3), glow("#3fbfe0", 0.75));
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(0, -0.02, -d / 2 - 2.4);
        g.add(pool);
        const deck = new THREE.Mesh(plane(w + 6, 7), mat("#b8ac98", { rough: 0.8 }));
        deck.rotation.x = -Math.PI / 2;
        deck.position.set(0, -0.04, -d / 2 - 3);
        g.add(deck);
      }
      spawn = [w * 0.05, d * 0.3];
    }
    mood = "warm";
  } else if (place === "gym") {
    w = 12;
    d = 10;
    floor(w, d, floorTex("rubber"), 0.9);
    room(w, d, 3.6, "#2a2d31");
    // mirror wall, neon, the rack, benches, bikes, mats, the spa door
    add(rbox(w - 1, 2.2, 0.04, 0.01), glass("#d8e2ea", 0.55), 0, 1.4, -d / 2 + 0.12);
    add(rbox(w - 0.4, 0.06, 0.06, 0.02), glow(accent, 1.8), 0, 3.3, -d / 2 + 0.14);
    const steel = mat("#9aa0a6", { metal: 0.9, rough: 0.3 });
    for (const sx of [-0.9, 0.9]) add(rbox(0.1, 2.3, 0.1, 0.02), steel, -3 + sx, 1.15, -2.6);
    add(cyl(0.025, 0.025, 2.2, 8), steel, -3, 1.45, -2.6).rotation.z = Math.PI / 2;
    for (const sx of [-1, 1]) add(cyl(0.22, 0.22, 0.08, 20), mat("#141516", { rough: 0.6 }), -3 + sx * 0.95, 1.45, -2.6).rotation.z = Math.PI / 2;
    ob.push({ x: -3, z: -2.6, r: 1.2 });
    hs.push({ id: "weights", label: "Squat rack: strength", x: -3, z: -1.4 });
    for (let i = 0; i < 3; i++) {
      const bx = 1.6 + i * 1.3;
      add(rbox(0.3, 0.8, 1.1, 0.06), mat("#1c1e21", { rough: 0.5 }), bx, 0.4, -2.8);
      add(rbox(0.32, 0.08, 0.36, 0.03), mat(accent, { rough: 0.6 }), bx, 0.85, -3.1);
      add(rbox(0.08, 0.6, 0.08, 0.02), steel, bx, 1.05, -2.4);
    }
    ob.push({ x: 2.9, z: -2.8, r: 1.8 });
    hs.push({ id: "engine", label: "Bikes: engine work", x: 2.9, z: -1.5 });
    for (let i = 0; i < 3; i++) add(rbox(0.7, 0.02, 1.8, 0.01), mat(i % 2 ? "#3a5a7a" : "#2a4a6a", { rough: 1 }), -3.5 + i * 0.9, 0.012, 2.4);
    hs.push({ id: "mobility", label: "Mats: mobility and core", x: -2.6, z: 1.2 });
    add(rbox(1.2, 2.3, 0.1, 0.03), glow("#7ad0ff", 0.55), w / 2 - 0.1, 1.15, 2.6, Math.PI / 2);
    signBoard("RECOVERY SPA", "#0b0d0c", "#7ad0ff", w / 2 - 0.12, 2.6, 2.6, 1.6, 0.36, -Math.PI / 2);
    hs.push({ id: "spa", label: "Ice bath and massage", x: w / 2 - 1.1, z: 2.6 });
    const dumb = new THREE.InstancedMesh(cyl(0.07, 0.07, 0.32, 10), mat("#141516", { rough: 0.5 }), 10);
    const mm = new THREE.Matrix4();
    for (let i = 0; i < 10; i++)
      dumb.setMatrixAt(
        i,
        mm.compose(
          new THREE.Vector3(-5.4, 0.55 + (i % 2) * 0.35, -1 + Math.floor(i / 2) * 0.45),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2),
          new THREE.Vector3(1, 1, 1),
        ),
      );
    g.add(dumb);
    add(rbox(0.5, 1.0, 2.6, 0.04), mat("#1c1e21"), -5.5, 0.5, 0);
    ob.push({ x: -5.5, z: 0, r: 0.6 });
    signBoard(life.places.gym.toUpperCase(), accent, "#0b0d0c", 0, 3.05, d / 2 - 0.12, 4.5, 0.6, Math.PI);
    spawn = [0, 3];
    mood = "cool";
  } else if (place === "restaurant") {
    w = 12;
    d = 9;
    floor(w, d, floorTex("wood"), 0.45);
    room(w, d, 3.2, "#5a3e2c");
    windowOn(-2.5, 1.7, -d / 2 + 0.1, 3.4, 1.6, 0);
    // the bar along the back, bottles on the shelf
    add(rbox(5, 1.05, 0.7, 0.05), mat("#2a1d15", { rough: 0.5 }), 3, 0.53, -d / 2 + 0.9);
    add(rbox(5.1, 0.06, 0.8, 0.02), mat("#c9b089", { rough: 0.25, metal: 0.3 }), 3, 1.07, -d / 2 + 0.9);
    ob.push({ x: 3, z: -d / 2 + 0.9, r: 0.2 }, { x: 1.2, z: -d / 2 + 0.9, r: 0.6 }, { x: 4.8, z: -d / 2 + 0.9, r: 0.6 }, { x: 3, z: -d / 2 + 0.9, r: 0.6 });
    const bottles = new THREE.InstancedMesh(cyl(0.05, 0.06, 0.32, 8), glass("#6a8a5a", 0.8), 18);
    const mm = new THREE.Matrix4();
    for (let i = 0; i < 18; i++) bottles.setMatrixAt(i, mm.makeTranslation(1 + i * 0.24, 1.9 + (i % 2) * 0.02, -d / 2 + 0.2));
    g.add(bottles);
    add(rbox(4.6, 0.04, 0.3, 0.01), mat("#2a1d15"), 3.1, 1.72, -d / 2 + 0.2);
    // round tables with chairs and a lamp over each
    const tables: [number, number][] = [
      [-3.6, -0.6],
      [-1.2, 1.6],
      [1.4, -0.2],
      [3.8, 2.0],
      [-3.8, 2.6],
    ];
    for (const [tx, tz] of tables) {
      add(cyl(0.55, 0.55, 0.05, 24), mat("#e8e2d4", { rough: 0.6 }), tx, 0.76, tz);
      add(cyl(0.05, 0.05, 0.74, 8), mat("#1a1b1d"), tx, 0.37, tz);
      for (let c = 0; c < 3; c++) {
        const a = (c / 3) * Math.PI * 2 + 0.4;
        add(rbox(0.42, 0.45, 0.42, 0.05), mat("#3a2a20", { rough: 0.8 }), tx + Math.cos(a) * 0.9, 0.23, tz + Math.sin(a) * 0.9);
      }
      lamp(tx, 2.3, tz, "#ffc27a");
      add(cyl(0.005, 0.005, 0.9, 4), mat("#111"), tx, 2.75, tz);
      ob.push({ x: tx, z: tz, r: 1.1 });
    }
    hs.push({ id: "table", label: "Take a table", x: 1.4, z: 1.2 });
    signBoard(life.places.restaurant, "#ffe9c2", "#2a1d15", -2.5, 2.75, -d / 2 + 0.12, 3, 0.5);
    spawn = [0, 3.2];
    mood = "warm";
  } else if (place === "mall") {
    w = 18;
    d = 14;
    floor(w, d, floorTex("tile", "#9b948a"), 0.18, 0.8);
    room(w, d, 6, "#8f877c");
    const stores: [string, string, number, number, number][] = [
      ["Northline", "#2a3a4a", -5.5, -d / 2 + 0.3, 0],
      ["Kurobe", "#3a2a2a", 0, -d / 2 + 0.3, 0],
      ["Lumen", "#1e2a36", 5.5, -d / 2 + 0.3, 0],
      ["Pixelforge", "#2a1e36", w / 2 - 0.3, 0.5, -Math.PI / 2],
    ];
    for (const [name, col, sx, sz, ry] of stores) {
      const box = add(rbox(4.6, 3.6, 0.3, 0.04), mat(col, { rough: 0.5 }), sx, 1.8, sz, ry);
      box.castShadow = false;
      const glassFront = add(rbox(3.6, 2.6, 0.06, 0.02), glow("#f2e2c6", 0.42), sx, 1.35, sz + Math.cos(ry) * 0.17, ry);
      glassFront.castShadow = false;
      signBoard(name.toUpperCase(), "#f4f2ec", col, sx - Math.sin(ry) * 0.18, 3.25, sz + Math.cos(ry) * 0.18, 3, 0.5, ry);
      hs.push({ id: "store:" + name, label: name, x: sx - Math.sin(ry) * 1.4, z: sz + Math.cos(ry) * 1.4 });
    }
    // a fountain in the middle, plants, benches, light wells
    add(cyl(1.8, 1.9, 0.5, 32), mat("#d8d4cc", { rough: 0.4 }), 0, 0.25, 1.2);
    const water = add(cyl(1.6, 1.6, 0.05, 32), glow("#6ad0f0", 0.55), 0, 0.48, 1.2);
    water.castShadow = false;
    ob.push({ x: 0, z: 1.2, r: 2.1 });
    plant(-6, 3, 1.4);
    plant(6, 3.5, 1.4);
    for (const bx of [-4, 4]) {
      add(rbox(1.8, 0.45, 0.5, 0.05), mat("#6a5a48", { rough: 0.6 }), bx, 0.23, 4.5);
      ob.push({ x: bx, z: 4.5, r: 0.9 });
    }
    signBoard(life.places.mall.toUpperCase(), "#0b0d0c", accent, -w / 2 + 0.12, 4.6, 0, 6, 0.9, Math.PI / 2);
    spawn = [0, 5];
    mood = "cool";
  } else if (place === "shops") {
    w = 20;
    d = 11;
    outdoor = true;
    floor(w, d, floorTex("stone"), life.weather.kind === "rain" || life.weather.kind === "storm" ? 0.42 : 0.62, 1.3);
    const fronts: [string, string, number][] = [
      ["Arden", "#1c2230", -7.5],
      ["Solenne", "#2a1c24", -2.5],
      ["Halcyon", "#1e2a24", 2.5],
      ["Celestor", "#2a2418", 7.5],
    ];
    for (const [name, col, fx] of fronts) {
      add(rbox(4.6, 5, 0.5, 0.05), mat(col, { rough: 0.5 }), fx, 2.5, -d / 2);
      const win = add(rbox(3.4, 2.6, 0.05, 0.02), glow("#fff0d8", 0.65), fx, 1.6, -d / 2 + 0.28);
      win.castShadow = false;
      signBoard(name.toUpperCase(), "#e8d9b0", col, fx, 3.6, -d / 2 + 0.27, 3.2, 0.55);
      lamp(fx - 1.8, 3.2, -d / 2 + 0.5, "#ffe0b0");
      hs.push({ id: "store:" + name, label: name + (name === "Halcyon" ? " and Maison Orrè" : ""), x: fx, z: -d / 2 + 1.5 });
    }
    // the showroom on the right: glass, a turntable, the car of the week
    add(rbox(0.3, 5, d, 0.05), mat("#16181b", { rough: 0.4 }), w / 2, 2.5, 0);
    const turn = add(cyl(2.4, 2.4, 0.12, 40), mat("#d8dde2", { rough: 0.2, metal: 0.6 }), w / 2 - 3.4, 0.06, 0.8);
    turn.castShadow = false;
    const pick = life.cars.find((c) => !c.owned && c.canBuy) || life.cars[life.cars.length - 1];
    const car = makeCar(pick);
    car.position.set(w / 2 - 3.4, 0.12, 0.8);
    car.name = "turntable";
    g.add(car);
    ob.push({ x: w / 2 - 3.4, z: 0.8, r: 2.6 });
    signBoard("SHOWROOM", "#0b0d0c", "#e8d9b0", w / 2 - 0.17, 3.8, 0.8, 3, 0.6, -Math.PI / 2);
    hs.push({ id: "showroom", label: "Car showroom", x: w / 2 - 3.4, z: 3.6 });
    for (const lx of [-9, -3, 3]) {
      add(cyl(0.06, 0.08, 4, 8), mat("#1a1b1d", { metal: 0.6 }), lx, 2, d / 2 - 0.6);
      lamp(lx, 4.05, d / 2 - 0.6, "#ffe6c0");
    }
    spawn = [-2, 3];
    mood = "night";
  } else if (place === "training") {
    w = 26;
    d = 18;
    outdoor = true;
    floor(w, d, floorTex("grass"), 0.9, 0.6);
    // pitch lines, cones, mannequins, a goal, balls
    const lineM = glow("#f4f6f0", 0.75);
    for (const [lx, lz, lw, ld] of [
      [0, -d / 2 + 1, w - 2, 0.08],
      [0, d / 2 - 1, w - 2, 0.08],
      [-w / 2 + 1, 0, 0.08, d - 2],
      [w / 2 - 1, 0, 0.08, d - 2],
      [0, 0, 0.08, d - 2],
    ] as number[][]) {
      const l = new THREE.Mesh(plane(lw, ld), lineM);
      l.rotation.x = -Math.PI / 2;
      l.position.set(lx, 0.012, lz);
      g.add(l);
    }
    for (let i = 0; i < 9; i++) add(cone(0.16, 0.34), mat("#ff8a2a", { rough: 0.6 }), -6 + i * 1.2, 0.17, -2 + (i % 2) * 1.2);
    hs.push({ id: "drills", label: "Extra session", x: -1.2, z: 0.6 });
    for (let i = 0; i < 4; i++) {
      add(rbox(0.5, 1.8, 0.2, 0.08), mat("#e8e030", { rough: 0.7 }), 5 + i * 0.7, 0.9, -4);
      ob.push({ x: 5 + i * 0.7, z: -4, r: 0.4 });
    }
    const post = mat("#f4f6f0", { rough: 0.4 });
    add(cyl(0.06, 0.06, 2.44, 8), post, -w / 2 + 1.2, 1.22, -3.66);
    add(cyl(0.06, 0.06, 2.44, 8), post, -w / 2 + 1.2, 1.22, 3.66);
    add(cyl(0.06, 0.06, 7.32, 8), post, -w / 2 + 1.2, 2.44, 0).rotation.x = Math.PI / 2;
    ob.push({ x: -w / 2 + 1.2, z: -3.66, r: 0.3 }, { x: -w / 2 + 1.2, z: 3.66, r: 0.3 });
    const balls = new THREE.InstancedMesh(sphere(0.11, 12), mat("#f4f4f4", { rough: 0.5 }), 8);
    const mm = new THREE.Matrix4();
    for (let i = 0; i < 8; i++) balls.setMatrixAt(i, mm.makeTranslation(-3 + (i % 4) * 0.4, 0.11, 2 + Math.floor(i / 4) * 0.4));
    g.add(balls);
    for (const [px, pz] of [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [-w / 2, d / 2],
      [w / 2, d / 2],
    ]) {
      add(cyl(0.12, 0.16, 12, 8), mat("#8a9096", { metal: 0.6, rough: 0.4 }), px, 6, pz);
      add(rbox(1.6, 0.6, 0.3, 0.05), glow("#f4f8ff", 2), px, 12, pz).lookAt(0, 0, 0);
    }
    spawn = [0, 4];
    mood = "stadium";
  } else {
    // the stadium: on the pitch, the stands all round, the tunnel behind
    w = 30;
    d = 20;
    outdoor = true;
    floor(w, d, floorTex("grass"), 0.9, 0.5);
    const lineM = glow("#f4f6f0", 0.75);
    for (const [lx, lz, lw, ld] of [
      [0, 0, 0.1, d - 2],
      [0, -d / 2 + 1, w - 2, 0.1],
      [0, d / 2 - 1, w - 2, 0.1],
    ] as number[][]) {
      const l = new THREE.Mesh(plane(lw, ld), lineM);
      l.rotation.x = -Math.PI / 2;
      l.position.set(lx, 0.012, lz);
      g.add(l);
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(3, 3.1, 64), lineM);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.013;
    g.add(ring);
    // stands: rows stepping up and back, a sea of seats with a few fans
    const seat = mat("#2a2f36", { rough: 0.9 });
    for (const side of [-1, 1]) {
      for (let r = 0; r < 8; r++) add(rbox(w + 6, 0.5, 1.0, 0.02), seat, 0, 0.5 + r * 0.6, side * (d / 2 + 1.4 + r * 0.9));
    }
    for (const side of [-1, 1]) for (let r = 0; r < 8; r++) add(rbox(1.0, 0.5, d + 2, 0.02), seat, side * (w / 2 + 1.4 + r * 0.9), 0.5 + r * 0.6, 0);
    const fans = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.18, 0.36, 4, 8), new THREE.MeshStandardMaterial({ roughness: 0.9 }), 260);
    const heads = new THREE.InstancedMesh(sphere(0.12, 8), mat("#8a5a3c", { rough: 0.8 }), 260);
    const fr = seeded("fans" + life.style.key);
    const mm = new THREE.Matrix4();
    const cc = new THREE.Color();
    for (let i = 0; i < 260; i++) {
      const side = i % 4;
      const r = Math.floor(fr() * 8);
      const along = (fr() - 0.5) * (side < 2 ? w : d);
      const off = (side < 2 ? d : w) / 2 + 1.4 + r * 0.9;
      const p = side === 0 ? [along, 1.05 + r * 0.6, -off] : side === 1 ? [along, 1.05 + r * 0.6, off] : side === 2 ? [-off, 1.05 + r * 0.6, along] : [off, 1.05 + r * 0.6, along];
      fans.setMatrixAt(i, mm.makeTranslation(p[0], p[1], p[2]));
      heads.setMatrixAt(i, mm.makeTranslation(p[0], p[1] + 0.42, p[2]));
      fans.setColorAt(i, cc.set(fr() < 0.5 ? accent : ["#e8e4dc", "#1a1c20", "#c8102e", "#2a4a8a"][Math.floor(fr() * 4)]));
    }
    own.push(fans.material as THREE.Material);
    ownGeo.push(fans.geometry);
    g.add(fans, heads);
    hs.push({ id: "fans", label: "Meet the fans", x: 0, z: d / 2 - 1.6 });
    hs.push({ id: "pitch", label: "Next match", x: 0, z: 0 });
    for (const [px, pz] of [
      [-w / 2 - 6, -d / 2 - 6],
      [w / 2 + 6, -d / 2 - 6],
      [-w / 2 - 6, d / 2 + 6],
      [w / 2 + 6, d / 2 + 6],
    ]) {
      add(rbox(3, 1.4, 0.4, 0.1), glow("#f4f8ff", 2.2), px, 16, pz).lookAt(0, 0, 0);
      const c = new THREE.Mesh(cone(8, 22), lightCone("#e8f0ff", 0.06));
      c.position.set(px * 0.55, 8, pz * 0.55);
      c.lookAt(px, 16, pz);
      c.rotateX(-Math.PI / 2);
      g.add(c);
    }
    spawn = [0, 4];
    mood = "stadium";
  }
  return {
    w,
    d,
    spawn,
    obstacles: ob,
    hotspots: hs,
    group: g,
    walls,
    mood,
    outdoor,
    dispose: () => {
      own.forEach((m) => m.dispose());
      ownGeo.forEach((x) => x.dispose());
      ownTex.forEach((x) => x.dispose());
      for (const wl of walls) (wl.mesh as THREE.Mesh).geometry.dispose();
    },
  };
}

// ---------- the scene: the room, the light, you, the camera ----------
export default function Interior({
  place,
  state,
  quality,
  night,
  outfit,
  ctl,
  labelEls,
  onNear,
  onUse,
  onHotspots,
}: {
  place: PlaceId;
  state: CareerState;
  quality: number;
  night: number;
  outfit: Outfit;
  ctl: React.MutableRefObject<WalkCtl>;
  labelEls: React.MutableRefObject<Map<string, HTMLElement>>;
  onNear: (id: string | null) => void;
  onUse: (id: string) => void;
  onHotspots: (h: Hotspot[]) => void;
}) {
  const homeKey = place === "home" ? state.life.home.id + "|" + (state.life.car?.id || "") + "|" + state.trophies.length + "|" + state.life.items.filter((i) => i.owned).length : "";
  const dark = night > 0.5;
  const room = useMemo(
    () => buildRoom(place, state, dark ? 1 : 0),
    // rebuilt when the place changes, or the home's contents do
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [place, homeKey, dark],
  );
  useEffect(() => () => room.dispose(), [room]);
  useEffect(() => onHotspots(room.hotspots), [room, onHotspots]);
  const lookKey = JSON.stringify(state.look);
  const fine = quality >= 2;
  const { height, weight } = state.person;
  const rig = useMemo(
    () => makeBody(state.look, state.person, outfit, Math.min(2, quality)),
    // rebuilt only when what he looks like changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lookKey, height, weight, outfit, fine],
  );
  useEffect(() => () => rig.dispose(), [rig]);
  const me = useMemo(() => ({ x: room.spawn[0], z: room.spawn[1], heading: Math.PI, target: null as null | { x: number; z: number; use?: string }, near: null as string | null, fresh: true }), [room]);
  const keys = useRef(new Set<string>());
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(k)) {
        keys.current.add(k);
        me.target = null;
        if (k.startsWith("arrow")) e.preventDefault();
      }
      if (k === "e" && me.near) onUse(me.near);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [me, onUse]);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const ringRefs = useRef<THREE.Mesh[]>([]);
  useFrame(({ camera, clock, size }, dt0) => {
    const dt = Math.min(dt0, 0.05);
    const c = ctl.current;
    // a request from the screen to walk to a spot and use it
    if (c.use >= 0 && room.hotspots[c.use]) {
      const h = room.hotspots[c.use];
      me.target = { x: h.x, z: h.z, use: h.id };
      c.use = -1;
    }
    // movement: keys move relative to the camera, a click target walks there
    const K = keys.current;
    let mx = (K.has("d") || K.has("arrowright") ? 1 : 0) - (K.has("a") || K.has("arrowleft") ? 1 : 0);
    let mz = (K.has("s") || K.has("arrowdown") ? 1 : 0) - (K.has("w") || K.has("arrowup") ? 1 : 0);
    let speed = 0;
    if (mx || mz) {
      const cy = Math.cos(c.yaw),
        sy = Math.sin(c.yaw);
      const vx = mx * cy + mz * sy,
        vz = -mx * sy + mz * cy;
      const l = Math.hypot(vx, vz) || 1;
      mx = vx / l;
      mz = vz / l;
      speed = K.has("shift") ? 4.2 : 2.3;
    } else if (me.target) {
      const dx = me.target.x - me.x,
        dz = me.target.z - me.z;
      const l = Math.hypot(dx, dz);
      if (l < 0.35 || (me.target.use && l < 0.9)) {
        if (me.target.use) onUse(me.target.use);
        me.target = null;
      } else {
        mx = dx / l;
        mz = dz / l;
        speed = Math.min(2.6, 0.8 + l * 1.4);
      }
    }
    if (speed > 0) {
      me.x += mx * speed * dt;
      me.z += mz * speed * dt;
      let want = Math.atan2(mx, mz);
      const cur = rig.root.rotation.y;
      want = cur + Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
      me.heading = want;
    }
    // stay inside, keep off the furniture
    const pad = 0.42;
    me.x = THREE.MathUtils.clamp(me.x, -room.w / 2 + pad, room.w / 2 - pad);
    me.z = THREE.MathUtils.clamp(me.z, -room.d / 2 + pad, room.d / 2 - pad);
    for (const o of room.obstacles) {
      const dx = me.x - o.x,
        dz = me.z - o.z;
      const l = Math.hypot(dx, dz),
        need = o.r + 0.3;
      if (l < need && l > 1e-4) {
        me.x = o.x + (dx / l) * need;
        me.z = o.z + (dz / l) * need;
      }
    }
    rig.root.position.set(me.x, 0, me.z);
    rig.tick(dt, me.heading, speed);
    // the nearest thing to use
    let near: string | null = null;
    let best = 1e9;
    room.hotspots.forEach((h, k) => {
      const l = Math.hypot(h.x - me.x, h.z - me.z);
      if (l < (h.r || 1.25) && l < best) {
        best = l;
        near = h.id;
      }
      const r = ringRefs.current[k];
      if (r) {
        const on = near === h.id;
        (r.material as THREE.MeshBasicMaterial).opacity = on ? 0.95 : 0.45 + Math.sin(clock.elapsedTime * 3 + k) * 0.15;
        r.scale.setScalar(on ? 1.15 : 1);
      }
    });
    if (near !== me.near) {
      me.near = near;
      onNear(near);
    }
    // the camera: behind and above, turned by dragging, further out of doors
    const dist = (room.outdoor ? 9.5 : 6.4) * c.zoom;
    const height = (room.outdoor ? 6.2 : 5.0) * c.zoom;
    tmp.set(me.x + Math.sin(c.yaw) * dist, height, me.z + Math.cos(c.yaw) * dist);
    // the first frame in a room puts the camera straight behind him, after that it follows smoothly
    if (me.fresh) {
      camera.position.copy(tmp);
      me.fresh = false;
    } else camera.position.lerp(tmp, Math.min(1, dt * 5));
    // look a little ahead of him, so the room in front fills the picture
    look.set(me.x - Math.sin(c.yaw) * 1.6, 0.8, me.z - Math.cos(c.yaw) * 1.6);
    camera.lookAt(look);
    // walls between the camera and him drop down
    for (const wl of room.walls) {
      const side = (camera.position.x - wl.cx) * wl.nx + (camera.position.z - wl.cz) * wl.nz;
      const target = side < 0 ? 0.08 : 1;
      wl.mesh.scale.y += (target - wl.mesh.scale.y) * Math.min(1, dt * 8);
    }
    // the turntable in the showroom
    const tt = room.group.getObjectByName("turntable");
    if (tt) tt.rotation.y += dt * 0.35;
    // labels over the things to use
    room.hotspots.forEach((h) => {
      const el = labelEls.current.get("hs:" + h.id);
      if (!el) return;
      tmp.set(h.x, 1.9, h.z).project(camera);
      el.style.transform = `translate(${((tmp.x + 1) / 2) * size.width}px, ${((1 - tmp.y) / 2) * size.height}px) translate(-50%, -100%)`;
      el.style.opacity = tmp.z > 1 ? "0" : "1";
    });
  });
  const ringMat = useMemo(
    () => room.hotspots.map(() => new THREE.MeshBasicMaterial({ color: state.life.style.accent, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false })),
    [room, state.life.style.accent],
  );
  useEffect(() => () => ringMat.forEach((m) => m.dispose()), [ringMat]);
  const lights = room.mood;
  const shadows = quality >= 2;
  return (
    <>
      <color attach="background" args={[lights === "stadium" || lights === "night" ? "#05070b" : "#0c0d0f"]} />
      {room.outdoor && <fog attach="fog" args={["#05070b", 18, 60]} />}
      <hemisphereLight args={[lights === "cool" ? "#cfe0ff" : "#ffe6c8", "#1a1612", lights === "stadium" ? 0.7 : 0.55]} />
      <directionalLight
        position={[room.w * 0.25, 9, room.d * 0.35]}
        intensity={lights === "stadium" ? 2.2 : 1.1}
        color={lights === "warm" ? "#ffe2bc" : "#eef4ff"}
        castShadow={shadows}
        shadow-mapSize={[quality >= 3 ? 2048 : 1024, quality >= 3 ? 2048 : 1024]}
        shadow-camera-left={-room.w / 2 - 1}
        shadow-camera-right={room.w / 2 + 1}
        shadow-camera-top={room.d / 2 + 1}
        shadow-camera-bottom={-room.d / 2 - 1}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
      />
      {!room.outdoor && <pointLight position={[0, 2.6, 0]} intensity={lights === "warm" ? 8 : 6} distance={room.w * 1.4} decay={1.6} color={lights === "warm" ? "#ffcf96" : "#e8f0ff"} />}
      {lights === "night" && <pointLight position={[-4, 3, -2]} intensity={10} distance={14} decay={1.6} color="#ffd9a8" />}
      <primitive
        object={room.group}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 6) return;
          e.stopPropagation();
          me.target = { x: e.point.x, z: e.point.z };
        }}
      />
      <primitive object={rig.root} />
      <mesh
        rotation-x={-Math.PI / 2}
        position-y={0.005}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 6) return;
          e.stopPropagation();
          me.target = { x: e.point.x, z: e.point.z };
        }}
      >
        <planeGeometry args={[room.w, room.d]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {room.hotspots.map((h, k) => (
        <mesh
          key={h.id}
          ref={(m: THREE.Mesh | null) => {
            if (m) ringRefs.current[k] = m;
          }}
          rotation-x={-Math.PI / 2}
          position={[h.x, 0.02, h.z]}
          material={ringMat[k]}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            if (e.delta > 6) return;
            e.stopPropagation();
            me.target = { x: h.x, z: h.z, use: h.id };
          }}
        >
          <ringGeometry args={[0.42, 0.52, 40]} />
        </mesh>
      ))}
    </>
  );
}

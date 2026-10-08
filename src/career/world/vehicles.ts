/**
 * Cars, bikes and the bus. Each body is one merged mesh painted with vertex colours (the paint is white and
 * takes the instance colour), so the traffic is a few instanced draw calls. The traffic drives the street grid
 * on its own side of the road, turns at corners, stops at red lights and for him, and keeps its distance.
 * The bus runs a loop with stops. His own car uses the same bodies, one at a time, at full detail.
 */
import * as THREE from "three";
import { Mesher, BOX, CYL8, CYL16, worldMaterial } from "./mesher";
import { roadLanes, rng, type CityPlan, type Lane } from "./gen";

export type Body = "scooter" | "bike" | "hatch" | "saloon" | "coupe" | "sports" | "suv" | "hyper" | "van" | "taxi" | "bus";
const PAINT = "#ffffff";
const GLASS = "#18202a";
const TYRE = "#111214";
const RIM = "#b9bec4";
const DARK = "#0c0e10";

/** the body as one geometry; z forward, wheels on the ground; paint is white so instance colours tint it */
export function bodyGeometry(body: Body, paint = PAINT, lod: "high" | "low" = "high") {
  const m = new Mesher();
  // far and parked cars get eight sided wheels and no rims; his own car gets the round ones
  const wheel = (x: number, z: number, r: number, w: number) => {
    m.add(lod === "low" ? CYL8 : CYL16, TYRE, x, r, z, { rz: Math.PI / 2, sx: r * 2, sy: w, sz: r * 2 });
    if (lod === "high") m.add(CYL16, RIM, x + Math.sign(x) * 0.01, r, z, { rz: Math.PI / 2, sx: r * 1.25, sy: w + 0.02, sz: r * 1.25 });
  };
  if (body === "scooter" || body === "bike") {
    const bike = body === "bike";
    m.box(paint, 0, bike ? 0.62 : 0.4, 0, 0.32, bike ? 0.34 : 0.16, bike ? 1.3 : 1.15);
    m.box(paint, 0, bike ? 0.86 : 0.72, bike ? 0.42 : 0.5, 0.3, bike ? 0.3 : 0.7, bike ? 0.5 : 0.22);
    m.box(DARK, 0, bike ? 0.9 : 0.66, -0.25, 0.28, 0.1, 0.6);
    m.box(RIM, 0, bike ? 1.0 : 1.12, bike ? 0.62 : 0.56, 0.62, 0.04, 0.04);
    m.box("#fff6e0", 0, bike ? 0.82 : 0.95, bike ? 0.72 : 0.64, 0.14, 0.08, 0.04, { glow: 1, day: 0.3 });
    wheel(0.001, bike ? 0.72 : 0.56, bike ? 0.31 : 0.23, bike ? 0.16 : 0.12);
    wheel(0.001, bike ? -0.68 : -0.46, bike ? 0.31 : 0.23, bike ? 0.19 : 0.12);
    return m.build();
  }
  if (body === "bus") {
    const L = 11.6,
      W = 2.5;
    m.box(paint, 0, 1.7, 0, W, 2.6, L);
    m.box(GLASS, 0, 2.15, 0.2, W + 0.02, 1.0, L - 1.6, { glow: 0.5 });
    m.box(GLASS, 0, 2.0, L / 2 - 0.05, W - 0.3, 1.3, 0.1, { glow: 0.3 });
    m.box(DARK, 0, 3.05, 0, W - 0.2, 0.12, L - 0.4);
    m.box("#ffb000", 0, 3.02, L / 2 + 0.01, 1.6, 0.25, 0.04, { glow: 1, day: 0.6 });
    for (const sx of [-1, 1]) {
      m.box("#fff6e0", sx * 0.85, 0.75, L / 2 + 0.01, 0.35, 0.16, 0.04, { glow: 1, day: 0.2 });
      m.box("#ff2a2a", sx * 0.9, 0.9, -L / 2 - 0.01, 0.25, 0.3, 0.04, { glow: 0.8 });
    }
    for (const z of [3.6, -3.4]) for (const sx of [-1, 1]) wheel(sx * (W / 2 - 0.1), z, 0.5, 0.3);
    return m.build();
  }
  const dims: Record<string, [number, number, number, number, number, number]> = {
    // width, body height, length, cabin height, cabin share of the length, ground clearance
    hatch: [1.75, 0.62, 3.9, 0.55, 0.6, 0.18],
    saloon: [1.84, 0.6, 4.75, 0.5, 0.5, 0.17],
    taxi: [1.84, 0.6, 4.75, 0.5, 0.5, 0.17],
    coupe: [1.9, 0.56, 4.6, 0.44, 0.42, 0.14],
    sports: [1.96, 0.5, 4.5, 0.38, 0.36, 0.11],
    suv: [1.98, 0.82, 4.9, 0.62, 0.6, 0.3],
    hyper: [2.04, 0.44, 4.7, 0.34, 0.3, 0.1],
    van: [1.98, 1.25, 5.2, 0.6, 0.3, 0.22],
  };
  const [w, bh, l, ch, cl, clear] = dims[body] || dims.saloon;
  const by = clear + 0.14 + bh / 2;
  m.box(paint, 0, by, 0, w, bh, l);
  // a nose that slopes down and a tail, so it reads as a car and not a box
  m.add(BOX, paint, 0, by + bh * 0.32, l * 0.36, { rx: body === "van" ? 0 : 0.12, sx: w * 0.98, sy: bh * 0.4, sz: l * 0.26 });
  if (body === "van") {
    m.box(GLASS, 0, by + bh / 2 + 0.02, l / 2 - 0.55, w * 0.9, 0.5, 0.06, { glow: 0.2 });
  } else {
    const cy = by + bh / 2 + ch / 2;
    m.box(GLASS, 0, cy, -l * 0.04, w * 0.84, ch, l * cl, { glow: 0.15 });
    m.box(paint, 0, cy + ch / 2 + 0.02, -l * 0.04, w * 0.8, 0.05, l * cl * 0.82);
    if (body === "taxi") m.box("#ffe14d", 0, cy + ch / 2 + 0.12, -l * 0.04, 0.6, 0.16, 0.25, { glow: 1, day: 0.5 });
  }
  if (body === "sports" || body === "hyper") m.box(DARK, 0, by + bh / 2 + 0.06, -l / 2 + 0.25, w * 0.86, 0.05, 0.3);
  for (const sx of [-1, 1]) {
    m.box("#fff6e0", sx * (w / 2 - 0.32), by + bh * 0.15, l / 2 + 0.005, 0.38, 0.09, 0.04, { glow: 1, day: 0.25 });
    m.box("#ff2020", sx * (w / 2 - 0.3), by + bh * 0.22, -l / 2 - 0.005, 0.42, 0.08, 0.04, { glow: 0.9, day: 0.15 });
  }
  m.box(DARK, 0, by - bh * 0.15, l / 2 + 0.01, w * 0.42, bh * 0.25, 0.04);
  const wr = body === "suv" || body === "van" ? 0.4 : body === "hyper" || body === "sports" ? 0.36 : 0.33;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) wheel(sx * (w / 2 - 0.08), sz * (l / 2 - l * 0.18), wr, 0.26);
  return m.build();
}

export const TRAFFIC_BODIES: Body[] = ["hatch", "saloon", "suv", "taxi", "van"];
const TRAFFIC_COLOURS = ["#e8e6e1", "#1b1e23", "#9aa0a6", "#b3262e", "#1d3557", "#2f4f4f", "#c9b38a", "#4a5560", "#6b7b8c", "#7a1f2b"];

interface Car {
  lane: number;
  t: number;
  speed: number;
  max: number;
  body: number;
  slot: number;
  x: number;
  z: number;
  ry: number;
}

/** junctions change every 16 seconds: roads along x go first, then roads along z */
export function lightGreen(plan: CityPlan, x: number, z: number, alongX: boolean, t: number) {
  const k = Math.round((x + plan.half) / plan.pitch),
    m = Math.round((z + plan.half) / plan.pitch);
  const off = ((k * 7 + m * 13) % 16) + 0.5;
  const ph = (t + off) % 16;
  return alongX ? ph < 7 : ph >= 8 && ph < 15;
}

export function makeTraffic(plan: CityPlan, count: number, night: { value: number }) {
  const lanes = roadLanes(plan);
  // the lanes that start at each junction
  const key = (x: number, z: number) => Math.round(x / 4) + "," + Math.round(z / 4);
  const from = new Map<string, number[]>();
  const ends = lanes.map((L) => {
    const dx = L.bx - L.ax,
      dz = L.bz - L.az;
    const len = Math.hypot(dx, dz);
    return { len, ux: dx / len, uz: dz / len, jx: Math.round((L.bx + plan.half) / plan.pitch), jz: Math.round((L.bz + plan.half) / plan.pitch) };
  });
  lanes.forEach((L, i) => {
    const jx = Math.round((L.ax + plan.half) / plan.pitch),
      jz = Math.round((L.az + plan.half) / plan.pitch);
    const k = jx + "," + jz;
    const a = from.get(k);
    if (a) a.push(i);
    else from.set(k, [i]);
  });
  void key;
  const mat = worldMaterial(night, { rough: 0.35, metal: 0.4 });
  const meshes = TRAFFIC_BODIES.map((b) => {
    const im = new THREE.InstancedMesh(bodyGeometry(b, PAINT, "low"), mat, count);
    im.count = 0;
    im.frustumCulled = false;
    im.castShadow = true;
    return im;
  });
  const r = rng(plan.seed + 5);
  const cars: Car[] = [];
  const counts = TRAFFIC_BODIES.map(() => 0);
  const colour = new THREE.Color();
  const usable = lanes.map((L) => Math.abs(L.ax) < plan.half + 1 && Math.abs(L.az) < plan.half + 1);
  const spawnNear = (c: Car, x: number, z: number, rad: number) => {
    for (let k = 0; k < 20; k++) {
      const i = Math.floor(r() * lanes.length);
      const L = lanes[i];
      if (!usable[i]) continue;
      const d = Math.hypot((L.ax + L.bx) / 2 - x, (L.az + L.bz) / 2 - z);
      if (d > rad || d < 25) continue;
      c.lane = i;
      c.t = r() * ends[i].len * 0.6;
      return;
    }
  };
  for (let k = 0; k < count; k++) {
    const body = k % TRAFFIC_BODIES.length === 3 && r() < 0.6 ? 3 : Math.floor(r() * TRAFFIC_BODIES.length);
    const c: Car = { lane: 0, t: 0, speed: 0, max: 9 + r() * 4, body, slot: counts[body]++, x: 0, z: 0, ry: 0 };
    spawnNear(c, plan.spawn.x, plan.spawn.z, 220);
    cars.push(c);
    const im = meshes[body];
    colour.set(TRAFFIC_BODIES[body] === "taxi" ? (plan.flavor === "uk" ? "#111111" : plan.flavor === "india" ? "#ffd400" : "#f2c400") : TRAFFIC_COLOURS[Math.floor(r() * TRAFFIC_COLOURS.length)]);
    im.setColorAt(c.slot, colour);
  }
  meshes.forEach((im, b) => {
    im.count = counts[b];
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const v = new THREE.Vector3();
  // where the junction box starts: the stop line
  const stopBack = plan.road / 2 + plan.walk + 1;
  const tick = (dt: number, t: number, me: { x: number; z: number; rad: number }, radius: number) => {
    for (const c of cars) {
      const L = lanes[c.lane],
        E = ends[c.lane];
      let want = c.max;
      // the light at the end of this stretch
      const toEnd = E.len - c.t;
      const alongX = Math.abs(E.ux) > 0.5;
      if (toEnd < stopBack + 14 && toEnd > stopBack - 1.5 && !lightGreen(plan, L.bx, L.bz, alongX, t)) want = Math.max(0, ((toEnd - stopBack) / 14) * c.max);
      // the car in front in the same lane
      for (const o of cars) {
        if (o === c || o.lane !== c.lane) continue;
        const gap = o.t - c.t;
        if (gap > 0 && gap < 14) want = Math.min(want, Math.max(0, (gap - 6) * 1.2));
      }
      // him, on foot or in his car, in the lane ahead
      const ax = me.x - c.x,
        az = me.z - c.z;
      const ahead = ax * E.ux + az * E.uz,
        lateral = Math.abs(-ax * E.uz + az * E.ux);
      if (ahead > 0 && ahead < 16 && lateral < 1.6 + me.rad) want = Math.min(want, Math.max(0, (ahead - 5) * 1.1));
      c.speed += Math.max(-9 * dt, Math.min(3 * dt, want - c.speed));
      c.t += c.speed * dt;
      if (c.t >= E.len) {
        // the junction: carry on, turn left or right, never back the way it came
        const next = (from.get(E.jx + "," + E.jz) || []).filter((i) => usable[i] && !(Math.abs(ends[i].ux + E.ux) < 0.01 && Math.abs(ends[i].uz + E.uz) < 0.01));
        const straight = next.find((i) => Math.abs(ends[i].ux - E.ux) < 0.01 && Math.abs(ends[i].uz - E.uz) < 0.01);
        const pickNext = straight !== undefined && r() < 0.55 ? straight : next.length ? next[Math.floor(r() * next.length)] : -1;
        if (pickNext < 0) spawnNear(c, me.x, me.z, radius);
        else {
          c.lane = pickNext;
          c.t = Math.max(0, c.t - E.len);
        }
      }
      const L2 = lanes[c.lane],
        E2 = ends[c.lane];
      const tx = L2.ax + E2.ux * c.t,
        tz = L2.az + E2.uz * c.t;
      // ease through the corner instead of jumping lanes
      const k = Math.min(1, dt * 6);
      c.x += (tx - c.x) * (Math.hypot(tx - c.x, tz - c.z) > 12 ? 1 : k);
      c.z += (tz - c.z) * (Math.hypot(tx - c.x, tz - c.z) > 12 ? 1 : k);
      const ry = Math.atan2(E2.ux, E2.uz);
      let dr = ry - c.ry;
      dr = Math.atan2(Math.sin(dr), Math.cos(dr));
      c.ry += dr * Math.min(1, dt * 5);
      // too far from him: start again on a street near him
      if (Math.hypot(c.x - me.x, c.z - me.z) > radius) {
        spawnNear(c, me.x, me.z, radius * 0.8);
        const L3 = lanes[c.lane];
        c.x = L3.ax + ends[c.lane].ux * c.t;
        c.z = L3.az + ends[c.lane].uz * c.t;
        c.ry = Math.atan2(ends[c.lane].ux, ends[c.lane].uz);
      }
      v.set(c.x, 0, c.z);
      q.setFromAxisAngle(up, c.ry);
      m4.compose(v, q, one);
      meshes[c.body].setMatrixAt(c.slot, m4);
    }
    for (const im of meshes) im.instanceMatrix.needsUpdate = true;
  };
  return {
    meshes,
    tick,
    cars,
    dispose: () => {
      for (const im of meshes) {
        im.geometry.dispose();
        im.dispose();
      }
      mat.dispose();
    },
  };
}

/** parked cars along the kerbs, one instanced mesh per body */
export function makeParked(plan: CityPlan, night: { value: number }) {
  const mat = worldMaterial(night, { rough: 0.35, metal: 0.4 });
  const bodies: Body[] = ["hatch", "saloon", "suv", "coupe"];
  const r = rng(plan.seed + 9);
  const col = new THREE.Color();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const meshes = bodies.map((b, bi) => {
    const list = plan.parked.filter((p) => p[3] === bi);
    const im = new THREE.InstancedMesh(bodyGeometry(b, PAINT, "low"), mat, Math.max(1, list.length));
    im.count = list.length;
    list.forEach((p, k) => {
      q.setFromAxisAngle(up, p[2]);
      m4.compose(new THREE.Vector3(p[0], 0.12, p[1]), q, one);
      im.setMatrixAt(k, m4);
      col.set(TRAFFIC_COLOURS[Math.floor(r() * TRAFFIC_COLOURS.length)]);
      im.setColorAt(k, col);
    });
    im.castShadow = true;
    return im;
  });
  return { meshes, dispose: () => { for (const im of meshes) { im.geometry.dispose(); im.dispose(); } mat.dispose(); } };
}

/** the bus: drives the loop, stops at every stop for a few seconds */
export function makeBus(plan: CityPlan, night: { value: number }) {
  const mat = worldMaterial(night, { rough: 0.4, metal: 0.3 });
  const mesh = new THREE.Mesh(bodyGeometry("bus", plan.flavor === "uk" ? "#d0202a" : plan.flavor === "india" ? "#2f6db5" : "#e8e4dc"), mat);
  mesh.castShadow = true;
  const pts = plan.bus;
  const cum: number[] = [];
  let acc = 0;
  for (let k = 0; k < pts.length; k++) {
    cum.push(acc);
    const a = pts[k],
      b = pts[(k + 1) % pts.length];
    acc += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  const total = acc;
  const st = { at: plan.stops.length ? plan.stops[0].at - 30 : 0, speed: 0, dwell: 0, stopIdx: -1, x: 0, z: 0, ry: 0 };
  const pos = (s: number) => {
    s = ((s % total) + total) % total;
    let k = 0;
    while (k < pts.length - 1 && cum[k + 1] <= s) k++;
    const a = pts[k],
      b = pts[(k + 1) % pts.length];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const f = (s - cum[k]) / seg;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, Math.atan2(b[0] - a[0], b[1] - a[1])];
  };
  const tick = (dt: number) => {
    if (!total) return;
    if (st.dwell > 0) {
      st.dwell -= dt;
      st.speed = 0;
    } else {
      // the next stop ahead
      let next = -1,
        dist = 1e9;
      plan.stops.forEach((s, i) => {
        const d = (((s.at - st.at) % total) + total) % total;
        if (d > 0.5 && d < dist) {
          dist = d;
          next = i;
        }
      });
      const want = dist < 30 ? Math.max(1.5, dist * 0.45) : 11;
      st.speed += Math.max(-4 * dt, Math.min(2 * dt, want - st.speed));
      st.at += st.speed * dt;
      if (next >= 0 && dist - st.speed * dt <= 0.6) {
        st.at = plan.stops[next].at;
        st.dwell = 6;
        st.stopIdx = next;
      }
    }
    const [x, z, ry] = pos(st.at);
    st.x = x;
    st.z = z;
    let dr = ry - st.ry;
    dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    st.ry += dr * Math.min(1, dt * 4);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = st.ry;
  };
  return {
    mesh,
    tick,
    state: st,
    dispose: () => {
      mesh.geometry.dispose();
      mat.dispose();
    },
  };
}

export type { Lane };

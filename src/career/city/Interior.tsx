"use client";
/* eslint-disable react-hooks/immutability -- three.js objects built in useMemo are moved every frame in useFrame, which is how React Three Fiber works */
/**
 * The places you walk into. Your own footballer walks them: click the floor (he finds his way round the
 * shelves) or use WASD or the arrow keys. In the shops the things for sale are the things themselves: walk up
 * to a jacket on a rail and it lights up, and the card at the bottom of the screen (ShopHud) shows it. Places to
 * use (a door, a bed, the dance floor) have a ring on the floor. Walls between the camera and you drop down.
 *
 * Takes a WorldPlace (the new city) or one of the old place ids (the old city, until it switches over).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { makeBody, type Outfit } from "../body";
import type { CareerState, WorldPlace, Look } from "../types";
import type { PlaceId } from "./CityScene";
import { lightCone, cone } from "./kit3d";
import { isRect, type Hotspot, type Room } from "./interiors/common";
import { buildLegacyRoom } from "./interiors/legacy";
import { buildPlace, roomKey } from "./interiors";
import { weddingMarks } from "./interiors/wedding";

const GOWN: Outfit = { shirt: "#fbf8f2", trim: "#fbf8f2", shorts: "#fbf8f2", socks: "#fbf8f2", bottom: "gown", top: "vest", plain: true, shoe: ["#fbf8f2", "#d9d4cc"] };

export type { Hotspot } from "./interiors/common";
export { resolvePlace, garagePlace, garageIds, homeOwned } from "./interiors";
export interface WalkCtl {
  yaw: number;
  /** the camera's height angle on top of the room's own (the mouse or a glide moves it) */
  pitch?: number;
  zoom: number;
  use: number;
}
/** the mouse or a glide turns the camera in a room (dx right, dy down, in pixels) */
export function lookRoom(c: WalkCtl, dx: number, dy: number) {
  c.yaw -= dx * 0.0042;
  c.pitch = Math.min(0.75, Math.max(-0.45, (c.pitch || 0) + dy * 0.003));
}
export function zoomRoom(c: WalkCtl, f: number) {
  c.zoom = Math.min(1.7, Math.max(0.55, c.zoom * f));
}

// ---------- finding the way round the shelves: a coarse grid and A* ----------
const CELL0 = 0.4;
function makeGrid(room: Room) {
  const CELL = room.cell || CELL0;
  const nx = Math.ceil(room.w / CELL),
    nz = Math.ceil(room.d / CELL);
  const block = new Uint8Array(nx * nz);
  const pad = 0.34;
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const x = -room.w / 2 + (i + 0.5) * CELL,
        z = -room.d / 2 + (j + 0.5) * CELL;
      for (const o of room.obstacles) {
        if (isRect(o) ? Math.abs(x - o.x) < o.hw + pad && Math.abs(z - o.z) < o.hd + pad : Math.hypot(x - o.x, z - o.z) < o.r + pad) {
          block[i + j * nx] = 1;
          break;
        }
      }
    }
  return { nx, nz, block, cell: CELL };
}
function findPath(g: ReturnType<typeof makeGrid>, room: Room, fx: number, fz: number, tx: number, tz: number): { x: number; z: number }[] | null {
  const { nx, nz, block, cell: CELL } = g;
  const cell = (x: number, z: number) => [THREE.MathUtils.clamp(Math.floor((x + room.w / 2) / CELL), 0, nx - 1), THREE.MathUtils.clamp(Math.floor((z + room.d / 2) / CELL), 0, nz - 1)];
  const [si, sj] = cell(fx, fz);
  let [ti, tj] = cell(tx, tz);
  // a blocked goal (the shelf he clicked): the nearest open cell
  if (block[ti + tj * nx]) {
    let best = -1,
      bd = 1e9;
    for (let r = 1; r < 8 && best < 0; r++)
      for (let a = -r; a <= r; a++)
        for (const [ci, cj] of [
          [ti + a, tj - r],
          [ti + a, tj + r],
          [ti - r, tj + a],
          [ti + r, tj + a],
        ]) {
          if (ci < 0 || cj < 0 || ci >= nx || cj >= nz || block[ci + cj * nx]) continue;
          const dd = Math.hypot(ci - si, cj - sj) * 0.01 + Math.hypot(ci - ti, cj - tj);
          if (dd < bd) {
            bd = dd;
            best = ci + cj * nx;
          }
        }
    if (best < 0) return null;
    ti = best % nx;
    tj = Math.floor(best / nx);
  }
  const N = nx * nz,
    goal = ti + tj * nx,
    start = si + sj * nx;
  const gs = new Float32Array(N).fill(1e9),
    from = new Int32Array(N).fill(-1),
    done = new Uint8Array(N);
  gs[start] = 0;
  const open: number[] = [start];
  const h = (c: number) => Math.hypot((c % nx) - ti, Math.floor(c / nx) - tj);
  let steps = 0;
  while (open.length && steps++ < 6000) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (gs[open[k]] + h(open[k]) < gs[open[bi]] + h(open[bi])) bi = k;
    const c = open.splice(bi, 1)[0];
    if (c === goal) break;
    done[c] = 1;
    const ci = c % nx,
      cj = Math.floor(c / nx);
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue;
        const ni = ci + di,
          nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue;
        const n = ni + nj * nx;
        if (done[n] || (block[n] && n !== start)) continue;
        if (di && dj && (block[ci + di + cj * nx] || block[ci + (cj + dj) * nx])) continue;
        const ng = gs[c] + (di && dj ? 1.414 : 1);
        if (ng < gs[n]) {
          gs[n] = ng;
          from[n] = c;
          if (!open.includes(n)) open.push(n);
        }
      }
  }
  if (from[goal] < 0 && goal !== start) return null;
  const cells: number[] = [];
  for (let c = goal; c >= 0 && c !== start; c = from[c]) cells.push(c);
  cells.reverse();
  const pts = cells.map((c) => ({ x: -room.w / 2 + ((c % nx) + 0.5) * CELL, z: -room.d / 2 + (Math.floor(c / nx) + 0.5) * CELL }));
  // pull the string: skip corners he can see past
  const clear = (ax: number, az: number, bx: number, bz: number) => {
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / (CELL * 0.5));
    for (let k = 1; k < n; k++) {
      const [ci, cj] = cell(ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n);
      if (block[ci + cj * nx]) return false;
    }
    return true;
  };
  const out: { x: number; z: number }[] = [];
  let ax = fx,
    az = fz;
  for (let k = 0; k < pts.length; k++) {
    const nxt = pts[k + 1];
    if (nxt && clear(ax, az, nxt.x, nxt.z)) continue;
    out.push(pts[k]);
    ax = pts[k].x;
    az = pts[k].z;
  }
  return out;
}

/** the little name over the thing he is near: a canvas drawn when it changes */
function labelTexture(text: string, accent: string) {
  const cv = document.createElement("canvas");
  const x = cv.getContext("2d")!;
  const font = "600 30px Inter, 'Helvetica Neue', system-ui, sans-serif";
  x.font = font;
  const tw = Math.min(560, x.measureText(text).width);
  cv.width = Math.ceil(tw + 56);
  cv.height = 56;
  x.font = font;
  x.fillStyle = "rgba(6,8,11,0.86)";
  x.beginPath();
  x.roundRect(2, 2, cv.width - 4, cv.height - 4, 26);
  x.fill();
  x.strokeStyle = accent;
  x.lineWidth = 3;
  x.stroke();
  x.fillStyle = "#f2f4ee";
  x.textBaseline = "middle";
  x.fillText(text, 28, cv.height / 2 + 1, 560);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return { t, aspect: cv.width / cv.height };
}

const standing = new Map<string, { x: number; z: number; heading: number }>();

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
  /** a place in the new city, or an old place id */
  place: WorldPlace | PlaceId;
  state: CareerState;
  quality: number;
  night: number;
  outfit: Outfit;
  ctl: React.MutableRefObject<WalkCtl>;
  labelEls: React.MutableRefObject<Map<string, HTMLElement>>;
  onNear: (id: string | null) => void;
  /** old places: E or arriving at a ring. New places: only arriving at something he clicked (ShopHud owns E) */
  onUse: (id: string) => void;
  onHotspots: (h: Hotspot[]) => void;
}) {
  const legacy = typeof place === "string";
  const wp = legacy ? null : place;
  const legacyKey = place === "home" ? state.life.home.id + "|" + (state.life.car?.id || "") + "|" + state.trophies.length + "|" + state.life.items.filter((i) => i.owned).length : "";
  const key = wp ? roomKey(wp, state) : String(place) + "|" + legacyKey;
  const dark = night > 0.5;
  const qBand = quality <= 0 ? 0 : quality === 1 ? 1 : 2;
  const room = useMemo(
    () => (wp ? buildPlace(wp, state, dark ? 1 : 0, qBand) : buildLegacyRoom(place as PlaceId, state, dark ? 1 : 0)),
    // rebuilt when the place changes or what it shows does, never when he only buys something
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, dark, qBand],
  );
  useEffect(() => () => room.dispose(), [room]);
  useEffect(() => onHotspots(room.hotspots), [room, onHotspots]);
  const grid = useMemo(() => makeGrid(room), [room]);
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
  // the people here this week: light bodies on their spots, standing or sitting, and they turn to him when he
  // comes to talk
  const crowd = useMemo(
    () =>
      (room.people || []).map((p, i) => {
        const b = makeBody(p.look as Partial<Look>, { height: p.h, weight: p.w, pos: "CM" }, p.outfit as Outfit, Math.min(1, quality), undefined, { lite: true, seed: i + 1 });
        b.root.position.set(p.x, p.sit ? p.seat || 0.46 : 0, p.z);
        b.root.rotation.y = p.ry;
        if (p.sit) b.sit(true);
        return { b, p, id: "talk:" + p.id };
      }),
    [room, quality],
  );
  useEffect(() => () => crowd.forEach((c) => c.b.dispose()), [crowd]);
  // ---------- a date here: she waits at the table (or by him), and he sits down across from her ----------
  const dp = state.social?.dating?.plan || null;
  const herHere = !!dp && !!wp && dp.place === wp.id && (dp.status === "on" || dp.status === "together" || (dp.status === "set" && !dp.pickup));
  const herKey = herHere ? dp!.who.id + "|" + dp!.venue : "";
  const her = useMemo(
    () => {
      if (!herHere || !dp) return null;
      const w = dp.who;
      return makeBody(w.look as Partial<Look>, { height: w.h, weight: w.w, pos: "CM" }, (dp.venue === "club" || dp.venue === "restaurant" ? w.night : w.outfit) as Outfit, Math.min(1, quality), undefined, { seed: 4 });
    },
    // rebuilt only for a different date
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [herKey, quality],
  );
  useEffect(() => () => her?.dispose(), [her]);
  const seats = room.dateSeats || null;
  // ---------- the wedding: she walks down the aisle to him at the arch ----------
  const isWedding = wp?.kind === "wedding";
  const wsc = state.social?.dating?.wscene || null;
  const bridePt = state.social?.dating?.partner || null;
  const marks = useMemo(() => (isWedding ? weddingMarks(room) : null), [room, isWedding]);
  const bride = useMemo(
    () => (isWedding && bridePt ? makeBody(bridePt.look as Partial<Look>, { height: bridePt.h, weight: bridePt.w, pos: "CM" }, GOWN, Math.min(1, quality), undefined, { seed: 6 }) : null),
    // rebuilt only for a different bride
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isWedding, bridePt?.id, quality],
  );
  useEffect(() => () => bride?.dispose(), [bride]);
  const aisle = useRef({ t0: -1, z: 0, arrived: false });
  const petals = useMemo(() => {
    if (!isWedding) return null;
    const n = 160;
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.07, 0.05), new THREE.MeshBasicMaterial({ color: "#ffffff", side: THREE.DoubleSide, toneMapped: false }), n);
    const cols = ["#f2b6c4", "#ffffff", "#e88aa0", "#fff2d8"];
    const seeds = Array.from({ length: n }, (_, i) => ({ x: (Math.sin(i * 12.9898) * 0.5) * 6, z: (Math.sin(i * 78.233) * 0.5) * 6, y: 3 + (i % 17) * 0.25, sp: 0.5 + (i % 7) * 0.08, ph: i * 1.7 }));
    for (let i = 0; i < n; i++) im.setColorAt(i, new THREE.Color(cols[i % 4]));
    im.visible = false;
    im.frustumCulled = false;
    return { im, seeds, t0: -1 };
  }, [isWedding]);
  useEffect(
    () => () => {
      if (!petals) return;
      petals.im.geometry.dispose();
      (petals.im.material as THREE.Material).dispose();
    },
    [petals],
  );
  const sceneOn = herHere && dp!.status === "on";
  const herSpot = useRef<{ x: number; z: number; ry: number } | null>(null);
  const sat = useRef(false);
  const herSat = useRef<unknown>(null);
  // where he was in this place: a rebuild of the same place (what it sells changed, the quality changed)
  // keeps him where he stood; walking in fresh starts him at the door
  const placeId = wp ? wp.id : String(place);
  useEffect(() => () => void standing.delete(placeId), [placeId]);
  const me = useMemo(() => {
    const keep = standing.get(placeId) || null;
    return {
      x: keep ? keep.x : room.spawn[0],
      z: keep ? keep.z : room.spawn[1],
      heading: keep ? keep.heading : Math.PI,
      target: null as null | { x: number; z: number; use?: string },
      path: [] as { x: number; z: number }[],
      near: null as string | null,
      fresh: true,
      stuck: 0,
    };
    // a new walker for each room; placeId is read for the kept spot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);
  const keys = useRef(new Set<string>());
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(k)) {
        keys.current.add(k);
        me.target = null;
        me.path = [];
        if (k.startsWith("arrow")) e.preventDefault();
      }
      if (legacy && k === "e" && me.near) onUse(me.near);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [me, onUse, legacy]);
  const accent = room.accent || state.life.style.accent;
  // the highlight on the thing he is near: a soft beam from above, a little marker and its name
  const hi = useMemo(() => {
    const beamM = (lightCone(accent, 0.3) as THREE.ShaderMaterial).clone();
    const beam = new THREE.Mesh(cone(0.36, 1.6), beamM);
    beam.visible = false;
    beam.renderOrder = 6;
    const markM = new THREE.MeshBasicMaterial({ color: new THREE.Color(accent).multiplyScalar(1.6), toneMapped: false });
    const mark = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), markM);
    mark.visible = false;
    const tagM = new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
    const tag = new THREE.Sprite(tagM);
    tag.visible = false;
    tag.renderOrder = 10;
    const g = new THREE.Group();
    g.add(beam, mark, tag);
    return { g, beam, beamM, mark, markM, tag, tagM, tex: null as THREE.Texture | null, inst: null as Hotspot["inst"] | null };
  }, [accent]);
  useEffect(
    () => () => {
      hi.beamM.dispose();
      hi.markM.dispose();
      hi.mark.geometry.dispose();
      hi.tex?.dispose();
      hi.tagM.dispose();
    },
    [hi],
  );
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const ringRefs = useRef<THREE.Mesh[]>([]);
  const lightT = useMemo(() => new THREE.Color(), []);
  const walkTo = (x: number, z: number, use?: string) => {
    const p = findPath(grid, room, me.x, me.z, x, z);
    me.path = p && p.length ? p : [{ x, z }];
    me.target = { x, z, use };
    me.stuck = 0;
  };
  const setNearInst = (inst: Hotspot["inst"] | null) => {
    const prev = hi.inst;
    if (prev && prev.mesh.instanceColor) {
      const cols = prev.mesh.userData.cols as THREE.Color[] | undefined;
      if (cols) prev.mesh.setColorAt(prev.i, cols[prev.i]);
      prev.mesh.instanceColor!.needsUpdate = true;
    }
    hi.inst = inst || null;
    if (inst && inst.mesh.instanceColor) {
      const cols = inst.mesh.userData.cols as THREE.Color[] | undefined;
      if (cols) inst.mesh.setColorAt(inst.i, lightT.copy(cols[inst.i]).lerp(new THREE.Color("#ffffff"), 0.22).multiplyScalar(1.35));
      inst.mesh.instanceColor.needsUpdate = true;
    }
  };
  useFrame(({ camera, clock, size }, dt0) => {
    const dt = Math.min(dt0, 0.05);
    const c = ctl.current;
    const t = clock.elapsedTime;
    // a request from the screen to walk to a spot and use it
    if (c.use >= 0 && room.hotspots[c.use]) {
      const h = room.hotspots[c.use];
      walkTo(h.x, h.z, h.id);
      c.use = -1;
    }
    // the wedding: he waits at the arch; when the music starts she walks down the aisle to him
    if (isWedding && marks) {
      const walking = !!wsc && wsc.step >= 1;
      const a = aisle.current;
      if (walking && a.t0 < 0) a.t0 = t;
      const prog = a.t0 < 0 ? 0 : Math.min(1, (t - a.t0) / 11);
      a.arrived = prog >= 1;
      me.x = marks.him.x;
      me.z = marks.him.z;
      me.heading = a.arrived ? -Math.PI / 2 : 0;
      me.target = null;
      me.path = [];
      if (bride) {
        const bz = marks.start.z + (marks.her.z - marks.start.z) * prog;
        const bx = prog < 0.85 ? 0 : marks.her.x * ((prog - 0.85) / 0.15);
        a.z = bz;
        bride.root.position.set(bx, 0, bz);
        const want = a.arrived ? Math.PI / 2 : Math.PI;
        bride.root.rotation.y += Math.atan2(Math.sin(want - bride.root.rotation.y), Math.cos(want - bride.root.rotation.y)) * Math.min(1, dt * 4);
        bride.tick(dt, bride.root.rotation.y, walking && !a.arrived ? 0.75 : 0);
      }
    }
    if (petals && marks) {
      if (wsc?.result && petals.t0 < 0) petals.t0 = t;
      petals.im.visible = petals.t0 >= 0 && t - petals.t0 < 14;
      if (petals.im.visible) {
        const m4 = new THREE.Matrix4(),
          q = new THREE.Quaternion(),
          e = new THREE.Euler(),
          sc3 = new THREE.Vector3(1, 1, 1),
          v = new THREE.Vector3();
        const el = t - petals.t0;
        petals.seeds.forEach((p, i) => {
          const y = p.y - ((el * p.sp) % (p.y + 0.2));
          v.set(p.x + Math.sin(el * 1.3 + p.ph) * 0.4, Math.max(0.02, y), marks.him.z + p.z * 0.6);
          e.set(el * 2 + p.ph, el * 1.5 + p.ph, 0);
          q.setFromEuler(e);
          m4.compose(v, q, sc3);
          petals.im.setMatrixAt(i, m4);
        });
        petals.im.instanceMatrix.needsUpdate = true;
      }
    }
    // on a date at a table: he sits across from her until it is over
    if (sceneOn && seats) {
      if (!sat.current) {
        sat.current = true;
        rig.sit(true);
      }
      me.x = seats.him.x;
      me.z = seats.him.z;
      me.heading = seats.him.ry;
      me.target = null;
      me.path = [];
      rig.root.position.set(me.x, seats.him.seat || 0.46, me.z);
      rig.root.rotation.y = seats.him.ry;
      rig.tick(dt, seats.him.ry, 0);
    } else if (sat.current) {
      // up from the chair, a step to the side
      sat.current = false;
      rig.sit(false);
      me.x = seats ? seats.him.x + Math.cos(seats.him.ry) * 0.7 : me.x;
      me.z = seats ? seats.him.z - Math.sin(seats.him.ry) * 0.7 : me.z;
    }
    if (her) {
      if (seats) {
        her.root.position.set(seats.her.x, seats.her.seat || 0.46, seats.her.z);
        her.root.rotation.y = seats.her.ry;
        if (herSat.current !== her) {
          her.sit(true);
          herSat.current = her;
        }
      } else {
        // no table: she stands with him, facing him
        if (!herSpot.current) herSpot.current = { x: me.x + Math.sin(me.heading) * 1.3, z: me.z + Math.cos(me.heading) * 1.3, ry: me.heading + Math.PI };
        const hs = herSpot.current;
        her.root.position.set(hs.x, 0, hs.z);
        her.root.rotation.y = Math.atan2(me.x - hs.x, me.z - hs.z);
      }
      her.tick(dt, her.root.rotation.y, 0);
    }
    // movement: keys move relative to the camera, a click walks the path there
    const K = keys.current;
    const pinned = (sceneOn && !!seats) || (isWedding && !!marks);
    let mx = pinned ? 0 : (K.has("d") || K.has("arrowright") ? 1 : 0) - (K.has("a") || K.has("arrowleft") ? 1 : 0);
    let mz = pinned ? 0 : (K.has("s") || K.has("arrowdown") ? 1 : 0) - (K.has("w") || K.has("arrowup") ? 1 : 0);
    let speed = 0;
    if (mx || mz) {
      const cy = Math.cos(c.yaw),
        sy = Math.sin(c.yaw);
      const vx = mx * cy + mz * sy,
        vz = -mx * sy + mz * cy;
      const l = Math.hypot(vx, vz) || 1;
      mx = vx / l;
      mz = vz / l;
      // out on big grounds he walks and runs at street pace
      speed = room.outdoor ? (K.has("shift") ? 6.2 : 3.0) : K.has("shift") ? 4.4 : 2.4;
    } else if (me.target) {
      const wpnt = me.path[0] || me.target;
      const dx = wpnt.x - me.x,
        dz = wpnt.z - me.z;
      const l = Math.hypot(dx, dz);
      const final = me.path.length <= 1;
      if (!final && l < 0.3) me.path.shift();
      else if (final && (l < 0.3 || (me.target.use && Math.hypot(me.target.x - me.x, me.target.z - me.z) < 0.6))) {
        if (me.target.use) onUse(me.target.use);
        me.target = null;
        me.path = [];
      } else {
        mx = dx / l;
        mz = dz / l;
        // a long way across the grounds: a jog
        const cruise = room.outdoor && Math.hypot(me.target.x - me.x, me.target.z - me.z) > 8 ? 4.8 : 2.6;
        speed = final ? Math.min(cruise, 0.8 + l * 1.4) : cruise;
      }
    }
    const ox = me.x,
      oz = me.z;
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
      if (isRect(o)) {
        const px = o.hw + 0.3 - Math.abs(dx),
          pz = o.hd + 0.3 - Math.abs(dz);
        if (px > 0 && pz > 0) {
          if (px < pz) me.x += (dx < 0 ? -1 : 1) * px;
          else me.z += (dz < 0 ? -1 : 1) * pz;
        }
      } else {
        const l = Math.hypot(dx, dz),
          need = o.r + 0.3;
        if (l < need && l > 1e-4) {
          me.x = o.x + (dx / l) * need;
          me.z = o.z + (dz / l) * need;
        }
      }
    }
    // a walk that gets nowhere gives up
    if (me.target && speed > 0) {
      const moved = Math.hypot(me.x - ox, me.z - oz);
      me.stuck = moved < speed * dt * 0.2 ? me.stuck + dt : 0;
      if (me.stuck > 0.6) {
        me.target = null;
        me.path = [];
      }
    }
    if (!pinned) {
      rig.root.position.set(me.x, 0, me.z);
      rig.tick(dt, me.heading, speed);
    } else if (isWedding) {
      rig.root.position.set(me.x, 0, me.z);
      rig.root.rotation.y += Math.atan2(Math.sin(me.heading - rig.root.rotation.y), Math.cos(me.heading - rig.root.rotation.y)) * Math.min(1, dt * 4);
      rig.tick(dt, rig.root.rotation.y, 0);
    }
    for (const c of crowd) {
      // the one he is talking to (or standing right by) turns to him; sitters only turn a little
      const close = me.near === c.id || Math.hypot(me.x - c.p.x, me.z - c.p.z) < 1.6;
      let to = c.p.ry;
      if (close) {
        const want = Math.atan2(me.x - c.p.x, me.z - c.p.z);
        let d = want - c.p.ry;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        to = c.p.ry + (c.p.sit ? Math.max(-0.7, Math.min(0.7, d)) : d);
      }
      let cur = c.b.root.rotation.y;
      cur += Math.atan2(Math.sin(to - cur), Math.cos(to - cur)) * Math.min(1, dt * 4);
      c.b.root.rotation.y = cur;
      c.b.tick(dt, cur, 0);
    }
    standing.set(placeId, { x: me.x, z: me.z, heading: me.heading });
    // the nearest thing to use; items he faces win over items behind him
    let near: Hotspot | null = null;
    let best = 1e9;
    const fx = Math.sin(me.heading),
      fz = Math.cos(me.heading);
    for (const h of room.hotspots) {
      const l = Math.hypot(h.x - me.x, h.z - me.z);
      if (l >= (h.r || 1.25)) continue;
      let score = l;
      if (!h.tag && h.ax !== undefined && h.az !== undefined) {
        const ax = h.ax - me.x,
          az = h.az - me.z;
        const al = Math.hypot(ax, az) || 1;
        score += 0.45 * (1 - (ax * fx + az * fz) / al);
      }
      if (score < best) {
        best = score;
        near = h;
      }
    }
    const nearId = near ? (near as Hotspot).id : null;
    if (nearId !== me.near) {
      me.near = nearId;
      onNear(nearId);
      const n = near as Hotspot | null;
      setNearInst(n?.inst || null);
      hi.tex?.dispose();
      hi.tex = null;
      if (n && !n.tag) {
        const { t: tx, aspect } = labelTexture(n.label, accent);
        hi.tex = tx;
        hi.tagM.map = tx;
        hi.tagM.needsUpdate = true;
        hi.tag.scale.set(0.34 * aspect, 0.34, 1);
      }
    }
    // the highlight
    const n = near as Hotspot | null;
    const showHi = !!n && !n.tag;
    hi.beam.visible = hi.mark.visible = hi.tag.visible = showHi;
    if (n && showHi) {
      const ax = n.ax ?? n.x,
        az = n.az ?? n.z,
        y = n.y ?? 1.2;
      hi.beam.position.set(ax, y + 0.55, az);
      hi.beamM.uniforms.uStrength.value = 0.26 + Math.sin(t * 4) * 0.06;
      hi.mark.position.set(ax, y + 0.62 + Math.sin(t * 3) * 0.05, az);
      hi.mark.rotation.y = t * 1.6;
      hi.tag.position.set(ax, y + 0.92, az);
    }
    // the rings on the floor for places to use
    room.hotspots.forEach((h, k) => {
      const r = ringRefs.current[k];
      if (!r) return;
      const on = nearId === h.id;
      (r.material as THREE.MeshBasicMaterial).opacity = on ? 0.95 : 0.45 + Math.sin(t * 3 + k) * 0.15;
      r.scale.setScalar(on ? 1.15 : 1);
    });
    // the camera: behind and above, turned by the mouse or a glide, further out of doors
    const dist0 = room.cam?.dist ?? (room.outdoor ? 9.5 : 6.4),
      camH0 = room.cam?.height ?? (room.outdoor ? 6.2 : 5.0);
    const reach = Math.hypot(dist0, camH0) * c.zoom;
    const elev = THREE.MathUtils.clamp(Math.atan2(camH0, dist0) + (c.pitch || 0), 0.1, 1.35);
    const dist = Math.cos(elev) * reach,
      camH = Math.sin(elev) * reach;
    tmp.set(me.x + Math.sin(c.yaw) * dist, camH, me.z + Math.cos(c.yaw) * dist);
    // the wedding's camera: down the aisle to her, with her as she walks, then the two of them at the arch
    if (isWedding && marks) {
      const a = aisle.current;
      if (a.t0 < 0) {
        tmp.set(-0.9, 2.6, marks.archZ + 0.4);
        look.set(0, 1.0, marks.start.z);
      } else if (!a.arrived) {
        // in the aisle ahead of her, backing away as she comes
        tmp.set(0.3, 1.95, a.z - 3.3);
        look.set(0, 1.3, a.z);
      } else {
        tmp.set(0.2, 1.7, marks.him.z + 3.6);
        look.set(0, 1.45, marks.him.z - 0.2);
      }
    }
    // at the table on a date: close, low, over his shoulder, on her
    if (pinned && seats) {
      const yaw = seats.him.ry + Math.PI + 0.42;
      const el = 0.3,
        rr = 3.1 * Math.min(1.4, Math.max(0.8, c.zoom));
      tmp.set(seats.him.x + Math.sin(yaw) * Math.cos(el) * rr, (seats.him.seat || 0.46) + 0.7 + Math.sin(el) * rr, seats.him.z + Math.cos(yaw) * Math.cos(el) * rr);
    }
    // the first frame in a room puts the camera straight behind him, after that it follows smoothly
    if (me.fresh) {
      camera.position.copy(tmp);
      me.fresh = false;
    } else camera.position.lerp(tmp, Math.min(1, dt * (pinned ? 2.5 : 5)));
    // look a little ahead of him, so the room in front fills the picture
    if (pinned && seats) look.set(seats.her.x * 0.7 + seats.him.x * 0.3, (seats.her.seat || 0.46) + 0.55, seats.her.z * 0.7 + seats.him.z * 0.3);
    else if (!(isWedding && marks)) look.set(me.x - Math.sin(c.yaw) * 1.6, 0.8, me.z - Math.cos(c.yaw) * 1.6);
    camera.lookAt(look);
    // walls between the camera and him drop down; outer walls whenever the camera is behind them
    const cx = camera.position.x,
      cz = camera.position.z;
    for (const wl of room.walls) {
      const sc = (cx - wl.cx) * wl.nx + (cz - wl.cz) * wl.nz;
      let drop = sc < 0;
      if (wl.inner) {
        const sm = (me.x - wl.cx) * wl.nx + (me.z - wl.cz) * wl.nz;
        drop = false;
        if (sc < 0 !== sm < 0) {
          // where the line from the camera to him crosses the wall, measured along it
          const f = sc / (sc - sm);
          const ix = cx + (me.x - cx) * f,
            iz = cz + (me.z - cz) * f;
          const along = Math.abs((ix - wl.cx) * -wl.nz + (iz - wl.cz) * wl.nx);
          drop = along < (wl.half ?? 99) + 1.5;
        }
      }
      const target = drop ? 0.06 : 1;
      wl.mesh.scale.y += (target - wl.mesh.scale.y) * Math.min(1, dt * 8);
      wl.mesh.visible = wl.mesh.scale.y > 0.07;
    }
    // the room's own motion: turntables, the club's lights, screens
    room.tick?.(t, dt);
    // the old turntable in the showroom
    if (legacy) {
      const tt = room.group.getObjectByName("turntable");
      if (tt) tt.rotation.y += dt * 0.35;
    }
    // labels over the things to use (only those the screen made an element for). The names of things for sale fade
    // out with distance, so a big room (the mall's hall) does not fill up with them; places to use always show.
    if (labelEls.current.size)
      for (const h of room.hotspots) {
        const el = labelEls.current.get("hs:" + h.id);
        if (!el) continue;
        tmp.set(h.x, 1.9, h.z).project(camera);
        el.style.transform = `translate(${((tmp.x + 1) / 2) * size.width}px, ${((1 - tmp.y) / 2) * size.height}px) translate(-50%, -100%)`;
        const far = Math.hypot(h.x - me.x, h.z - me.z);
        // places to use read from across a ground; people's names only once he is near them, like items
        const person = h.id.startsWith("talk:");
        const seen = tmp.z > 1 ? 0 : person ? Math.min(1, Math.max(0, (7 - far) / 2)) : h.tag ? Math.min(1, Math.max(0, (40 - far) / 8)) : Math.min(1, Math.max(0, (9 - far) / 2));
        el.style.opacity = String(seen);
        el.style.pointerEvents = seen < 0.3 ? "none" : "";
      }
  });
  const rings = useMemo(() => room.hotspots.map((h) => (legacy || (h.tag && !h.id.startsWith("talk:")) ? h : null)), [room, legacy]);
  const ringMat = useMemo(() => room.hotspots.map(() => new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false })), [room, accent]);
  useEffect(() => () => ringMat.forEach((m) => m.dispose()), [ringMat]);
  const L = room.light;
  const lights = room.mood;
  const shadows = quality >= 2;
  const click = (e: ThreeEvent<MouseEvent>) => {
    // with the mouse captured for looking round, a click has no point on the floor: WASD and E do the work
    if (e.delta > 6 || document.pointerLockElement) return;
    e.stopPropagation();
    // a thing for sale: walk to where he stands to look at it
    const o = e.object as THREE.Mesh;
    const ids = o.userData?.hsIds as (string | null)[] | undefined;
    const id = ids && e.instanceId !== undefined ? ids[e.instanceId] : null;
    const h = id ? room.hotspots.find((x) => x.id === id) : null;
    if (h) walkTo(h.x, h.z, h.id);
    else walkTo(e.point.x, e.point.z);
  };
  const p1 = L?.points[0],
    p2 = L?.points[1];
  return (
    <>
      <color attach="background" args={[L ? L.bg : lights === "stadium" || lights === "night" ? "#05070b" : "#0c0d0f"]} />
      {(L?.fog || room.outdoor) && <fog attach="fog" args={L?.fog || ["#05070b", 18, 60]} />}
      <hemisphereLight args={L ? [L.sky, L.ground, L.hemi] : [lights === "cool" ? "#cfe0ff" : "#ffe6c8", "#1a1612", lights === "stadium" ? 0.7 : 0.55]} />
      <directionalLight
        position={room.outdoor ? [room.w * 0.3, Math.max(9, Math.max(room.w, room.d) * 0.6), room.d * 0.4] : [room.w * 0.25, 9, room.d * 0.35]}
        intensity={L ? L.keyI : lights === "stadium" ? 2.2 : 1.1}
        color={L ? L.key : lights === "warm" ? "#ffe2bc" : "#eef4ff"}
        castShadow={shadows}
        shadow-mapSize={[quality >= 3 ? 2048 : 1024, quality >= 3 ? 2048 : 1024]}
        shadow-camera-left={-room.w / 2 - 1}
        shadow-camera-right={room.w / 2 + 1}
        shadow-camera-top={room.d / 2 + 1}
        shadow-camera-bottom={-room.d / 2 - 1}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
      />
      {/* always two point lights (some may be off), so walking between rooms never recompiles every shader */}
      {L ? (
        <>
          <pointLight position={p1 ? [p1.x, p1.y, p1.z] : [0, 3, 0]} intensity={p1 ? p1.i : 0} distance={p1 ? p1.dist : 1} decay={1.6} color={p1 ? p1.col : "#ffffff"} />
          <pointLight position={p2 ? [p2.x, p2.y, p2.z] : [0, 3, 0]} intensity={p2 ? p2.i : 0} distance={p2 ? p2.dist : 1} decay={1.6} color={p2 ? p2.col : "#ffffff"} />
        </>
      ) : (
        <>
          <pointLight position={[0, 2.6, 0]} intensity={room.outdoor ? 0 : lights === "warm" ? 8 : 6} distance={room.w * 1.4} decay={1.6} color={lights === "warm" ? "#ffcf96" : "#e8f0ff"} />
          <pointLight position={[-4, 3, -2]} intensity={lights === "night" ? 10 : 0} distance={14} decay={1.6} color="#ffd9a8" />
        </>
      )}
      <primitive object={room.group} onClick={click} />
      <primitive object={rig.root} />
      {crowd.map((c) => (
        <primitive key={c.id} object={c.b.root} />
      ))}
      {her && <primitive object={her.root} />}
      {bride && <primitive object={bride.root} />}
      {petals && <primitive object={petals.im} />}
      <primitive object={hi.g} />
      <mesh rotation-x={-Math.PI / 2} position-y={0.005} onClick={click}>
        <planeGeometry args={[room.w, room.d]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {room.hotspots.map((h, k) =>
        rings[k] ? (
          <mesh
            key={h.id}
            ref={(m: THREE.Mesh | null) => {
              if (m) ringRefs.current[k] = m;
              else delete ringRefs.current[k];
            }}
            rotation-x={-Math.PI / 2}
            position={[h.x, 0.02, h.z]}
            material={ringMat[k]}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              if (e.delta > 6 || document.pointerLockElement) return;
              e.stopPropagation();
              walkTo(h.x, h.z, h.id);
            }}
          >
            <ringGeometry args={[0.42, 0.52, 40]} />
          </mesh>
        ) : null,
      )}
    </>
  );
}

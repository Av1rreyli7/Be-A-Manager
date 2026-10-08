/**
 * The people on the pavements. One instanced mesh for all of them: a low poly person whose legs and arms swing
 * in the vertex shader, dressed per person with instance colours, so a busy street is one draw call. They walk
 * round the blocks near him, wait at bus stops and shop doors, step out of his way, and stop to talk when he
 * walks up to one. The ones far away are moved to blocks near him, so the street never empties.
 */
import * as THREE from "three";
import type { CityPlan } from "./gen";
import { rng } from "./gen";

// parts: 0 skin, 1 top, 2 bottom, 3 shoes, 4 hair; limbs: 0 none, 1 left leg, 2 right leg, 3 left arm, 4 right arm
function personGeometry() {
  const pos: number[] = [];
  const nor: number[] = [];
  const part: number[] = [];
  const limb: number[] = [];
  const pivot: number[] = [];
  const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, sx: number, sy: number, sz: number, p: number, l: number, pv: number) => {
    const ng = g.toNonIndexed();
    ng.scale(sx, sy, sz);
    ng.translate(x, y, z);
    const P = ng.getAttribute("position"),
      N = ng.getAttribute("normal");
    for (let i = 0; i < P.count; i++) {
      pos.push(P.getX(i), P.getY(i), P.getZ(i));
      nor.push(N.getX(i), N.getY(i), N.getZ(i));
      part.push(p);
      limb.push(l);
      pivot.push(pv);
    }
    ng.dispose();
  };
  const box = new THREE.BoxGeometry(1, 1, 1);
  const head = new THREE.IcosahedronGeometry(0.5, 1);
  // legs hang from the hips at 0.92 m, arms from the shoulders at 1.42 m
  add(box, -0.1, 0.5, 0, 0.13, 0.84, 0.15, 2, 1, 0.92);
  add(box, 0.1, 0.5, 0, 0.13, 0.84, 0.15, 2, 2, 0.92);
  add(box, -0.1, 0.06, 0.04, 0.14, 0.1, 0.26, 3, 1, 0.92);
  add(box, 0.1, 0.06, 0.04, 0.14, 0.1, 0.26, 3, 2, 0.92);
  add(box, 0, 0.98, 0, 0.36, 0.18, 0.2, 2, 0, 0);
  add(box, 0, 1.22, 0, 0.42, 0.46, 0.22, 1, 0, 0);
  add(box, -0.26, 1.13, 0, 0.1, 0.56, 0.12, 1, 3, 1.42);
  add(box, 0.26, 1.13, 0, 0.1, 0.56, 0.12, 1, 4, 1.42);
  add(box, -0.26, 0.8, 0, 0.08, 0.12, 0.09, 0, 3, 1.42);
  add(box, 0.26, 0.8, 0, 0.08, 0.12, 0.09, 0, 4, 1.42);
  add(box, 0, 1.5, 0, 0.1, 0.1, 0.1, 0, 0, 0);
  add(head, 0, 1.64, 0.01, 0.22, 0.25, 0.23, 0, 0, 0);
  add(head, 0, 1.71, -0.02, 0.235, 0.15, 0.24, 4, 0, 0);
  box.dispose();
  head.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("aPart", new THREE.Float32BufferAttribute(part, 1));
  g.setAttribute("aLimb", new THREE.Float32BufferAttribute(limb, 1));
  g.setAttribute("aPivot", new THREE.Float32BufferAttribute(pivot, 1));
  g.computeBoundingSphere();
  return g;
}

const SKIN = ["#f1c9a5", "#e0ac84", "#c68a62", "#a8714d", "#8a5a3c", "#5e3b26"];
const TOPS = ["#e9e6df", "#20242b", "#b3262e", "#2a5bd7", "#f2c14e", "#2f7d57", "#7a4cc2", "#d9d0c0", "#ff7a2a", "#4a5560", "#c9a0dc", "#0f6e7a"];
const BOTTOMS = ["#1f2a44", "#2a2d33", "#5c5047", "#c9bba0", "#3c4b5c", "#111214", "#6b6f78"];
const HAIR = ["#1a1410", "#3b2a1e", "#6b4a2b", "#b8893f", "#d9c08a", "#8c8c8c", "#2a1a12"];

export interface Ped {
  x: number;
  z: number;
  ry: number;
  /** the block he walks round, the distance along its loop, and which way */
  bi: number;
  bj: number;
  s: number;
  dir: number;
  speed: number;
  /** standing still for this many seconds (talking, waiting) */
  wait: number;
  idle: boolean;
  talk: number;
  fan: boolean;
  slot: number;
  /** a step to the side, to pass round him */
  lat: number;
  /** tall or short, broad or slim */
  h: number;
  w: number;
}

export function makePeople(plan: CityPlan, count: number, night: { value: number }) {
  const geo = personGeometry();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 });
  const uTime = { value: 0 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.uniforms.uNight = night;
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        attribute float aPart; attribute float aLimb; attribute float aPivot;
        attribute vec3 iTop; attribute vec3 iBottom; attribute vec3 iSkin; attribute vec3 iHair; attribute vec2 iAnim;
        uniform float uTime;
        mat3 rx(float a){ float c = cos(a), s = sin(a); return mat3(1.0,0.0,0.0, 0.0,c,s, 0.0,-s,c); }`,
      )
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
        float ph = uTime * iAnim.y + iAnim.x;
        float amp = clamp(iAnim.y / 7.0, 0.0, 0.62);
        float sw = sin(ph);
        float ang = 0.0;
        if (aLimb > 0.5 && aLimb < 1.5) ang = sw * amp;
        else if (aLimb > 1.5 && aLimb < 2.5) ang = -sw * amp;
        else if (aLimb > 2.5 && aLimb < 3.5) ang = -sw * amp * 0.9;
        else if (aLimb > 3.5) ang = sw * amp * 0.9;
        mat3 R = rx(ang);
        objectNormal = R * objectNormal;`,
      )
      .replace(
        "#include <begin_vertex>",
        `vec3 transformed = vec3(position);
        if (aLimb > 0.5) { transformed.y -= aPivot; transformed = R * transformed; transformed.y += aPivot; }
        transformed.y += abs(cos(ph)) * 0.035 * step(0.05, amp);`,
      )
      .replace(
        "#include <color_vertex>",
        `#include <color_vertex>
        vColor.rgb = aPart < 0.5 ? iSkin : aPart < 1.5 ? iTop : aPart < 2.5 ? iBottom : aPart < 3.5 ? vec3(0.06) : iHair;`,
      );
  };
  mat.customProgramCacheKey = () => "peds";
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  const A = (n: number) => new THREE.InstancedBufferAttribute(new Float32Array(count * n), n);
  const top = A(3),
    bottom = A(3),
    skin = A(3),
    hair = A(3),
    anim = A(2);
  geo.setAttribute("iTop", top);
  geo.setAttribute("iBottom", bottom);
  geo.setAttribute("iSkin", skin);
  geo.setAttribute("iHair", hair);
  geo.setAttribute("iAnim", anim);
  const r = rng(plan.seed + 77);
  const c = new THREE.Color();
  const setCol = (attr: THREE.InstancedBufferAttribute, k: number, hex: string) => {
    c.set(hex);
    attr.setXYZ(k, c.r, c.g, c.b);
  };
  // the loop round a block: a square on the middle of the pavement
  const inner = plan.pitch - plan.road - plan.walk * 2;
  const loopHalf = inner / 2 + plan.walk * 0.5;
  const loopLen = loopHalf * 8;
  const bx = (i: number) => -plan.half + i * plan.pitch + plan.pitch / 2;
  const at = (p: Ped) => {
    // the distance along the loop to a point on the square
    let s = ((p.s % loopLen) + loopLen) % loopLen;
    const side = Math.floor(s / (loopHalf * 2));
    s -= side * loopHalf * 2;
    const t = s - loopHalf;
    const cx = bx(p.bi),
      cz = bx(p.bj);
    if (side === 0) return [cx + t, cz - loopHalf, 0];
    if (side === 1) return [cx + loopHalf, cz + t, 1];
    if (side === 2) return [cx - t, cz + loopHalf, 2];
    return [cx - loopHalf, cz - t, 3];
  };
  const usable = (i: number, j: number) => i >= 0 && j >= 0 && i < plan.n && j < plan.n && plan.zones[i][j] !== "sea" && plan.zones[i][j] !== "river";
  const peds: Ped[] = [];
  const place = (p: Ped, cx: number, cz: number, rad: number) => {
    for (let tries = 0; tries < 12; tries++) {
      const a = r() * Math.PI * 2,
        d = 20 + r() * rad;
      const i = Math.floor((cx + Math.cos(a) * d + plan.half) / plan.pitch),
        j = Math.floor((cz + Math.sin(a) * d + plan.half) / plan.pitch);
      if (!usable(i, j)) continue;
      p.bi = i;
      p.bj = j;
      p.s = r() * loopLen;
      return;
    }
  };
  for (let k = 0; k < count; k++) {
    const p: Ped = { x: 0, z: 0, ry: 0, bi: 0, bj: 0, s: 0, dir: r() < 0.5 ? 1 : -1, speed: 1.05 + r() * 0.55, wait: 0, idle: r() < 0.14, talk: 0, fan: false, slot: k, lat: 0, h: 0.9 + r() * 0.16, w: 0.88 + r() * 0.3 };
    place(p, plan.spawn.x, plan.spawn.z, 160);
    peds.push(p);
    setCol(top, k, TOPS[Math.floor(r() * TOPS.length)]);
    setCol(bottom, k, BOTTOMS[Math.floor(r() * BOTTOMS.length)]);
    setCol(skin, k, SKIN[Math.floor(r() * SKIN.length)]);
    setCol(hair, k, HAIR[Math.floor(r() * HAIR.length)]);
    anim.setXY(k, r() * 10, 0);
  }
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const sc = new THREE.Vector3(1, 1, 1);
  const v = new THREE.Vector3();
  let near: Ped | null = null;
  // a soft dark patch on the ground under each person, cheaper than a shadow and it grounds them
  const blobTex = (() => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 64;
    const x = cv.getContext("2d")!;
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(0,0,0,0.55)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  })();
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
  const blobs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), blobMat, count);
  blobs.frustumCulled = false;
  blobs.renderOrder = 1;
  const flat = new THREE.Quaternion();
  const blobS = new THREE.Vector3(0.9, 1, 0.9);
  /** one frame: who walks where; me is where he is (and whether he is in a car) */
  const tick = (dt: number, t: number, me: { x: number; z: number; car: boolean; speed: number }, radius: number) => {
    uTime.value = t;
    near = null;
    let nearD = 2.2;
    for (const p of peds) {
      const dx = p.x - me.x,
        dz = p.z - me.z;
      const d = Math.hypot(dx, dz);
      // far away: move to a block near him, out past the edge of what he sees
      if (d > radius) {
        place(p, me.x, me.z, radius * 0.6);
        p.talk = 0;
        p.wait = 0;
      }
      let moving = !p.idle && p.wait <= 0 && p.talk <= 0;
      if (p.wait > 0) p.wait -= dt;
      if (p.talk > 0) p.talk -= dt;
      // his car right there: wait for it; him on foot: step round him
      if (moving && me.car && d < 3.2) {
        moving = false;
        p.wait = 0.6;
      }
      if (moving) {
        p.s += p.dir * p.speed * dt;
        // now and then a person stops, looks at a shop window, then walks on
        if (Math.random() < dt * 0.012) p.wait = 2 + Math.random() * 4;
      }
      const [x0, z0, side] = at(p);
      // across the path: z for the sides that run along x, x for the others
      const across = side === 0 || side === 2 ? [0, 1] : [1, 0];
      const off = (x0 - me.x) * across[0] + (z0 - me.z) * across[1];
      const want = !me.car && d < 2.2 && p.talk <= 0 ? (off >= 0 ? 1 : -1) * Math.max(0, 1.5 - Math.abs(off)) : 0;
      p.lat += (want - p.lat) * Math.min(1, dt * 5);
      const x = x0 + across[0] * p.lat,
        z = z0 + across[1] * p.lat;
      p.x = x;
      p.z = z;
      if (p.talk > 0) p.ry = Math.atan2(me.x - p.x, me.z - p.z);
      else if (moving) {
        // walking along the side of the square: side 0 runs +x, 1 runs +z, 2 runs -x, 3 runs -z
        const dirs = [Math.PI / 2, 0, -Math.PI / 2, Math.PI];
        p.ry = dirs[side] + (p.dir < 0 ? Math.PI : 0);
      }
      anim.setY(p.slot, moving ? p.speed * 5.4 : 0);
      v.set(p.x, 0.15, p.z);
      q.setFromAxisAngle(up, p.ry);
      sc.set(p.w, p.h, p.w);
      m4.compose(v, q, sc);
      mesh.setMatrixAt(p.slot, m4);
      v.y = 0.165;
      m4.compose(v, flat, blobS);
      blobs.setMatrixAt(p.slot, m4);
      if (!me.car && d < nearD) {
        nearD = d;
        near = p;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    blobs.instanceMatrix.needsUpdate = true;
    anim.needsUpdate = true;
  };
  return {
    mesh,
    blobs,
    tick,
    near: () => near,
    /** he says hello: this person stops and faces him for a few seconds */
    talkTo: (p: Ped) => {
      p.talk = 5;
    },
    dispose: () => {
      geo.dispose();
      mat.dispose();
      mesh.dispose();
      blobs.geometry.dispose();
      blobMat.dispose();
      blobTex.dispose();
    },
  };
}

/**
 * The footballer's body for the career scenes: the same procedural body the 3D match draws (the match's own
 * builder in floodlights/m3d/view/rig.mjs, so he looks the same everywhere), built at close up detail and split
 * into materials: cloth with a soft sheen, skin with a warm sheen, hair, glossy boots and eyes, metal for
 * jewellery. Plus a gentle idle so he breathes and shifts his weight instead of standing like a statue.
 */
import * as THREE from "three";
import { buildBody, buildSkeleton, B, BOOTS, ACC_COL, paintFace, skinAt, hexToRgb, HAIR_COL } from "../../floodlights/m3d/view/rig.mjs";
import { makeHairShells, paintScalp } from "../../floodlights/m3d/view/hairshells.mjs";
import type { Look, Person } from "./types";

export interface Outfit {
  shirt: string;
  trim: string;
  shorts: string;
  socks: string;
  sleeve?: boolean;
  longSocks?: boolean;
}

export const OUTFITS: Record<string, Outfit> = {
  training: {
    shirt: "#151a14",
    trim: "#d0e85c",
    shorts: "#0d0f0c",
    socks: "#d0e85c",
  },
  home: {
    shirt: "#e9e6df",
    trim: "#2a2d33",
    shorts: "#2a2d33",
    socks: "#2a2d33",
  },
  school: {
    shirt: "#1e3a8a",
    trim: "#f4f4f4",
    shorts: "#f4f4f4",
    socks: "#1e3a8a",
  },
};

/** an outfit in a club's (or a country's) colours, the way the match dresses a team */
export function kitOutfit(kit: [string, string] | null | undefined): Outfit {
  if (!kit) return OUTFITS.training;
  const c = new THREE.Color(kit[0]);
  const light = c.r * 0.299 + c.g * 0.587 + c.b * 0.114 > 0.6;
  return { shirt: kit[0], trim: kit[1], shorts: light ? kit[1] : kit[0], socks: kit[0] };
}

export const BOOT_IDS = BOOTS.map((_: unknown, i: number) => i).slice(6);
export const FINISHES = Object.keys(ACC_COL);

/** the rig's own look from the creator's look and the person */
export function rigLook(look: Partial<Look>, person: Pick<Person, "height" | "weight" | "pos">, outfit: Outfit) {
  return {
    ...look,
    h: (person.height || 178) / 100,
    mass: person.weight || 70,
    skin: 0,
    kit: [outfit.shirt, outfit.trim],
    shorts: outfit.shorts,
    socks: outfit.socks,
    sleeve: !!outfit.sleeve,
    sock: !!outfit.longSocks,
    gk: person.pos === "GK",
    cell: null,
    hair: look.hair ?? 1,
    hairCol: look.hairCol ?? 0,
    beard: look.beard ?? 0,
    boot: look.boot ?? 6,
  };
}

/** materials by part, in the rig's MAT order: cloth, skin, hair, boot, eye, metal (the face, 6, is made per body) */
export function bodyMaterials(quality: number): THREE.Material[] {
  const hi = quality >= 2;
  const cloth = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.82,
    metalness: 0,
    sheen: hi ? 0.18 : 0,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color("#ffffff"),
  });
  const skin = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.52,
    metalness: 0,
    sheen: hi ? 0.35 : 0,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color("#ff9a7a"),
    clearcoat: hi ? 0.08 : 0,
    clearcoatRoughness: 0.6,
  });
  const hair = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.48,
    metalness: 0,
    sheen: hi ? 0.8 : 0,
    sheenRoughness: 0.35,
    sheenColor: new THREE.Color("#b9a68f"),
  });
  const boot = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.32,
    metalness: 0.05,
    clearcoat: hi ? 0.7 : 0.3,
    clearcoatRoughness: 0.25,
  });
  const eye = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.08,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  });
  const metal = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.22,
    metalness: 1,
  });
  return [cloth, skin, hair, boot, eye, metal];
}

export interface BodyRig {
  root: THREE.Group;
  mesh: THREE.SkinnedMesh;
  bones: THREE.Bone[];
  height: number;
  dispose: () => void;
  idle: (t: number) => void;
  /** one frame: the idle, or a walk at the given speed, with the body easing round towards turnTo */
  tick: (dt: number, turnTo: number, speed?: number) => void;
}

export function makeBody(look: Partial<Look>, person: Pick<Person, "height" | "weight" | "pos">, outfit: Outfit, quality: number, materials?: THREE.Material[]): BodyRig {
  const rl = rigLook(look, person, outfit);
  const geo = buildBody(THREE, rl, {
    detail: quality >= 2 ? 2 : 1.5,
    groups: true,
  }) as THREE.BufferGeometry;
  // the builder writes colours as they look on screen (sRGB); these scenes light in linear space
  const col = geo.getAttribute("color") as THREE.BufferAttribute;
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  for (let i = 0; i < col.array.length; i++) (col.array as Float32Array)[i] = lin(col.array[i]);
  col.needsUpdate = true;
  const bones = buildSkeleton(THREE, rl.h) as THREE.Bone[];
  const mats = (materials || bodyMaterials(quality)).slice();
  // the face: a painted texture (brows, lips, stubble, the scalp under the hair) over the skin colour
  let faceTex: THREE.CanvasTexture | null = null;
  if (typeof document !== "undefined") {
    const size = quality >= 3 ? 2048 : quality >= 1 ? 1024 : 512;
    const cv = paintFace(document, rl, skinAt(rl), hexToRgb(HAIR_COL[rl.hairCol % HAIR_COL.length]), size) as HTMLCanvasElement | null;
    const scalp = paintScalp(document, rl, size / 2) as HTMLCanvasElement | null;
    if (cv && scalp) {
      const g = cv.getContext("2d");
      if (g) {
        g.globalCompositeOperation = "multiply";
        g.drawImage(scalp, 0, 0, cv.width, cv.height);
        g.globalCompositeOperation = "source-over";
      }
    }
    if (cv) {
      faceTex = new THREE.CanvasTexture(cv);
      faceTex.colorSpace = THREE.SRGBColorSpace;
      faceTex.anisotropy = 8;
    }
  }
  mats[6] = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    map: faceTex,
    roughness: 0.5,
    sheen: quality >= 2 ? 0.35 : 0,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color("#ff9a7a"),
    clearcoat: quality >= 2 ? 0.08 : 0,
    clearcoatRoughness: 0.6,
  });
  const mesh = new THREE.SkinnedMesh(geo, mats);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.add(bones[0]);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.frustumCulled = false;
  // short and medium hair as shells on the head bone
  const hair = makeHairShells(THREE, rl, rl.h, {
    layers: [10, 14, 20, 26][quality] || 14,
  }) as { mesh: THREE.Mesh; dispose: () => void } | null;
  if (hair) bones[B.head].add(hair.mesh);
  const root = new THREE.Group();
  root.add(mesh);
  const rest = bones.map((b) => b.quaternion.clone());
  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  const turn = (i: number, x: number, y: number, z: number) => {
    e.set(x, y, z);
    q.setFromEuler(e);
    bones[i].quaternion.copy(rest[i]).multiply(q);
  };
  // the poses are worked out as small lists of bone angles, so standing and walking can blend smoothly
  const ANIM = [B.hips, B.spine1, B.chest, B.neck, B.head, B.armL, B.armR, B.foreL, B.foreR, B.thighL, B.thighR, B.shinL, B.shinR];
  const poseA = ANIM.map(() => [0, 0, 0]);
  const poseB = ANIM.map(() => [0, 0, 0]);
  const put = (P: number[][], k: number, x: number, y: number, z: number) => {
    P[k][0] = x;
    P[k][1] = y;
    P[k][2] = z;
  };
  // a relaxed stance: arms a little off the body, a soft knee, breathing, a slow weight shift, the head alive
  const idlePose = (P: number[][], t: number) => {
    const br = Math.sin(t * 1.6) * 0.5 + 0.5;
    const sway = Math.sin(t * 0.45);
    put(P, 0, 0, sway * 0.04, sway * 0.018);
    put(P, 1, -0.02 + br * 0.012, -sway * 0.02, -sway * 0.01);
    put(P, 2, -br * 0.025, 0, 0);
    put(P, 3, 0.03, Math.sin(t * 0.31) * 0.08, 0);
    put(P, 4, Math.sin(t * 0.23) * 0.04, Math.sin(t * 0.27 + 1) * 0.1, Math.sin(t * 0.19) * 0.02);
    put(P, 5, 0.04 + br * 0.02, 0, 0.14 + br * 0.02);
    put(P, 6, 0.04 + br * 0.02, 0, -0.14 - br * 0.02);
    put(P, 7, -0.18, 0, 0);
    put(P, 8, -0.18, 0, 0);
    put(P, 9, -0.02, 0.06, 0.035 + sway * 0.012);
    put(P, 10, -0.02, -0.06, -0.035 + sway * 0.012);
    put(P, 11, 0.04, 0, 0);
    put(P, 12, 0.04, 0, 0);
  };
  // walking: the body faces +z, a thigh swings forward with a negative x turn and a knee bends with a positive one;
  // arms swing against the legs, the hips and chest twist a little against each other
  const walkPose = (P: number[][], ph: number, s: number) => {
    const sn = Math.sin(ph),
      cs = Math.cos(ph);
    const th = 0.36 + 0.22 * s;
    const kneeL = 0.12 + (0.55 + 0.45 * s) * Math.pow(Math.max(0, cs), 1.4);
    const kneeR = 0.12 + (0.55 + 0.45 * s) * Math.pow(Math.max(0, -cs), 1.4);
    put(P, 0, 0.02 * s, sn * 0.09, 0);
    put(P, 1, -0.03 - 0.05 * s, -sn * 0.05, 0);
    put(P, 2, -0.02, -sn * 0.06, 0);
    put(P, 3, 0.04, sn * 0.03, 0);
    put(P, 4, 0.02, 0, 0);
    put(P, 5, sn * (0.32 + 0.25 * s), 0, 0.1);
    put(P, 6, -sn * (0.32 + 0.25 * s), 0, -0.1);
    put(P, 7, -0.32 - 0.5 * s, 0, 0);
    put(P, 8, -0.32 - 0.5 * s, 0, 0);
    put(P, 9, -sn * th, 0.04, 0.03);
    put(P, 10, sn * th, -0.04, -0.03);
    put(P, 11, kneeL, 0, 0);
    put(P, 12, kneeR, 0, 0);
  };
  const apply = (w: number) => {
    for (let k = 0; k < ANIM.length; k++) {
      const a = poseA[k],
        b = poseB[k];
      turn(ANIM[k], a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w);
    }
  };
  const idle = (t: number) => {
    idlePose(poseA, t);
    apply(0);
  };
  idle(0);
  let clock = 3.7;
  let phase = 0;
  let gait = 0;
  // one frame: speed in metres a second (0 standing); the body eases round to face turnTo
  const tick = (dt: number, turnTo: number, speed = 0) => {
    clock += dt;
    gait += (Math.min(1.4, speed / 1.6) - gait) * Math.min(1, dt * 7);
    const stride = 0.62 + 0.16 * Math.min(speed, 4);
    phase += dt * (speed / (2 * stride)) * Math.PI * 2;
    idlePose(poseA, clock);
    const w = Math.min(1, gait);
    if (w > 0.01) walkPose(poseB, phase, Math.min(1, Math.max(0, gait - 0.4) * 1.6));
    apply(w > 0.01 ? w : 0);
    mesh.position.y = Math.abs(Math.sin(phase)) * 0.022 * w;
    root.rotation.y += (turnTo - root.rotation.y) * Math.min(1, dt * 8);
  };
  return {
    root,
    mesh,
    bones,
    height: rl.h,
    idle,
    tick,
    dispose: () => {
      geo.dispose();
      if (!materials) mats.forEach((m) => m.dispose());
      else mats[6].dispose();
      faceTex?.dispose();
      hair?.dispose();
    },
  };
}

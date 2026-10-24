/**
 * A boxer's body: the site's own procedural body (floodlights/m3d/view/rig.mjs, the same builder Floodlights'
 * match and Player Career use) at close up detail, turned into a fighter: the shirt becomes bare skin with a
 * little muscle shading, the shorts become satin trunks with a waistband and a side stripe, the socks and boots
 * become boxing boots, the hands are hidden inside gloves on the hand bones. The face texture is painted once and
 * repainted when cuts and swelling build up; small swellings over the eyes grow with the damage; the skin gets
 * shinier with sweat as the fight goes on.
 */
import * as THREE from "three";
import { buildBody, buildSkeleton, B, paintFace, skinAt, hexToRgb, HAIR_COL } from "../../../floodlights/m3d/view/rig.mjs";
import { faceUV, FY } from "../../../floodlights/m3d/view/hero.mjs";
import { makeHairShells, paintScalp } from "../../../floodlights/m3d/view/hairshells.mjs";
import type { FighterDef } from "../engine/types";
import { gloveGeometry, gloveMaterial } from "./glove";

export interface BoxerBody {
  root: THREE.Group;
  mesh: THREE.SkinnedMesh;
  bones: THREE.Bone[];
  h: number;
  gloves: [THREE.Mesh, THREE.Mesh];
  /** cuts and swelling over the left and right eye (0 to 100), and sweat (0 to 1) */
  setDamage(cut: [number, number], swell: [number, number], sweat: number): void;
  dispose(): void;
}

/** the material slots, in the rig's order: 0 trunks (the rig's cloth), 1 skin, 2 hair, 3 boots, 4 eyes, 5 metal, 6 face */
const M = { trunks: 0, skin: 1, hair: 2, boot: 3, eye: 4, metal: 5, face: 6 };
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const toHex = (c: number[]) => "#" + c.map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, "0")).join("");

/** the rig's look for a boxer */
export function rigLookOf(def: FighterDef) {
  const L = def.look;
  const skin = skinAt({ skinF: L.skin }) as number[];
  const skinHex = toHex(skin);
  return {
    h: def.heightCm / 100,
    mass: def.weightKg,
    skin: 0,
    skinF: L.skin,
    hair: L.hair,
    hairCol: L.hairCol,
    beard: L.beard,
    moustache: L.moustache || 0,
    muscle: L.muscle,
    shoulders: L.shoulders,
    kit: [skinHex, skinHex],
    plain: true,
    top: "vest",
    shorts: L.trunks[0],
    socks: L.boots,
    sock: true,
    boot: 0,
    shoe: [L.boots, L.boots],
    gk: false,
    cell: null,
  };
}

/** builds the body geometry and recolours it into a boxer (works without a browser, for the battery) */
export function boxerGeometry(def: FighterDef, detail: number): THREE.BufferGeometry {
  const look = rigLookOf(def);
  const h = look.h;
  const geo = buildBody(THREE, look, { detail, groups: true }) as THREE.BufferGeometry;
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const col = geo.getAttribute("color") as THREE.BufferAttribute;
  const si = geo.getAttribute("skinIndex") as THREE.BufferAttribute;
  const sw = geo.getAttribute("skinWeight") as THREE.BufferAttribute;
  const index = geo.getIndex()!;
  const n = pos.count;
  // each vertex's material from the rig's groups
  const vmat = new Uint8Array(n);
  for (const g of geo.groups) for (let k = g.start; k < g.start + g.count; k++) vmat[index.getX(k)] = g.materialIndex ?? 0;
  const L = def.look;
  const skin = skinAt({ skinF: L.skin }) as number[];
  const trunk = hexToRgb(L.trunks[0]) as number[], band = hexToRgb(L.trunks[1]) as number[], stripe = hexToRgb(L.trunks[2]) as number[];
  const boot = hexToRgb(L.boots) as number[];
  const sole = boot.map(c => c * 0.35 + 0.02);
  const bootTop = boot.map(c => c * 0.8);
  const bulk = Math.max(0.9, Math.min(1.14, Math.sqrt(look.mass / (22.6 * h * h))));
  const hands = new Set([B.handL, B.handR]);
  const shins = new Set([B.shinL, B.shinR, B.footL, B.footR, B.toeL, B.toeR]);
  const thighs = new Set([B.thighL, B.thighR]);
  const muscle = clamp(L.muscle, 0, 1);
  // where the hand bones rest (the wrist), to tuck the hands away inside the gloves
  const bones = buildSkeleton(THREE, h) as THREE.Bone[];
  const root = new THREE.Group();
  root.add(bones[0]);
  root.updateMatrixWorld(true);
  const wrist = { [B.handL]: new THREE.Vector3().setFromMatrixPosition(bones[B.handL].matrixWorld), [B.handR]: new THREE.Vector3().setFromMatrixPosition(bones[B.handR].matrixWorld) };
  // the match body's arms are built to read from a broadcast camera; up close they are slimmed to real proportions
  const armBones = new Set([B.armL, B.armR, B.foreL, B.foreR, B.clavL, B.clavR]);
  const axis: Record<number, number> = {};
  for (const side of [1, -1]) {
    let sx = 0, cnt = 0;
    for (let v = 0; v < n; v++) {
      const bn = sw.getY(v) > 0.5 ? si.getY(v) : si.getX(v);
      if ((bn === B.armL || bn === B.foreL) === side > 0 && (bn === B.armL || bn === B.foreL || bn === B.armR || bn === B.foreR)) { sx += pos.getX(v); cnt++; }
    }
    axis[side] = cnt ? sx / cnt : 0;
  }
  for (let v = 0; v < n; v++) {
    const bn = sw.getY(v) > 0.5 ? si.getY(v) : si.getX(v);
    if (!armBones.has(bn)) continue;
    const left = bn === B.armL || bn === B.foreL || bn === B.clavL;
    const ax = axis[left ? 1 : -1];
    // the shoulder caps hang on the collar bones: only the part out over the arm is slimmed
    if ((bn === B.clavL || bn === B.clavR) && Math.abs(pos.getX(v)) < Math.abs(ax) * 0.75) continue;
    const k = bn === B.foreL || bn === B.foreR ? 0.8 : bn === B.clavL || bn === B.clavR ? 0.88 : 0.84;
    pos.setX(v, ax + (pos.getX(v) - ax) * k);
    pos.setZ(v, pos.getZ(v) * k);
  }
  const out = new Float32Array(n * 3);
  for (let v = 0; v < n; v++) {
    const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
    const yy = y / h, xx = Math.abs(x) / (h * bulk);
    const b0 = si.getX(v), b1 = si.getY(v), w1 = sw.getY(v);
    const bone = w1 > 0.5 ? b1 : b0;
    let c = [col.getX(v), col.getY(v), col.getZ(v)];
    let m = vmat[v];
    if (hands.has(bone) && m !== M.trunks) {
      const w = wrist[bone];
      pos.setXYZ(v, w.x, w.y, w.z);
    }
    if (m === 0) {
      if (yy > 0.508 && !shins.has(bone)) {
        m = M.skin;
        c = skin.slice();
      } else if (yy > 0.3 && !shins.has(bone)) {
        // the trunks: waistband, a stripe down the side, a band at the hem
        m = M.trunks;
        if (yy > 0.468) c = band;
        else if (thighs.has(bone) ? xx > 0.118 : xx > 0.097) c = stripe;
        else if (thighs.has(bone) && yy < 0.398) c = band;
        else c = trunk;
      } else if (yy > 0.17) {
        m = M.skin;
        c = skin.slice();
      } else {
        m = M.boot;
        c = yy > 0.155 ? bootTop : boot;
      }
    } else if (m === M.skin && shins.has(bone) && yy < 0.17) {
      m = M.boot;
      c = yy > 0.155 ? bootTop : boot;
    } else if (m === M.boot) {
      c = yy < 0.014 ? sole : boot;
    }
    if (m === M.skin && yy > 0.5 && yy < 0.83 && z > 0 && !hands.has(bone) && bone !== B.armL && bone !== B.armR && bone !== B.foreL && bone !== B.foreR && bone !== B.clavL && bone !== B.clavR) {
      // muscle shading: the line under the chest, the breastbone, the abdominal grid, a little more with more muscle
      const xa = Math.abs(x) / h;
      let ao = 0;
      ao += Math.exp(-((yy - 0.705) ** 2) / 0.00006) * (xa < 0.1 ? 1 : 0) * 0.32;
      ao += Math.exp(-(xa * xa) / 0.00002) * (yy > 0.56 && yy < 0.79 ? 1 : 0) * 0.22;
      for (const ly of [0.605, 0.638, 0.668]) ao += Math.exp(-((yy - ly) ** 2) / 0.00003) * (xa < 0.045 ? 1 : 0) * 0.16;
      ao += Math.exp(-((xa - 0.075) ** 2) / 0.0001) * (yy > 0.55 && yy < 0.68 ? 1 : 0) * 0.12;
      const k = 1 - ao * (0.3 + muscle * 0.35);
      c = c.map(cc => cc * k);
      // a heavier middle for the big men
      if (L.belly > 0) {
        const g = Math.exp(-((yy - 0.585) ** 2) / 0.0035);
        const fz = clamp(z / (0.07 * h), 0, 1);
        pos.setZ(v, z + L.belly * 0.04 * h * g * fz * fz);
        pos.setX(v, x * (1 + L.belly * 0.08 * g));
      }
    }
    out[v * 3] = lin(c[0]);
    out[v * 3 + 1] = lin(c[1]);
    out[v * 3 + 2] = lin(c[2]);
    vmat[v] = m;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(out, 3));
  // regroup the triangles by their new material
  const tri: number[] = [];
  for (let k = 0; k < index.count; k += 3) tri.push(k);
  const tm = (k: number) => {
    const a = vmat[index.getX(k)], b = vmat[index.getX(k + 1)], c = vmat[index.getX(k + 2)];
    return a === b || a === c ? a : b === c ? b : a;
  };
  const mats = tri.map(tm);
  const order = tri.map((_, i) => i).sort((a, b) => mats[a] - mats[b]);
  const idx = new Uint32Array(index.count);
  order.forEach((ti, o) => {
    const k = tri[ti];
    idx[o * 3] = index.getX(k);
    idx[o * 3 + 1] = index.getX(k + 1);
    idx[o * 3 + 2] = index.getX(k + 2);
  });
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.clearGroups();
  let start = 0;
  for (let o = 1; o <= order.length; o++) {
    if (o === order.length || mats[order[o]] !== mats[order[o - 1]]) {
      geo.addGroup(start * 3, (o - start) * 3, mats[order[start]]);
      start = o;
    }
  }
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

function materials(quality: number, faceTex: THREE.Texture | null): THREE.MeshPhysicalMaterial[] {
  const hi = quality >= 2;
  // skin and trunks are drawn from both sides: up close the open tops of the body's tubes never show as dark gaps
  const trunks = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, vertexColors: true, roughness: 0.46, metalness: 0, sheen: hi ? 0.35 : 0.2, sheenRoughness: 0.35, sheenColor: new THREE.Color("#d8d8d8"), envMapIntensity: 0.7 });
  const skin = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, vertexColors: true, roughness: 0.5, metalness: 0, sheen: hi ? 0.35 : 0, sheenRoughness: 0.45, sheenColor: new THREE.Color("#ff9a7a"), clearcoat: 0.06, clearcoatRoughness: 0.5 });
  const hair = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, metalness: 0, sheen: hi ? 0.8 : 0, sheenRoughness: 0.35, sheenColor: new THREE.Color("#b9a68f") });
  const boot = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.02, clearcoat: hi ? 0.6 : 0.3, clearcoatRoughness: 0.3 });
  const eye = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 });
  const metal = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.22, metalness: 1 });
  const face = new THREE.MeshPhysicalMaterial({ vertexColors: true, map: faceTex, roughness: 0.48, sheen: hi ? 0.35 : 0, sheenRoughness: 0.45, sheenColor: new THREE.Color("#ff9a7a"), clearcoat: 0.06, clearcoatRoughness: 0.5 });
  return [trunks, skin, hair, boot, eye, metal, face];
}

/** the whole boxer for the scene: body, face, hair, gloves, swellings */
export function makeBoxer(def: FighterDef, quality: number): BoxerBody {
  const look = rigLookOf(def);
  const h = look.h;
  const geo = boxerGeometry(def, quality >= 2 ? 2 : 1.5);
  const bones = buildSkeleton(THREE, h) as THREE.Bone[];
  // the face: painted once; damage is drawn over a copy of it
  let base: HTMLCanvasElement | null = null;
  let faceCv: HTMLCanvasElement | null = null;
  let faceTex: THREE.CanvasTexture | null = null;
  const skinRgb = skinAt(look) as number[];
  if (typeof document !== "undefined") {
    const size = quality >= 3 ? 2048 : quality >= 1 ? 1024 : 512;
    base = paintFace(document, look, skinRgb, hexToRgb(HAIR_COL[look.hairCol % HAIR_COL.length]), size) as HTMLCanvasElement | null;
    const scalp = paintScalp(document, look, size / 2) as HTMLCanvasElement | null;
    if (base && scalp) {
      const g = base.getContext("2d");
      if (g) {
        g.globalCompositeOperation = "multiply";
        g.drawImage(scalp, 0, 0, base.width, base.height);
        g.globalCompositeOperation = "source-over";
      }
    }
    if (base) {
      faceCv = document.createElement("canvas");
      faceCv.width = base.width;
      faceCv.height = base.height;
      faceCv.getContext("2d")?.drawImage(base, 0, 0);
      faceTex = new THREE.CanvasTexture(faceCv);
      faceTex.colorSpace = THREE.SRGBColorSpace;
      faceTex.anisotropy = 8;
    }
  }
  const mats = materials(quality, faceTex);
  const mesh = new THREE.SkinnedMesh(geo, mats);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.add(bones[0]);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.frustumCulled = false;
  const hairShell = typeof document !== "undefined" ? (makeHairShells(THREE, look, h, { layers: [10, 14, 20, 26][quality] || 14 }) as { mesh: THREE.Mesh; dispose: () => void } | null) : null;
  if (hairShell) bones[B.head].add(hairShell.mesh);
  // gloves on the hand bones
  const gm = gloveMaterial(quality);
  const gl = new THREE.Mesh(gloveGeometry(1, { main: def.look.gloves, trim: def.look.gloveTrim }), gm);
  const gr = new THREE.Mesh(gloveGeometry(-1, { main: def.look.gloves, trim: def.look.gloveTrim }), gm);
  for (const g of [gl, gr]) {
    g.castShadow = true;
    g.frustumCulled = false;
  }
  bones[B.handL].add(gl);
  bones[B.handR].add(gr);
  // swellings: soft lumps under each eye that grow with the damage (hidden at zero)
  const fr = { cy: 0.93 * h, cz: 0.012 * h, rx: 0.051 * h, ry: 0.066 * h, rz: 0.06 * h };
  const swellGeo = new THREE.SphereGeometry(1, 14, 10);
  const swellMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(lin(skinRgb[0] * 0.92), lin(skinRgb[1] * 0.72), lin(skinRgb[2] * 0.78)), roughness: 0.35, clearcoat: 0.3, clearcoatRoughness: 0.4 });
  const head = bones[B.head];
  const headRest = new THREE.Vector3();
  mesh.updateMatrixWorld(true);
  headRest.setFromMatrixPosition(head.matrixWorld);
  const swells = [1, -1].map(s => {
    const m = new THREE.Mesh(swellGeo, swellMat);
    // the head bone's frame: x left, y up, z forward; the eyes sit a little above the bone, in front
    m.position.set(s * fr.rx * 0.42, fr.cy - headRest.y - fr.ry * 0.1, fr.cz - headRest.z + fr.rz * 0.84);
    m.scale.setScalar(0.0001);
    m.visible = false;
    head.add(m);
    return m;
  });
  const root = new THREE.Group();
  root.add(mesh);
  let lastKey = "";
  const setDamage = (cut: [number, number], swell: [number, number], sweat: number) => {
    // sweat: the skin shines more as the fight wears on
    for (const k of [M.skin, M.face]) {
      const m = mats[k];
      m.roughness = 0.5 - sweat * 0.24;
      m.clearcoat = 0.06 + sweat * 0.5;
      m.clearcoatRoughness = 0.5 - sweat * 0.25;
    }
    swells.forEach((m, i) => {
      // index 0 is the left eye (the body's +x side)
      const s = swell[i] / 100;
      m.visible = s > 0.08;
      m.scale.set(fr.rx * (0.18 + s * 0.2), fr.ry * (0.1 + s * 0.13), fr.rz * (0.1 + s * 0.12));
    });
    // repaint the face only when the damage has moved on enough to show
    const key = [cut[0], cut[1], swell[0], swell[1]].map(v => Math.round(v / 8)).join(",");
    if (key === lastKey || !base || !faceCv || !faceTex) return;
    lastKey = key;
    const g = faceCv.getContext("2d");
    if (!g) return;
    const W = faceCv.width, H = faceCv.height;
    g.globalCompositeOperation = "source-over";
    g.drawImage(base, 0, 0);
    const P = (x: number, y: number) => {
      const [u, v] = faceUV(x, y) as [number, number];
      return [u * W, v * H];
    };
    g.globalCompositeOperation = "multiply";
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? 1 : -1;
      const sw = swell[i] / 100;
      if (sw > 0.05) {
        // a bruise round the eye, darker and more purple as it swells
        const [px, py] = P(s * 0.34, FY.eye - 0.02);
        const grd = g.createRadialGradient(px, py, 0, px, py, W * 0.05 * (0.7 + sw));
        grd.addColorStop(0, `rgba(${Math.round(150 - sw * 60)},${Math.round(90 - sw * 50)},${Math.round(120 - sw * 30)},${0.35 + sw * 0.5})`);
        grd.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = grd;
        g.beginPath();
        g.ellipse(px, py, W * 0.05 * (0.7 + sw), H * 0.07 * (0.7 + sw), 0, 0, Math.PI * 2);
        g.fill();
      }
      const c = cut[i] / 100;
      if (c > 0.03) {
        // a cut over the eyebrow: a dark red gash with blood under it
        const [px, py] = P(s * 0.3, FY.brow + 0.02);
        g.strokeStyle = `rgba(110,10,14,${0.6 + c * 0.4})`;
        g.lineWidth = (2 + c * 4) * (W / 1024);
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(px - s * W * 0.012, py - H * 0.004);
        g.lineTo(px + s * W * 0.014 * (1 + c), py + H * 0.006);
        g.stroke();
        const grd = g.createLinearGradient(px, py, px, py + H * 0.12 * c);
        grd.addColorStop(0, `rgba(160,20,24,${0.5 + c * 0.4})`);
        grd.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = grd;
        g.fillRect(px - W * 0.008, py, W * 0.016, H * 0.12 * c);
      }
    }
    g.globalCompositeOperation = "source-over";
    faceTex.needsUpdate = true;
  };
  return {
    root,
    mesh,
    bones,
    h,
    gloves: [gl, gr],
    setDamage,
    dispose() {
      geo.dispose();
      mesh.skeleton.dispose();
      mats.forEach(m => m.dispose());
      faceTex?.dispose();
      hairShell?.dispose();
      gl.geometry.dispose();
      gr.geometry.dispose();
      gm.dispose();
      swellGeo.dispose();
      swellMat.dispose();
    },
  };
}

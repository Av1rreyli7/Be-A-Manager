/**
 * A boxing glove, built from a deformed sphere: the padded fist with a rounded knuckle roll, a flatter palm, the
 * thumb lying along the side, and the cuff with its band. One geometry with vertex colours (glove colour, trim on
 * the cuff and the thumb seam, a lighter logo patch on the back of the hand), one leather material.
 *
 * Glove space (the hand bone's space in the rest pose): the knuckles point down -Y (along the forearm), the thumb
 * points +Z, the palm faces the body: -X for the left glove, +X for the right. Sizes are metres (a 16 oz glove).
 */
import * as THREE from "three";

export interface GloveColours {
  main: string;
  trim: string;
}

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [lin(((n >> 16) & 255) / 255), lin(((n >> 8) & 255) / 255), lin((n & 255) / 255)];
}

/** builds one glove; side 1 is the left hand, -1 the right */
export function gloveGeometry(side: 1 | -1, col: GloveColours, detail = 1): THREE.BufferGeometry {
  const main = rgb(col.main), trim = rgb(col.trim);
  const patch: [number, number, number] = [main[0] * 0.75 + 0.25 * trim[0], main[1] * 0.75 + 0.25 * trim[1], main[2] * 0.75 + 0.25 * trim[2]];
  const seg = Math.round(28 * detail), rings = Math.round(22 * detail);
  const parts: THREE.BufferGeometry[] = [];

  // ---- the fist: a sphere pushed into the glove's shape
  const fist = new THREE.SphereGeometry(1, seg, rings);
  {
    const p = fist.getAttribute("position") as THREE.BufferAttribute;
    const c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      // y: -1 knuckles, +1 wrist end; x: the back of the hand at +side*... we build for the left glove and mirror
      const toKnuckle = Math.max(0, -y);
      // longer than wide, deeper at the knuckles, a flatter palm and a rounder back
      let sx = 0.058, sy = 0.105, sz = 0.068;
      sz *= 1 + toKnuckle * 0.12;
      sx *= 1 + toKnuckle * 0.08;
      if (x < 0) sx *= 0.78; // palm side flatter (left glove: palm toward -X)
      // the knuckle roll: a fuller front edge
      const roll = Math.exp(-((y + 0.75) * (y + 0.75)) / 0.06) * 0.12;
      x *= sx * (1 + roll);
      z *= sz * (1 + roll * 0.6);
      y *= sy;
      // the fingers curl round: the front bends a little toward the palm
      x -= toKnuckle * toKnuckle * 0.012;
      p.setXYZ(i, x * side, y - 0.02, z);
      // the logo patch on the back of the hand
      const onBack = x > 0.03 && y > -0.07 && y < 0.03 && Math.abs(z) < 0.035;
      const cc = onBack ? patch : main;
      c[i * 3] = cc[0]; c[i * 3 + 1] = cc[1]; c[i * 3 + 2] = cc[2];
    }
    fist.setAttribute("color", new THREE.BufferAttribute(c, 3));
    parts.push(fist);
  }
  // ---- the thumb: a padded sausage along the side, tip toward the knuckles
  const thumb = new THREE.SphereGeometry(1, Math.round(16 * detail), Math.round(12 * detail));
  {
    const p = thumb.getAttribute("position") as THREE.BufferAttribute;
    const c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      // a thin seam of the trim round the middle of the thumb (judged on the sphere before it is shaped)
      const seam = Math.abs(p.getY(i)) < 0.08;
      const x = p.getX(i) * 0.024, y = p.getY(i) * 0.05, z = p.getZ(i) * 0.026;
      // tilted so the tip leans in toward the palm
      const ty = y * 0.94 - x * 0.2, tx = x * 0.94 + y * 0.18;
      p.setXYZ(i, (tx - 0.018) * side, ty - 0.035, z + 0.062);
      const cc = seam ? trim : main;
      c[i * 3] = cc[0]; c[i * 3 + 1] = cc[1]; c[i * 3 + 2] = cc[2];
    }
    thumb.setAttribute("color", new THREE.BufferAttribute(c, 3));
    parts.push(thumb);
  }
  // ---- the cuff: a short tapered tube over the wrist, a band of trim round it
  const cuff = new THREE.CylinderGeometry(0.045, 0.05, 0.09, Math.round(22 * detail), 3, false);
  {
    const p = cuff.getAttribute("position") as THREE.BufferAttribute;
    const c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      // oval like a wrist
      p.setXYZ(i, x * 0.92 * side, y + 0.105, z * 1.08);
      const band = y > -0.012 && y < 0.022;
      const cc = band ? trim : main;
      c[i * 3] = cc[0]; c[i * 3 + 1] = cc[1]; c[i * 3 + 2] = cc[2];
    }
    cuff.setAttribute("color", new THREE.BufferAttribute(c, 3));
    parts.push(cuff);
  }
  // mirrored geometry flips the winding: put it back for the right glove
  if (side < 0) for (const g of parts) {
    const idx = g.getIndex()!;
    const a = idx.array as Uint16Array | Uint32Array;
    for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; }
  }
  const merged = mergeSimple(parts);
  parts.forEach(g => g.dispose());
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  return merged;
}

/** leather: a clear coat over a soft sheen */
export function gloveMaterial(quality: number) {
  // a soft leather: most of the shine is a broad clear coat, so the colour stays deep and saturated
  return new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.6,
    metalness: 0,
    clearcoat: quality >= 2 ? 0.18 : 0.1,
    clearcoatRoughness: 0.55,
    envMapIntensity: 0.3,
  });
}

/** merges indexed geometries with the same attributes (position, normal, uv, color) */
export function mergeSimple(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const names = ["position", "normal", "uv", "color"].filter(n => list.every(g => g.getAttribute(n)));
  let vCount = 0, iCount = 0;
  for (const g of list) {
    vCount += g.getAttribute("position").count;
    iCount += g.getIndex() ? g.getIndex()!.count : g.getAttribute("position").count;
  }
  const out = new THREE.BufferGeometry();
  for (const n of names) {
    const size = list[0].getAttribute(n).itemSize;
    const arr = new Float32Array(vCount * size);
    let off = 0;
    for (const g of list) {
      const a = g.getAttribute(n) as THREE.BufferAttribute;
      arr.set(a.array as Float32Array, off);
      off += a.count * size;
    }
    out.setAttribute(n, new THREE.BufferAttribute(arr, size));
  }
  const idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);
  let io = 0, vo = 0;
  for (const g of list) {
    const ix = g.getIndex();
    const n = g.getAttribute("position").count;
    if (ix) for (let i = 0; i < ix.count; i++) idx[io++] = ix.getX(i) + vo;
    else for (let i = 0; i < n; i++) idx[io++] = i + vo;
    vo += n;
  }
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

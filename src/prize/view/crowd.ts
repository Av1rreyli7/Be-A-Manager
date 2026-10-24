/**
 * The crowd: one instanced mesh of simple seated figures (torso, head, two arms) on tiers round the ring, lit by
 * the spill from the ring lights (bright at ringside, fading into the dark hall). A vertex shader moves them: a
 * gentle sway always, a bounce and arms in the air when the cheer rises after a big shot or a knockdown. Phone
 * screens and camera flashes twinkle in the dark. The count follows the graphics level.
 */
import * as THREE from "three";
import { RING } from "../engine/rules";
import { FLOOR_Y, glowTexture } from "./arena";

const SHIRTS = ["#1b1d24", "#2a2e38", "#3a2a2a", "#22303f", "#4a4f5a", "#6b1d1d", "#1d3b2a", "#8a8f99", "#bfc3c9", "#202020", "#5a3a22", "#2b2440"];
const SKINS = ["#f1d2b8", "#e2b48f", "#c98f66", "#a86f49", "#8a5636", "#6b3f26", "#4f2d1c"];
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [lin(((n >> 16) & 255) / 255), lin(((n >> 8) & 255) / 255), lin((n & 255) / 255)];
}

/** one figure: torso, head, arms; the part attribute says which is which (0 torso, 1 head, 2 left arm, 3 right arm) */
function figure(): THREE.BufferGeometry {
  const parts: [THREE.BufferGeometry, number][] = [];
  const torso = new THREE.CylinderGeometry(0.17, 0.2, 0.62, 7, 1);
  torso.translate(0, 0.31, 0);
  parts.push([torso, 0]);
  const head = new THREE.SphereGeometry(0.11, 7, 5);
  head.translate(0, 0.76, 0.02);
  parts.push([head, 1]);
  for (const s of [1, -1]) {
    const arm = new THREE.BoxGeometry(0.08, 0.5, 0.08);
    arm.translate(s * 0.22, 0.32, 0.04);
    parts.push([arm, s > 0 ? 2 : 3]);
  }
  const pos: number[] = [], nor: number[] = [], part: number[] = [], idx: number[] = [];
  let base = 0;
  for (const [g, p] of parts) {
    const ng = g.index ? g.toNonIndexed() : g;
    ng.computeVertexNormals();
    const pa = ng.getAttribute("position"), na = ng.getAttribute("normal");
    for (let i = 0; i < pa.count; i++) {
      pos.push(pa.getX(i), pa.getY(i), pa.getZ(i));
      nor.push(na.getX(i), na.getY(i), na.getZ(i));
      part.push(p);
      idx.push(base + i);
    }
    base += pa.count;
    g.dispose();
    if (ng !== g) ng.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("part", new THREE.Float32BufferAttribute(part, 1));
  geo.setIndex(idx);
  return geo;
}

export class Crowd {
  readonly mesh: THREE.InstancedMesh;
  readonly sparkle: THREE.Points | null = null;
  private mat: THREE.MeshLambertMaterial;
  private shader: { uniforms: Record<string, { value: number }> } | null = null;
  private cheer = 0;
  private cheerTarget = 0;
  private flashes = 0;
  private glow: THREE.Texture | null;
  private sparkMat: THREE.ShaderMaterial | null = null;

  constructor(count: number) {
    const geo = figure();
    // places: rows on the floor round the ring, then rising tiers, a gap for the aisle to the red corner
    const places: { x: number; y: number; z: number; ry: number }[] = [];
    let row = 0;
    while (places.length < count && row < 60) {
      const d = RING + 3.4 + row * 0.95;
      const y = FLOOR_Y + (row < 3 ? 0 : (row - 2) * 0.42);
      const per = Math.floor((d * 8) / 0.62);
      for (let k = 0; k < per && places.length < count; k++) {
        // round the square: walk the perimeter of a square of half size d
        const t = k / per;
        const side = Math.floor(t * 4), f = t * 4 - side;
        let x = 0, z = 0;
        if (side === 0) { x = -d + f * 2 * d; z = -d; }
        else if (side === 1) { x = d; z = -d + f * 2 * d; }
        else if (side === 2) { x = d - f * 2 * d; z = d; }
        else { x = -d; z = d - f * 2 * d; }
        // the aisle: no seats along the diagonal to the red corner
        if (x < 0 && z < 0 && Math.abs(x - z) < 2.6) continue;
        // the press row and the corners near the ring stay clear
        if (row < 2 && (Math.abs(x) > d - 0.5 && Math.abs(z) > d - 0.5)) continue;
        places.push({ x: x + (Math.random() - 0.5) * 0.12, y, z: z + (Math.random() - 0.5) * 0.12, ry: Math.atan2(-x, -z) });
      }
      row++;
    }
    this.mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const mesh = new THREE.InstancedMesh(geo, this.mat, places.length);
    const shirt = new Float32Array(places.length * 3), skin = new Float32Array(places.length * 3), phase = new Float32Array(places.length * 2);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    places.forEach((p, i) => {
      const sc = 0.92 + Math.random() * 0.16;
      s.set(sc, sc * (0.95 + Math.random() * 0.1), sc);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.ry + (Math.random() - 0.5) * 0.4);
      m.compose(new THREE.Vector3(p.x, p.y + 0.45, p.z), q, s);
      mesh.setMatrixAt(i, m);
      const c = rgb(SHIRTS[Math.floor(Math.random() * SHIRTS.length)]);
      shirt.set(c, i * 3);
      skin.set(rgb(SKINS[Math.floor(Math.random() * SKINS.length)]), i * 3);
      phase[i * 2] = Math.random() * 6.283;
      phase[i * 2 + 1] = 0.4 + Math.random() * 0.6;
    });
    geo.setAttribute("aShirt", new THREE.InstancedBufferAttribute(shirt, 3));
    geo.setAttribute("aSkin", new THREE.InstancedBufferAttribute(skin, 3));
    geo.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phase, 2));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    this.mesh = mesh;
    this.mat.onBeforeCompile = shader => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uCheer = { value: 0 };
      this.shader = shader as unknown as { uniforms: Record<string, { value: number }> };
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
          attribute float part; attribute vec3 aShirt; attribute vec3 aSkin; attribute vec2 aPhase;
          uniform float uTime; uniform float uCheer; varying vec3 vTint;`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          float energy = aPhase.y;
          float cheer = uCheer * energy;
          float bounce = cheer * abs(sin(uTime * 7.0 + aPhase.x)) * 0.16;
          // sway always; arms go up with the cheer (rotate round the shoulder)
          float sway = sin(uTime * 0.9 + aPhase.x) * 0.035;
          if (part > 1.5) {
            float s = part < 2.5 ? 1.0 : -1.0;
            float lift = clamp(cheer * 1.6 - 0.25 + 0.25 * sin(uTime * 6.0 + aPhase.x * 2.0) * cheer, 0.0, 1.0) * 2.6;
            vec3 pivot = vec3(s * 0.22, 0.56, 0.04);
            vec3 p = transformed - pivot;
            float ca = cos(lift * s), sa = sin(lift * s);
            transformed = pivot + vec3(p.x * ca - p.y * sa, p.x * sa + p.y * ca, p.z);
          }
          transformed.x += sway * transformed.y;
          transformed.y += bounce;
          vTint = part > 0.5 && part < 1.5 ? aSkin : aShirt;
          // the spill from the ring: bright close in, dark at the back of the hall
          vec4 wpos = instanceMatrix * vec4(transformed, 1.0);
          float dist = length(wpos.xz);
          vTint *= 0.05 + 0.35 * smoothstep(22.0, 5.0, dist) + 0.3 * smoothstep(9.5, 5.0, dist);`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vTint;")
        .replace("vec4 diffuseColor = vec4( diffuse, opacity );", "vec4 diffuseColor = vec4( diffuse * vTint, opacity );");
    };
    // phone screens and flashes in the dark
    this.glow = glowTexture();
    if (this.glow) {
      const n = Math.floor(places.length * 0.25);
      const pos = new Float32Array(n * 3), seed = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const p = places[Math.floor(Math.random() * places.length)];
        pos[i * 3] = p.x;
        pos[i * 3 + 1] = p.y + 1.25;
        pos[i * 3 + 2] = p.z;
        seed[i] = Math.random();
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
      this.sparkMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uFlash: { value: 0 }, uMap: { value: this.glow }, uScale: { value: 300 } },
        vertexShader: `
          attribute float seed; uniform float uTime; uniform float uFlash; uniform float uScale; varying float vA;
          void main(){
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            // most are phone screens (dim, steady); a few flash, more after a big moment
            float phone = step(0.82, seed) * 0.35;
            float t = fract(uTime * (0.07 + seed * 0.11) + seed * 13.0);
            float flash = smoothstep(0.0, 0.01, t) * (1.0 - smoothstep(0.01, 0.06, t)) * step(seed, 0.12 + uFlash * 0.5);
            vA = phone + flash * 1.6;
            gl_PointSize = (phone > 0.0 ? 0.25 : 0.9) * uScale / -mv.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform sampler2D uMap; varying float vA;
          void main(){ vec4 c = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vec3(0.85,0.9,1.0) * c.a * vA, c.a * vA); }`,
      });
      const pts = new THREE.Points(g, this.sparkMat);
      pts.frustumCulled = false;
      (this as { sparkle: THREE.Points | null }).sparkle = pts;
    }
  }

  /** a big moment: the crowd rises (0 to 1), and more cameras flash */
  roar(level: number) {
    this.cheerTarget = Math.max(this.cheerTarget, Math.min(1, level));
    this.flashes = Math.min(1, this.flashes + level * 0.6);
  }

  update(t: number, dt: number, base: number) {
    // the cheer falls back toward the hum of the fight
    this.cheerTarget = Math.max(base, this.cheerTarget - dt * 0.35);
    this.cheer += (this.cheerTarget - this.cheer) * Math.min(1, dt * 4);
    this.flashes = Math.max(0, this.flashes - dt * 0.3);
    if (this.shader) {
      this.shader.uniforms.uTime.value = t;
      this.shader.uniforms.uCheer.value = this.cheer;
    }
    if (this.sparkMat) {
      this.sparkMat.uniforms.uTime.value = t;
      this.sparkMat.uniforms.uFlash.value = this.flashes;
    }
  }

  get level() {
    return this.cheer;
  }

  setPixelScale(px: number) {
    if (this.sparkMat) this.sparkMat.uniforms.uScale.value = px;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
    this.sparkle?.geometry.dispose();
    this.sparkMat?.dispose();
    this.glow?.dispose();
  }
}

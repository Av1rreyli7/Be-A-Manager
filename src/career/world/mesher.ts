/**
 * Builds one merged geometry out of many little shapes, each painted with a vertex colour and an optional glow
 * that lights up at night (windows, signs, lamps, neon). One merged geometry is one draw call, which is how a
 * whole street of shop fronts stays cheap.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const col = new THREE.Color();

/** sRGB hex to linear rgb, the way the vertex colours are read when lighting in linear space */
export function lin(hex: string | THREE.Color) {
  col.set(hex as THREE.ColorRepresentation);
  return [col.r, col.g, col.b];
}

export class Mesher {
  parts: THREE.BufferGeometry[] = [];
  /** add a shape at a place, turned by ry (and rx, rz), in a colour; glow from 0 to 1 lights it at night */
  add(geo: THREE.BufferGeometry, hex: string, x: number, y: number, z: number, o: { ry?: number; rx?: number; rz?: number; sx?: number; sy?: number; sz?: number; glow?: number; day?: number } = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    // turn about z, then tilt about x, then face the way it faces (so a tilt is in the shape's own frame)
    tmpE.set(o.rx || 0, o.ry || 0, o.rz || 0, "YXZ");
    tmpQ.setFromEuler(tmpE);
    tmpS.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
    tmpP.set(x, y, z);
    tmpM.compose(tmpP, tmpQ, tmpS);
    g.applyMatrix4(tmpM);
    const n = g.getAttribute("position").count;
    const c = lin(hex);
    const cols = new Float32Array(n * 3);
    const glow = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      cols[i * 3] = c[0];
      cols[i * 3 + 1] = c[1];
      cols[i * 3 + 2] = c[2];
      // x: how much it lights at night, y: how much it glows in the day too (signs, screens)
      glow[i * 2] = o.glow || 0;
      glow[i * 2 + 1] = o.day || 0;
    }
    g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    g.setAttribute("aGlow", new THREE.BufferAttribute(glow, 2));
    if (g.getAttribute("uv")) g.deleteAttribute("uv");
    this.parts.push(g);
    return this;
  }
  /** a box from its centre and size */
  box(hex: string, x: number, y: number, z: number, w: number, h: number, d: number, o: { ry?: number; glow?: number; day?: number } = {}) {
    return this.add(BOX, hex, x, y, z, { ...o, sx: w, sy: h, sz: d });
  }
  build() {
    if (!this.parts.length) return new THREE.BufferGeometry();
    const g = mergeGeometries(this.parts, false) as THREE.BufferGeometry;
    for (const p of this.parts) p.dispose();
    this.parts = [];
    g.computeBoundingSphere();
    return g;
  }
}

export const BOX = new THREE.BoxGeometry(1, 1, 1);

/**
 * The material for merged and instanced world pieces: vertex colours, lit by the sun, with the glow attribute
 * adding light at night (uNight from 0 to 1). Instanced colours still multiply in.
 */
export function worldMaterial(night: { value: number }, o: { rough?: number; metal?: number; flat?: boolean } = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0.04, flatShading: !!o.flat });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = night;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec2 aGlow;\nvarying vec2 vGlow;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlow = aGlow;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vGlow;\nuniform float uNight;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * (vGlow.x * uNight * 2.2 + vGlow.y * 0.9);");
  };
  m.customProgramCacheKey = () => "worldmat" + (o.flat ? "f" : "");
  return m;
}

/** a triangular prism for pitched roofs: 1 wide, 1 high, 1 deep, the ridge along z */
export const PRISM = (() => {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0);
  s.lineTo(0.5, 0);
  s.lineTo(0, 1);
  s.lineTo(-0.5, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
  g.translate(0, 0, -0.5);
  return g;
})();
export const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
export const CYL16 = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
export const CYL8 = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
export const CYL6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
export const BALL = new THREE.IcosahedronGeometry(0.5, 1);
export const DISC = new THREE.CircleGeometry(0.5, 20).rotateX(-Math.PI / 2);

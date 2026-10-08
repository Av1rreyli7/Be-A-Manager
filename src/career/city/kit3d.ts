/**
 * Small building blocks shared by the city and the places in it: cached shapes and materials, a building
 * material whose windows light up at night (worked out in the shader, no textures), painted signs, and cars.
 * Everything is cached by key so a scene that is rebuilt does not rebuild its shapes and materials too.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const geoCache = new Map<string, THREE.BufferGeometry>();
const matCache = new Map<string, THREE.Material>();

/** a box with rounded edges, cached by size */
export function rbox(w: number, h: number, d: number, r = 0.04, seg = 2) {
  const k = `rb${w}|${h}|${d}|${r}|${seg}`;
  let g = geoCache.get(k);
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
    geoCache.set(k, g);
  }
  return g;
}
export function cyl(rt: number, rb: number, h: number, seg = 24, open = false) {
  const k = `cy${rt}|${rb}|${h}|${seg}|${open}`;
  let g = geoCache.get(k);
  if (!g) {
    g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
    geoCache.set(k, g);
  }
  return g;
}
export function sphere(r: number, seg = 20) {
  const k = `sp${r}|${seg}`;
  let g = geoCache.get(k);
  if (!g) {
    g = new THREE.SphereGeometry(r, seg, Math.max(8, Math.round(seg * 0.6)));
    geoCache.set(k, g);
  }
  return g;
}
export function plane(w: number, h: number) {
  const k = `pl${w}|${h}`;
  let g = geoCache.get(k);
  if (!g) {
    g = new THREE.PlaneGeometry(w, h);
    geoCache.set(k, g);
  }
  return g;
}

/** a physically based material, cached by its settings */
export function mat(color: string, o: { rough?: number; metal?: number; emissive?: string; ei?: number; opacity?: number; side?: THREE.Side; flat?: boolean } = {}) {
  const k = `m${color}|${o.rough ?? 0.7}|${o.metal ?? 0}|${o.emissive || ""}|${o.ei ?? 0}|${o.opacity ?? 1}|${o.side ?? 0}|${o.flat ? 1 : 0}`;
  let m = matCache.get(k) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: o.rough ?? 0.7,
      metalness: o.metal ?? 0,
      ...(o.emissive ? { emissive: new THREE.Color(o.emissive), emissiveIntensity: o.ei ?? 1 } : {}),
      transparent: (o.opacity ?? 1) < 1,
      opacity: o.opacity ?? 1,
      side: o.side ?? THREE.FrontSide,
      flatShading: !!o.flat,
    });
    matCache.set(k, m);
  }
  return m;
}
/** glass: no transmission pass (too costly), just a dark tint that reflects the room or the sky */
export function glass(tint = "#9fb6c8", opacity = 0.32) {
  const k = `g${tint}|${opacity}`;
  let m = matCache.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.04, metalness: 0.9, transparent: true, opacity, depthWrite: false });
    matCache.set(k, m);
  }
  return m;
}
/** a flat glowing colour that ignores the lights (signs, lamps, screens) */
export function glow(color: string, strength = 1) {
  const k = `gl${color}|${strength}`;
  let m = matCache.get(k);
  if (!m) {
    const c = new THREE.Color(color).multiplyScalar(strength);
    m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
    matCache.set(k, m);
  }
  return m;
}

/**
 * Building walls with windows. On walls the shader cuts a grid of windows from the world position and lights a
 * share of them by a hash of the floor, the column and the building, warmer and brighter as night falls. Roofs
 * stay plain, and the bottom of each wall is a little darker so the buildings sit on the ground.
 */
export function windowsMaterial(base: string, lights: string, night: { value: number }, opts: { rough?: number; size?: [number, number]; lit?: number } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: base, roughness: opts.rough ?? 0.82, metalness: 0.05 });
  const [cw, ch] = opts.size || [1.7, 2.6];
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = night;
    sh.uniforms.uLit = { value: new THREE.Color(lights) };
    sh.uniforms.uShare = { value: opts.lit ?? 0.42 };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWN;\nvarying float vSeed;").replace(
      "#include <project_vertex>",
      `#include <project_vertex>
        vec4 wp0 = vec4(transformed, 1.0);
        vec3 wn0 = objectNormal;
        #ifdef USE_INSTANCING
          wp0 = instanceMatrix * wp0;
          wn0 = mat3(instanceMatrix) * wn0;
          vSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
        #else
          vSeed = fract(sin(dot(modelMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
        #endif
        wp0 = modelMatrix * wp0;
        vWPos = wp0.xyz;
        vWN = normalize(mat3(modelMatrix) * wn0);`,
    );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWN;\nvarying float vSeed;\nuniform float uNight;\nuniform vec3 uLit;\nuniform float uShare;\nfloat h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float wall = 1.0 - step(0.5, abs(vWN.y));
        vec2 tg = normalize(vec2(-vWN.z, vWN.x) + 1e-5);
        float u = dot(vWPos.xz, tg) / ${cw.toFixed(2)};
        float v = (vWPos.y - 0.6) / ${ch.toFixed(2)};
        vec2 cell = floor(vec2(u, v));
        vec2 f = fract(vec2(u, v));
        float pane = step(0.22, f.x) * step(f.x, 0.82) * step(0.28, f.y) * step(f.y, 0.82) * step(0.0, v);
        float on = step(1.0 - uShare, h21(cell + vSeed * 91.0));
        float warm = h21(cell.yx + vSeed * 17.0);
        vec3 lit = mix(uLit, vec3(1.0, 0.86, 0.62), warm * 0.6) * (0.55 + warm * 0.9);
        totalEmissiveRadiance += wall * pane * on * lit * uNight * 1.6;
        diffuseColor.rgb *= mix(1.0, 0.55 + 0.45 * (1.0 - pane * 0.6), wall);
        diffuseColor.rgb *= mix(0.62, 1.0, clamp(vWPos.y / 7.0, 0.0, 1.0));`,
      );
  };
  m.customProgramCacheKey = () => `win${cw}|${ch}`;
  return m;
}

/** a painted sign: text on a coloured board, as a texture */
export function signTexture(text: string, fg = "#ffffff", bg = "#111111", w = 512, h = 128, font = "700 64px Inter, system-ui, sans-serif") {
  const k = `sign${text}|${fg}|${bg}|${w}|${h}|${font}`;
  const hit = texCache.get(k);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const x = cv.getContext("2d")!;
  if (bg !== "transparent") {
    x.fillStyle = bg;
    x.fillRect(0, 0, w, h);
  }
  x.fillStyle = fg;
  x.font = font;
  x.textAlign = "center";
  x.textBaseline = "middle";
  let size = parseInt(font.match(/(\d+)px/)?.[1] || "64", 10);
  while (x.measureText(text).width > w * 0.9 && size > 12) {
    size -= 4;
    x.font = font.replace(/\d+px/, size + "px");
  }
  x.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(k, t);
  return t;
}
const texCache = new Map<string, THREE.Texture>();
export function cachedTexture(key: string, draw: (x: CanvasRenderingContext2D, w: number, h: number) => void, w = 512, h = 512, repeat?: [number, number]) {
  const hit = texCache.get(key);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  texCache.set(key, t);
  return t;
}

/** a seeded random number source, so a city is the same every visit */
export function seeded(seed: string | number) {
  let h = typeof seed === "number" ? seed >>> 0 : 2166136261;
  if (typeof seed === "string") for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** a car from the made up range: a body, a cabin, wheels and lights, sized by its type */
export function makeCar(c: { body: string; colour: string }) {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: c.colour, roughness: 0.28, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.08 });
  const dark = mat("#0b0d10", { rough: 0.5 });
  const tyre = mat("#111214", { rough: 0.9 });
  const rim = mat("#b9bec4", { rough: 0.25, metal: 1 });
  const win = glass("#1d2733", 0.85);
  if (c.body === "scooter") {
    const deck = new THREE.Mesh(rbox(0.35, 0.18, 1.2, 0.08), paint);
    deck.position.y = 0.35;
    const front = new THREE.Mesh(rbox(0.32, 0.8, 0.25, 0.1), paint);
    front.position.set(0, 0.7, 0.5);
    const seat = new THREE.Mesh(rbox(0.3, 0.12, 0.55, 0.05), dark);
    seat.position.set(0, 0.62, -0.25);
    const bar = new THREE.Mesh(cyl(0.02, 0.02, 0.6, 8), rim);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 1.15, 0.55);
    g.add(deck, front, seat, bar);
    for (const z of [0.55, -0.45]) {
      const w = new THREE.Mesh(cyl(0.22, 0.22, 0.12, 20), tyre);
      w.rotation.z = Math.PI / 2;
      w.position.set(0, 0.22, z);
      g.add(w);
    }
    g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    return g;
  }
  const dims: Record<string, [number, number, number, number, number]> = {
    // width, body height, length, cabin height, cabin length share
    hatch: [1.75, 0.62, 3.9, 0.55, 0.62],
    saloon: [1.82, 0.6, 4.7, 0.5, 0.5],
    coupe: [1.9, 0.56, 4.6, 0.44, 0.42],
    sports: [1.96, 0.5, 4.5, 0.38, 0.36],
    suv: [1.98, 0.8, 4.9, 0.62, 0.6],
    hyper: [2.04, 0.44, 4.7, 0.34, 0.3],
  };
  const [w, bh, l, chh, cl] = dims[c.body] || dims.saloon;
  const clear = c.body === "suv" ? 0.28 : c.body === "hyper" || c.body === "sports" ? 0.12 : 0.18;
  const body = new THREE.Mesh(rbox(w, bh, l, Math.min(0.22, bh * 0.45), 3), paint);
  body.position.y = clear + bh / 2 + 0.14;
  const cabin = new THREE.Mesh(rbox(w * 0.84, chh, l * cl, Math.min(0.2, chh * 0.45), 3), win);
  cabin.position.set(0, clear + bh + chh / 2 + 0.1, -l * 0.04);
  const roof = new THREE.Mesh(rbox(w * 0.8, 0.05, l * cl * 0.86, 0.02), paint);
  roof.position.set(0, cabin.position.y + chh / 2, cabin.position.z);
  g.add(body, cabin, roof);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const r = c.body === "suv" ? 0.4 : 0.34;
      const wh = new THREE.Mesh(cyl(r, r, 0.26, 24), tyre);
      wh.rotation.z = Math.PI / 2;
      wh.position.set((sx * w) / 2 - sx * 0.06, r, (sz * l) / 2 - sz * l * 0.18);
      const hub = new THREE.Mesh(cyl(r * 0.62, r * 0.62, 0.27, 16), rim);
      hub.rotation.z = Math.PI / 2;
      hub.position.copy(wh.position);
      g.add(wh, hub);
    }
  for (const sx of [-1, 1]) {
    const head = new THREE.Mesh(rbox(0.36, 0.08, 0.04, 0.02), glow("#fff6e0", 2.2));
    head.position.set(sx * (w / 2 - 0.32), body.position.y + bh * 0.18, l / 2 + 0.005);
    const tail = new THREE.Mesh(rbox(0.4, 0.07, 0.04, 0.02), glow("#ff2a2a", 1.6));
    tail.position.set(sx * (w / 2 - 0.3), body.position.y + bh * 0.22, -l / 2 - 0.005);
    g.add(head, tail);
  }
  const grille = new THREE.Mesh(rbox(w * 0.4, bh * 0.25, 0.04, 0.02), dark);
  grille.position.set(0, body.position.y - bh * 0.12, l / 2 + 0.01);
  g.add(grille);
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      (o as THREE.Mesh).castShadow = true;
    }
  });
  return g;
}

/** a soft round shadow on the floor under things, cheaper than a shadow map on low settings */
export function blobShadow(size = 1, opacity = 0.45) {
  const t = cachedTexture(
    "blob",
    (x, w, h) => {
      const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
    },
    128,
    128,
  );
  const m = new THREE.Mesh(plane(size, size), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.01;
  return m;
}

/** a cone of light (floodlights, street lamps): additive, brightest at the lamp, soft at its edges */
export function lightCone(color: string, strength = 0.22) {
  const k = `lc${color}|${strength}`;
  let m = matCache.get(k);
  if (!m) {
    m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
      vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
        void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uStrength; varying float vY; varying vec3 vN; varying vec3 vV;
        void main(){ float edge = pow(abs(dot(vN, vV)), 1.6); float a = edge * pow(vY, 1.4) * uStrength; gl_FragColor = vec4(uColor * a, a); }`,
    });
    matCache.set(k, m);
  }
  return m;
}
export function cone(r: number, l: number) {
  const k = `co${r}|${l}`;
  let g = geoCache.get(k);
  if (!g) {
    g = new THREE.ConeGeometry(r, l, 32, 1, true);
    geoCache.set(k, g);
  }
  return g;
}

// ---------- vehicles with proper shapes: a side profile pushed out to the car's width ----------
// (added for the showrooms and the garage; makeCar above stays as it was)
type P2 = [number, number];
interface BodySpec {
  L: number;
  W: number;
  r: number;
  front: number;
  rear: number;
  low: P2[];
  cab: P2[];
  wing?: boolean;
}
const BODIES: Record<string, BodySpec> = {
  hatch: { L: 4.0, W: 1.76, r: 0.33, front: 1.3, rear: -1.25, low: [[-2.0, 0.32], [-2.02, 0.95], [-1.9, 1.0], [1.0, 1.0], [1.85, 0.86], [2.0, 0.62], [1.96, 0.32]], cab: [[-1.85, 1.0], [-1.75, 1.42], [-1.3, 1.5], [0.3, 1.5], [1.0, 1.0]] },
  saloon: { L: 4.7, W: 1.82, r: 0.33, front: 1.45, rear: -1.4, low: [[-2.35, 0.3], [-2.36, 0.92], [-2.15, 0.98], [1.3, 0.98], [2.25, 0.8], [2.35, 0.58], [2.3, 0.3]], cab: [[-1.6, 0.98], [-0.85, 1.42], [0.5, 1.44], [1.3, 0.98]] },
  coupe: { L: 4.6, W: 1.9, r: 0.34, front: 1.4, rear: -1.35, low: [[-2.3, 0.3], [-2.32, 0.88], [-2.1, 0.94], [1.15, 0.92], [2.2, 0.74], [2.3, 0.52], [2.25, 0.3]], cab: [[-1.75, 0.94], [-0.6, 1.3], [0.35, 1.33], [1.15, 0.92]] },
  sports: { L: 4.5, W: 1.95, r: 0.34, front: 1.35, rear: -1.3, low: [[-2.25, 0.26], [-2.27, 0.84], [-2.0, 0.92], [0.95, 0.86], [2.1, 0.62], [2.25, 0.42], [2.2, 0.26]], cab: [[-1.4, 0.9], [-0.35, 1.2], [0.25, 1.22], [0.95, 0.86]] },
  suv: { L: 4.9, W: 1.98, r: 0.4, front: 1.5, rear: -1.45, low: [[-2.45, 0.4], [-2.46, 1.18], [-2.35, 1.22], [1.45, 1.2], [2.35, 1.08], [2.45, 0.85], [2.42, 0.4]], cab: [[-2.3, 1.22], [-2.2, 1.8], [1.0, 1.82], [1.45, 1.2]] },
  hyper: { L: 4.7, W: 2.04, r: 0.35, front: 1.4, rear: -1.4, low: [[-2.35, 0.22], [-2.37, 0.8], [-1.6, 0.9], [0.7, 0.84], [2.2, 0.5], [2.35, 0.36], [2.3, 0.22]], cab: [[-1.2, 0.88], [-0.3, 1.12], [0.2, 1.12], [0.75, 0.84]], wing: true },
  van: { L: 5.0, W: 2.0, r: 0.36, front: 1.6, rear: -1.55, low: [[-2.5, 0.36], [-2.5, 1.98], [0.9, 1.98], [0.9, 1.25], [1.75, 1.2], [2.4, 1.05], [2.5, 0.8], [2.45, 0.36]], cab: [[0.9, 1.25], [1.75, 1.2], [1.2, 1.98], [0.9, 1.98]] },
};
const paintCache = new Map<string, THREE.MeshPhysicalMaterial>();
/** car paint: a clear coat over the colour, cached by colour */
export function paint(colour: string) {
  let m = paintCache.get(colour);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({ color: colour, roughness: 0.32, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.06 });
    paintCache.set(colour, m);
  }
  return m;
}
/** an outline in the side view (u along the car, front at +u; v up) pushed out across the width, centred */
function sideSlab(pts: P2[], width: number, bevel = 0.05) {
  const s = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
  const g = new THREE.ExtrudeGeometry(s, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2);
  return g;
}
/** the lower body with the wheel arches cut out of its bottom edge */
function withArches(low: P2[], b: BodySpec): P2[] {
  const R = b.r + 0.06;
  const bottom = low[0][1];
  const out: P2[] = low.slice(0, -1).map((p) => [p[0], p[1]] as P2);
  const last = low[low.length - 1];
  out.push([last[0], last[1]]);
  for (const ax of [b.front, b.rear]) {
    out.push([ax + R, bottom]);
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI;
      out.push([ax + Math.cos(a) * R, Math.max(bottom, b.r + Math.sin(a) * R * 0.92)]);
    }
    out.push([ax - R, bottom]);
  }
  return out;
}
function mergeParts(parts: { g: THREE.BufferGeometry; m: THREE.Material }[]) {
  const by = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const p of parts) {
    const g = p.g.index ? p.g.toNonIndexed() : p.g;
    for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.clearGroups();
    if (!by.has(p.m)) by.set(p.m, []);
    by.get(p.m)!.push(g);
  }
  const grp = new THREE.Group();
  for (const [m, gs] of by) {
    const n = gs.reduce((s, g) => s + g.attributes.position.count, 0);
    const merged = new THREE.BufferGeometry();
    for (const name of ["position", "normal", "uv"]) {
      const size = name === "uv" ? 2 : 3;
      const arr = new Float32Array(n * size);
      let o = 0;
      for (const g of gs) {
        arr.set(g.attributes[name].array as Float32Array, o);
        o += g.attributes.position.count * size;
      }
      merged.setAttribute(name, new THREE.Float32BufferAttribute(arr, size));
    }
    merged.computeBoundingSphere();
    gs.forEach((g) => g.dispose());
    const me = new THREE.Mesh(merged, m);
    me.castShadow = true;
    me.receiveShadow = true;
    grp.add(me);
  }
  grp.userData.dispose = () => grp.traverse((o) => (o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.dispose());
  return grp;
}
const at = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
  return g;
};
/**
 * A vehicle by body type, the front facing +z: hatch, saloon, coupe, sports, suv, hyper, van, a superbike, a
 * motor scooter, or an electric kick scooter (a scooter whose model says so). Every part sharing a material is
 * merged, so a car is about seven draw calls. userData.dispose() frees its geometry.
 */
export function makeVehicle(c: { body: string; colour: string; brand?: string; model?: string }) {
  const P = paint(c.colour);
  const dark = mat("#0b0d10", { rough: 0.55 });
  const tyre = mat("#121315", { rough: 0.92 });
  const rim = mat("#b9bec4", { rough: 0.22, metal: 1 });
  const win = mat("#2a3646", { rough: 0.08, metal: 0.7 });
  const head = glow("#fff6e0", 2.4);
  const tail = glow("#ff2a2a", 1.8);
  const parts: { g: THREE.BufferGeometry; m: THREE.Material }[] = [];
  const add = (g: THREE.BufferGeometry, m: THREE.Material) => parts.push({ g, m });
  const wheel = (x: number, y: number, z: number, r: number, w: number) => {
    add(at(new THREE.CylinderGeometry(r, r, w, 20), x, y, z, 0, 0, Math.PI / 2), tyre);
    add(at(new THREE.CylinderGeometry(r * 0.62, r * 0.62, w + 0.012, 12), x, y, z, 0, 0, Math.PI / 2), rim);
  };
  if (c.body === "bike" || c.body === "scooter") {
    const kick = c.body === "scooter" && /electric|kick|xiaomi|segway/i.test((c.brand || "") + " " + (c.model || ""));
    if (kick) {
      add(at(new THREE.BoxGeometry(0.16, 0.05, 0.85), 0, 0.14, 0), P);
      add(at(new THREE.CylinderGeometry(0.02, 0.02, 1.05, 8), 0, 0.68, 0.42, -0.12), dark);
      add(at(new THREE.CylinderGeometry(0.015, 0.015, 0.48, 8), 0, 1.2, 0.48, 0, 0, Math.PI / 2), dark);
      for (const z of [0.42, -0.42]) wheel(0, 0.12, z, 0.12, 0.06);
      add(at(new THREE.BoxGeometry(0.06, 0.03, 0.03), 0, 1.0, 0.56), head);
    } else if (c.body === "scooter") {
      add(at(new THREE.BoxGeometry(0.34, 0.08, 0.7), 0, 0.3, 0.05), P);
      add(at(new THREE.BoxGeometry(0.38, 0.75, 0.12), 0, 0.68, 0.48, -0.18), P);
      const back = new THREE.SphereGeometry(0.32, 14, 10);
      back.scale(0.9, 0.75, 1.3);
      add(at(back, 0, 0.55, -0.45), P);
      add(at(new THREE.BoxGeometry(0.3, 0.1, 0.6), 0, 0.82, -0.38), dark);
      add(at(new THREE.CylinderGeometry(0.018, 0.018, 0.62, 8), 0, 1.08, 0.58, 0, 0, Math.PI / 2), dark);
      add(at(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12), 0, 1.02, 0.63, Math.PI / 2), head);
      for (const z of [0.6, -0.55]) wheel(0, 0.22, z, 0.22, 0.12);
    } else {
      // a superbike: wheels, a fairing, the tank, a seat, the tail
      for (const z of [0.72, -0.72]) wheel(0, 0.31, z, 0.31, 0.16);
      add(at(sideSlab([[0.95, 0.42], [1.02, 0.78], [0.72, 1.05], [0.25, 0.95], [0.28, 0.5]], 0.38, 0.06), 0, 0, 0), P);
      add(at(sideSlab([[0.3, 0.86], [0.25, 1.02], [-0.25, 1.0], [-0.35, 0.86]], 0.34, 0.06), 0, 0, 0), P);
      add(at(sideSlab([[-0.3, 0.88], [-0.35, 0.98], [-0.95, 1.08], [-1.0, 0.98], [-0.7, 0.86]], 0.24, 0.04), 0, 0, 0), P);
      add(at(new THREE.BoxGeometry(0.22, 0.06, 0.4), 0, 0.98, -0.45), dark);
      add(at(new THREE.BoxGeometry(0.16, 0.36, 0.6), 0, 0.55, 0.0, 0.3), dark);
      add(at(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8), 0.1, 0.62, 0.72, -0.45), rim);
      add(at(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8), -0.1, 0.62, 0.72, -0.45), rim);
      add(at(new THREE.CylinderGeometry(0.05, 0.06, 0.55, 10), 0.14, 0.45, -0.5, Math.PI / 2 - 0.3), rim);
      add(at(new THREE.CylinderGeometry(0.015, 0.015, 0.56, 8), 0, 1.02, 0.6, 0, 0, Math.PI / 2), dark);
      add(at(new THREE.BoxGeometry(0.16, 0.06, 0.04), 0, 0.82, 1.0), head);
      add(at(new THREE.BoxGeometry(0.12, 0.04, 0.03), 0, 1.0, -1.0), tail);
      add(at(new THREE.BoxGeometry(0.14, 0.14, 0.1), 0, 1.04, 0.66, -0.4), win);
    }
    return mergeParts(parts);
  }
  const b = BODIES[c.body] || BODIES.saloon;
  // round the box off: the sides lean in above the waist, the glasshouse leans in more, the nose and tail
  // narrow in plan, so it reads as a car and not a crate
  const belt = b.cab[0][1];
  const shape = (g: THREE.BufferGeometry, lean: number, from: number) => {
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i),
        z = pos.getZ(i);
      let k = 1 - Math.max(0, y - from) * lean;
      const end = Math.abs(z) - (b.L / 2 - 0.55);
      if (end > 0) k *= 1 - end * 0.28;
      pos.setX(i, pos.getX(i) * k);
    }
    g.computeVertexNormals();
    return g;
  };
  add(shape(sideSlab(withArches(b.low, b), b.W, 0.06), 0.35, belt - 0.22), P);
  add(shape(sideSlab(b.cab, b.W * (c.body === "van" ? 0.98 : 0.86), 0.05), c.body === "van" ? 0.05 : 0.42, belt), win);
  // the roof over the glass
  const top = b.cab.reduce((m, p) => Math.max(m, p[1]), 0);
  const roofPts = b.cab.filter((p) => p[1] > top - 0.05);
  if (roofPts.length >= 2) {
    const u0 = Math.min(...roofPts.map((p) => p[0])),
      u1 = Math.max(...roofPts.map((p) => p[0]));
    add(at(new THREE.BoxGeometry(b.W * (c.body === "van" ? 0.9 : 0.66), 0.05, u1 - u0 + 0.04), 0, top + 0.03, (u0 + u1) / 2), P);
  }
  if (b.wing) {
    add(at(new THREE.BoxGeometry(b.W * 0.92, 0.04, 0.34), 0, 1.12, -2.1), P);
    for (const sx of [-0.5, 0.5]) add(at(new THREE.BoxGeometry(0.04, 0.24, 0.12), sx, 0.98, -2.1), dark);
  }
  const fy = b.low.find((p) => p[0] === Math.max(...b.low.map((q) => q[0])))![1] + 0.12;
  const frontU = Math.max(...b.low.map((q) => q[0]));
  const rearU = Math.min(...b.low.map((q) => q[0]));
  for (const sx of [-1, 1]) {
    add(at(new THREE.BoxGeometry(0.34, 0.07, 0.05), sx * (b.W / 2 - 0.3), fy + 0.08, frontU - 0.04, 0.3), head);
    add(at(new THREE.BoxGeometry(0.38, 0.06, 0.05), sx * (b.W / 2 - 0.28), b.low[1][1] - 0.12, rearU + 0.01), tail);
    // a mirror
    add(at(new THREE.BoxGeometry(0.16, 0.1, 0.08), sx * (b.W / 2 + 0.04), b.cab[0][1] + 0.12, b.cab[b.cab.length - 1][0] - 0.25), P);
  }
  add(at(new THREE.BoxGeometry(b.W * 0.44, 0.16, 0.05), 0, fy - 0.12, frontU - 0.02), dark);
  add(at(new THREE.BoxGeometry(b.W * 0.86, 0.08, b.L * 0.86), 0, b.low[0][1] + 0.02, 0), dark);
  for (const sx of [-1, 1]) for (const ax of [b.front, b.rear]) wheel(sx * (b.W / 2 - 0.13), b.r, ax, b.r, 0.26);
  return mergeParts(parts);
}

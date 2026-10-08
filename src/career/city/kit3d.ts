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

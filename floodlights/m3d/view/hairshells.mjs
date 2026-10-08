// Close up hair as shells: the scalp copied outwards in thin layers, and a shader that cuts each layer into
// thousands of tapered strands, longer where the style is long, combed along the style's flow, curled for curly
// styles, darker at the roots. Alpha tested (never blended), so it sorts itself and stays cheap.
// The mesh is built in the head bone's own space: parent it to the head bone and it follows every movement.
import { sculpt, faceShape, hairCoverage, hairStyleOf, headFrame } from "./hero.mjs";

const HAIR_COL = ["#151110", "#2a1d15", "#4a3222", "#6e4a2c", "#a87a46", "#d2b07a", "#8b8b8b", "#e9e1c8", "#a4512c", "#5a1f1a", "#c9cbd3", "#2f4fa8", "#d9d9d9"];

// look: the creator's look; h: height in metres; opts: { layers, headY (the head bone's rest height) }
export function makeHairShells(THREE, look, h, opts) {
  const St = hairStyleOf(look.hair);
  if (!St || !St.len || St.name === "bald" || St.rows || St.locs) return null;
  const layers = Math.max(4, (opts && opts.layers) || 16);
  const headY = (opts && opts.headY !== undefined) ? opts.headY : 0.895 * h;
  const F = faceShape(look);
  const fr = headFrame(h);
  const cov = hairCoverage(look.hair, look.hairline);
  const latN = 46, lonN = 84, phiMax = Math.PI * 0.78;
  const vertsPer = (latN + 1) * (lonN + 1);
  const pos = new Float32Array(vertsPer * layers * 3);
  const uv = new Float32Array(vertsPer * layers * 2);
  const lay = new Float32Array(vertsPer * layers);
  const cv = new Float32Array(vertsPer * layers);
  const idx = [];
  const maxLen = St.len * fr.ry;
  const flow = St.flow;
  let k = 0;
  for (let L = 0; L < layers; L++) {
    const t = L / (layers - 1);
    for (let i = 0; i <= latN; i++) {
      const phi = (i / latN) * phiMax;
      for (let j = 0; j <= lonN; j++) {
        const th = (j / lonN) * Math.PI * 2;
        const x = Math.sin(phi) * Math.cos(th), y = Math.cos(phi), z = Math.sin(phi) * Math.sin(th);
        const [px, py, pz] = sculpt(x, y, z, F);
        const c = cov(x, y, z);
        // the outward normal of the head there, and the comb direction laid flat on it
        let nx = px / fr.rx, ny = py / fr.ry, nz = pz / fr.rz;
        const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        let fx = flow[0] * (St.part ? Math.sign(x || 1) * -1 : 1), fy = flow[1], fz = flow[2];
        // a fringe lies forward over the brow; a quiff stands up at the front only
        if (St.fringe && z > 0.2) { fx = 0; fy = -0.4; fz = 1; }
        if (St.quiff && z < 0.2) { fx = 0; fy = 0.2; fz = -1; }
        const fd = fx * nx + fy * ny + fz * nz;
        fx -= nx * fd; fy -= ny * fd; fz -= nz * fd;
        const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
        const len = maxLen * c;
        const out = 0.0012 * h + len * t * (St.puff ? 1 : 0.55);
        const comb = St.puff ? 0 : len * t * t * 0.8;
        pos[k * 3] = fr.cx + px * fr.rx + nx * out + fx * comb;
        pos[k * 3 + 1] = fr.cy + py * fr.ry + ny * out + fy * comb - headY;
        pos[k * 3 + 2] = fr.cz + pz * fr.rz + nz * out + fz * comb;
        uv[k * 2] = j / lonN; uv[k * 2 + 1] = i / latN;
        lay[k] = t; cv[k] = c;
        k++;
      }
    }
    const base = L * vertsPer, row = lonN + 1;
    for (let i = 0; i < latN; i++) for (let j = 0; j < lonN; j++) {
      const a = base + i * row + j, b = a + 1, c2 = a + row, d = b + row;
      idx.push(a, b, c2, b, d, c2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setAttribute("aLayer", new THREE.BufferAttribute(lay, 1));
  geo.setAttribute("aCov", new THREE.BufferAttribute(cv, 1));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const col = new THREE.Color(HAIR_COL[(look.hairCol || 0) % HAIR_COL.length]);
  const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: 0 });
  const curl = St.curl;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uCurl = { value: curl };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aLayer;\nattribute float aCov;\nvarying float vLayer;\nvarying float vCov;\nvarying vec2 vHairUv;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLayer = aLayer;\nvCov = aCov;\nvHairUv = uv;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
uniform float uCurl;
varying float vLayer;
varying float vCov;
varying vec2 vHairUv;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`)
      .replace("#include <color_fragment>", `#include <color_fragment>
{
  float t = vLayer;
  // a ragged, natural edge rather than the mesh's own steps
  float edgeN = h21(floor(vHairUv * vec2(700.0, 380.0)) + 5.0);
  if (vCov < 0.015 + edgeN * 0.06) discard;
  vec2 g = vHairUv * vec2(300.0, 160.0);
  // curls wander the strand across its cell as it grows out
  g += vec2(sin(t * 7.0 + g.y * 0.35), cos(t * 6.0 + g.x * 0.27)) * uCurl * t * 1.4;
  vec2 cell = floor(g);
  vec2 f = fract(g) - 0.5 - (vec2(h21(cell), h21(cell + 17.0)) - 0.5) * 0.5;
  float r = h21(cell + 3.0);
  // clumps: neighbouring strands share a little of their length
  float clump = h21(floor(g / 4.0) + 9.0);
  float reach = vCov * (0.45 + 0.35 * r + 0.2 * clump);
  float rad = mix(0.5, 0.14, t / max(reach, 0.05));
  // very short hair (a fade, the edges of a buzz) is stubble: fine scattered specks, lighter than real hair
  if (t == 0.0 && vCov < 0.14) {
    vec2 sg = vHairUv * vec2(1400.0, 760.0);
    vec2 sf = fract(sg) - 0.5;
    if (h21(floor(sg)) > vCov * 5.0 || length(sf) > 0.34) discard;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55), 0.25);
  }
  if (t > 0.0 && (t > reach || length(f) > rad)) discard;
  diffuseColor.rgb *= mix(0.32, 1.08, t) * (0.82 + 0.3 * r);
}`);
  };
  mat.customProgramCacheKey = () => "flhair";
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return { mesh, dispose: () => { geo.dispose(); mat.dispose(); } };
}

// the scalp under the hair, painted into the face texture: dense dark roots where hair is long, a light stubble
// shadow where it is shaved (draw this over the face canvas with "multiply")
export function paintScalp(doc, look, size) {
  const W = size || 512, H = W / 2;
  const cv = doc.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  if (!g) return null;
  const img = g.createImageData(W, H);
  const cov = hairCoverage(look.hair, look.hairline);
  const St = hairStyleOf(look.hair);
  const hc = new THREE_COLOR(HAIR_COL[(look.hairCol || 0) % HAIR_COL.length]);
  for (let py = 0; py < H; py++) {
    const phi = (py / H) * Math.PI;
    for (let px = 0; px < W; px++) {
      const th = (px / W) * Math.PI * 2;
      const x = Math.sin(phi) * Math.cos(th), y = Math.cos(phi), z = Math.sin(phi) * Math.sin(th);
      const c = St.name === "bald" ? 0 : cov(x, y, z);
      const a = c <= 0 ? 0 : c < 0.14 ? c * 3.2 : Math.min(0.9, 0.45 + c * 1.3);
      const i = (py * W + px) * 4;
      // multiply: white leaves the skin alone, the hair colour darkens it
      img.data[i] = Math.round(255 * (1 - a + a * hc[0] * 0.8));
      img.data[i + 1] = Math.round(255 * (1 - a + a * hc[1] * 0.8));
      img.data[i + 2] = Math.round(255 * (1 - a + a * hc[2] * 0.8));
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return cv;
}
function THREE_COLOR(hex) { const n = parseInt(hex.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }

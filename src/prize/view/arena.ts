/**
 * The arena: a bright ring in a dark hall. The canvas sits at y = 0 (its centre is the world origin); the hall floor
 * is 1.2 m below. Built once per fight from shapes and painted canvases (no image files): the canvas with the
 * PRIZE FIGHTER logo, the apron and the skirt, four posts with padded turnbuckles (red, blue and the two white
 * neutral corners), four sagging ropes a side, the press row, the aisle to the red corner, the light rig with its
 * lamps, haze cones under the lamps and dust drifting in the light. Ropes give when a boxer is pushed onto them.
 */
import * as THREE from "three";
import { RING } from "../engine/rules";

export const FLOOR_Y = -1.2;
export const POST = RING + 0.28;
export const ROPE_H = [0.46, 0.78, 1.1, 1.4];
/** corners in world x, z: red (the person's), blue, and the two neutral ones */
export const CORNERS = { red: new THREE.Vector3(-POST, 0, -POST), blue: new THREE.Vector3(POST, 0, POST), n1: new THREE.Vector3(-POST, 0, POST), n2: new THREE.Vector3(POST, 0, -POST) };

export interface ArenaOpts {
  quality: number;
  accent: string;
}

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

function canvasTex(w: number, h: number, paint: (g: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const g = cv.getContext("2d");
  if (!g) return null;
  paint(g, w, h);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** the canvas: off white with a fine weave, the logo in the middle, dark apron round the edge */
function paintCanvas(g: CanvasRenderingContext2D, W: number, H: number, accent: string) {
  const inner = W * (RING * 2) / ((RING + 0.62) * 2);
  const off = (W - inner) / 2;
  g.fillStyle = "#121318";
  g.fillRect(0, 0, W, H);
  const grd = g.createRadialGradient(W / 2, H / 2, inner * 0.1, W / 2, H / 2, inner * 0.72);
  grd.addColorStop(0, "#eceae3");
  grd.addColorStop(1, "#d6d3ca");
  g.fillStyle = grd;
  g.fillRect(off, off, inner, inner);
  // weave
  const img = g.getImageData(off, off, inner, inner);
  for (let i = 0; i < img.data.length; i += 4) {
    const px = (i / 4) % inner, py = Math.floor(i / 4 / inner);
    const n = ((px * 7 + py * 13) % 5) - 2 + (Math.random() - 0.5) * 6;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, off, off);
  // scuffs where the boxers work
  g.globalAlpha = 0.06;
  for (let k = 0; k < 140; k++) {
    g.fillStyle = "#5a5650";
    const r = 4 + Math.random() * 30;
    g.beginPath();
    g.ellipse(off + inner * (0.2 + Math.random() * 0.6), off + inner * (0.2 + Math.random() * 0.6), r, r * (0.3 + Math.random() * 0.4), Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  // the logo: PRIZE FIGHTER in the middle, a ring of the accent round it
  g.save();
  g.translate(W / 2, H / 2);
  g.strokeStyle = accent;
  g.globalAlpha = 0.85;
  g.lineWidth = W * 0.006;
  g.beginPath();
  g.arc(0, 0, inner * 0.2, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = W * 0.002;
  g.beginPath();
  g.arc(0, 0, inner * 0.215, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 0.9;
  g.fillStyle = "#16171c";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `700 ${Math.round(W * 0.055)}px "Chakra Petch", "Inter", Arial, sans-serif`;
  g.fillText("PRIZE", 0, -W * 0.03);
  g.fillStyle = accent;
  g.fillText("FIGHTER", 0, W * 0.03);
  g.restore();
  // apron lettering
  g.save();
  g.fillStyle = "rgba(255,255,255,0.75)";
  g.font = `700 ${Math.round(W * 0.022)}px "Chakra Petch", "Inter", Arial, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (let k = 0; k < 4; k++) {
    g.save();
    g.translate(W / 2, H / 2);
    g.rotate((k * Math.PI) / 2);
    g.fillText("BE-A-MANAGER  ·  PRIZE FIGHTER", 0, -(inner / 2 + off / 2));
    g.restore();
  }
  g.restore();
}

/** the skirt: dark cloth with an accent band and the name */
function paintSkirt(g: CanvasRenderingContext2D, W: number, H: number, accent: string) {
  g.fillStyle = "#0d0e12";
  g.fillRect(0, 0, W, H);
  g.fillStyle = accent;
  g.fillRect(0, H * 0.08, W, H * 0.06);
  g.fillStyle = "rgba(255,255,255,0.9)";
  g.font = `700 ${Math.round(H * 0.32)}px "Chakra Petch", "Inter", Arial, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("PRIZE FIGHTER", W / 2, H * 0.55);
}

/** a soft round glow for the lamps and flashes */
export function glowTexture(): THREE.Texture | null {
  return canvasTex(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.2, "rgba(255,250,235,0.65)");
    grd.addColorStop(0.5, "rgba(255,240,210,0.15)");
    grd.addColorStop(1, "rgba(255,240,210,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }, false);
}

export class Arena {
  readonly group = new THREE.Group();
  readonly lights: THREE.Light[] = [];
  readonly key: THREE.SpotLight;
  private ropes: { mesh: THREE.Mesh; a: THREE.Vector3; b: THREE.Vector3; y: number; side: number; push: number; v: number }[] = [];
  private dust: THREE.Points | null = null;
  private haze: THREE.Mesh[] = [];
  private disposables: { dispose: () => void }[] = [];
  private hazeMat: THREE.ShaderMaterial;

  constructor(private opts: ArenaOpts) {
    const q = opts.quality;
    const accent = opts.accent;
    const G = this.group;
    // ---- the platform: canvas, apron and skirt
    const cTex = canvasTex(q >= 2 ? 2048 : 1024, q >= 2 ? 2048 : 1024, (g, w, h) => paintCanvas(g, w, h, accent));
    const size = (RING + 0.62) * 2;
    const canvasMat = new THREE.MeshStandardMaterial({ map: cTex, roughness: 0.92, metalness: 0, color: cTex ? 0xffffff : 0xdedbd2 });
    const top = new THREE.Mesh(new THREE.PlaneGeometry(size, size), canvasMat);
    top.rotation.x = -Math.PI / 2;
    top.receiveShadow = true;
    G.add(top);
    const sTex = canvasTex(1024, 128, (g, w, h) => paintSkirt(g, w, h, accent));
    const skirtMat = new THREE.MeshStandardMaterial({ map: sTex, roughness: 0.9, color: sTex ? 0xffffff : 0x111111 });
    for (let k = 0; k < 4; k++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(size, -FLOOR_Y), skirtMat);
      const ang = (k * Math.PI) / 2;
      s.position.set(Math.sin(ang) * size / 2, FLOOR_Y / 2, Math.cos(ang) * size / 2);
      s.rotation.y = ang;
      G.add(s);
    }
    // ---- posts and turnbuckle pads
    const postGeo = new THREE.CylinderGeometry(0.055, 0.06, 1.62, 16);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.85, roughness: 0.3 });
    const padGeo = new THREE.BoxGeometry(0.2, 1.22, 0.2, 1, 6, 1);
    {
      // round the pad's edges a little
      const p = padGeo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        const r = Math.hypot(x, z);
        if (r > 0.12) { p.setX(i, x * 0.92); p.setZ(i, z * 0.92); }
      }
      padGeo.computeVertexNormals();
    }
    const padCol: Record<string, number> = { red: 0xc8102e, blue: 0x1b3fa0, n1: 0xeeeeee, n2: 0xeeeeee };
    for (const [name, c] of Object.entries(CORNERS)) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(c.x, 0.81, c.z);
      post.castShadow = q >= 2;
      G.add(post);
      const pad = new THREE.Mesh(padGeo, new THREE.MeshPhysicalMaterial({ color: padCol[name], roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 }));
      pad.position.set(c.x - Math.sign(c.x) * 0.08, 0.93, c.z - Math.sign(c.z) * 0.08);
      pad.rotation.y = Math.PI / 4;
      G.add(pad);
      this.disposables.push(pad.material as THREE.Material);
    }
    // ---- ropes: top and bottom in the accent, the middle two white; each side sags a little
    const ropeMats = [new THREE.MeshPhysicalMaterial({ color: accent, roughness: 0.4, clearcoat: 0.5 }), new THREE.MeshPhysicalMaterial({ color: 0xf2f2f2, roughness: 0.45, clearcoat: 0.4 })];
    const cs = [CORNERS.red, CORNERS.n2, CORNERS.blue, CORNERS.n1];
    for (let s = 0; s < 4; s++) {
      const a = cs[s], b = cs[(s + 1) % 4];
      for (let r = 0; r < 4; r++) {
        const y = ROPE_H[r];
        const mesh = new THREE.Mesh(this.ropeGeo(a, b, y, 0), ropeMats[r === 0 || r === 3 ? 0 : 1]);
        mesh.castShadow = q >= 2;
        G.add(mesh);
        this.ropes.push({ mesh, a: a.clone(), b: b.clone(), y, side: s, push: 0, v: 0 });
      }
    }
    this.disposables.push(...ropeMats, canvasMat, skirtMat, postGeo, postMat, padGeo);
    if (cTex) this.disposables.push(cTex);
    if (sTex) this.disposables.push(sTex);
    // ---- the hall floor, the aisle and the press row
    const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshStandardMaterial({ color: 0x07080b, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = FLOOR_Y;
    floor.receiveShadow = true;
    G.add(floor);
    this.disposables.push(floor.geometry, floor.material as THREE.Material);
    // the aisle from the tunnel to the red corner, with a lit strip each side
    const aisleDir = new THREE.Vector3(-1, 0, -1).normalize();
    const aisle = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 22), new THREE.MeshStandardMaterial({ color: 0x15161b, roughness: 0.8 }));
    aisle.rotation.x = -Math.PI / 2;
    aisle.rotation.z = Math.PI / 4;
    aisle.position.set(aisleDir.x * 15, FLOOR_Y + 0.01, aisleDir.z * 15);
    G.add(aisle);
    const stripMat = new THREE.MeshBasicMaterial({ color: accent });
    for (const sgn of [1, -1]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 22), stripMat);
      strip.rotation.x = -Math.PI / 2;
      strip.rotation.z = Math.PI / 4;
      const perp = new THREE.Vector3(1, 0, -1).normalize().multiplyScalar(1.12 * sgn);
      strip.position.set(aisleDir.x * 15 + perp.x, FLOOR_Y + 0.02, aisleDir.z * 15 + perp.z);
      G.add(strip);
      this.disposables.push(strip.geometry);
    }
    this.disposables.push(aisle.geometry, aisle.material as THREE.Material, stripMat);
    // ringside tables: a dark run of tables with glowing laptop screens along two sides
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x101116, roughness: 0.7 });
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x5a6a8a });
    const tableGeo = new THREE.BoxGeometry(8, 0.75, 0.8);
    const screenGeo = new THREE.PlaneGeometry(0.34, 0.22);
    for (const [x, z, ry] of [[0, RING + 2.3, 0], [RING + 2.3, 0, Math.PI / 2]] as [number, number, number][]) {
      const tbl = new THREE.Mesh(tableGeo, tableMat);
      tbl.position.set(x, FLOOR_Y + 0.375, z);
      tbl.rotation.y = ry;
      G.add(tbl);
      for (let k = -3; k <= 3; k++) {
        const sc = new THREE.Mesh(screenGeo, screenMat);
        const along = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
        sc.position.set(x + along.x * k * 1.1, FLOOR_Y + 0.88, z + along.z * k * 1.1);
        sc.lookAt(0, FLOOR_Y + 0.9, 0);
        sc.rotateY(Math.PI);
        G.add(sc);
      }
    }
    this.disposables.push(tableMat, screenMat, tableGeo, screenGeo);

    // ---- lights: one key over the ring (the shadow), four spots from the rig corners, a dim hall
    const hemi = new THREE.HemisphereLight(0x2a3550, 0x050507, 0.5);
    G.add(hemi);
    this.lights.push(hemi);
    const key = new THREE.SpotLight(0xfff3e0, 190, 22, Math.PI / 5.2, 0.45, 1.6);
    key.position.set(0, 9, 0);
    key.target.position.set(0, 0, 0);
    key.castShadow = q >= 1;
    key.shadow.mapSize.set(q >= 3 ? 4096 : q >= 2 ? 2048 : 1024, q >= 3 ? 4096 : q >= 2 ? 2048 : 1024);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.camera.near = 3;
    key.shadow.camera.far = 14;
    G.add(key, key.target);
    this.key = key;
    this.lights.push(key);
    const rig = 4.6;
    const cornersW: [number, number][] = [[rig, rig], [-rig, rig], [rig, -rig], [-rig, -rig]];
    for (const [x, z] of cornersW) {
      const s = new THREE.SpotLight(0xe8f0ff, q >= 3 ? 70 : 60, 18, Math.PI / 6.5, 0.6, 1.7);
      s.position.set(x, 7.5, z);
      s.target.position.set(x * 0.08, 0.9, z * 0.08);
      G.add(s, s.target);
      this.lights.push(s);
    }
    // the lamp heads on the rig: a square truss of glowing panels over the ring
    const glow = glowTexture();
    if (glow) this.disposables.push(glow);
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x1a1c22, metalness: 0.7, roughness: 0.45 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfffbf0 });
    const trussGeo = new THREE.BoxGeometry(2 * rig + 0.4, 0.25, 0.25);
    for (let k = 0; k < 4; k++) {
      const t = new THREE.Mesh(trussGeo, trussMat);
      const ang = (k * Math.PI) / 2;
      t.position.set(Math.sin(ang) * rig, 8, Math.cos(ang) * rig);
      t.rotation.y = ang + Math.PI / 2;
      G.add(t);
    }
    const lampGeo = new THREE.CircleGeometry(0.16, 20);
    const spriteMat = glow ? new THREE.SpriteMaterial({ map: glow, color: 0xfff4dc, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }) : null;
    for (let k = 0; k < 4; k++) {
      for (let j = -3; j <= 3; j++) {
        const ang = (k * Math.PI) / 2;
        const along = new THREE.Vector3(Math.cos(ang), 0, -Math.sin(ang));
        const p = new THREE.Vector3(Math.sin(ang) * rig, 7.85, Math.cos(ang) * rig).addScaledVector(along, j * 1.2);
        const lamp = new THREE.Mesh(lampGeo, lampMat);
        lamp.position.copy(p);
        lamp.lookAt(0, 0, 0);
        G.add(lamp);
        if (spriteMat) {
          const sp = new THREE.Sprite(spriteMat);
          sp.position.copy(p);
          sp.scale.setScalar(1.6);
          G.add(sp);
        }
      }
    }
    this.disposables.push(trussMat, lampMat, trussGeo, lampGeo);
    if (spriteMat) this.disposables.push(spriteMat);

    // ---- haze: soft cones of light under the key and the corner spots
    this.hazeMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uStrength: { value: q >= 2 ? 0.16 : 0.11 }, uColor: { value: new THREE.Color(0xfff2dc) } },
      vertexShader: `
        varying vec3 vPos; varying vec3 vN; varying vec3 vView; varying float vH;
        void main(){
          vec4 wp = modelMatrix * vec4(position,1.0);
          vPos = wp.xyz; vH = uv.y;
          vN = normalize(mat3(modelMatrix) * normal);
          vView = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        uniform float uTime; uniform float uStrength; uniform vec3 uColor;
        varying vec3 vPos; varying vec3 vN; varying vec3 vView; varying float vH;
        float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
        float noise(vec3 p){ vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
          float n = mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                        mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
          return n; }
        void main(){
          // brighter where the surface faces the eye (the middle of the cone), fading to the edges and the floor
          float facing = pow(abs(dot(normalize(vN), normalize(vView))), 1.6);
          float fall = smoothstep(0.0, 0.35, vH) * (0.35 + 0.65 * vH);
          float n = 0.65 + 0.35 * noise(vPos * 0.9 + vec3(0.0, uTime * 0.06, uTime * 0.03));
          float a = facing * fall * n * uStrength;
          gl_FragColor = vec4(uColor * a, a);
        }`,
    });
    const cone = (from: THREE.Vector3, to: THREE.Vector3, r0: number, r1: number) => {
      const len = from.distanceTo(to);
      const geo = new THREE.CylinderGeometry(r0, r1, len, 32, 1, true);
      geo.translate(0, -len / 2, 0);
      const m = new THREE.Mesh(geo, this.hazeMat);
      m.position.copy(from);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize());
      m.renderOrder = 5;
      G.add(m);
      this.haze.push(m);
      this.disposables.push(geo);
    };
    cone(new THREE.Vector3(0, 8.7, 0), new THREE.Vector3(0, -0.2, 0), 0.5, 4.2);
    for (const [x, z] of cornersW) cone(new THREE.Vector3(x, 7.4, z), new THREE.Vector3(x * 0.12, -0.1, z * 0.12), 0.18, 1.5);
    this.disposables.push(this.hazeMat);
    // ---- dust drifting in the light (high and ultra)
    if (q >= 2 && glow) {
      const n = q >= 3 ? 900 : 450;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const r = Math.sqrt(Math.random()) * 3.4, a = Math.random() * Math.PI * 2;
        pos[i * 3] = Math.cos(a) * r;
        pos[i * 3 + 1] = 0.3 + Math.random() * 6.5;
        pos[i * 3 + 2] = Math.sin(a) * r;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ map: glow, size: 0.035, color: 0xfff1d8, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
      this.dust = new THREE.Points(geo, mat);
      G.add(this.dust);
      this.disposables.push(geo, mat);
    }
    // the hall itself: a dark dome so the far crowd fades into it
    const dome = new THREE.Mesh(new THREE.SphereGeometry(70, 32, 16), new THREE.MeshBasicMaterial({ color: 0x030407, side: THREE.BackSide, fog: false }));
    G.add(dome);
    this.disposables.push(dome.geometry, dome.material as THREE.Material);
  }

  /** one rope between two posts at a height, sagging, pushed outward by `push` metres at the middle */
  private ropeGeo(a: THREE.Vector3, b: THREE.Vector3, y: number, push: number) {
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const out = mid.clone().setY(0).normalize();
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const p = a.clone().lerp(b, t);
      const bow = Math.sin(t * Math.PI);
      p.y = y - bow * 0.03;
      p.addScaledVector(out, bow * push);
      pts.push(p);
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.024, 8, false);
  }

  /** each frame: dust, haze, and ropes that give under a boxer leaning on them (positions in world x, z) */
  update(t: number, dt: number, bodies: { x: number; z: number }[]) {
    this.hazeMat.uniforms.uTime.value = t;
    if (this.dust) {
      this.dust.rotation.y = t * 0.012;
      this.dust.position.y = Math.sin(t * 0.1) * 0.15;
    }
    for (const r of this.ropes) {
      // how hard a boxer leans on this side
      let want = 0;
      for (const b of bodies) {
        const d = r.side === 0 ? b.z + RING : r.side === 1 ? RING - b.x : r.side === 2 ? RING - b.z : b.x + RING;
        if (d < 0.42 && r.y < 1.3) want = Math.max(want, (0.42 - d) * 0.5);
      }
      const k = 60, c = 9;
      r.v += (-(r.push - want) * k - r.v * c) * dt;
      r.push += r.v * dt;
      if (Math.abs(r.push) > 0.002 || Math.abs(r.v) > 0.01) {
        r.mesh.geometry.dispose();
        r.mesh.geometry = this.ropeGeo(r.a, r.b, r.y, r.push);
      }
    }
  }

  dispose() {
    for (const r of this.ropes) r.mesh.geometry.dispose();
    for (const d of this.disposables) d.dispose();
  }
}

export { lin };

// Floodlights playable match, the 3D look.
// The game itself lives in match_sim3d.mjs (the deep sim) or match.js (Classic sim). This file only draws
// what the sim says: a floodlit pitch with mow lines and real shadows, two goals with nets that bulge on a
// goal, 22 jointed low poly players with shirt numbers, skin and hair variants, the ball, a stadium bowl with
// a crowd, and a smoothed TV camera that pulls in on goals. It also owns the match HUD (DOM, in the site
// design language) and the name tags drawn on the 2D canvas above the scene.
//
// The look follows Hardwood Legends in Front Office: ACES tone mapping, night colours, a hemisphere light
// plus one shadow casting key light, procedural canvas textures, instanced crowd, smoothed camera.
//
// three.js is passed in, never imported here, so the same file runs in the browser (real renderer) and in
// node tests (stub renderer, no document).
//
// Axes: the sim uses x (goal to goal) and y (touchline to touchline) on the ground and z for height.
// In the scene that is x, z and y. The camera stands on the +y touchline, so "up the screen" is minus y
// and the controls feel exactly like the classic top down view.

export function createView3D(THREE, opts) {
  const FL = opts.FL;
  const D = FL.DIMS;
  const wrap = opts.wrap || null;
  const hud = opts.canvas || null;
  const doc = opts.document !== undefined ? opts.document : (typeof document !== "undefined" ? document : null);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const L = D.HALF_L, W = D.HALF_W;
  const FONT_LBL = '"Chakra Petch", "Inter", "Arial Narrow", Arial, sans-serif';
  const FONT_UI = '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
  const VOLT = "#d0e85c";

  // ---------- quality: 2 full, 1 lighter shadows and crowd, 0 no shadows ----------
  let quality = opts.quality === undefined ? 2 : opts.quality;
  const DPR = [1, 1.25, 1.5];
  const SHADOW_MAP = [0, 1024, 2048];

  // ---------- renderer ----------
  let renderer = opts.renderer || null;
  let glCanvas = null;
  const own = !renderer;
  if (own) {
    glCanvas = doc.createElement("canvas");
    glCanvas.id = "matchCanvas3d";
    glCanvas.setAttribute("aria-hidden", "true");
    wrap.insertBefore(glCanvas, hud);
    renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min((typeof window !== "undefined" && window.devicePixelRatio) || 1, DPR[quality]));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = quality > 0;
    renderer.shadowMap.type = THREE.PCFShadowMap;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060b);
  scene.fog = new THREE.Fog(0x04060b, 160, 360);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 800);
  camera.position.set(0, 40, 76);

  // ---------- lights: a cool night sky, one warm key light with shadows, four floodlight spots ----------
  scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x1a3a22, 0.55));
  scene.add(new THREE.AmbientLight(0xffffff, 0.1));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.9);
  sun.position.set(30, 90, 50);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = quality > 0;
  if (sun.shadow) {
    sun.shadow.mapSize.set(SHADOW_MAP[quality] || 1024, SHADOW_MAP[quality] || 1024);
    Object.assign(sun.shadow.camera, { left: -62, right: 62, top: 48, bottom: -48, near: 20, far: 220 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 3;
  }
  scene.add(sun);
  scene.add(sun.target);
  const PYLONS = [[-L - 24, -W - 32], [L + 24, -W - 32], [-L - 24, W + 30], [L + 24, W + 30]];
  for (const [x, z] of PYLONS) {
    const sl = new THREE.SpotLight(0xf3f0dc, 180, 230, 0.75, 0.6, 1.4);
    sl.position.set(x, 50, z);
    sl.target.position.set(x * 0.15, 0, z * 0.1);
    scene.add(sl); scene.add(sl.target);
  }

  const disposables = [];
  const keep = x => { disposables.push(x); return x; };
  const lambert = (color, extra) => keep(new THREE.MeshLambertMaterial(Object.assign({ color }, extra || {})));
  const basic = (color, extra) => keep(new THREE.MeshBasicMaterial(Object.assign({ color }, extra || {})));
  function canvasTexture(w, h, draw) {
    if (!doc || !doc.createElement) return null;
    const cv = doc.createElement("canvas");
    cv.width = w; cv.height = h;
    const c = cv.getContext && cv.getContext("2d");
    if (!c || !c.fillRect) return null;
    draw(c, w, h);
    const tex = keep(new THREE.CanvasTexture(cv));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }
  function add(geo, mat, x, y, z, parent) {
    const mesh = new THREE.Mesh(keep(geo), mat);
    mesh.position.set(x || 0, y || 0, z || 0);
    (parent || scene).add(mesh);
    return mesh;
  }
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  // ---------- pitch: mow lines both ways, speckle, worn goalmouths, chalk lines ----------
  const pitchTex = canvasTexture(2048, 1360, (c, w, h) => {
    const k = w / (L * 2 + 4);
    const X = m => (m + L + 2) * k, Y = m => (m + W + 2) * k;
    c.fillStyle = "#2b8f47";
    c.fillRect(0, 0, w, h);
    const bands = 16;
    for (let i = 0; i < bands; i++) {
      c.fillStyle = i % 2 ? "rgba(255,255,255,0.075)" : "rgba(0,0,0,0.07)";
      c.fillRect(X(-L) + i * (L * 2 * k) / bands, Y(-W), (L * 2 * k) / bands + 1, W * 2 * k);
    }
    for (let i = 0; i < 10; i++) {
      c.fillStyle = i % 2 ? "rgba(255,255,255,0.028)" : "rgba(0,0,0,0.028)";
      c.fillRect(X(-L), Y(-W) + i * (W * 2 * k) / 10, L * 2 * k, (W * 2 * k) / 10 + 1);
    }
    for (let i = 0; i < 9000; i++) {
      c.fillStyle = rnd() < 0.5 ? "rgba(255,255,220,0.07)" : "rgba(0,30,0,0.08)";
      c.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 3, 2);
    }
    for (const [mx, my, r] of [[-L + 6, 0, 11], [L - 6, 0, 11], [0, 0, 8]]) {
      const g = c.createRadialGradient(X(mx), Y(my), 0, X(mx), Y(my), r * k);
      g.addColorStop(0, "rgba(120,100,50,0.22)");
      g.addColorStop(1, "rgba(120,100,50,0)");
      c.fillStyle = g;
      c.fillRect(X(mx) - r * k, Y(my) - r * k, r * k * 2, r * k * 2);
    }
    c.strokeStyle = "rgba(255,255,255,.92)";
    c.fillStyle = "rgba(255,255,255,.92)";
    c.lineWidth = 0.14 * k;
    c.strokeRect(X(-L), Y(-W), L * 2 * k, W * 2 * k);
    c.beginPath();
    c.moveTo(X(0), Y(-W)); c.lineTo(X(0), Y(W));
    c.moveTo(X(D.CIRCLE_R), Y(0)); c.arc(X(0), Y(0), D.CIRCLE_R * k, 0, Math.PI * 2);
    c.stroke();
    const da = Math.acos((D.BOX_D - D.SPOT_D) / D.CIRCLE_R);
    for (const s of [-1, 1]) {
      const gx = s * L;
      c.strokeRect(s > 0 ? X(gx - D.BOX_D) : X(gx), Y(-D.BOX_HALF), D.BOX_D * k, D.BOX_HALF * 2 * k);
      c.strokeRect(s > 0 ? X(gx - D.SIX_D) : X(gx), Y(-D.SIX_HALF), D.SIX_D * k, D.SIX_HALF * 2 * k);
      const sx = gx - s * D.SPOT_D;
      c.beginPath();
      if (s > 0) c.arc(X(sx), Y(0), D.CIRCLE_R * k, Math.PI - da, Math.PI + da);
      else c.arc(X(sx), Y(0), D.CIRCLE_R * k, -da, da);
      c.stroke();
      c.beginPath(); c.arc(X(sx), Y(0), 0.22 * k, 0, Math.PI * 2); c.fill();
      for (const cy of [-1, 1]) {
        c.beginPath();
        const a0 = s > 0 ? (cy > 0 ? Math.PI : Math.PI / 2) : (cy > 0 ? -Math.PI / 2 : 0);
        c.arc(X(gx), Y(cy * W), 1 * k, a0, a0 + Math.PI / 2);
        c.stroke();
      }
    }
    c.beginPath(); c.arc(X(0), Y(0), 0.26 * k, 0, Math.PI * 2); c.fill();
  });
  const ground = add(new THREE.PlaneGeometry(560, 560), lambert(0x090b10), 0, -0.1, 0);
  ground.rotation.x = -Math.PI / 2;
  const apron = add(new THREE.PlaneGeometry(L * 2 + 20, W * 2 + 18), lambert(0x1a5a2e), 0, -0.04, 0);
  apron.rotation.x = -Math.PI / 2;
  apron.receiveShadow = true;
  const pitchMat = keep(pitchTex ? new THREE.MeshStandardMaterial({ map: pitchTex, roughness: 0.95, metalness: 0 }) : new THREE.MeshStandardMaterial({ color: 0x2b8f47, roughness: 0.95 }));
  const pitch = add(new THREE.PlaneGeometry(L * 2 + 4, W * 2 + 4), pitchMat, 0, 0, 0);
  pitch.rotation.x = -Math.PI / 2;
  pitch.receiveShadow = true;

  // ---------- goals with nets that react ----------
  const white = lambert(0xf4f4f4);
  const nets = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(s * L, 0, 0);
    scene.add(g);
    for (const z of [-D.GOAL_HALF, D.GOAL_HALF]) {
      const post = add(new THREE.CylinderGeometry(0.07, 0.07, D.BAR_H, 8), white, 0, D.BAR_H / 2, z, g);
      post.castShadow = true;
    }
    const bar = add(new THREE.CylinderGeometry(0.07, 0.07, D.GOAL_HALF * 2 + 0.14, 8), white, 0, D.BAR_H, 0, g);
    bar.rotation.x = Math.PI / 2;
    bar.castShadow = true;
    for (const z of [-D.GOAL_HALF, D.GOAL_HALF]) add(new THREE.CylinderGeometry(0.04, 0.04, D.GOAL_DEPTH, 6), white, s * D.GOAL_DEPTH / 2, D.BAR_H - 0.02, z, g).rotation.z = Math.PI / 2;
    // the net: a grid of line segments, each point knows how far from the frame it is so a goal can push it back
    const pts = [], weight = [], idx = [];
    const NZ = 14, NY = 6, NX = 5;
    const dep = D.GOAL_DEPTH;
    const at = (x, y, z, wgt) => { pts.push(x, y, z); weight.push(wgt); return pts.length / 3 - 1; };
    const back = [];
    for (let j = 0; j <= NY; j++) { back.push([]); for (let i = 0; i <= NZ; i++) {
      const y = j / NY * D.BAR_H, z = (i / NZ * 2 - 1) * D.GOAL_HALF;
      const wy = 1 - Math.abs(j / NY * 2 - 1) * 0.6, wz = 1 - Math.pow(Math.abs(i / NZ * 2 - 1), 2);
      back[j].push(at(s * dep, y, z, 0.3 + 0.7 * wy * wz));
    } }
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NZ; i++) {
      if (i < NZ) idx.push(back[j][i], back[j][i + 1]);
      if (j < NY) idx.push(back[j][i], back[j + 1][i]);
    }
    for (const zs of [-1, 1]) {
      const side = [];
      for (let j = 0; j <= NY; j++) { side.push([]); for (let i = 0; i <= NX; i++) {
        const x = s * (i / NX) * dep, y = j / NY * D.BAR_H;
        side[j].push(at(x, y, zs * D.GOAL_HALF, (i / NX) * 0.5 * (1 - Math.abs(j / NY * 2 - 1) * 0.5)));
      } }
      for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
        if (i < NX) idx.push(side[j][i], side[j][i + 1]);
        if (j < NY) idx.push(side[j][i], side[j + 1][i]);
      }
    }
    const roof = [];
    for (let i = 0; i <= NX; i++) { roof.push([]); for (let k2 = 0; k2 <= NZ; k2++) {
      roof[i].push(at(s * (i / NX) * dep, D.BAR_H, (k2 / NZ * 2 - 1) * D.GOAL_HALF, (i / NX) * 0.35));
    } }
    for (let i = 0; i <= NX; i++) for (let k2 = 0; k2 <= NZ; k2++) {
      if (k2 < NZ) idx.push(roof[i][k2], roof[i][k2 + 1]);
      if (i < NX) idx.push(roof[i][k2], roof[i + 1][k2]);
    }
    const base = new Float32Array(pts);
    const posArr = new Float32Array(pts);
    const geo = keep(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
    geo.setIndex(idx);
    const net = new THREE.LineSegments(geo, keep(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })));
    g.add(net);
    const wArr = new Float32Array(weight);
    nets.push({ mesh: net, side: s, base, pos: posArr, weight: wArr, bulge: 0, shown: -1, userData: { side: s } });
  }
  function netShape(n) {
    const amount = n.bulge;
    if (Math.abs(amount - n.shown) < 0.002) return;
    n.shown = amount;
    const P = n.pos, B = n.base, Wt = n.weight;
    for (let i = 0; i < Wt.length; i++) {
      const wgt = Wt[i] * amount;
      P[i * 3] = B[i * 3] + n.side * wgt * 1.1;
      P[i * 3 + 1] = B[i * 3 + 1] - wgt * 0.25 * (B[i * 3 + 1] / D.BAR_H);
      P[i * 3 + 2] = B[i * 3 + 2] * (1 + wgt * 0.08);
    }
    n.mesh.geometry.attributes.position.needsUpdate = true;
  }

  // ---------- stadium bowl: boards, tiered stands on all four sides, roof, crowd, pylons ----------
  const boardTex = canvasTexture(2048, 128, (c, w, h) => {
    const cols = ["#0e3a34", "#132c4a", "#3a1626", "#3d3413", "#1f1f2b"];
    const words = ["FLOODLIGHTS", "BE A MANAGER", "MATCH DAY", "GAME NIGHT", "FLOODLIGHTS"];
    const n = 10, bw = w / n;
    for (let i = 0; i < n; i++) {
      c.fillStyle = cols[i % cols.length];
      c.fillRect(i * bw, 0, bw, h);
      c.fillStyle = i % 2 ? VOLT : "rgba(255,255,255,.85)";
      let size = 40;
      c.font = "700 " + size + "px " + FONT_LBL;
      while (size > 16 && c.measureText(words[i % words.length]).width > bw * 0.82) { size -= 2; c.font = "700 " + size + "px " + FONT_LBL; }
      c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(words[i % words.length], i * bw + bw / 2, h / 2 + 2);
    }
  });
  const boardFace = boardTex ? lambert(0xffffff, { map: boardTex }) : lambert(0x16324f);
  const boardSide = lambert(0x0c1218);
  // only the face toward the pitch carries the texture, the thin top and ends stay dark
  const boardMat = [boardSide, boardSide, boardSide, boardSide, boardFace, boardSide];
  const boardH = 1.1;
  for (const z of [-W - 5.8, W + 5.8]) {
    const bd = add(new THREE.BoxGeometry(L * 2 + 8, boardH, 0.25), boardMat, 0, boardH / 2, z);
    if (z > 0) bd.rotation.y = Math.PI;
  }
  for (const s of [-1, 1]) {
    const bd = add(new THREE.BoxGeometry(W * 2 + 10, boardH, 0.25), boardMat, s * (L + 6.8), boardH / 2, 0);
    bd.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
  }
  const standMat = lambert(0x1b212c);
  const stepMat = lambert(0x242b38);
  const seats = [];
  const standGap = 8.5;
  function stands(axis, sign, tiers, startD) {
    const len = axis === "z" ? L * 2 + 70 : W * 2 + 40;
    for (let r = 0; r < tiers; r++) {
      const top = 1.6 + r * 1.45, d = startD + r * 2.4;
      const geo = axis === "z" ? new THREE.BoxGeometry(len, top, 2.4) : new THREE.BoxGeometry(2.4, top, len);
      const mesh = add(geo, r % 2 ? standMat : stepMat, axis === "z" ? 0 : sign * d, top / 2, axis === "z" ? sign * d : 0);
      mesh.receiveShadow = false;
      for (let u = -len / 2 + 2; u < len / 2 - 2; u += 2.3) {
        if (rnd() < 0.12) continue;
        const jit = (rnd() - 0.5) * 0.4;
        seats.push(axis === "z" ? [u + jit, top, sign * (d - 0.4)] : [sign * (d - 0.4), top, u + jit]);
      }
    }
  }
  stands("z", -1, 12, W + standGap);
  stands("z", 1, 5, W + standGap);
  stands("x", -1, 10, L + standGap);
  stands("x", 1, 10, L + standGap);
  // roof slabs with a strip of light under the edge
  const roofMat = lambert(0x0d1016);
  const stripMat = basic(0xfff6dc);
  const farD = W + standGap + 12 * 2.4;
  const roofFar = add(new THREE.BoxGeometry(L * 2 + 78, 0.8, 30), roofMat, 0, 24, -(farD - 12));
  roofFar.rotation.x = -0.12;
  add(new THREE.BoxGeometry(L * 2 + 60, 0.25, 0.6), stripMat, 0, 22.4, -(W + standGap + 2));
  for (const s of [-1, 1]) {
    const endD = L + standGap + 10 * 2.4;
    const roofEnd = add(new THREE.BoxGeometry(28, 0.8, W * 2 + 48), roofMat, s * (endD - 11), 22, 0);
    roofEnd.rotation.z = s * 0.12;
    add(new THREE.BoxGeometry(0.6, 0.25, W * 2 + 34), stripMat, s * (L + standGap + 2), 20.6, 0);
  }
  // the crowd: bodies and heads as two instanced meshes, bouncing after goals
  const crowdN = seats.length;
  const crowd = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(0.9, 1.2, 0.6)), keep(new THREE.MeshLambertMaterial({ color: 0xffffff })), crowdN);
  const heads = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(0.42, 0.42, 0.42)), keep(new THREE.MeshLambertMaterial({ color: 0xffffff })), crowdN);
  const crowdBase = new Float32Array(crowdN), crowdPh = new Float32Array(crowdN);
  {
    const mtx = new THREE.Matrix4(), col = new THREE.Color();
    const skins = [0x5c3a21, 0x8d5524, 0xa66d3a, 0xb98d5a, 0xc9a77a, 0x3d2314];
    const tones = [0x3a4150, 0x2b303b, 0x515866, 0x1f242e, 0x3b2f36, 0x2f3f44, 0x6a6a6a, 0x161616];
    for (let i = 0; i < crowdN; i++) {
      crowdBase[i] = seats[i][1] + 0.9;
      crowdPh[i] = rnd() * 6.28;
      mtx.makeTranslation(seats[i][0], crowdBase[i], seats[i][2]);
      crowd.setMatrixAt(i, mtx);
      crowd.setColorAt(i, col.setHex(tones[(rnd() * tones.length) | 0]));
      mtx.makeTranslation(seats[i][0], crowdBase[i] + 0.9, seats[i][2]);
      heads.setMatrixAt(i, mtx);
      heads.setColorAt(i, col.setHex(skins[(rnd() * skins.length) | 0]));
    }
  }
  scene.add(crowd);
  scene.add(heads);
  function colourCrowd(kits) {
    const col = new THREE.Color();
    const tones = [0x3a4150, 0x2b303b, 0x515866, 0x1f242e, 0x6a6a6a, 0x161616];
    for (let i = 0; i < crowdN; i++) {
      const r = rnd();
      col.set(r < 0.22 ? kits[0][0] : r < 0.3 ? kits[0][1] : r < 0.38 ? kits[1][0] : tones[(rnd() * tones.length) | 0]);
      if (r < 0.38) col.multiplyScalar(0.55);
      crowd.setColorAt(i, col);
    }
    if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true;
  }
  // floodlight pylons with lamp heads and soft beams
  const lampMat = basic(0xfffbe6);
  const beamMat = basic(0xfff3c4, { transparent: true, opacity: 0.045, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  for (const [x, z] of PYLONS) {
    add(new THREE.CylinderGeometry(0.5, 1.0, 50, 6), lambert(0x2a323c), x, 25, z);
    const head = add(new THREE.BoxGeometry(12, 7, 1), lambert(0x20262e), x, 51, z);
    head.lookAt(x * 0.15, 0, z * 0.1);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j += 2) add(new THREE.CircleGeometry(1.1, 10), lampMat, i * 3.6, j * 1.6, 0.6, head);
    const beam = add(new THREE.ConeGeometry(26, 56, 12, 1, true), beamMat, x * 0.55, 24, z * 0.5);
    beam.lookAt(x, 52, z);
    beam.rotateX(-Math.PI / 2);
  }

  // ---------- ball with its shadow ----------
  const BALL_R = 0.38;
  const ballGeo = new THREE.IcosahedronGeometry(BALL_R, 1);
  {
    const pos = ballGeo.getAttribute("position");
    const col = new Float32Array(pos.count * 3);
    for (let f = 0; f < pos.count; f += 3) {
      const dark = (f / 3) % 4 === 0;
      for (let j = 0; j < 3; j++) col.set(dark ? [0.08, 0.08, 0.08] : [0.96, 0.96, 0.96], (f + j) * 3);
    }
    ballGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  }
  const ball = add(ballGeo, lambert(0xffffff, { vertexColors: true, flatShading: true }), 0, BALL_R, 0);
  ball.castShadow = true;
  const ballShadowMat = basic(0x000000, { transparent: true, opacity: 0.3, depthWrite: false });
  const ballShadow = add(new THREE.CircleGeometry(0.46, 16), ballShadowMat, 0, 0.03, 0);
  ballShadow.rotation.x = -Math.PI / 2;

  // ---------- markers: the ring under the player you control, a thin ring under the pass target ----------
  const ringMat = basic(0xffe15a, { transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
  const ring = add(new THREE.RingGeometry(1.15, 1.42, 32), ringMat, 0, 0.05, 0);
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  const ringArrow = add(new THREE.ConeGeometry(0.42, 0.7, 4), ringMat, 0, 0.05, 0);
  ringArrow.rotation.z = -Math.PI / 2;
  ringArrow.visible = false;
  const passRing = add(new THREE.RingGeometry(0.95, 1.1, 24), basic(0x7ad7ff, { transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }), 0, 0.045, 0);
  passRing.rotation.x = -Math.PI / 2;
  passRing.visible = false;

  // ---------- players: jointed low poly figures, shared geometry ----------
  const G = {
    shirt: keep(new THREE.CylinderGeometry(0.42, 0.33, 0.95, 14, 1, false, 0)),
    shorts: keep(new THREE.CylinderGeometry(0.34, 0.38, 0.4, 10)),
    neck: keep(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 6)),
    head: keep(new THREE.SphereGeometry(0.235, 12, 9)),
    hairCap: keep(new THREE.SphereGeometry(0.25, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5)),
    hairTop: keep(new THREE.BoxGeometry(0.4, 0.22, 0.42)),
    hairLong: keep(new THREE.SphereGeometry(0.26, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.68)),
    thigh: keep(new THREE.BoxGeometry(0.19, 0.5, 0.19)),
    shin: keep(new THREE.BoxGeometry(0.15, 0.45, 0.15)),
    boot: keep(new THREE.BoxGeometry(0.3, 0.12, 0.17)),
    arm: keep(new THREE.BoxGeometry(0.13, 0.62, 0.13)),
    shadow: keep(new THREE.CircleGeometry(0.62, 14))
  };
  G.thigh.translate(0, -0.25, 0); G.shin.translate(0, -0.225, 0); G.boot.translate(0.07, -0.46, 0); G.arm.translate(0, -0.3, 0);
  const SKIN = [0xffdbac, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0x5c3a21, 0x3d2314];
  const HAIR = [0x111111, 0x2b1a10, 0x4a3020, 0x8a5a2b, 0xc9a24a, 0x9a3b1c];
  const skinMats = SKIN.map(c => lambert(c));
  const hairMats = HAIR.map(c => lambert(c, { flatShading: true }));
  const bootMats = [lambert(0x111111), lambert(0xf2f2f2), lambert(0xff6a1a), lambert(0x2f7cff)];
  const shadowMat = basic(0x000000, { transparent: true, opacity: 0.28, depthWrite: false });
  const matCache = {};
  const colMat = hex => matCache[hex] || (matCache[hex] = lambert(new THREE.Color(hex)));
  const figures = new Map();
  let kitKey = "", kits = null;

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
    return h >>> 0;
  }
  function shirtTexture(p, kit) {
    const num = String(p.num || "");
    const name = (p.label || "").toUpperCase();
    return canvasTexture(256, 128, (c, w, h) => {
      c.fillStyle = kit[0];
      c.fillRect(0, 0, w, h);
      c.fillStyle = kit[1];
      c.fillRect(0, h - 8, w, 8);
      // collar hint on the chest and a pair of stripes on the sides
      c.fillRect(56, 0, 16, 10);
      c.globalAlpha = 0.35;
      c.fillRect(124, 0, 8, h); c.fillRect(252, 0, 4, h); c.fillRect(0, 0, 4, h);
      c.globalAlpha = 1;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.lineJoin = "round";
      const dark = kit[1] === "#111111" || kit[1] === "#1b2430";
      c.strokeStyle = dark ? "rgba(255,255,255,.5)" : "rgba(0,0,0,.55)";
      c.fillStyle = kit[1];
      // back: name above a big number (u = 0.75 is the middle of the back)
      c.font = "700 70px " + FONT_LBL;
      c.lineWidth = 6;
      c.strokeText(num, 192, 76); c.fillText(num, 192, 76);
      c.font = "700 17px " + FONT_LBL;
      c.lineWidth = 3;
      let nm = name;
      while (nm.length > 2 && c.measureText(nm).width > 110) nm = nm.slice(0, -1);
      c.strokeText(nm, 192, 22); c.fillText(nm, 192, 22);
      // chest: small number on the left side of the chest (u = 0.25 is the middle of the chest)
      c.font = "700 30px " + FONT_LBL;
      c.lineWidth = 3;
      c.strokeText(num, 46, 44); c.fillText(num, 46, 44);
    });
  }
  function buildFigure(p, kit) {
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    const h = hashStr(p.name || "");
    const skin = skinMats[h % skinMats.length];
    const tex = shirtTexture(p, kit);
    const shirtMat = keep(tex ? new THREE.MeshLambertMaterial({ map: tex }) : new THREE.MeshLambertMaterial({ color: new THREE.Color(kit[0]) }));
    const M = (geo, mat, parent) => { const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; parent.add(mesh); return mesh; };
    const pelvis = new THREE.Group(); pelvis.position.y = 0.95; body.add(pelvis);
    const shorts = M(G.shorts, colMat(kit[1] === kit[0] ? "#ffffff" : kit[1] === "#ffffff" && kit[0] !== "#ffffff" ? kit[0] : kit[1]), pelvis);
    shorts.position.y = -0.1;
    const torso = new THREE.Group(); pelvis.add(torso);
    const shirt = M(G.shirt, shirtMat, torso); shirt.position.y = 0.5;
    M(G.neck, skin, torso).position.y = 1.02;
    const head = new THREE.Group(); head.position.y = 1.28; torso.add(head);
    M(G.head, skin, head);
    const hairKind = (h >>> 3) % 5; // 0 none (bald or very short), 1 cap, 2 cap, 3 high top, 4 long
    if (hairKind > 0) {
      const hm = hairMats[(h >>> 7) % hairMats.length];
      const hair = M(hairKind === 3 ? G.hairTop : hairKind === 4 ? G.hairLong : G.hairCap, hm, head);
      hair.position.y = hairKind === 3 ? 0.18 : hairKind === 4 ? 0.02 : 0.03;
      if (hairKind === 4) hair.scale.set(1, 1.08, 1.05);
    }
    const sh = {}, hip = {}, knee = {};
    for (const s of [-1, 1]) {
      const sg = new THREE.Group(); sg.position.set(0, 0.86, s * 0.5); torso.add(sg);
      M(G.arm, colMat(kit[0]), sg);
      const hand = new THREE.Mesh(G.neck, skin); hand.scale.set(0.9, 0.9, 0.9); hand.position.y = -0.62; sg.add(hand);
      sh[s] = sg;
      const hg = new THREE.Group(); hg.position.set(0, -0.0, s * 0.18); pelvis.add(hg);
      M(G.thigh, skin, hg);
      const kg = new THREE.Group(); kg.position.y = -0.5; hg.add(kg);
      M(G.shin, skin, kg);
      M(G.boot, bootMats[(h >>> 11) % bootMats.length], kg);
      hip[s] = hg; knee[s] = kg;
    }
    const shadow = new THREE.Mesh(G.shadow, shadowMat); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.025; g.add(shadow);
    g.scale.setScalar(1.18);
    scene.add(g);
    const J = { lean: 0, roll: 0, bodyY: 0, hipL: 0, hipR: 0, hipLx: 0, hipRx: 0, kneeL: 0, kneeR: 0, shL: 0, shR: 0, shLx: 0, shRx: 0, headX: 0, spin: 0 };
    return { g, body, pelvis, torso, head, sh, hip, knee, shirt, shadow, kit, num: p.num, phase: (h % 628) / 100, cur: Object.assign({}, J), tgt: J };
  }

  function syncPlayers(m) {
    const key = m.teams[0].name + "|" + m.teams[1].name;
    if (key !== kitKey) {
      kitKey = key;
      for (const f of figures.values()) scene.remove(f.g);
      figures.clear();
      kits = FL.pickKits(m.teams[0].name, m.teams[1].name);
      colourCrowd(kits);
      for (const p of m.players) {
        const kit = p.gk ? (p.team === 0 ? ["#f2c230", "#111111"] : ["#ff7a1a", "#111111"]) : kits[p.team];
        figures.set(p.id, buildFigure(p, kit));
      }
      const mine = new THREE.Color(kits[0][0]);
      // the marker is in my team colour unless that is too close to the grass, then volt
      const grassy = Math.abs(mine.r - 0.17) < 0.25 && mine.g > 0.4 && mine.b < 0.45;
      ringMat.color.set(grassy ? VOLT : kits[0][0]);
    }
  }

  // one frame of body animation from the sim state
  function animate(f, p, dt, time, hasBall, isCtrl) {
    const T = f.tgt;
    const speed = Math.hypot(p.vx, p.vy);
    const A = clamp(speed / 6.5, 0, 1);
    f.phase += dt * (3 + speed * 1.55);
    const ph = f.phase;
    T.lean = -(0.05 + 0.22 * A);
    T.roll = 0;
    T.bodyY = Math.abs(Math.sin(ph)) * 0.05 * A;
    T.hipL = Math.sin(ph) * 0.95 * A; T.hipR = -Math.sin(ph) * 0.95 * A;
    T.hipLx = 0; T.hipRx = 0;
    T.kneeL = -(0.12 + A * (0.3 + 0.95 * Math.max(0, Math.sin(ph + 1.6))));
    T.kneeR = -(0.12 + A * (0.3 + 0.95 * Math.max(0, Math.sin(ph + 1.6 + Math.PI))));
    T.shL = -Math.sin(ph) * 0.85 * A; T.shR = Math.sin(ph) * 0.85 * A;
    T.shLx = -0.15; T.shRx = 0.15;
    T.headX = 0;
    T.spin = 0;
    if (hasBall) { T.lean -= 0.08; T.bodyY -= 0.04; }
    if (p.kickAnim > 0) {
      const u = 1 - p.kickAnim / 0.35;
      const sw = Math.sin(u * Math.PI);
      T.hipR = -0.6 + sw * 1.9; T.kneeR = -0.2 - (1 - sw) * 0.7; T.hipL = -0.1; T.shL = 0.9 * sw; T.shR = -0.5 * sw;
      T.lean = -0.18 + sw * 0.12;
    }
    if (p.tackleAnim > 0) { T.shR = 1.3; T.shRx = 0.5; T.lean -= 0.2; T.bodyY -= 0.12; }
    if (p.stumble > 0) {
      const w = Math.sin(time * 11);
      T.roll = 0.32 * w; T.lean = -0.45; T.shL = -1.6 + w; T.shR = -1.6 - w; T.shLx = -1.0; T.shRx = 1.0; T.bodyY -= 0.1; T.headX = 0.5;
    }
    if (p.move) {
      const M = p.move, u = clamp(M.t / M.dur, 0, 1), s = M.side || 1;
      if (M.type === "roulette") T.spin = u * Math.PI * 2 * s;
      else if (M.type === "stepover") { T.hipRx = s * 1.1 * Math.sin(u * Math.PI); T.hipR = 0.5 * Math.sin(u * Math.PI); }
      else if (M.type === "feint") T.roll = s * 0.55 * Math.sin(u * Math.PI * 2);
      else if (M.type === "dragback") { T.lean = 0.3; T.hipR = -0.9 * Math.sin(u * Math.PI); T.kneeR = -0.4; }
      else if (M.type === "nutmeg") T.bodyY = 0.28 * Math.sin(u * Math.PI);
      if (!M.ok && u > 0.6) { T.roll = 0.3 * s; T.lean = -0.4; }
    }
    if (p.slide) {
      const u = clamp(p.slide.t / p.slide.dur, 0, 1);
      T.lean = 1.25; T.bodyY = -0.62; T.hipL = 0.9; T.hipR = 1.4 - u * 0.4; T.kneeL = -0.5; T.kneeR = -0.1; T.shL = -1.3; T.shR = -1.6; T.shLx = -0.8; T.shRx = 0.9; T.headX = -0.5;
    } else if (p.down > 0) {
      const up = clamp(1 - p.down / 0.3, 0, 1);
      T.lean = 1.4 * (1 - up); T.bodyY = -0.6 * (1 - up) - 0.08; T.hipL = 0.6 * (1 - up); T.hipR = 1.1 * (1 - up); T.shL = -0.8; T.shR = -2.2 * (1 - up); T.shRx = 0.9 * (1 - up);
    }
    if (p.diving) {
      const dir = (p.vy >= 0 ? 1 : -1) * (Math.cos(p.face) >= 0 ? 1 : -1);
      T.roll = 1.25 * dir; T.bodyY = 0.1; T.shL = -2.6; T.shR = -2.6; T.shLx = -0.6 * dir; T.shRx = -0.6 * dir; T.hipL = -0.3; T.hipR = -0.3; T.kneeL = -0.3; T.kneeR = -0.3;
    }
    if (p.celebrate > 0) {
      T.shL = -2.9; T.shR = -2.9; T.shLx = -0.4; T.shRx = 0.4; T.bodyY = Math.abs(Math.sin(time * 7)) * 0.3; T.lean = 0.05; T.headX = -0.3;
    }
    if (p.stun > 0 && !p.stumble && !p.down && !p.slide) { T.lean = 0.12; T.shL = 0.5; T.shR = 0.5; }
    // smooth toward the targets, with a stiffer follow when the pose is a hard one
    const k = Math.min(1, dt * (p.slide || p.kickAnim > 0 ? 24 : 14));
    const C = f.cur;
    for (const key in T) C[key] += (T[key] - C[key]) * k;
    f.body.rotation.z = C.lean;
    f.body.rotation.x = C.roll;
    f.body.position.y = C.bodyY;
    f.hip[1].rotation.z = C.hipL; f.hip[-1].rotation.z = C.hipR;
    f.hip[1].rotation.x = C.hipLx; f.hip[-1].rotation.x = C.hipRx;
    f.knee[1].rotation.z = C.kneeL; f.knee[-1].rotation.z = C.kneeR;
    f.sh[1].rotation.z = C.shL; f.sh[-1].rotation.z = C.shR;
    f.sh[1].rotation.x = C.shLx; f.sh[-1].rotation.x = C.shRx;
    f.head.rotation.z = C.headX;
    f.g.rotation.y = -p.face + C.spin;
    f.shadow.scale.setScalar(p.slide || p.down > 0 ? 1.5 : 1);
  }

  // ---------- HUD (DOM) in the site design language ----------
  const fx = { time: 0, shake: 0, zoom: 0, zoomT: 0, goalT: 0, goalText: "", goalSub: "", toast: "", toastT: 0, toastN: 0, crowd: 0, flash: 0 };
  let hudEl = null, els = null;
  function el(tag, cls, parent, text) {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    (parent || hudEl).appendChild(e);
    return e;
  }
  if (doc && wrap && doc.createElement) {
    hudEl = doc.createElement("div");
    hudEl.id = "m3dHud";
    wrap.appendChild(hudEl);
    els = {};
    const sb = el("div", "m3-score");
    els.homeBar = el("i", "m3-bar", sb);
    els.homeName = el("span", "m3-team", sb, "");
    els.score = el("span", "m3-num", sb, "0  0");
    els.awayName = el("span", "m3-team", sb, "");
    els.awayBar = el("i", "m3-bar", sb);
    const cl = el("div", "m3-clock");
    els.half = el("span", "m3-half", cl, "1ST");
    els.clock = el("span", "m3-min", cl, "0'");
    els.help = el("div", "m3-help");
    els.help1 = el("div", "m3-help1", els.help, "YOU ATTACK TO THE RIGHT");
    els.help2 = el("div", "m3-help2", els.help, "WASD move  ·  Shift sprint  ·  Q pass  ·  T through ball  ·  hold E shoot  ·  F skill move  ·  Space tackle  ·  X slide  ·  Esc pause");
    const card = el("div", "m3-card");
    els.cardNum = el("div", "m3-cnum", card, "");
    const ci = el("div", "m3-cinfo", card);
    els.cardName = el("div", "m3-cname", ci, "");
    els.cardMeta = el("div", "m3-cmeta", ci, "");
    const st = el("div", "m3-stam", ci);
    els.stam = el("div", "", st);
    els.ticker = el("div", "m3-ticker");
    els.tickerIn = el("div", "", els.ticker, "");
    els.goal = el("div", "m3-goal");
    els.goalT = el("div", "m3-goal1", els.goal, "");
    els.goalS = el("div", "m3-goal2", els.goal, "");
    els.flash = el("div", "m3-flash");
    els.cache = {};
  }
  function updateHud(sim, m, dt) {
    if (!els) return;
    const r = sim.result();
    const homeT = m.userHome ? m.teams[0] : m.teams[1], awayT = m.userHome ? m.teams[1] : m.teams[0];
    const cut = s => (s.length > 16 ? s.slice(0, 15) + "." : s).toUpperCase();
    if (els.cache.names !== homeT.name + awayT.name + kitKey) {
      els.cache.names = homeT.name + awayT.name + kitKey;
      els.homeName.textContent = cut(homeT.name);
      els.awayName.textContent = cut(awayT.name);
      if (kits) { els.homeBar.style.background = kits[homeT.idx][0]; els.awayBar.style.background = kits[awayT.idx][0]; }
    }
    const sc = r.home + "  " + r.away;
    if (els.cache.sc !== sc) { els.cache.sc = sc; els.score.textContent = sc; }
    const mn = sim.minute();
    const ct = m.phase === "halftime" ? "HT" : m.phase === "full" ? "FT" : mn + "'";
    if (els.cache.ct !== ct) { els.cache.ct = ct; els.clock.textContent = ct; }
    const hf = m.half === 1 ? "1ST HALF" : "2ND HALF";
    if (els.cache.hf !== hf) { els.cache.hf = hf; els.half.textContent = hf; }
    const c = m.auto ? null : m.ctrl;
    if (c) {
      const key = c.id + "|" + Math.round(c.stamina * 50) + (m.tired ? "t" : "");
      if (els.cache.card !== key) {
        els.cache.card = key;
        els.cardNum.textContent = c.num !== undefined ? String(c.num) : "";
        if (kits) { els.cardNum.style.background = kits[0][0]; els.cardNum.style.color = kits[0][1]; }
        els.cardName.textContent = c.label;
        els.cardMeta.textContent = (c.role || c.line) + "  ·  " + c.rating + " OVR" + (m.tired ? "  ·  TIRED" : "");
        els.stam.style.width = Math.round(c.stamina * 100) + "%";
        els.stam.style.background = m.tired ? "#ff5a5a" : c.stamina > 0.35 ? "linear-gradient(90deg,#5fd38d," + VOLT + ")" : "#e8c052";
      }
      hudEl.classList.remove("m3-nocard");
    } else hudEl.classList.add("m3-nocard");
    const showHelp = !m.auto && m.half === 1 && m.t < 14 && m.phase !== "goal";
    if (els.cache.help !== showHelp) { els.cache.help = showHelp; els.help.style.opacity = showHelp ? "1" : "0"; }
    if (fx.toastT > 0 && fx.toast) {
      if (els.cache.toast !== fx.toastN) { els.cache.toast = fx.toastN; els.tickerIn.textContent = fx.toast; els.ticker.classList.remove("in"); void els.ticker.offsetWidth; els.ticker.classList.add("in"); }
      els.ticker.style.opacity = String(clamp(Math.min(1, fx.toastT / 0.3), 0, 1));
    } else els.ticker.style.opacity = "0";
    if (fx.goalT > 0) {
      if (els.cache.goal !== fx.goalText + fx.goalSub) { els.cache.goal = fx.goalText + fx.goalSub; els.goalT.textContent = fx.goalText; els.goalS.textContent = fx.goalSub; els.goal.classList.remove("in"); void els.goal.offsetWidth; els.goal.classList.add("in"); }
      els.goal.style.opacity = String(clamp(Math.min(1, fx.goalT / 0.4), 0, 1));
    } else { els.goal.style.opacity = "0"; els.cache.goal = ""; }
    els.flash.style.opacity = String(fx.flash * 0.5);
  }

  // ---------- name tags, power meter and radar on the 2D canvas above the scene ----------
  let ctx2 = null;
  if (hud && hud.getContext) { try { ctx2 = hud.getContext("2d"); } catch (e) { ctx2 = null; } }
  let tagCount = 0;
  function pill(c, x, y, w, h, r, fill) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
  }
  function drawOverlay(sim, m) {
    if (!ctx2 || !hud) return;
    const dpr = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
    const w = hud.clientWidth || viewW, h = hud.clientHeight || viewH;
    if (hud.width !== Math.round(w * dpr) || hud.height !== Math.round(h * dpr)) { hud.width = Math.round(w * dpr); hud.height = Math.round(h * dpr); }
    const c = ctx2;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    const ctrl = m.auto ? null : m.ctrl;
    const b = m.ball;
    tagCount = 0;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.lineJoin = "round";
    // team mates near the ball: number and name, so you know who you are about to pass to or switch to
    for (const p of m.players) {
      if (p.team !== 0 || p === ctrl || p.gk) continue;
      const near = Math.hypot(p.x - b.x, p.y - b.y) < 15 || p === m.passHint;
      if (!near) continue;
      const q = project(p.x, p.y, 3.0);
      if (!q.visible || q.x < -40 || q.x > w + 40) continue;
      const hint = p === m.passHint;
      c.font = "600 11px " + FONT_LBL;
      const txt = p.num + "  " + p.label.toUpperCase();
      const tw = c.measureText(txt).width + 14;
      pill(c, q.x - tw / 2, q.y - 9, tw, 18, 3, hint ? "rgba(122,215,255,.92)" : "rgba(0,0,0,.72)");
      c.fillStyle = hint ? "#06121a" : "rgba(255,255,255,.92)";
      c.fillText(txt, q.x, q.y + 0.5);
      tagCount++;
    }
    if (ctrl && m.phase !== "full") {
      const q = project(ctrl.x, ctrl.y, 3.35);
      if (q.visible) {
        c.font = "700 13px " + FONT_LBL;
        const txt = ctrl.label.toUpperCase();
        const rt = String(ctrl.rating);
        const tw = c.measureText(txt).width, rw = 30;
        const bw = tw + rw + 22, bx = q.x - bw / 2, by = q.y - 11 + Math.sin(fx.time * 5) * 1.5;
        pill(c, bx, by, bw, 22, 3, "rgba(0,0,0,.84)");
        c.fillStyle = ringMat.color.getStyle();
        c.fillRect(bx, by, 3, 22);
        c.fillStyle = "#ffffff";
        c.textAlign = "left";
        c.fillText(txt, bx + 10, by + 11.5);
        c.font = "700 12px " + FONT_LBL;
        c.fillStyle = VOLT;
        c.textAlign = "right";
        c.fillText(rt, bx + bw - 8, by + 11.5);
        c.textAlign = "center";
        tagCount++;
        if (m.charging) {
          const pw = 72, px = q.x - pw / 2, py = by - 16;
          pill(c, px - 2, py - 2, pw + 4, 12, 3, "rgba(0,0,0,.8)");
          const sweet = FL.SWEET_POWER || 0.86;
          pill(c, px, py, Math.max(4, pw * m.charge), 8, 2, m.charge > sweet ? "#ff4d5e" : m.charge > 0.5 ? "#5fd38d" : "#e8c052");
          c.fillStyle = "#ffffff";
          c.fillRect(px + pw * sweet, py - 2, 2, 12);
        }
      }
    }
    // radar
    const rw = Math.min(170, w * 0.24), rh = rw * W / L, rx = w - rw - 18, ry = h - rh - 18;
    c.fillStyle = "rgba(0,0,0,.7)";
    c.fillRect(rx - 6, ry - 6, rw + 12, rh + 12);
    c.strokeStyle = "rgba(255,255,255,.3)";
    c.lineWidth = 1;
    c.strokeRect(rx, ry, rw, rh);
    c.beginPath(); c.moveTo(rx + rw / 2, ry); c.lineTo(rx + rw / 2, ry + rh); c.stroke();
    for (const p of m.players) {
      c.fillStyle = p === ctrl ? ringMat.color.getStyle() : p.gk ? (p.team === 0 ? "#f2c230" : "#ff7a1a") : kits ? kits[p.team][0] : "#ffffff";
      c.beginPath();
      c.arc(rx + (p.x + L) / (L * 2) * rw, ry + (p.y + W) / (W * 2) * rh, p === ctrl ? 3.4 : 2.5, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.arc(rx + (clamp(b.x, -L, L) + L) / (L * 2) * rw, ry + (clamp(b.y, -W, W) + W) / (W * 2) * rh, 2, 0, Math.PI * 2);
    c.fill();
  }

  // ---------- camera: a TV gantry on the near touchline, smoothed, pulls in on goals ----------
  const cam = { x: 0, z: 0, snap: true };
  const look = new THREE.Vector3();
  let viewW = 0, viewH = 0, time = 0, frames = 0, baseFov = 30;
  let frameAvg = 1 / 60, slowT = 0, workAvg = 0;
  const now = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());

  function applyQuality() {
    if (own) renderer.setPixelRatio(Math.min((typeof window !== "undefined" && window.devicePixelRatio) || 1, DPR[quality]));
    if (own) renderer.shadowMap.enabled = quality > 0;
    sun.castShadow = quality > 0;
    if (quality > 0 && sun.shadow) { sun.shadow.mapSize.set(SHADOW_MAP[quality], SHADOW_MAP[quality]); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    crowd.count = quality === 0 ? Math.floor(crowdN * 0.5) : crowdN;
    heads.count = crowd.count;
    for (const f of figures.values()) f.g.traverse(o => { if (o.isMesh) o.castShadow = quality > 0; });
  }
  function resize() {
    const w = (hud && hud.clientWidth) || (wrap && wrap.clientWidth) || opts.width || 960;
    const h = (hud && hud.clientHeight) || (wrap && wrap.clientHeight) || opts.height || 540;
    if (w === viewW && h === viewH) return;
    viewW = w; viewH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const hf = 46 * Math.PI / 180;
    baseFov = clamp(2 * Math.atan(Math.tan(hf / 2) / camera.aspect) * 180 / Math.PI, 24, 58);
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
  }

  function onEvent(ev) {
    if (ev.type === "goal") {
      fx.crowd = 3; fx.shake = 0.9; fx.zoomT = 2.4; fx.flash = 1; fx.goalT = 2.8;
      fx.goalText = ev.own ? "OWN GOAL!" : "GOAL!";
      fx.goalSub = ev.name + "  " + ev.min + "'";
      const n = nets[ev.team === 0 ? 1 : 0];
      if (n) n.bulge = 1;
    } else if (ev.type === "save" && ev.big) { fx.crowd = Math.max(fx.crowd, 0.9); fx.shake = Math.max(fx.shake, 0.3); }
    else if (ev.type === "post") fx.shake = Math.max(fx.shake, 0.45);
    else if (ev.type === "tackle" && ev.kind === "slide" && ev.ok) { fx.shake = Math.max(fx.shake, 0.25); fx.crowd = Math.max(fx.crowd, 0.6); }
    else if (ev.type === "skill" && ev.ok) fx.crowd = Math.max(fx.crowd, 0.7);
    else if (ev.type === "miss") fx.crowd = Math.max(fx.crowd, 0.5);
    else if (ev.type === "say") { fx.toast = ev.text; fx.toastT = 3.6; fx.toastN++; }
  }

  function draw(sim, dt) {
    const t0 = now();
    resize();
    time += dt;
    fx.time = time;
    frames++;
    // frame rate guard: a laptop that needs too much CPU per frame, or cannot even hold 24 frames a second,
    // gets lighter shadows, then none. The frame interval alone is not enough: a 30 Hz display or a
    // throttled tab also shows long intervals with hardly any work in them.
    if (dt > 0) {
      frameAvg += (dt - frameAvg) * 0.08;
      const struggling = workAvg > 11 || frameAvg > 1 / 24;
      if (struggling && quality > 0) { slowT += dt; if (slowT > 2.5) { quality--; slowT = 0; applyQuality(); } }
      else slowT = Math.max(0, slowT - dt);
    }
    fx.shake *= Math.exp(-dt * 5);
    fx.flash = Math.max(0, fx.flash - dt * 1.6);
    fx.goalT = Math.max(0, fx.goalT - dt);
    fx.toastT = Math.max(0, fx.toastT - dt);
    fx.crowd = Math.max(0, fx.crowd - dt);
    fx.zoomT = Math.max(0, fx.zoomT - dt);
    const zoomWant = fx.zoomT > 0 ? 1 : 0;
    fx.zoom += (zoomWant - fx.zoom) * Math.min(1, dt * 3);
    if (fx.zoom < 0.004) fx.zoom = 0;
    for (const n of nets) { n.bulge = Math.max(0, n.bulge - dt * 0.75); netShape(n); }

    const m = sim ? sim.m : null;
    if (m) {
      const b = m.ball;
      syncPlayers(m);
      const c = m.auto ? null : m.ctrl;
      for (const p of m.players) {
        const f = figures.get(p.id);
        if (!f) continue;
        f.g.position.set(p.x, 0, p.y);
        animate(f, p, dt, time, b.owner === p, p === c);
      }
      ball.position.set(b.x, BALL_R + Math.max(0, b.z), b.y);
      ball.rotation.z -= b.vx * dt * 2.2;
      ball.rotation.x += b.vy * dt * 2.2;
      ballShadow.position.set(b.x, 0.03, b.y);
      const sh = 1 + Math.max(0, b.z) * 0.14;
      ballShadow.scale.set(sh, sh, 1);
      ballShadowMat.opacity = 0.3 / (1 + Math.max(0, b.z) * 0.3);

      ring.visible = !!c && m.phase !== "full";
      ringArrow.visible = ring.visible;
      if (c) {
        ring.position.set(c.x, 0.05, c.y);
        ringMat.opacity = 0.7 + 0.3 * Math.sin(time * 6);
        ringArrow.position.set(c.x + Math.cos(c.face) * 1.75, 0.08, c.y + Math.sin(c.face) * 1.75);
        ringArrow.rotation.set(0, -c.face, -Math.PI / 2);
      }
      passRing.visible = !!(c && m.passHint && m.phase === "play");
      if (passRing.visible) passRing.position.set(m.passHint.x, 0.045, m.passHint.y);

      const tx = clamp(b.x + clamp(b.vx * 0.3, -6, 6), -(L - 12), L - 12);
      const tz = clamp(b.y * 0.35, -9, 9);
      if (cam.snap) { cam.x = tx; cam.z = tz; cam.snap = false; }
      else {
        const k = 1 - Math.exp(-dt * 3.6);
        cam.x += (tx - cam.x) * k;
        cam.z += (tz - cam.z) * k;
      }
      // the crowd bounces after a goal and sways a little all match
      const energy = fx.crowd > 0 ? Math.min(1, fx.crowd) : 0;
      if (energy > 0 || frames % 2 === 0) {
        const bA = crowd.instanceMatrix.array, hA = heads.instanceMatrix.array;
        const n = crowd.count;
        for (let i = 0; i < n; i++) {
          const j = energy > 0 ? Math.max(0, Math.sin(time * 9 + crowdPh[i])) * 0.5 * energy : Math.sin(time * 1.3 + crowdPh[i]) * 0.03;
          bA[i * 16 + 13] = crowdBase[i] + j;
          hA[i * 16 + 13] = crowdBase[i] + 0.9 + j;
        }
        crowd.instanceMatrix.needsUpdate = true;
        heads.instanceMatrix.needsUpdate = true;
      }
      updateHud(sim, m, dt);
    }
    const shake = fx.shake > 0.01 ? fx.shake : 0;
    const zoomIn = fx.zoom * 7;
    camera.position.set(cam.x * 0.86 + (shake ? (Math.random() - 0.5) * shake : 0), 40 - zoomIn * 0.6 + (shake ? (Math.random() - 0.5) * shake : 0), W + 42 + cam.z * 0.25 - zoomIn);
    look.set(cam.x, 0.6, cam.z - 4);
    camera.lookAt(look);
    const fovWant = baseFov * (1 - 0.16 * fx.zoom);
    if (Math.abs(camera.fov - fovWant) > 0.0005) { camera.fov = fovWant; camera.updateProjectionMatrix(); }

    renderer.render(scene, camera);
    if (m) drawOverlay(sim, m);
    workAvg += (now() - t0 - workAvg) * 0.08;
  }

  // where a point on the pitch lands on the screen, for the name tags
  const pv = new THREE.Vector3();
  function project(x, y, h) {
    pv.set(x, h || 0, y).project(camera);
    return { x: (pv.x * 0.5 + 0.5) * viewW, y: (-pv.y * 0.5 + 0.5) * viewH, visible: pv.z < 1 && pv.z > -1 };
  }

  function dispose() {
    for (const f of figures.values()) scene.remove(f.g);
    figures.clear();
    for (const d of disposables) if (d && d.dispose) d.dispose();
    for (const k in matCache) delete matCache[k];
    if (crowd.dispose) crowd.dispose();
    if (heads.dispose) heads.dispose();
    if (hudEl && hudEl.parentNode) hudEl.parentNode.removeChild(hudEl);
    if (ctx2 && hud) { try { ctx2.setTransform(1, 0, 0, 1, 0, 0); ctx2.clearRect(0, 0, hud.width, hud.height); } catch (e) { /* nothing to clear */ } }
    if (renderer && own) {
      renderer.dispose();
      if (glCanvas && glCanvas.parentNode) glCanvas.parentNode.removeChild(glCanvas);
    }
  }

  return {
    draw, onEvent, project, dispose, snap: () => { cam.snap = true; }, ownHud: true,
    scene, camera, figures, ball, ballShadow, ring, passRing, crowd, nets, fx,
    quality: () => quality, setQuality: q => { quality = clamp(q, 0, 2); applyQuality(); },
    stats: () => ({ frames, seats: crowdN, tags: tagCount, quality, hud: !!hudEl, workMs: workAvg, frameMs: frameAvg * 1000 })
  };
}

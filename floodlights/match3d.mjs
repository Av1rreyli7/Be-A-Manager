// Floodlights playable match, the 3D look, framed like a TV broadcast.
// The game itself lives in match_sim3d.mjs (the deep sim) or match.js (Classic sim). This file only draws
// what the sim says: a floodlit pitch with mow stripes and crisp painted lines, two goals with nets that bulge
// on a goal, 22 jointed players in full kit (sleeves, socks, numbers and names on the back), the ball, a two
// tier stadium with a packed crowd that bobs and jumps, LED boards that scroll, floodlight pylons with glare,
// and a broadcast camera on the main stand gantry that leads the play and leans in on the big moments.
// It also owns the match HUD (DOM, in the site design language, styles injected from here) and the name tags
// drawn on the 2D canvas above the scene.
//
// three.js is passed in, never imported here, so the same file runs in the browser (real renderer) and in
// node tests (stub renderer, no document).
//
// Axes: the sim uses x (goal to goal) and y (touchline to touchline) on the ground and z for height.
// In the scene that is x, z and y. The camera stands on the +y touchline, so "up the screen" is minus y
// and the controls feel exactly like the classic top down view.
//
// ---------- hooks the sim can drive (all optional, read every frame, nothing to call) ----------
// m.setPiece = { kind, team, x, y, phase }
//     kind: "kickoff" | "goalkick" | "corner" | "freekick" | "penalty" | "throwin"; x, y: the spot in sim
//     metres; phase: "setup" | "aim" | "taken". While set and not "taken" the camera frames the spot (corners
//     and penalties lean in on the box, goal kicks stay wide) and the HUD shows a CORNER / FREE KICK / PENALTY
//     banner under the scorebug. Clear it (null) once play is live again.
// m.aim = { x, y, z, power, curve }
//     an aiming target in sim metres. The view draws a target ring on the grass and a dotted flight arc from
//     the ball to it (z is the peak height of the arc, default 3; curve bends it sideways, -1 to 1).
//     power 0 to 1 fills the ring. Set it to null to hide.
// player fields: p.air (metres off the ground, for a jump or a header; p.jump is read too), p.headerAnim
//     (seconds left of a header, about 0.4 at the start) for the header pose, p.diving for the keeper dive.
//     p.kickAnim, p.tackleAnim, p.slide, p.down, p.stumble, p.move, p.celebrate work as before.
// events (m.events, passed to onEvent): "goal", "save", "post", "tackle", "skill", "miss", "say" as before,
//     plus "corner", "freekick", "penalty", "goalkick", "foul", "header" (each may carry text) for a banner
//     and a crowd reaction, and any event with a banner field shows that text in the banner.
// view.sim() returns the last sim drawn (handy for tests and headless checks).

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
    renderer.toneMappingExposure = 1.02;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = quality > 0;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  const maxAniso = own && renderer.capabilities && renderer.capabilities.getMaxAnisotropy ? Math.min(16, renderer.capabilities.getMaxAnisotropy()) : 4;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05080f);
  scene.fog = new THREE.Fog(0x070a12, 190, 420);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 1, 900);
  camera.position.set(0, 33, W + 60);

  // ---------- lights: a cool night sky, one floodlight key with real shadows, four floodlight spots ----------
  // The key light stands where the main bank of lights is (high over the far corner) so every player throws a
  // crisp shadow; the spots and the fake shadow fans under the players give the crossed floodlight look.
  scene.add(new THREE.HemisphereLight(0xc6d4ff, 0x14301d, 0.5));
  scene.add(new THREE.AmbientLight(0xffffff, 0.08));
  const sun = new THREE.DirectionalLight(0xfff3dc, 2.1);
  sun.position.set(36, 96, -44);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = quality > 0;
  if (sun.shadow) {
    sun.shadow.mapSize.set(SHADOW_MAP[quality] || 1024, SHADOW_MAP[quality] || 1024);
    Object.assign(sun.shadow.camera, { left: -62, right: 62, top: 46, bottom: -46, near: 30, far: 230 });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 2.5;
  }
  scene.add(sun);
  scene.add(sun.target);
  const PYLONS = [[-L - 26, -W - 36], [L + 26, -W - 36], [-L - 26, W + 30], [L + 26, W + 30]];
  for (const [x, z] of PYLONS) {
    const sl = new THREE.SpotLight(0xf6f1dc, 210, 240, 0.72, 0.65, 1.4);
    sl.position.set(x, 58, z);
    sl.target.position.set(x * 0.12, 0, z * 0.08);
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
    // a stub canvas (tests, odd browsers) without gradients just means no texture, never a crash
    try { draw(c, w, h); } catch (e) { return null; }
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

  // ---------- pitch: real mow stripes, grass noise, worn goalmouths, painted lines as geometry ----------
  // The texture carries only the grass (stripes, speckle, wear) so it can stay 2048 wide; the lines are thin
  // meshes, so they stay crisp on the far touchline at any screen size.
  const STRIPES = 22;
  const pitchTex = canvasTexture(2048, 1360, (c, w, h) => {
    const k = w / (L * 2 + 8);
    const X = m => (m + L + 4) * k, Y = m => (m + W + 4) * k;
    c.fillStyle = "#237a3a";
    c.fillRect(0, 0, w, h);
    // the stripes run touchline to touchline, the mower went goal to goal, each band a slightly other shade
    const bw = (L * 2 + 8) * k / STRIPES;
    for (let i = 0; i < STRIPES; i++) {
      const light = i % 2 === 0;
      const g = c.createLinearGradient(i * bw, 0, (i + 1) * bw, 0);
      g.addColorStop(0, light ? "rgba(214,255,190,0.085)" : "rgba(0,20,0,0.075)");
      g.addColorStop(0.5, light ? "rgba(214,255,190,0.105)" : "rgba(0,20,0,0.095)");
      g.addColorStop(1, light ? "rgba(214,255,190,0.085)" : "rgba(0,20,0,0.075)");
      c.fillStyle = g;
      c.fillRect(i * bw, 0, bw + 1, h);
    }
    // a faint cross cut so the stripes look mown, not painted
    for (let i = 0; i < 12; i++) {
      c.fillStyle = i % 2 ? "rgba(255,255,255,0.018)" : "rgba(0,0,0,0.02)";
      c.fillRect(0, Y(-W) + i * (W * 2 * k) / 12, w, (W * 2 * k) / 12 + 1);
    }
    // blade speckle: light tips and dark roots
    for (let i = 0; i < 26000; i++) {
      const r = rnd();
      c.fillStyle = r < 0.45 ? "rgba(225,255,190,0.06)" : r < 0.9 ? "rgba(0,26,6,0.075)" : "rgba(120,96,48,0.05)";
      c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2.5, 1 + rnd() * 1.4);
    }
    // wear: goalmouths, the centre spot, the run up behind the penalty spot and the linesman strips
    const worn = (mx, my, rx, ry, a) => {
      c.save();
      c.translate(X(mx), Y(my));
      c.scale(1, ry / rx);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, rx * k);
      g.addColorStop(0, "rgba(128,104,58," + a + ")");
      g.addColorStop(0.55, "rgba(110,98,52," + a * 0.5 + ")");
      g.addColorStop(1, "rgba(110,98,52,0)");
      c.fillStyle = g;
      c.beginPath(); c.arc(0, 0, rx * k, 0, Math.PI * 2); c.fill();
      c.restore();
    };
    for (const s of [-1, 1]) {
      worn(s * (L - 3), 0, 6.5, 4.2, 0.34);
      worn(s * (L - 1.2), 0, 3.4, 4, 0.3);
      worn(s * (L - D.SPOT_D), 0, 1.6, 1.4, 0.22);
      worn(s * (L - 22), 0, 9, 7, 0.08);
    }
    worn(0, 0, 4, 3.4, 0.16);
    for (const s of [-1, 1]) for (let x = -L * 0.9; x < 0.1; x += 3.5) worn(s * x * 0.5 + s * -L * 0.25, s * (W + 1.6), 2.2, 0.9, 0.07);
    // where the lines are painted the grass is a touch lighter and scuffed (the paint itself is geometry)
    c.strokeStyle = "rgba(220,255,210,0.07)";
    c.lineWidth = 0.42 * k;
    c.strokeRect(X(-L), Y(-W), L * 2 * k, W * 2 * k);
  });
  if (pitchTex) pitchTex.anisotropy = maxAniso;
  const ground = add(new THREE.PlaneGeometry(600, 600), lambert(0x07090d), 0, -0.1, 0);
  ground.rotation.x = -Math.PI / 2;
  const apron = add(new THREE.PlaneGeometry(L * 2 + 22, W * 2 + 20), lambert(0x1f6a34), 0, -0.04, 0);
  apron.rotation.x = -Math.PI / 2;
  apron.receiveShadow = true;
  const pitchMat = keep(pitchTex ? new THREE.MeshStandardMaterial({ map: pitchTex, roughness: 0.92, metalness: 0 }) : new THREE.MeshStandardMaterial({ color: 0x2a8a43, roughness: 0.92 }));
  // fine grass grain from world position, so the pitch never looks like a flat print up close
  pitchMat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vGrass;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGrass = (modelMatrix * vec4(position, 1.0)).xz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vGrass;\nfloat gHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\nfloat gNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), f.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), f.x), f.y); }")
      .replace("#include <map_fragment>", "#include <map_fragment>\nfloat gn = gNoise(vGrass * 2.3) * 0.6 + gNoise(vGrass * 9.0) * 0.4;\ndiffuseColor.rgb *= 0.9 + 0.2 * gn;");
  };
  const pitch = add(new THREE.PlaneGeometry(L * 2 + 8, W * 2 + 8), pitchMat, 0, 0, 0);
  pitch.rotation.x = -Math.PI / 2;
  pitch.receiveShadow = true;
  // the painted lines: 12 cm wide, a hair above the grass, slightly off white like real paint under lights
  const paint = keep(new THREE.MeshLambertMaterial({ color: 0xf2f4ee, emissive: 0x2a2c28, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  const LW = 0.12, LY = 0.012;
  const lineGroup = new THREE.Group();
  scene.add(lineGroup);
  function strip(x1, z1, x2, z2) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(len + LW, LW)), paint);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -Math.atan2(z2 - z1, x2 - x1);
    m.position.set((x1 + x2) / 2, LY, (z1 + z2) / 2);
    m.receiveShadow = true;
    lineGroup.add(m);
  }
  function arc(cx, cz, r, a0, a1, segs) {
    const g = keep(new THREE.RingGeometry(r - LW / 2, r + LW / 2, segs || 64, 1, a0, a1 - a0));
    const m = new THREE.Mesh(g, paint);
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx, LY, cz);
    m.receiveShadow = true;
    lineGroup.add(m);
  }
  function spot(cx, cz, r) {
    const m = new THREE.Mesh(keep(new THREE.CircleGeometry(r, 16)), paint);
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx, LY, cz);
    lineGroup.add(m);
  }
  strip(-L, -W, L, -W); strip(-L, W, L, W); strip(-L, -W, -L, W); strip(L, -W, L, W);
  strip(0, -W, 0, W);
  arc(0, 0, D.CIRCLE_R, 0, Math.PI * 2, 72);
  spot(0, 0, 0.26);
  {
    const da = Math.acos((D.BOX_D - D.SPOT_D) / D.CIRCLE_R);
    for (const s of [-1, 1]) {
      const gx = s * L, bx = gx - s * D.BOX_D, sx6 = gx - s * D.SIX_D;
      strip(gx, -D.BOX_HALF, bx, -D.BOX_HALF); strip(gx, D.BOX_HALF, bx, D.BOX_HALF); strip(bx, -D.BOX_HALF, bx, D.BOX_HALF);
      strip(gx, -D.SIX_HALF, sx6, -D.SIX_HALF); strip(gx, D.SIX_HALF, sx6, D.SIX_HALF); strip(sx6, -D.SIX_HALF, sx6, D.SIX_HALF);
      const px = gx - s * D.SPOT_D;
      spot(px, 0, 0.22);
      // the D outside the box (the ring is drawn in the x, -z plane after the rotation, so angles flip)
      if (s > 0) arc(px, 0, D.CIRCLE_R, Math.PI - da, Math.PI + da, 24);
      else arc(px, 0, D.CIRCLE_R, -da, da, 24);
      // corner arcs
      for (const cz of [-1, 1]) {
        const a0 = s > 0 ? (cz > 0 ? Math.PI / 2 : Math.PI) : (cz > 0 ? 0 : -Math.PI / 2);
        arc(gx, cz * W, 1, a0, a0 + Math.PI / 2, 10);
      }
    }
  }
  // corner flags: a thin pole and a small flag that flutters
  const flags = [];
  {
    const poleMat = lambert(0xe8e8e8), flagMat = lambert(0xffc23a, { side: THREE.DoubleSide, emissive: 0x3a2400 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 5), poleMat, sx * L, 0.8, sz * W);
      const fl = add(new THREE.PlaneGeometry(0.5, 0.36), flagMat, sx * L + 0.25, 1.4, sz * W);
      flags.push(fl);
    }
  }

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

  // ---------- stadium: LED boards, two tier stands with a packed crowd, roofs, pylons, sky ----------
  // The crowd is two layers. The first three rows are real 3D fans (two instanced meshes, swaying on the GPU)
  // so the front of every stand has depth against the boards. Every row behind them is drawn by a shader on
  // the stand slope: one fan per seat, in team colours, bobbing, jumping on goals and popping camera flashes,
  // all on the GPU, with aisles and the shade under the upper tier. Far away fans fade to their mean colour so
  // nothing shimmers.

  // LED boards: one canvas, ads on the top half and a GOAL strip on the bottom half, scrolled every frame
  const ADS = [
    ["FLOODLIGHTS", "#0b2a1a", "#d0e85c"], ["BE A MANAGER", "#10213f", "#ffffff"], ["GAME NIGHT", "#3a1606", "#ffb072"],
    ["MATCH DAY", "#24104a", "#c9b8ff"], ["PITCHSIDE", "#06302c", "#3ee6c4"], ["KICK OFF", "#3a0d1c", "#ff8aa8"],
    ["VOLT ENERGY", "#1d2a06", "#e4f68c"], ["WORLD CAREER", "#0b2236", "#6cc0ff"]
  ];
  const ledTex = canvasTexture(2048, 256, (c, w, h) => {
    const n = ADS.length, bw = w / n, rh = h / 2;
    for (let i = 0; i < n; i++) {
      const [word, bg, fg] = ADS[i];
      const g = c.createLinearGradient(i * bw, 0, (i + 1) * bw, 0);
      g.addColorStop(0, bg); g.addColorStop(0.5, "#000000"); g.addColorStop(1, bg);
      c.fillStyle = bg; c.fillRect(i * bw, 0, bw, rh);
      c.globalAlpha = 0.45; c.fillStyle = g; c.fillRect(i * bw, 0, bw, rh); c.globalAlpha = 1;
      c.fillStyle = fg;
      let size = 64;
      c.font = "700 " + size + "px " + FONT_LBL;
      while (size > 20 && c.measureText(word).width > bw * 0.84) { size -= 2; c.font = "700 " + size + "px " + FONT_LBL; }
      c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(word, i * bw + bw / 2, rh / 2 + 3);
      c.fillStyle = "rgba(255,255,255,0.08)";
      c.fillRect(i * bw, 0, 2, rh);
    }
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i % 2 ? "#d0e85c" : "#0a0f08";
      c.fillRect(i * (w / 8), rh, w / 8, rh);
      c.fillStyle = i % 2 ? "#0a0f08" : "#d0e85c";
      c.font = "700 92px " + FONT_LBL;
      c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText("GOAL", i * (w / 8) + w / 16, rh + rh / 2 + 4);
    }
    // LED pixel grid
    c.fillStyle = "rgba(0,0,0,0.22)";
    for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
    for (let x = 0; x < w; x += 4) c.fillRect(x, 0, 1, h);
  });
  if (ledTex) { ledTex.wrapS = THREE.RepeatWrapping; ledTex.repeat.set(2.6, 0.5); ledTex.offset.set(0, 0.5); ledTex.anisotropy = maxAniso; }
  const ribbonTex = ledTex ? keep(ledTex.clone()) : null;
  if (ribbonTex) { ribbonTex.wrapS = THREE.RepeatWrapping; ribbonTex.repeat.set(5.2, 0.5); ribbonTex.offset.set(0.3, 0.5); ribbonTex.needsUpdate = true; }
  const ledMat = ledTex ? basic(0xffffff, { map: ledTex, toneMapped: false }) : basic(0x16324f);
  const ribbonMat = ribbonTex ? basic(0xffffff, { map: ribbonTex, toneMapped: false }) : basic(0x16324f);
  const darkMat = lambert(0x0b0f16);
  const boardMat = [darkMat, darkMat, darkMat, darkMat, ledMat, darkMat];
  const boardH = 0.95;
  for (const z of [-W - 5.6, W + 5.6]) {
    const bd = add(new THREE.BoxGeometry(L * 2 + 10, boardH, 0.22), boardMat, 0, boardH / 2, z);
    if (z > 0) bd.rotation.y = Math.PI;
  }
  for (const s of [-1, 1]) {
    for (const zz of [-1, 1]) {
      const bd = add(new THREE.BoxGeometry(W - 6, boardH, 0.22), boardMat, s * (L + 5.2), boardH / 2, zz * (W / 2 + 3));
      bd.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
  }
  // dugouts and the technical areas on the near side, so the near touchline is not bare
  {
    const bench = lambert(0x1a2230), canopy = keep(new THREE.MeshLambertMaterial({ color: 0xbfe2ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(8, 0.45, 0.7), bench, s * 9, 0.22, W + 4.4);
      const hood = add(new THREE.CylinderGeometry(1.1, 1.1, 8.2, 10, 1, true, 0, Math.PI), canopy, s * 9, 0.4, W + 4.3);
      hood.rotation.z = Math.PI / 2;
      hood.rotation.y = Math.PI;
    }
  }

  // the stand slope shader (one material per stand, the program is shared)
  const crowdU = { uTime: { value: 0 }, uEnergy: { value: 0 }, uFlash: { value: 0 } };
  const COL = { home: new THREE.Color(0xc8102e), home2: new THREE.Color(0xffffff), away: new THREE.Color(0x1b3d8f), away2: new THREE.Color(0xffffff) };
  const rakeVS = [
    "#include <common>", "#include <fog_pars_vertex>", "varying vec2 vUv;",
    "void main() { vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;", "#include <fog_vertex>", "}"
  ].join("\n");
  const rakeFS = [
    "#include <common>", "#include <fog_pars_fragment>",
    "uniform float uTime; uniform float uEnergy; uniform float uFlash; uniform float uBias; uniform float uShadeFrom; uniform float uDetail; uniform float uLight;",
    "uniform vec3 uHome; uniform vec3 uHome2; uniform vec3 uAway; uniform vec3 uAway2; uniform vec3 uSeat;",
    "varying vec2 vUv;",
    "float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }",
    "float sbox(vec2 p, vec2 b, float r) { vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }",
    "void main() {",
    "  vec2 cell = floor(vUv); vec2 q = fract(vUv);",
    "  float h1 = h21(cell), h2 = h21(cell + 17.31), h3 = h21(cell + 63.7), h4 = h21(cell + 5.13);",
    "  bool home = h2 < uBias;",
    "  vec3 a = home ? uHome : uAway; vec3 b = home ? uHome2 : uAway2;",
    "  vec3 shirt = (h3 < 0.52 ? a : (h3 < 0.68 ? b : mix(vec3(0.01), vec3(0.08), h4))) * 0.72;",
    "  vec3 skin = mix(vec3(0.06, 0.03, 0.015), vec3(0.62, 0.36, 0.24), h4 * h4);",
    "  float aisle = 1.0 - step(0.6, mod(cell.x, 23.0));",
    "  bool empty = h1 < 0.045 || aisle > 0.5;",
    "  float bob = sin(uTime * (1.1 + h1 * 1.7) + h2 * 6.283) * 0.03;",
    "  float jump = uEnergy * max(0.0, sin(uTime * 8.5 + h3 * 6.283)) * (0.16 + 0.14 * h4);",
    "  vec2 p = q - vec2(0.5 + (h4 - 0.5) * 0.14, bob + jump);",
    "  float aa = max(fwidth(vUv.x), fwidth(vUv.y)) * 1.6;",
    "  float dT = sbox(p - vec2(0.0, 0.3), vec2(0.22 + h1 * 0.06, 0.2), 0.08);",
    "  float dH = length(p - vec2(0.0, 0.63)) - 0.115;",
    "  float dA = min(sbox(p - vec2(-0.27, 0.66), vec2(0.045, 0.2), 0.03), sbox(p - vec2(0.27, 0.66), vec2(0.045, 0.2), 0.03));",
    "  float armsUp = step(0.45, uEnergy) * step(0.3, h2);",
    "  vec3 seat = uSeat * (0.8 + 0.4 * h4);",
    "  vec3 col = seat;",
    "  if (!empty) {",
    "    col = mix(col, shirt, 1.0 - smoothstep(-aa, aa, dT));",
    "    col = mix(col, shirt, (1.0 - smoothstep(-aa, aa, dA)) * armsUp);",
    "    col = mix(col, skin, 1.0 - smoothstep(-aa, aa, dH));",
    "  }",
    "  vec3 avg = empty ? seat : mix(seat, shirt, 0.45) + skin * 0.06;",
    "  if (aisle > 0.5) { col = vec3(0.05, 0.055, 0.06); avg = col; }",
    "  float far = smoothstep(0.16, 0.42, aa);",
    "  col = mix(col, avg, max(far, 1.0 - uDetail));",
    "  float shade = 1.0 - smoothstep(uShadeFrom, uShadeFrom + 5.0, vUv.y) * 0.6;",
    "  shade *= 0.78 + 0.22 * smoothstep(0.0, 0.14, q.y);",
    "  col *= shade * uLight;",
    "  float fl = step(1.0 - uFlash * 0.03, h21(cell + floor(uTime * 13.0)));",
    "  col += fl * (empty ? 0.0 : 1.0) * vec3(2.2, 2.2, 2.0);",
    "  gl_FragColor = vec4(col, 1.0);",
    "  #include <tonemapping_fragment>", "  #include <colorspace_fragment>", "  #include <fog_fragment>",
    "}"
  ].join("\n");
  const rakeMats = [];
  function rakeMaterial(bias, shadeFrom, light) {
    const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uBias: { value: bias }, uShadeFrom: { value: shadeFrom }, uDetail: { value: 1 }, uLight: { value: light },
      uHome: { value: COL.home.clone() }, uHome2: { value: COL.home2.clone() }, uAway: { value: COL.away.clone() }, uAway2: { value: COL.away2.clone() },
      uSeat: { value: new THREE.Color(0x263044) }
    }]);
    // the clock, the goal energy and the flashes are shared by every stand
    u.uTime = crowdU.uTime; u.uEnergy = crowdU.uEnergy; u.uFlash = crowdU.uFlash;
    const mat = keep(new THREE.ShaderMaterial({ uniforms: u, vertexShader: rakeVS, fragmentShader: rakeFS, fog: true, side: THREE.DoubleSide }));
    rakeMats.push(mat);
    return mat;
  }
  const CELL_W = 0.6, ROW_D = 0.8;
  // a sloped quad: along is the stand length axis ("x" for the side stands, "z" for the ends)
  function rake(axis, sign, len, dF, dB, hF, hB, mat) {
    const base = axis === "x" ? W : L;
    const pts = axis === "x"
      ? [[-len / 2, hF, sign * (base + dF)], [len / 2, hF, sign * (base + dF)], [-len / 2, hB, sign * (base + dB)], [len / 2, hB, sign * (base + dB)]]
      : [[sign * (base + dF), hF, len / 2], [sign * (base + dF), hF, -len / 2], [sign * (base + dB), hB, len / 2], [sign * (base + dB), hB, -len / 2]];
    const slope = Math.hypot(dB - dF, hB - hF);
    const uMax = len / CELL_W, vMax = slope / ROW_D;
    const geo = keep(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts.flat()), 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 0, uMax, 0, 0, vMax, uMax, vMax]), 2));
    geo.setIndex([0, 1, 2, 2, 1, 3]);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    return mesh;
  }
  // a dark vertical wall or slab between two depths and heights
  function wall(axis, sign, len, d, h0, h1, mat, thick) {
    const base = axis === "x" ? W : L;
    const t = thick || 0.4;
    const geo = axis === "x" ? new THREE.BoxGeometry(len, h1 - h0, t) : new THREE.BoxGeometry(t, h1 - h0, len);
    return add(geo, mat, axis === "x" ? 0 : sign * (base + d), (h0 + h1) / 2, axis === "x" ? sign * (base + d) : 0);
  }
  const concrete = lambert(0x161b24), underMat = lambert(0x07090d), roofMat = lambert(0x0c1017), stripMat = basic(0xfff3d6);
  const seats = [], seatStand = [];
  const D0 = 9.2;               // front wall of the lower tier, metres behind the line
  const FR = 3;                 // rows of 3D fans
  // stand plan: [axis, sign, length, home bias, has upper tier]
  const plan = [["x", -1, L * 2 + 64, 0.72, true], ["z", -1, W * 2 + 44, 0.95, true], ["z", 1, W * 2 + 44, 0.1, true], ["x", 1, L * 2 + 64, 0.72, false]];
  plan.forEach(([axis, sign, len, bias, upper], si) => {
    // front wall and the stepped front rows that carry the 3D fans
    wall(axis, sign, len, D0, 0, 1.4, concrete);
    for (let r = 0; r < FR; r++) {
      const d = D0 + 0.4 + r * ROW_D, top = 1.4 + r * 0.42;
      const step = axis === "x" ? new THREE.BoxGeometry(len, 0.42, ROW_D) : new THREE.BoxGeometry(ROW_D, 0.42, len);
      add(step, r % 2 ? concrete : underMat, axis === "x" ? 0 : sign * (L + d), top - 0.21, axis === "x" ? sign * (W + d) : 0);
      for (let u = -len / 2 + 1; u < len / 2 - 1; u += 0.74) {
        if (rnd() < 0.07) continue;
        const jit = (rnd() - 0.5) * 0.16;
        seats.push(axis === "x" ? [u + jit, top, sign * (W + d)] : [sign * (L + d), top, u + jit]);
        seatStand.push(si);
      }
    }
    // the lower tier slope behind them
    const dF = D0 + 0.4 + FR * ROW_D, hF = 1.4 + FR * 0.42;
    const lowDepth = upper ? 19 : 15, lowRise = upper ? 10.5 : 8.5;
    rake(axis, sign, len, dF, dF + lowDepth, hF, hF + lowRise, rakeMaterial(bias, upper ? 11 : 99, 1.55));
    wall(axis, sign, len, dF + lowDepth + 0.3, 0, hF + lowRise + 1.2, underMat, 0.6);
    if (upper) {
      // the upper tier hangs over the back of the lower one, with an LED ribbon on its front
      const uF = dF + 12, uH = hF + lowRise + 1.6;
      const ul = len - 14;
      const fascia = wall(axis, sign, ul, uF - 0.25, uH - 1.7, uH, underMat, 0.5);
      fascia.castShadow = false;
      const rib = axis === "x" ? new THREE.PlaneGeometry(ul, 1.1) : new THREE.PlaneGeometry(ul, 1.1);
      const ribbon = add(rib, ribbonMat, axis === "x" ? 0 : sign * (L + uF - 0.55), uH - 0.75, axis === "x" ? sign * (W + uF - 0.55) : 0);
      if (axis === "x") ribbon.rotation.y = sign > 0 ? Math.PI : 0;
      else ribbon.rotation.y = sign > 0 ? -Math.PI / 2 : Math.PI / 2;
      // underside of the upper tier
      const slab = axis === "x" ? new THREE.BoxGeometry(ul, 0.6, 20) : new THREE.BoxGeometry(20, 0.6, ul);
      add(slab, underMat, axis === "x" ? 0 : sign * (L + uF + 10), uH - 1.9, axis === "x" ? sign * (W + uF + 10) : 0);
      rake(axis, sign, ul, uF, uF + 21, uH, uH + 13.5, rakeMaterial(bias, 99, 1.25));
      wall(axis, sign, ul, uF + 21.4, uH - 2, uH + 16, underMat, 0.6);
      // roof: a dark slab with a strip of catwalk lights along the front edge
      const roofH = uH + 19, rF = uF + 4, rDepth = 22;
      const roof = axis === "x" ? new THREE.BoxGeometry(ul + 4, 0.7, rDepth) : new THREE.BoxGeometry(rDepth, 0.7, ul + 4);
      const rm = add(roof, roofMat, axis === "x" ? 0 : sign * (L + rF + rDepth / 2), roofH, axis === "x" ? sign * (W + rF + rDepth / 2) : 0);
      if (axis === "x") rm.rotation.x = sign * 0.08; else rm.rotation.z = -sign * 0.08;
      const st = axis === "x" ? new THREE.BoxGeometry(ul, 0.22, 0.5) : new THREE.BoxGeometry(0.5, 0.22, ul);
      add(st, stripMat, axis === "x" ? 0 : sign * (L + rF + 0.4), roofH - 1.1, axis === "x" ? sign * (W + rF + 0.4) : 0);
      const fasc = axis === "x" ? new THREE.BoxGeometry(ul + 4, 1.6, 0.4) : new THREE.BoxGeometry(0.4, 1.6, ul + 4);
      add(fasc, lambert(0x141a24), axis === "x" ? 0 : sign * (L + rF), roofH - 0.2, axis === "x" ? sign * (W + rF) : 0);
    }
  });
  // the 3D front row fans: bodies and heads as two instanced meshes; they sway on the GPU (no matrix uploads)
  const crowdN = seats.length;
  const fanBody = keep(new THREE.BoxGeometry(0.5, 0.66, 0.34));
  const fanHead = keep(new THREE.BoxGeometry(0.25, 0.27, 0.25));
  const fanPh = new Float32Array(crowdN);
  for (let i = 0; i < crowdN; i++) fanPh[i] = rnd() * 6.283;
  const phAttr = new THREE.InstancedBufferAttribute(fanPh, 1);
  fanBody.setAttribute("aPh", phAttr);
  fanHead.setAttribute("aPh", phAttr);
  function swayMaterial() {
    const mat = keep(new THREE.MeshLambertMaterial({ color: 0xffffff }));
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = crowdU.uTime; sh.uniforms.uEnergy = crowdU.uEnergy;
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float aPh;\nuniform float uTime;\nuniform float uEnergy;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed.y += uEnergy * max(0.0, sin(uTime * 8.5 + aPh)) * 0.5 + sin(uTime * 1.3 + aPh) * 0.035;");
    };
    return mat;
  }
  const crowd = new THREE.InstancedMesh(fanBody, swayMaterial(), crowdN);
  const heads = new THREE.InstancedMesh(fanHead, swayMaterial(), crowdN);
  {
    const mtx = new THREE.Matrix4(), col = new THREE.Color();
    const skins = [0x5c3a21, 0x8d5524, 0xa66d3a, 0xb98d5a, 0xc9a77a, 0x3d2314, 0xe0b48f];
    for (let i = 0; i < crowdN; i++) {
      const [x, y, z] = seats[i];
      mtx.makeTranslation(x, y + 0.33, z);
      crowd.setMatrixAt(i, mtx);
      crowd.setColorAt(i, col.setHex(0x3a4150));
      mtx.makeTranslation(x, y + 0.8, z);
      heads.setMatrixAt(i, mtx);
      heads.setColorAt(i, col.setHex(skins[(rnd() * skins.length) | 0]));
    }
  }
  crowd.frustumCulled = false; heads.frustumCulled = false;
  scene.add(crowd);
  scene.add(heads);
  // home fans fill most of the ground, the away end (+x stand) belongs to the visitors
  function colourCrowd(kits, homeIdx) {
    const hk = kits[homeIdx], ak = kits[1 - homeIdx];
    COL.home.set(hk[0]); COL.home2.set(hk[1]); COL.away.set(ak[0]); COL.away2.set(ak[1]);
    for (const mat of rakeMats) {
      mat.uniforms.uHome.value.copy(COL.home); mat.uniforms.uHome2.value.copy(COL.home2);
      mat.uniforms.uAway.value.copy(COL.away); mat.uniforms.uAway2.value.copy(COL.away2);
    }
    const col = new THREE.Color();
    const tones = [0x2b303b, 0x515866, 0x1f242e, 0x6a6a6a, 0x161616];
    const bias = plan.map(p => p[3]);
    for (let i = 0; i < crowdN; i++) {
      const home = rnd() < bias[seatStand[i]];
      const k = home ? hk : ak;
      const r = rnd();
      col.set(r < 0.58 ? k[0] : r < 0.76 ? k[1] : tones[(rnd() * tones.length) | 0]);
      col.multiplyScalar(0.8);
      crowd.setColorAt(i, col);
    }
    if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true;
  }
  // floodlight pylons in the open corners: lattice mast, a lamp head facing the pitch, glare you can see
  const glareTex = canvasTexture(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(255,255,250,1)"); g.addColorStop(0.12, "rgba(255,248,225,0.85)");
    g.addColorStop(0.35, "rgba(255,236,190,0.22)"); g.addColorStop(1, "rgba(255,230,180,0)");
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  const lampMat = basic(0xfffbe6);
  const beamMat = basic(0xfff3c4, { transparent: true, opacity: 0.035, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const mastMat = lambert(0x2a323c);
  const glares = [];
  for (const [x, z] of PYLONS) {
    add(new THREE.CylinderGeometry(0.45, 1.1, 58, 6), mastMat, x, 29, z);
    for (let k = 0; k < 6; k++) add(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 4), mastMat, x, 6 + k * 8.5, z).rotation.z = Math.PI / 2;
    const head = add(new THREE.BoxGeometry(13, 7.5, 1), lambert(0x1a2029), x, 60, z);
    head.lookAt(x * 0.1, 0, z * 0.08);
    for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) add(new THREE.CircleGeometry(0.85, 10), lampMat, i * 2.5, j * 2.2, 0.55, head);
    if (glareTex) {
      const sp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glareTex, color: 0xfff4dc, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
      sp.scale.set(34, 34, 1);
      sp.position.set(x * 0.985, 60, z * 0.985);
      scene.add(sp);
      glares.push(sp);
    }
    const beam = add(new THREE.ConeGeometry(28, 62, 12, 1, true), beamMat, x * 0.55, 27, z * 0.5);
    beam.lookAt(x, 60, z);
    beam.rotateX(-Math.PI / 2);
  }
  // night sky with the orange haze of the city and the floodlit glow over the bowl
  {
    const geo = keep(new THREE.SphereGeometry(700, 24, 12));
    const pos = geo.getAttribute("position");
    const cols = new Float32Array(pos.count * 3);
    const top = new THREE.Color(0x03050b), mid = new THREE.Color(0x0b1424), low = new THREE.Color(0x2a2230);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 700;
      if (y > 0.25) c.copy(mid).lerp(top, Math.min(1, (y - 0.25) / 0.6)); else c.copy(low).lerp(mid, Math.max(0, (y + 0.05) / 0.3));
      cols.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    const sky = new THREE.Mesh(geo, keep(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
    sky.renderOrder = -1;
    scene.add(sky);
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

  // ---------- players: jointed figures in full kit, shared geometry ----------
  // Shirt with rounded shoulders and short sleeves, bare forearms with a bending elbow, shorts, socks to the
  // knee, boots. One shirt texture per player carries the name and number on the back.
  const G = {
    shirt: keep(new THREE.CylinderGeometry(0.41, 0.31, 0.95, 12, 1, false, 0)),
    shoulder: keep(new THREE.SphereGeometry(0.16, 6, 4)),
    shorts: keep(new THREE.CylinderGeometry(0.34, 0.37, 0.42, 10)),
    neck: keep(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 6)),
    head: keep(new THREE.SphereGeometry(0.235, 10, 7)),
    hairCap: keep(new THREE.SphereGeometry(0.25, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.5)),
    hairTop: keep(new THREE.BoxGeometry(0.4, 0.22, 0.42)),
    hairLong: keep(new THREE.SphereGeometry(0.26, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.68)),
    thigh: keep(new THREE.BoxGeometry(0.2, 0.5, 0.2)),
    shin: keep(new THREE.BoxGeometry(0.16, 0.46, 0.16)),
    boot: keep(new THREE.BoxGeometry(0.3, 0.12, 0.17)),
    sleeve: keep(new THREE.BoxGeometry(0.16, 0.32, 0.16)),
    fore: keep(new THREE.BoxGeometry(0.12, 0.3, 0.12)),
    hand: keep(new THREE.BoxGeometry(0.11, 0.12, 0.11)),
    shadow: keep(new THREE.CircleGeometry(0.62, 14))
  };
  G.thigh.translate(0, -0.25, 0); G.shin.translate(0, -0.23, 0); G.boot.translate(0.07, -0.47, 0);
  G.sleeve.translate(0, -0.14, 0); G.fore.translate(0, -0.15, 0); G.hand.translate(0, -0.34, 0);
  G.shoulder.scale(1, 0.9, 0.95);
  // parts that share a joint and a material become one mesh, so each player is fewer draw calls
  function joinGeo(a, b) {
    const out = new THREE.BufferGeometry();
    for (const name of ["position", "normal", "uv"]) {
      const A = a.getAttribute(name), B = b.getAttribute(name);
      const arr = new Float32Array(A.array.length + B.array.length);
      arr.set(A.array, 0); arr.set(B.array, A.array.length);
      out.setAttribute(name, new THREE.BufferAttribute(arr, A.itemSize));
    }
    const ia = a.index ? Array.from(a.index.array) : [], ib = b.index ? Array.from(b.index.array) : [];
    const off = a.getAttribute("position").count;
    out.setIndex(ia.concat(ib.map(i => i + off)));
    return keep(out);
  }
  G.arm = joinGeo(G.shoulder, G.sleeve);
  G.foreHand = joinGeo(G.fore, G.hand);
  const SKIN = [0xffdbac, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0x5c3a21, 0x3d2314];
  const HAIR = [0x111111, 0x2b1a10, 0x4a3020, 0x8a5a2b, 0xc9a24a, 0x9a3b1c];
  const skinMats = SKIN.map(c => lambert(c));
  const hairMats = HAIR.map(c => lambert(c, { flatShading: true }));
  const bootMats = [lambert(0x111111), lambert(0xf2f2f2), lambert(0xff6a1a), lambert(0x2f7cff), lambert(0xd0e85c)];
  const shadowMat = basic(0x000000, { transparent: true, opacity: 0.3, depthWrite: false });
  const matCache = {};
  const colMat = hex => matCache[hex] || (matCache[hex] = lambert(new THREE.Color(hex)));
  const figures = new Map();
  let kitKey = "", kits = null;

  // the crossed floodlight shadows: four soft fans under every player, pointing away from the four pylons,
  // all 88 in one instanced draw
  const fanTex = canvasTexture(32, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, "rgb(150,150,150)"); g.addColorStop(0.35, "rgb(70,70,70)"); g.addColorStop(1, "rgb(0,0,0)");
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const s = c.createLinearGradient(0, 0, w, 0);
    s.addColorStop(0, "rgba(0,0,0,1)"); s.addColorStop(0.3, "rgba(0,0,0,0)"); s.addColorStop(0.7, "rgba(0,0,0,0)"); s.addColorStop(1, "rgba(0,0,0,1)");
    c.fillStyle = s; c.fillRect(0, 0, w, h);
  });
  const fanGeo = keep(new THREE.PlaneGeometry(1, 1));
  fanGeo.rotateZ(-Math.PI / 2); fanGeo.translate(0.5, 0, 0); fanGeo.rotateX(-Math.PI / 2);
  const shadowFans = new THREE.InstancedMesh(fanGeo, keep(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: fanTex ? 0.42 : 0.12, alphaMap: fanTex || null, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 })), 22 * 4);
  shadowFans.count = 0;
  shadowFans.frustumCulled = false;
  scene.add(shadowFans);
  const fanM = new THREE.Matrix4(), fanQ = new THREE.Quaternion(), fanP = new THREE.Vector3(), fanS = new THREE.Vector3(), upY = new THREE.Vector3(0, 1, 0);

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
      // a soft fabric shade from the shoulders down
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "rgba(255,255,255,0.08)"); g.addColorStop(1, "rgba(0,0,0,0.14)");
      c.fillStyle = g; c.fillRect(0, 0, w, h);
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
    const sleeveMat = colMat(kit[0]);
    const shortsHex = kit[1] === kit[0] ? "#ffffff" : kit[1] === "#ffffff" && kit[0] !== "#ffffff" ? kit[0] : kit[1];
    // socks match the shirt, unless the shorts are the stronger colour (a white shirt with dark shorts)
    const sockHex = p.gk ? kit[0] : (kit[0] === "#ffffff" ? shortsHex : kit[0]);
    const M = (geo, mat, parent) => { const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; parent.add(mesh); return mesh; };
    const pelvis = new THREE.Group(); pelvis.position.y = 0.95; body.add(pelvis);
    const shorts = M(G.shorts, colMat(shortsHex), pelvis);
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
    const sh = {}, el = {}, hip = {}, knee = {};
    const boot = bootMats[(h >>> 11) % bootMats.length];
    for (const s of [-1, 1]) {
      const sg = new THREE.Group(); sg.position.set(0, 0.86, s * 0.44); torso.add(sg);
      M(G.arm, sleeveMat, sg);
      const eg = new THREE.Group(); eg.position.y = -0.3; sg.add(eg);
      M(G.foreHand, skin, eg);
      sh[s] = sg; el[s] = eg;
      const hg = new THREE.Group(); hg.position.set(0, -0.0, s * 0.18); pelvis.add(hg);
      M(G.thigh, skin, hg);
      const kg = new THREE.Group(); kg.position.y = -0.5; hg.add(kg);
      M(G.shin, colMat(sockHex), kg);
      M(G.boot, boot, kg);
      hip[s] = hg; knee[s] = kg;
    }
    const shadow = new THREE.Mesh(G.shadow, shadowMat); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.025; g.add(shadow);
    g.scale.setScalar(1.18);
    scene.add(g);
    const J = { lean: 0, roll: 0, twist: 0, bodyY: 0, lift: 0, hipL: 0, hipR: 0, hipLx: 0, hipRx: 0, kneeL: 0, kneeR: 0, shL: 0, shR: 0, shLx: 0, shRx: 0, elL: 0, elR: 0, headX: 0, spin: 0 };
    return { g, body, pelvis, torso, head, sh, el, hip, knee, shirt, shadow, kit, num: p.num, phase: (h % 628) / 100, style: h % 3, cur: Object.assign({}, J), tgt: J, vx: 0, vy: 0, diveT: 0 };
  }

  function syncPlayers(m) {
    const key = m.teams[0].name + "|" + m.teams[1].name;
    if (key !== kitKey) {
      kitKey = key;
      for (const f of figures.values()) scene.remove(f.g);
      figures.clear();
      kits = FL.pickKits(m.teams[0].name, m.teams[1].name);
      colourCrowd(kits, m.userHome === false ? 1 : 0);
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
    const sprint = clamp((speed - 6) / 2.5, 0, 1);
    f.phase += dt * (3 + speed * 1.55);
    const ph = f.phase;
    // lean into turns: the sideways part of the change in velocity, in the player's own frame
    let aLat = 0;
    if (dt > 0) {
      const ax = (p.vx - f.vx) / dt, ay = (p.vy - f.vy) / dt;
      aLat = ax * -Math.sin(p.face) + ay * Math.cos(p.face);
    }
    f.vx = p.vx; f.vy = p.vy;
    T.lean = -(0.05 + 0.2 * A + 0.08 * sprint);
    T.roll = clamp(aLat * 0.03, -0.32, 0.32) * A;
    T.twist = Math.sin(ph) * 0.2 * A;
    T.bodyY = Math.abs(Math.sin(ph)) * 0.06 * A;
    T.lift = 0;
    T.hipL = Math.sin(ph) * (0.95 + 0.25 * sprint) * A; T.hipR = -Math.sin(ph) * (0.95 + 0.25 * sprint) * A;
    T.hipLx = 0; T.hipRx = 0;
    T.kneeL = -(0.12 + A * (0.3 + 1.05 * Math.max(0, Math.sin(ph + 1.6))));
    T.kneeR = -(0.12 + A * (0.3 + 1.05 * Math.max(0, Math.sin(ph + 1.6 + Math.PI))));
    T.shL = -Math.sin(ph) * 0.9 * A; T.shR = Math.sin(ph) * 0.9 * A;
    T.shLx = -0.12; T.shRx = 0.12;
    T.elL = 0.25 + 1.15 * A; T.elR = 0.25 + 1.15 * A;
    T.headX = 0;
    T.spin = 0;
    // standing still: a slow breath and loose arms
    if (A < 0.2) {
      const br = Math.sin(time * 2.3 + f.phase * 0.1);
      T.bodyY += br * 0.012; T.shLx = -0.16 - br * 0.03; T.shRx = 0.16 + br * 0.03; T.headX = br * 0.03;
    }
    if (hasBall) { T.lean -= 0.08; T.bodyY -= 0.04; T.elL = 0.6; T.elR = 0.6; T.shLx = -0.35; T.shRx = 0.35; }
    if (p.kickAnim > 0) {
      const u = 1 - p.kickAnim / 0.35;
      const sw = Math.sin(u * Math.PI);
      T.hipR = -0.6 + sw * 1.9; T.kneeR = -0.2 - (1 - sw) * 0.7; T.hipL = -0.1; T.shL = 0.9 * sw; T.shR = -0.5 * sw;
      T.shLx = -0.6 * sw; T.elL = 0.5;
      T.lean = -0.18 + sw * 0.12; T.twist = -0.35 * sw;
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
      else if (M.type === "feint") { T.roll = s * 0.55 * Math.sin(u * Math.PI * 2); T.shLx = -0.7; T.shRx = 0.7; }
      else if (M.type === "dragback") { T.lean = 0.3; T.hipR = -0.9 * Math.sin(u * Math.PI); T.kneeR = -0.4; }
      else if (M.type === "nutmeg") T.bodyY = 0.28 * Math.sin(u * Math.PI);
      if (!M.ok && u > 0.6) { T.roll = 0.3 * s; T.lean = -0.4; }
    }
    // in the air (a header or a jump): legs tuck, arms out for balance, and the head snaps through the ball
    const air = Math.max(0, Number(p.air) || (typeof p.jump === "number" ? p.jump : 0) || 0);
    // the deep sim times a header with headT (0.45 s at contact); headerAnim is the same idea on a 0.4 s scale
    const headA = p.headerAnim > 0 ? p.headerAnim : p.headT > 0 ? p.headT * (0.4 / 0.45) : 0;
    if (air > 0.05 || headA > 0) {
      T.lift = air;
      T.kneeL = -0.9; T.kneeR = -0.6; T.hipL = 0.35; T.hipR = 0.1;
      T.shL = -0.5; T.shR = -0.5; T.shLx = -1.15; T.shRx = 1.15; T.elL = 0.6; T.elR = 0.6;
      if (headA > 0) {
        const u = clamp(1 - headA / 0.4, 0, 1);
        T.lean = 0.3 * (1 - u) - 0.55 * Math.sin(u * Math.PI * 0.5);
        T.headX = -0.75 * Math.sin(u * Math.PI);
      } else T.lean = 0.2;
    }
    if (p.slide) {
      const u = clamp(p.slide.t / p.slide.dur, 0, 1);
      T.lean = 1.25; T.bodyY = -0.62; T.hipL = 0.9; T.hipR = 1.4 - u * 0.4; T.kneeL = -0.5; T.kneeR = -0.1; T.shL = -1.3; T.shR = -1.6; T.shLx = -0.8; T.shRx = 0.9; T.headX = -0.5; T.elL = 0.2; T.elR = 0.2;
    } else if (p.down > 0) {
      const up = clamp(1 - p.down / 0.3, 0, 1);
      T.lean = 1.4 * (1 - up); T.bodyY = -0.6 * (1 - up) - 0.08; T.hipL = 0.6 * (1 - up); T.hipR = 1.1 * (1 - up); T.shL = -0.8; T.shR = -2.2 * (1 - up); T.shRx = 0.9 * (1 - up);
    }
    // keeper dive: a full stretch sideways in an arc, arms over the head toward the ball
    if (p.diving) {
      f.diveT += dt;
      const u = clamp(f.diveT / 0.55, 0, 1);
      const dir = (p.vy >= 0 ? 1 : -1) * (Math.cos(p.face) >= 0 ? 1 : -1);
      T.roll = 1.4 * dir * Math.min(1, u * 2.2); T.bodyY = 0.05; T.lift = Math.sin(u * Math.PI) * 0.75;
      T.shL = -2.9; T.shR = -2.9; T.shLx = -0.35 * dir; T.shRx = -0.35 * dir; T.elL = 0.1; T.elR = 0.1;
      T.hipL = -0.15; T.hipR = 0.2; T.kneeL = -0.2; T.kneeR = -0.5; T.lean = -0.1; T.twist = 0;
    } else f.diveT = 0;
    if (p.celebrate > 0) {
      const bounce = Math.abs(Math.sin(time * 7));
      if (f.style === 1) { T.shL = -0.2; T.shR = -0.2; T.shLx = -1.5; T.shRx = 1.5; T.roll = Math.sin(time * 3) * 0.25; T.elL = 0; T.elR = 0; T.lean = -0.15; }
      else if (f.style === 2) { T.shR = -2.9; T.shRx = 0.2; T.elR = 0.2; T.shL = 0.4; T.elL = 1.6; T.bodyY = bounce * 0.2; T.headX = -0.25; }
      else { T.shL = -2.9; T.shR = -2.9; T.shLx = -0.4; T.shRx = 0.4; T.bodyY = bounce * 0.3; T.lean = 0.05; T.headX = -0.3; T.elL = 0.15; T.elR = 0.15; }
    }
    if (p.stun > 0 && !p.stumble && !p.down && !p.slide) { T.lean = 0.12; T.shL = 0.5; T.shR = 0.5; }
    // smooth toward the targets, with a stiffer follow when the pose is a hard one
    const k = Math.min(1, dt * (p.slide || p.kickAnim > 0 || p.diving || p.headerAnim > 0 || p.headT > 0 ? 24 : 14));
    const C = f.cur;
    for (const key in T) C[key] += (T[key] - C[key]) * k;
    f.body.rotation.z = C.lean;
    f.body.rotation.x = C.roll;
    // the figure stays on the sim's spot; a jump or a dive lifts the body inside it, the shadow stays down
    f.body.position.y = C.bodyY + C.lift / 1.18;
    f.torso.rotation.y = C.twist;
    f.hip[1].rotation.z = C.hipL; f.hip[-1].rotation.z = C.hipR;
    f.hip[1].rotation.x = C.hipLx; f.hip[-1].rotation.x = C.hipRx;
    f.knee[1].rotation.z = C.kneeL; f.knee[-1].rotation.z = C.kneeR;
    f.sh[1].rotation.z = C.shL; f.sh[-1].rotation.z = C.shR;
    f.sh[1].rotation.x = C.shLx; f.sh[-1].rotation.x = C.shRx;
    f.el[1].rotation.z = C.elL; f.el[-1].rotation.z = C.elR;
    f.head.rotation.z = C.headX;
    f.g.rotation.y = -p.face + C.spin;
    f.shadow.scale.setScalar(p.slide || p.down > 0 ? 1.5 : 1);
  }
  // the four floodlight shadow fans of one player, written into the shared instanced mesh
  function placeFans(n, x, z, lift) {
    const fade = clamp(1 - lift / 1.5, 0, 1);
    for (let i = 0; i < PYLONS.length; i++) {
      const dx = x - PYLONS[i][0], dz = z - PYLONS[i][1];
      const ang = Math.atan2(dz, dx);
      fanQ.setFromAxisAngle(upY, -ang);
      fanP.set(x, 0.02, z);
      const len = 2.6 + Math.hypot(dx, dz) * 0.012;
      fanS.set(len * fade + 0.001, 1, 0.75);
      fanM.compose(fanP, fanQ, fanS);
      shadowFans.setMatrixAt(n++, fanM);
    }
    return n;
  }

  // ---------- HUD (DOM) in the site design language, framed like a TV broadcast ----------
  // Scorebug top left (club codes, kit colours, score, running clock, half), a set piece banner under it, the
  // player card bottom left, commentary lines that slide in at the bottom, and the goal moment: a band in the
  // scorer's colours, a big GOAL that punches in, sparks, and the scorer's name. Transform and opacity only.
  // The styles live here (injected once) so the view carries its whole look.
  const HUD_CSS = `
#m3dHud{position:absolute;inset:0;pointer-events:none;z-index:3;overflow:hidden;font-family:var(--k-f-ui,Inter,system-ui,sans-serif);color:#fff;--m3-acc:var(--k-volt,#d0e85c);--m3-lbl:var(--k-f-lbl,"Chakra Petch",Inter,system-ui,sans-serif);--m3-ease:cubic-bezier(.22,1,.36,1)}
#m3dHud .m3-bug{position:absolute;top:18px;left:18px;display:flex;flex-direction:column;align-items:flex-start}
#m3dHud .m3-bugglow{position:absolute;left:-14px;top:-14px;right:-14px;height:66px;background:radial-gradient(closest-side,var(--m3-hot,#d0e85c),transparent);opacity:0}
#m3dHud .m3-bug.hot .m3-bugglow{animation:m3glow 1.8s var(--m3-ease) both}
#m3dHud .m3-row{position:relative;display:flex;align-items:stretch;height:38px;background:linear-gradient(180deg,rgba(16,21,30,.97),rgba(6,9,14,.97));box-shadow:inset 0 0 0 1px rgba(255,255,255,.12),0 12px 28px rgba(0,0,0,.5);clip-path:polygon(0 0,100% 0,100% 100%,10px 100%,0 calc(100% - 10px))}
#m3dHud .m3-brand{display:grid;place-items:center;width:34px;background:var(--k-grad-pitch,linear-gradient(135deg,#e4f68c,#2fd27a));color:#0b1206;font:800 12px/1 var(--m3-lbl);letter-spacing:.02em}
#m3dHud .m3-tm{display:flex;align-items:center;gap:8px;padding:0 12px;font:700 16px/1 var(--m3-lbl);letter-spacing:.08em}
#m3dHud .m3-kit{display:block;width:5px;height:22px;border-radius:1px;background:#888}
#m3dHud .m3-sc{display:flex;align-items:center;justify-content:center;min-width:72px;padding:0 6px;background:#f4f6f0;color:#05070b;font:800 22px/1 var(--m3-lbl);font-variant-numeric:tabular-nums;overflow:hidden}
#m3dHud .m3-d{display:inline-block;min-width:20px;text-align:center}
#m3dHud .m3-d.roll{animation:m3roll .55s var(--m3-ease) both}
#m3dHud .m3-sep{display:inline-block;width:8px;height:2px;margin:0 5px;background:#05070b;opacity:.45}
#m3dHud .m3-clk{display:grid;place-items:center;min-width:74px;padding:0 12px;border-left:1px solid rgba(255,255,255,.12);font:700 17px/1 var(--m3-lbl);letter-spacing:.04em;color:var(--m3-acc);font-variant-numeric:tabular-nums}
#m3dHud .m3-sub{margin-left:34px;display:flex;gap:10px;padding:5px 14px 6px 10px;background:rgba(6,9,14,.9);font:700 10px/1 var(--m3-lbl);letter-spacing:.16em;color:#9aa3b2;clip-path:polygon(0 0,100% 0,calc(100% - 8px) 100%,0 100%)}
#m3dHud .m3-sub b{color:#fff;font-weight:700}
#m3dHud .m3-sp{position:absolute;top:88px;left:18px;display:flex;align-items:center;gap:10px;padding:8px 16px 8px 14px;background:rgba(6,9,14,.92);box-shadow:inset 4px 0 0 var(--m3-spc,var(--m3-acc)),inset 0 0 0 1px rgba(255,255,255,.1);font:700 13px/1 var(--m3-lbl);letter-spacing:.18em;opacity:0;transform:translateX(-16px);transition:opacity .25s ease,transform .4s var(--m3-ease)}
#m3dHud .m3-sp.on{opacity:1;transform:none}
#m3dHud .m3-sp i{display:block;width:8px;height:8px;border-radius:50%;background:var(--m3-spc,var(--m3-acc));box-shadow:0 0 10px var(--m3-spc,var(--m3-acc))}
#m3dHud .m3-help{position:absolute;top:18px;left:50%;transform:translateX(-50%);text-align:center;transition:opacity .6s;opacity:0;max-width:56vw}
#m3dHud .m3-help1{display:inline-block;font:700 15px/1.2 var(--m3-lbl);letter-spacing:.12em;color:var(--m3-acc);background:rgba(6,9,14,.86);padding:7px 16px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}
#m3dHud .m3-help2{margin-top:8px;display:inline-block;font-size:12.5px;color:#dbe1ea;background:rgba(6,9,14,.76);padding:5px 12px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
#m3dHud .m3-card{position:absolute;left:18px;bottom:18px;display:flex;align-items:stretch;min-width:220px;background:linear-gradient(180deg,rgba(16,21,30,.95),rgba(6,9,14,.95));box-shadow:inset 0 0 0 1px rgba(255,255,255,.12);clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))}
#m3dHud.m3-nocard .m3-card{display:none}
#m3dHud .m3-cnum{display:grid;place-items:center;min-width:56px;font:700 30px/1 var(--m3-lbl);background:#333;color:#fff}
#m3dHud .m3-cinfo{padding:9px 14px 10px 12px;min-width:150px}
#m3dHud .m3-cname{font-weight:700;font-size:14px;letter-spacing:.03em}
#m3dHud .m3-cmeta{margin-top:3px;font:700 10px/1.2 var(--m3-lbl);letter-spacing:.12em;color:#9aa3b2;white-space:pre}
#m3dHud .m3-stam{height:4px;margin-top:8px;background:rgba(255,255,255,.1);overflow:hidden}
#m3dHud .m3-stam div{height:100%;width:100%;transform-origin:left center;background:linear-gradient(90deg,#2fd27a,var(--m3-acc));transition:transform .25s ease}
#m3dHud .m3-feed{position:absolute;left:50%;bottom:84px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;width:min(760px,86vw)}
#m3dHud .m3-line{max-width:100%;padding:8px 18px 8px 14px;background:rgba(6,9,14,.9);box-shadow:inset 3px 0 0 var(--m3-acc),inset 0 0 0 1px rgba(255,255,255,.08);font-weight:600;font-size:clamp(13px,1.8vw,18px);letter-spacing:.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;animation:m3line .4s var(--m3-ease) both;transition:opacity .45s ease,transform .45s var(--m3-ease)}
#m3dHud .m3-line.old{opacity:.5;transform:scale(.94)}
#m3dHud .m3-line.out{opacity:0;transform:translateY(-10px) scale(.94)}
#m3dHud .m3-goal{position:absolute;left:0;right:0;top:38%;height:0;opacity:0;--m3-gc:#d0e85c;--m3-gt:#05070b}
#m3dHud .m3-goal.in{opacity:1}
#m3dHud .m3-gband{position:absolute;left:-12%;right:-12%;top:-62px;height:124px;background:linear-gradient(90deg,transparent,var(--m3-gc) 16%,var(--m3-gc) 84%,transparent);transform:skewY(-3deg) scaleX(0);opacity:.92}
#m3dHud .m3-gband::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 30%,rgba(255,255,255,.55) 50%,transparent 70%);transform:translateX(-100%)}
#m3dHud .m3-goal.in .m3-gband{animation:m3band 2.9s var(--m3-ease) forwards}
#m3dHud .m3-goal.in .m3-gband::after{animation:m3shine 1.1s .2s ease-out forwards}
#m3dHud .m3-gword{position:absolute;left:0;right:0;top:-68px;text-align:center;font:900 clamp(64px,12vw,150px)/1 var(--k-f-ui,Inter,sans-serif);letter-spacing:-.03em;text-transform:uppercase;color:var(--m3-gt);opacity:0}
#m3dHud .m3-goal.in .m3-gword{animation:m3word 2.9s cubic-bezier(.34,1.56,.64,1) forwards}
#m3dHud .m3-gsub{position:absolute;left:50%;top:76px;display:flex;align-items:stretch;transform:translateX(-50%);opacity:0;white-space:nowrap}
#m3dHud .m3-goal.in .m3-gsub{animation:m3sub 2.9s var(--m3-ease) forwards}
#m3dHud .m3-gnum{display:grid;place-items:center;min-width:44px;padding:0 10px;background:var(--m3-gc);color:var(--m3-gt);font:800 20px/1 var(--m3-lbl)}
#m3dHud .m3-gname{padding:10px 18px;background:rgba(6,9,14,.94);font:700 clamp(14px,2.2vw,22px)/1 var(--m3-lbl);letter-spacing:.14em;text-transform:uppercase;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
#m3dHud .m3-spk{position:absolute;left:50%;top:0;width:9px;height:9px;margin:-4px 0 0 -4px;border-radius:2px;background:var(--c);opacity:0}
#m3dHud .m3-goal.in .m3-spk{animation:m3spk 1.2s var(--d) cubic-bezier(.16,1,.3,1) both}
#m3dHud .m3-flash{position:absolute;inset:0;background:#ffffff;opacity:0;pointer-events:none}
@keyframes m3roll{0%{transform:translateY(95%);opacity:0}60%{transform:translateY(-10%);opacity:1}100%{transform:none;opacity:1}}
@keyframes m3glow{0%{opacity:0}25%{opacity:.75}100%{opacity:0}}
@keyframes m3line{from{opacity:0;transform:translateX(-30px)}to{opacity:1;transform:none}}
@keyframes m3band{0%{transform:skewY(-3deg) scaleX(0)}13%{transform:skewY(-3deg) scaleX(1)}82%{transform:skewY(-3deg) scaleX(1);opacity:.92}100%{transform:skewY(-3deg) scaleX(1.04);opacity:0}}
@keyframes m3shine{to{transform:translateX(100%)}}
@keyframes m3word{0%{transform:scale(.35);opacity:0}11%{transform:scale(1.08);opacity:1}20%{transform:scale(1)}84%{transform:scale(1);opacity:1}100%{transform:scale(1.1);opacity:0}}
@keyframes m3sub{0%,10%{transform:translate(-50%,18px);opacity:0}22%{transform:translate(-50%,0);opacity:1}84%{transform:translate(-50%,0);opacity:1}100%{transform:translate(-50%,-6px);opacity:0}}
@keyframes m3spk{0%{transform:translate(0,0) scale(1) rotate(0);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(.3) rotate(240deg);opacity:0}}
@media (max-width:760px){#m3dHud .m3-tm{font-size:13px;padding:0 8px}#m3dHud .m3-sc{font-size:18px;min-width:58px}#m3dHud .m3-clk{min-width:58px;font-size:14px}#m3dHud .m3-card{min-width:0}#m3dHud .m3-cinfo{min-width:110px}#m3dHud .m3-help2{display:none}#m3dHud .m3-help{top:auto;bottom:140px;max-width:90vw}}
@media (prefers-reduced-motion:reduce){#m3dHud *,#m3dHud *::after{animation:none!important;transition:none!important}#m3dHud .m3-goal.in .m3-gband{transform:skewY(-3deg)}#m3dHud .m3-goal.in .m3-gword,#m3dHud .m3-goal.in .m3-gsub{opacity:1}#m3dHud .m3-spk{display:none}#m3dHud .m3-flash{display:none}}
`;
  const reduceMotion = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;
  const fx = { time: 0, shake: 0, zoom: 0, zoomT: 0, goalT: 0, goalText: "", goalSub: "", toast: "", toastT: 0, toastN: 0, crowd: 0, flash: 0, spT: 0, spText: "", board: 0 };
  let hudEl = null, els = null;
  const feed = [];
  function el(tag, cls, parent, text) {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    (parent || hudEl).appendChild(e);
    return e;
  }
  // three letter club codes like a TV bug: a few well known ones, then the first letters of the main word
  const CODES = { "manchester city": "MCI", "manchester united": "MUN", "tottenham hotspur": "TOT", "tottenham": "TOT", "newcastle united": "NEW", "west ham united": "WHU", "west ham": "WHU", "nottingham forest": "NFO", "crystal palace": "CRY", "aston villa": "AVL", "real madrid": "RMA", "paris saint germain": "PSG", "paris sg": "PSG", "psg": "PSG", "bayern munich": "FCB", "bayern munchen": "FCB", "borussia dortmund": "BVB", "atletico madrid": "ATM", "inter milan": "INT", "inter": "INT", "ac milan": "MIL", "wolverhampton wanderers": "WOL", "wolves": "WOL", "brighton": "BHA", "brighton and hove albion": "BHA", "sheffield united": "SHU", "leeds united": "LEE", "west bromwich albion": "WBA", "queens park rangers": "QPR", "bayer leverkusen": "B04", "rb leipzig": "RBL", "red bull salzburg": "RBS", "sporting cp": "SCP", "real sociedad": "RSO", "real betis": "BET", "athletic club": "ATH", "olympique lyonnais": "OL", "olympique de marseille": "OM", "manchester utd": "MUN", "man city": "MCI", "man utd": "MUN", "man united": "MUN" };
  function clubCode(name) {
    const plain = String(name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, "and").replace(/[^A-Za-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    const low = plain.toLowerCase();
    if (CODES[low]) return CODES[low];
    const words = plain.split(" ").filter(w => !/^(fc|afc|cf|sc|ac|as|ss|club|de|del|la|le|the|and|of|1|04|05|09)$/i.test(w));
    const main = (words[0] || plain || "???").toUpperCase();
    return (main.length >= 3 ? main.slice(0, 3) : (main + (words[1] || "XX").toUpperCase()).slice(0, 3));
  }
  const lum = hex => { const c = new THREE.Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; };
  if (doc && wrap && doc.createElement) {
    if (doc.head && !doc.getElementById("m3dStyle")) {
      const st = doc.createElement("style");
      st.id = "m3dStyle";
      st.textContent = HUD_CSS;
      doc.head.appendChild(st);
    }
    hudEl = doc.createElement("div");
    hudEl.id = "m3dHud";
    wrap.appendChild(hudEl);
    els = {};
    els.bug = el("div", "m3-bug");
    els.bugGlow = el("div", "m3-bugglow", els.bug);
    const row = el("div", "m3-row", els.bug);
    el("span", "m3-brand", row, "FL");
    const th = el("span", "m3-tm", row);
    els.homeBar = el("i", "m3-kit", th);
    els.homeName = el("b", "", th, "");
    const sc = el("span", "m3-sc", row);
    els.sh = el("span", "m3-d", sc, "0");
    el("i", "m3-sep", sc);
    els.sa = el("span", "m3-d", sc, "0");
    const ta = el("span", "m3-tm", row);
    els.awayName = el("b", "", ta, "");
    els.awayBar = el("i", "m3-kit", ta);
    els.clock = el("span", "m3-clk", row, "00:00");
    const sub = el("div", "m3-sub", els.bug);
    els.half = el("b", "", sub, "1ST HALF");
    els.subTxt = el("span", "", sub, "LIVE");
    els.score = sc;
    els.sp = el("div", "m3-sp");
    el("i", "", els.sp);
    els.spText = el("span", "", els.sp, "");
    els.help = el("div", "m3-help");
    els.help1 = el("div", "m3-help1", els.help, "YOU ATTACK TO THE RIGHT");
    els.help2 = el("div", "m3-help2", els.help, "WASD move  ·  Shift sprint  ·  Q pass  ·  T through ball  ·  hold E shoot  ·  F skill move  ·  Space tackle  ·  X slide  ·  Esc pause");
    const card = el("div", "m3-card");
    els.cardNum = el("div", "m3-cnum", card, "");
    const ci = el("div", "m3-cinfo", card);
    els.cardName = el("div", "m3-cname", ci, "");
    els.cardMeta = el("div", "m3-cmeta", ci, "");
    const stm = el("div", "m3-stam", ci);
    els.stam = el("div", "", stm);
    els.feed = el("div", "m3-feed");
    els.ticker = els.feed;
    els.goal = el("div", "m3-goal");
    el("div", "m3-gband", els.goal);
    els.goalT = el("div", "m3-gword", els.goal, "");
    const gs = el("div", "m3-gsub", els.goal);
    els.goalN = el("span", "m3-gnum", gs, "");
    els.goalS = el("span", "m3-gname", gs, "");
    const SPARK = ["#d0e85c", "#2fd27a", "#ffcf5a", "#3ee6c4", "#ffffff", "#ff8a3d"];
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + (i % 3) * 0.2, r = 160 + (i * 37) % 140;
      const sp = el("i", "m3-spk", els.goal);
      sp.style.setProperty("--c", SPARK[i % SPARK.length]);
      sp.style.setProperty("--dx", Math.round(Math.cos(a) * r * 1.6) + "px");
      sp.style.setProperty("--dy", Math.round(Math.sin(a) * r * 0.55) + "px");
      sp.style.setProperty("--d", ((i % 5) * 0.03).toFixed(2) + "s");
    }
    els.flash = el("div", "m3-flash");
    els.cache = {};
  }
  function restart(node, cls) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }
  function sayFeed(text) {
    if (!els) return;
    for (const f of feed) f.el.classList.add("old");
    const line = el("div", "m3-line", els.feed, text);
    feed.push({ el: line, t: fx.time });
    while (feed.length > 2) { const f = feed.shift(); f.el.remove(); }
  }
  const SP_TEXT = { corner: "CORNER", freekick: "FREE KICK", penalty: "PENALTY", goalkick: "GOAL KICK", throwin: "THROW IN", kickoff: "KICK OFF", foul: "FOUL" };
  function setPieceBanner(text, team) {
    fx.spText = text; fx.spT = 2.6;
    if (!els) return;
    els.spText.textContent = text;
    els.sp.style.setProperty("--m3-spc", kits && team !== undefined && kits[team] ? kits[team][0] : "var(--m3-acc)");
  }
  function clockText(sim, m) {
    if (m.phase === "halftime") return "HT";
    if (m.phase === "full") return "FT";
    const halfLen = (FL.MATCH_SECONDS || 360) / 2;
    let gs;
    if (typeof m.t === "number") gs = m.half === 1 ? Math.min(2700, m.t / halfLen * 2700) : 2700 + Math.min(2700, Math.max(0, m.t - halfLen) / halfLen * 2700);
    else gs = sim.minute() * 60;
    gs = Math.floor(gs);
    const mm = Math.floor(gs / 60), ss = gs % 60;
    return (mm < 10 ? "0" : "") + mm + ":" + (ss < 10 ? "0" : "") + ss;
  }
  function updateHud(sim, m, dt) {
    if (!els) return;
    const r = sim.result();
    const homeT = m.userHome ? m.teams[0] : m.teams[1], awayT = m.userHome ? m.teams[1] : m.teams[0];
    if (els.cache.names !== homeT.name + awayT.name + kitKey) {
      els.cache.names = homeT.name + awayT.name + kitKey;
      els.homeName.textContent = clubCode(homeT.name);
      els.awayName.textContent = clubCode(awayT.name);
      els.homeName.parentNode.title = homeT.name; els.awayName.parentNode.title = awayT.name;
      if (kits) { els.homeBar.style.background = kits[homeT.idx][0]; els.awayBar.style.background = kits[awayT.idx][0]; }
    }
    if (els.cache.h !== r.home) { if (els.cache.h !== undefined) restart(els.sh, "roll"); els.cache.h = r.home; els.sh.textContent = String(r.home); }
    if (els.cache.a !== r.away) { if (els.cache.a !== undefined) restart(els.sa, "roll"); els.cache.a = r.away; els.sa.textContent = String(r.away); }
    els.cache.sc = r.home + "  " + r.away;
    const ct = clockText(sim, m);
    if (els.cache.ct !== ct) { els.cache.ct = ct; els.clock.textContent = ct; }
    const hf = m.phase === "full" ? "FULL TIME" : m.phase === "halftime" ? "HALF TIME" : m.half === 1 ? "1ST HALF" : "2ND HALF";
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
        els.stam.style.transform = "scaleX(" + clamp(c.stamina, 0, 1).toFixed(3) + ")";
        els.stam.style.background = m.tired ? "#ff5d5d" : c.stamina > 0.35 ? "" : "#ffb547";
      }
      hudEl.classList.remove("m3-nocard");
    } else hudEl.classList.add("m3-nocard");
    const showHelp = !m.auto && m.half === 1 && m.t < 14 && m.phase !== "goal";
    if (els.cache.help !== showHelp) { els.cache.help = showHelp; els.help.style.opacity = showHelp ? "1" : "0"; }
    // set pieces: the sim's own marker wins, an event banner shows for a moment
    const sp = m.setPiece && m.setPiece.phase !== "taken" ? m.setPiece : null;
    const spKey = sp ? sp.kind + sp.team : "";
    if (spKey !== els.cache.spk) { els.cache.spk = spKey; if (sp && SP_TEXT[sp.kind] && sp.kind !== "kickoff") setPieceBanner(SP_TEXT[sp.kind], sp.team); }
    const spOn = fx.spT > 0 || (sp && sp.kind !== "kickoff");
    if (els.cache.spOn !== spOn) { els.cache.spOn = spOn; els.sp.classList.toggle("on", !!spOn); }
    // commentary lines fade out after a while, the newest stays longest
    for (let i = feed.length - 1; i >= 0; i--) {
      const f = feed[i], age = fx.time - f.t;
      if (age > 4.6 && !f.out) { f.out = true; f.el.classList.add("out"); }
      if (age > 5.2) { f.el.remove(); feed.splice(i, 1); }
    }
    if (fx.goalT <= 0 && els.cache.goal) { els.cache.goal = ""; els.goal.classList.remove("in"); }
    els.flash.style.opacity = reduceMotion ? "0" : String(fx.flash * 0.45);
  }
  function goalMoment(ev) {
    if (!els) return;
    const kit = kits && kits[ev.team] ? kits[ev.team] : ["#d0e85c", "#05070b"];
    els.goal.style.setProperty("--m3-gc", kit[0]);
    const light = lum(kit[0]) > 0.45;
    els.goal.style.setProperty("--m3-gt", light ? "#05070b" : "#ffffff");
    els.goalT.textContent = ev.own ? "OWN GOAL" : "GOAL";
    const scorer = ev.scorer !== undefined && ev.scorer >= 0 && lastSim ? lastSim.m.players.find(p => p.id === ev.scorer) : null;
    els.goalN.textContent = scorer && scorer.num !== undefined ? String(scorer.num) : String(ev.min || "") + "'";
    els.goalS.textContent = (ev.name || "") + "  " + (ev.min ? ev.min + "'" : "");
    els.cache.goal = "on";
    restart(els.goal, "in");
    els.bug.style.setProperty("--m3-hot", kit[0]);
    restart(els.bug, "hot");
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

  // ---------- set piece aim marker (driven by m.aim): a target ring on the grass and a dotted flight arc ----------
  const aimMat = basic(0xd0e85c, { transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false });
  const aimRing = add(new THREE.RingGeometry(0.85, 1.08, 32), aimMat, 0, 0.06, 0);
  aimRing.rotation.x = -Math.PI / 2;
  aimRing.visible = false;
  const aimFillMat = basic(0xd0e85c, { transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
  const aimFill = add(new THREE.CircleGeometry(0.85, 32), aimFillMat, 0, 0.055, 0);
  aimFill.rotation.x = -Math.PI / 2;
  aimFill.visible = false;
  const AIM_N = 30;
  const aimGeo = keep(new THREE.BufferGeometry());
  aimGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(AIM_N * 3), 3));
  const aimLine = new THREE.Line(aimGeo, keep(new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.55, gapSize: 0.4, transparent: true, opacity: 0.85, depthWrite: false })));
  aimLine.visible = false;
  aimLine.frustumCulled = false;
  scene.add(aimLine);
  function updateAim(m, time) {
    const a = m.aim;
    const on = !!(a && Number.isFinite(a.x) && Number.isFinite(a.y));
    aimRing.visible = aimFill.visible = aimLine.visible = on;
    if (!on) return;
    const b = m.ball;
    aimRing.position.set(a.x, 0.06, a.y);
    const pw = clamp(a.power === undefined ? 0.6 : a.power, 0, 1);
    aimFill.position.set(a.x, 0.055, a.y);
    aimFill.scale.setScalar(0.15 + pw * 0.85);
    aimRing.scale.setScalar(1 + Math.sin(time * 6) * 0.05);
    const peak = a.z === undefined ? 3 : a.z, curve = clamp(a.curve || 0, -1, 1);
    const P = aimGeo.attributes.position.array;
    const dx = a.x - b.x, dy = a.y - b.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    for (let i = 0; i < AIM_N; i++) {
      const t = i / (AIM_N - 1), bend = Math.sin(t * Math.PI) * curve * len * 0.18;
      P[i * 3] = b.x + dx * t + nx * bend;
      P[i * 3 + 1] = BALL_R + Math.max(0, b.z || 0) * (1 - t) + 4 * peak * t * (1 - t);
      P[i * 3 + 2] = b.y + dy * t + ny * bend;
    }
    aimGeo.attributes.position.needsUpdate = true;
    aimLine.computeLineDistances();
  }

  // ---------- camera: the main broadcast camera on the gantry, leading the play like a TV director ----------
  // It pans on a critically damped spring toward the ball plus a lead in the direction of play, dollies in when
  // the ball nears a goal or a set piece is on, eases out for long balls, and still pulls in hard on goals.
  const cam = { x: 0, z: 0, vx: 0, vz: 0, d: 0, lead: 0, snap: true };
  const look = new THREE.Vector3();
  let viewW = 0, viewH = 0, time = 0, frames = 0, baseFov = 30, lastSim = null;
  let frameAvg = 1 / 60, slowT = 0, workAvg = 0;
  const now = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
  const H_FOV = 36;

  function applyQuality() {
    if (own) renderer.setPixelRatio(Math.min((typeof window !== "undefined" && window.devicePixelRatio) || 1, DPR[quality]));
    if (own) renderer.shadowMap.enabled = quality > 0;
    sun.castShadow = quality > 0;
    if (quality > 0 && sun.shadow) { sun.shadow.mapSize.set(SHADOW_MAP[quality], SHADOW_MAP[quality]); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    crowd.count = quality === 0 ? Math.floor(crowdN * 0.5) : crowdN;
    heads.count = crowd.count;
    shadowFans.visible = quality > 0;
    for (const mat of rakeMats) mat.uniforms.uDetail.value = quality === 0 ? 0 : 1;
    for (const g of glares) g.visible = quality > 0;
    for (const f of figures.values()) f.g.traverse(o => { if (o.isMesh) o.castShadow = quality > 0 && o !== f.shadow; });
  }
  function resize() {
    const w = (hud && hud.clientWidth) || (wrap && wrap.clientWidth) || opts.width || 960;
    const h = (hud && hud.clientHeight) || (wrap && wrap.clientHeight) || opts.height || 540;
    if (w === viewW && h === viewH) return;
    viewW = w; viewH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const hf = H_FOV * Math.PI / 180;
    baseFov = clamp(2 * Math.atan(Math.tan(hf / 2) / camera.aspect) * 180 / Math.PI, 20, 58);
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
  }

  function onEvent(ev) {
    if (ev.type === "goal") {
      fx.crowd = 3.2; fx.shake = 0.9; fx.zoomT = 2.4; fx.flash = 1; fx.goalT = 2.9; fx.board = 4.5; fx.flashCrowd = 1;
      fx.goalText = ev.own ? "OWN GOAL!" : "GOAL!";
      fx.goalSub = ev.name + "  " + ev.min + "'";
      const n = nets[ev.team === 0 ? 1 : 0];
      if (n) n.bulge = 1;
      goalMoment(ev);
    } else if (ev.type === "save" && ev.big) { fx.crowd = Math.max(fx.crowd, 0.9); fx.shake = Math.max(fx.shake, 0.3); }
    else if (ev.type === "post") fx.shake = Math.max(fx.shake, 0.45);
    else if (ev.type === "tackle" && ev.kind === "slide" && ev.ok) { fx.shake = Math.max(fx.shake, 0.25); fx.crowd = Math.max(fx.crowd, 0.6); }
    else if (ev.type === "skill" && ev.ok) fx.crowd = Math.max(fx.crowd, 0.7);
    else if (ev.type === "miss") fx.crowd = Math.max(fx.crowd, 0.5);
    else if (ev.type === "say") { fx.toast = ev.text; fx.toastT = 3.6; fx.toastN++; sayFeed(ev.text); }
    else if (ev.type === "header") { fx.crowd = Math.max(fx.crowd, 0.5); fx.shake = Math.max(fx.shake, 0.15); }
    if (SP_TEXT[ev.type] && ev.type !== "kickoff") {
      setPieceBanner(SP_TEXT[ev.type], ev.team);
      fx.crowd = Math.max(fx.crowd, ev.type === "penalty" ? 1.3 : ev.type === "corner" ? 0.6 : 0.3);
    }
    if (ev.banner) setPieceBanner(String(ev.banner).toUpperCase(), ev.team);
  }

  // where the director wants the camera: x along the pitch, z across, and a dolly (minus is tighter)
  function camWant(m, dt) {
    const b = m.ball;
    const own = b.owner;
    const dir = own ? ((m.teams[own.team] && m.teams[own.team].dir) || (own.team === 0 ? 1 : -1)) : 0;
    const leadWant = dir * 5 + clamp(b.vx * 0.45, -9, 9);
    cam.lead += (leadWant - cam.lead) * (1 - Math.exp(-dt * 1.6));
    let tx = b.x + cam.lead, tz = clamp(b.y * 0.35, -9, 9);
    const near = clamp((Math.abs(b.x) - 28) / 18, 0, 1);
    const fast = clamp((Math.hypot(b.vx, b.vy) - 14) / 10, 0, 1);
    let d = -0.55 * near + 0.6 * fast;
    if (m.phase === "kickoff" || m.phase === "halftime" || m.phase === "full") d = 0.35;
    const sp = m.setPiece && m.setPiece.phase !== "taken" ? m.setPiece : null;
    if (sp && Number.isFinite(sp.x)) {
      const sg = sp.x >= 0 ? 1 : -1;
      if (sp.kind === "corner") { tx = sg * (L - 14); tz = clamp(sp.y * 0.22, -6, 6); d = -0.85; }
      else if (sp.kind === "penalty") { tx = sg * (L - 10); tz = 0; d = -1.1; }
      else if (sp.kind === "freekick") { tx = sp.x + (sg * L - sp.x) * 0.4; tz = clamp(sp.y * 0.3, -8, 8); d = -0.5; }
      else if (sp.kind === "goalkick") { tx = sg * (L - 22); d = 0.3; }
      else if (sp.kind === "throwin") { tx = sp.x; tz = clamp(sp.y * 0.3, -8, 8); d = -0.2; }
      else if (sp.kind === "kickoff") { tx = 0; tz = 0; d = 0.35; }
    }
    return { tx: clamp(tx, -(L - 12), L - 12), tz, d };
  }

  function draw(sim, dt) {
    const t0 = now();
    resize();
    time += dt;
    fx.time = time;
    frames++;
    lastSim = sim || lastSim;
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
    fx.spT = Math.max(0, fx.spT - dt);
    fx.crowd = Math.max(0, fx.crowd - dt);
    fx.board = Math.max(0, fx.board - dt);
    fx.flashCrowd = Math.max(0, (fx.flashCrowd || 0) - dt * 0.35);
    fx.zoomT = Math.max(0, fx.zoomT - dt);
    const zoomWant = fx.zoomT > 0 ? 1 : 0;
    fx.zoom += (zoomWant - fx.zoom) * Math.min(1, dt * 3);
    if (fx.zoom < 0.004) fx.zoom = 0;
    for (const n of nets) { n.bulge = Math.max(0, n.bulge - dt * 0.75); netShape(n); }

    // the living stadium: crowd clock and energy, camera flashes, LED boards rolling (GOAL on a goal), flags
    crowdU.uTime.value = time;
    crowdU.uEnergy.value += (Math.min(1, fx.crowd) - crowdU.uEnergy.value) * Math.min(1, dt * 6);
    crowdU.uFlash.value = reduceMotion ? 0 : Math.min(1, 0.012 + fx.flashCrowd);
    if (ledTex) {
      if (fx.board > 0) { ledTex.offset.y = 0; ledTex.offset.x = Math.floor(time * 3) % 2 ? 0.0625 : 0; }
      else { ledTex.offset.y = 0.5; ledTex.offset.x = (ledTex.offset.x + dt * 0.03) % 1; }
    }
    if (ribbonTex) { ribbonTex.offset.y = fx.board > 0 ? 0 : 0.5; ribbonTex.offset.x = (ribbonTex.offset.x - dt * 0.018 + 1) % 1; }
    for (let i = 0; i < flags.length; i++) flags[i].rotation.y = Math.sin(time * 5.5 + i * 1.7) * 0.35;

    const m = sim ? sim.m : null;
    if (m) {
      const b = m.ball;
      syncPlayers(m);
      const c = m.auto ? null : m.ctrl;
      let nf = 0;
      for (const p of m.players) {
        const f = figures.get(p.id);
        if (!f) continue;
        f.g.position.set(p.x, 0, p.y);
        animate(f, p, dt, time, b.owner === p, p === c);
        if (shadowFans.visible && nf < 22 * 4) nf = placeFans(nf, p.x, p.y, f.cur.lift);
      }
      shadowFans.count = nf;
      shadowFans.instanceMatrix.needsUpdate = true;
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
      updateAim(m, time);

      const want = camWant(m, dt);
      if (cam.snap) { cam.x = want.tx; cam.z = want.tz; cam.vx = 0; cam.vz = 0; cam.d = want.d; cam.snap = false; }
      else if (dt > 0) {
        const w = 4.5, h = Math.min(dt, 1 / 20);
        cam.vx += (w * w * (want.tx - cam.x) - 2 * w * cam.vx) * h;
        cam.vz += (w * w * (want.tz - cam.z) - 2 * w * cam.vz) * h;
        cam.x += cam.vx * h; cam.z += cam.vz * h;
        cam.d += (want.d - cam.d) * (1 - Math.exp(-dt * 1.1));
      }
      updateHud(sim, m, dt);
    }
    const shake = !reduceMotion && fx.shake > 0.01 ? fx.shake : 0;
    const zoomIn = fx.zoom * 7;
    const jx = shake ? (Math.random() - 0.5) * shake : 0, jy = shake ? (Math.random() - 0.5) * shake : 0;
    camera.position.set(cam.x * 0.84 + jx, 33 + cam.d * 6 - zoomIn * 0.5 + jy, W + 60 + cam.d * 13 + cam.z * 0.25 - zoomIn);
    look.set(cam.x, 0.5, cam.z - 5);
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
    if (shadowFans.dispose) shadowFans.dispose();
    if (sun.shadow && sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    feed.length = 0;
    lastSim = null;
    if (hudEl && hudEl.parentNode) hudEl.parentNode.removeChild(hudEl);
    if (ctx2 && hud) { try { ctx2.setTransform(1, 0, 0, 1, 0, 0); ctx2.clearRect(0, 0, hud.width, hud.height); } catch (e) { /* nothing to clear */ } }
    if (renderer && own) {
      renderer.dispose();
      // hand the WebGL context back now, so match after match never piles up contexts
      if (renderer.forceContextLoss) { try { renderer.forceContextLoss(); } catch (e) { /* already gone */ } }
      if (glCanvas && glCanvas.parentNode) glCanvas.parentNode.removeChild(glCanvas);
    }
  }

  return {
    draw, onEvent, project, dispose, snap: () => { cam.snap = true; }, ownHud: true,
    scene, camera, figures, ball, ballShadow, ring, passRing, crowd, nets, fx, aimRing, shadowFans,
    sim: () => lastSim,
    quality: () => quality, setQuality: q => { quality = clamp(q, 0, 2); applyQuality(); },
    stats: () => {
      const info = own && renderer.info ? renderer.info.render : null;
      const mem = own && renderer.info ? renderer.info.memory : null;
      return { frames, seats: crowdN, tags: tagCount, quality, hud: !!hudEl, workMs: workAvg, frameMs: frameAvg * 1000, calls: info ? info.calls : null, triangles: info ? info.triangles : null, geometries: mem ? mem.geometries : null, textures: mem ? mem.textures : null };
    }
  };
}

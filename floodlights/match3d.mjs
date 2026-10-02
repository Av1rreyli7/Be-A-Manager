// Floodlights playable match, the 3D look.
// The game itself lives in match.js (FLMatch.createSim). This file only draws what the sim says:
// a pitch, two goals with nets, 22 low poly players in shirt colours, the ball with its shadow,
// and a stadium around the edges, seen through a TV broadcast camera that follows the ball.
// It mirrors the way Hardwood Legends in Front Office sets up three.js (same tone mapping,
// night colours and fog) so the two games feel related.
//
// three.js is passed in, never imported here, so the same file runs in the browser
// (with the real renderer) and in node tests (with a stub renderer).
//
// Axes: the sim uses x (goal to goal) and y (touchline to touchline) on the ground and z for height.
// In the scene that is x, z and y. The camera stands on the +y touchline, so "up the screen"
// is still minus y and the controls feel exactly like the classic top down view.

export function createView3D(THREE, opts) {
  const FL = opts.FL;
  const D = FL.DIMS;
  const wrap = opts.wrap || null;
  const hud = opts.canvas || null;
  const doc = opts.document || (typeof document !== "undefined" ? document : null);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ---------- renderer ----------
  let renderer = opts.renderer || null;
  let glCanvas = null;
  if (!renderer) {
    glCanvas = doc.createElement("canvas");
    glCanvas.id = "matchCanvas3d";
    glCanvas.setAttribute("aria-hidden", "true");
    wrap.insertBefore(glCanvas, hud);
    renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min((typeof window !== "undefined" && window.devicePixelRatio) || 1, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060b);
  scene.fog = new THREE.Fog(0x04060b, 150, 330);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 700);
  camera.position.set(0, 40, 76);

  scene.add(new THREE.HemisphereLight(0xd8e0ff, 0x1f3320, 0.8));
  const sun = new THREE.DirectionalLight(0xfff3e2, 1.25);
  sun.position.set(14, 95, 40);
  scene.add(sun);

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

  // ---------- pitch ----------
  const L = D.HALF_L, W = D.HALF_W;
  const pitchTex = canvasTexture(2048, 1326, (c, w, h) => {
    const bands = 14;
    for (let i = 0; i < bands; i++) {
      c.fillStyle = i % 2 ? "#2e9b4c" : "#2a9046";
      c.fillRect(i * w / bands, 0, w / bands + 1, h);
    }
    const k = w / (L * 2);
    const X = m => (m + L) * k, Y = m => (m + W) * k;
    c.strokeStyle = "rgba(255,255,255,.9)";
    c.fillStyle = "rgba(255,255,255,.9)";
    c.lineWidth = 0.16 * k;
    c.strokeRect(X(-L) + c.lineWidth / 2, Y(-W) + c.lineWidth / 2, w - c.lineWidth, h - c.lineWidth);
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
    }
    c.beginPath(); c.arc(X(0), Y(0), 0.26 * k, 0, Math.PI * 2); c.fill();
  });
  const ground = add(new THREE.PlaneGeometry(520, 520), lambert(0x0a0c11), 0, -0.08, 0);
  ground.rotation.x = -Math.PI / 2;
  const apron = add(new THREE.PlaneGeometry(L * 2 + 18, W * 2 + 16), lambert(0x1c6332), 0, -0.03, 0);
  apron.rotation.x = -Math.PI / 2;
  const pitch = add(new THREE.PlaneGeometry(L * 2, W * 2), pitchTex ? lambert(0xffffff, { map: pitchTex }) : lambert(0x2a9046), 0, 0, 0);
  pitch.rotation.x = -Math.PI / 2;

  // ---------- goals with nets ----------
  const white = basic(0xffffff);
  const netMat = basic(0xffffff, { wireframe: true, transparent: true, opacity: 0.3 });
  const nets = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(s * L, 0, 0);
    scene.add(g);
    for (const z of [-D.GOAL_HALF, D.GOAL_HALF]) add(new THREE.BoxGeometry(0.16, D.BAR_H, 0.16), white, 0, D.BAR_H / 2, z, g);
    add(new THREE.BoxGeometry(0.16, 0.16, D.GOAL_HALF * 2 + 0.16), white, 0, D.BAR_H, 0, g);
    // the net is one wireframe box that stretches a little when a goal goes in
    const net = add(new THREE.BoxGeometry(D.GOAL_DEPTH, D.BAR_H, D.GOAL_HALF * 2, 5, 5, 14), netMat, s * D.GOAL_DEPTH / 2, D.BAR_H / 2, 0, g);
    net.userData.side = s;
    nets.push(net);
  }

  // ---------- stadium around the edges: boards, stands, crowd, floodlights ----------
  const boardCols = [0x103c36, 0x16324f, 0x3a1826, 0x3d3413];
  const boardW = (L * 2 + 6) / 12;
  for (let i = 0; i < 12; i++) {
    const x = -L - 3 + i * boardW + boardW / 2;
    add(new THREE.BoxGeometry(boardW - 0.3, 1.1, 0.3), lambert(boardCols[i % 4]), x, 0.55, -W - 5.6);
  }
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) {
    add(new THREE.BoxGeometry(0.3, 1.1, (W * 2 + 8) / 6 - 0.3), lambert(boardCols[(i + 1) % 4]), s * (L + 6.6), 0.55, -W - 4 + (i + 0.5) * (W * 2 + 8) / 6);
  }
  const standMat = lambert(0x1a2230, { flatShading: true });
  const standDepth = 26, standRise = 17, tilt = Math.atan2(standRise, standDepth), standLen = Math.hypot(standDepth, standRise);
  // the far side stand, plus one behind each goal. The near side is where the camera sits.
  const far = add(new THREE.BoxGeometry(L * 2 + 60, 1, standLen), standMat, 0, standRise / 2 + 1, -(W + 8 + standDepth / 2));
  far.rotation.x = tilt;
  for (const s of [-1, 1]) {
    const end = add(new THREE.BoxGeometry(standLen, 1, W * 2 + 40), standMat, s * (L + 9 + standDepth / 2), standRise / 2 + 1, -6);
    end.rotation.z = s * tilt;
  }
  // crowd: instanced boxes in rows, cheap to draw. They bounce for a moment after a goal.
  const seats = [];
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let row = 0; row < 11; row++) {
    const t = (row + 0.6) / 11.5;
    for (let x = -L - 26; x <= L + 26; x += 1.9) if (rnd() < 0.8) seats.push([x + rnd() * 0.5, 1.6 + t * standRise, -(W + 8) - t * standDepth]);
    for (const s of [-1, 1]) for (let z = -W - 22; z <= W + 10; z += 1.9) if (rnd() < 0.8) seats.push([s * (L + 9 + t * standDepth), 1.6 + t * standRise, z + rnd() * 0.5]);
  }
  const crowd = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(0.9, 1.25, 0.6)), keep(new THREE.MeshLambertMaterial({ color: 0xffffff })), seats.length);
  {
    const mtx = new THREE.Matrix4(), col = new THREE.Color();
    const tones = [0x6d7688, 0x4a5262, 0x9aa2b0, 0x2f3644, 0x5f6878, 0x7a5560, 0x54707a];
    for (let i = 0; i < seats.length; i++) {
      mtx.makeTranslation(seats[i][0], seats[i][1], seats[i][2]);
      crowd.setMatrixAt(i, mtx);
      crowd.setColorAt(i, col.setHex(tones[(rnd() * tones.length) | 0]));
    }
  }
  scene.add(crowd);
  const lampMat = basic(0xfffbe6);
  for (const [x, z] of [[-L - 22, -W - 30], [L + 22, -W - 30]]) {
    add(new THREE.CylinderGeometry(0.5, 0.9, 46, 6), lambert(0x2a323c), x, 23, z);
    const head = add(new THREE.BoxGeometry(12, 7, 1), lambert(0x20262e), x, 48, z);
    head.lookAt(0, 0, 0);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j += 2) {
      const lamp = add(new THREE.CircleGeometry(1.1, 10), lampMat, i * 3.6, j * 1.6, 0.6, head);
      lamp.userData.lamp = true;
    }
  }

  // ---------- ball with its shadow ----------
  const BALL_R = 0.38;
  const ballGeo = new THREE.IcosahedronGeometry(BALL_R, 1);
  {
    // white with a few dark panels, coloured per face so it needs no texture
    const pos = ballGeo.getAttribute("position");
    const col = new Float32Array(pos.count * 3);
    for (let f = 0; f < pos.count; f += 3) {
      const dark = (f / 3) % 4 === 0;
      for (let j = 0; j < 3; j++) col.set(dark ? [0.08, 0.08, 0.08] : [0.96, 0.96, 0.96], (f + j) * 3);
    }
    ballGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  }
  const ball = add(ballGeo, lambert(0xffffff, { vertexColors: true, flatShading: true }), 0, BALL_R, 0);
  const shadowMat = basic(0x000000, { transparent: true, opacity: 0.3, depthWrite: false });
  const ballShadowMat = basic(0x000000, { transparent: true, opacity: 0.36, depthWrite: false });
  const ballShadow = add(new THREE.CircleGeometry(0.46, 16), ballShadowMat, 0, 0.03, 0);
  ballShadow.rotation.x = -Math.PI / 2;

  // ---------- the ring under the player you control ----------
  const ring = add(new THREE.RingGeometry(1.25, 1.45, 28), basic(0xffe15a, { transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }), 0, 0.05, 0);
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;

  // ---------- players: simple stylised figures, shared geometry, one material per colour ----------
  const G = {
    shirt: keep(new THREE.CylinderGeometry(0.42, 0.33, 0.95, 10)),
    shorts: keep(new THREE.CylinderGeometry(0.34, 0.37, 0.42, 10)),
    head: keep(new THREE.SphereGeometry(0.24, 10, 8)),
    leg: keep(new THREE.BoxGeometry(0.17, 0.66, 0.17)),
    arm: keep(new THREE.BoxGeometry(0.13, 0.62, 0.13)),
    shadow: keep(new THREE.CircleGeometry(0.62, 14))
  };
  const SKIN = [0xf1c9a5, 0xe0ac69, 0xc68642, 0x8d5524, 0x5c3a21];
  const skinMats = SKIN.map(c => lambert(c));
  const matCache = {};
  const colMat = hex => matCache[hex] || (matCache[hex] = lambert(new THREE.Color(hex)));
  const figures = new Map();
  let kitKey = "";

  function buildFigure(p, kit) {
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    let h = 0;
    for (let i = 0; i < p.name.length; i++) h = (h * 31 + p.name.charCodeAt(i)) >>> 0;
    const skin = skinMats[h % skinMats.length];
    const shirt = new THREE.Mesh(G.shirt, colMat(kit[0])); shirt.position.y = 1.4; body.add(shirt);
    const shorts = new THREE.Mesh(G.shorts, colMat(kit[1])); shorts.position.y = 0.82; body.add(shorts);
    const head = new THREE.Mesh(G.head, skin); head.position.y = 2.12; body.add(head);
    const limbs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(0, 0.66, s * 0.17); body.add(hip);
      const leg = new THREE.Mesh(G.leg, skin); leg.position.y = -0.33; hip.add(leg);
      const sh = new THREE.Group(); sh.position.set(0, 1.78, s * 0.5); body.add(sh);
      const arm = new THREE.Mesh(G.arm, colMat(kit[0])); arm.position.y = -0.3; sh.add(arm);
      limbs.push({ hip, sh, s });
    }
    const shadow = new THREE.Mesh(G.shadow, shadowMat); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.025; g.add(shadow);
    g.scale.setScalar(1.18);
    scene.add(g);
    return { g, body, limbs, phase: (h % 628) / 100, shirt };
  }

  function syncPlayers(m) {
    const key = m.teams[0].name + "|" + m.teams[1].name;
    if (key !== kitKey) {
      kitKey = key;
      for (const f of figures.values()) scene.remove(f.g);
      figures.clear();
      const kits = FL.pickKits(m.teams[0].name, m.teams[1].name);
      for (const p of m.players) {
        const kit = p.gk ? (p.team === 0 ? ["#f2c230", "#111111"] : ["#ff7a1a", "#111111"]) : kits[p.team];
        figures.set(p.id, buildFigure(p, kit));
      }
    }
  }

  // ---------- camera: a TV gantry on the near touchline that follows the ball ----------
  const cam = { x: 0, z: 0, snap: true };
  const look = new THREE.Vector3();
  let viewW = 0, viewH = 0, crowdJump = 0, time = 0, frames = 0;

  function resize() {
    const w = (hud && hud.clientWidth) || (wrap && wrap.clientWidth) || opts.width || 960;
    const h = (hud && hud.clientHeight) || (wrap && wrap.clientHeight) || opts.height || 540;
    if (w === viewW && h === viewH) return;
    viewW = w; viewH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep about the same slice of the pitch on screen whatever the window shape
    const hf = 46 * Math.PI / 180;
    camera.fov = clamp(2 * Math.atan(Math.tan(hf / 2) / camera.aspect) * 180 / Math.PI, 24, 58);
    camera.updateProjectionMatrix();
  }

  function onEvent(ev) {
    if (ev.type === "goal") crowdJump = 2.6;
    else if (ev.type === "save" && ev.big) crowdJump = Math.max(crowdJump, 0.7);
  }

  function draw(sim, dt, fx) {
    resize();
    time += dt;
    frames++;
    const m = sim ? sim.m : null;
    if (m) {
      const b = m.ball;
      syncPlayers(m);
      for (const p of m.players) {
        const f = figures.get(p.id);
        if (!f) continue;
        f.g.position.set(p.x, 0, p.y);
        f.g.rotation.y = -p.face;
        const speed = Math.hypot(p.vx, p.vy);
        f.phase += dt * (4 + speed * 1.7);
        const swing = Math.min(1, speed / 5) * 0.9 * Math.sin(f.phase);
        for (const l of f.limbs) {
          l.hip.rotation.z = l.s * swing;
          l.sh.rotation.z = -l.s * swing * 0.8;
        }
        // a diving keeper goes full stretch, a player who just lost a tackle staggers
        f.body.rotation.x = p.diving ? 1.2 * (p.vy >= 0 ? 1 : -1) * (Math.cos(p.face) >= 0 ? 1 : -1) : 0;
        f.body.rotation.z = p.stun > 0 ? -0.3 : -Math.min(0.1, speed * 0.012);
        f.body.position.y = p.diving ? 0.25 : 0;
      }
      ball.position.set(b.x, BALL_R + Math.max(0, b.z), b.y);
      ball.rotation.z -= b.vx * dt * 2.2;
      ball.rotation.x += b.vy * dt * 2.2;
      ballShadow.position.set(b.x, 0.03, b.y);
      const sh = 1 + Math.max(0, b.z) * 0.14;
      ballShadow.scale.set(sh, sh, 1);
      ballShadowMat.opacity = 0.36 / (1 + Math.max(0, b.z) * 0.3);

      const c = m.auto ? null : m.ctrl;
      ring.visible = !!c && m.phase !== "full";
      if (c) {
        ring.position.set(c.x, 0.05, c.y);
        ring.material.opacity = 0.7 + 0.3 * Math.sin(time * 6);
      }

      const tx = clamp(b.x + clamp(b.vx * 0.3, -6, 6), -(L - 12), L - 12);
      const tz = clamp(b.y * 0.35, -9, 9);
      if (cam.snap) { cam.x = tx; cam.z = tz; cam.snap = false; }
      else {
        const k = 1 - Math.exp(-dt * 4);
        cam.x += (tx - cam.x) * k;
        cam.z += (tz - cam.z) * k;
      }
    }
    const shake = fx && fx.shake > 0 ? fx.shake : 0;
    camera.position.set(cam.x * 0.86 + (shake ? (Math.random() - 0.5) * shake * 0.9 : 0), 40 + (shake ? (Math.random() - 0.5) * shake * 0.9 : 0), W + 42 + cam.z * 0.25);
    look.set(cam.x, 0.5, cam.z - 4);
    camera.lookAt(look);

    if (fx && fx.net) for (const net of nets) {
      const bulge = fx.net[net.userData.side < 0 ? 0 : 1] || 0;
      net.scale.x = 1 + bulge * 0.3;
      net.position.x = net.userData.side * D.GOAL_DEPTH / 2 * net.scale.x;
    }
    crowdJump = Math.max(0, crowdJump - dt);
    crowd.position.y = crowdJump > 0 ? Math.abs(Math.sin(time * 9)) * 0.45 * Math.min(1, crowdJump) : 0;

    renderer.render(scene, camera);
  }

  // where a point on the pitch lands on the screen, for the name labels and markers drawn on the HUD canvas
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
    if (renderer && !opts.renderer) {
      renderer.dispose();
      if (glCanvas && glCanvas.parentNode) glCanvas.parentNode.removeChild(glCanvas);
    }
  }

  return { draw, onEvent, project, dispose, snap: () => { cam.snap = true; }, scene, camera, figures, ball, ballShadow, ring, crowd, nets, stats: () => ({ frames, seats: seats.length }) };
}

// The 3D match view: draws what the sim says. The renderer, the lights, the pitch and stadium, the 22 players
// (skinned bodies animated procedurally every frame), the ball with its spin and shadow, the markers, the
// broadcast camera and the HUD. It never changes the game; it only reads it.
// three.js is handed in (createView3D(THREE, opts)), so the same file runs in the browser and in node tests.
import { HALF_L, HALF_W, GOAL_HALF, BALL_R, STEP } from "../consts.mjs";
import { buildBody, buildSkeleton, numberSheet, kitMaterial, keeperKit, hexToRgb, lum } from "./rig.mjs";
import { createAnimator } from "./anim.mjs";
import { createCamera } from "./camera.mjs";
import { createPitch } from "./pitch.mjs";
import { createStadium } from "./stadium.mjs";
import { createGround, DAYLIGHT } from "./ground.mjs";
import { createMatchSound } from "./sound.mjs";
import { createHud } from "./hud.mjs";

const VOLT = "#d0e85c";
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function createView3D(THREE, opts) {
  const FL = opts.FL;
  const wrap = opts.wrap || null;
  const doc = opts.document !== undefined ? opts.document : (typeof document !== "undefined" ? document : null);
  const win = typeof window !== "undefined" ? window : null;
  let quality = opts.quality === undefined ? 2 : opts.quality;
  const DPR = [1, 1.25, 1.6], SHADOW = [0, 1024, 2048];

  // ---------- renderer ----------
  let renderer = opts.renderer || null, glCanvas = null;
  const own = !renderer;
  if (own) {
    glCanvas = doc.createElement("canvas");
    glCanvas.id = "matchCanvas3d";
    glCanvas.setAttribute("aria-hidden", "true");
    if (opts.canvas && opts.canvas.parentNode === wrap) wrap.insertBefore(glCanvas, opts.canvas); else wrap.appendChild(glCanvas);
    renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: "high-performance" });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = quality > 0;
    renderer.shadowMap.type = THREE.PCFShadowMap;
  }
  // the Classic canvas sits above ours and still holds the kick off screen's pitch: hide it while 3D runs
  const classic = opts.canvas || null;
  const classicVis = classic && classic.style ? classic.style.visibility : "";
  if (classic && classic.style) {
    classic.style.visibility = "hidden";
    const g2 = classic.getContext && classic.getContext("2d");
    if (g2) g2.clearRect(0, 0, classic.width, classic.height);
  }
  const maxAniso = own && renderer.capabilities && renderer.capabilities.getMaxAnisotropy ? Math.min(16, renderer.capabilities.getMaxAnisotropy()) : 4;
  let W = opts.width || 1280, H = opts.height || 720;
  function sizeNow() {
    if (wrap && wrap.clientWidth) { W = wrap.clientWidth; H = wrap.clientHeight; }
    if (renderer.setPixelRatio) renderer.setPixelRatio(Math.min((win && win.devicePixelRatio) || 1, DPR[quality]));
    if (renderer.setSize) renderer.setSize(W, H, false);
    camera.resize(W / Math.max(1, H));
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04070d);
  scene.fog = new THREE.Fog(0x06090f, 170, 420);
  const camera = createCamera(THREE, W / H);

  // ---------- lights: a cool night sky, a floodlight key with shadows that follow the play, two fills ----------
  const hemi = new THREE.HemisphereLight(0x9fb4d8, 0x1d2a1a, 0.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff4e6, 1.85);
  key.position.set(-60, 85, 55);
  key.castShadow = quality > 0;
  key.shadow.mapSize.set(SHADOW[quality] || 1024, SHADOW[quality] || 1024);
  key.shadow.camera.near = 20; key.shadow.camera.far = 220;
  key.shadow.camera.left = -38; key.shadow.camera.right = 38; key.shadow.camera.top = 30; key.shadow.camera.bottom = -30;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 2.5;
  scene.add(key); scene.add(key.target);
  const fill1 = new THREE.DirectionalLight(0xdfe8ff, 0.75); fill1.position.set(70, 70, -60); scene.add(fill1);
  const fill2 = new THREE.DirectionalLight(0xffeedd, 0.5); fill2.position.set(60, 55, 70); scene.add(fill2);
  const rim = new THREE.DirectionalLight(0xbcd2ff, 0.45); rim.position.set(-70, 40, -80); scene.add(rim);

  // ---------- a dip to black for half time, when the teams change ends (a broadcast cut, nobody slides across) ----------
  let fade = null;
  if (doc && wrap) {
    fade = doc.createElement("div");
    fade.setAttribute("aria-hidden", "true");
    fade.style.cssText = "position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;z-index:3;transition:none";
    wrap.appendChild(fade);
  }
  let fadeV = -1, fadeOut = 0;

  // ---------- the pitch and the stadium ----------
  const pitch = createPitch(THREE, { doc, renderer: own ? renderer : null, quality, maxAniso });
  scene.add(pitch.group);
  let stadium = null, kits = null, hud = null;
  // Player Career sends where the match is (opts.venue): a school, college or academy ground in the day, with
  // the sound of that ground. Manager Career sends none: the stadium at night, silent, exactly as it always was.
  const venue = opts.venue || null;
  const youthGround = !!venue && (venue.kind === "school" || venue.kind === "college" || venue.kind === "academy");
  let sound = null;

  // ---------- the ball ----------
  const ballGeo = new THREE.SphereGeometry(BALL_R, 28, 20);
  const ballMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0 });
  ballMat.map = ballTexture(THREE, doc);
  const ballMesh = new THREE.Mesh(ballGeo, ballMat);
  ballMesh.castShadow = true;
  scene.add(ballMesh);
  const blob = blobTexture(THREE, doc);
  const ballShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, opacity: 0.6, color: 0x000000 }));
  ballShadow.rotation.x = -Math.PI / 2; ballShadow.position.y = 0.012; ballShadow.renderOrder = 2;
  scene.add(ballShadow);
  const spinQ = new THREE.Quaternion(), tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3();

  // ---------- markers: the controlled player's ring, the pass target, the set piece aim ----------
  const ringGeo = new THREE.RingGeometry(0.62, 0.78, 40);
  const ctrlRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: VOLT, transparent: true, opacity: 0.85, depthWrite: false }));
  ctrlRing.rotation.x = -Math.PI / 2; ctrlRing.position.y = 0.02; ctrlRing.renderOrder = 3;
  const ctrlArrow = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 3), new THREE.MeshBasicMaterial({ color: VOLT }));
  ctrlArrow.rotation.x = Math.PI;
  scene.add(ctrlRing); scene.add(ctrlArrow);
  const recvRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
  recvRing.rotation.x = -Math.PI / 2; recvRing.position.y = 0.02; recvRing.visible = false; recvRing.renderOrder = 3;
  scene.add(recvRing);
  const aimRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.0, 40), new THREE.MeshBasicMaterial({ color: VOLT, transparent: true, opacity: 0.8, depthWrite: false }));
  aimRing.rotation.x = -Math.PI / 2; aimRing.position.y = 0.025; aimRing.visible = false; aimRing.renderOrder = 3;
  scene.add(aimRing);
  const arcGeo = new THREE.BufferGeometry();
  arcGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(32 * 3), 3));
  const aimArc = new THREE.Line(arcGeo, new THREE.LineDashedMaterial({ color: VOLT, dashSize: 0.6, gapSize: 0.4, transparent: true, opacity: 0.8 }));
  aimArc.visible = false;
  scene.add(aimArc);

  // ---------- turf: bits of grass and soil kicked up by strikes, slides, dives and hard cuts ----------
  const TURF_N = 240;
  const turfPos = new Float32Array(TURF_N * 3), turfVel = new Float32Array(TURF_N * 3), turfLife = new Float32Array(TURF_N);
  const turfGeo = new THREE.BufferGeometry();
  turfGeo.setAttribute("position", new THREE.BufferAttribute(turfPos, 3));
  const turfMat = new THREE.PointsMaterial({ color: 0x3b4a22, size: 0.07, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false });
  const turf = new THREE.Points(turfGeo, turfMat);
  turf.frustumCulled = false;
  for (let i = 0; i < TURF_N; i++) turfPos[i * 3 + 1] = -10;
  scene.add(turf);
  let turfNext = 0;
  // sim coordinates in, a little burst out
  function kickTurf(x, y, dir, n, speed) {
    for (let k = 0; k < n; k++) {
      const i = turfNext; turfNext = (turfNext + 1) % TURF_N;
      const a = dir + (Math.random() - 0.5) * 1.6, v = speed * (0.4 + Math.random() * 0.8);
      turfPos[i * 3] = x + (Math.random() - 0.5) * 0.2; turfPos[i * 3 + 1] = 0.03; turfPos[i * 3 + 2] = y + (Math.random() - 0.5) * 0.2;
      turfVel[i * 3] = Math.cos(a) * v; turfVel[i * 3 + 1] = 1 + Math.random() * 2.2 * speed / 3; turfVel[i * 3 + 2] = Math.sin(a) * v;
      turfLife[i] = 0.6 + Math.random() * 0.5;
    }
  }
  function stepTurf(dt) {
    for (let i = 0; i < TURF_N; i++) {
      if (turfLife[i] <= 0) continue;
      turfLife[i] -= dt;
      turfVel[i * 3 + 1] -= 9.8 * dt;
      turfPos[i * 3] += turfVel[i * 3] * dt; turfPos[i * 3 + 1] += turfVel[i * 3 + 1] * dt; turfPos[i * 3 + 2] += turfVel[i * 3 + 2] * dt;
      if (turfPos[i * 3 + 1] < 0.01) { turfPos[i * 3 + 1] = 0.01; turfVel[i * 3] *= 0.3; turfVel[i * 3 + 2] *= 0.3; turfVel[i * 3 + 1] = 0; }
      if (turfLife[i] <= 0) turfPos[i * 3 + 1] = -10;
    }
    turfGeo.attributes.position.needsUpdate = true;
  }

  // ---------- players ----------
  const animator = createAnimator(THREE);
  const figures = new Map();
  const contactGeo = new THREE.PlaneGeometry(1, 1);
  const contactMat = new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, opacity: 0.42, color: 0x000000 });
  const mats = [];
  let built = null;

  function build(sim) {
    const m = sim.m;
    // kits: the person's team keeps its colours, the other changes if they clash
    const names = [m.teams[0].name, m.teams[1].name];
    kits = FL && FL.pickKits ? FL.pickKits(names[0], names[1]) : [["#c8102e", "#ffffff"], ["#1b2430", "#ffffff"]];
    const gkKit = keeperKit(kits);
    stadium = youthGround ? createGround(THREE, { quality, kits, venue }) : createStadium(THREE, { doc, quality, kits });
    if (venue && venue.daylight) {
      scene.background.setHex(DAYLIGHT.sky);
      scene.fog.color.setHex(DAYLIGHT.fog[0]); scene.fog.near = DAYLIGHT.fog[1]; scene.fog.far = DAYLIGHT.fog[2];
      hemi.color.setHex(DAYLIGHT.hemi[0]); hemi.groundColor.setHex(DAYLIGHT.hemi[1]); hemi.intensity = DAYLIGHT.hemi[2];
      key.color.setHex(DAYLIGHT.sun[0]); key.intensity = DAYLIGHT.sun[1];
      fill1.intensity = DAYLIGHT.fills[0]; fill2.intensity = DAYLIGHT.fills[1]; rim.intensity = DAYLIGHT.fills[2];
      if (own) renderer.toneMappingExposure = DAYLIGHT.exposure;
      if (pitch.daylight) pitch.daylight();
    }
    if (venue && !sound) { try { sound = createMatchSound(venue, win); } catch (e) { sound = null; } }
    scene.add(stadium.group);
    for (const T of m.teams) {
      const kit = kits[T.idx];
      const shirt = hexToRgb(kit[0]);
      const shorts = lum(shirt) > 0.6 ? kit[1] : kit[0];
      const sheet = numberSheet(THREE, doc, T.players.filter(p => !p.gk), kit);
      const gkSheet = numberSheet(THREE, doc, T.players.filter(p => p.gk), gkKit);
      const mat = kitMaterial(THREE, sheet.tex);
      const gmat = kitMaterial(THREE, gkSheet.tex);
      mats.push(mat, gmat);
      for (const p of T.players) {
        const isGk = p.gk;
        const look = Object.assign({}, p.prof, {
          kit: isGk ? gkKit : kit, shorts: isGk ? gkKit[1] : shorts, socks: isGk ? gkKit[0] : kit[0], gk: isGk,
          cell: (isGk ? gkSheet : sheet).cells[p.id] || null
        });
        const geo = buildBody(THREE, look);
        const bones = buildSkeleton(THREE, p.prof.h);
        const skel = new THREE.Skeleton(bones);
        const mesh = new THREE.SkinnedMesh(geo, isGk ? gmat : mat);
        mesh.add(bones[0]);
        mesh.bind(skel);
        mesh.castShadow = quality > 0; mesh.receiveShadow = false;
        mesh.frustumCulled = false;
        const root = new THREE.Group();
        root.add(mesh);
        scene.add(root);
        const contact = new THREE.Mesh(contactGeo, contactMat);
        contact.rotation.x = -Math.PI / 2; contact.position.y = 0.011; contact.renderOrder = 1;
        scene.add(contact);
        const rig = animator.makeRig(bones, p.prof.h, p.prof);
        figures.set(p.id, { root, mesh, rig, contact, p, geo, px: p.x, py: p.y, pf: p.face, cx: p.x, cy: p.y, cf: p.face, lastT: -1 });
      }
    }
    hud = createHud(doc, wrap, { FL, kits, names, side: m.side || "home" });
    built = sim;
    sizeNow();
  }

  // ---------- per frame ----------
  let lastSim = null, frameMs = 0, slow = 0, fast = 0, frames = 0, lastNow = 0;
  const proj = new THREE.Vector3();
  const info = {
    project(x, y, z) {
      proj.set(x, z, y).project(camera.cam);
      return { x: (proj.x * 0.5 + 0.5) * W, y: (-proj.y * 0.5 + 0.5) * H, on: proj.z < 1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1 };
    }
  };

  function draw(sim, dt, fx, alpha) {
    if (!sim) return;
    const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
    if (built !== sim) { disposePlayers(); build(sim); }
    lastSim = sim;
    const m = sim.m;
    const a = alpha === undefined ? 1 : clamp(alpha, 0, 1);
    const ctrlP = m.ctrl && !m.auto ? m.ctrl : null;
    const view = { ball: m.ball, ballHeld: m.ball.held, ballCtrl: m.ball.ctrl, ctrlP };
    // ---------- players ----------
    for (const [id, F] of figures) {
      const p = F.p;
      // interpolate between the last two sim steps for smooth motion on any refresh rate
      if (F.lastT !== m.t) { F.px = F.cx; F.py = F.cy; F.pf = F.cf; F.cx = p.x; F.cy = p.y; F.cf = p.face; F.lastT = m.t; }
      p.renderX = F.px + (F.cx - F.px) * a; p.renderY = F.py + (F.cy - F.py) * a;
      let df = F.cf - F.pf; if (df > Math.PI) df -= 2 * Math.PI; if (df < -Math.PI) df += 2 * Math.PI;
      p.renderFace = F.pf + df * a;
      if (p.off && p.y > HALF_W + 4) { F.root.visible = false; F.contact.visible = false; continue; }
      animator.pose(p, F.rig, m.ball, m.t, Math.max(0.001, Math.min(0.05, dt || STEP)), F.root, view);
      // a soft contact shadow under the body
      const down = p.mode === "down" || p.mode === "fall";
      F.contact.position.set(p.renderX, 0.011, p.renderY);
      F.contact.scale.set(down ? 2.0 : 1.1, down ? 2.0 : 1.1, 1);
      F.contact.material.opacity = 0.42;
    }
    // ---------- ball: position, spin, shadow ----------
    const b = m.ball;
    ballMesh.position.set(b.x, Math.max(BALL_R, b.z), b.y);
    // spin: the sim's angular velocity, mapped into the scene (a mirror swap of y and z flips its sign)
    const w = Math.hypot(b.wx, b.wy, b.wz);
    if (w > 0.01 && dt > 0) {
      tmpV.set(-b.wx, -b.wz, -b.wy).normalize();
      tmpQ.setFromAxisAngle(tmpV, w * dt);
      spinQ.premultiply(tmpQ);
      ballMesh.quaternion.copy(spinQ);
    }
    // a soft shadow that grows and fades as the ball rises (on top of the real cast shadow)
    const hgt = Math.max(0, b.z - BALL_R);
    const sc = 0.32 + hgt * 0.14;
    ballShadow.position.set(b.x + hgt * 0.18, 0.012, b.y + hgt * 0.1);
    ballShadow.scale.set(sc, sc, 1);
    ballShadow.material.opacity = clamp(0.62 - hgt * 0.06, 0.12, 0.62);
    // ---------- markers ----------
    if (ctrlP && m.phase !== "full") {
      ctrlRing.visible = true; ctrlArrow.visible = true;
      ctrlRing.position.set(ctrlP.renderX, 0.02, ctrlP.renderY);
      const pulse = 1 + Math.sin(m.t * 6) * 0.04;
      ctrlRing.scale.set(pulse, pulse, 1);
      ctrlArrow.position.set(ctrlP.renderX, ctrlP.prof.h + 0.55 + (ctrlP.z || 0), ctrlP.renderY);
    } else { ctrlRing.visible = false; ctrlArrow.visible = false; }
    const fl = b.flight;
    if (fl && fl.to && fl.by && fl.by.team === m.userTeam && fl.to.team === m.userTeam && m.t - fl.t < 2.5 && !b.ctrl) {
      recvRing.visible = true; recvRing.position.set(fl.to.renderX || fl.to.x, 0.02, fl.to.renderY || fl.to.y);
    } else recvRing.visible = false;
    if (m.aim) {
      aimRing.visible = true; aimRing.position.set(m.aim.x, 0.025, m.aim.y);
      const pw = m.aim.power || 0;
      aimRing.scale.set(1 + pw * 0.4, 1 + pw * 0.4, 1);
      // a dotted flight arc from the ball to the target
      const pos = arcGeo.attributes.position.array;
      const z = m.aim.z || 3;
      for (let i = 0; i < 32; i++) {
        const u = i / 31;
        const x = b.x + (m.aim.x - b.x) * u, y = b.y + (m.aim.y - b.y) * u;
        const bend = (m.aim.curve || 0) * Math.sin(u * Math.PI) * 2.5;
        const dx = m.aim.x - b.x, dy = m.aim.y - b.y, dl = Math.hypot(dx, dy) || 1;
        pos[i * 3] = x - dy / dl * bend; pos[i * 3 + 1] = BALL_R + Math.sin(u * Math.PI) * z; pos[i * 3 + 2] = y + dx / dl * bend;
      }
      arcGeo.attributes.position.needsUpdate = true;
      aimArc.computeLineDistances();
      aimArc.visible = true;
    } else { aimRing.visible = false; aimArc.visible = false; }
    // ---------- the net and the grass react ----------
    if (b.netHit && b.netHit.t !== lastNet) { lastNet = b.netHit.t; pitch.netHit(Math.sign(b.netHit.x), b.netHit.y, b.netHit.z, b.netHit.power); }
    for (const p of m.players) {
      if (p.cutT && p.cutT !== p.cutDrawn && p.spd > 5) { p.cutDrawn = p.cutT; pitch.mark("skid", p.x, p.y, p.cutDir || p.face, 0.5); kickTurf(p.x, p.y, (p.cutDir || p.face) + Math.PI, 3, 2.5); }
      // a slide throws up turf all the way along
      if (p.act && p.act.k === "slide" && p.act.phase === "slide" && Math.random() < 0.6) kickTurf(p.x + Math.cos(p.act.dir) * 0.6, p.y + Math.sin(p.act.dir) * 0.6, p.act.dir, 1, 3);
    }
    if (dt > 0) stepTurf(Math.min(dt, 0.05));
    // ---------- camera, shadows follow the play ----------
    if (api.debugCam) {
      // a fixed camera for close inspection: { follow: player id or -1, dist, height, side }
      const dc = api.debugCam, fp = dc.follow >= 0 ? m.players[dc.follow] : null;
      const tx = fp ? fp.renderX : m.ball.x, tz = fp ? fp.renderY : m.ball.y;
      camera.cam.position.set(tx + (dc.side || 0), dc.height || 2.2, tz + (dc.dist || 6));
      camera.cam.lookAt(tx, dc.look || 1.0, tz);
      camera.state.tx = tx; camera.state.tz = tz;
    } else camera.update(m, Math.max(0.001, dt || STEP), ctrlP);
    const st = camera.state;
    key.target.position.set(st.tx, 0, st.tz);
    key.position.set(st.tx - 60, 85, st.tz + 55);
    pitch.update(dt || 0);
    if (stadium) stadium.update(dt || 0, m.t);
    if (sound) sound.tick(dt || 0, m.ball ? Math.max(0, 1 - Math.abs(Math.abs(m.ball.x) - HALF_L) / 30) : 0);
    // ---------- half time: fade out, change ends, fade back in ----------
    if (fade) {
      let o = 0;
      if (m.phase === "halftime") { o = Math.min(1, m.phaseT / 0.9); fadeOut = 1; }
      else if (fadeOut > 0) { fadeOut = Math.max(0, fadeOut - (dt || 0) / 1.1); o = fadeOut; }
      if (Math.abs(o - fadeV) > 0.01) { fadeV = o; fade.style.opacity = o.toFixed(2); }
    }
    // ---------- render ----------
    if (renderer.render) renderer.render(scene, camera.cam);
    if (hud) hud.update(sim, info, dt || 0);
    // ---------- frame budget guard: step quality down if the laptop cannot keep up ----------
    const t1 = (typeof performance !== "undefined" ? performance.now() : Date.now());
    frameMs = frameMs * 0.95 + (t1 - t0) * 0.05;
    frames++;
    if (own && frames > 90) {
      const gap = lastNow ? t1 - lastNow : 16;
      if (frameMs > 11 || gap > 42) slow++; else slow = Math.max(0, slow - 1);
      if (slow > 120 && quality > 0) { setQuality(quality - 1); slow = 0; }
    }
    lastNow = t1;
  }
  let lastNet = -1;

  function onEvent(ev, sim) {
    if (!sim) return;
    const m = sim.m;
    camera.onEvent(ev, m);
    if (ev.type === "kick" && (ev.power > 0.6 || ev.shot)) { const p = m.players[ev.by]; if (p) kickTurf(m.ball.x - Math.cos(p.face) * 0.25, m.ball.y - Math.sin(p.face) * 0.25, p.face, 4 + Math.round(ev.power * 4), 2.2); }
    if (ev.type === "dive_land") kickTurf(ev.x, ev.y, 0, 6, 1.8);
    if (ev.type === "slide_end") pitch.mark("slide", ev.sx, ev.sy, Math.atan2(ev.y - ev.sy, ev.x - ev.sx), Math.hypot(ev.x - ev.sx, ev.y - ev.sy));
    if (ev.type === "dive_land") pitch.mark("dive", ev.x, ev.y, 0, 1);
    if (ev.type === "fall") { const p = m.players[ev.by]; if (p) pitch.mark("skid", p.x, p.y, ev.dir || 0, 0.8); }
    if (stadium) {
      if (ev.type === "goal") stadium.react("goal", ev.team === 0 ? 1 : -1);
      if (ev.type === "save" || ev.type === "post") stadium.react("chance", 1);
      if (ev.type === "foul") stadium.react("foul", 1);
    }
    if (sound) {
      if (ev.type === "goal") sound.react("goal", ev.team === 0);
      else if (ev.type === "save" || ev.type === "post") sound.react("chance");
      else if (ev.type === "foul") sound.react("foul");
      else if (ev.type === "kickoff" || ev.type === "half" || ev.type === "full") sound.react(ev.type);
    }
    if (hud) hud.event(ev, sim);
  }

  function setQuality(q) {
    quality = clamp(q, 0, 2);
    if (renderer.shadowMap) renderer.shadowMap.enabled = quality > 0;
    key.castShadow = quality > 0;
    if (quality > 0) {
      key.shadow.mapSize.set(SHADOW[quality], SHADOW[quality]);
      if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
    }
    for (const F of figures.values()) F.mesh.castShadow = quality > 0;
    pitch.setQuality(quality);
    if (stadium) stadium.setQuality(quality);
    sizeNow();
  }

  function disposePlayers() {
    for (const F of figures.values()) { scene.remove(F.root); scene.remove(F.contact); F.geo.dispose(); }
    figures.clear();
    for (const mt of mats) { if (mt.map) mt.map.dispose(); mt.dispose(); }
    mats.length = 0;
    if (stadium) { scene.remove(stadium.group); stadium.dispose(); stadium = null; }
    if (sound) { sound.dispose(); sound = null; }
    if (hud) { hud.dispose(); hud = null; }
  }

  function dispose() {
    disposePlayers();
    pitch.dispose();
    ballGeo.dispose(); ballMat.dispose(); if (ballMat.map) ballMat.map.dispose();
    blob.dispose(); ballShadow.geometry.dispose(); ballShadow.material.dispose();
    contactGeo.dispose(); contactMat.dispose(); turfGeo.dispose(); turfMat.dispose();
    ringGeo.dispose(); ctrlRing.material.dispose(); ctrlArrow.geometry.dispose(); ctrlArrow.material.dispose();
    recvRing.geometry.dispose(); recvRing.material.dispose(); aimRing.geometry.dispose(); aimRing.material.dispose(); arcGeo.dispose(); aimArc.material.dispose();
    if (own) { renderer.dispose(); if (glCanvas && glCanvas.parentNode) glCanvas.parentNode.removeChild(glCanvas); }
    if (classic && classic.style) classic.style.visibility = classicVis;
    if (win && onResize) win.removeEventListener("resize", onResize);
    if (fade && fade.parentNode) fade.parentNode.removeChild(fade);
  }

  const onResize = win && own ? () => sizeNow() : null;
  if (onResize) win.addEventListener("resize", onResize);
  sizeNow();

  const api = {
    draw, onEvent, dispose, setQuality, ownHud: true, debugCam: null,
    quality: () => quality,
    stats: () => ({ frameMs: Math.round(frameMs * 100) / 100, quality, venue: venue ? venue.kind : null, ground: stadium && stadium.info ? stadium.info.kind || "stadium" : null, calls: renderer.info && renderer.info.render ? renderer.info.render.calls : 0, triangles: renderer.info && renderer.info.render ? renderer.info.render.triangles : 0 }),
    sim: () => lastSim,
    figures, scene, camera: camera.cam
  };
  return api;
}

// a ball texture: white with dark panels, drawn once (a plain DataTexture in node)
function ballTexture(THREE, doc) {
  if (!doc) {
    const d = new Uint8Array(16 * 8 * 4).fill(255);
    const t = new THREE.DataTexture(d, 16, 8); t.needsUpdate = true; return t;
  }
  const cv = doc.createElement("canvas"); cv.width = 512; cv.height = 256;
  const g = cv.getContext("2d");
  if (!g) { const t = new THREE.Texture(); return t; }
  g.fillStyle = "#f6f7f8"; g.fillRect(0, 0, 512, 256);
  // modern match ball panels: curved swooshes and a few dark patches
  g.fillStyle = "#1a1d22";
  for (let i = 0; i < 6; i++) {
    const cx = (i * 86 + 40) % 512, cy = i % 2 ? 80 : 176;
    g.beginPath(); g.ellipse(cx, cy, 30, 22, i, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = "#d0e85c"; g.lineWidth = 7;
  for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(64 + i * 128, 128, 70, 0.4, 2.2); g.stroke(); }
  g.strokeStyle = "rgba(0,0,0,.18)"; g.lineWidth = 2;
  for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(i * 43, 0); g.lineTo(i * 43 + 20, 256); g.stroke(); }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// a soft round shadow (radial falloff)
function blobTexture(THREE, doc) {
  const N = 64;
  const d = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (x + 0.5) / N * 2 - 1, dy = (y + 0.5) / N * 2 - 1;
    const r = Math.hypot(dx, dy);
    const a = Math.max(0, 1 - r) ** 1.8;
    const i = (y * N + x) * 4;
    d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = Math.round(a * 255);
  }
  const t = new THREE.DataTexture(d, N, N);
  t.needsUpdate = true;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  return t;
}

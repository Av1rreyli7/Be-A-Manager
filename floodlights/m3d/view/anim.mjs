// Procedural animation for the players. Nothing here is a canned clip: every frame the pose is worked out from
// what the sim says the body is doing, then the legs and arms are solved with two bone IK.
//
// Layers, blended by weight so nothing pops:
//   locomotion  the gait clock from the sim: the stance foot is locked to the exact spot the sim planted it (so
//               feet never slide), the swing foot travels to the next plant with a knee lift that depends on
//               speed and the player's style, the pelvis bobs and sways, the spine counter rotates, the body leans
//               into acceleration and into turns, the arms swing with the legs
//   actions     kicks (plant, backswing, strike, follow through), dribble touches, the thirty skill moves,
//               tackles, slides, headers, throw ins, keeper stance and dives, falls and getting up
//   attention   the head looks at the ball, checks a shoulder, follows the play
//   expression  gestures (point, call, hands on hips, appeal), celebrations and moods
//   secondary   springs on the shirt hem and long hair
// Procedural correction: whenever a foot or a hand is meant to meet the ball, its target is pulled to the ball's
// real position, so contact always lines up with the physics.
import { B } from "./rig.mjs";
import { duty as dutyOf, plantLead, footRoll } from "../body.mjs";

const PI = Math.PI;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const bell = (t, c, w) => Math.exp(-((t - c) * (t - c)) / (w * w));
const wrap = a => { a = (a + PI) % (2 * PI); if (a < 0) a += 2 * PI; return a - PI; };

export function createAnimator(THREE) {
  const V = () => new THREE.Vector3();
  const Q = () => new THREE.Quaternion();
  // scratch objects (no allocation per frame)
  const v1 = V(), v2 = V(), v3 = V(), v4 = V(), v5 = V(), v6 = V(), v7 = V();
  const q1 = Q(), q2 = Q(), q3 = Q(), qParent = Q(), qWorld = Q();
  const HAND_BONES = [B.armR, B.foreR, B.armL, B.foreL];
  const hq = {}; for (const bi of HAND_BONES) hq[bi] = Q();
  const m1 = new THREE.Matrix4();
  const e1 = new THREE.Euler();
  const UP = new THREE.Vector3(0, 1, 0);

  // sim point to character space: undo the root position and yaw
  function toLocal(rig, sx, sy, sz, out) {
    const dx = sx - rig.rx, dz = sy - rig.rz;
    const c = Math.cos(-rig.yaw), s = Math.sin(-rig.yaw);
    out.set(dx * c + dz * s, sz, -dx * s + dz * c);
    return out;
  }

  // world (character space) quaternion of a bone from our own bookkeeping
  function worldQ(rig, i, out) { return out.copy(rig.wq[i]); }

  // set a bone's character space rotation from a basis: yAxis is the direction the bone's +Y points,
  // zHint the direction its +Z (forward) should point as far as it can
  function setBoneBasis(rig, i, yAxis, zHint) {
    const y = v5.copy(yAxis).normalize();
    const z = v6.copy(zHint).addScaledVector(y, -zHint.dot(y));
    if (z.lengthSq() < 1e-8) z.set(0, 0, 1).addScaledVector(y, -y.z);
    z.normalize();
    const x = v7.crossVectors(y, z).normalize();
    m1.makeBasis(x, y, z);
    qWorld.setFromRotationMatrix(m1);
    setWorld(rig, i, qWorld);
  }
  function setWorld(rig, i, q) {
    const p = rig.parent[i];
    if (p >= 0) qParent.copy(rig.wq[p]).invert(); else qParent.identity();
    rig.bones[i].quaternion.copy(qParent).multiply(q);
    rig.wq[i].copy(q);
    // children inherit: recompute their world quaternions from their current locals
    refreshChildren(rig, i);
  }
  function setLocal(rig, i, q) {
    rig.bones[i].quaternion.copy(q);
    const p = rig.parent[i];
    if (p >= 0) rig.wq[i].copy(rig.wq[p]).multiply(q); else rig.wq[i].copy(q);
    refreshChildren(rig, i);
  }
  function refreshChildren(rig, i) {
    for (const c of rig.children[i]) { rig.wq[c].copy(rig.wq[i]).multiply(rig.bones[c].quaternion); refreshChildren(rig, c); }
  }
  // character space position of a bone's joint (walk up the chain from the hips)
  function jointPos(rig, i, out) {
    const chain = rig.chain[i];
    out.copy(rig.bones[0].position);
    for (let k = 1; k < chain.length; k++) {
      const b = chain[k];
      v4.copy(rig.bones[b].position).applyQuaternion(rig.wq[rig.parent[b]]);
      out.add(v4);
    }
    return out;
  }

  // two bone IK: upper bone u, lower bone l, end effector e (the next joint), target in character space, pole
  function twoBone(rig, u, l, target, pole, L1, L2) {
    const H = jointPos(rig, u, v1);
    const d0 = v2.copy(target).sub(H);
    let d = d0.length();
    const dMax = (L1 + L2) * 0.999, dMin = Math.abs(L1 - L2) + 1e-3;
    if (d > dMax) { d0.multiplyScalar(dMax / d); d = dMax; }
    if (d < dMin) { d0.multiplyScalar(dMin / (d || 1)); d = dMin; }
    const uhat = v3.copy(d0).divideScalar(d);
    const cosA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    // bend direction: the pole made perpendicular to the reach line
    const bend = v4.copy(pole).addScaledVector(uhat, -pole.dot(uhat));
    if (bend.lengthSq() < 1e-8) bend.set(0, 0, 1);
    bend.normalize();
    const K = rig.tmpK.copy(H).addScaledVector(uhat, L1 * cosA).addScaledVector(bend, L1 * sinA);
    // upper bone points from H to K (its -Y), its forward toward the bend
    setBoneBasis(rig, u, rig.tmpA.copy(H).sub(K), bend);
    const E = rig.tmpE.copy(H).add(d0);
    setBoneBasis(rig, l, rig.tmpA.copy(K).sub(E), bend);
    return K;
  }

  // ---------- a rig wraps one player's skeleton with the state the animator keeps ----------
  function makeRig(bones, h, prof) {
    const parent = bones.map(b => (b.parent && b.parent.isBone ? bones.indexOf(b.parent) : -1));
    const children = bones.map(() => []);
    parent.forEach((p, i) => { if (p >= 0) children[p].push(i); });
    const chain = bones.map((b, i) => { const c = []; let k = i; while (k >= 0) { c.unshift(k); k = parent[k]; } return c; });
    const rest = bones.map(b => b.position.clone());
    return {
      bones, parent, children, chain, rest, h, prof,
      wq: bones.map(() => Q()),
      tmpK: V(), tmpA: V(), tmpE: V(),
      thighL: bones[B.shinL].position.length(), shinL: bones[B.footL].position.length(),
      upperL: bones[B.foreL].position.length(), foreL: bones[B.handL].position.length(),
      // smoothed pose parameters (critically damped so actions blend in and out)
      s: { hipY: 0, hipX: 0, hipZ: 0, pitch: 0, roll: 0, twist: 0, sPitch: 0, sRoll: 0, sYaw: 0, headYaw: 0, headPitch: 0, crouch: 0, lean: 0 },
      // springs for cloth and hair
      hem: { a: 0, v: 0, b: 0, w: 0 }, hair: { a: 0, v: 0, b: 0, w: 0 },
      // root tilt for falls and dives
      tilt: { ax: 0, az: 0, ang: 0 },
      armL: { pitch: 0, roll: 0.12, elbow: 0.3 }, armR: { pitch: 0, roll: 0.12, elbow: 0.3 },
      look: { yaw: 0, pitch: 0 }, lastT: 0, yaw: 0, rx: 0, rz: 0,
      breath: Math.random() * 6
    };
  }

  // critically damped follow: x toward target at a rate
  const follow = (x, target, rate, dt) => x + (target - x) * (1 - Math.exp(-rate * dt));

  // ---------- the pose for one player, every frame ----------
  // P: the sim player; R: the rig; ball: sim ball; t: sim time; dt: frame time; root: the player's Object3D
  function pose(P, R, ball, t, dt, root, view) {
    const h = R.h, prof = P.prof;
    const sp = Math.hypot(P.vx, P.vy);
    const vRel = clamp(sp / prof.vmax, 0, 1.1);
    const g = P.gait;
    const act = P.act;
    const kind = act ? act.k : null;
    // ---------- root: position and yaw (from the interpolated sim body) ----------
    const face = P.renderFace !== undefined ? P.renderFace : P.face;
    R.yaw = PI / 2 - face; // character +Z onto the sim facing
    R.rx = P.renderX !== undefined ? P.renderX : P.x; R.rz = P.renderY !== undefined ? P.renderY : P.y;
    root.position.set(R.rx, (P.z || 0), R.rz);
    root.rotation.set(0, R.yaw, 0);
    // falls, slides and dives tilt the whole body about the feet
    const fallW = fallWeight(P, t);
    // ---------- base parameters ----------
    let hipY = 0, hipX = 0, hipZ = 0, pitch = 0, roll = 0, twist = 0, sPitch = 0, sRoll = 0, sYaw = 0, crouch = 0;
    // acceleration in the body frame: lean into it, and into turns
    const c = Math.cos(face), s = Math.sin(face);
    const aFwd = (P.ax || 0) * c + (P.ay || 0) * s, aLat = -(P.ax || 0) * s + (P.ay || 0) * c;
    const turnLean = clamp((P.faceV || 0) * sp * 0.012, -0.32, 0.32);
    const accelLean = clamp(aFwd * 0.028, -0.25, 0.3) * (0.6 + prof.lean * 3);
    const runLean = vRel * (0.12 + (1 - prof.upright) * 0.14);
    sPitch = runLean + accelLean;
    sRoll = -turnLean * 0.8 - aLat * 0.008;
    // gait: stride phase, stance and swing
    const ph = g.ph;
    const step = Math.floor(ph);
    const frac = ph - step;
    // moving or standing, with a little hysteresis so a shuffle around walking pace does not flicker
    if (R.moving === undefined) R.moving = false;
    if (sp > 0.45 || Math.abs(P.faceV || 0) > 2) R.moving = true;
    else if (sp < 0.15 && g.idle > 0.3) R.moving = false;
    const moving = R.moving;
    const duty = dutyOf(vRel); // share of a stride a foot is on the grass (walk to sprint), the sim's own rule
    // the pelvis bobs once per step and sways toward the stance foot
    // a walk vaults over the planted leg (lowest as the feet change); a run sinks into the stance and is
    // lowest at mid stance, highest in the flight
    const bobA = (0.012 + vRel * 0.03) * prof.bounce * h;
    const runB = smooth((vRel - 0.25) / 0.5);
    hipY = moving ? -bobA * (0.5 + 0.5 * Math.cos((frac - runB * duty) * 2 * PI)) : 0;
    const stanceFoot = step % 2; // 0 left, 1 right
    hipX = moving ? (stanceFoot === 0 ? -1 : 1) * (0.012 + (1 - vRel) * 0.012) * h * Math.sin(frac * PI) : 0;
    twist = moving ? (stanceFoot === 0 ? 1 : -1) * (0.05 + vRel * 0.1) * Math.cos(frac * PI) : 0;
    sYaw = -twist * 0.8;
    crouch = vRel * 0.012;
    // ---------- feet: locked plants, swings to the next plant ----------
    const fl = R.footL || (R.footL = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0 });
    const fr = R.footR || (R.footR = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0 });
    const ankleH = 0.042 * h;
    const stepDur = g.dur || 0.3;
    const lead = sp > 0.25 ? plantLead(P, sp, g.len || 1) : 0;
    const hd = sp > 0.3 ? Math.atan2(P.vy, P.vx) : face;
    const fRoll = moving ? footRoll(P, vRel) : 0, rc = Math.cos(hd) * fRoll, rs = Math.sin(hd) * fRoll;
    const toeZ = (0.07 + 0.06 * vRel) * h, toeP = 0.65 + vRel * 0.45; // heel height and toe-down pitch at toe off
    for (const f of [0, 1]) {
      const F = f === 0 ? fl : fr;
      const pf = g.feet[f];
      const planted = f === stanceFoot ? step : step - 1; // the phase at which this foot last planted
      const sIn = ph - planted; // steps since it planted
      if (!moving) {
        // standing: the feet stay where they last planted, eased under the hips if far away
        const side = f === 0 ? 1 : -1;
        const hx = R.rx - Math.sin(face) * side * 0.11, hy = R.rz + Math.cos(face) * side * 0.11;
        const off = Math.hypot(pf.x - hx, pf.y - hy);
        if (off > 0.45) { pf.x = lerp(pf.x, hx, Math.min(1, dt * 4)); pf.y = lerp(pf.y, hy, Math.min(1, dt * 4)); }
        F.x = pf.x; F.y = pf.y; F.z = ankleH; F.pitch = 0; F.st = true;
        continue;
      }
      if (sIn < duty * 2) {
        // stance: locked to the plant, the heel lifts as it rolls to the toe
        const u = sIn / (duty * 2);
        // the ankle rides forward over the foot from heel strike to toe off
        F.x = pf.x + rc * (u - 0.5); F.y = pf.y + rs * (u - 0.5);
        const hu = Math.max(0, u - 0.45) / 0.55;
        F.z = ankleH + hu * hu * toeZ;
        F.pitch = -hu * hu * toeP;
        F.st = true;
      } else {
        // swing: lift off, the heel comes up behind (more at speed), then forward to the next plant
        const u = clamp((sIn - duty * 2) / (2 - duty * 2), 0, 1);
        const tLeft = Math.max(0, (planted + 2 - ph)) * stepDur;
        const side = f === 0 ? 1 : -1;
        const w = 0.09 + 0.05 * clamp(1 - vRel, 0, 1);
        const nx = R.rx + P.vx * tLeft + Math.cos(hd) * lead - Math.sin(hd) * side * w - rc * 0.5;
        const ny = R.rz + P.vy * tLeft + Math.sin(hd) * lead + Math.cos(hd) * side * w - rs * 0.5;
        // at speed the heel folds up behind first and the knee drives the foot through late; a walk just skims
        const run = smooth((vRel - 0.25) / 0.5);
        const e = smooth(Math.pow(u, 1 + run * 0.6));
        // from where the toe left the grass to just behind the next plant (the heel lands first)
        F.x = lerp(pf.x + rc * 0.5, nx, e); F.y = lerp(pf.y + rs * 0.5, ny, e);
        const lift = (0.045 + vRel * vRel * 0.24 * prof.knee) * h;
        // it leaves the grass from the toe-off pose (heel up, toe down) and blends into the swing
        const off = 1 - smooth(u / 0.3);
        F.z = ankleH + toeZ * off + lift * Math.sin(PI * Math.pow(u, 1 - run * 0.4));
        // early in the swing the foot trails behind the hips at speed
        const trail = run * 0.1 * h * Math.sin(u * PI) * (1 - u);
        F.x -= Math.cos(hd) * trail; F.y -= Math.sin(hd) * trail;
        F.pitch = lerp(lerp(0.6 + run * 0.5, -0.15, u) * vRel, -toeP, off);
        F.st = false;
      }
    }
    // ---------- arms swing with the opposite leg ----------
    const swing = moving ? Math.cos(frac * PI) * (stanceFoot === 0 ? 1 : -1) : 0;
    const armA = (0.18 + vRel * 0.85) * prof.arm;
    let aL = { pitch: swing * armA, roll: 0.1 + vRel * 0.08 + prof.elbow * 0.08, elbow: 0.35 + vRel * 1.05 };
    let aR = { pitch: -swing * armA, roll: 0.1 + vRel * 0.08 + prof.elbow * 0.08, elbow: 0.35 + vRel * 1.05 };
    let handIK = null; // { L: [x,y,z], R: [x,y,z], w } in sim coords
    // breathing, harder when tired
    R.breath += dt * (1.4 + (1 - P.stam) * 2.6);
    const breath = Math.sin(R.breath) * (0.012 + (1 - P.stam) * 0.03);
    sPitch += breath * 0.6;
    // ---------- jockey and shield stances ----------
    if (P.want && P.want.jockey) { crouch += 0.09; sPitch += 0.12; aL.roll += 0.35; aR.roll += 0.35; aL.pitch = 0.2; aR.pitch = 0.2; }
    if (P.want && P.want.shield) { crouch += 0.05; sPitch += 0.08; const side = 1; aL.roll += 0.6; aL.pitch = -0.2; aL.elbow = 0.4; }
    // fatigue: a heavier, more hunched body
    sPitch += (1 - P.stam) * 0.08;
    // ---------- keeper stance ----------
    if (P.gk && !kind && P.mode === "free") {
      const set = P.gkState === "set" ? 1 : P.gkState === "pos" ? 0.6 : 0.3;
      crouch += 0.08 + set * 0.06; sPitch += 0.15 + set * 0.1;
      aL = { pitch: -0.55, roll: 0.55, elbow: 1.1 }; aR = { pitch: -0.55, roll: 0.55, elbow: 1.1 };
      if (P.hands && view.ball) handIK = { L: [P.hands.x, P.hands.y + 0.12, P.hands.z], R: [P.hands.x, P.hands.y - 0.12, P.hands.z], w: 1 };
      if (view.ballHeld === P) handIK = { L: [ball.x, ball.y + 0.1, ball.z], R: [ball.x, ball.y - 0.1, ball.z], w: 1 };
    }
    // ---------- actions ----------
    let kickFoot = -1, kickTarget = null, footLock = null;
    if (kind === "kick") {
      const A = act;
      const sp2 = A.spec || {};
      const kf = A.foot; // 0 left, 1 right
      const K = kf === 0 ? fl : fr, Sf = kf === 0 ? fr : fl;
      const sideK = kf === 0 ? 1 : -1;
      const lofted = sp2.kind === "lob" || sp2.kind === "lobthru" || sp2.kind === "cross" || sp2.kind === "chip" || sp2.kind === "clear";
      const power = sp2.kind === "power" || sp2.kind === "shot" || sp2.kind === "volley";
      const tc = A.tc, T = A.T;
      const u = A.t;
      // the approach: a normal run
      if (!A.approach) {
        const pre = clamp(1 - (tc - u) / Math.max(0.12, tc - (A.t0 || 0)), 0, 1);
        const post = clamp((u - tc) / Math.max(0.1, T - tc), 0, 1);
        const kd = A.dir;
        const kx = Math.cos(kd), ky = Math.sin(kd);
        // the support foot plants beside the ball
        const bx = ball.x, by = ball.y;
        const supX = bx - kx * 0.06 + -ky * sideK * -0.24, supY = by - ky * 0.06 + kx * sideK * -0.24;
        if (pre > 0.35 || post > 0) { Sf.x = lerp(Sf.x, supX, smooth((pre - 0.35) / 0.4) * (post > 0 ? 1 : 1)); Sf.y = lerp(Sf.y, supY, smooth((pre - 0.35) / 0.4)); Sf.z = ankleH; Sf.pitch = 0; }
        // the kicking leg: back, through the ball, follow through
        const back = (power ? 0.42 : 0.28) * h, high = (lofted ? 0.5 : power ? 0.42 : 0.26) * h;
        let kxp, kyp, kzp;
        if (post <= 0) {
          const bs = smooth(pre / 0.7);
          const fw = smooth((pre - 0.7) / 0.3);
          kxp = lerp(R.rx - kx * back * bs, bx, fw);
          kyp = lerp(R.rz - ky * back * bs, by, fw);
          kzp = lerp(ankleH + back * 0.55 * bs, ankleH + 0.05, fw);
          kickTarget = { x: kxp, y: kyp, z: kzp };
        } else {
          const fo = smooth(post);
          kxp = bx + kx * high * 0.9 * fo; kyp = by + ky * high * 0.9 * fo;
          kzp = ankleH + high * Math.sin(fo * PI * 0.85);
          if (post > 0.6) { const back2 = smooth((post - 0.6) / 0.4); kxp = lerp(kxp, R.rx + kx * 0.2, back2); kyp = lerp(kyp, R.rz + ky * 0.2, back2); kzp = lerp(kzp, ankleH, back2); }
          kickTarget = { x: kxp, y: kyp, z: kzp };
        }
        kickFoot = kf;
        K.x = kickTarget.x; K.y = kickTarget.y; K.z = kickTarget.z; K.pitch = 0.4;
        // body: lean back for lofted balls, over it for drives; hips open into the swing
        const env = Math.max(pre, 1 - post) * (post < 1 ? 1 : 0);
        sPitch += (lofted ? -0.22 : 0.12) * env;
        twist += sideK * 0.35 * (pre - 0.5) * env;
        crouch += 0.05 * env;
        // arms: the far arm out for balance, the near arm back
        const sw = kf === 0 ? aL : aR, nr = kf === 0 ? aR : aL;
        sw.roll = 0.9 * env + 0.1; sw.pitch = -0.3 * env; sw.elbow = 0.4;
        nr.pitch = 0.5 * env; nr.roll = 0.3; nr.elbow = 0.6;
      }
    }
    // a dribble touch: the foot follows through where it met the ball, eased in and out (no snap)
    if (P.touch && t - P.touch.t < 0.22 && !kind) {
      const u = t - P.touch.t;
      const w = smooth(u / 0.06) * (1 - smooth((u - 0.09) / 0.12)) * 0.75;
      const F = P.touch.foot === 0 ? fl : fr;
      const tz = P.touch.kind === "sole" ? 0.2 : P.touch.kind === "head" ? F.z : 0.1;
      F.x = lerp(F.x, P.touch.x, w); F.y = lerp(F.y, P.touch.y, w); F.z = lerp(F.z, tz, w);
      F.contact = true;
      if (P.touch.kind === "outside") F.yaw = -0.5 * w * (P.touch.foot === 0 ? -1 : 1);
    }
    // skills: the active foot traces the move, pulled onto the ball at each contact
    if (kind === "skill") skillPose(P, R, act, ball, fl, fr, face, h, t, (k, v) => { if (k === "twist") twist += v; else if (k === "crouch") crouch += v; else if (k === "sPitch") sPitch += v; else if (k === "sRoll") sRoll += v; else if (k === "armsOut") { aL.roll += v; aR.roll += v; } });
    // standing tackle and poke: low, the leg shoots out at the ball and back
    if (kind === "tackle" || kind === "poke") {
      const A = act;
      const u = A.t / A.T;
      const reach = smooth(u / 0.4) * (1 - smooth((u - 0.55) / 0.45));
      const F = A.foot === 0 ? fl : fr;
      const dx = Math.cos(A.dir), dy = Math.sin(A.dir);
      const L = (kind === "poke" ? 0.85 : 0.7) * h;
      F.x = lerp(F.x, R.rx + dx * L, reach); F.y = lerp(F.y, R.rz + dy * L, reach); F.z = lerp(F.z, ankleH + 0.04, reach);
      crouch += 0.12 * reach; sPitch += 0.2 * reach;
      aL.roll += 0.5 * reach; aR.roll += 0.5 * reach;
    }
    // headers: the jump, arms up, the neck snaps through the ball
    let headSnap = 0;
    if (kind === "header") {
      const A = act;
      const toMeet = A.tMeet - A.t;
      headSnap = bell(toMeet, 0, 0.09);
      aL.pitch = -1.6 * smooth((A.t) / Math.max(0.1, A.tMeet)); aR.pitch = aL.pitch; aL.roll = 0.6; aR.roll = 0.6; aL.elbow = 0.8; aR.elbow = 0.8;
      sPitch += -0.25 + headSnap * 0.55;
      if (P.z > 0.05) { fl.z = ankleH + P.z * 0.15; fr.z = ankleH + P.z * 0.4; }
    }
    // throw in: ball over the head in both hands, back arched, then the throw
    if (kind === "throw" && !act.gkThrow) {
      const u = act.t / act.T;
      aL = { pitch: lerp(-2.8, -1.2, smooth(u)), roll: 0.25, elbow: lerp(1.6, 0.2, smooth(u)) }; aR = { pitch: aL.pitch, roll: 0.25, elbow: aL.elbow };
      sPitch += lerp(-0.35, 0.25, smooth(u));
    }
    // a stumble: the body pitches forward, the arms flail out for balance
    if (P.mode === "stumble") {
      const u = clamp(P.modeT / (P.stumbleT || 0.4), 0, 1);
      const w = Math.sin(u * PI);
      sPitch += 0.45 * w; crouch += 0.06 * w;
      aL.roll += 0.9 * w; aR.roll += 0.9 * w; aL.pitch -= 0.6 * w; aR.pitch += 0.3 * w;
    }
    // a knock: he favours one leg, a shorter stride and a dropped hip on that side
    if (P.knock > 0.05 && moving) {
      const bad = P.id % 2; // the injured leg
      const onBad = stanceFoot === bad;
      hipY -= onBad ? P.knock * 0.05 * h : 0;
      sRoll += (onBad ? 1 : -1) * P.knock * 0.12;
      (bad === 0 ? fl : fr).z += 0;
    }
    // overhead and scissor volleys: the body goes back or sideways as the leg comes over
    if (kind === "kick" && act.volley && (act.volley === "bicycle" || act.volley === "scissor")) {
      R.special = { kind: act.volley, u: clamp(act.t / Math.max(0.1, act.tc), 0, 1.6) };
      const F = act.foot === 0 ? fl : fr;
      F.z = 0.042 * h + Math.sin(clamp(act.t / Math.max(0.1, act.tc), 0, 1) * PI * 0.9) * 1.1 * h;
    } else R.special = null;
    // the face: the jaw opens to shout or celebrate, the brows knit in effort and anger
    const M = P.mood;
    let jaw = 0, brow = 0;
    if (M && t - M.t < 4) {
      const w = smooth((t - M.t) / 0.2) * (1 - smooth((t - M.t - 3) / 1));
      if (M.k === "joy") jaw = 0.35 * w; else if (M.k === "angry") { jaw = 0.22 * w; brow = 0.25 * w; } else if (M.k === "focus") brow = 0.18 * w; else if (M.k === "down") brow = -0.12 * w;
    }
    if (P.gest && t - P.gest.t < P.gest.T && (P.gest.k === "call" || P.gest.k === "appeal")) jaw = Math.max(jaw, 0.25 * Math.abs(Math.sin(t * 9)));
    if (vRel > 0.85) brow = Math.max(brow, 0.12); // effort at full tilt
    e1.set(jaw, 0, 0); q1.setFromEuler(e1); setLocal(R, B.jaw, q1);
    e1.set(brow, 0, 0); q1.setFromEuler(e1); setLocal(R, B.brow, q1);

    // ---------- the pelvis drops whenever a foot that should be on the grass is out of the leg's reach ----------
    crouch += 0.022; // a soft knee even standing: straight locked legs look wooden and leave no slack
    const legL = R.thighL + R.shinL;
    let drop = 0;
    for (const f of [0, 1]) {
      const F = f === 0 ? fl : fr;
      if (F.st === false || F.z > ankleH + 0.03) continue; // only a foot on the grass has to be reached
      const side = f === 0 ? 1 : -1;
      const hx = R.rx - Math.sin(face) * side * 0.056 * h, hy = R.rz + Math.cos(face) * side * 0.056 * h;
      const dH = Math.hypot(F.x - hx, F.y - hy);
      const reachV = Math.sqrt(Math.max(0, (legL * 0.985) ** 2 - dH * dH));
      const hipJ = 0.502 * h - crouch * h + hipY;
      let need = hipJ - (F.z + reachV);
      // a foot behind the body that the leg cannot reach rolls up onto its toes first; only what is left drops the hips
      if (need > 0 && moving && (F.x - hx) * Math.cos(hd) + (F.y - hy) * Math.sin(hd) < 0) {
        const up = Math.min(need, 0.07 * h);
        F.z += up; F.pitch -= up * 7; need -= up;
      }
      if (need > drop) drop = need;
    }
    hipY -= Math.min(drop, 0.14 * h); R.dbgDrop = drop;

    // ---------- apply the base skeleton ----------
    const sm = R.s;
    const rate = 18;
    sm.hipY = follow(sm.hipY, hipY - crouch * h, drop > 0.01 ? 40 : rate, dt);
    sm.hipX = follow(sm.hipX, hipX, rate, dt);
    sm.twist = follow(sm.twist, twist, rate, dt);
    sm.sPitch = follow(sm.sPitch, sPitch, 10, dt);
    sm.sRoll = follow(sm.sRoll, sRoll, 10, dt);
    sm.sYaw = follow(sm.sYaw, sYaw, rate, dt);
    const bones = R.bones;
    // hips: height and sway, twist and a little pitch with the lean
    bones[B.hips].position.set(R.rest[B.hips].x + sm.hipX, R.rest[B.hips].y + sm.hipY, R.rest[B.hips].z);
    e1.set(sm.sPitch * 0.35, sm.twist, sm.sRoll * 0.3, "YXZ");
    q1.setFromEuler(e1); setLocal(R, B.hips, q1);
    // spine: the lean shared over three bones, counter twist
    e1.set(sm.sPitch * 0.25, sm.sYaw * 0.4, sm.sRoll * 0.25, "YXZ"); q1.setFromEuler(e1); setLocal(R, B.spine1, q1);
    e1.set(sm.sPitch * 0.22, sm.sYaw * 0.35, sm.sRoll * 0.22, "YXZ"); q1.setFromEuler(e1); setLocal(R, B.spine2, q1);
    e1.set(sm.sPitch * 0.18 + breath, sm.sYaw * 0.3, sm.sRoll * 0.2, "YXZ"); q1.setFromEuler(e1); setLocal(R, B.chest, q1);
    // ---------- head: look at the ball (or a shoulder check), steady against the body's bob ----------
    let lookYaw = 0, lookPitch = -sm.sPitch * 0.7;
    const bx = ball.x - R.rx, by = ball.y - R.rz;
    let tgtYaw = wrap(Math.atan2(by, bx) - face);
    if (P.look && t - P.look.t < 0.7 && P.look.at === "shoulder") tgtYaw = (P.id % 2 ? 1 : -1) * 1.6;
    if (P === view.ctrlP && Math.abs(tgtYaw) > 1.3) tgtYaw = Math.sign(tgtYaw) * 1.3;
    lookYaw = clamp(tgtYaw, -1.35, 1.35);
    const dist = Math.hypot(bx, by);
    lookPitch += clamp(Math.atan2(ball.z - 1.6, dist) * 0.8, -0.6, 0.4) + headSnap * 0.6;
    // a dribbler mostly looks down at the ball and lifts his head now and then
    if (view.ballCtrl === P) { const up = (Math.sin(t * 1.3 + P.id) > 1 - prof.headUp * 0.9) ? 1 : 0; lookPitch = lerp(0.55, -0.05, up); lookYaw = up ? clamp(lookYaw * 0.3, -0.5, 0.5) : 0; }
    if (P.mood && t - P.mood.t < 4 && P.mood.k === "down") lookPitch = 0.6;
    sm.headYaw = follow(sm.headYaw, lookYaw, 7, dt);
    sm.headPitch = follow(sm.headPitch, lookPitch, 7, dt);
    e1.set(sm.headPitch * 0.4, sm.headYaw * 0.4 - sm.sYaw * 0.5, 0, "YXZ"); q1.setFromEuler(e1); setLocal(R, B.neck, q1);
    e1.set(sm.headPitch * 0.6, sm.headYaw * 0.6, -sm.sRoll * 0.3, "YXZ"); q1.setFromEuler(e1); setLocal(R, B.head, q1);
    // ---------- expression and gestures (arms) ----------
    gesture(P, R, t, aL, aR, (k, v) => { if (k === "sPitch") sm.sPitch += v * dt * 4; });
    // ---------- arms: FK swing, or IK to a target ----------
    armFK(R, B.clavL, B.armL, B.foreL, B.handL, aL, 1, dt);
    armFK(R, B.clavR, B.armR, B.foreR, B.handR, aR, -1, dt);
    // the reach for the ball fades in and out through a weight, so a keeper's arms never snap between poses
    if (handIK) R.handLast = handIK;
    R.handW = follow(R.handW || 0, handIK ? 1 : 0, handIK ? 11 : 6, dt);
    const hk = handIK || R.handLast;
    if (hk && R.handW > 0.01) {
      const w = R.handW;
      for (const bi of HAND_BONES) hq[bi].copy(R.bones[bi].quaternion);
      // the hand target on the +y side goes to the right arm (the same mirror as the legs)
      armIK(R, B.armR, B.foreR, B.handR, hk.L, -1);
      armIK(R, B.armL, B.foreL, B.handL, hk.R, 1);
      if (w < 0.99) for (const bi of HAND_BONES) { q2.copy(hq[bi]).slerp(R.bones[bi].quaternion, w); setLocal(R, bi, q2); }
    } else R.handLast = null;
    // ---------- feet never jump: the drawn foot travels to its target at a speed a foot can really move ----------
    {
      const fast = kind === "kick" || kind === "tackle" || kind === "poke" || kind === "skill" || kind === "header" || kind === "slide";
      for (const f of [0, 1]) {
        const F = f === 0 ? fl : fr;
        const D = R.drawn ? R.drawn[f] : null;
        if (!D) { if (!R.drawn) R.drawn = [{ x: F.x, y: F.y, z: F.z }, { x: fr.x, y: fr.y, z: fr.z }]; continue; }
        const ex = F.x - D.x, ey = F.y - D.y, ez = F.z - D.z;
        const d = Math.hypot(ex, ey, ez);
        const vmaxF = fast || F.contact ? 26 : 6 + sp * 2.2;
        const stepMax = vmaxF * dt;
        if (d <= stepMax || d < 0.004) { D.x = F.x; D.y = F.y; D.z = F.z; }
        else {
          const k = stepMax / d;
          D.x += ex * k; D.y += ey * k; D.z += ez * k;
          // a bigger correction becomes a little step, not a slide
          if (d > 0.12 && !fast) D.z = Math.max(D.z, F.z + Math.min(0.12, d * 0.35));
          F.x = D.x; F.y = D.y; F.z = D.z;
        }
        F.contact = false;
      }
    }

    // ---------- legs: IK to the foot targets ----------
    // lying down, sliding or diving: the legs follow the body (stretched or bent), not footprints on the grass
    if (R.tilt.ang > 0.35 || P.mode === "down" || (act && (act.k === "slide" || act.k === "dive"))) {
      const sl = act && act.k === "slide";
      const kneeBend = sl ? 0.25 : P.mode === "down" ? 0.5 : 0.2;
      bodyLegs(R, fl, fr, face, ankleH, h, kneeBend, sl ? act.foot : -1);
    }
    // the sim's foot 0 is on the body's +y side, which on screen is the right leg; foot 1 the left
    legIK(R, B.thighR, B.shinR, B.footR, B.toeR, fl, face, ankleH, -1);
    legIK(R, B.thighL, B.shinL, B.footL, B.toeL, fr, face, ankleH, 1);
    // ---------- secondary motion: the shirt hem and long hair lag behind the body ----------
    spring(R.hem, -(aFwd * 0.004 + vRel * 0.12) - Math.abs(Math.sin(frac * PI)) * vRel * 0.04, 60, 7, dt);
    e1.set(R.hem.a, 0, 0); q1.setFromEuler(e1); setLocal(R, B.hem, q1);
    spring(R.hair, -vRel * 0.4 - aFwd * 0.01 + Math.sin(frac * 2 * PI) * vRel * 0.1, 30, 4, dt);
    e1.set(R.hair.a, 0, Math.sin(frac * PI * 2) * vRel * 0.06); q1.setFromEuler(e1); setLocal(R, B.hair, q1);
    // ---------- whole body tilts for falls, slides and dives ----------
    bodyTilt(P, R, root, t, dt, fallW, face);
  }

  // feet placed in the body's own frame (used when the body is not upright): one leg reaches, one tucks
  function bodyLegs(R, fl, fr, face, ankleH, h, bend, lead) {
    const c = Math.cos(face), s = Math.sin(face);
    for (const f of [0, 1]) {
      const F = f === 0 ? fl : fr;
      const side = f === 0 ? 1 : -1;
      const reach = lead === f ? 0.9 : 0.25 + bend * 0.1;
      // in character space: forward along +Z, the leg hangs down from the hip (y down)
      const lx = side * 0.12 * h, lz = reach * 0.45 * h, ly = (1 - reach * 0.4) * 0.05 * h;
      // body frame to the grass: forward is (c, s), the body's left is (-s, c)
      F.x = R.rx + c * lz - s * lx; F.y = R.rz + s * lz + c * lx;
      F.z = ly + ankleH;
      F.pitch = 0;
      F.local = true;
    }
  }

  function spring(sp, target, k, damp, dt) {
    const a = (target - sp.a) * k - sp.v * damp;
    sp.v += a * dt; sp.a += sp.v * dt;
    sp.a = clamp(sp.a, -1.2, 1.2);
  }

  // arm FK: pitch swings forward or back, roll lifts the arm out to the side, elbow bends
  function armFK(R, clav, arm, fore, hand, A, side, dt) {
    const k = side > 0 ? "armL" : "armR";
    const s = R[k];
    s.pitch = follow(s.pitch, A.pitch, 14, dt); s.roll = follow(s.roll, A.roll, 14, dt); s.elbow = follow(s.elbow, A.elbow, 14, dt);
    setLocal(R, clav, q1.identity());
    // character axes: x is left, so raising the left arm out is a rotation about +z (negative for the right)
    e1.set(-s.pitch, 0, side * s.roll, "XZY"); q1.setFromEuler(e1); setLocal(R, arm, q1);
    e1.set(-Math.max(0, s.elbow), 0, 0); q1.setFromEuler(e1); setLocal(R, fore, q1);
    setLocal(R, hand, q1.identity());
  }
  function armIK(R, arm, fore, hand, tgt, side) {
    toLocal(R, tgt[0], tgt[1], tgt[2], R.tmpE);
    // elbows point down and out
    const pole = v3.set(side * 0.6, -0.4, -0.5);
    const tgtV = v2.copy(R.tmpE);
    const K = twoBone(R, arm, fore, tgtV, pole, R.upperL, R.foreL);
  }
  function legIK(R, thigh, shin, foot, toe, F, face, ankleH, side) {
    toLocal(R, F.x, F.y, Math.max(F.z, ankleH * 0.6), R.tmpE);
    const target = v6.copy(R.tmpE);
    const tg = rigTarget(R, target);
    // the knee points forward and a touch out
    const pole = rigPole(R, side);
    twoBone(R, thigh, shin, tg, pole, R.thighL, R.shinL);
    // the foot: flat on the grass with the body's heading, pitched for heel and toe
    e1.set(F.pitch || 0, F.yaw || 0, 0, "YXZ");
    q1.setFromEuler(e1);
    setWorld(R, foot, q1);
    setLocal(R, toe, q2.identity());
  }
  const _tg = new THREE.Vector3(), _pole = new THREE.Vector3();
  function rigTarget(R, v) { return _tg.copy(v); }
  function rigPole(R, side) { return _pole.set(side * 0.12, 0, 1); }

  // ---------- skill moves: the foot paths ----------
  // keys in the body frame at the move's start: [time share, foot (0 strong, 1 weak), fwd, side, up]; side +1 is
  // the move's side. Contacts are pulled onto the real ball.
  const SKILL_PATH = {
    stepover: [[0, 0, 0.3, -0.1, 0.03], [0.2, 0, 0.42, 0.05, 0.22], [0.38, 0, 0.35, -0.38, 0.06], [0.5, 1, 0.38, 0.12, 0.05], [0.7, 1, 0.9, 0.35, 0.04]],
    double_stepover: [[0, 0, 0.3, -0.1, 0.03], [0.18, 0, 0.42, 0.05, 0.22], [0.3, 0, 0.35, -0.38, 0.05], [0.45, 1, 0.42, 0.05, 0.22], [0.58, 1, 0.35, 0.38, 0.05], [0.72, 0, 0.4, 0.12, 0.05], [0.9, 0, 0.9, 0.4, 0.04]],
    reverse_stepover: [[0, 0, 0.3, -0.3, 0.03], [0.22, 0, 0.42, 0.0, 0.22], [0.38, 0, 0.35, 0.3, 0.06], [0.5, 0, 0.38, 0.12, 0.05]],
    body_feint: [[0, 0, 0.2, -0.35, 0.03], [0.25, 0, 0.25, -0.45, 0.05], [0.42, 1, 0.38, 0.15, 0.04], [0.7, 1, 0.9, 0.5, 0.04]],
    ball_roll: [[0, 0, 0.3, 0, 0.05], [0.3, 0, 0.33, 0.1, 0.16], [0.45, 0, 0.3, 0.55, 0.1], [0.7, 1, 0.2, 0.7, 0.04]],
    sole_roll: [[0, 0, 0.3, 0, 0.05], [0.3, 0, 0.32, 0.05, 0.17], [0.55, 0, 0.3, 0.6, 0.12], [0.8, 1, 0.2, 0.8, 0.04]],
    roulette: [[0, 0, 0.32, 0, 0.16], [0.3, 0, 0.1, -0.15, 0.15], [0.45, 1, 0.1, 0.25, 0.15], [0.6, 1, 0.3, 0.6, 0.12], [0.8, 0, 0.3, 0.8, 0.05]],
    drag_back: [[0, 0, 0.35, 0, 0.17], [0.25, 0, 0.0, 0, 0.15], [0.45, 0, -0.3, 0, 0.08], [0.7, 1, -0.4, 0.2, 0.04]],
    drag_turn: [[0, 0, 0.35, 0, 0.17], [0.22, 0, 0.0, 0, 0.14], [0.45, 0, 0.0, 0.45, 0.06], [0.7, 1, 0.1, 0.8, 0.04]],
    v_drag: [[0, 0, 0.35, 0, 0.17], [0.18, 0, -0.05, 0, 0.14], [0.42, 0, 0.3, 0.5, 0.05], [0.7, 1, 0.7, 0.7, 0.04]],
    reverse_drag: [[0, 0, 0.35, 0, 0.17], [0.2, 0, -0.05, 0, 0.14], [0.45, 0, -0.4, -0.3, 0.08], [0.7, 1, -0.6, -0.2, 0.04]],
    heel_to_heel: [[0, 0, 0.3, 0, 0.05], [0.18, 0, 0.0, 0.1, 0.12], [0.34, 1, 0.1, 0.4, 0.12], [0.6, 1, 0.8, 0.6, 0.04]],
    heel_flick: [[0, 1, 0.2, 0.1, 0.03], [0.15, 0, 0.55, 0.0, 0.16], [0.3, 0, 0.35, 0, 0.18], [0.5, 0, 0.9, 0, 0.05]],
    fake_shot: [[0, 0, -0.35, -0.1, 0.3], [0.28, 0, 0.25, -0.05, 0.12], [0.38, 0, 0.32, 0.25, 0.06], [0.6, 1, 0.6, 0.7, 0.04]],
    fake_pass: [[0, 0, -0.25, -0.1, 0.18], [0.25, 0, 0.25, 0.0, 0.1], [0.34, 0, 0.3, 0.3, 0.06], [0.6, 1, 0.6, 0.7, 0.04]],
    elastico: [[0, 0, 0.3, -0.1, 0.05], [0.1, 0, 0.36, -0.3, 0.06], [0.23, 0, 0.38, 0.3, 0.06], [0.5, 1, 0.8, 0.6, 0.04]],
    reverse_elastico: [[0, 0, 0.3, 0.1, 0.05], [0.1, 0, 0.36, -0.25, 0.06], [0.23, 0, 0.38, 0.3, 0.06], [0.5, 1, 0.8, 0.6, 0.04]],
    croqueta: [[0, 0, 0.3, -0.15, 0.05], [0.14, 0, 0.32, 0.25, 0.06], [0.3, 1, 0.4, 0.5, 0.06], [0.55, 1, 0.8, 0.8, 0.04]],
    rainbow: [[0, 1, 0.25, 0, 0.04], [0.15, 0, -0.15, 0, 0.1], [0.28, 0, -0.25, 0, 0.45], [0.45, 0, 0.3, 0, 0.1], [0.7, 1, 1.0, 0, 0.04]],
    sombrero: [[0, 0, 0.3, 0, 0.05], [0.3, 0, 0.35, 0.1, 0.32], [0.5, 0, 0.6, 0.2, 0.1], [0.8, 1, 1.0, 0.3, 0.04]],
    ball_hop: [[0, 0, 0.3, 0, 0.06], [0.16, 0, 0.32, 0, 0.12], [0.3, 1, 0.6, 0.1, 0.08], [0.6, 0, 1.0, 0, 0.04]],
    mcgeady: [[0, 0, 0.3, 0, 0.06], [0.3, 0, -0.1, 0.2, 0.2], [0.38, 0, 0.1, 0.5, 0.15], [0.6, 1, 0.6, 0.9, 0.04]],
    heel_chop: [[0, 0, 0.35, -0.2, 0.1], [0.26, 0, -0.05, 0.25, 0.1], [0.5, 1, 0.1, 0.8, 0.04]],
    lateral_heel: [[0, 0, 0.3, -0.1, 0.06], [0.24, 0, -0.02, 0.3, 0.12], [0.5, 1, 0.1, 0.9, 0.04]],
    spin_turn: [[0, 0, 0.32, 0, 0.16], [0.32, 0, -0.1, 0.1, 0.14], [0.6, 1, -0.5, 0.2, 0.05]],
    toe_taps: [[0, 0, 0.3, 0.1, 0.15], [0.15, 0, 0.3, 0.1, 0.1], [0.27, 1, 0.3, -0.1, 0.15], [0.38, 1, 0.3, -0.1, 0.1], [0.5, 0, 0.3, 0.1, 0.15], [0.6, 0, 0.3, 0.1, 0.1], [0.72, 1, 0.3, -0.1, 0.15], [0.82, 1, 0.32, 0, 0.1]],
    stop_and_go: [[0, 0, 0.35, 0, 0.18], [0.14, 0, 0.3, 0, 0.15], [0.45, 0, 0.3, 0, 0.12], [0.52, 0, 0.45, 0, 0.06], [0.75, 1, 1.0, 0, 0.04]],
    inside_out: [[0, 0, 0.35, -0.2, 0.06], [0.12, 0, 0.4, -0.35, 0.06], [0.3, 0, 0.45, 0.3, 0.06], [0.55, 1, 0.9, 0.5, 0.04]],
    outside_in: [[0, 0, 0.35, 0.2, 0.06], [0.12, 0, 0.4, -0.35, 0.06], [0.3, 0, 0.45, 0.3, 0.06], [0.55, 1, 0.9, 0.5, 0.04]],
    adv_flick: [[0, 0, 0.3, 0, 0.06], [0.14, 0, 0.4, 0.3, 0.1], [0.35, 1, 0.9, 0.6, 0.04]]
  };
  function skillPose(P, R, A, ball, fl, fr, face, h, t, add) {
    const path = SKILL_PATH[A.id];
    const u = clamp(A.t / A.T, 0, 1);
    const def = A.def || {};
    // spins turn the hips with the body, feints drop a shoulder, everything sits a little lower
    add("crouch", 0.06);
    if (def.feint) add("twist", -A.side * 0.4 * bell(u, def.feint[0], 0.12));
    if (def.feint) add("sRoll", -A.side * 0.25 * bell(u, def.feint[0], 0.12));
    add("armsOut", 0.35);
    if (!path) return;
    // where the keys are measured from: the player at the start
    if (!A.vis) A.vis = { x: P.x, y: P.y, f: A.face0 };
    const f0 = A.vis.f;
    const cf = Math.cos(f0), sf = Math.sin(f0);
    // find the segment
    let k = 0;
    while (k < path.length - 1 && path[k + 1][0] <= u) k++;
    const a = path[k], b = path[Math.min(k + 1, path.length - 1)];
    const w = b[0] > a[0] ? smooth((u - a[0]) / (b[0] - a[0])) : 0;
    const strong = P.prof.foot > 0 ? 0 : 1; // the strong foot's index (0 is the right foot on screen)
    const footOf = key => (key[1] === 0 ? strong : 1 - strong);
    const F = footOf(b) === 0 ? fl : fr;
    const sideSign = A.side;
    const fw = lerp(a[2], b[2], w), sd = lerp(a[3], b[3], w) * sideSign, up = lerp(a[4], b[4], w);
    // keys are relative to where the ball started; the body has moved on, so anchor to the live ball near contacts
    const ax = A.vis.x + cf * 0.35, ay = A.vis.y + sf * 0.35;
    let tx = ax + cf * (fw - 0.35) - sf * sd, ty = ay + sf * (fw - 0.35) + cf * sd;
    // pull onto the real ball around each contact time
    let pull = 0;
    for (const tc of def.touches || []) pull = Math.max(pull, bell(u, tc.at, 0.06));
    tx = lerp(tx, ball.x, pull * 0.85); ty = lerp(ty, ball.y, pull * 0.85);
    F.x = tx; F.y = ty; F.z = 0.042 * h + up;
    F.pitch = up > 0.12 ? -0.4 : 0;
  }

  // ---------- gestures and moods: arm poses ----------
  function gesture(P, R, t, aL, aR, add) {
    const G = P.gest;
    if (G && t - G.t < G.T) {
      const u = (t - G.t) / G.T;
      const w = smooth(u / 0.15) * (1 - smooth((u - 0.8) / 0.2));
      if (G.k === "call") { aR.pitch = lerp(aR.pitch, -2.9, w); aR.elbow = lerp(aR.elbow, 0.15, w); aR.roll = lerp(aR.roll, 0.1, w); }
      else if (G.k === "point") { aR.pitch = lerp(aR.pitch, -1.45, w); aR.roll = lerp(aR.roll, 0.35, w); aR.elbow = lerp(aR.elbow, 0.05, w); }
      else if (G.k === "hips") { for (const A of [aL, aR]) { A.pitch = lerp(A.pitch, 0.25, w); A.roll = lerp(A.roll, 0.75, w); A.elbow = lerp(A.elbow, 1.9, w); } add("sPitch", 0.3 * w); }
      else if (G.k === "appeal") { for (const A of [aL, aR]) { A.pitch = lerp(A.pitch, -0.6, w); A.roll = lerp(A.roll, 1.1, w); A.elbow = lerp(A.elbow, 0.5, w); } }
    }
    const M = P.mood;
    if (M && t - M.t < 5) {
      const u = (t - M.t);
      const w = smooth(u / 0.3) * (1 - smooth((u - 4) / 1));
      if (M.k === "joy" && P.celebrate) {
        // celebrations by style
        const st = P.celebrate.style || 0;
        if (st === 0) { aL.roll = lerp(aL.roll, 1.45, w); aR.roll = lerp(aR.roll, 1.45, w); aL.elbow = aR.elbow = lerp(aL.elbow, 0.1, w); } // the aeroplane
        else if (st === 1) { aR.pitch = lerp(aR.pitch, -2.9, w); aR.elbow = lerp(aR.elbow, 0.6, w); } // a fist to the sky
        else if (st === 2) { aL.pitch = aR.pitch = lerp(aL.pitch, -2.6, w); aL.roll = aR.roll = lerp(aL.roll, 0.5, w); } // both arms up
        else if (st === 3) { aR.pitch = lerp(aR.pitch, -1.3, w); aR.roll = lerp(aR.roll, 0.2, w); aR.elbow = lerp(aR.elbow, 0.1, w); } // pointing at the crowd
        else if (st === 4) { aL.pitch = lerp(aL.pitch, -1.2, w); aL.elbow = lerp(aL.elbow, 2.2, w); aL.roll = 0.9; } // a hand to the ear
        else { aL.pitch = aR.pitch = lerp(aL.pitch, -1.9, w); aL.roll = aR.roll = lerp(aL.roll, 1.0, w); aL.elbow = aR.elbow = lerp(aL.elbow, 0.9, w); }
      } else if (M.k === "joy") { aL.pitch = aR.pitch = lerp(aL.pitch, -2.4 + Math.sin(t * 9) * 0.3, w * 0.8); aL.roll = aR.roll = lerp(aL.roll, 0.4, w); }
      else if (M.k === "down") { aL.pitch = aR.pitch = lerp(aL.pitch, -2.2, w * 0.7); aL.elbow = aR.elbow = lerp(aL.elbow, 2.3, w * 0.7); aL.roll = aR.roll = lerp(aL.roll, 0.6, w); } // hands on the head
      else if (M.k === "angry") { aL.roll = aR.roll = lerp(aL.roll, 1.0, w * 0.6); aL.pitch = aR.pitch = lerp(aL.pitch, -0.5, w * 0.6); }
    }
  }

  // ---------- falls, slides, dives: tilt the whole body about the feet ----------
  function fallWeight(P, t) {
    if (P.mode === "fall") return smooth(P.modeT / 0.42);
    if (P.mode === "down") return 1;
    if (P.mode === "getup") return 1 - smooth(P.modeT / (P.getupT || 0.8));
    return 0;
  }
  function bodyTilt(P, R, root, t, dt, fallW, face) {
    let ang = 0, axYaw = 0, lift = 0;
    // which way he goes down: forward, back or to a side, from the sim
    if (fallW > 0) {
      const rel = wrap((P.downDir !== undefined ? P.downDir : face) - face);
      const kind = P.fallKind || "forward";
      // forward falls pitch forward, back falls backward, side falls roll
      const fwd = Math.cos(rel), side = Math.sin(rel);
      ang = fallW * (kind === "knee" ? 0.9 : 1.45);
      // the way he lies is set as he goes over; getting up from a dive or a slide keeps that side
      if (R.tilt.ang < 0.25) { R.tilt.ax = fwd; R.tilt.az = side; }
      lift = fallW * 0.1;
    }
    const A = P.act;
    if (A && A.k === "slide") {
      const u = A.phase === "plant" ? A.t / 0.1 : 1;
      ang = 1.25 * smooth(u); R.tilt.ax = -0.25; R.tilt.az = (A.foot === 1 ? 1 : -1) * 0.97;
      if (A.phase === "ground") ang *= 1 - smooth((A.t - A.t1) / 0.6) * 0.3;
    }
    if (P.dive) {
      const d = P.dive;
      const u = smooth((t - d.t0) / 0.18);
      ang = 1.35 * u; R.tilt.ax = 0; R.tilt.az = d.side * (P.team === 0 ? 1 : 1);
      // the dive goes across the goal: roll toward the side of the dive relative to the facing
      const rel = Math.sign(Math.sin(Math.atan2(d.side, 0) - face)) || d.side;
      R.tilt.az = -rel;
      lift = Math.max(0, (d.bz || 0.9) - 0.5);
    }
    // a bicycle kick goes over backwards, a scissor volley falls to the side
    if (R.special) {
      const u = R.special.u;
      ang = (R.special.kind === "bicycle" ? 1.5 : 1.1) * smooth(u / 0.9);
      R.tilt.ax = R.special.kind === "bicycle" ? -1 : 0; R.tilt.az = R.special.kind === "bicycle" ? 0 : 1;
      lift = 0.5 * Math.sin(clamp(u, 0, 1) * PI);
    }
    // the knee slide: down on both knees, leaning back, sliding to the corner
    if (P.celebrate && t - P.celebrate.t < 4 && (P.celebrate.style % 6) === 5 && P.spd > 2.5 && t - P.celebrate.t > 1.2) {
      ang = 0.35; R.tilt.ax = -1; R.tilt.az = 0; lift = -0.42;
    }
    if (P.headerDive && t - P.headerDive.t < 0.6) { ang = 1.4 * smooth((t - P.headerDive.t) / 0.2); R.tilt.ax = 1; R.tilt.az = 0; lift = 0.4 * (1 - smooth((t - P.headerDive.t) / 0.5)); }
    // a slide or a fall goes over over a quarter of a second, a dive is quicker
    R.tilt.ang = follow(R.tilt.ang, ang, P.dive ? 12 : 8, dt);
    if (R.tilt.ang > 0.002) {
      // rotate about a horizontal axis in the body frame, perpendicular to the fall direction
      const ax = R.tilt.ax, az = R.tilt.az;
      const n = Math.hypot(ax, az) || 1;
      // the character's forward is +Z: a forward fall pitches about +X
      // pitch about the body's X for a forward or backward fall, roll about its Z for a sideways one
      e1.set(R.tilt.ang * (ax / n), 0, -R.tilt.ang * (az / n), "XYZ");
      q2.setFromEuler(e1);
      q3.setFromAxisAngle(UP, R.yaw);
      root.quaternion.copy(q3).multiply(q2);
      // keep the feet near the ground as the body goes over: drop the root a little
      R.tilt.lift = follow(R.tilt.lift || 0, lift, 18, dt);
      root.position.y = (P.z || 0) + R.tilt.lift * 0.4 - Math.sin(R.tilt.ang) * 0.05;
    } else {
      R.tilt.lift = follow(R.tilt.lift || 0, lift, 18, dt);
      if (R.tilt.lift < -0.002) root.position.y = (P.z || 0) + R.tilt.lift;
    }
  }

  return { makeRig, pose };
}

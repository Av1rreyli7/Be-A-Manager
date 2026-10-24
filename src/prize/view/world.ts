/**
 * The world of one fight: the arena, the crowd, both boxers, the referee, your arms, the camera, the effects and
 * the sound, around one FightState. The page hosts it in a React Three Fiber canvas and calls frame() every frame.
 *
 * In the fight the state steps at 60 a second (a little slower for a beat after you slip a big punch perfectly),
 * and everything on screen is posed between the last two steps, so motion stays smooth on any screen. Outside the
 * fight the world runs cinematic modes: the ring walk and the introductions, the corner between rounds, the result.
 */
import * as THREE from "three";
import { begin, blankInput, nextRound, step } from "../engine/fight";
import { aiInput } from "../engine/ai";
import { DT, PUNCH } from "../engine/rules";
import type { FState, FightEvent, FightState, FighterDef, Input } from "../engine/types";
import { Arena, CORNERS, glowTexture } from "./arena";
import { Crowd } from "./crowd";
import { makeBoxer, type BoxerBody } from "./boxer";
import { BoxerAnimator, type PoseCtx } from "./animator";
import { FirstPersonArms } from "./arms";
import { CameraRig } from "./camera";
import { Controls } from "./input";
import { FightAudio } from "./audio";
import { GFX } from "./gfx";
import { makeReferee, makeTrainer, poseReferee, poseTrainer } from "./people";
import type { BodyRig } from "../../career/body";
import { B } from "../../../floodlights/m3d/view/rig.mjs";

export type WorldMode = "intro" | "fight" | "corner" | "result";

export interface WorldHooks {
  /** the fight's phase changed (pre, fight, kd, bell, corner, over) */
  phase?: (st: FightState) => void;
  /** every event the fight produced */
  event?: (e: FightEvent, st: FightState) => void;
  /** every frame, after everything is posed (the HUD writes its numbers here) */
  frame?: (w: World) => void;
  /** a good moment to save the fight */
  save?: (st: FightState) => void;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const smooth = (t: number) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

/** a small pool of sweat drops */
class Spray {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private n: number;
  private next = 0;
  constructor(n: number, tex: THREE.Texture | null) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    for (let i = 0; i < n; i++) this.pos[i * 3 + 1] = -100;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    const m = new THREE.PointsMaterial({ size: 0.022, map: tex, color: 0xe8f0ff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
  }
  burst(at: THREE.Vector3, dir: THREE.Vector3, count: number, speed: number) {
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.n;
      this.pos[i * 3] = at.x + (Math.random() - 0.5) * 0.08;
      this.pos[i * 3 + 1] = at.y + (Math.random() - 0.5) * 0.08;
      this.pos[i * 3 + 2] = at.z + (Math.random() - 0.5) * 0.08;
      const s = speed * (0.4 + Math.random() * 0.9);
      this.vel[i * 3] = dir.x * s + (Math.random() - 0.5) * 1.6;
      this.vel[i * 3 + 1] = dir.y * s + Math.random() * 1.4;
      this.vel[i * 3 + 2] = dir.z * s + (Math.random() - 0.5) * 1.6;
      this.life[i] = 0.5 + Math.random() * 0.4;
    }
  }
  update(dt: number) {
    let any = false;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= 9.8 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.life[i] <= 0 || this.pos[i * 3 + 1] < 0) {
        this.life[i] = 0;
        this.pos[i * 3 + 1] = -100;
      }
    }
    if (any) (this.points.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  }
  dispose() {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

export class World {
  readonly group = new THREE.Group();
  readonly st: FightState;
  readonly defs: [FighterDef, FighterDef];
  readonly controls = new Controls();
  readonly audio = new FightAudio();
  mode: WorldMode = "intro";
  paused = false;
  /** the computer plays your corner (tests, the soak, demos) */
  autopilot = false;
  /** the fight runs this many times faster (tests) */
  speed = 1;
  hooks: WorldHooks = {};
  quality: number;
  time = 0;
  /** seconds into the intro and into the corner */
  introT = 0;
  cornerT = 0;
  /** CPU time of the last frame, for the frame guard */
  workMs = 0;
  /** the person was hit this frame: 0 to 1.5 (the HUD flashes red) */
  hurtFlash = 0;
  /** a perfect slip's slow motion: seconds left */
  slowT = 0;
  readonly arena: Arena;
  readonly crowd: Crowd;
  readonly opp: BoxerBody;
  readonly me: BoxerBody;
  readonly oppAnim: BoxerAnimator;
  readonly meAnim: BoxerAnimator;
  readonly arms: FirstPersonArms;
  readonly ref: BodyRig;
  private trainer: BodyRig | null = null;
  private stools: THREE.Mesh[] = [];
  private camRig: CameraRig | null = null;
  private spray: Spray;
  private flash: THREE.Sprite | null = null;
  private flashT = 0;
  private glow: THREE.Texture | null;
  private acc = 0;
  private alpha = 0;
  private prev = [{ x: 0, z: 0 }, { x: 0, z: 0 }];
  private refPrev = { x: 0, z: 0 };
  private in0: Input = blankInput();
  private in1: Input = blankInput();
  private lastPhase = "";
  private saveT = 0;
  private downT = [0, 0];
  private riseT = [0, 0];
  private lastAction: (FState["action"])[] = [null, null];
  readonly oppHead = new THREE.Vector3();
  readonly oppChest = new THREE.Vector3();
  readonly myHead = new THREE.Vector3();

  constructor(st: FightState, quality: number, accent: string) {
    this.st = st;
    this.defs = st.defs;
    this.quality = quality;
    const tier = GFX[quality] || GFX[2];
    this.arena = new Arena({ quality, accent });
    this.group.add(this.arena.group);
    this.crowd = new Crowd(tier.crowd);
    this.group.add(this.crowd.mesh);
    if (this.crowd.sparkle) this.group.add(this.crowd.sparkle);
    this.opp = makeBoxer(st.defs[1], quality);
    this.me = makeBoxer(st.defs[0], Math.min(quality, 2));
    this.oppAnim = new BoxerAnimator(this.opp, st.defs[1]);
    this.meAnim = new BoxerAnimator(this.me, st.defs[0]);
    this.group.add(this.opp.root, this.me.root);
    this.arms = new FirstPersonArms(st.defs[0], quality);
    this.ref = makeReferee(quality);
    this.group.add(this.ref.root);
    this.glow = glowTexture();
    this.spray = new Spray(quality >= 2 ? 220 : 120, this.glow);
    this.group.add(this.spray.points);
    if (this.glow) {
      this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.flash.scale.setScalar(0.3);
      this.group.add(this.flash);
    }
    // the stools, out between rounds
    const stoolGeo = new THREE.CylinderGeometry(0.2, 0.17, 0.6, 16);
    for (const [c, col] of [[CORNERS.red, 0x8a1020], [CORNERS.blue, 0x16307a]] as [THREE.Vector3, number][]) {
      const s = new THREE.Mesh(stoolGeo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 }));
      s.position.set(c.x * 0.8, 0.3, c.z * 0.8);
      s.visible = false;
      this.group.add(s);
      this.stools.push(s);
    }
    this.controls.guard = st.f[0].guard;
    for (let i = 0; i < 2; i++) this.prev[i] = { x: st.f[i].x, z: st.f[i].z };
    this.refPrev = { x: st.ref.x, z: st.ref.z };
    this.lastPhase = st.phase;
    this.audio.setVolume(0.8, true);
  }

  attachCamera(camera: THREE.PerspectiveCamera) {
    this.camRig = new CameraRig(camera);
    camera.near = 0.03;
    camera.far = 140;
    camera.fov = 60;
    camera.updateProjectionMatrix();
  }

  /** eye height of a boxer in his stance */
  private eyeOf(i: number) {
    return (this.defs[i].heightCm / 100) * 0.925 - 0.075;
  }

  /** the round bell: the round starts */
  bell() {
    if (this.st.phase === "pre") begin(this.st);
    this.mode = "fight";
  }

  /** out of the corner into the next round */
  leaveCorner() {
    if (this.st.phase === "corner") nextRound(this.st);
    this.mode = "fight";
    this.cornerT = 0;
    this.camRig?.reset();
  }

  setMode(m: WorldMode) {
    this.mode = m;
    if (m === "corner") this.cornerT = 0;
    if (m === "intro") this.introT = 0;
    this.camRig?.reset();
  }

  // ------------------------------------------------------------------ the fight steps

  private simulate(dt: number) {
    const st = this.st;
    if (st.slow) {
      this.slowT = 0.6;
      st.slow = 0;
    }
    // hold at a third of the speed, then ease back over the last fifth of a second
    const scale = this.slowT > 0.18 ? 0.32 : this.slowT > 0 ? 0.32 + 0.68 * smooth(1 - this.slowT / 0.18) : 1;
    this.slowT = Math.max(0, this.slowT - dt);
    this.acc += dt * scale * this.speed;
    let n = 0;
    const max = 6 * Math.max(1, this.speed);
    while (this.acc >= DT && n < max) {
      for (let i = 0; i < 2; i++) {
        this.prev[i].x = st.f[i].x;
        this.prev[i].z = st.f[i].z;
      }
      this.refPrev.x = st.ref.x;
      this.refPrev.z = st.ref.z;
      if (this.autopilot || !st.cfg.human) aiInput(st, 0, this.in0);
      else this.controls.next(this.in0, DT);
      aiInput(st, 1, this.in1);
      step(st, [this.in0, this.in1]);
      for (const e of st.ev) this.onEvent(e);
      if (st.phase !== this.lastPhase) {
        this.lastPhase = st.phase;
        this.hooks.phase?.(st);
        this.hooks.save?.(st);
      }
      this.acc -= DT;
      n++;
      if (st.phase === "over" || st.phase === "corner" || st.phase === "pre") {
        this.acc = 0;
        break;
      }
    }
    if (n >= max) this.acc = 0;
    this.alpha = clamp(this.acc / DT, 0, 1);
    this.saveT += dt;
    if (this.saveT > 3 && st.phase === "fight") {
      this.saveT = 0;
      this.hooks.save?.(st);
    }
  }

  private onEvent(e: FightEvent) {
    const st = this.st;
    const mine = e.who === 0;
    const a = this.audio;
    switch (e.type) {
      case "punch": {
        const p = PUNCH[e.kind!].power ? 0.8 : 0.35;
        a.whoosh(p, mine);
        break;
      }
      case "hit": {
        const dmg = e.dmg ?? 1;
        const size = Math.min(1.5, dmg / 6.5);
        a.hit(dmg, e.target === "body", !mine);
        if (mine) {
          // you landed: your glove squashes, sweat flies off his head on a big one, the crowd reacts
          this.arms.setOutcome("hit");
          this.arms.hitGlove(handOfKind(st, 0, e.kind!), size);
          this.camRig?.jolt(0.15 + size * 0.2);
          if (e.target === "head" && dmg > 3.5) {
            const dir = this.oppHead.clone().sub(this.myHead).setY(0.25).normalize();
            this.spray.burst(this.oppHead, dir, Math.round(6 + size * 16), 1.5 + size * 2);
          }
          this.flashAt(e.target === "head" ? this.oppHead : this.oppChest, 0.12 + size * 0.2);
          this.crowd.roar(0.15 + size * 0.35);
        } else {
          this.oppAnim.setOutcome("hit");
          this.oppAnim.hitGlove(handOfKind(st, 1, e.kind!), size);
          const r = st.f[0].react;
          this.camRig?.hit(size, r ? r.dir : 0);
          this.hurtFlash = Math.max(this.hurtFlash, 0.3 + size * 0.5);
          if (e.target === "head" && dmg > 4) this.spray.burst(this.myHead.clone().addScaledVector(this.camForward(), 0.25), this.camForward().negate().setY(0.3), Math.round(4 + size * 10), 1 + size);
          this.crowd.roar(0.1 + size * 0.3);
        }
        break;
      }
      case "block": {
        a.block(e.dmg ?? 1);
        if (mine) {
          this.arms.setOutcome("block");
          this.oppAnim.hitGlove(true, 0.4);
          this.oppAnim.hitGlove(false, 0.4);
        } else {
          this.oppAnim.setOutcome("block");
          this.arms.hitGlove(true, 0.45);
          this.arms.hitGlove(false, 0.45);
          this.camRig?.jolt(0.25);
        }
        break;
      }
      case "miss":
        a.whiff();
        if (mine) this.arms.setOutcome("miss");
        else this.oppAnim.setOutcome("miss");
        break;
      case "evade":
        // the punch flies past
        if (mine) this.oppAnim.setOutcome("miss");
        else this.arms.setOutcome("miss");
        break;
      case "rocked":
        this.crowd.roar(0.6);
        break;
      case "kd":
        this.crowd.roar(1);
        this.downT[e.who] = 0.0001;
        this.riseT[e.who] = 0;
        if (e.who === 0) this.hurtFlash = 1.4;
        break;
      case "count":
        a.count(e.n ?? 1);
        break;
      case "rise":
      case "resume":
        if (e.type === "resume") {
          this.downT[e.who] = 0;
          this.riseT[e.who] = 0;
        }
        break;
      case "tap":
        a.tap(e.tag === "hit");
        break;
      case "bell":
        a.bell(e.text === "end" ? 3 : 1);
        if (e.text === "end") this.crowd.roar(0.5);
        break;
      case "end":
        this.crowd.roar(1);
        break;
    }
    this.hooks.event?.(e, st);
  }

  private flashAt(p: THREE.Vector3, s: number) {
    if (!this.flash) return;
    this.flash.position.copy(p);
    this.flash.scale.setScalar(s);
    this.flashT = 0.08;
  }

  private camForward() {
    const cam = this.camRig?.camera;
    return cam ? new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion) : new THREE.Vector3(1, 0, 0);
  }

  // ------------------------------------------------------------------ every frame

  frame(dt: number) {
    const t0 = performance.now();
    dt = Math.min(dt, 0.1);
    this.time += dt;
    const st = this.st;
    if (this.mode === "fight" && !this.paused && st.phase !== "over") this.simulate(dt);
    else this.alpha = 1;
    if (this.mode === "intro" && !this.paused) this.introT += dt;
    if (this.mode === "corner" && !this.paused) this.cornerT += dt;
    // down and rising clocks for the poses and the camera
    for (let i = 0; i < 2; i++) {
      const f = st.f[i];
      if (f.action?.type === "down") this.downT[i] = Math.max(this.downT[i], 0.0001) + (this.paused ? 0 : dt * (this.slowT > 0 ? 0.32 : 1) * this.speed);
      if (f.action?.type === "getup") {
        if (this.riseT[i] === 0) this.riseT[i] = 0.0001;
        this.riseT[i] += this.paused ? 0 : dt * this.speed;
      }
      if (!f.action || (f.action.type !== "down" && f.action.type !== "getup")) {
        if (st.phase !== "kd" && st.phase !== "over") {
          this.downT[i] = 0;
          this.riseT[i] = 0;
        }
      }
      this.lastAction[i] = f.action;
    }
    this.poseAll(dt);
    // effects
    this.spray.update(dt);
    if (this.flash) {
      this.flashT = Math.max(0, this.flashT - dt);
      (this.flash.material as THREE.SpriteMaterial).opacity = this.flashT > 0 ? (this.flashT / 0.08) * 0.8 : 0;
    }
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.8);
    // the crowd hums with the fight and swells with big moments
    const base = this.mode === "intro" ? 0.45 : st.phase === "kd" ? 0.8 : st.phase === "fight" ? 0.12 + clamp(1 - Math.min(st.f[0].headHP, st.f[1].headHP) / 100, 0, 1) * 0.25 : 0.2;
    this.crowd.update(this.time, dt, base);
    this.audio.crowd(this.crowd.level);
    this.audio.heartbeat(st.phase === "fight" || st.phase === "kd" ? clamp((45 - st.f[0].headHP) / 45, 0, 1) + (st.f[0].rocked > 0 ? 0.4 : 0) : 0);
    this.arena.update(this.time, dt, st.f.map(f => ({ x: f.x, z: f.z })));
    this.hooks.frame?.(this);
    this.workMs = performance.now() - t0;
  }

  private lerpPos(i: number) {
    const a = this.alpha;
    const f = this.st.f[i];
    return { x: this.prev[i].x + (f.x - this.prev[i].x) * a, z: this.prev[i].z + (f.z - this.prev[i].z) * a };
  }

  private ctxFor(i: number, x: number, z: number, faceX: number, faceZ: number, head: THREE.Vector3, body: THREE.Vector3, mode: PoseCtx["mode"]): PoseCtx {
    const f = this.st.f[i];
    return {
      x, z,
      yaw: Math.atan2(faceX - x, faceZ - z),
      head, body,
      time: this.time + i * 3.3,
      mode,
      downT: this.downT[i],
      riseT: this.riseT[i],
      speed: Math.hypot(f.vx, f.vz),
      alpha: this.alpha,
    };
  }

  private poseAll(dt: number) {
    const st = this.st;
    const cam = this.camRig?.camera;
    const p0 = this.lerpPos(0), p1 = this.lerpPos(1);
    const mode = this.mode;
    const corner = mode === "corner";
    const result = mode === "result";
    const intro = mode === "intro";
    for (const s of this.stools) s.visible = corner || (result && false);
    // ---- where everyone stands in the cinematic modes
    let oppX = p1.x, oppZ = p1.z, meX = p0.x, meZ = p0.z;
    if (corner) {
      oppX = CORNERS.blue.x * 0.8; oppZ = CORNERS.blue.z * 0.8;
      meX = CORNERS.red.x * 0.8; meZ = CORNERS.red.z * 0.8;
    }
    if (intro) {
      oppX = CORNERS.blue.x * 0.62; oppZ = CORNERS.blue.z * 0.62;
      meX = CORNERS.red.x * 0.62; meZ = CORNERS.red.z * 0.62;
      if (this.introT > 13.5) {
        oppX = 0.55; oppZ = 0.55;
        meX = -0.55; meZ = -0.55;
      }
    }
    const winner = st.result?.winner;
    if (result) {
      const w = winner === null || winner === undefined ? -1 : winner;
      // the winner in the middle, the loser off toward his corner
      if (w === 0) { meX = -0.2; meZ = -0.2; oppX = CORNERS.blue.x * 0.55; oppZ = CORNERS.blue.z * 0.55; }
      else if (w === 1) { oppX = 0.2; oppZ = 0.2; meX = CORNERS.red.x * 0.55; meZ = CORNERS.red.z * 0.55; }
      else { meX = -0.5; meZ = -0.5; oppX = 0.5; oppZ = 0.5; }
    }
    // ---- your head (the opponent aims at it) from last frame's camera, or your body in third person
    const myEye = this.eyeOf(0);
    if (mode === "fight" && cam) this.myHead.copy(cam.position);
    else this.myHead.set(meX, myEye + 0.05, meZ);
    const fwdToMe = new THREE.Vector3(meX - oppX, 0, meZ - oppZ).normalize();
    const chin = this.myHead.clone().addScaledVector(fwdToMe, -0.05);
    chin.y -= 0.07;
    const myBody = this.myHead.clone().addScaledVector(fwdToMe, -0.02);
    myBody.y -= 0.5;
    // ---- the other boxer
    const oppMode: PoseCtx["mode"] = corner ? "stool" : result ? (winner === 1 ? "win" : winner === 0 ? "lose" : "fight") : st.clinch ? "clinch" : st.f[1].action?.type === "down" || st.f[1].action?.type === "getup" || (st.kd?.who === 1 && st.phase === "kd" && st.kd.stage !== "check") ? "down" : "fight";
    const oppCtx = this.ctxFor(1, oppX, oppZ, corner ? 0 : meX, corner ? 0 : meZ, chin, myBody, oppMode);
    this.oppAnim.update(st.f[1], oppCtx, dt);
    this.opp.setDamage(st.f[1].cut, st.f[1].swell, clamp((st.round - 1) / 6 + (1 - st.f[1].stamina / 100) * 0.4, 0, 1));
    this.oppHead.setFromMatrixPosition(this.opp.bones[B.head].matrixWorld);
    this.oppChest.setFromMatrixPosition(this.opp.bones[B.chest].matrixWorld);
    // ---- your boxer, seen only in the cinematic shots
    const thirdPerson = (intro && this.introT > 10.4 && this.introT < 13.5) || result;
    this.me.root.visible = thirdPerson;
    if (thirdPerson) {
      const meMode: PoseCtx["mode"] = result ? (winner === 0 ? "win" : winner === 1 ? "lose" : "fight") : "fight";
      const meCtx = this.ctxFor(0, meX, meZ, oppX, oppZ, this.oppHead, this.oppChest, meMode);
      this.meAnim.update(st.f[0], meCtx, dt);
      this.me.setDamage(st.f[0].cut, st.f[0].swell, clamp((st.round - 1) / 6, 0, 1));
    }
    // ---- the referee
    {
      const r = this.ref;
      let rx = this.refPrev.x + (st.ref.x - this.refPrev.x) * this.alpha, rz = this.refPrev.z + (st.ref.z - this.refPrev.z) * this.alpha;
      let act = st.ref.act;
      if (intro) {
        rx = 0.3; rz = -0.3; act = "watch";
        if (this.introT > 13.5) { rx = 0.75; rz = -0.75; }
      }
      if (corner) { rx = CORNERS.n2.x * 0.7; rz = CORNERS.n2.z * 0.7; act = "watch"; }
      if (result) {
        const wx = winner === 1 ? oppX : meX, wz = winner === 1 ? oppZ : meZ;
        rx = wx + 0.55; rz = wz - 0.55;
        act = winner === null || winner === undefined ? "watch" : "raise";
      }
      const lookX = st.phase === "kd" && st.kd ? st.f[st.kd.who].x : (meX + oppX) / 2;
      const lookZ = st.phase === "kd" && st.kd ? st.f[st.kd.who].z : (meZ + oppZ) / 2;
      const moved = Math.hypot(rx - r.root.position.x, rz - r.root.position.z);
      r.root.position.set(rx, 0, rz);
      r.tick(dt, Math.atan2(lookX - rx, lookZ - rz), Math.min(2, moved / Math.max(dt, 1e-3)));
      poseReferee(r, act, st.kd ? st.kd.count : 0, st.kd ? st.kd.t : this.time);
    }
    // ---- the trainer, in the corner only
    if (corner && !this.trainer && this.quality >= 0) {
      this.trainer = makeTrainer(Math.min(this.quality, 2), "#ff4630");
      this.group.add(this.trainer.root);
    }
    if (this.trainer) {
      this.trainer.root.visible = corner;
      if (corner) {
        const toC = new THREE.Vector3(-meX, 0, -meZ).normalize();
        const side = new THREE.Vector3(-toC.z, 0, toC.x);
        const tp = new THREE.Vector3(meX, 0, meZ).addScaledVector(toC, 0.85).addScaledVector(side, 0.28);
        this.trainer.root.position.copy(tp);
        this.trainer.tick(dt, Math.atan2(meX - tp.x, meZ - tp.z), 0);
        poseTrainer(this.trainer, this.time, 1);
      }
    }
    // ---- the camera and your arms
    if (!this.camRig || !cam) return;
    if (mode === "fight") {
      const f0 = st.f[0];
      const rocked = f0.rocked > 0 ? clamp(f0.rocked / 2, 0.35, 1) : 0;
      const look = st.phase === "kd" && st.kd?.who === 1 ? this.oppChest : this.oppHead;
      this.camRig.fight({ x: p0.x, z: p0.z, eye: myEye, look, hx: f0.hx, hy: f0.hy, hz: f0.hz, aimX: this.in0.aimX, aimY: this.in0.aimY, rocked, tired: clamp(1 - f0.stamina / 60, 0, 1), downT: this.downT[0], riseT: this.riseT[0], clinch: !!st.clinch }, dt);
      const hideArms = this.downT[0] > 0.25 && this.riseT[0] < 0.9;
      this.arms.update(cam, f0, this.oppHead.clone().add(new THREE.Vector3(0, -0.03, 0)), this.oppChest.clone().add(new THREE.Vector3(0, -0.12, 0)), this.alpha, dt, hideArms);
      this.arms.group.visible = !hideArms;
    } else {
      this.arms.group.visible = false;
      this.cinematic(cam, dt, { meX, meZ, oppX, oppZ });
    }
    if (!this.arms.group.parent && cam) cam.add(this.arms.group);
  }

  private cinematic(cam: THREE.PerspectiveCamera, dt: number, p: { meX: number; meZ: number; oppX: number; oppZ: number }) {
    const rig = this.camRig!;
    const t = this.mode === "intro" ? this.introT : this.mode === "corner" ? this.cornerT : this.time;
    const oppHead = this.oppHead.clone();
    if (this.mode === "intro") {
      // the walk down the aisle to the red corner, up into the ring, then the two of you in turn, then the middle
      const aisle = new THREE.Vector3(-1, 0, -1).normalize();
      if (t < 5.5) {
        const k = smooth(t / 5.5);
        const d = 15 - k * 11.2;
        const y = -1.2 + 1.65 + Math.sin(t * 6.2) * 0.02 + (k > 0.85 ? (k - 0.85) / 0.15 * 1.25 : 0);
        const from = new THREE.Vector3(aisle.x * d, y, aisle.z * d);
        const at = from.clone().addScaledVector(aisle, -4).setY(y - 0.1 + k * 0.4);
        if (k > 0.7) at.lerp(oppHead, (k - 0.7) / 0.3);
        rig.shot(from, at);
      } else if (t < 10.4) {
        // the blue corner: a slow push in on his face
        const k = (t - 5.5) / 4.9;
        const toMe = new THREE.Vector3(p.meX - p.oppX, 0, p.meZ - p.oppZ).normalize();
        const side = new THREE.Vector3(-toMe.z, 0, toMe.x);
        const from = oppHead.clone().addScaledVector(toMe, 1.6 - k * 0.5).addScaledVector(side, 0.55 - k * 0.2);
        from.y = oppHead.y - 0.15 + k * 0.05;
        rig.shot(from, oppHead.clone().setY(oppHead.y - 0.05));
      } else if (t < 13.5) {
        // the red corner: you, from the front
        const k = (t - 10.4) / 3.1;
        const myHead = new THREE.Vector3().setFromMatrixPosition(this.me.bones[B.head].matrixWorld);
        const toOpp = new THREE.Vector3(p.oppX - p.meX, 0, p.oppZ - p.meZ).normalize();
        const side = new THREE.Vector3(-toOpp.z, 0, toOpp.x);
        const from = myHead.clone().addScaledVector(toOpp, 1.7 - k * 0.45).addScaledVector(side, -0.5 + k * 0.15);
        from.y = myHead.y - 0.2 + k * 0.08;
        rig.shot(from, myHead.clone().setY(myHead.y - 0.08));
      } else {
        // the middle of the ring, face to face, the referee between you
        const eye = new THREE.Vector3(p.meX, this.eyeOf(0), p.meZ);
        rig.shot(eye, oppHead);
      }
    } else if (this.mode === "corner") {
      // on your stool, looking out across the ring past your trainer
      const eye = new THREE.Vector3(p.meX, 1.12, p.meZ);
      const at = new THREE.Vector3(p.oppX, 0.95, p.oppZ).lerp(new THREE.Vector3(0, 1, 0), 0.3);
      at.x += Math.sin(t * 0.4) * 0.05;
      rig.shot(eye, at);
    } else {
      // the result: a slow orbit round the winner
      const w = this.st.result?.winner;
      const cx = w === 1 ? p.oppX : w === 0 ? p.meX : 0, cz = w === 1 ? p.oppZ : w === 0 ? p.meZ : 0;
      const ang = t * 0.18 + 0.6;
      const from = new THREE.Vector3(cx + Math.cos(ang) * 3.1, 1.55, cz + Math.sin(ang) * 3.1);
      rig.shot(from, new THREE.Vector3(cx, 1.45, cz));
    }
    void dt;
  }

  /** where to draw a world point on screen (for the HUD), or null when behind the camera */
  project(p: THREE.Vector3, w: number, h: number) {
    const cam = this.camRig?.camera;
    if (!cam) return null;
    const v = p.clone().project(cam);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
  }

  get shake() {
    return this.camRig?.shake ?? 0;
  }

  dispose() {
    this.controls.detach();
    this.audio.dispose();
    this.arena.dispose();
    this.crowd.dispose();
    this.opp.dispose();
    this.me.dispose();
    this.arms.dispose();
    this.ref.dispose();
    this.trainer?.dispose();
    this.spray.dispose();
    this.glow?.dispose();
    for (const s of this.stools) (s.material as THREE.Material).dispose();
    this.stools[0]?.geometry.dispose();
    if (this.flash) (this.flash.material as THREE.Material).dispose();
    this.arms.group.removeFromParent();
  }
}

function handOfKind(st: FightState, i: number, kind: string) {
  const lead = st.f[i].stance === "orthodox" ? "L" : "R";
  const isLead = PUNCH[kind as keyof typeof PUNCH].hand === "lead";
  const hand = isLead ? lead : lead === "L" ? "R" : "L";
  return hand === "L";
}

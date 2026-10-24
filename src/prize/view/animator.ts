/**
 * Poses a boxer's bones every frame from the fight state. Character space is the rig's: +Y up, +Z toward the other
 * boxer, +X the boxer's left. The fight engine's "right" is -X here.
 *
 * The pose is built in layers: the stance (a bladed crouch, the lead foot forward), footwork (planted feet that
 * step), the torso (blade, punch rotation, slips and ducks matched to the engine's head offset, hit snaps on
 * springs, the rocked wobble, breathing, the tell before a punch), the arms (two bone IK to the guard or along the
 * punch path), the head (looking at the other boxer). Whole body states (down, getting up, the clinch, the stool,
 * the walk, the celebration) take over where they apply.
 */
import * as THREE from "three";
import { B } from "../../../floodlights/m3d/view/rig.mjs";
import type { BoxerBody } from "./boxer";
import type { FState, FighterDef, Guard, PunchKind } from "../engine/types";
import { PUNCH, handOf } from "../engine/rules";

const v3 = () => new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const smooth = (t: number) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

/** a damped spring on one number, for hit snaps */
class Spring {
  x = 0;
  v = 0;
  constructor(public k: number, public c: number) {}
  step(dt: number) {
    const a = -this.k * this.x - this.c * this.v;
    this.v += a * dt;
    this.x += this.v * dt;
    if (Math.abs(this.x) < 1e-5 && Math.abs(this.v) < 1e-4) this.x = this.v = 0;
  }
}

/** what the animator is told each frame, besides the engine fighter */
export interface PoseCtx {
  /** world position of the boxer (feet on the canvas) and his facing (radians, +Z of the rig turned to it) */
  x: number;
  z: number;
  yaw: number;
  /** world points to aim at: the other boxer's head and body */
  head: THREE.Vector3;
  body: THREE.Vector3;
  /** seconds since the fight view started (for idle motion) */
  time: number;
  /** whole body states set by the scene */
  mode: "fight" | "down" | "clinch" | "stool" | "walk" | "win" | "lose" | "idle";
  /** for down: seconds since the fall, and whether he is getting up (seconds since the rise began) */
  downT: number;
  riseT: number;
  /** speed over the floor (m/s) for the walk and footwork */
  speed: number;
  /** a sub step of the 60 per second fight (0 to 1), so motion is smooth on fast screens */
  alpha: number;
}

export class BoxerAnimator {
  readonly bones: THREE.Bone[];
  readonly h: number;
  private rest: THREE.Vector3[];
  private headX = new Spring(170, 13);
  private headY = new Spring(170, 13);
  private headZ = new Spring(170, 13);
  private bodyX = new Spring(90, 11);
  private bodyZ = new Spring(90, 11);
  private push = new Spring(120, 14);
  private lastReact = -1;
  private feet: { p: THREE.Vector3; from: THREE.Vector3; to: THREE.Vector3; t: number; stepping: boolean }[];
  private punchKey = "";
  private punchTarget = v3();
  private punchStart = v3();
  private guardSmooth: { L: THREE.Vector3; R: THREE.Vector3 } | null = null;
  private tmp = { a: v3(), b: v3(), c: v3(), d: v3(), e: v3(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), m: new THREE.Matrix4() };
  private impact = [0, 0];
  /** how the punch in flight ended: set by the world from the fight's events at the moment of contact */
  private outcome: "pending" | "hit" | "block" | "miss" = "pending";
  private outcomeT = 0;
  private gait = 0;
  private lastT = 0;

  constructor(public body: BoxerBody, public def: FighterDef) {
    this.bones = body.bones;
    this.h = body.h;
    // longer arms for a long reach: the forearm and hand bones move out a little (within 8 percent)
    const armK = clamp((def.reachIn * 2.54) / def.heightCm, 0.95, 1.08);
    for (const b of [B.foreL, B.handL, B.foreR, B.handR]) this.bones[b].position.multiplyScalar(armK);
    this.rest = this.bones.map(b => b.position.clone());
    this.feet = [0, 1].map(() => ({ p: v3(), from: v3(), to: v3(), t: 1, stepping: false }));
  }

  /** the arm lengths (upper, forearm plus the glove to the knuckles) */
  private armLen(left: boolean) {
    const f = this.rest[left ? B.foreL : B.foreR].length();
    const hnd = this.rest[left ? B.handL : B.handR].length();
    return [f, hnd + 0.11];
  }

  private resetPose() {
    for (let i = 0; i < this.bones.length; i++) {
      this.bones[i].quaternion.identity();
      this.bones[i].position.copy(this.rest[i]);
    }
  }

  private rot(i: number, x: number, y: number, z: number) {
    const q = this.tmp.q.setFromEuler(new THREE.Euler(x, y, z, "YXZ"));
    this.bones[i].quaternion.multiply(q);
  }

  /** turn a bone so its rest direction (down its child) points along a world direction */
  private aim(bone: THREE.Bone, worldDir: THREE.Vector3) {
    const pq = this.tmp.q2;
    bone.parent!.getWorldQuaternion(pq);
    const local = this.tmp.e.copy(worldDir).normalize().applyQuaternion(pq.invert());
    bone.quaternion.setFromUnitVectors(DOWN, local);
    bone.updateMatrixWorld(true);
  }

  /** two bone IK: upper, lower, end; reach the world target with the elbow (or knee) toward the pole */
  private ik(upper: THREE.Bone, lower: THREE.Bone, target: THREE.Vector3, pole: THREE.Vector3, L1: number, L2: number) {
    upper.parent!.updateMatrixWorld(true);
    const A = this.tmp.a.setFromMatrixPosition(upper.matrixWorld);
    const toT = this.tmp.b.subVectors(target, A);
    let d = toT.length();
    const dir = toT.clone().normalize();
    d = clamp(d, Math.abs(L1 - L2) + 0.01, L1 + L2 - 0.002);
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
    const hgt = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const pv = this.tmp.c.subVectors(pole, A);
    pv.addScaledVector(dir, -pv.dot(dir));
    if (pv.lengthSq() < 1e-8) pv.set(0, -1, 0).addScaledVector(dir, -dir.y);
    pv.normalize();
    const E = this.tmp.d.copy(A).addScaledVector(dir, a).addScaledVector(pv, hgt);
    this.aim(upper, new THREE.Vector3().subVectors(E, A));
    const T = new THREE.Vector3().copy(A).addScaledVector(dir, d);
    this.aim(lower, new THREE.Vector3().subVectors(T, E));
  }

  /** set an end bone's world orientation: its -Y along fwd, its +Z toward thumb */
  private orient(bone: THREE.Bone, fwd: THREE.Vector3, thumb: THREE.Vector3) {
    const y = this.tmp.a.copy(fwd).normalize().negate();
    const z = this.tmp.b.copy(thumb).addScaledVector(y, -thumb.dot(y));
    if (z.lengthSq() < 1e-8) z.set(0, 0, 1);
    z.normalize();
    const x = this.tmp.c.crossVectors(y, z).normalize();
    this.tmp.m.makeBasis(x, y, z);
    const qw = new THREE.Quaternion().setFromRotationMatrix(this.tmp.m);
    const pq = this.tmp.q2;
    bone.parent!.getWorldQuaternion(pq);
    bone.quaternion.copy(pq.invert().multiply(qw));
    bone.updateMatrixWorld(true);
  }

  /** the punch in flight landed, was blocked or missed */
  setOutcome(o: "hit" | "block" | "miss") {
    this.outcome = o;
    this.outcomeT = 0;
  }

  /** a glove's impact: it squashes for a moment (index 0 left, 1 right) */
  hitGlove(left: boolean, power: number) {
    this.impact[left ? 0 : 1] = Math.max(this.impact[left ? 0 : 1], clamp(power, 0.2, 1));
  }

  update(f: FState, ctx: PoseCtx, dt: number) {
    const h = this.h;
    const bones = this.bones;
    const root = this.body.root;
    root.position.set(ctx.x, 0, ctx.z);
    root.rotation.set(0, ctx.yaw, 0);
    root.updateMatrixWorld(true);
    this.resetPose();
    const t = ctx.time;
    for (const s of [this.headX, this.headY, this.headZ, this.bodyX, this.bodyZ, this.push]) s.step(Math.min(dt, 1 / 30));
    const orth = f.stance === "orthodox";
    const L = orth ? 1 : -1; // the lead side in character x
    const a = f.action;

    // ---- hit reactions start on a fresh react
    if (f.react && f.react.t === 17 && this.lastReact !== ctx.time) {
      this.lastReact = ctx.time;
      const s = f.react.size;
      const d = f.react.dir;
      if (d === -1 || d === 1) {
        // hit on the right (dir -1): the head snaps round to the left
        this.headY.v += -d * 7 * s;
        this.headZ.v += d * 4 * s;
        this.bodyZ.v += d * 1.6 * s;
      } else if (d === 0) {
        this.headX.v -= 6 * s;
        this.bodyX.v -= 1.8 * s;
      } else if (d === 3) {
        this.headX.v -= 10 * s;
        this.bodyX.v -= 2.4 * s;
      } else if (d === 2) {
        this.bodyX.v += 4.5 * s;
        this.headX.v += 2 * s;
      }
      this.push.v -= 0.9 * s;
    }

    // ---- whole body states
    if (ctx.mode === "down") return this.poseDown(f, ctx);
    if (ctx.mode === "stool") return this.poseStool(ctx);

    // ---- the stance: crouched, bladed, bouncing a little
    const tired = clamp(1 - f.stamina / 60, 0, 1);
    const rocked = f.rocked > 0 ? clamp(f.rocked / 2, 0.4, 1) : 0;
    const walk = ctx.mode === "walk";
    const bounce = walk ? 0 : Math.sin(t * 2 * Math.PI * 1.7) * 0.006 * h * (1 - tired * 0.6);
    let hipsY = (walk ? 0 : -0.035 * h) + bounce;
    let hipsX = 0, hipsZ = 0;
    let bladeY = walk ? 0 : -0.42 * L; // turn the lead shoulder toward the other boxer
    let spineX = walk ? 0.02 : 0.1; // lean in a little
    let spineZ = 0, chestY = walk ? 0 : 0.18 * L, chestX = 0;
    // rocked: the legs go, the body sways
    if (rocked) {
      hipsY -= (0.02 + 0.015 * Math.sin(t * 5.1)) * h * rocked;
      hipsX += Math.sin(t * 2.3) * 0.025 * h * rocked;
      spineZ += Math.sin(t * 2.9) * 0.1 * rocked;
      spineX += 0.06 * rocked;
    }
    // breathing: heavier when tired
    const breath = Math.sin(t * (1.6 + tired * 1.4) * Math.PI) * (0.012 + tired * 0.03);
    chestX -= breath;

    // ---- the punch in progress: how far along, which side, how the body turns into it
    let pk: PunchKind | null = null;
    let pe = 0; // 0 guard, 1 at the target
    let pBody = false;
    let pLeft = false;
    if (a?.type === "punch" && ctx.mode === "fight") {
      pk = a.kind!;
      pBody = a.target === "body";
      pLeft = handOf(pk, f.stance) === "L";
      const S = a.startup!, A = a.active!, R = a.recovery!;
      const tt = a.t + ctx.alpha;
      if (tt < S) {
        const p = tt / S;
        pe = p < 0.18 ? -0.12 * (p / 0.18) : -0.12 + 1.12 * Math.pow((p - 0.18) / 0.82, 1.5);
      } else if (tt < S + A) pe = 1;
      else pe = 1 - easeOut((tt - S - A) / R);
      const side = pLeft ? 1 : -1; // the punching side in character x
      const spec = PUNCH[pk];
      const e = clamp(pe, 0, 1);
      if (spec.path === "straight") {
        chestY += -side * (spec.hand === "rear" ? 0.55 : 0.2) * e;
        bladeY += -side * (spec.hand === "rear" ? 0.4 : 0.08) * e;
        hipsZ += (spec.hand === "lead" ? 0.06 : 0.04) * h * e;
        spineX += 0.08 * e;
      } else if (spec.path === "hook") {
        chestY += -side * 0.7 * e;
        bladeY += -side * 0.35 * e;
        spineZ += -side * 0.08 * e;
        hipsZ += 0.03 * h * e;
      } else {
        chestY += -side * 0.3 * e;
        hipsY += (pe < 0.5 ? -0.03 : -0.03 + 0.05 * (pe - 0.5) * 2) * h * clamp(pe * 2, 0, 1);
        spineX += -0.1 * e;
      }
      if (pBody) {
        hipsY -= 0.06 * h * e;
        spineX += 0.22 * e;
        spineZ += -side * 0.12 * e;
      }
    }
    // ---- the tell: the shoulder loads before the computer's first punch
    let tellSide = 0, tellQ = 0;
    if (f.tell && ctx.mode === "fight") {
      tellQ = smooth(f.tell.t / Math.max(1, f.tell.dur));
      tellSide = handOf(f.tell.kind, f.stance) === "L" ? 1 : -1;
      chestY += tellSide * 0.2 * tellQ;
      hipsY -= 0.012 * h * tellQ;
      spineX += 0.04 * tellQ;
    }
    // ---- head movement: match the engine's head offset (right, up, back in metres)
    const hx = f.hx, hy = f.hy, hz = f.hz;
    const Lh = 0.37 * h;
    hipsX += -hx * 0.3; // right is -x
    spineZ += Math.asin(clamp((hx * 0.7) / Lh, -0.9, 0.9));
    if (hy < 0) {
      hipsY += hy * 0.6;
      spineX += Math.acos(clamp(1 - (-hy * 0.4) / Lh, -1, 1));
    }
    if (hz !== 0) {
      spineX -= Math.asin(clamp((hz * 0.8) / Lh, -0.9, 0.9));
      hipsZ -= hz * 0.2;
    }
    if (a?.type === "evade" && a.ev === "roll") chestY += -L * 0.35 * smooth(a.t / Math.max(1, a.w1!));
    // ---- the walk
    if (walk) {
      this.gait += ctx.speed * dt * 3.2;
      hipsY += Math.abs(Math.sin(this.gait)) * 0.012 * h;
    }
    // ---- hit springs and the push back
    hipsZ += this.push.x * 0.04 * h;
    spineX += this.bodyX.x;
    spineZ += this.bodyZ.x;

    // ---- apply the torso
    bones[B.hips].position.set(this.rest[B.hips].x + hipsX, this.rest[B.hips].y + hipsY, this.rest[B.hips].z + hipsZ);
    this.rot(B.hips, 0, bladeY, 0);
    this.rot(B.spine1, spineX * 0.35, chestY * 0.3, spineZ * 0.4);
    this.rot(B.spine2, spineX * 0.35 + chestX * 0.5, chestY * 0.35, spineZ * 0.35);
    this.rot(B.chest, spineX * 0.3 + chestX * 0.5, chestY * 0.35, spineZ * 0.25);
    // the philly shell lifts the lead shoulder; a punch reaches the shoulder forward
    this.rot(L > 0 ? B.clavL : B.clavR, 0, 0, f.guard === "philly" && ctx.mode === "fight" ? -L * 0.16 : 0);
    if (pk) {
      const e = clamp(pe, 0, 1);
      this.rot(pLeft ? B.clavL : B.clavR, 0, (pLeft ? -1 : 1) * 0.35 * e, 0);
    }
    root.updateMatrixWorld(true);

    // ---- the head: look at the other boxer, plus the snaps
    {
      const head = bones[B.head];
      const neck = bones[B.neck];
      neck.updateMatrixWorld(true);
      const hp = this.tmp.a.setFromMatrixPosition(head.matrixWorld);
      const to = this.tmp.b.subVectors(ctx.head, hp);
      // into the neck's own frame
      const nq = neck.getWorldQuaternion(this.tmp.q2).invert();
      to.applyQuaternion(nq);
      const yaw = clamp(Math.atan2(to.x, to.z), -0.9, 0.9);
      const pitch = clamp(-Math.atan2(to.y, Math.hypot(to.x, to.z)), -0.6, 0.6);
      this.rot(B.neck, pitch * 0.4, yaw * 0.45, 0);
      this.rot(B.head, pitch * 0.6 + this.headX.x + (rocked ? Math.sin(t * 3.7) * 0.08 * rocked : 0), yaw * 0.55 + this.headY.x, this.headZ.x + (rocked ? Math.sin(t * 2.2) * 0.1 * rocked : 0));
      // the jaw drops when he is blowing
      this.rot(B.jaw, tired * 0.12 + Math.max(0, breath) * 2, 0, 0);
    }
    root.updateMatrixWorld(true);

    // ---- the gloves: guard targets in the boxer's own space, then the punch path in the world
    const R = -L;
    const g = this.guardTargets(f.guard, L, R, tired, rocked, ctx.mode);
    // the gloves ride with the chest when he slips or leans
    const chest = bones[B.chest];
    const chestNow = this.tmp.c.setFromMatrixPosition(chest.matrixWorld);
    const chestRest = this.tmp.d.set(0, this.rest[B.hips].y + this.rest[B.spine1].y + this.rest[B.spine2].y + this.rest[B.chest].y, 0).applyMatrix4(root.matrixWorld);
    const ride = chestNow.clone().sub(chestRest);
    const toWorld = (v: THREE.Vector3) => v.applyMatrix4(root.matrixWorld).add(ride);
    let gl = toWorld(g.left.clone()), gr = toWorld(g.right.clone());
    // the tell: the loading glove pulls back and dips
    if (tellQ > 0) {
      const back = new THREE.Vector3(0, -0.02 * h, -0.035 * h).applyQuaternion(root.quaternion).multiplyScalar(tellQ);
      if (tellSide > 0) gl.add(back);
      else gr.add(back);
    }
    // smooth guard changes so a switch never snaps
    if (!this.guardSmooth) this.guardSmooth = { L: gl.clone(), R: gr.clone() };
    const k = 1 - Math.exp(-dt * 16);
    this.guardSmooth.L.lerp(gl, k);
    this.guardSmooth.R.lerp(gr, k);
    gl = this.guardSmooth.L.clone();
    gr = this.guardSmooth.R.clone();
    const fwdW = new THREE.Vector3(0, 0, 1).applyQuaternion(root.quaternion);
    const upW = UP;
    const thumbFor = (left: boolean, fwd: THREE.Vector3, e: number, kind: PunchKind | null) => {
      const side = left ? 1 : -1;
      const medial = new THREE.Vector3().crossVectors(fwd, upW).multiplyScalar(side).normalize();
      if (!kind) return new THREE.Vector3().copy(upW).lerp(medial, 0.25).normalize();
      const path = PUNCH[kind].path;
      if (path === "straight") return new THREE.Vector3().copy(upW).lerp(medial, clamp(e, 0, 1)).normalize();
      if (path === "hook") return upW.clone();
      return medial.clone().negate();
    };
    // in the guard the fists stand up, knuckles to the sky and a little forward, thumbs back toward the face
    const guardFwd = new THREE.Vector3().copy(upW).addScaledVector(fwdW, 0.45).normalize();
    const guardThumb = fwdW.clone().negate();
    const philly = f.guard === "philly" && ctx.mode === "fight";
    let lFwd = guardFwd.clone(), rFwd = guardFwd.clone();
    let lThumb = guardThumb.clone(), rThumb = guardThumb.clone();
    // relaxed (the creator's stage): the hands hang loose, knuckles down
    if (ctx.mode === "idle") {
      lFwd = new THREE.Vector3(0, -1, 0).addScaledVector(fwdW, 0.25).normalize();
      rFwd = lFwd.clone();
      lThumb = fwdW.clone();
      rThumb = fwdW.clone();
    }
    // the Philly lead hand lies across the belly, knuckles pointing to the other side
    if (philly) {
      const across = new THREE.Vector3(-L, 0.15, 0.3).applyQuaternion(root.quaternion).normalize();
      if (L > 0) { lFwd = across; lThumb = upW.clone(); }
      else { rFwd = across; rThumb = upW.clone(); }
    }
    if (pk && a) {
      const spec = PUNCH[pk];
      // the target is fixed when the punch starts: a boxer who slips lets it fly past where his head was
      const key = (a.t <= 1 ? "n" : "") + pk + ":" + a.startup + ":" + a.recovery;
      const startKey = pk + ":" + a.startup + ":" + a.recovery;
      if (a.t <= 1 || this.punchKey !== startKey) {
        this.punchKey = startKey;
        const tgt = pBody ? ctx.body : ctx.head;
        this.punchTarget.copy(tgt);
        this.punchStart.copy(pLeft ? gl : gr);
        this.outcome = "pending";
        this.outcomeT = 0;
      }
      void key;
      this.outcomeT += dt;
      const start = pLeft ? gl : gr;
      // the knuckles fly to just in front of the target (where a guard would be); at contact they push through for
      // a clean shot, stop for a block, or carry on past for a miss. The wrist sits a glove's length behind.
      const T0 = this.punchTarget;
      const dirToT = new THREE.Vector3().subVectors(T0, start).normalize();
      const front = T0.clone().addScaledVector(dirToT, -0.2);
      const endFor = (o: string) => (o === "hit" ? T0.clone() : o === "miss" ? T0.clone().addScaledVector(dirToT, 0.12) : front.clone());
      const blend = this.outcome === "pending" ? 0 : smooth(this.outcomeT / 0.06);
      const target = front.clone().lerp(endFor(this.outcome), blend).addScaledVector(dirToT, -0.11);
      const e = pe;
      let pos: THREE.Vector3;
      const side = pLeft ? 1 : -1;
      const outW = new THREE.Vector3(side, 0, 0).applyQuaternion(root.quaternion);
      if (spec.path === "straight") {
        pos = start.clone().lerp(target, clamp(e, -0.15, 1.05));
        pos.y += Math.sin(clamp(e, 0, 1) * Math.PI) * 0.015 * h;
      } else if (spec.path === "hook") {
        const c = start.clone().lerp(target, 0.45).addScaledVector(outW, 0.24 * h).addScaledVector(fwdW, -0.02 * h);
        c.y = Math.max(c.y, target.y);
        pos = bez(start, c, target, clamp(e, -0.1, 1.04));
      } else {
        const c = start.clone().lerp(target, 0.4);
        c.y -= 0.17 * h;
        pos = bez(start, c, target, clamp(e, -0.1, 1.04));
      }
      const fwdP = spec.path === "upper" ? new THREE.Vector3().subVectors(target, pos).normalize().lerp(upW, 0.4).normalize() : new THREE.Vector3().subVectors(target, start).normalize();
      if (pLeft) {
        gl = pos;
        lFwd = fwdP;
        lThumb = thumbFor(true, fwdP, e, pk);
      } else {
        gr = pos;
        rFwd = fwdP;
        rThumb = thumbFor(false, fwdP, e, pk);
      }
    }
    // the clinch: arms round the other boxer's shoulders
    if (ctx.mode === "clinch") {
      const sideW = new THREE.Vector3(1, 0, 0).applyQuaternion(root.quaternion);
      gl = ctx.head.clone().addScaledVector(sideW, 0.18).addScaledVector(fwdW, 0.12);
      gl.y -= 0.12;
      gr = ctx.head.clone().addScaledVector(sideW, -0.18).addScaledVector(fwdW, 0.12);
      gr.y -= 0.16;
    }
    if (ctx.mode === "win") {
      const sideW = new THREE.Vector3(1, 0, 0).applyQuaternion(root.quaternion);
      const top = new THREE.Vector3(0, 1.08 * h, 0).applyMatrix4(root.matrixWorld);
      gl = top.clone().addScaledVector(sideW, 0.22).addScaledVector(fwdW, 0.05);
      gr = top.clone().addScaledVector(sideW, -0.22).addScaledVector(fwdW, 0.05);
      lFwd = rFwd = upW.clone();
    }
    // ---- solve the arms: a punching arm reaches its knuckles to the target; a guarding arm puts its wrist a
    // glove's length under the fist with the elbow hanging down by the ribs
    const [l1, l2] = this.armLen(true);
    const [r1, r2] = this.armLen(false);
    const solveArm = (left: boolean, tgt: THREE.Vector3, fwdV: THREE.Vector3, thumbV: THREE.Vector3) => {
      const side = left ? 1 : -1;
      const upper = bones[left ? B.armL : B.armR], lower = bones[left ? B.foreL : B.foreR], hand = bones[left ? B.handL : B.handR];
      const L1 = left ? l1 : r1, L2 = left ? l2 : r2;
      const shoulder = new THREE.Vector3().setFromMatrixPosition(upper.matrixWorld);
      const isPunch = !!pk && pLeft === left && ctx.mode === "fight";
      const path = isPunch ? PUNCH[pk!].path : null;
      if (isPunch || ctx.mode === "clinch" || ctx.mode === "win") {
        const off = path === "hook" ? new THREE.Vector3(side * 0.4 * h, 0.05 * h, 0) : new THREE.Vector3(side * 0.22 * h, -0.3 * h, -0.05 * h);
        this.ik(upper, lower, tgt, shoulder.clone().add(off.applyQuaternion(root.quaternion)), L1, L2);
      } else {
        const wrist = tgt.clone().addScaledVector(fwdV, -0.11);
        const off = new THREE.Vector3(side * (f.guard === "high" ? 0.08 : 0.16) * h, -0.5 * h, 0.06 * h);
        this.ik(upper, lower, wrist, shoulder.clone().add(off.applyQuaternion(root.quaternion)), L1, L2 - 0.11);
      }
      this.orient(hand, fwdV, thumbV);
    };
    solveArm(true, gl, lFwd, lThumb);
    solveArm(false, gr, rFwd, rThumb);
    // glove squash on impact
    for (let i = 0; i < 2; i++) {
      this.impact[i] = Math.max(0, this.impact[i] - dt * 7);
      const s = this.impact[i];
      this.body.gloves[i].scale.set(1 + s * 0.12, 1 - s * 0.2, 1 + s * 0.12);
    }

    // ---- the legs: feet planted on the canvas, stepping when the body moves away from them
    this.poseLegs(L, ctx, dt, walk);
  }

  private guardTargets(guard: Guard, L: number, R: number, tired: number, rocked: number, mode: PoseCtx["mode"]) {
    const h = this.h;
    const drop = (tired * 0.04 + rocked * 0.07) * h;
    let left: THREE.Vector3, right: THREE.Vector3;
    const set = (lead: [number, number, number], rear: [number, number, number]) => {
      const leadV = new THREE.Vector3(lead[0] * h, lead[1] * h - drop, lead[2] * h);
      const rearV = new THREE.Vector3(rear[0] * h, rear[1] * h - drop, rear[2] * h);
      if (L > 0) { left = leadV; right = rearV; }
      else { right = leadV; left = rearV; }
    };
    if (mode === "walk") set([L * 0.1, 0.62, 0.12], [R * 0.1, 0.62, 0.12]);
    else if (mode === "idle") set([L * 0.13, 0.6, 0.09], [R * 0.13, 0.6, 0.09]);
    else if (guard === "high") set([L * 0.05, 0.94, 0.15], [R * 0.055, 0.935, 0.13]);
    else if (guard === "philly") set([R * 0.02, 0.63, 0.13], [R * 0.055, 0.9, 0.11]);
    else set([L * 0.055, 0.895, 0.19], [R * 0.06, 0.885, 0.13]);
    return { left: left!, right: right! };
  }

  private poseLegs(L: number, ctx: PoseCtx, dt: number, walk: boolean) {
    const h = this.h;
    const bones = this.bones;
    const root = this.body.root;
    // where each foot wants to be: the lead foot forward, the rear foot back and wider
    const want = [
      new THREE.Vector3(L > 0 ? 0.05 * h : 0.12 * h, 0, L > 0 ? 0.15 * h : -0.14 * h),
      new THREE.Vector3(L > 0 ? -0.12 * h : -0.05 * h, 0, L > 0 ? -0.14 * h : 0.15 * h),
    ];
    if (walk) {
      want[0].set(0.07 * h, 0, Math.sin(this.gait) * 0.14 * h);
      want[1].set(-0.07 * h, 0, -Math.sin(this.gait) * 0.14 * h);
    }
    for (let i = 0; i < 2; i++) {
      const ft = this.feet[i];
      const target = want[i].clone().applyMatrix4(root.matrixWorld);
      target.y = 0;
      if (ft.p.lengthSq() === 0 || walk) {
        ft.p.copy(target);
        ft.stepping = false;
        continue;
      }
      if (!ft.stepping) {
        const other = this.feet[1 - i];
        if (!other.stepping && ft.p.distanceTo(target) > 0.08 * h) {
          ft.stepping = true;
          ft.t = 0;
          ft.from.copy(ft.p);
        }
      }
      if (ft.stepping) {
        ft.to.copy(target);
        ft.t = Math.min(1, ft.t + dt / 0.15);
        const p = smooth(ft.t);
        ft.p.copy(ft.from).lerp(ft.to, p);
        ft.p.y = Math.sin(p * Math.PI) * 0.035 * h;
        if (ft.t >= 1) {
          ft.stepping = false;
          ft.p.y = 0;
        }
      }
    }
    const [l1, l2] = [this.rest[B.shinL].length(), this.rest[B.footL].length()];
    const fwdW = new THREE.Vector3(0, 0, 1).applyQuaternion(root.quaternion);
    for (let i = 0; i < 2; i++) {
      const left = (i === 0) === (L > 0);
      const thigh = bones[left ? B.thighL : B.thighR], shin = bones[left ? B.shinL : B.shinR], foot = bones[left ? B.footL : B.footR];
      const ankle = this.feet[i].p.clone();
      ankle.y += this.rest[B.footL].length() * 0.19;
      const knee = new THREE.Vector3().setFromMatrixPosition(thigh.matrixWorld).addScaledVector(fwdW, 0.5).add(new THREE.Vector3((left ? 1 : -1) * 0.06, -0.2, 0).applyQuaternion(root.quaternion));
      this.ik(thigh, shin, ankle, knee, l1, l2);
      // the sole stays flat, turned out a little
      const yawQ = new THREE.Quaternion().setFromAxisAngle(UP, this.body.root.rotation.y + (left ? 0.25 : -0.25) * (walk ? 0.3 : 1));
      const pq = shin.getWorldQuaternion(new THREE.Quaternion()).invert();
      foot.quaternion.copy(pq.multiply(yawQ));
    }
    root.updateMatrixWorld(true);
  }

  /** knocked down: the legs go and he lands on the canvas; getting up runs it backward through one knee */
  private poseDown(f: FState, ctx: PoseCtx) {
    const h = this.h;
    const bones = this.bones;
    const fall = smooth(ctx.downT / 0.75);
    const up = ctx.riseT > 0 ? smooth(ctx.riseT / 1.2) : 0;
    const body = f.action?.dir === 2;
    // down pose: sitting back on the canvas, propped on the gloves (a body shot puts him on one knee)
    const d = fall * (1 - up);
    const kneel = body ? 1 : clamp(up * 2.2, 0, 1) * (1 - up);
    const sit = (1 - kneel) * d;
    const hipsY = (-0.4 * sit - 0.24 * kneel * d) * h;
    bones[B.hips].position.set(0, this.rest[B.hips].y + hipsY, -0.05 * h * sit);
    this.rot(B.hips, -0.55 * sit + 0.25 * kneel * d, 0, 0);
    this.rot(B.spine1, 0.25 * sit + 0.25 * kneel * d, 0, 0);
    this.rot(B.spine2, 0.15 * sit + 0.2 * kneel * d, 0, 0);
    this.rot(B.chest, 0.1 * sit, 0, 0);
    this.rot(B.head, 0.35 * d + this.headX.x, this.headY.x, this.headZ.x);
    // legs: forward along the canvas when sitting, one knee down when kneeling
    this.rot(B.thighL, (-1.25 * sit) + (-1.2 * kneel * d), 0.1 * sit, 0.12 * sit);
    this.rot(B.thighR, (-1.25 * sit) + (0.2 * kneel * d), -0.1 * sit, -0.12 * sit);
    this.rot(B.shinL, 0.35 * sit + 1.6 * kneel * d, 0, 0);
    this.rot(B.shinR, 0.25 * sit + 1.7 * kneel * d, 0, 0);
    // arms back, gloves on the canvas
    this.rot(B.armL, 0.35 * d, 0, 0.35 * d);
    this.rot(B.armR, 0.35 * d, 0, -0.35 * d);
    this.rot(B.foreL, -0.4 * d, 0, 0);
    this.rot(B.foreR, -0.4 * d, 0, 0);
    this.body.root.updateMatrixWorld(true);
  }

  /** on the stool between rounds, arms out along the ropes */
  private poseStool(ctx: PoseCtx) {
    const h = this.h;
    const bones = this.bones;
    const breath = Math.sin(ctx.time * 2.6) * 0.03;
    bones[B.hips].position.set(0, this.rest[B.hips].y - 0.2 * h, -0.02 * h);
    this.rot(B.thighL, -1.45, 0.18, 0.1);
    this.rot(B.thighR, -1.45, -0.18, -0.1);
    this.rot(B.shinL, 1.4, 0, 0);
    this.rot(B.shinR, 1.4, 0, 0);
    this.rot(B.spine1, -0.06 + breath, 0, 0);
    this.rot(B.chest, -0.04 - breath, 0, 0);
    this.rot(B.head, 0.1, 0, 0);
    this.rot(B.jaw, 0.1 + Math.max(0, breath) * 2, 0, 0);
    this.rot(B.armL, 0, 0, 1.25);
    this.rot(B.armR, 0, 0, -1.25);
    this.rot(B.foreL, -0.3, 0, 0);
    this.rot(B.foreR, -0.3, 0, 0);
    this.body.root.updateMatrixWorld(true);
  }
}

function bez(a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, t: number) {
  const u = 1 - t;
  return new THREE.Vector3(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y, u * u * a.z + 2 * u * t * c.z + t * t * b.z);
}

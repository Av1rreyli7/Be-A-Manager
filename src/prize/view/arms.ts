/**
 * Your own arms in first person: upper arms, forearms and gloves, hung off the camera. Each frame the gloves go to
 * the guard you are in (high guard gloves by the brows, a little in your way; the Philly shell with the lead hand
 * low and the rear glove at the chin; the normal guard in between) or along the punch path toward the point on the
 * other boxer you aimed at, and two bone IK puts the elbows where they belong. Camera space: -Z ahead, +X right,
 * +Y up. A glove squashes for a moment when it lands.
 */
import * as THREE from "three";
import { gloveGeometry, gloveMaterial, mergeSimple } from "./glove";
import type { FState, FighterDef, Guard, PunchKind } from "../engine/types";
import { PUNCH, handOf } from "../engine/rules";
import { skinAt } from "../../../floodlights/m3d/view/rig.mjs";

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const smooth = (t: number) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

/** a limb segment: a tapered capsule along -Y from its origin, length 1 (scaled to the bone) */
function segment(r0: number, r1: number, skin: number[], detail: number): THREE.BufferGeometry {
  const seg = Math.round(16 * detail);
  const body = new THREE.CylinderGeometry(r0, r1, 1, seg, 6, true);
  body.translate(0, -0.5, 0);
  const cap0 = new THREE.SphereGeometry(r0, seg, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const cap1 = new THREE.SphereGeometry(r1, seg, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  cap1.translate(0, -1, 0);
  const parts = [body, cap0, cap1];
  for (const g of parts) {
    const p = g.getAttribute("position") as THREE.BufferAttribute;
    const c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      // a touch darker underneath and toward the elbow: the arm reads as round in the ring lights
      const under = clamp(-p.getZ(i) / Math.max(r0, r1), -1, 1) * 0.08 + clamp(-p.getY(i), 0, 1) * 0.04;
      for (let k = 0; k < 3; k++) c[i * 3 + k] = lin(skin[k] * (1 - under));
    }
    g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  }
  const m = mergeSimple(parts);
  parts.forEach(g => g.dispose());
  m.computeVertexNormals();
  return m;
}

export class FirstPersonArms {
  readonly group = new THREE.Group();
  private upper: THREE.Mesh[] = [];
  private fore: THREE.Mesh[] = [];
  private gloves: THREE.Mesh[] = [];
  private mats: THREE.Material[] = [];
  private geos: THREE.BufferGeometry[] = [];
  private L1: number;
  private L2: number;
  private impact = [0, 0];
  private punchKey = "";
  private targetW = new THREE.Vector3();
  private outcome: "pending" | "hit" | "block" | "miss" = "pending";
  private outcomeT = 0;
  private smoothG: THREE.Vector3[] | null = null;
  /** where each glove ended up this frame, in world space (for impact effects) */
  readonly gloveWorld = [new THREE.Vector3(), new THREE.Vector3()];

  constructor(def: FighterDef, quality: number) {
    const h = def.heightCm / 100;
    const reachK = clamp((def.reachIn * 2.54) / def.heightCm, 0.95, 1.08);
    this.L1 = 0.175 * h * reachK;
    this.L2 = 0.15 * h * reachK + 0.02;
    const skin = skinAt({ skinF: def.look.skin }) as number[];
    const det = quality >= 2 ? 1.5 : 1;
    const skinMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.48, sheen: quality >= 2 ? 0.35 : 0, sheenRoughness: 0.45, sheenColor: new THREE.Color("#ff9a7a"), clearcoat: 0.08, clearcoatRoughness: 0.5 });
    const gm = gloveMaterial(quality);
    this.mats.push(skinMat, gm);
    const upperGeo = segment(0.056, 0.046, skin, det), foreGeo = segment(0.047, 0.036, skin, det);
    this.geos.push(upperGeo, foreGeo);
    for (const side of [1, -1] as const) {
      const u = new THREE.Mesh(upperGeo, skinMat);
      const f = new THREE.Mesh(foreGeo, skinMat);
      const gg = gloveGeometry(side, { main: def.look.gloves, trim: def.look.gloveTrim }, quality >= 2 ? 1.2 : 1);
      this.geos.push(gg);
      const g = new THREE.Mesh(gg, gm);
      for (const m of [u, f, g]) {
        m.frustumCulled = false;
        m.castShadow = quality >= 2;
        m.renderOrder = 2;
        this.group.add(m);
      }
      this.upper.push(u);
      this.fore.push(f);
      this.gloves.push(g);
    }
  }

  /** the punch in flight landed, was blocked or missed (from the fight's events at contact) */
  setOutcome(o: "hit" | "block" | "miss") {
    this.outcome = o;
    this.outcomeT = 0;
  }

  hitGlove(left: boolean, power: number) {
    const i = left ? 0 : 1;
    this.impact[i] = Math.max(this.impact[i], clamp(power, 0.25, 1));
  }

  /** guard positions in camera space for the lead and rear glove */
  private guard(g: Guard, tired: number, rocked: number): [THREE.Vector3, THREE.Vector3] {
    const drop = tired * 0.05 + rocked * 0.08;
    if (g === "high") return [new THREE.Vector3(-0.11, -0.1 - drop, -0.33), new THREE.Vector3(0.11, -0.11 - drop, -0.29)];
    if (g === "philly") return [new THREE.Vector3(0.04, -0.46 - drop, -0.32), new THREE.Vector3(0.11, -0.2 - drop, -0.28)];
    return [new THREE.Vector3(-0.13, -0.2 - drop, -0.42), new THREE.Vector3(0.13, -0.23 - drop, -0.32)];
  }

  /**
   * Pose the arms. camera: the first person camera (its world matrix is current). f: your fighter. aimHead and
   * aimBody: the points on the other boxer you punch at (world). alpha: the sub step of the fight.
   */
  update(camera: THREE.Camera, f: FState, aimHead: THREE.Vector3, aimBody: THREE.Vector3, alpha: number, dt: number, hidden: boolean) {
    this.group.visible = !hidden;
    if (hidden) return;
    const orth = f.stance === "orthodox";
    const tired = clamp(1 - f.stamina / 60, 0, 1);
    const rocked = f.rocked > 0 ? clamp(f.rocked / 2, 0.4, 1) : 0;
    const [lead, rear] = this.guard(f.guard, tired, rocked);
    // index 0 is your left hand, 1 your right; the lead hand is the left for orthodox
    const gl = orth ? lead : rear.clone().setX(-rear.x);
    const gr = orth ? rear : lead.clone().setX(-lead.x);
    // breathing and a little bounce
    const t = performance.now() / 1000;
    const bob = Math.sin(t * 2 * Math.PI * 1.7) * 0.004;
    gl.y += bob;
    gr.y += bob;
    if (!this.smoothG) this.smoothG = [gl.clone(), gr.clone()];
    const k = 1 - Math.exp(-dt * 18);
    this.smoothG[0].lerp(gl, k);
    this.smoothG[1].lerp(gr, k);
    const targets = [this.smoothG[0].clone(), this.smoothG[1].clone()];
    // the guard: fists stand up, knuckles to the sky and a little forward, thumbs back toward your face
    const fwd = [new THREE.Vector3(0.08, 1, -0.55).normalize(), new THREE.Vector3(-0.08, 1, -0.55).normalize()];
    const thumb = [new THREE.Vector3(0.25, 0, 1).normalize(), new THREE.Vector3(-0.25, 0, 1).normalize()];
    if (f.guard === "philly") {
      // the lead hand lies across the belly
      const li = orth ? 0 : 1;
      fwd[li] = new THREE.Vector3(orth ? 1 : -1, 0.1, -0.4).normalize();
      thumb[li] = new THREE.Vector3(0, 1, 0);
    }
    const inv = new THREE.Matrix4().copy(camera.matrixWorld).invert();
    const a = f.action;
    if (a?.type === "punch") {
      const kind = a.kind as PunchKind;
      const spec = PUNCH[kind];
      const i = handOf(kind, f.stance) === "L" ? 0 : 1;
      const side = i === 0 ? -1 : 1; // camera x of that hand's side
      const S = a.startup!, A = a.active!, R = a.recovery!;
      const tt = a.t + alpha;
      let e: number;
      if (tt < S) {
        const p = tt / S;
        e = p < 0.15 ? -0.08 * (p / 0.15) : -0.08 + 1.08 * Math.pow((p - 0.15) / 0.85, 1.4);
      } else if (tt < S + A) e = 1;
      else e = 1 - easeOut((tt - S - A) / R);
      const key = kind + ":" + a.startup + ":" + a.recovery;
      if (a.t <= 1 || this.punchKey !== key) {
        this.punchKey = key;
        this.targetW.copy(a.target === "body" ? aimBody : aimHead);
        this.outcome = "pending";
        this.outcomeT = 0;
      }
      this.outcomeT += dt;
      // the target in camera space: the knuckles fly to just in front of it, then push through on a clean shot,
      // stop on his gloves for a block, carry on past for a miss (the wrist a glove's length behind)
      const T0 = this.targetW.clone().applyMatrix4(inv);
      const start = targets[i].clone();
      const dir = T0.clone().sub(start).normalize();
      const front = T0.clone().addScaledVector(dir, -0.18);
      const endP = this.outcome === "hit" ? T0.clone() : this.outcome === "miss" ? T0.clone().addScaledVector(dir, 0.12) : front.clone();
      const T = front.lerp(endP, this.outcome === "pending" ? 0 : smooth(this.outcomeT / 0.06)).addScaledVector(dir, -0.11);
      // no further than the arm reaches from the shoulder
      const sh = this.shoulder(i, orth);
      const reach = this.L1 + this.L2 - 0.01;
      if (T.distanceTo(sh) > reach) T.copy(sh).addScaledVector(T.clone().sub(sh).normalize(), reach);
      let pos: THREE.Vector3;
      if (spec.path === "straight") {
        pos = start.clone().lerp(T, clamp(e, -0.1, 1.04));
        pos.y += Math.sin(clamp(e, 0, 1) * Math.PI) * 0.02;
      } else if (spec.path === "hook") {
        const c = start.clone().lerp(T, 0.45).add(new THREE.Vector3(side * 0.3, 0.04, 0.05));
        pos = bez(start, c, T, clamp(e, -0.1, 1.03));
      } else {
        const c = start.clone().lerp(T, 0.4).add(new THREE.Vector3(side * 0.05, -0.22, 0.02));
        pos = bez(start, c, T, clamp(e, -0.1, 1.03));
      }
      targets[i] = pos;
      const ee = clamp(e, 0, 1);
      if (spec.path === "straight") {
        fwd[i] = T.clone().sub(start).normalize();
        // the fist turns over: palm down at full stretch
        thumb[i] = new THREE.Vector3(0, 0.6, 0.8).lerp(new THREE.Vector3(-side, 0, 0), ee).normalize();
      } else if (spec.path === "hook") {
        fwd[i] = new THREE.Vector3(-side, 0, -1).normalize().lerp(T.clone().sub(pos).normalize(), 0.5).normalize();
        thumb[i] = new THREE.Vector3(0, 1, 0);
      } else {
        fwd[i] = new THREE.Vector3(0, 1, -0.6).normalize();
        thumb[i] = new THREE.Vector3(side, 0, 0);
      }
    }
    for (let i = 0; i < 2; i++) {
      const sh = this.shoulder(i, orth);
      const pole = sh.clone().add(new THREE.Vector3(i === 0 ? -0.35 : 0.35, -0.5, 0.15));
      this.solve(i, sh, targets[i], pole, fwd[i], thumb[i], dt);
    }
    this.group.updateMatrixWorld(true);
    for (let i = 0; i < 2; i++) this.gloveWorld[i].setFromMatrixPosition(this.gloves[i].matrixWorld);
  }

  private shoulder(i: number, orth: boolean) {
    // the lead shoulder sits forward of the rear one in a bladed stance
    const leadI = orth ? 0 : 1;
    const x = i === 0 ? -0.2 : 0.2;
    return new THREE.Vector3(x, -0.25, i === leadI ? 0.0 : 0.1);
  }

  private solve(i: number, A: THREE.Vector3, T: THREE.Vector3, pole: THREE.Vector3, fwd: THREE.Vector3, thumb: THREE.Vector3, dt: number) {
    const L1 = this.L1, L2 = this.L2;
    const toT = T.clone().sub(A);
    const d = clamp(toT.length(), Math.abs(L1 - L2) + 0.02, L1 + L2 - 0.002);
    const dir = toT.normalize();
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
    const hh = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const pv = pole.clone().sub(A);
    pv.addScaledVector(dir, -pv.dot(dir)).normalize();
    const E = A.clone().addScaledVector(dir, a).addScaledVector(pv, hh);
    const W = A.clone().addScaledVector(dir, d);
    const up = this.upper[i], fo = this.fore[i], gl = this.gloves[i];
    up.position.copy(A);
    up.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), E.clone().sub(A).normalize());
    up.scale.set(1, L1, 1);
    fo.position.copy(E);
    fo.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), W.clone().sub(E).normalize());
    fo.scale.set(1, L2 - 0.03, 1);
    gl.position.copy(W);
    // glove basis: -Y along the fist direction, +Z toward the thumb
    const y = fwd.clone().normalize().negate();
    const z = thumb.clone().addScaledVector(y, -thumb.dot(y)).normalize();
    const x = new THREE.Vector3().crossVectors(y, z).normalize();
    gl.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    this.impact[i] = Math.max(0, this.impact[i] - dt * 6);
    const s = this.impact[i];
    gl.scale.set(1 + s * 0.14, 1 - s * 0.22, 1 + s * 0.14);
  }

  dispose() {
    this.geos.forEach(g => g.dispose());
    this.mats.forEach(m => m.dispose());
  }
}

function bez(a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, t: number) {
  const u = 1 - t;
  return new THREE.Vector3(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y, u * u * a.z + 2 * u * t * c.z + t * t * b.z);
}

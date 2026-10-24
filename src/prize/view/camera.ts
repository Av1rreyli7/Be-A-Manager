/**
 * The camera. In the fight it is your eyes: on your boxer's head (the engine's slips, ducks and leans move it),
 * soft locked on the other boxer's face with a little mouse look on top, bobbing with your stance. Hits shake it
 * (trauma that fades), a big one snaps your head round on a spring, being rocked makes it sway and drift, a
 * knockdown drops it to the canvas. Outside the fight it follows cinematic paths (the ring walk, the corner, the
 * result), set by the world.
 */
import * as THREE from "three";

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

class Spring {
  x = 0;
  v = 0;
  constructor(public k: number, public c: number) {}
  step(dt: number) {
    this.v += (-this.k * this.x - this.c * this.v) * dt;
    this.x += this.v * dt;
  }
}

export interface EyeInput {
  /** your boxer on the canvas (world x, z), his eye height, and where the other boxer's face is */
  x: number;
  z: number;
  eye: number;
  look: THREE.Vector3;
  /** head offset from the engine: right, up, back (metres, your frame) */
  hx: number;
  hy: number;
  hz: number;
  /** mouse look, -1 to 1 */
  aimX: number;
  aimY: number;
  /** 0 to 1 */
  rocked: number;
  tired: number;
  /** seconds since you went down (0 when up), seconds since you started to rise */
  downT: number;
  riseT: number;
  clinch: boolean;
}

export class CameraRig {
  private trauma = 0;
  private snapYaw = new Spring(120, 11);
  private snapPitch = new Spring(120, 11);
  private snapRoll = new Spring(90, 9);
  private pushBack = new Spring(80, 10);
  private yaw = 0;
  private pitch = 0;
  private yawInit = false;
  private t = 0;
  private noiseSeed = Math.random() * 100;
  readonly eyeWorld = new THREE.Vector3();

  constructor(public camera: THREE.PerspectiveCamera) {}

  /** a punch landed on you: size 0 to 1.5, dir like the engine's react (-1, 1 sides, 0 straight, 2 body, 3 up) */
  hit(size: number, dir: number) {
    this.trauma = Math.min(1, this.trauma + 0.18 + size * 0.45);
    if (dir === -1 || dir === 1) {
      this.snapYaw.v += -dir * 2.4 * size;
      this.snapRoll.v += dir * 1.6 * size;
    } else if (dir === 0) {
      this.snapPitch.v += 1.6 * size;
    } else if (dir === 3) {
      this.snapPitch.v += 2.8 * size;
    } else if (dir === 2) {
      this.snapPitch.v -= 1.0 * size;
    }
    this.pushBack.v += 0.9 * size;
  }

  /** a smaller jolt: a blocked punch, your own punch landing */
  jolt(size: number) {
    this.trauma = Math.min(1, this.trauma + size * 0.25);
  }

  /** first person, every frame */
  fight(e: EyeInput, dt: number) {
    this.t += dt;
    for (const s of [this.snapYaw, this.snapPitch, this.snapRoll, this.pushBack]) s.step(Math.min(dt, 1 / 30));
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const cam = this.camera;
    // your frame: toward the other boxer, your right
    const dx = e.look.x - e.x, dz = e.look.z - e.z;
    const d = Math.hypot(dx, dz) || 1;
    const fx = dx / d, fz = dz / d;
    const rx = -fz, rz = fx;
    const t = this.t;
    const bob = Math.sin(t * 2 * Math.PI * 1.7) * 0.007 * (1 - e.tired * 0.5);
    const breath = Math.sin(t * (1.4 + e.tired * 1.6) * Math.PI) * 0.006 * (0.5 + e.tired);
    // rocked: the world drifts and tilts
    const sway = e.rocked > 0 ? Math.sin(t * 1.7) * 0.05 * e.rocked : 0;
    const drift = e.rocked > 0 ? Math.sin(t * 1.1 + 1) * 0.04 * e.rocked : 0;
    let px = e.x + rx * (e.hx + sway * 0.6 + e.aimX * 0.04) - fx * (e.hz + this.pushBack.x * 0.08);
    let pz = e.z + rz * (e.hx + sway * 0.6 + e.aimX * 0.04) - fz * (e.hz + this.pushBack.x * 0.08);
    let py = e.eye + e.hy + bob + breath + e.aimY * 0.02;
    if (e.clinch) {
      // tied up: your head beside his, looking past his shoulder
      px += rx * 0.16;
      pz += rz * 0.16;
      py -= 0.05;
    }
    // down: the camera falls to the canvas, then rises with you
    let fall = 0;
    if (e.downT > 0) {
      fall = clamp(e.downT / 0.7, 0, 1);
      fall = 1 - Math.pow(1 - fall, 2);
      if (e.riseT > 0) fall *= 1 - clamp(e.riseT / 1.2, 0, 1);
      py = py * (1 - fall) + 0.42 * fall;
      px -= fx * 0.5 * fall;
      pz -= fz * 0.5 * fall;
    }
    // shake: trauma squared, smooth noise
    const tr = this.trauma * this.trauma;
    const n = (k: number) => Math.sin(t * 37 + this.noiseSeed * k) * 0.6 + Math.sin(t * 61 + k * 3.1) * 0.4;
    px += n(1) * 0.012 * tr;
    py += n(2) * 0.012 * tr;
    pz += n(3) * 0.012 * tr;
    cam.position.set(px, py, pz);
    this.eyeWorld.set(px, py, pz);
    // look: at his face, eased so a slip moves the world smoothly, plus the mouse
    const tx = e.look.x - px, ty = e.look.y - 0.06 - py, tz = e.look.z - pz;
    const wantYaw = Math.atan2(-tx, -tz) - e.aimX * 0.12;
    const wantPitch = Math.atan2(ty, Math.hypot(tx, tz)) + e.aimY * 0.09 - 0.04;
    if (!this.yawInit) {
      this.yaw = wantYaw;
      this.pitch = wantPitch;
      this.yawInit = true;
    }
    const k = 1 - Math.exp(-dt * 14);
    let dy = wantYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * k;
    this.pitch += (wantPitch - this.pitch) * k;
    let yaw = this.yaw + this.snapYaw.x + n(4) * 0.02 * tr + drift;
    let pitch = this.pitch + this.snapPitch.x + n(5) * 0.02 * tr;
    let roll = this.snapRoll.x + n(6) * 0.02 * tr + sway * 0.6;
    if (fall > 0) {
      // on your back looking up at the lights and the referee
      pitch += fall * 0.55;
      roll += fall * 0.35;
      yaw += fall * 0.15;
    }
    cam.rotation.set(pitch, yaw, roll, "YXZ");
    cam.updateMatrixWorld(true);
  }

  /** a cinematic shot: from a point, looking at a point */
  shot(from: THREE.Vector3, at: THREE.Vector3, roll = 0) {
    const cam = this.camera;
    cam.position.copy(from);
    cam.lookAt(at);
    if (roll) cam.rotateZ(roll);
    cam.updateMatrixWorld(true);
    this.eyeWorld.copy(from);
    this.yawInit = false;
  }

  reset() {
    this.trauma = 0;
    for (const s of [this.snapYaw, this.snapPitch, this.snapRoll, this.pushBack]) s.x = s.v = 0;
    this.yawInit = false;
  }

  get shake() {
    return this.trauma;
  }
}

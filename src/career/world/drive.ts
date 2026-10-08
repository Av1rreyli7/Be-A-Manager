/**
 * Arcade driving. Each car has its own feel from the catalog (top speed, pull, grip, weight): a Civic is gentle,
 * a 911 grips and goes, a Range Rover leans and pushes wide, a superbike pulls hard and tips into corners.
 * The car keeps a real velocity, so when a corner asks for more grip than the tyres have, the back steps out;
 * the handbrake makes it slide on purpose. Buildings stop it with a bump, traffic shoves it.
 */
import type { Grid } from "./gen";

export interface Feel {
  top: number;
  accel: number;
  grip: number;
  mass: number;
}
export interface DriveState {
  x: number;
  z: number;
  ry: number;
  vx: number;
  vz: number;
  steer: number;
  /** the forward speed, read by the screen and the engine sound */
  speed: number;
  rpm: number;
  lean: number;
  bump: number;
  bike: boolean;
  len: number;
  wid: number;
}
export interface DriveInput {
  throttle: number;
  steer: number;
  handbrake: boolean;
}

export function newDrive(x: number, z: number, ry: number, body: string): DriveState {
  const bike = body === "bike" || body === "scooter";
  const len = bike ? 2 : body === "suv" || body === "van" ? 4.9 : body === "hatch" ? 3.9 : 4.6;
  const wid = bike ? 0.7 : body === "suv" ? 2 : 1.9;
  return { x, z, ry, vx: 0, vz: 0, steer: 0, speed: 0, rpm: 0, lean: 0, bump: 0, bike, len, wid };
}

/** one step of the car; others are the traffic cars as circles he can hit */
export function driveStep(s: DriveState, inp: DriveInput, feel: Feel, dt: number, grid: Grid, others: { x: number; z: number }[]) {
  // the city is small, so the very fastest cars are reined in a little; the order of who is quickest stays
  const top = Math.min(feel.top, 34 + feel.top * 0.42);
  const fx = Math.sin(s.ry),
    fz = Math.cos(s.ry);
  let vf = s.vx * fx + s.vz * fz;
  let lx = s.vx - fx * vf,
    lz = s.vz - fz * vf;
  // throttle and brakes
  if (inp.throttle > 0) {
    if (vf < -0.5) vf += 10 * inp.throttle * dt;
    else vf += feel.accel * inp.throttle * Math.max(0, 1 - Math.pow(Math.max(0, vf) / top, 2)) * dt;
  } else if (inp.throttle < 0) {
    if (vf > 0.5) vf += 11 * inp.throttle * (0.7 + feel.grip * 0.3) * dt;
    else vf = Math.max(-top * 0.22, vf + feel.accel * 0.5 * inp.throttle * dt);
  }
  // rolling and air
  vf -= Math.sign(vf) * Math.min(Math.abs(vf), (0.7 + Math.abs(vf) * 0.012) * dt);
  if (inp.handbrake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 5 * dt);
  // steering: quick at walking pace, calm at speed; a bike tips in a little slower
  const maxSteer = (s.bike ? 0.5 : 0.58) / (1 + Math.pow(Math.abs(vf) / 16, 2) * (1.15 - feel.grip * 0.35));
  const want = inp.steer * maxSteer;
  s.steer += Math.max(-3.2 * dt, Math.min(3.2 * dt, want - s.steer));
  const wb = s.bike ? 1.45 : 2.7;
  const kappa = Math.tan(s.steer) / wb;
  const yaw = vf * kappa * (inp.handbrake ? 1.35 : 1);
  // more corner than the tyres hold: the excess pushes the car wide
  const aLat = vf * vf * Math.abs(kappa);
  const hold = feel.grip * (s.bike ? 9 : 10.5) * (inp.handbrake ? 0.4 : 1) * (1 + (feel.mass - 1400) / 12000);
  if (aLat > hold) {
    const excess = (aLat - hold) * Math.sign(yaw);
    lx += -Math.cos(s.ry) * excess * dt * 0.6;
    lz += Math.sin(s.ry) * excess * dt * 0.6;
  }
  // the sideways slide dies away as the tyres bite again
  const bite = Math.exp(-feel.grip * (inp.handbrake ? 1.1 : 7.5) * dt);
  lx *= bite;
  lz *= bite;
  s.ry += yaw * dt;
  const nfx = Math.sin(s.ry),
    nfz = Math.cos(s.ry);
  s.vx = nfx * vf + lx;
  s.vz = nfz * vf + lz;
  s.x += s.vx * dt;
  s.z += s.vz * dt;
  // what it hits: two circles, front and back
  const r = s.wid / 2 + 0.15;
  const k = Math.max(0, s.len / 2 - r);
  let hit = false;
  for (const sg of [1, -1]) {
    const p = { x: s.x + nfx * k * sg, z: s.z + nfz * k * sg };
    const ox = p.x,
      oz = p.z;
    if (grid.push(p, r)) {
      hit = true;
      s.x += p.x - ox;
      s.z += p.z - oz;
    }
    for (const o of others) {
      const dx = p.x - o.x,
        dz = p.z - o.z;
      const d = Math.hypot(dx, dz);
      if (d < r + 1.6 && d > 1e-4) {
        const push = r + 1.6 - d;
        s.x += (dx / d) * push;
        s.z += (dz / d) * push;
        hit = true;
      }
    }
  }
  if (hit) {
    const sp = Math.hypot(s.vx, s.vz);
    s.bump = Math.min(1, sp / 20);
    s.vx *= -0.25;
    s.vz *= -0.25;
  } else s.bump *= 0.9;
  s.speed = s.vx * nfx + s.vz * nfz;
  // a rev counter with gears, for the engine sound
  const gears = 6;
  const g = Math.min(gears - 1, Math.floor((Math.abs(s.speed) / top) * gears));
  const inGear = (Math.abs(s.speed) / top) * gears - g;
  s.rpm = 0.18 + inGear * 0.72 + (inp.throttle > 0 ? 0.08 : 0);
  s.lean += ((s.bike ? -s.steer * Math.min(1, Math.abs(vf) / 14) * 1.1 : -s.steer * Math.min(1, Math.abs(vf) / 30) * 0.06) - s.lean) * Math.min(1, dt * 6);
  return hit;
}

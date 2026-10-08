// The broadcast camera: high on the main stand gantry, tracking along the touchline with the play, leading the
// ball a little, framing wider when the play is spread and tighter when it is in a box, leaning in for set
// pieces and staying on the scorer for the celebration. Everything moves on damped springs: no jerks.
import { HALF_L, HALF_W } from "../consts.mjs";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const damp = (x, t, r, dt) => x + (t - x) * (1 - Math.exp(-r * dt));

export function createCamera(THREE, aspect) {
  const cam = new THREE.PerspectiveCamera(30, aspect, 0.5, 600);
  const st = { tx: 0, tz: 0, dist: 62, height: 27, fov: 30, look: new THREE.Vector3(), lead: 0, goalT: -9, goalP: null, shake: 0 };
  cam.position.set(0, 27, HALF_W + 58);

  // sim (x, y, z) to scene: x stays, sim y is scene z
  function update(m, dt, ctrlP) {
    const b = m.ball;
    const bx = b.held ? b.held.x : b.x, by = b.held ? b.held.y : b.y;
    // lead the ball in the direction it is going, and lean toward the person's player
    st.lead = damp(st.lead, clamp(b.vx * 0.45, -8, 8), 1.5, dt);
    let tx = bx + st.lead, tz = by * 0.55;
    // player lock: frame him and the ball together, and pull back when they are far apart
    const lockP = m.lock && !m.lock.off ? m.lock : null;
    let apart = 0;
    if (lockP) { tx = (tx + lockP.x) / 2; tz = (tz + lockP.y * 0.55) / 2; apart = clamp((Math.hypot(lockP.x - bx, lockP.y - by) - 20) / 40, 0, 1); }
    else if (ctrlP && !ctrlP.off) { tx = tx * 0.8 + ctrlP.x * 0.2; tz = tz * 0.85 + ctrlP.y * 0.55 * 0.15; }
    // how far: wider in open play, tighter near a goal and at set pieces
    const nearGoal = clamp((Math.abs(bx) - 28) / 22, 0, 1);
    let dist = 64 - nearGoal * 12 + apart * 16, height = 27 - nearGoal * 4 + apart * 6, fov = 30;
    const R = m.restart;
    // set pieces near goal get the wider goal framing; a deep free kick just follows the ball like open play
    const gxR = R && m.teams[R.team] ? m.teams[R.team].dir * HALF_L : 0;
    if (R && (R.kind === "corner" || R.kind === "penalty" || R.kind === "freekick" && Math.hypot(gxR - R.x, R.y) < 36)) {
      const gx = gxR;
      tx = R.kind === "penalty" ? gx * 0.86 : (R.x + gx) / 2; tz = R.kind === "corner" ? R.y * 0.35 : R.y * 0.4;
      dist = R.kind === "penalty" ? 40 : 48; height = R.kind === "penalty" ? 14 : 21;
    }
    if (R && R.kind === "kickoff") { tx = 0; tz = 0; dist = 70; height = 30; }
    // the goal: stay with the scorer, lower and closer, for a few seconds
    if (m.phase === "goal" && st.goalP) {
      const p = st.goalP;
      tx = p.x; tz = p.y * 0.9; dist = 26; height = 7.5; fov = 32;
    }
    if (m.phase === "halftime" || m.phase === "full") { tx = 0; tz = 0; dist = 82; height = 36; }
    // keep the frame on the pitch
    tx = clamp(tx, -HALF_L + 14, HALF_L - 14);
    tz = clamp(tz, -HALF_W + 8, HALF_W - 4);
    const r = m.phase === "goal" ? 2.2 : 3.2;
    st.tx = damp(st.tx, tx, r, dt); st.tz = damp(st.tz, tz, r * 0.7, dt);
    st.dist = damp(st.dist, dist, 1.6, dt); st.height = damp(st.height, height, 1.6, dt); st.fov = damp(st.fov, fov, 2, dt);
    // the gantry pans: the camera stays near the halfway line but swings toward the action, like a real one
    const camX = st.tx * (m.phase === "goal" ? 0.92 : 0.62);
    const shake = st.shake > 0 ? (Math.sin(m.t * 60) * 0.06 * st.shake) : 0;
    st.shake = Math.max(0, st.shake - dt * 2);
    // the near stand starts at z 43.5 and rises about half a metre per metre: a low camera rises over the heads
    const camZ = st.tz + st.dist;
    const clear = camZ > 43 ? 0.5 * (camZ - 43.5) + 3.5 : 0;
    cam.position.set(camX + shake, Math.max(st.height, clear) + shake * 0.5, camZ);
    st.look.set(st.tx, 0.8, st.tz);
    cam.lookAt(st.look);
    if (Math.abs(cam.fov - st.fov) > 0.01) { cam.fov = st.fov; cam.updateProjectionMatrix(); }
  }
  function onEvent(ev, m) {
    if (ev.type === "goal") { st.goalP = ev.by >= 0 ? m.players[ev.by] : null; st.shake = 0.6; }
    if (ev.type === "post") st.shake = 0.3;
  }
  function resize(aspect) { cam.aspect = aspect; cam.updateProjectionMatrix(); }
  return { cam, update, onEvent, resize, state: st };
}

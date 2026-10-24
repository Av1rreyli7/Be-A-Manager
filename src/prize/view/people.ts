/**
 * The people in the ring who are not boxing: the referee (white shirt, black trousers) and your trainer in the
 * corner between rounds. Their bodies come from Player Career's body module (the site's one body builder), with
 * a few poses on top: the referee watches, steps in to break a clinch, counts over a fallen boxer with his arm,
 * waves a fight off and raises the winner's hand; the trainer leans in and talks with his hands.
 */
import * as THREE from "three";
import { makeBody, type BodyRig } from "../../career/body";
import { B } from "../../../floodlights/m3d/view/rig.mjs";

export function makeReferee(quality: number): BodyRig {
  return makeBody(
    { skinF: 0.38, hair: 6, hairCol: 6, beard: 0, moustache: 0, muscle: 0.4, boot: 0 },
    { height: 180, weight: 84, pos: "MID" },
    { shirt: "#f2f2f2", trim: "#1a1a1a", shorts: "#151515", socks: "#151515", sleeve: false, bottom: "trousers", plain: true, shoe: ["#111111", "#1d1d1d"] },
    quality >= 2 ? quality : 1,
    undefined,
    { lite: quality < 2, seed: 3 },
  );
}

export function makeTrainer(quality: number, accent: string): BodyRig {
  return makeBody(
    { skinF: 0.55, hair: 0, hairCol: 6, beard: 1, moustache: 1, muscle: 0.5, boot: 0 },
    { height: 176, weight: 88, pos: "MID" },
    { shirt: "#14161c", trim: accent, shorts: "#14161c", socks: "#111111", sleeve: true, bottom: "trousers", plain: false, shoe: ["#111111", "#1d1d1d"] },
    quality,
    undefined,
    { lite: false, seed: 7 },
  );
}

const e = new THREE.Euler();
const q = new THREE.Quaternion();
function turn(b: THREE.Bone, x: number, y: number, z: number) {
  e.set(x, y, z);
  q.setFromEuler(e);
  b.quaternion.multiply(q);
}

/**
 * the referee's pose on top of his walk: act from the engine ("watch", "break", "count", "check", "wave",
 * "raise"), the count number, seconds into the act
 */
export function poseReferee(ref: BodyRig, act: string, count: number, t: number) {
  const b = ref.bones;
  if (act === "count") {
    // bent over the fallen boxer, the right arm chopping down on each count
    turn(b[B.spine1], 0.35, 0, 0);
    turn(b[B.chest], 0.15, 0, 0);
    const beat = (t % 1) / 1;
    const chop = beat < 0.25 ? beat / 0.25 : 1 - (beat - 0.25) / 0.75;
    turn(b[B.armR], -1.2 - 1.1 * chop * (count > 0 ? 1 : 0), 0, -0.25);
    turn(b[B.foreR], -0.3, 0, 0);
    turn(b[B.armL], 0.2, 0, 0.25);
  } else if (act === "wave") {
    // both arms crossing over the head: it is over
    const w = Math.sin(t * 9);
    turn(b[B.armL], -2.6, 0, 0.3 + w * 0.4);
    turn(b[B.armR], -2.6, 0, -0.3 - w * 0.4);
  } else if (act === "raise") {
    turn(b[B.armR], -2.9, 0, -0.15);
    turn(b[B.foreR], -0.1, 0, 0);
  } else if (act === "break") {
    // stepping in with both arms out between them
    turn(b[B.armL], -1.3, 0, 0.5);
    turn(b[B.armR], -1.3, 0, -0.5);
    turn(b[B.spine1], 0.12, 0, 0);
  } else if (act === "check") {
    // holding the boxer's gloves and looking him in the eyes
    turn(b[B.armL], -1.1, 0, 0.12);
    turn(b[B.armR], -1.1, 0, -0.12);
    turn(b[B.foreL], -0.6, 0, 0);
    turn(b[B.foreR], -0.6, 0, 0);
  } else {
    // watching: a slight crouch, hands ready
    turn(b[B.spine1], 0.08, 0, 0);
    turn(b[B.armL], -0.35, 0, 0.18);
    turn(b[B.armR], -0.35, 0, -0.18);
    turn(b[B.foreL], -0.7, 0, 0);
    turn(b[B.foreR], -0.7, 0, 0);
  }
}

/** the trainer crouched in front of the stool, talking with his hands */
export function poseTrainer(tr: BodyRig, t: number, talking: number) {
  const b = tr.bones;
  // the jaw is not in the body module's idle, so it starts from rest every frame here
  b[B.jaw].quaternion.identity();
  turn(b[B.thighL], -1.3, 0.2, 0);
  turn(b[B.thighR], -0.4, -0.15, 0);
  turn(b[B.shinL], 1.9, 0, 0);
  turn(b[B.shinR], 1.4, 0, 0);
  turn(b[B.spine1], 0.25, 0, 0);
  turn(b[B.chest], 0.1, 0, 0);
  const g = Math.sin(t * 3.1) * talking, g2 = Math.sin(t * 2.3 + 1) * talking;
  turn(b[B.armL], -0.7 - g * 0.25, 0, 0.3);
  turn(b[B.armR], -0.8 - g2 * 0.3, 0, -0.35);
  turn(b[B.foreL], -0.8 + g * 0.3, 0, 0);
  turn(b[B.foreR], -0.9 + g2 * 0.3, 0, 0);
  turn(b[B.head], -0.1 + Math.sin(t * 1.7) * 0.05 * talking, Math.sin(t * 0.9) * 0.1, 0);
  turn(b[B.jaw], Math.max(0, Math.sin(t * 13)) * 0.12 * talking, 0, 0);
}

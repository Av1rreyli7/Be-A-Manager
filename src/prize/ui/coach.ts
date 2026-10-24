/**
 * What your trainer tells you on the stool, and what the announcer says before the first bell. Plain words, from
 * what actually happened in the round.
 */
import type { FightState } from "../engine/types";
import { PUNCH_NAME } from "../engine/rules";
import { inches, shortName } from "./fighters";

export function coachLine(st: FightState): string {
  const [me, op] = st.f;
  const last = st.rounds[st.rounds.length - 1];
  if (!last) return "Find your range with the jab, then let your hands go.";
  const [a, b] = last;
  const them = shortName(st.defs[1].name);
  const read = st.ai[1].read;
  const lines: [number, string][] = [];
  if (me.headHP < 40) lines.push([10, `You're hurt. When ${them} comes in, hold on with G and get your legs back.`]);
  if (b.kd > 0) lines.push([9, `${them} is hurt! Go and finish it, but stay tight. A hurt fighter still punches.`]);
  if (a.kd > 0) lines.push([9, `Clear your head. Jab and move this round, don't trade with ${them}.`]);
  if (read) lines.push([8, `${them} is reading your ${PUNCH_NAME[read].toLowerCase()}. Stop throwing it the same way: double up, go to the body, change the rhythm.`]);
  if (Math.max(...op.cut) > 30) lines.push([7, `${them} is cut over the ${op.cut[0] > op.cut[1] ? "left" : "right"} eye. Hunt that side of the head.`]);
  if (Math.max(...me.cut) > 30) lines.push([7, "I've closed the cut as best I can. Keep your guard up on that side."]);
  if (b.bodyLanded >= 6 && me.guard === "high") lines.push([6, `${them} is digging the body under that high guard. Switch to the normal block up close.`]);
  if (me.stamina < 45 || a.thrown > b.thrown * 1.6 + 10) lines.push([6, "Breathe. You're throwing too much. Pick your shots and let the jab work."]);
  if (a.ropes > 12) lines.push([5, "Get off the ropes! Step out to the side with A and D before you get trapped."]);
  if (a.landed > 0 && b.blocked > a.landed * 1.5) lines.push([5, `${them} is blocking everything upstairs. Hold L and go to the body, the head will open.`]);
  if (st.defs[1].style === "counter" && a.thrown > 25 && a.landed < a.thrown * 0.25) lines.push([4, `${them} is waiting for you to miss. Feint, draw the punch, then counter.`]);
  if (st.defs[1].guard === "high" && a.bodyLanded < 3) lines.push([4, `${them} keeps the hands high. Go downstairs, hold L with your hooks.`]);
  if (a.landed > b.landed + 5) lines.push([3, "You're winning the exchanges. Keep doing exactly that."]);
  if (b.landed > a.landed + 5) lines.push([3, `${them} is beating you to the punch. Slip the jab with Q or E and come back with the right hand.`]);
  lines.push([1, "Use the jab to find your range, then let the right hand go behind it."]);
  lines.sort((x, y) => y[0] - x[0]);
  return lines[0][1];
}

/** the announcer's lines for the introductions */
export function announcer(st: FightState): { text: string; card?: { name: string; nick: string; line: string; corner: "red" | "blue" } }[] {
  const [me, op] = st.defs;
  const card = (d: typeof me, corner: "red" | "blue") => ({
    name: d.name,
    nick: d.nick,
    line: `${d.country} · ${inches(d.heightCm)} · ${d.reachIn} inch reach · ${d.weightClass}`,
    corner,
  });
  return [
    { text: "Ladies and gentlemen, it is time for the main event of the evening." },
    { text: `${st.cfg.rounds} rounds for the PRIZE FIGHTER championship of the world.` },
    { text: `Introducing first, in the blue corner, fighting out of ${op.country}...`, card: card(op, "blue") },
    { text: `And in the red corner, fighting out of ${me.country}...`, card: card(me, "red") },
    { text: "Protect yourselves at all times. Touch gloves, and let's get it on." },
  ];
}

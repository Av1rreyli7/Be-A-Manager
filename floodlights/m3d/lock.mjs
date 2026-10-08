// Player lock (Player Career): the person controls one footballer for the whole match, the one they created.
// No switching. Without the ball they move him, call for it (Q) or make a run (T) and the team mates on the ball
// read that; on the ball every key works as normal. His own match is counted here: touches, passes, shots,
// goals, assists, tackles, skills and the ball lost, and a live match rating from them.
// Only a setup row marked pc turns this on; in every other match m.lock stays null and nothing here runs.
import { clamp } from "./util.mjs";

// a call or a run is live for this long
export const CALL_T = 1.6, RUN_T = 2.6;

export function lockSetup(m, setup) {
  const p = m.teams[0].players.find(q => q.pc && !q.gk) || null;
  m.lock = p;
  if (!p) return;
  m.ctrl = p;
  m.call = null;
  m.lockRun = null;
  m.instruction = setup.instruction || null;
  m.lockStats = { touches: 0, passes: 0, passOk: 0, shots: 0, onTarget: 0, goals: 0, assists: 0, tackles: 0, won: 0, skills: 0, lost: 0, calls: 0, runs: 0, rating: 6 };
}

// the person asks for it: the man on the ball looks for him first
export function lockCall(m) {
  if (!m.lock) return;
  if (m.call && m.t - m.call.t < 0.5) return;
  m.call = { t: m.t };
  m.lockStats.calls++;
  m.events.push({ type: "call", by: m.lock.id });
}
// a run in behind: a through ball is now on, if the passer sees it
export function lockRunStart(m) {
  if (!m.lock) return;
  m.lockRun = { t: m.t };
  m.lock.ai.run = { user: true, t: m.t };
  m.lockStats.runs++;
  m.events.push({ type: "run", by: m.lock.id });
}
export const calling = m => !!(m.lock && m.call && m.t - m.call.t < CALL_T);
export function lockTick(m) {
  if (!m.lock) return;
  if (m.lockRun && m.t - m.lockRun.t > RUN_T) { m.lockRun = null; if (m.lock.ai.run && m.lock.ai.run.user) m.lock.ai.run = null; }
}

// what happened to him this step, from the events the step pushed
export function lockScan(m, from) {
  const L = m.lock, S = m.lockStats;
  if (!L) return;
  for (let i = from; i < m.events.length; i++) {
    const e = m.events[i];
    if (e.type === "kick" && e.by === L.id) {
      if (e.shot) S.shots++;
      else if (e.kind !== "clear") S.passes++;
    } else if (e.type === "tackle") {
      if (e.by === L.id) { S.tackles++; if (e.won) S.won++; }
      else if (e.from === L.id && e.won) S.lost++;
    } else if (e.type === "skill" && e.by === L.id) S.skills++;
    else if (e.type === "goal") {
      if (e.by === L.id && !e.own) S.goals++;
      if (e.assist === L.id) S.assists++;
    } else if ((e.type === "touch" || e.type === "control") && e.by === L.id) S.touches++;
  }
  S.rating = lockRating(m);
}
// on target: the sim marks it on the shot itself
export function lockShotOn(m, p, on) { if (m.lock && p === m.lock && on) m.lockStats.onTarget++; }
export function lockPassOk(m, by) { if (m.lock && by === m.lock) m.lockStats.passOk++; }

// the live rating: starts at 6, goals and assists move it most, every pass, shot, tackle and lost ball a little
export function lockRating(m) {
  const S = m.lockStats, L = m.lock;
  if (!S || !L) return 6;
  const missed = Math.max(0, S.passes - S.passOk);
  // each kind of thing counts less the more there is of it, so no one habit can carry a rating
  let r = 6 + S.goals * 0.9 + S.assists * 0.55 + Math.min(S.onTarget, 6) * 0.1 - Math.min(Math.max(0, S.shots - S.onTarget), 10) * 0.04;
  r += Math.min(S.passOk, 30) * 0.02 - Math.min(missed, 15) * 0.05;
  r += Math.min(1, Math.sqrt(S.won) * 0.25) + Math.min(S.skills, 6) * 0.03 - Math.min(S.lost, 12) * 0.06;
  // the score matters, more as the game goes on
  const diff = m.score[0] - m.score[1];
  r += clamp(diff, -3, 3) * 0.12 * clamp(m.clock / 90, 0, 1);
  // a defender or a holding man whose team keeps a clean sheet
  if (m.score[1] === 0 && (L.pos === "DF" || L.role === "CDM")) r += 0.4 * clamp(m.clock / 90, 0, 1);
  return Math.round(clamp(r, 3, 10) * 10) / 10;
}

// the manager's instruction for the match, and whether he did it
export function instructionMet(m) {
  const I = m.instruction, S = m.lockStats;
  if (!I || !S) return null;
  if (I.kind === "shots") return S.shots >= (I.n || 3);
  if (I.kind === "passes") return S.passOk >= (I.n || 15) && S.passOk >= S.passes * 0.75;
  if (I.kind === "tackles") return S.won >= (I.n || 3);
  if (I.kind === "runs") return S.runs >= (I.n || 4);
  if (I.kind === "press") return S.tackles >= (I.n || 3);
  return null;
}

// his match, for the career: minutes, goals, assists, the rating and the rest
export function lockLine(m) {
  const S = m.lockStats;
  if (!S) return null;
  const met = instructionMet(m);
  return {
    mins: 90, g: S.goals, a: S.assists, shots: S.shots, onTarget: S.onTarget, passes: S.passes, passOk: S.passOk,
    tackles: S.tackles, won: S.won, skills: S.skills, lost: S.lost, touches: S.touches, calls: S.calls, runs: S.runs,
    rating: Math.round(clamp(lockRating(m) + (met === true ? 0.2 : met === false ? -0.1 : 0), 3, 10) * 10) / 10,
    instruction: met
  };
}

// how far ahead of the ball he is: used by the passer to judge a run
export function lockAhead(m) {
  const L = m.lock, T = m.teams[0];
  return L ? (L.x - m.ball.x) * T.dir : 0;
}

/**
 * PRIZE FIGHTER engine types. Everything here is plain data, so a whole fight can be saved as JSON in the middle
 * of a round and put back after a refresh. No DOM and no three.js in the engine: the headless battery runs it in
 * node, the page runs it inside the render loop.
 */

export type Stance = "orthodox" | "southpaw";
/** how the computer fights with this boxer */
export type Style = "pressure" | "counter" | "outboxer" | "body";
export type Guard = "high" | "philly" | "normal";
export type PunchKind = "jab" | "cross" | "lhook" | "rhook" | "lupper" | "rupper";
export type Target = "head" | "body";
/** head movement: slip left, slip right, duck, lean back, and the shoulder roll (lean back in the Philly shell) */
export type Evade = "slipL" | "slipR" | "duck" | "back" | "roll";
/** 0 Tune up, 1 Contender, 2 Champion, 3 Legend, 4 Nightmare */
export type Tier = 0 | 1 | 2 | 3 | 4;
export type Side = "L" | "R";

export interface Attrs {
  power: number;
  speed: number;
  chin: number;
  stamina: number;
  defense: number;
}

export type Trait =
  | "jab" // jab master
  | "peek" // peek a boo: longer slip and duck windows
  | "shell" // shoulder roll master
  | "body" // body hunter
  | "iron" // iron chin
  | "dancer" // light feet
  | "bomb" // one punch power in the rear hand
  | "hands" // fast hands: combos flow sooner
  | "engine" // endless stamina
  | "counter" // counter puncher
  | "hook" // the left hook
  | "awkward" // hard to read and hard to time
  | "heart" // gets up from anything
  | "upper"; // the uppercut

export interface Look {
  /** skin tone, 0 light to 1 dark (the rig's smooth skin slider) */
  skin: number;
  /** rig hair style index */
  hair: number;
  /** rig hair colour index */
  hairCol: number;
  /** 0 none, 1 stubble, 2 short, 3 full, 4 goatee, 5 chin strap */
  beard: number;
  moustache?: 0 | 1;
  /** trunks: main colour, waistband, side stripe */
  trunks: [string, string, string];
  gloves: string;
  /** glove cuff and laces */
  gloveTrim: string;
  boots: string;
  /** body shape sliders (0 to 1, 0.5 is average) */
  muscle: number;
  shoulders: number;
  /** a heavier middle for the big men */
  belly: number;
}

export interface FighterDef {
  id: string;
  name: string;
  /** ring name in quotes, can be empty */
  nick: string;
  country: string;
  real: boolean;
  /** short era text for real boxers, for example "1960s to 1981" */
  era: string;
  stance: Stance;
  style: Style;
  /** the guard the computer uses most with this boxer */
  guard: Guard;
  attrs: Attrs;
  heightCm: number;
  reachIn: number;
  weightKg: number;
  weightClass: string;
  traits: Trait[];
  look: Look;
  /** one line about how they fight, shown on the pick card */
  blurb: string;
}

export interface FightConfig {
  rounds: 3 | 6 | 12;
  /** seconds in a round */
  roundSec: number;
  tier: Tier;
  /** true: corner 0 is played by a person (the page), false: both corners are the computer (tests) */
  human: boolean;
}

export interface Input {
  /** move forward (+1) or back (-1) */
  mf: number;
  /** move right (+1) or left (-1), circling */
  ms: number;
  sprint: boolean;
  punch: PunchKind | null;
  /** the body modifier for this punch */
  body: boolean;
  evade: Evade | null;
  guard: Guard | null;
  stance: boolean;
  clinch: boolean;
  /** a tap in the get up mini game */
  tap: boolean;
  /** where the person is looking, -1 to 1 (mouse or trackpad); looking down sends punches to the body */
  aimX: number;
  aimY: number;
}

export type ActionType = "punch" | "evade" | "stance" | "hitstun" | "clinch" | "down" | "getup";

export interface Action {
  type: ActionType;
  /** frames since it started */
  t: number;
  /** total frames (for evade, stance, hitstun, getup) */
  dur: number;
  kind?: PunchKind;
  target?: "head" | "body";
  startup?: number;
  active?: number;
  recovery?: number;
  /** the punch has been judged */
  done?: boolean;
  /** frames of recovery that may be skipped by a punch with the other hand */
  cancelAt?: number;
  ev?: Evade;
  /** evade windows in frames: full from w0 to w1, a perfect read before wp */
  w0?: number;
  w1?: number;
  wp?: number;
  /** hit reaction: direction (-1 left, 1 right, 0 straight back, 2 body) and size */
  dir?: number;
  size?: number;
}

export interface RoundStats {
  thrown: number;
  landed: number;
  jabsThrown: number;
  jabsLanded: number;
  powerThrown: number;
  powerLanded: number;
  headLanded: number;
  bodyLanded: number;
  /** damage that got through */
  damage: number;
  kd: number;
  /** punches from the other side that were blocked, slipped or rolled */
  blocked: number;
  evaded: number;
  /** seconds spent coming forward in range */
  forward: number;
  /** seconds with your back on the ropes */
  ropes: number;
  clinches: number;
  /** points taken away by the referee this round */
  deducted: number;
}

export interface GetUp {
  /** the rhythm: hits needed and made */
  need: number;
  hits: number;
  misses: number;
  /** seconds from the first beat between beats */
  beat: number;
  /** half width of the timing window in seconds */
  win: number;
  /** time of the first beat, seconds after the fall */
  first: number;
  /** a beat already scored (by index) so one beat counts once */
  lastBeat: number;
  /** the balance check after standing: needed or not, the needle, its speed, time held */
  balance: boolean;
  needle: number;
  needleV: number;
  held: number;
  /** "rhythm", "rising", "balance", "done", "failed" */
  stage: string;
  /** when the rise began, seconds after the fall (or -1) */
  rose: number;
}

export interface FState {
  x: number;
  z: number;
  vx: number;
  vz: number;
  stance: Stance;
  /** a stance switch asked for while busy: applied as soon as the boxer is free */
  wantStance: boolean;
  guard: Guard;
  headHP: number;
  bodyHP: number;
  stamina: number;
  maxStam: number;
  stun: number;
  /** seconds left of being rocked */
  rocked: number;
  action: Action | null;
  /** a punch pressed too early, kept for a few frames */
  buf: { kind: PunchKind; body: boolean; f: number } | null;
  evBuf: { ev: Evade; f: number } | null;
  /** the last punch: kind, hand and the frame it finished */
  last: { kind: PunchKind; hand: Side; end: number } | null;
  combo: number;
  /** 0 to 1: how much the boxer has been spamming */
  spam: number;
  /** frames since the last evade ended (a quick second slip is weaker) */
  evGap: number;
  sprint: number;
  sprintCd: number;
  /** frames of an opening earned by a perfect slip or roll: punches hit harder */
  open: number;
  /** frames left of being off balance after a big miss into a perfect slip */
  overext: number;
  /** cuts over the left and right eye, swelling of the left and right eye (0 to 100) */
  cut: [number, number];
  swell: [number, number];
  kdRound: number;
  kdFight: number;
  clinchRound: number;
  warnings: number;
  /** last frames this fighter landed and was landed on clean (for the referee) */
  lastLanded: number;
  /** the frame this boxer was last landed on clean, and clean head shots taken since he last landed one */
  hurtAt: number;
  unanswered: number;
  /** seconds since the last action, for stamina */
  idle: number;
  /** head offset from evading, metres in the fighter's own frame: right, up, back */
  hx: number;
  hy: number;
  hz: number;
  /** the computer's tell: the shoulder loading up before its first punch (shown, never a punch yet) */
  tell: { kind: PunchKind; body: boolean; t: number; dur: number } | null;
  /** the hit reaction the view plays: frames left, direction, size */
  react: { t: number; dir: number; size: number; body: boolean } | null;
  getup: GetUp | null;
  rs: RoundStats;
  fs: RoundStats;
}

export interface AIState {
  /** a short plan of punches to throw */
  plan: { kind: PunchKind; body: boolean }[];
  /** frames until the next decision */
  think: number;
  /** the person's recent punches (kinds) */
  seen: PunchKind[];
  /** what the AI has read: a punch kind it now times and counters */
  read: PunchKind | null;
  /** seconds of the person in each guard in the last stretch */
  guardTime: { high: number; philly: number; normal: number };
  /** the person's slips to each side */
  slips: { L: number; R: number };
  /** the punch from the other side it is reacting to (its start frame), so it reacts once */
  seenPunch: number;
  /** the tell it already reacted to (its start frame) */
  seenTell: number;
  /** when the other corner's last punches started (frames), to learn the rhythm of a habit */
  starts: number[];
  /** how long the other corner's last punch took to land (frames), for timing the next one */
  lastSu: number;
  /** a reaction waiting for its moment: frame to act and what to do */
  react: { at: number; ev: Evade | null; counter: PunchKind | null; counterBody: boolean } | null;
  /** circle direction, swapped now and then */
  circle: number;
  /** a planned rise from the canvas, in seconds after the fall (-1 stays down) */
  riseAt: number;
  /** the move it is holding for a while */
  moveF: number;
  moveS: number;
  moveT: number;
}

export type Method = "KO" | "TKO" | "UD" | "SD" | "MD" | "DRAW";

export interface Result {
  /** 0 or 1, null for a draw */
  winner: 0 | 1 | null;
  method: Method;
  /** for draws and decisions: unanimous, split, majority */
  detail: string;
  /** a plain words line, for example "TKO, the referee stopped it" */
  how: string;
  round: number;
  /** seconds into the round */
  time: number;
  /** each judge's total for each corner */
  totals: [number, number][];
}

export interface Judge {
  name: string;
  /** what this judge values */
  wLanded: number;
  wPower: number;
  wDamage: number;
  wAggr: number;
  wDef: number;
  noise: number;
  /** how close a round has to be before this judge calls it even */
  even: number;
  /** how one sided before a 10 8 without a knockdown */
  dom: number;
}

export type FightPhase = "pre" | "fight" | "kd" | "bell" | "corner" | "over";

export interface KDState {
  who: 0 | 1;
  /** seconds since the fall */
  t: number;
  count: number;
  /** "count", "rising", "check", "out" */
  stage: string;
  /** seconds since the boxer started to rise */
  rise: number;
}

export interface RefState {
  x: number;
  z: number;
  /** "watch", "break", "count", "wave", "raise", "check" */
  act: string;
  t: number;
}

export interface FightEvent {
  type:
    | "punch"
    | "hit"
    | "block"
    | "miss"
    | "evade"
    | "perfect"
    | "rocked"
    | "kd"
    | "count"
    | "rise"
    | "resume"
    | "ko"
    | "stop"
    | "bell"
    | "round"
    | "clinch"
    | "break"
    | "warn"
    | "deduct"
    | "cut"
    | "guard"
    | "stance"
    | "tap"
    | "end";
  who: 0 | 1;
  kind?: PunchKind;
  target?: "head" | "body";
  dmg?: number;
  /** "clean", "blocked", "glance", "counter" and so on */
  tag?: string;
  n?: number;
  text?: string;
}

export interface FightState {
  v: 1;
  seed: number;
  /** the random number generator's state */
  rng: number;
  frame: number;
  cfg: FightConfig;
  defs: [FighterDef, FighterDef];
  f: [FState, FState];
  ai: [AIState, AIState];
  phase: FightPhase;
  round: number;
  /** seconds left in the round */
  clock: number;
  /** seconds in the current phase (bell pause, corner) */
  pt: number;
  kd: KDState | null;
  ref: RefState;
  /** clinch: frames held and when the referee breaks it */
  clinch: { t: number; breakAt: number; sep: number } | null;
  judges: Judge[];
  /** cards[judge][round] = [corner 0 points, corner 1 points] */
  cards: [number, number][][];
  /** each finished round's stats for both corners */
  rounds: [RoundStats, RoundStats][];
  result: Result | null;
  /** what happened in the last step, for the view and the sound; cleared at the start of each step */
  ev: FightEvent[];
  /** set to 1 when the person slips or rolls a big punch perfectly; the page plays a beat of slow motion and
   *  clears it */
  slow: number;
  /** what the corner did between the last two rounds, for the corner screen */
  recover: { head: [number, number]; body: [number, number]; stam: [number, number]; cut: [number, number] }[] | null;
}

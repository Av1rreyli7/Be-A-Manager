// Floodlights 3D match: constants shared by the sim and the view.
// Units are metres, seconds and radians. The sim uses x along the pitch (goal to goal), y across it
// (touchline to touchline) and z up. The view maps that to three.js as (x, z, y).

export const HALF_L = 52.5, HALF_W = 34;
export const GOAL_HALF = 3.66, BAR_H = 2.44, GOAL_DEPTH = 2.2, POST_R = 0.06;
export const BOX_D = 16.5, BOX_HALF = 20.16, SIX_D = 5.5, SIX_HALF = 9.16, SPOT_D = 11, CIRCLE_R = 9.15;
export const DIMS = { HALF_L, HALF_W, GOAL_HALF, BAR_H, GOAL_DEPTH, BOX_D, BOX_HALF, SIX_D, SIX_HALF, SPOT_D, CIRCLE_R };

// the match rules the controller and the server already rely on
export const STEP = 1 / 60, MATCH_SECONDS = 360, HALF_SECONDS = 180, MAX_GOALS = 12;

// ball
export const BALL_R = 0.11, BALL_M = 0.43, GRAVITY = 9.81;
export const BALL_SUB = 4; // physics sub steps per sim step (240 Hz)
export const DRAG_K = 0.0125; // quadratic air drag: a = -k |v| v
export const MAGNUS_K = 0.004; // a = k (w x v)
export const SPIN_DECAY_AIR = 0.22, SPIN_DECAY_GROUND = 2.4;
export const BOUNCE_E = 0.58, BOUNCE_MU = 0.42;
export const ROLL_MU = 0.055, ROLL_V = 0.13; // rolling resistance: a = mu g + c v
export const BALL_I = 2 / 3; // hollow sphere inertia factor (I = k m r^2)

// players
export const BODY_R = 0.34; // collision radius around the hips and shoulders
export const REACH = 0.95; // how far from the body centre a foot can play the ball
export const HEAD_REACH = 0.55;

export const ROLES = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"];
export const ROLE_GROUP = { GK: "GK", RB: "DF", CB: "DF", LB: "DF", CDM: "MF", CM: "MF", CAM: "MF", RW: "FW", ST: "FW", LW: "FW" };

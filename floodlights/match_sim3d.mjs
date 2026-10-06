// The engine behind the playable 3D match. It was rebuilt from scratch in m3d/ (physics, bodies, touches,
// kicks, defending, keepers, skills, AI, rules); this file is the entry the page imports next to the view.
export { createSim3D, STEP, MATCH_SECONDS, HALF_SECONDS, MAX_GOALS, DIMS, deriveAttrs, deriveProfile, assignNumbers } from "./m3d/sim.mjs";

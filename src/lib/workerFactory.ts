/** Creates the simulation worker. The artifact build swaps this module for a blob-URL version. */
export function createSimWorker(): Worker {
  return new Worker(new URL("../worker/sim.worker.ts", import.meta.url), { type: "module" });
}

/** True in the single-file artifact build (no local server features like data refresh). */
export const IS_ARTIFACT = false;

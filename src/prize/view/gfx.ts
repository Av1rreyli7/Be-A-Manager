/**
 * Graphics levels, the same four as Player Career, and the frame guard. Sixty frames a second comes first: when
 * frames run long the guard steps the level down (the crowd and the effects go first, then the pixel count),
 * never up on its own, so the picture does not pump.
 */
export interface Tier {
  name: string;
  note: string;
  /** device pixel ratio cap */
  dpr: number;
  crowd: number;
  shadows: boolean;
  post: boolean;
}

export const GFX: Tier[] = [
  { name: "Low", note: "No shadows, a smaller crowd, no screen effects. For older laptops.", dpr: 1, crowd: 500, shadows: false, post: false },
  { name: "Medium", note: "Shadows on, a fuller crowd, a little softer.", dpr: 1.25, crowd: 1100, shadows: true, post: false },
  { name: "High", note: "Shadows, dust in the lights, hurt vision effects and a big crowd. The best fit for most laptops.", dpr: 1.6, crowd: 1900, shadows: true, post: true },
  { name: "Ultra", note: "The sharpest picture, the biggest shadows and the full house. For strong machines.", dpr: 2, crowd: 2800, shadows: true, post: true },
];

/** watches frame times; says when to step the level down */
export class FrameGuard {
  private times: number[] = [];
  private work: number[] = [];
  private last = 0;
  private cool = 0;
  /** frames to ignore (a scene change, a pause, a hidden tab) */
  private skip = 30;
  /** why it last stepped down: the median frame and the median CPU work (ms) */
  reason: { frame: number; cpu: number } | null = null;

  hold(frames = 45) {
    this.skip = Math.max(this.skip, frames);
    this.times.length = 0;
    this.work.length = 0;
    this.last = 0;
  }

  /** call at the start of each frame with the time, and with the CPU work of the last frame; returns true to step down */
  tick(now: number, workMs: number): boolean {
    if (typeof document !== "undefined" && document.hidden) {
      this.hold();
      return false;
    }
    const dt = this.last ? now - this.last : 16.7;
    this.last = now;
    if (this.skip > 0) {
      this.skip--;
      return false;
    }
    // a frame over 250 ms is a stall (a tab switch, a debugger), not the scene
    if (dt > 250) return false;
    this.times.push(dt);
    this.work.push(workMs);
    if (this.times.length > 120) {
      this.times.shift();
      this.work.shift();
    }
    if (this.cool > 0) {
      this.cool--;
      return false;
    }
    if (this.times.length < 120) return false;
    // the median frame, so a one off stall (a screenshot, a garbage collection, a new body being built) never
    // counts as the scene being slow
    const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1];
    const avg = med(this.times);
    const cpu = med(this.work);
    // a screen or a battery saver that caps the page at 30 (or 40, 48) frames a second shows as frames all the same
    // length; that is not the scene being slow, so it is left alone
    const capped = [33.33, 25, 20.83].some(cap => this.times.filter(x => Math.abs(x - cap) < 1.6).length > this.times.length * 0.8);
    // under about 50 frames a second on the clock, or the CPU work alone over 12 ms a frame
    if ((avg > 20 && !capped) || cpu > 12) {
      this.reason = { frame: avg, cpu };
      this.cool = 180;
      this.times.length = 0;
      this.work.length = 0;
      return true;
    }
    return false;
  }
}

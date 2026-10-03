/**
 * Starfield in the Vertex style: two 1px dots whose whole star field is one long box-shadow list.
 * The numbers come from a seeded generator so the server and the browser draw the same sky.
 */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function layer(count: number, blur: number, aMin: number, aMax: number, seed: number): string {
  const rnd = seeded(seed);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = (rnd() * 100).toFixed(2);
    const y = (rnd() * 100).toFixed(2);
    const a = (aMin + rnd() * (aMax - aMin)).toFixed(2);
    out.push(`${x}vw ${y}vh ${blur}px 0 rgba(255,255,255,${a})`);
  }
  return out.join(",");
}

/** 150 sharp faint stars and 18 soft bright ones, the same recipe as the reference. */
export const STARS_A = layer(150, 0, 0.05, 0.3, 20261002);
export const STARS_B = layer(18, 1.2, 0.35, 0.7, 7141);

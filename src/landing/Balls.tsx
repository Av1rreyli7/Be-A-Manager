/**
 * The two signature balls of the landing intro, drawn as small inline SVGs (no image files).
 * Each one is lit from the top left so it reads as round under the floodlights.
 */

/** five points of a regular pentagon around (cx, cy) */
function pent(cx: number, cy: number, r: number, turn = -90): string {
  const pts: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a = ((turn + i * 72) * Math.PI) / 180;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  return pts.join(" ");
}

const OUTER = Array.from({ length: 5 }, (_, i) => {
  const a = ((-90 + 36 + i * 72) * Math.PI) / 180;
  return { x: 50 + Math.cos(a) * 43, y: 50 + Math.sin(a) * 43, turn: -90 + 36 + i * 72 + 180 };
});

export function Football({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="bam-fb-shade" cx="36%" cy="30%" r="74%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#e9edf2" />
          <stop offset="1" stopColor="#8d97a6" />
        </radialGradient>
        <clipPath id="bam-fb-clip">
          <circle cx="50" cy="50" r="47" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="47" fill="url(#bam-fb-shade)" />
      <g clipPath="url(#bam-fb-clip)" fill="#14171c">
        <polygon points={pent(50, 50, 15)} />
        {OUTER.map((p, i) => (
          <polygon key={i} points={pent(p.x, p.y, 14, p.turn)} />
        ))}
      </g>
      <g clipPath="url(#bam-fb-clip)" stroke="#14171c" strokeWidth="1.6" fill="none" opacity="0.55">
        {OUTER.map((p, i) => {
          const a = ((-90 + i * 72) * Math.PI) / 180;
          return <line key={i} x1={50 + Math.cos(a) * 15} y1={50 + Math.sin(a) * 15} x2={(50 + Math.cos(a) * 15 + p.x) / 2 + Math.cos(a) * 6} y2={(50 + Math.sin(a) * 15 + p.y) / 2 + Math.sin(a) * 6} />;
        })}
      </g>
      <circle cx="50" cy="50" r="47" fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="1.5" />
      <ellipse cx="36" cy="26" rx="15" ry="8" fill="#ffffff" opacity="0.55" transform="rotate(-28 36 26)" />
    </svg>
  );
}

export function Basketball({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="bam-bb-shade" cx="36%" cy="30%" r="76%">
          <stop offset="0" stopColor="#ffb072" />
          <stop offset="0.5" stopColor="#f2762c" />
          <stop offset="1" stopColor="#8a3410" />
        </radialGradient>
        <clipPath id="bam-bb-clip">
          <circle cx="50" cy="50" r="47" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="47" fill="url(#bam-bb-shade)" />
      <g clipPath="url(#bam-bb-clip)" stroke="#2a1206" strokeWidth="2.6" fill="none" strokeLinecap="round">
        <line x1="50" y1="2" x2="50" y2="98" />
        <line x1="2" y1="50" x2="98" y2="50" />
        <path d="M 17 12 C 36 30, 36 70, 17 88" />
        <path d="M 83 12 C 64 30, 64 70, 83 88" />
      </g>
      <circle cx="50" cy="50" r="47" fill="none" stroke="rgba(0,0,0,.4)" strokeWidth="1.5" />
      <ellipse cx="35" cy="25" rx="14" ry="7" fill="#ffe2c4" opacity="0.4" transform="rotate(-28 35 25)" />
    </svg>
  );
}

/** PRIZE FIGHTER's mark: a boxing glove side on, knuckles to the right, lit from the top left */
export function Glove({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="bam-gl-shade" cx="38%" cy="28%" r="80%">
          <stop offset="0" stopColor="#ff9a7a" />
          <stop offset="0.45" stopColor="#ff4630" />
          <stop offset="1" stopColor="#8a1020" />
        </radialGradient>
        <linearGradient id="bam-gl-cuff" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#c9cfd8" />
        </linearGradient>
      </defs>
      {/* the cuff, wrist to the left */}
      <path d="M 10 46 C 10 38, 14 34, 22 34 L 34 34 L 36 72 L 22 72 C 14 72, 10 68, 10 60 Z" fill="url(#bam-gl-cuff)" />
      <path d="M 16 40 L 30 40 M 16 46 L 31 46 M 16 52 L 31 52 M 16 58 L 31 58 M 16 64 L 30 64" stroke="#2a1206" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
      {/* the padded fist */}
      <path d="M 32 30 C 40 14, 70 10, 84 22 C 96 32, 96 58, 88 70 C 80 82, 58 86, 44 80 C 36 76, 32 70, 32 62 Z" fill="url(#bam-gl-shade)" />
      {/* the thumb tucked along the bottom */}
      <path d="M 40 66 C 46 58, 62 58, 70 64 C 74 68, 70 74, 62 74 C 52 75, 42 74, 40 66 Z" fill="#c8213a" stroke="rgba(0,0,0,0.25)" strokeWidth="1.2" />
      {/* the knuckle seam and the highlight */}
      <path d="M 70 18 C 84 26, 88 44, 84 60" fill="none" stroke="rgba(60,0,8,0.35)" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="54" cy="26" rx="16" ry="7" fill="#ffd3c4" opacity="0.45" transform="rotate(-18 54 26)" />
      <path d="M 32 30 C 40 14, 70 10, 84 22 C 96 32, 96 58, 88 70 C 80 82, 58 86, 44 80 C 36 76, 32 70, 32 62 Z" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" />
    </svg>
  );
}

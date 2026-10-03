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

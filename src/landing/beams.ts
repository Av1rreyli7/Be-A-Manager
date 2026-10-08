/**
 * The two floodlight beams as small SVG images, drawn once by the browser and then only moved and faded.
 * The old beams were a cone gradient with a CSS mask and a screen blend, which made the GPU redo a full
 * screen blend pass every frame of the intro. Here the cone is twelve nested wedges softened with a light blur and
 * faded towards the bottom inside the image itself, so nothing is blended or masked at run time.
 */
const W = 1296;
const H = 1080;

function wedge(halfDeg: number): string {
  const half = Math.tan((halfDeg * Math.PI) / 180) * H;
  return `${W / 2},0 ${(W / 2 - half).toFixed(1)},${H} ${(W / 2 + half).toFixed(1)},${H}`;
}

/** a beam in the given colour (r, g, b): 0.3 strong down the middle, nothing at 16 degrees out */
export function beamImage(rgb: string): string {
  // twelve nested wedges, 1.33 degrees apart, each adding a little light: a smooth fall off with a crisp core
  const cones = Array.from({ length: 12 }, (_, i) => `<polygon points="${wedge(16 - i * 1.333)}"/>`).join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">` +
    `<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/>` +
    `<stop offset=".45" stop-color="#fff" stop-opacity=".55"/><stop offset=".92" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<mask id="m"><rect width="${W}" height="${H}" fill="url(#f)"/></mask>` +
    `<filter id="b" x="-20%" y="-5%" width="140%" height="110%"><feGaussianBlur stdDeviation="5"/></filter></defs>` +
    `<g mask="url(#m)"><g filter="url(#b)" fill="rgb(${rgb})" fill-opacity=".029">${cones}</g></g></svg>`;
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}

export const BEAM_L = beamImage("230,245,180");
export const BEAM_R = beamImage("255,205,160");

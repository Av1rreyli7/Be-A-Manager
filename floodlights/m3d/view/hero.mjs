// Close up parts for the career scenes (creator, hub, homes): a sculpted head and clumped hair. The match keeps
// its light head from rig.mjs; these are only built at high detail, from the same look, so a player is still
// recognisably himself on the pitch and in close up.
// Head space: x left, y up, z forward, centred on the head bone's rest position (the caller passes the frame).

const gs = (u, mu, s) => Math.exp(-((u - mu) * (u - mu)) / (2 * s * s));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// the face sliders turned into numbers the sculpt uses (0.5 everywhere is the plain face)
export function faceShape(look) {
  const k = (v, d) => (v === undefined || v === null ? d : clamp(v, 0, 1));
  return {
    width: 0.93 + k(look.faceW, 0.5) * 0.14,
    jaw: k(look.jaw, 0.5), chin: k(look.chin, 0.5), cheeks: k(look.cheeks, 0.5), eyes: k(look.eyes, 0.5),
    brows: k(look.brows, 0.5), nose: k(look.nose, 0.5), mouth: k(look.mouth, 0.5), ears: k(look.ears, 0.5)
  };
}

// a point on the sculpted head for a direction on the unit sphere (x, y, z): the base skull, the jaw, and
// the features as smooth bumps and dents. Returns the offset from the head centre, in head radii.
// where the features sit, as heights on the head (1 the crown, -1 the bottom of the chin)
export const FY = { brow: 0.24, eye: 0.03, noseTip: -0.27, noseBase: -0.34, upperLip: -0.46, mouth: -0.51, lowerLip: -0.565, chinDent: -0.66, chin: -0.82, ear: -0.12 };
export function sculpt(x, y, z, F) {
  // a real head is narrower than it is deep: the close up head is slimmer than the match's
  let sx = F.width * 0.88, sy = y > 0 ? 0.97 : 1, sz = z > 0 ? 1.03 : 1.02;
  // the crown rounds over, the back of the skull sits out
  sx *= 1 - smooth(0.55, 1, y) * 0.05;
  if (z < 0 && y > -0.25) sz *= 1.05;
  // the face is widest at the cheekbones, then tapers down to the jaw and chin (a strong jaw tapers less)
  if (y < -0.05) {
    const t = smooth(0.05, 1, -y);
    const narrow = (0.42 - F.jaw * 0.22) * t * (0.45 + Math.max(0, z) * 0.55);
    sx *= 1 - narrow;
    // under the jaw the head tucks back into the neck
    if (z < 0.55) sz *= 1 - smooth(0.45, 1, -y) * 0.35 * (1 - Math.max(0, z) / 0.55);
  }
  sy *= y < FY.chinDent ? 1 + (F.chin - 0.5) * 0.14 : 1;
  let px = x * sx, py = y * sy, pz = z * sz;
  const front = smooth(0.3, 0.8, z);
  // forehead and brow ridge
  pz += 0.028 * gs(y, FY.brow, 0.06) * gs(x, 0, 0.42) * front;
  // eye sockets: almond dents under the brow; the eyeballs sit in these and the skin round them makes the lids
  for (const s of [-1, 1]) pz -= 0.062 * gs(x, s * 0.33, 0.105) * gs(y, FY.eye, 0.046) * front;
  // the upper lid crease and the soft bag under the eye
  for (const s of [-1, 1]) { pz += 0.012 * gs(x, s * 0.33, 0.12) * gs(y, FY.eye + 0.075, 0.02) * front; pz += 0.01 * gs(x, s * 0.33, 0.1) * gs(y, FY.eye - 0.085, 0.03) * front; }
  // cheekbones, just below and outside the eyes
  for (const s of [-1, 1]) pz += (0.012 + F.cheeks * 0.032) * gs(x, s * 0.5, 0.12) * gs(y, FY.eye - 0.17, 0.12) * front;
  // the nose: a narrow bridge from between the eyes to a rounded tip, the wings either side of the base
  const nw = 0.78 + F.nose * 0.55;
  const along = smooth(FY.eye + 0.04, FY.noseTip, y);
  const onNose = smooth(FY.eye + 0.07, FY.eye, y) * (1 - smooth(FY.noseTip - 0.02, FY.noseBase, y));
  pz += (0.03 + 0.17 * along) * onNose * gs(x, 0, (0.045 + 0.05 * along) * nw) * front;
  pz += 0.05 * gs(y, FY.noseTip, 0.045) * gs(x, 0, 0.07 * nw) * front;
  for (const s of [-1, 1]) pz += 0.045 * gs(x, s * 0.095 * nw, 0.04 * nw) * gs(y, FY.noseBase + 0.03, 0.04) * front;
  // the mouth: philtrum, upper lip, the line, the lower lip, the dent under it
  const mw = 0.85 + F.mouth * 0.35;
  pz += 0.012 * gs(y, (FY.noseBase + FY.upperLip) / 2, 0.03) * gs(x, 0, 0.05) * front;
  pz += 0.026 * gs(y, FY.upperLip, 0.033) * gs(x, 0, 0.19 * mw) * front;
  pz -= 0.02 * gs(y, FY.mouth, 0.012) * gs(x, 0, 0.21 * mw) * front;
  pz += 0.026 * gs(y, FY.lowerLip, 0.033) * gs(x, 0, 0.17 * mw) * front;
  pz -= 0.024 * gs(y, FY.chinDent, 0.035) * gs(x, 0, 0.17) * front;
  // the chin
  pz += (0.02 + F.chin * 0.03) * gs(y, FY.chin, 0.08) * gs(x, 0, 0.2) * front;
  return [px, py, pz];
}
// where a feature sits on the face texture: the head is wrapped with u round the head (the face centre at u
// 0.25) and v from the crown (0) to the chin (1)
export function faceUV(x, y) {
  const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
  const phi = Math.acos(Math.max(-1, Math.min(1, y)));
  let th = Math.atan2(z, x);
  if (th < 0) th += Math.PI * 2;
  return [th / (Math.PI * 2), phi / Math.PI];
}

// the whole close up head: one dense sculpted surface (its own material, so the face texture paints the brows,
// lips, stubble and skin), eyes seated in the sockets, and ears
// ctx: { bd, cx, cy, cz, rx, ry, rz, skin, skinD, iris, B, MAT, tag, mixc, look }
export function heroHead(ctx) {
  const { bd, cx, cy, cz, rx, ry, rz, skin, skinD, iris, B, tag, MAT, look } = ctx;
  const F = faceShape(look);
  const latN = 84, lonN = 112;
  const base = bd.n, i0 = bd.idx.length;
  const face = tag(skin.slice(), MAT.face);
  for (let i = 0; i <= latN; i++) {
    const phi = (i / latN) * Math.PI;
    for (let j = 0; j <= lonN; j++) {
      const th = (j / lonN) * Math.PI * 2;
      // th = pi/2 is straight ahead (+z); the extra column closes the seam with its own texture coordinate
      const x = Math.sin(phi) * Math.cos(th), y = Math.cos(phi), z = Math.sin(phi) * Math.sin(th);
      const [px, py, pz] = sculpt(x, y, z, F);
      bd.vert(cx + px * rx, cy + py * ry, cz + pz * rz, face, B.head, B.head, 0, j / lonN, 1 - i / latN);
    }
  }
  const row = lonN + 1;
  for (let i = 0; i < latN; i++) for (let j = 0; j < lonN; j++) {
    const a = base + i * row + j, b = a + 1, c = a + row, d = b + row;
    bd.tri(a, c, b); bd.tri(b, c, d);
  }
  bd.orient(i0, cx, cy, cz, null);
  const at = (x, y) => {
    const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
    const [px, py, pz] = sculpt(x, y, z, F);
    return [cx + px * rx, cy + py * ry, cz + pz * rz];
  };
  // eyes: a ball in each socket, just proud of the skin so the lids form round it; white, a coloured iris with
  // a darker ring and lighter flecks, the pupil, all blended smoothly by how far forward the point faces
  const er = rx * (0.155 + F.eyes * 0.035);
  const white = [0.92, 0.9, 0.87], pink = [0.88, 0.72, 0.7], dark = [0.02, 0.02, 0.02];
  const ring = ctx.mixc(iris, [0, 0, 0], 0.55), fleck = ctx.mixc(iris, [1, 0.95, 0.85], 0.25);
  for (const s of [-1, 1]) {
    const [ex, ey, ez] = at(s * 0.33, FY.eye);
    bd.blob(ex, ey, ez - er * 0.74, er, er, er, (u, v, w) => {
      if (w > 0.95) return tag(dark.slice(), MAT.eye);
      if (w > 0.925) return tag(ctx.mixc(dark, iris, (w - 0.925) / 0.025 * 0.6), MAT.eye);
      if (w > 0.79) return tag(ctx.mixc(ring, ctx.mixc(iris, fleck, Math.max(0, Math.sin(Math.atan2(v, u) * 9)) * 0.5), smooth(0.79, 0.83, w)), MAT.eye);
      return tag(ctx.mixc(pink, white, smooth(0.2, 0.75, w)), MAT.eye);
    }, B.head, 22, 32);
  }
  // ears: a thin shell standing off the head, wider at the top, with the bowl inside and a lobe below
  const ek = 0.82 + F.ears * 0.4;
  const earIn = tag(ctx.mixc(skinD, [0.32, 0.12, 0.1], 0.35), MAT.skin);
  for (const s of [-1, 1]) {
    const [hx] = sculpt(s * 0.999, FY.ear, -0.02, F);
    const ex = cx + hx * rx, ey = cy + ry * FY.ear, ez = cz - rz * 0.12;
    bd.blob(ex + s * rx * 0.05 * ek, ey, ez, rx * 0.065 * ek, ry * 0.25 * ek, rz * 0.17 * ek, skinD, B.head, 12, 18, 0, (u, v, w) => [1, v > 0 ? 1 : 0.92, v > 0 ? 1.08 : 0.8]);
    bd.blob(ex + s * rx * 0.085 * ek, ey + ry * 0.01, ez + rz * 0.035, rx * 0.04 * ek, ry * 0.15 * ek, rz * 0.1 * ek, earIn, B.head, 8, 12);
    bd.blob(ex + s * rx * 0.05 * ek, ey - ry * 0.22 * ek, ez + rz * 0.02, rx * 0.05 * ek, ry * 0.07 * ek, rz * 0.06 * ek, skinD, B.head, 6, 10);
  }
}

// the face texture: painted on a canvas in the head's own wrap, multiplied over the skin colour.
// Brows, lips, the shadow round the eyes, blush, stubble or a beard, and fine skin noise. Built by the page
// (it needs a canvas); the head geometry above carries the coordinates.
export function paintFace(doc, look, skinRgb, hairRgb, size) {
  const W = size || 1024, H = W / 2;
  // the same strokes every time for the same face, so moving a slider never makes the brows flicker
  let seed = 20261007;
  const random = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const cv = doc.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, W, H);
  const F = faceShape(look);
  const P = (x, y) => { const [u, v] = faceUV(x, y); return [u * W, v * H]; };
  const rgba = (c, a) => "rgba(" + Math.round(c[0] * 255) + "," + Math.round(c[1] * 255) + "," + Math.round(c[2] * 255) + "," + a + ")";
  // multiply colours: how much a feature darkens or tints the skin under it
  const tint = (target) => [Math.min(1, target[0] / Math.max(0.05, skinRgb[0])), Math.min(1, target[1] / Math.max(0.05, skinRgb[1])), Math.min(1, target[2] / Math.max(0.05, skinRgb[2]))];
  const blob = (x, y, rxp, ryp, col, a, blur) => {
    const [px, py] = P(x, y);
    g.save(); g.filter = "blur(" + (blur || 0) + "px)"; g.fillStyle = rgba(col, a);
    g.beginPath(); g.ellipse(px, py, rxp, ryp, 0, 0, Math.PI * 2); g.fill(); g.restore();
  };
  // skin: very fine mottling so it never looks like plastic
  const img = g.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) { const n = 247 + Math.floor(random() * 9); img.data[i] = n; img.data[i + 1] = n - 1; img.data[i + 2] = n - 2; }
  g.putImageData(img, 0, 0);
  // shadow round the eyes, the lid crease and the lash line along the upper lid
  for (const s of [-1, 1]) {
    blob(s * 0.33, FY.eye + 0.03, W * 0.022, H * 0.03, tint(skinRgb.map(c => c * 0.8)), 0.5, 6);
    blob(s * 0.33, FY.eye + 0.075, W * 0.02, H * 0.005, tint(skinRgb.map(c => c * 0.62)), 0.45, 2);
    g.save();
    g.strokeStyle = rgba(tint(skinRgb.map(c => c * 0.18)), 0.85);
    g.lineWidth = 2.4 * (W / 1024);
    g.beginPath();
    for (let k = 0; k <= 20; k++) { const t = k / 20; const [px, py] = P(s * (0.255 + t * 0.15), FY.eye + 0.035 + Math.sin(t * Math.PI) * 0.018); if (k) g.lineTo(px, py); else g.moveTo(px, py); }
    g.stroke();
    g.restore();
  }
  // blush and the warmth of the nose tip
  for (const s of [-1, 1]) blob(s * 0.48, FY.eye - 0.2, W * 0.03, H * 0.04, tint([skinRgb[0] * 1.0, skinRgb[1] * 0.82, skinRgb[2] * 0.8]), 0.5, 14);
  blob(0, FY.noseTip, W * 0.012, H * 0.02, tint([skinRgb[0], skinRgb[1] * 0.85, skinRgb[2] * 0.84]), 0.45, 6);
  // lips: a soft rosy shape, a darker line where they meet
  const mw = 0.85 + F.mouth * 0.35;
  const lip = tint([skinRgb[0] * 0.86, skinRgb[1] * 0.58, skinRgb[2] * 0.58]);
  blob(0, FY.upperLip, W * 0.028 * mw, H * 0.016, lip, 0.8, 3);
  blob(0, FY.lowerLip, W * 0.026 * mw, H * 0.02, lip, 0.8, 3);
  blob(0, FY.mouth, W * 0.032 * mw, H * 0.0035, tint(skinRgb.map(c => c * 0.45)), 0.7, 1);
  // brows: many short strokes along an arch, thicker near the nose
  const browC = tint(hairRgb.map(c => c * 0.9));
  g.save();
  g.strokeStyle = rgba(browC, 0.85);
  g.lineCap = "round";
  for (const s of [-1, 1]) {
    for (let k = 0; k < 70; k++) {
      const t = k / 69;
      const bx = s * (0.19 + t * 0.3), by = FY.brow - 0.01 + Math.sin(t * Math.PI) * 0.035 - t * 0.02 + (random() - 0.5) * 0.012 * (0.6 + F.brows);
      const [px, py] = P(bx, by);
      g.lineWidth = (1.2 + (1 - t) * 1.6) * (0.6 + F.brows * 0.9) * (W / 1024);
      g.beginPath(); g.moveTo(px, py); g.lineTo(px + s * W * 0.006, py - H * 0.004 * (1 - t)); g.stroke();
    }
  }
  g.restore();
  // stubble and beards: dense specks where the beard grows, a few lighter over the cheeks
  const b = look.beard || 0;
  const beardAt = (x, y) => {
    if (b === 1 || b === 2 || b === 3) return y < FY.noseBase + 0.04 && Math.abs(x) < 0.9;
    if (b === 4) return y < FY.mouth && Math.abs(x) < 0.3;
    if (b === 5) return y < FY.noseBase + 0.04 && (y < FY.chin || Math.abs(x) > 0.55);
    return false;
  };
  const beardC = tint(hairRgb), dense = b === 3 ? 0.35 : 0.85;
  if (b || look.moustache) {
    g.save();
    for (let k = 0; k < 26000; k++) {
      const x = (random() - 0.5) * 1.9, y = -0.2 - random() * 0.8;
      if (x * x + y * y > 1) continue;
      const lipZone = y < FY.upperLip + 0.03 && y > FY.lowerLip - 0.03 && Math.abs(x) < 0.2;
      const mo = look.moustache && y < FY.noseBase && y > FY.upperLip + 0.02 && Math.abs(x) < 0.25;
      if (!(mo || (beardAt(x, y) && !lipZone))) continue;
      if (random() > dense) continue;
      const [px, py] = P(x, y);
      g.fillStyle = rgba(beardC, 0.5 + random() * 0.4);
      g.fillRect(px, py, 1.4 * (W / 1024), 1.4 * (W / 1024));
    }
    g.restore();
  }
  return cv;
}

// ---------- hair in close up ----------
// Short and medium hair is drawn by the page as shells (layers over the scalp that a shader cuts into strands);
// this file says where it grows, how long, which way it is combed and how much it curls, and builds the parts
// shells cannot: buns, long hair, locks, cornrow ridges.
// len is the longest strand in head radii; curl 0 straight to 1.4 tight; flow is the comb direction on the head.
export const HAIR = [
  { name: "buzz", len: 0.03, curl: 0.1, flow: [0, -0.2, -1] },
  { name: "crop", len: 0.2, curl: 0.15, flow: [0, 0.1, 1], fringe: true },
  { name: "curly", len: 0.28, curl: 1.2, flow: [0, 0.6, -0.4] },
  { name: "afro", len: 0.62, curl: 1.4, flow: [0, 1, 0], puff: true },
  { name: "bun", len: 0.06, curl: 0, flow: [0, 0.3, -1], bun: true },
  { name: "mohawk", len: 0.4, curl: 0.3, flow: [0, 1, -0.3], strip: true },
  { name: "bald", len: 0, curl: 0, flow: [0, 0, -1] },
  { name: "long", len: 0.22, curl: 0.15, flow: [0, -0.4, -1], long: true },
  { name: "sidepart", len: 0.3, curl: 0.1, flow: [1, 0.15, -0.3], part: true },
  { name: "fade", len: 0.24, curl: 0.5, flow: [0, 0.5, 0.2], fade: true },
  { name: "cornrows", len: 0.03, curl: 0, flow: [0, 0.2, -1], rows: true },
  { name: "dreads", len: 0.06, curl: 0.3, flow: [0, 0.2, -1], locs: true },
  { name: "quiff", len: 0.38, curl: 0.15, flow: [0, 1, 0.5], quiff: true, fade: true },
  { name: "undercut", len: 0.07, curl: 0, flow: [0, 0.2, -1], bun: true, fade: true, high: true },
  { name: "twists", len: 0.3, curl: 0.8, flow: [0, 1, 0], twists: true },
  { name: "mullet", len: 0.2, curl: 0.35, flow: [0, -0.3, -1], mullet: true }
];
export const HERO_STYLES = HAIR.map(s => s.name);
export function hairStyleOf(style) { return HAIR[((style | 0) % 16 + 16) % 16]; }

// how long the hair is at a point on the head (a direction x, y, z on the unit sphere): 0 none, 1 the full length.
// The edge of the hair is one smooth line round the head: the hairline across the forehead (receding a little at
// the temples), down in front of the ears as sideburns, over the tops of the ears, and down to the nape.
export function hairCoverage(style, hairline) {
  const St = hairStyleOf(style);
  const hl = hairline === undefined || hairline === null ? 0.45 : hairline;
  const lineY = 0.52 - (hl - 0.45) * 0.45;
  return (x, y, z) => {
    if (St.name === "bald") return 0;
    const ax = Math.abs(x);
    const a = Math.atan2(z, ax); // pi/2 the face, 0 the side, -pi/2 the back
    // the height of the hair's edge going round the head
    const front = lineY - 0.24 * ax * ax * (1 + (hl - 0.45));
    const side = 0.13, burn = -0.2, back = -0.5;
    let edge;
    if (a > 0.75) edge = front;
    else if (a > 0.45) edge = burn + (front - burn) * smooth(0.45, 0.75, a);
    else if (a > 0.18) edge = burn;
    else if (a > 0.02) edge = side + (burn - side) * smooth(0.02, 0.18, a);
    else edge = back + (side - back) * smooth(-0.6, 0.02, a);
    const inHair = smooth(edge - 0.03, edge + 0.04, y);
    if (inHair <= 0) return 0;
    const sideness = Math.min(1, ax / 0.85);
    let v = 1;
    // the cut: a fade runs from bare skin low on the sides up to the length on top; most cuts keep the back and
    // sides shorter than the top; long styles keep their length all round
    if (St.fade) v = 0.03 + 0.97 * smooth(St.high ? 0.6 : 0.4, St.high ? 0.84 : 0.7, y + (1 - sideness) * 0.28);
    else if (!St.puff && !St.long && !St.mullet && St.name !== "buzz") v = 0.28 + 0.72 * Math.max(smooth(-0.05, 0.5, y), 1 - sideness);
    if (St.strip) v = smooth(0.24, 0.16, ax) * smooth(0.15, 0.3, y) * 0.96 + 0.04;
    if (St.mullet && a < -0.2 && y < 0.25) v = 1;
    return Math.max(0, Math.min(1, v * inHair));
  };
}

// the head's frame in the body's own space, for a body of height h (the page parents hair to the head bone)
export function headFrame(h) { return { cx: 0, cy: 0.93 * h, cz: 0.012 * h, rx: 0.051 * h, ry: 0.066 * h, rz: 0.06 * h }; }

// a cheap hash so every player's hair falls the same way every time
function rand(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

// the parts shells cannot draw
export function heroHair(ctx) {
  const { bd, cx, cy, cz, rx, ry, rz, col, style, B, tag, MAT, mixc } = ctx;
  const St = hairStyleOf(style);
  if (St.name === "bald") return;
  const dark = tag(mixc(col, [0, 0, 0], 0.35), MAT.hair), light = tag(mixc(col, [1, 1, 1], 0.1), MAT.hair);
  const F = faceShape(ctx.look || {});
  const on = (x, y, z, out) => { const [px, py, pz] = sculpt(x, y, z, F); return [cx + px * rx * out, cy + py * ry * out, cz + pz * rz * out]; };
  if (St.bun) {
    const [bx, by, bz] = on(0, St.high ? 0.86 : 0.62, -0.5, 1.1);
    bd.blob(bx, by, bz, rx * 0.3, ry * 0.26, rz * 0.3, (x, y, z) => (Math.sin(x * 18 + y * 11 + z * 7) > 0.55 ? dark : col), B.hair, 14, 18);
    bd.blob(bx, by - ry * 0.12, bz + rz * 0.12, rx * 0.2, ry * 0.07, rz * 0.12, dark, B.head, 6, 10);
  }
  if (St.long || St.mullet) {
    // hair falling to the shoulders at the back and sides, on the hair bone so it swings
    const n = St.long ? 26 : 16;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (St.long ? 0.05 + (i / (n - 1)) * 0.9 : 0.25 + (i / (n - 1)) * 0.5);
      const x = Math.cos(a), z = -Math.sin(a) * 0.95;
      const [hx, hy, hz] = on(x * 0.92, -0.05, z, 1.06);
      const L = ry * (St.long ? 1.05 : 0.6) * (0.85 + rand(i + 3) * 0.3);
      bd.blob(hx, hy - L * 0.42, hz, rx * 0.17, L * 0.55, rz * 0.08, (u, v) => (Math.sin(u * 30 + i) > 0.6 ? dark : rand(i) < 0.3 ? light : col), B.hair, 10, 8);
    }
  }
  if (St.locs) for (let i = 0; i < 46; i++) {
    const a = rand(i + 70) * Math.PI * 2, y0 = 0.35 + rand(i + 71) * 0.5;
    const r0 = Math.sqrt(1 - y0 * y0), x = Math.cos(a) * r0, z = Math.sin(a) * r0;
    if (z > 0.45 && y0 < 0.8) continue;
    const [hx, hy, hz] = on(x, y0, z, 1.08);
    const L = ry * (0.75 + rand(i + 72) * 0.55);
    bd.blob(hx, hy - L * 0.45, hz, rx * 0.075, L * 0.55, rz * 0.075, (u, v) => (Math.sin(v * 26 + i) > 0.25 ? dark : col), B.hair, 8, 8);
  }
  if (St.rows) for (let k = -3; k <= 3; k++) for (let t = 0; t <= 22; t++) {
    const a = -0.1 + (t / 22) * 1.35;
    const y = Math.cos(a * Math.PI * 0.62) * 0.98, z0 = Math.sin(a * Math.PI * 0.62);
    const x = k * 0.13 * Math.sqrt(Math.max(0, 1 - y * y * 0.4));
    const [hx, hy, hz] = on(x, y, z0, 1.035);
    bd.blob(hx, hy, hz, rx * 0.045, ry * 0.035, rz * 0.045, t % 2 ? dark : col, B.head, 4, 8);
  }
  if (St.twists) for (let i = 0; i < 190; i++) {
    const u = rand(i + 100), v = rand(i + 101);
    const y = 1 - u * 0.95, ph = v * Math.PI * 2, r = Math.sqrt(Math.max(0, 1 - y * y));
    const x = r * Math.cos(ph), z = r * Math.sin(ph);
    if (hairCoverage(style, ctx.hairline)(x, y, z) < 0.5) continue;
    const [hx, hy, hz] = on(x, y, z, 1.12);
    bd.blob(hx, hy, hz, rx * 0.055, ry * 0.085, rz * 0.055, (a, b) => (Math.sin(b * 34 + i) > 0 ? dark : col), B.head, 6, 8);
  }
}

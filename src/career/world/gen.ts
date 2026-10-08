/**
 * The city plan, worked out from a seed: the street grid, the districts, the sea front when the city has water,
 * every building lot, where each place stands and where its door is, the street lamps, trees, parked cars, the
 * bus loop and its stops, and the boxes he bumps into. Pure numbers, no three.js, so it is cheap to rebuild
 * when he moves to a new city and easy to draw on the map.
 */
import type { CityStyle, WorldPlace } from "../types";

export type Flavor = "uk" | "euro" | "med" | "gulf" | "india" | "us";
export interface Box {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}
export interface Building {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  /** 0 flat, 1 pitched roof, 2 a set back top */
  roof: number;
  /** index into the palette walls */
  col: number;
  zone: Zone;
}
export type Zone = "centre" | "mid" | "suburb" | "hill" | "outskirts" | "sports" | "seafront" | "park" | "river" | "sea";
export interface PlaceSpot {
  place: WorldPlace;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  /** the door, on the pavement, and the way he faces when he comes out */
  door: { x: number; z: number; ry: number };
  /** the direction from the building out to the street */
  face: [number, number];
  zone: Zone;
}
export interface Stop {
  id: string;
  name: string;
  x: number;
  z: number;
  ry: number;
  /** distance along the bus loop */
  at: number;
}
export interface Lane {
  /** a straight stretch of one lane between two corners */
  ax: number;
  az: number;
  bx: number;
  bz: number;
}
export interface CityPlan {
  key: string;
  seed: number;
  n: number;
  pitch: number;
  road: number;
  walk: number;
  half: number;
  flavor: Flavor;
  /** 1 drive on the right, -1 on the left */
  side: number;
  palette: { walls: string[]; roofs: string[]; ground: string; accent: string; glassy: number };
  heightK: number;
  /** blocks at and below this row are sea front and sea (null when there is no water) */
  coastRow: number | null;
  /** an inland city with water gets a river (or canal) along this row of blocks instead of a sea */
  riverRow: number | null;
  coastZ: number | null;
  zones: Zone[][];
  districts: { name: string; x: number; z: number }[];
  buildings: Building[];
  places: PlaceSpot[];
  parks: Box[];
  trees: [number, number, number][];
  lamps: [number, number, number][];
  parked: [number, number, number, number][];
  benches: [number, number, number][];
  stops: Stop[];
  bus: [number, number][];
  busLen: number;
  colliders: Box[];
  spawn: { x: number; z: number; ry: number };
}

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// the look of a country's streets
const FLAVOR_OF: Record<string, Flavor> = {
  London: "uk", Manchester: "uk", Liverpool: "uk",
  Madrid: "euro", Paris: "euro", Munich: "euro", Milan: "euro", Turin: "euro",
  Barcelona: "med", Rome: "med", Lisbon: "med",
  Riyadh: "gulf", Jeddah: "gulf",
  Mumbai: "india", Goa: "india", Kolkata: "india", Bengaluru: "india", Chennai: "india", Kochi: "india", Guwahati: "india",
  Jamshedpur: "india", Hyderabad: "india", Bhubaneswar: "india", Delhi: "india", Shillong: "india",
  default: "us",
};
const PALETTES: Record<Flavor, { walls: string[]; roofs: string[]; glassy: number }> = {
  uk: { walls: ["#6b4434", "#7a4c3a", "#8a6e5c", "#c9c2b3", "#4e5560", "#5c3a2e"], roofs: ["#3a3f46", "#4a3a34", "#2f3338"], glassy: 0.3 },
  euro: { walls: ["#d8cdb8", "#c9bba0", "#e3dccd", "#a89f92", "#bfae94", "#6f747c"], roofs: ["#5a5f66", "#6d4c3d", "#474b52"], glassy: 0.35 },
  med: { walls: ["#efe6d6", "#e7d3b1", "#d9b68f", "#f3ece0", "#c99a76", "#d6c4a4"], roofs: ["#b4553a", "#a84a33", "#c06a46"], glassy: 0.2 },
  gulf: { walls: ["#d9c29a", "#e5d6b8", "#c9ad83", "#bfc9cf", "#9fb3bf", "#e9e1d0"], roofs: ["#c9b08a", "#8d9aa3", "#a89676"], glassy: 0.6 },
  india: { walls: ["#d9cbb0", "#c96f4a", "#e2b04a", "#8fb3a6", "#e8e0d0", "#b9a68d", "#d98a6c"], roofs: ["#6b6259", "#857766", "#4f4a44"], glassy: 0.3 },
  us: { walls: ["#8a8f96", "#b8b0a2", "#6c7076", "#a07e66", "#c7c2b8", "#5e646b"], roofs: ["#3c4046", "#4a4e54", "#33373c"], glassy: 0.45 },
};
// left hand traffic
const LEFT = new Set(["uk", "india"]);
// the cities on a sea front; other cities with water get a river through town
const COAST = new Set(["Mumbai", "Goa", "Chennai", "Kochi", "Barcelona", "Lisbon", "Liverpool", "Jeddah"]);


/** where on the map each kind of place goes */
function zoneFor(p: WorldPlace, hasSea: boolean): Zone {
  if (p.kind === "stadium" || p.kind === "training") return "sports";
  // schools in the leafy ring of homes, colleges a little further in
  if (p.kind === "school") return "suburb";
  if (p.kind === "college") return "mid";
  if (p.kind === "home") {
    const id = p.homeId || p.id.replace("home:", "");
    if (id === "mansion") return "hill";
    if (id === "villa") return "suburb";
    if (id === "penthouse") return "centre";
    return "mid";
  }
  if (p.where === "seafront") return hasSea ? "seafront" : "centre";
  if (p.kind === "dealer" || p.kind === "supermarket") return "outskirts";
  if (p.kind === "clinic" || p.kind === "gym") return "mid";
  if (p.where === "hill") return "hill";
  if (p.where === "suburb") return "suburb";
  if (p.where === "outskirts") return "outskirts";
  return "centre";
}
// footprint of each kind of place: width along the street, depth back from it, height
function sizeFor(p: WorldPlace): [number, number, number] {
  switch (p.kind) {
    case "stadium":
      return [52, 52, 22];
    case "training":
      return [52, 52, 6];
    case "school":
    case "college":
      return [52, 52, 14];
    case "mall":
      return [46, 40, 18];
    case "supermarket":
      return [40, 26, 9];
    case "dealer":
      return [30, 22, 9];
    case "club":
      return [18, 18, 10];
    case "clinic":
      return [20, 16, 12];
    case "gym":
      return [20, 18, 10];
    case "restaurant":
      return [20, 16, 8];
    case "cafe":
      return [10, 12, 7];
    case "watches":
      return [13, 14, 9];
    case "home": {
      const id = p.homeId || p.id.replace("home:", "");
      if (id === "mansion") return [48, 44, 12];
      if (id === "villa") return [30, 28, 8];
      if (id === "penthouse") return [20, 20, 96];
      if (id === "apartment") return [18, 16, 36];
      if (id === "family") return [14, 14, 14];
      return [14, 14, 20];
    }
    default:
      return [13, 14, 9];
  }
}

export function makePlan(city: string, style: CityStyle, places: WorldPlace[], seed: number, tier: number): CityPlan {
  const key = city + "|" + seed;
  const r = rng(hash(key));
  const flavor: Flavor = FLAVOR_OF[city] || FLAVOR_OF[style.key] || "us";
  const pal = PALETTES[flavor];
  const n = tier >= 3 ? 12 : tier === 2 ? 11 : 10;
  const pitch = 72;
  const road = 10;
  const walk = 4;
  const half = (n * pitch) / 2;
  const inner = pitch - road - walk * 2;
  // the sea for cities on a coast; a river through the middle for the other cities with water
  const hasSea = !!style.water && COAST.has(city);
  const hasRiver = !!style.water && !hasSea;
  const coastRow = hasSea ? n - 2 : null;
  const riverRow = hasRiver ? Math.floor(n * 0.6) : null;
  // block (i, j) covers x from -half + i * pitch; its buildable square is inset by the road and the pavements
  const bx = (i: number) => -half + i * pitch + pitch / 2;
  const bz = (j: number) => -half + j * pitch + pitch / 2;
  const coastZ = coastRow === null ? null : bz(coastRow) + inner / 2;

  // ---------- zones: the middle is the centre, a ring of homes and offices, the hill to the north, the
  // sports ground in one corner, sheds and showrooms in another, the sea front to the south ----------
  const zones: Zone[][] = [];
  const mid = (n - 1) / 2;
  const sportsCorner = r() < 0.5 ? 0 : 1;
  for (let i = 0; i < n; i++) {
    zones.push([]);
    for (let j = 0; j < n; j++) {
      const d = Math.max(Math.abs(i - mid), Math.abs(j - (hasSea ? mid - 1 : mid)));
      let z: Zone = d <= 1.6 ? "centre" : d <= 3.2 ? "mid" : "suburb";
      if (j <= 1) z = d <= 2.6 ? "mid" : "hill";
      if (coastRow !== null && j === coastRow) z = "seafront";
      if (coastRow !== null && j > coastRow) z = "sea";
      const sx = sportsCorner === 0 ? i <= 2 : i >= n - 3;
      if (sx && j >= n - (hasSea ? 5 : 3) && j < (coastRow ?? n)) z = "sports";
      const ox = sportsCorner === 0 ? i >= n - 3 : i <= 2;
      if (ox && j >= mid - 1 && j <= mid + 2 && z !== "seafront") z = "outskirts";
      if (riverRow !== null && j === riverRow - 1 && z !== "centre" && z !== "sports") z = "seafront";
      if (riverRow !== null && j === riverRow) z = "river";
      zones[i].push(z);
    }
  }
  // a few parks in the mid ring and the suburbs
  const parkSet = new Set<string>();
  for (let k = 0; k < Math.max(2, Math.round(n / 3)); k++) {
    const i = 1 + Math.floor(r() * (n - 2)),
      j = 1 + Math.floor(r() * (n - 3));
    if (zones[i][j] === "mid" || zones[i][j] === "suburb") {
      parkSet.add(i + "," + j);
      zones[i][j] = "park";
    }
  }
  // the four district names spread over the map
  const dn = style.districts.length ? style.districts : ["Old Town", "Riverside", "Hillside", "The Docks"];
  const districts = [
    { name: dn[0], x: bx(Math.floor(mid)), z: bz(Math.floor(mid)) },
    { name: dn[1], x: bx(n - 2), z: bz(hasSea ? n - 3 : n - 2) },
    { name: dn[2], x: bx(Math.floor(mid)), z: bz(0) },
    { name: dn[3] || dn[0], x: bx(1), z: bz(hasSea ? n - 4 : n - 2) },
  ];

  // ---------- the places: each one takes a stretch of street front in a block of its zone ----------
  type Front = { i: number; j: number; side: number; used: [number, number][] };
  const fronts = new Map<string, Front>();
  const frontOf = (i: number, j: number, side: number) => {
    const k = i + "," + j + "," + side;
    let f = fronts.get(k);
    if (!f) {
      f = { i, j, side, used: [] };
      fronts.set(k, f);
    }
    return f;
  };
  // side: 0 north (low z), 1 east, 2 south, 3 west; the face points out to that street
  const FACE: [number, number][] = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  const wholeBlock = new Set<string>();
  const spots: PlaceSpot[] = [];
  const blocksIn = (z: Zone) => {
    const out: [number, number][] = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (zones[i][j] === z && !wholeBlock.has(i + "," + j)) out.push([i, j]);
    return out;
  };
  const fits = (f: Front, a: number, b: number) => f.used.every(([u0, u1]) => b <= u0 - 1 || a >= u1 + 1);
  const order = places.slice().sort((a, b) => sizeFor(b)[0] * sizeFor(b)[1] - sizeFor(a)[0] * sizeFor(a)[1]);
  for (const p of order) {
    if (p.where === "mall" && p.kind !== "mall") continue; // inside the mall
    const zone = zoneFor(p, hasSea || hasRiver);
    const [w, d, h0] = sizeFor(p);
    const h = h0 * (p.kind === "home" ? 1 : 1) * (zone === "centre" && p.kind !== "home" ? 1 : 1);
    const whole = w >= 46 && d >= 40;
    let blocks = blocksIn(zone);
    if (!blocks.length) blocks = blocksIn("mid");
    if (!blocks.length) blocks = blocksIn("suburb");
    // a ground that takes a whole block and finds none left in its own zone tries the quieter zones next
    if (whole) {
      const free = (b: [number, number]) => ![0, 1, 2, 3].some((s2) => frontOf(b[0], b[1], s2).used.length);
      if (!blocks.some(free)) for (const z2 of ["suburb", "mid", "outskirts", "hill", "sports"] as Zone[]) if (z2 !== zone) blocks = blocks.concat(blocksIn(z2).filter(free));
    }
    // shuffle, but keep it the same for the same city
    blocks.sort((a, b) => hash(key + p.id + a.join(",")) - hash(key + p.id + b.join(",")));
    let done = false;
    for (const [i, j] of blocks) {
      if (done) break;
      if (whole) {
        if ([0, 1, 2, 3].some((s) => frontOf(i, j, s).used.length)) continue;
        wholeBlock.add(i + "," + j);
        // the door faces the street towards the middle of town
        const side = Math.abs(bx(i)) > Math.abs(bz(j)) ? (bx(i) > 0 ? 3 : 1) : bz(j) > 0 ? 0 : 2;
        const [fx, fz] = FACE[side];
        const cx = bx(i),
          cz = bz(j);
        const door = { x: cx + (fx * inner) / 2 + fx * 1.2, z: cz + (fz * inner) / 2 + fz * 1.2, ry: Math.atan2(fx, fz) };
        spots.push({ place: p, x: cx, z: cz, w: Math.min(w, inner - 2), d: Math.min(d, inner - 2), h, door, face: [fx, fz], zone });
        for (const s of [0, 1, 2, 3]) frontOf(i, j, s).used.push([-inner / 2, inner / 2]);
        done = true;
        break;
      }
      const sides = [0, 1, 2, 3].sort((a, b) => hash(key + p.id + i + j + a) - hash(key + p.id + i + j + b));
      // a sea front place faces the sea
      if (zone === "seafront") sides.sort((a, b) => (b === 2 ? 1 : 0) - (a === 2 ? 1 : 0));
      for (const side of sides) {
        if (wholeBlock.has(i + "," + j)) break;
        const f = frontOf(i, j, side);
        // try spots along the front, from the middle out
        const span = inner;
        const slots = [0, -span / 4, span / 4, -span / 2.6, span / 2.6];
        for (const c of slots) {
          const a = c - w / 2,
            b = c + w / 2;
          if (a < -span / 2 || b > span / 2) continue;
          if (!fits(f, a, b)) continue;
          // the back must not hit a place on the far side of the block
          if (d > inner / 2 - 2) {
            const opp = frontOf(i, j, (side + 2) % 4);
            if (opp.used.some(([u0, u1]) => !(b <= -u1 - 1 || a >= -u0 + 1))) continue;
          }
          f.used.push([a, b]);
          const [fx, fz] = FACE[side];
          // along the front: the tangent; the building sits with its face on the edge of the block
          const tx = -fz,
            tz = fx;
          const cx = bx(i) + (fx * (inner - d)) / 2 + tx * c,
            cz = bz(j) + (fz * (inner - d)) / 2 + tz * c;
          const ww = Math.abs(fx) > 0 ? d : w,
            dd = Math.abs(fx) > 0 ? w : d;
          const door = { x: cx + (fx * d) / 2 + fx * 1.2, z: cz + (fz * d) / 2 + fz * 1.2, ry: Math.atan2(fx, fz) };
          spots.push({ place: p, x: cx, z: cz, w: ww, d: dd, h, door, face: [fx, fz], zone });
          done = true;
          break;
        }
        if (done) break;
      }
    }
  }

  // ---------- filler buildings along every free street front ----------
  const buildings: Building[] = [];
  const parks: Box[] = [];
  const trees: [number, number, number][] = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const z = zones[i][j];
      const cx = bx(i),
        cz = bz(j);
      if (wholeBlock.has(i + "," + j)) continue;
      if (z === "park") {
        parks.push({ x0: cx - inner / 2, z0: cz - inner / 2, x1: cx + inner / 2, z1: cz + inner / 2 });
        for (let k = 0; k < 14; k++) trees.push([cx + (r() - 0.5) * (inner - 6), cz + (r() - 0.5) * (inner - 6), 0.8 + r() * 0.7]);
        continue;
      }
      if (z === "sea" || z === "river") continue;
      for (const side of [0, 1, 2, 3]) {
        const f = frontOf(i, j, side);
        const [fx, fz] = FACE[side];
        const tx = -fz,
          tz = fx;
        // the sea front keeps its south side open to the beach
        if (z === "seafront" && side === 2) continue;
        let c = -inner / 2;
        while (c < inner / 2 - 4) {
          const lotW = z === "centre" ? 12 + r() * 10 : z === "suburb" || z === "hill" ? 11 + r() * 6 : z === "outskirts" || z === "sports" ? 16 + r() * 12 : 10 + r() * 8;
          let a = c,
            b = Math.min(inner / 2, c + lotW);
          // corners: the east and west sides leave room for the fronts on north and south
          if (side === 1 || side === 3) {
            a = Math.max(a, -inner / 2 + 14);
            b = Math.min(b, inner / 2 - 14);
          }
          c += lotW + (z === "suburb" || z === "hill" ? 4 + r() * 4 : 0.6);
          if (b - a < 6) continue;
          const clash = f.used.some(([u0, u1]) => !(b <= u0 - 0.5 || a >= u1 + 0.5));
          if (clash) continue;
          const mid2 = (a + b) / 2;
          let depth = z === "centre" ? 14 + r() * 10 : z === "suburb" || z === "hill" ? 9 + r() * 4 : 10 + r() * 8;
          depth = Math.min(depth, inner / 2 - 1);
          let h: number;
          const hk = style.height;
          if (z === "centre") h = (14 + Math.pow(r(), 1.6) * 90) * hk;
          else if (z === "mid") h = (9 + r() * 22) * Math.max(0.7, hk * 0.9);
          else if (z === "suburb" || z === "hill") h = 5.5 + r() * 3.5;
          else if (z === "seafront") h = (7 + r() * 16) * Math.max(0.7, hk * 0.8);
          else h = 7 + r() * 9;
          if (flavor === "india" && z !== "centre") h *= 0.85;
          const x = cx + (fx * (inner - depth)) / 2 + tx * mid2,
            zz = cz + (fz * (inner - depth)) / 2 + tz * mid2;
          const w = Math.abs(fx) > 0 ? depth : b - a,
            d = Math.abs(fx) > 0 ? b - a : depth;
          const pitched = (flavor === "uk" || flavor === "med" || flavor === "euro") && h < 22 ? (r() < 0.75 ? 1 : 0) : z === "suburb" || z === "hill" ? 1 : 0;
          const roof = h > 45 && r() < 0.5 ? 2 : pitched;
          buildings.push({ x, z: zz, w, d, h, roof, col: Math.floor(r() * pal.walls.length), zone: z });
          if ((z === "suburb" || z === "hill") && r() < 0.8) trees.push([x - fx * (depth / 2 + 3) + tx * 3, zz - fz * (depth / 2 + 3) + tz * 3, 0.7 + r() * 0.6]);
        }
      }
    }

  // ---------- pavement furniture: lamps, trees, benches, parked cars ----------
  const lamps: [number, number, number][] = [];
  const parked: [number, number, number, number][] = [];
  const benches: [number, number, number][] = [];
  const kerb = inner / 2 + walk - 0.6;
  const side = LEFT.has(flavor) ? -1 : 1;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (zones[i][j] === "sea" || zones[i][j] === "river") continue;
      const cx = bx(i),
        cz = bz(j);
      for (const s of [0, 1, 2, 3]) {
        const [fx, fz] = FACE[s];
        const tx = -fz,
          tz = fx;
        for (let c = -inner / 2 + 6; c <= inner / 2 - 6; c += 18) {
          lamps.push([cx + fx * kerb + tx * c, cz + fz * kerb + tz * c, Math.atan2(fx, fz)]);
          const z = zones[i][j];
          if ((z === "mid" || z === "centre" || z === "seafront") && r() < 0.35) trees.push([cx + fx * kerb + tx * (c + 9), cz + fz * kerb + tz * (c + 9), 0.55 + r() * 0.3]);
          // parked cars sit in the kerbside lane, nose along the traffic
          if (r() < (z === "centre" ? 0.25 : 0.4) && z !== "sports") {
            const px = cx + fx * (inner / 2 + walk + 1.3) + tx * (c + 4),
              pz = cz + fz * (inner / 2 + walk + 1.3) + tz * (c + 4);
            // never in front of a door, so every place can be reached and his own car has room at home
            if (!spots.some((sp) => Math.hypot(sp.door.x - px, sp.door.z - pz) < 12)) parked.push([px, pz, Math.atan2(tx, tz) + (r() < 0.5 ? 0 : Math.PI), Math.floor(r() * 4)]);
          }
          if (z === "seafront" && s === 2) benches.push([cx + fx * (kerb - 1.6) + tx * (c + 5), cz + fz * (kerb - 1.6) + tz * (c + 5), Math.atan2(fx, fz)]);
        }
      }
    }

  // ---------- the bus: a loop round the middle of town on the streets, with stops by the big places ----------
  const k0 = Math.max(1, Math.floor(n / 2) - 3),
    k1 = Math.min(n - 1, Math.floor(n / 2) + 3 - (hasSea ? 1 : 0));
  const gx = (k: number) => -half + k * pitch;
  // the loop on road lines k0 and k1; each stretch sits in the lane on its own side of the road (the right
  // of the direction of travel where they drive on the right, the left where they drive on the left)
  const centre: [number, number][] = [
    [gx(k0), gx(k0)],
    [gx(k1), gx(k0)],
    [gx(k1), gx(k1)],
    [gx(k0), gx(k1)],
  ];
  const offOf = (a: [number, number], b: [number, number]): [number, number] => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    return [((-dz / l) * road * side) / 4, ((dx / l) * road * side) / 4];
  };
  // where two offset stretches meet: the x of the stretch that runs along z, the z of the one along x
  const corners: [number, number][] = centre.map((c, k) => {
    const prev = centre[(k + 3) % 4],
      next = centre[(k + 1) % 4];
    const o1 = offOf(prev, c),
      o2 = offOf(c, next);
    const alongX1 = Math.abs(c[0] - prev[0]) > Math.abs(c[1] - prev[1]);
    return alongX1 ? [c[0] + o2[0], c[1] + o1[1]] : [c[0] + o1[0], c[1] + o2[1]];
  });
  const bus: [number, number][] = [];
  for (let k = 0; k < 4; k++) {
    const [ax, az] = corners[k],
      [bx2, bz2] = corners[(k + 1) % 4];
    const len = Math.hypot(bx2 - ax, bz2 - az);
    const steps = Math.max(1, Math.round(len / 8));
    for (let t = 0; t < steps; t++) bus.push([ax + ((bx2 - ax) * t) / steps, az + ((bz2 - az) * t) / steps]);
  }
  let busLen = 0;
  const atLen: number[] = [];
  for (let k = 0; k < bus.length; k++) {
    atLen.push(busLen);
    const [ax, az] = bus[k],
      [bx2, bz2] = bus[(k + 1) % bus.length];
    busLen += Math.hypot(bx2 - ax, bz2 - az);
  }
  // stops: one in the middle of every block side along the loop, named after what is near
  const stops: Stop[] = [];
  const named = new Set<string>();
  for (let k = 0; k < bus.length; k++) {
    const [x, z] = bus[k];
    const [nx, nz] = bus[(k + 1) % bus.length];
    // the middle of a block side: halfway between road lines
    const along = Math.abs(nx - x) > Math.abs(nz - z) ? x : z;
    const m = (((along + half) % pitch) + pitch) % pitch;
    if (Math.abs(m - pitch / 2) > 4) continue;
    if (stops.length && atLen[k] - stops[stops.length - 1].at < pitch * 1.4) continue;
    // the stop stands on the pavement beside the lane
    const dx = nx - x,
      dz = nz - z;
    const l = Math.hypot(dx, dz) || 1;
    const ox = (-dz / l) * side * (road / 4 + walk * 0.6 + 1.2),
      oz = (dx / l) * side * (road / 4 + walk * 0.6 + 1.2);
    let best = "";
    let bd = 1e9;
    for (const s of spots) {
      if (s.place.kind === "home") continue;
      const dd = Math.hypot(s.door.x - x, s.door.z - z);
      if (dd < bd && !named.has(s.place.name)) {
        bd = dd;
        best = s.place.name;
      }
    }
    if (best) named.add(best);
    stops.push({ id: "stop" + stops.length, name: best ? best : "Stop " + (stops.length + 1), x: x + ox, z: z + oz, ry: Math.atan2(dx, dz), at: atLen[k] });
  }

  // ---------- what he bumps into ----------
  const colliders: Box[] = [];
  for (const b of buildings) colliders.push({ x0: b.x - b.w / 2, z0: b.z - b.d / 2, x1: b.x + b.w / 2, z1: b.z + b.d / 2 });
  for (const s of spots) {
    if (s.place.kind === "training") continue;
    if (s.place.kind === "stadium") {
      // the stands are a ring he cannot walk through, with the entrance on the door side
      colliders.push({ x0: s.x - s.w / 2, z0: s.z - s.d / 2, x1: s.x + s.w / 2, z1: s.z + s.d / 2 });
      continue;
    }
    colliders.push({ x0: s.x - s.w / 2, z0: s.z - s.d / 2, x1: s.x + s.w / 2, z1: s.z + s.d / 2 });
  }
  // the river: he can cross it on the bridges (the roads) but not walk into it
  if (riverRow !== null)
    for (let i = 0; i < n; i++) {
      const cx = bx(i),
        cz = bz(riverRow);
      colliders.push({ x0: cx - inner / 2 - walk, z0: cz - inner / 2 - walk, x1: cx + inner / 2 + walk, z1: cz + inner / 2 + walk });
    }
  // he starts at his front door, or on the pavement in the middle of town
  const homeSpot = spots.find((s) => s.place.kind === "home");
  const spawn = homeSpot ? { x: homeSpot.door.x + homeSpot.face[0] * 1.5, z: homeSpot.door.z + homeSpot.face[1] * 1.5, ry: homeSpot.door.ry } : { x: bx(Math.floor(mid)) + inner / 2 + walk / 2, z: bz(Math.floor(mid)), ry: 0 };

  return {
    key,
    seed,
    n,
    pitch,
    road,
    walk,
    half,
    flavor,
    side,
    palette: { walls: pal.walls, roofs: pal.roofs, ground: style.ground, accent: style.accent, glassy: pal.glassy },
    heightK: style.height,
    coastRow,
    riverRow,
    coastZ,
    zones,
    districts,
    buildings,
    places: spots,
    parks,
    trees,
    lamps,
    parked,
    benches,
    stops,
    bus,
    busLen,
    colliders,
    spawn,
  };
}

// ---------- collisions: a grid of buckets so a step only checks the boxes around him ----------
export class Grid {
  cell: number;
  map = new Map<string, Box[]>();
  constructor(boxes: Box[], cell = 24) {
    this.cell = cell;
    for (const b of boxes) {
      for (let x = Math.floor(b.x0 / cell); x <= Math.floor(b.x1 / cell); x++)
        for (let z = Math.floor(b.z0 / cell); z <= Math.floor(b.z1 / cell); z++) {
          const k = x + "," + z;
          const a = this.map.get(k);
          if (a) a.push(b);
          else this.map.set(k, [b]);
        }
    }
  }
  near(x: number, z: number) {
    return this.map.get(Math.floor(x / this.cell) + "," + Math.floor(z / this.cell)) || [];
  }
  /** push a circle out of every box it overlaps; returns true when it hit something */
  push(p: { x: number; z: number }, rad: number) {
    let hit = false;
    for (let pass = 0; pass < 2; pass++)
      for (const dx of [-rad, 0, rad])
        for (const dz of [-rad, 0, rad])
          for (const b of this.near(p.x + dx, p.z + dz)) {
            const cx = Math.max(b.x0, Math.min(p.x, b.x1)),
              cz = Math.max(b.z0, Math.min(p.z, b.z1));
            const ex = p.x - cx,
              ez = p.z - cz;
            const d2 = ex * ex + ez * ez;
            if (d2 >= rad * rad) continue;
            hit = true;
            if (d2 > 1e-8) {
              const d = Math.sqrt(d2);
              p.x = cx + (ex / d) * rad;
              p.z = cz + (ez / d) * rad;
            } else {
              // inside the box: out by the nearest face
              const l = p.x - b.x0,
                rr = b.x1 - p.x,
                t = p.z - b.z0,
                bt = b.z1 - p.z;
              const m = Math.min(l, rr, t, bt);
              if (m === l) p.x = b.x0 - rad;
              else if (m === rr) p.x = b.x1 + rad;
              else if (m === t) p.z = b.z0 - rad;
              else p.z = b.z1 + rad;
            }
          }
    return hit;
  }
  /** is the straight line from a to b clear of boxes (for the camera) */
  clear(ax: number, az: number, bx: number, bz: number, steps = 10) {
    for (let k = 1; k <= steps; k++) {
      const x = ax + ((bx - ax) * k) / steps,
        z = az + ((bz - az) * k) / steps;
      for (const b of this.near(x, z)) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return k / steps;
    }
    return 1;
  }
}

/** the road grid as lanes for the traffic: every block side in both directions */
export function roadLanes(p: CityPlan): Lane[] {
  const out: Lane[] = [];
  const g = (k: number) => -p.half + k * p.pitch;
  const off = (p.road / 4) * p.side;
  const lastRow = p.coastRow === null ? p.n : p.coastRow + 1;
  for (let k = 0; k <= p.n; k++)
    for (let m = 0; m < p.n; m++) {
      // a road along x at z = g(k), from x = g(m) to g(m + 1)
      if (k <= lastRow) {
        out.push({ ax: g(m), az: g(k) + off, bx: g(m + 1), bz: g(k) + off });
        out.push({ ax: g(m + 1), az: g(k) - off, bx: g(m), bz: g(k) - off });
      }
      // a road along z at x = g(k)
      if (m < lastRow) {
        out.push({ ax: g(k) - off, az: g(m), bx: g(k) - off, bz: g(m + 1) });
        out.push({ ax: g(k) + off, az: g(m + 1), bx: g(k) + off, bz: g(m) });
      }
    }
  return out;
}

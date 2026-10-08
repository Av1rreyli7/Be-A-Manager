// The open city's plan (src/career/world/gen.ts): every place gets a lot and a door he can reach, the same city
// always comes out the same, different cities come out different, the sea and rivers go where they should, the
// bus loop is closed with stops on it, and the collision grid keeps him out of buildings but not off pavements.
import { describe, expect, it } from "vitest";
import { makePlan, Grid, roadLanes } from "../src/career/world/gen";
import type { CityStyle, WorldPlace } from "../src/career/types";

const style = (o: Partial<CityStyle> = {}): CityStyle => ({ key: "default", climate: "temperate", sky: ["#0b1630", "#e58a52"], ground: "#1d2420", build: "#2b3138", accent: "#d0e85c", height: 1, water: false, districts: ["Old Town", "Riverside", "Hillside", "The Docks"], ...o });
const S = { floor: "#111111", wall: "#222222", accent: "#d0e85c", trim: "#ffffff", vibe: "minimal" };
const P = (id: string, kind: WorldPlace["kind"], where: WorldPlace["where"] = "centre", extra: Partial<WorldPlace> = {}): WorldPlace => ({ id, kind, name: id, where, style: S, ...extra });
const PLACES: WorldPlace[] = [
  P("mall", "mall", "centre", { inside: ["store:nike", "store:zara"] }),
  P("store:nike", "store", "mall"),
  P("store:zara", "store", "mall"),
  P("store:gucci", "store", "luxury"),
  P("store:dior", "store", "luxury"),
  P("watches", "watches", "luxury"),
  P("boots", "store", "street"),
  P("supermarket", "supermarket", "outskirts"),
  P("cafe:starbucks", "cafe", "street"),
  P("restaurant", "restaurant", "seafront"),
  P("club", "club", "centre", { minAge: 18 }),
  P("clinic", "clinic", "suburb"),
  P("gym", "gym", "street"),
  P("training", "training", "outskirts"),
  P("stadium", "stadium", "suburb"),
  P("dealer:everyday", "dealer", "outskirts"),
  P("dealer:prestige", "dealer", "outskirts"),
  P("dealer:super", "dealer", "outskirts"),
  P("home:shared", "home", "suburb", { homeId: "shared" }),
  P("home:apartment", "home", "centre", { homeId: "apartment" }),
  P("home:penthouse", "home", "seafront", { homeId: "penthouse" }),
  P("home:villa", "home", "outskirts", { homeId: "villa" }),
  P("home:mansion", "home", "hill", { homeId: "mansion" }),
];

describe("the city plan", () => {
  it("places every place that has its own door, and none of the stores inside the mall", () => {
    const plan = makePlan("London", style({ key: "London", water: true, height: 1.3 }), PLACES, 7, 3);
    const ids = plan.places.map((s) => s.place.id);
    for (const p of PLACES) {
      if (p.where === "mall") expect(ids).not.toContain(p.id);
      else expect(ids).toContain(p.id);
    }
  });

  it("is the same every time for the same city, and different for another", () => {
    const a = makePlan("Madrid", style({ key: "Madrid" }), PLACES, 11, 3);
    const b = makePlan("Madrid", style({ key: "Madrid" }), PLACES, 11, 3);
    const c = makePlan("Riyadh", style({ key: "Riyadh", height: 1.5 }), PLACES, 12, 3);
    expect(a.buildings.length).toBe(b.buildings.length);
    expect(a.places.map((s) => [s.x, s.z])).toEqual(b.places.map((s) => [s.x, s.z]));
    expect(a.places.map((s) => [s.x, s.z])).not.toEqual(c.places.map((s) => [s.x, s.z]));
    expect(a.flavor).toBe("euro");
    expect(c.flavor).toBe("gulf");
  });

  it("puts the sea by a coastal city, a river through an inland one with water, and neither in a dry one", () => {
    const coast = makePlan("Barcelona", style({ key: "Barcelona", water: true }), PLACES, 3, 3);
    const river = makePlan("Manchester", style({ key: "Manchester", water: true }), PLACES, 3, 2);
    const dry = makePlan("Madrid", style({ key: "Madrid", water: false }), PLACES, 3, 3);
    expect(coast.coastRow).not.toBeNull();
    expect(coast.riverRow).toBeNull();
    expect(river.coastRow).toBeNull();
    expect(river.riverRow).not.toBeNull();
    expect(dry.coastRow).toBeNull();
    expect(dry.riverRow).toBeNull();
    // nothing is built in the water
    for (const plan of [coast, river]) {
      const wet = (x: number, z: number) => {
        const i = Math.floor((x + plan.half) / plan.pitch),
          j = Math.floor((z + plan.half) / plan.pitch);
        return i >= 0 && j >= 0 && i < plan.n && j < plan.n && (plan.zones[i][j] === "sea" || plan.zones[i][j] === "river");
      };
      for (const b of plan.buildings) expect(wet(b.x, b.z)).toBe(false);
      for (const s of plan.places) expect(wet(s.x, s.z)).toBe(false);
    }
    // drive on the left in Britain and India, on the right in Spain
    expect(river.side).toBe(-1);
    expect(dry.side).toBe(1);
  });

  it("gives every door a free spot on the pavement he can stand on", () => {
    for (const [city, water] of [
      ["London", true],
      ["Mumbai", true],
      ["Paris", true],
      ["Madrid", false],
    ] as const) {
      const plan = makePlan(city, style({ key: city, water }), PLACES, 5, 3);
      const grid = new Grid(plan.colliders);
      for (const s of plan.places) {
        const p = { x: s.door.x + s.face[0] * 0.6, z: s.door.z + s.face[1] * 0.6 };
        const before = { ...p };
        grid.push(p, 0.38);
        // standing just outside the door, nothing pushes him away
        expect(Math.hypot(p.x - before.x, p.z - before.z)).toBeLessThan(0.05);
      }
      // the start is outside his own front door, on the pavement
      const sp = { ...plan.spawn };
      grid.push(sp, 0.38);
      expect(Math.hypot(sp.x - plan.spawn.x, sp.z - plan.spawn.z)).toBeLessThan(0.05);
    }
  });

  it("keeps him out of buildings when he walks into them from the street", () => {
    const plan = makePlan("Milan", style({ key: "Milan" }), PLACES, 9, 3);
    const grid = new Grid(plan.colliders);
    const inAny = (x: number, z: number) => plan.colliders.some((c) => x > c.x0 + 0.01 && x < c.x1 - 0.01 && z > c.z0 + 0.01 && z < c.z1 - 0.01);
    let walks = 0,
      inside = 0;
    for (const b of plan.buildings.slice(0, 300)) {
      // from 3 m out of each face that is open ground, walk straight at the building
      for (const [ox, oz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const p = { x: b.x + ox * (b.w / 2 + 3), z: b.z + oz * (b.d / 2 + 3) };
        if (inAny(p.x, p.z)) continue;
        walks++;
        for (let k = 0; k < 120; k++) {
          p.x -= ox * 0.1;
          p.z -= oz * 0.1;
          grid.push(p, 0.38);
        }
        if (inAny(p.x, p.z)) inside++;
      }
    }
    expect(walks).toBeGreaterThan(300);
    expect(inside).toBe(0);
  });

  it("runs a closed bus loop on the streets with named stops, never named after a private home", () => {
    const plan = makePlan("Lisbon", style({ key: "Lisbon", water: true }), PLACES, 4, 3);
    expect(plan.bus.length).toBeGreaterThan(20);
    expect(plan.stops.length).toBeGreaterThanOrEqual(4);
    expect(plan.busLen).toBeGreaterThan(400);
    const homes = new Set(PLACES.filter((p) => p.kind === "home").map((p) => p.name));
    for (const st of plan.stops) {
      expect(st.name.length).toBeGreaterThan(0);
      expect(homes.has(st.name)).toBe(false);
      expect(st.at).toBeGreaterThanOrEqual(0);
      expect(st.at).toBeLessThan(plan.busLen);
    }
    // each step of the loop is short and the loop closes on itself
    for (let k = 0; k < plan.bus.length; k++) {
      const a = plan.bus[k],
        b = plan.bus[(k + 1) % plan.bus.length];
      expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeLessThan(12);
    }
  });

  it("lays out lanes for the traffic on both sides of every street, none of them in the sea", () => {
    const plan = makePlan("Jeddah", style({ key: "Jeddah", water: true }), PLACES, 2, 3);
    const lanes = roadLanes(plan);
    expect(lanes.length).toBeGreaterThan(200);
    for (const L of lanes) {
      expect(Math.abs(L.az - L.bz) < 1e-6 || Math.abs(L.ax - L.bx) < 1e-6).toBe(true);
      if (plan.coastZ !== null) expect(Math.max(L.az, L.bz)).toBeLessThan(plan.coastZ + plan.pitch);
    }
  });

  it("keeps parked cars clear of every door", () => {
    const plan = makePlan("London", style({ key: "London", water: true }), PLACES, 8, 3);
    for (const [x, z] of plan.parked) for (const s of plan.places) expect(Math.hypot(s.door.x - x, s.door.z - z)).toBeGreaterThanOrEqual(12);
  });
});
